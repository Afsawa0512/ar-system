"""
Invoice Data Extractor — Robust multi-format parser.
Extracts structured data from invoices regardless of layout.

Usage: python extract_invoice.py <file_path>
"""

import sys, os, re, json
from datetime import datetime

# ═══════════════════════════════════════════════════════════
#  UTILITIES
# ═══════════════════════════════════════════════════════════

def clean(s):
    if not s: return ''
    return re.sub(r'\s+', ' ', str(s)).strip()

def parse_date(raw):
    """Parse any date string → YYYY-MM-DD."""
    if not raw: return ''
    raw = raw.strip()
    # Normalise separators
    d = re.sub(r'[/.]', '-', raw)
    fmts = ['%d-%m-%Y','%d-%m-%y','%Y-%m-%d','%m-%d-%Y',
            '%d %b %Y','%d %B %Y','%b %d, %Y','%B %d, %Y',
            '%d-%b-%Y','%d-%b-%y','%Y-%b-%d']
    for f in fmts:
        try: return datetime.strptime(d, f).strftime('%Y-%m-%d')
        except: pass
    return raw

def to_float(s):
    if not s: return 0.0
    s = re.sub(r'[₹Γé╣\??,\s]', '', str(s))
    try: return float(s)
    except: return 0.0

def extract_date_only(s):
    """Pull the first date-like token out of a string."""
    m = re.search(r'(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})', str(s))
    return m.group(1) if m else ''

# ═══════════════════════════════════════════════════════════
#  KEY-VALUE LINE PARSER  (format-independent)
# ═══════════════════════════════════════════════════════════

def build_kv_map(text):
    """
    Walk every line and extract ALL key:value pairs.
    Handles multiple pairs on one line (e.g. '# : INV-000066 Place Of Supply : Delhi').
    Also handles 'Label  Amount' without colon for financial rows.
    """
    kv = {}
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        if not line: continue

        # Find ALL  "Label : Value" pairs on the line
        pairs = re.findall(r'([A-Za-z][A-Za-z \t/&.#]+?)\s*:\s*([^:]+?)(?=\s+[A-Za-z][A-Za-z \t/&.#]+?\s*:|$)', line)
        for label, value in pairs:
            kv[clean(label).lower()] = clean(value)

        # Also handle "Label  Amount" without colon for financial lines
        # e.g. "Sub Total 2,00,037.25" or "Total ₹83,632.50"
        m_amt = re.match(r'^(Sub\s*Total|Subtotal|Grand\s*Total|Total|Balance\s*Due|Amount\s*Due|Credits?\s*Applied|Adjustment|Discount|Payment\s*Made)\s+[₹Γé╣\?]*(\s*[\d,]+\.\d{2})\s*$', line, re.I)
        if m_amt:
            kv[clean(m_amt.group(1)).lower()] = clean(m_amt.group(2))
    return kv

# ═══════════════════════════════════════════════════════════
#  SMART FIELD EXTRACTORS
# ═══════════════════════════════════════════════════════════

_GSTIN_RE = re.compile(r'\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b')
_DATE_RE  = re.compile(r'\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\b')
_AMT_RE   = re.compile(r'[₹Γé╣\?]?\s*([\d,]+\.\d{2})\b')

def _kv_get(kv, *keys):
    """Lookup first matching key (case-insensitive, substring)."""
    for k in keys:
        for mk, mv in kv.items():
            if k in mk: return mv
    return ''

def _kv_get_exact(kv, *keys):
    """Lookup matching key exactly (case-insensitive)."""
    for k in keys:
        if k in kv: return kv[k]
    return ''

def _find_section(text, start_labels, stop_labels):
    """Extract lines between start_label and stop_label."""
    lines = text.split('\n')
    collecting = False
    result = []
    for ln in lines:
        stripped = ln.strip()
        low = stripped.lower()
        if not collecting:
            for sl in start_labels:
                if sl in low:
                    # If "Label : value" on same line, grab value part too
                    after = re.sub(r'^.*?:\s*', '', stripped)
                    if after and after.lower() != low:
                        result.append(after)
                    collecting = True
                    break
        else:
            # Stop on next section header or empty line after content
            hit_stop = False
            for stop in stop_labels:
                if stop in low:
                    hit_stop = True
                    break
            if hit_stop:
                break
            if stripped:
                result.append(stripped)
    return result

def _grab_company_name(lines):
    """From a list of address-block lines, extract just the company name (first line
    that looks like a company name — contains Pvt/Ltd/LLP/Inc/Corp/Consultancy etc,
    or just the first non-empty line).
    Handles two-column merges (e.g. 'COMPANY A PVT.LTD COMPANY B LIMITED, addr')."""
    company_keywords = re.compile(
        r'(Pvt|Ltd|Private|Limited|LLP|Inc|Corp|Company|Consultancy|'
        r'Technologies|Solutions|Services|Enterprises|Industries|Systems|'
        r'Software|Infotech|Infosys|Tech)', re.I)

    for ln in lines:
        ln = ln.strip()
        if not ln: continue
        # Skip lines that are clearly addresses (start with numbers + street words)
        if re.match(r'^\d+[\s,\-]', ln) and not company_keywords.search(ln):
            continue
        # Skip lines that are just city/state/pin
        if re.match(r'^\d{5,6}\s', ln): continue
        # Skip GSTIN lines
        if _GSTIN_RE.search(ln): continue

        # If line contains a company suffix, try to extract just the first company name
        suffix_match = re.search(
            r'^(.+?(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|LLP|Inc\.?|Corp\.?))',
            ln, re.I)
        if suffix_match:
            name = clean(suffix_match.group(1))
            return name

        # Otherwise return the whole (first non-empty, non-address) line
        return clean(ln)
    return clean(lines[0]) if lines else ''

def _extract_address(lines, company_name=''):
    """From address-block lines, skip the company name line, concat the rest."""
    addr = []
    found_company = False
    for ln in lines:
        ln = ln.strip()
        if not ln: continue
        if _GSTIN_RE.search(ln): continue
        if not found_company and company_name and company_name.lower() in ln.lower():
            found_company = True
            continue
        if not found_company and not company_name:
            found_company = True  # skip first line as company name
            continue
        addr.append(ln)
    return clean(', '.join(addr))


# ═══════════════════════════════════════════════════════════
#  ITEM TABLE PARSER
# ═══════════════════════════════════════════════════════════

def _parse_item_lines(text):
    """Find the line-item table and extract description, HSN, qty, rate, amount.
    Works for various formats:
      1  Some Description  998512  1.00  70,875.00  18%  12,757.50  70,875.00
      or separate columns, etc.
    """
    lines = text.split('\n')
    items = []

    # Detect header row (contains words like # Item Description HSN Qty Rate Amount)
    header_idx = -1
    for i, ln in enumerate(lines):
        low = ln.lower()
        if (('description' in low or 'particulars' in low or 'item' in low)
                and ('qty' in low or 'rate' in low or 'amount' in low or 'hsn' in low)):
            header_idx = i
            break

    if header_idx < 0:
        return items

    # Scan lines after header for item rows (start with a digit index or have amounts)
    for i in range(header_idx + 1, min(header_idx + 30, len(lines))):
        ln = lines[i].strip()
        if not ln: continue
        # Stop at totals area
        low = ln.lower()
        if any(kw in low for kw in ['sub total', 'subtotal', 'total in words', 'notes', 'terms and conditions']):
            break

        # Try: starts with digit (item number)
        m = re.match(r'^(\d+)\s+(.+)', ln)
        if m:
            rest = m.group(2)
            item = _parse_item_rest(rest, lines, i)
            if item:
                items.append(item)
            continue

        # Or: line with amounts that is continuation / single-row item
        if _AMT_RE.search(ln) and len(ln) > 10:
            item = _parse_item_rest(ln, lines, i)
            if item: items.append(item)

    return items

def _parse_item_rest(rest, lines, idx):
    """Parse the rest of an item line into description, hsn, qty, rate, amount."""
    item = {'description': '', 'hsnSac': '', 'quantity': 1, 'rate': 0, 'amount': 0}

    # Find all amounts in this line
    amounts = [to_float(a) for a in _AMT_RE.findall(rest)]

    # Find HSN/SAC (4-8 digit code)
    hsn = re.search(r'\b(\d{4,8})\b', rest)
    # Make sure it's not a year or a date
    if hsn:
        val = hsn.group(1)
        if len(val) >= 4 and not re.match(r'^(19|20)\d{2}$', val):
            item['hsnSac'] = val

    # Extract description: everything before the first number cluster (HSN or amount)
    # Remove HSN, quantities, amounts to get pure description
    desc = rest
    # Remove trailing numbers/amounts
    desc = re.sub(r'\s+\d{4,8}\s+', ' ', desc)  # HSN
    desc = re.sub(r'\s+\d+\.\d{2}\b', '', desc)  # amounts like 70,875.00
    desc = re.sub(r'\s+[\d,]+\.\d{2}\b', '', desc)  # amounts with commas
    desc = re.sub(r'\s+\d+%', '', desc)  # percentages
    desc = re.sub(r'\s+\d+\s+', ' ', desc)  # standalone numbers
    desc = clean(desc)
    # Remove leading dash
    desc = re.sub(r'^[-–—]\s*', '', desc).strip()

    item['description'] = desc

    # Check next lines for continuation (indented description lines)
    if idx + 1 < len(lines):
        next_line = lines[idx + 1].strip()
        # If next line has no amounts and doesn't start with a number, it's continuation
        if next_line and not _AMT_RE.search(next_line) and not re.match(r'^\d+\s', next_line):
            low = next_line.lower()
            if not any(kw in low for kw in ['sub total', 'subtotal', 'total', 'gst', 'igst', 'cgst', 'sgst']):
                item['description'] += ' — ' + clean(next_line)

    # Quantity — look for X.00 pattern (qty is typically a small whole number)
    qty_match = re.search(r'\b(\d{1,4})\.00\b', rest)
    if qty_match:
        item['quantity'] = int(qty_match.group(1))

    # Assign amounts — skip values that match qty (e.g. 1.00 is qty not rate)
    qty_val = float(item['quantity'])
    filtered_amounts = [a for a in amounts if abs(a - qty_val) > 0.001]

    if len(filtered_amounts) >= 2:
        item['rate'] = filtered_amounts[0]
        item['amount'] = filtered_amounts[-1]
    elif len(filtered_amounts) == 1:
        item['rate'] = filtered_amounts[0]
        item['amount'] = filtered_amounts[0]
    elif len(amounts) >= 2:
        # Fallback if filtering removed everything
        item['rate'] = amounts[0]
        item['amount'] = amounts[-1]
    elif len(amounts) == 1:
        item['rate'] = amounts[0]
        item['amount'] = amounts[0]

    return item


# ═══════════════════════════════════════════════════════════
#  MAIN EXTRACTION ENGINE
# ═══════════════════════════════════════════════════════════

def extract_invoice_data(text):
    """
    Robust multi-format invoice parser.
    Strategy:
      1. Build key-value map from all "Label: Value" lines
      2. Find GSTIN numbers positionally (seller = first, buyer = second)
      3. Parse Bill To / Ship To sections for buyer info
      4. Parse item table for descriptions
      5. Use fallback calculations for missing fields
    """
    data = {}
    kv = build_kv_map(text)
    lines = text.split('\n')
    all_gstins = _GSTIN_RE.findall(text)

    # ── Invoice Number ──
    inv_num = (_kv_get(kv, 'invoice no', 'invoice number', 'inv no', 'invoice #')
               or _kv_get_exact(kv, '#'))
    if not inv_num:
        m = re.search(r'(INV[-/]?\d{3,})', text, re.I)
        if m: inv_num = m.group(1)
    data['invoiceNumber'] = clean(inv_num)

    # ── Invoice Date (strict: date token only) ──
    raw = _kv_get(kv, 'invoice date')
    if not raw: raw = _kv_get_exact(kv, 'date')
    data['invoiceDate'] = parse_date(extract_date_only(raw) or raw)

    # ── Due Date (strict: date token only) ──
    raw = _kv_get(kv, 'due date', 'payment due')
    data['dueDate'] = parse_date(extract_date_only(raw) or raw)

    # ── Terms ──
    terms_raw = _kv_get(kv, 'terms', 'payment terms')
    terms_num = re.search(r'(\d+)', terms_raw) if terms_raw else None
    if terms_num:
        data['Terms'] = terms_num.group(1)
    elif data['invoiceDate'] and data['dueDate']:
        try:
            d1 = datetime.strptime(data['invoiceDate'], '%Y-%m-%d')
            d2 = datetime.strptime(data['dueDate'], '%Y-%m-%d')
            data['Terms'] = str((d2 - d1).days)
        except:
            data['Terms'] = ''
    else:
        data['Terms'] = ''

    # ── GSTIN: seller = first, buyer = second ──
    data['sellerGSTIN'] = all_gstins[0] if len(all_gstins) >= 1 else ''
    data['buyerGSTIN']  = all_gstins[1] if len(all_gstins) >= 2 else ''

    # ── Seller Name & Address ──
    # Strategy: The very top of the invoice usually has the seller.
    # Take lines before the first "GSTIN" mention or "Invoice"/"Tax Invoice"
    seller_lines = []
    for ln in lines:
        stripped = ln.strip()
        if not stripped: continue
        low = stripped.lower()
        if any(kw in low for kw in ['gstin', 'tax invoice', 'invoice no', 'invoice date', 'invoice #',
                                      'bill to', 'billed to', 'place of supply']):
            break
        seller_lines.append(stripped)

    data['sellerName'] = _grab_company_name(seller_lines)
    data['sellerAddress'] = _extract_address(seller_lines, data['sellerName'])

    # ── Buyer / Bill To ──
    # Handle two-column layout: "Bill To Ship To" on same line
    # In that case pdfplumber concatenates columns, so we try to split
    buyer_lines = _find_section(text,
        ['bill to', 'billed to', 'buyer', 'customer details', 'client'],
        ['gstin', 'subject', 'place of supply', 'item', 'description',
         'hsn', '#', 'sr', 'sl', 'particulars', 'igst', 'cgst'])

    # Check if "Ship To" appears in buyer lines — indicates merged columns
    cleaned_buyer_lines = []
    for bl in buyer_lines:
        # If a line contains both bill-to and ship-to data, take only first half
        if re.search(r'\b(ship\s*to|deliver\s*to)\b', bl, re.I):
            continue  # skip "Ship To" header line
        # If line looks like two companies merged (e.g. "COMPANY A  COMPANY B, address")
        # Try to split at a second company pattern or address pattern starting mid-line
        parts = re.split(r'\s{3,}', bl)  # split on 3+ spaces (column separator)
        if len(parts) > 1:
            cleaned_buyer_lines.append(clean(parts[0]))
        else:
            cleaned_buyer_lines.append(bl)

    data['companyName'] = _grab_company_name(cleaned_buyer_lines) if cleaned_buyer_lines else ''
    data['buyerAddress'] = _extract_address(cleaned_buyer_lines, data['companyName']) if cleaned_buyer_lines else ''

    # If buyer GSTIN was found in the buyer section text, use it
    for bl in buyer_lines:
        g = _GSTIN_RE.search(bl)
        if g:
            data['buyerGSTIN'] = g.group(1)
            break

    # ── State ──
    data['State'] = clean(_kv_get(kv, 'state name', 'state'))

    # ── Place of Supply ──
    data['placeOfSupply'] = clean(_kv_get(kv, 'place of supply'))

    # ── Subject ──
    data['subject'] = clean(_kv_get_exact(kv, 'subject'))
    if not data['subject']:
        # Fallback: look for "Subject :" followed by text on next line
        m = re.search(r'Subject\s*:\s*\n(.+)', text, re.I)
        if m: data['subject'] = clean(m.group(1))

    # ── Item Table Parsing ──
    items = _parse_item_lines(text)

    if items:
        # Use the first item for primary fields
        first = items[0]
        data['description'] = first.get('description', '')
        data['hsnSac'] = first.get('hsnSac', '')
        data['quantity'] = first.get('quantity', 1)
        data['total_price'] = first.get('rate', 0)

        # If multiple items, combine descriptions
        if len(items) > 1:
            descs = [it['description'] for it in items if it.get('description')]
            data['description'] = ' | '.join(descs)
    else:
        # Fallback: try kv
        data['description'] = data.get('subject', '')
        data['hsnSac'] = clean(_kv_get(kv, 'hsn', 'sac'))
        data['quantity'] = 1
        data['total_price'] = 0

    # Ensure HSN/SAC from kv if not from table
    if not data.get('hsnSac'):
        hsn = re.search(r'\b(\d{4,8})\b', _kv_get(kv, 'hsn', 'sac code', 'hsn/sac'))
        if hsn: data['hsnSac'] = hsn.group(1)

    # ── Financial Fields (from kv map) ──
    data['subtotal'] = to_float(_kv_get(kv, 'sub total', 'subtotal'))
    if not data['subtotal']:
        # Fallback: scan for "Sub Total  2,00,037.25" without colon
        m = re.search(r'Sub\s*Total\s+[₹Γé╣\?]*(\s*[\d,]+\.\d{2})', text, re.I)
        if m: data['subtotal'] = to_float(m.group(1))
    if not data['subtotal'] and data['total_price'] and data['quantity']:
        data['subtotal'] = data['total_price'] * data['quantity']

    # GST Rate
    gst_str = _kv_get(kv, 'igst', 'cgst', 'sgst', 'gst')
    gst_rate = 0
    if gst_str:
        rm = re.search(r'(\d+)\s*%', gst_str)
        if rm: gst_rate = int(rm.group(1))
    if not gst_rate:
        # Scan text for X% pattern near IGST/CGST/SGST
        rm = re.search(r'(?:IGST|CGST|SGST|GST)\s*@?\s*(\d+)\s*%', text, re.I)
        if rm: gst_rate = int(rm.group(1))
        else:
            rm = re.search(r'(\d+)%', text)
            if rm:
                v = int(rm.group(1))
                if v in (5, 12, 18, 28): gst_rate = v
    data['GST'] = gst_rate or 18

    # GST Amount
    gst_amt_str = ''
    for key in ['igst18', 'igst', 'cgst', 'sgst', 'gst amount', 'tax amount']:
        v = _kv_get_exact(kv, key)
        if v:
            # Value might be like "(18%) 12,757.50"
            amt_m = re.search(r'([\d,]+\.\d{2})', v)
            if amt_m:
                gst_amt_str = amt_m.group(1)
                break
    data['GST_Amount'] = to_float(gst_amt_str)
    if not data['GST_Amount'] and data['subtotal']:
        data['GST_Amount'] = round(data['subtotal'] * (data['GST'] / 100), 2)

    # Total Amount — look for line with just "Total ₹83,632.50"
    total_amt = 0
    # Try kv first: "Grand Total", "Total", "Invoice Total"
    for key in ['grand total', 'invoice total', 'total amount', 'net amount']:
        v = _kv_get_exact(kv, key)
        if v:
            total_amt = to_float(v)
            if total_amt: break

    if not total_amt:
        # Fallback: scan lines for "Total  ₹XX,XXX.XX" (not Sub Total)
        for ln in reversed(lines):
            stripped = ln.strip()
            low = stripped.lower()
            if 'sub total' in low or 'subtotal' in low: continue
            if re.match(r'^total\b', low, re.I):
                amt_m = _AMT_RE.search(stripped)
                if amt_m:
                    total_amt = to_float(amt_m.group(1))
                    break
        # Also try "Total ???2,36,044.00" pattern
        if not total_amt:
            m = re.search(r'(?<!Sub\s)Total\s+[\?\u20b9\u0393\u00e9\u2563]+\s*([\d,]+\.?\d*)', text, re.I)
            if m: total_amt = to_float(m.group(1))

    if not total_amt:
        total_amt = (data['subtotal'] or 0) + (data['GST_Amount'] or 0)
    data['total_Amount'] = total_amt

    # Credits Applied (includes Payment Made and Amount Withheld)
    credits = 0
    for key in ['credits applied', 'credit applied', 'adjustment', 'discount', 'payment made']:
        v = _kv_get_exact(kv, key)
        if not v:
            v = _kv_get(kv, key)
        if v:
            c = to_float(v)
            credits += abs(c)
    if not credits:
        m = re.search(r'Credits?\s*Applied\s*\(?[\-\s]*\)?\s*[₹Γé╣\?]*\s*([\d,]+\.?\d*)', text, re.I)
        if m: credits = to_float(m.group(1))
    # Also check for "Payment Made" and "Amount Withheld" in text
    for pat in [r'Payment\s*Made\s*\(?[\-\s]*\)?\s*[\?\u20b9\u0393\u00e9\u2563]*\s*([\d,]+\.?\d*)',
                r'Amount\s*Withheld\s*\(?[\-\s]*\)?\s*[\?\u20b9\u0393\u00e9\u2563]*\s*([\d,]+\.?\d*)']:
        m = re.search(pat, text, re.I)
        if m: credits += to_float(m.group(1))
    data['creditsApplied'] = credits

    # Balance Due
    bal = 0
    for key in ['balance due', 'amount due', 'due amount']:
        v = _kv_get_exact(kv, key)
        if not v: v = _kv_get(kv, key)
        if v:
            bal = to_float(v)
            break
    if not bal:
        m = re.search(r'Balance\s*Due\s*[₹Γé╣\?]*\s*([\d,]+\.?\d*)', text, re.I)
        if m: bal = to_float(m.group(1))
    data['balance_due'] = bal
    if not data['balance_due'] and data['total_Amount']:
        data['balance_due'] = max(0, data['total_Amount'] - data['creditsApplied'])

    # Total in Words
    tiw = ''
    for pat in [
        r'(?:Indian\s*Rupee[s]?)\s+(.*?Only)',
        r'(?:Rupees?)\s+(.*?Only)',
        r'(?:Total\s*[Ii]n\s*[Ww]ords?)\s*[.:]*\s*\n?.*?((?:[A-Z][a-z]+[\s\-]+)+.*?Only)',
        r'(?:Amount\s*[Ii]n\s*[Ww]ords?)\s*[.:]*\s*(.*?Only)',
    ]:
        m = re.search(pat, text, re.I | re.DOTALL)
        if m:
            tiw = clean(m.group(1))
            break
    data['totalInWords'] = tiw

    # Payment Status
    if data['balance_due'] <= 0 or data['creditsApplied'] >= data['total_Amount']:
        data['paymentStatus'] = 'Paid'
    elif 0 < data['balance_due'] < data['total_Amount']:
        data['paymentStatus'] = 'PartiallyPaid'
    else:
        data['paymentStatus'] = 'Due'

    # ── Bank Details ──
    data['bankAccountName'] = clean(_kv_get(kv, 'account name', 'a/c name'))
    data['bankAccountNo']   = clean(_kv_get(kv, 'account no', 'a/c no', 'account number'))
    data['bankName']        = clean(_kv_get(kv, 'bank name'))
    data['bankAddress']     = clean(_kv_get(kv, 'bank address', 'branch address', 'branch'))
    data['bankIFSC']        = clean(_kv_get(kv, 'ifsc'))
    data['bankSWIFT']       = clean(_kv_get(kv, 'swift'))

    # Clean IFSC/SWIFT with regex
    if data['bankIFSC']:
        m = re.search(r'([A-Z]{4}\d[A-Z0-9]{6})', data['bankIFSC'])
        data['bankIFSC'] = m.group(1) if m else data['bankIFSC']
    if data['bankSWIFT']:
        m = re.search(r'([A-Z]{6,11})', data['bankSWIFT'])
        data['bankSWIFT'] = m.group(1) if m else data['bankSWIFT']

    return data


# ═══════════════════════════════════════════════════════════
#  FILE READERS
# ═══════════════════════════════════════════════════════════

def extract_text_from_pdf(filepath):
    import pdfplumber
    text = ''
    try:
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                pt = page.extract_text()
                if pt: text += pt + '\n'
    except Exception as e:
        print(json.dumps({'error': f'PDF read error: {e}'}))
        sys.exit(1)
    return text

def extract_text_from_image(filepath):
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(filepath), lang='eng')
    except:
        return ''

def extract_data_from_spreadsheet(filepath):
    import pandas as pd
    ext = os.path.splitext(filepath)[1].lower()
    try:
        df = pd.read_csv(filepath, dtype=str) if ext == '.csv' else pd.read_excel(filepath, dtype=str, engine='openpyxl')
    except:
        return ''
    rows = [' | '.join(str(c) for c in df.columns)]
    for _, row in df.iterrows():
        rows.append(' | '.join(str(v) if pd.notna(v) else '' for v in row))
    return '\n'.join(rows)


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No file path provided'}))
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(json.dumps({'error': f'File not found: {filepath}'}))
        sys.exit(1)

    ext = os.path.splitext(filepath)[1].lower()

    if ext == '.pdf':
        text = extract_text_from_pdf(filepath)
    elif ext in ('.png', '.jpg', '.jpeg'):
        text = extract_text_from_image(filepath)
        if not text:
            print(json.dumps({'error': 'Image OCR requires Tesseract', 'rawText': ''}))
            sys.exit(0)
    elif ext in ('.xlsx', '.xls', '.csv'):
        text = extract_data_from_spreadsheet(filepath)
    else:
        print(json.dumps({'error': f'Unsupported file type: {ext}'}))
        sys.exit(1)

    if not text or len(text.strip()) < 10:
        print(json.dumps({'error': 'Could not extract meaningful text', 'rawText': text or ''}))
        sys.exit(0)

    data = extract_invoice_data(text)
    data['rawText'] = text[:3000]

    print(json.dumps(data, ensure_ascii=False, default=str))

if __name__ == '__main__':
    main()
