# 📊 Company Contact Management & CSV Upload Guide

## 🎯 Overview

The AR Email Bot now stores company contact information in a **MongoDB database** instead of just a CSV file. This allows you to:

✅ **Upload CSV/Excel files** from customers with company emails  
✅ **Match company names** automatically before sending emails  
✅ **Add multiple CC recipients** (unlimited) for each company  
✅ **Manage contacts** through a web interface  
✅ **Search and filter** companies easily  

---

## � Email System Setup

Before sending invoices, you need to configure your email credentials.

### Configure Email Credentials

1. Navigate to `backend/.env` file
2. Add your email credentials:

**For Gmail:**
1. Go to https://myaccount.google.com/apppasswords
2. Generate an "App Password" (16 characters)
3. Add to `.env`:
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

**For Outlook/Office365:**
```
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Email Features
- ✅ 7-day cooldown between emails (prevents spam)
- ✅ Status-based templates (Due, Overdue, Paid, Partial)
- ✅ Unlimited CC recipients per company
- ✅ Professional HTML email design
- ✅ Email tracking (count and last sent date)

---

## �🚀 Quick Start

### Step 1: Access Company Management

1. Login to your dashboard
2. Click **"Companies"** in the sidebar menu
3. You'll see the Company Contact Management page

### Step 2: Upload Customer CSV File

When your customer gives you a CSV/Excel file with their company contacts:

1. Click **"Upload CSV"** button (top right)
2. Select the CSV file from your customer
3. Choose upload mode:
   - **Merge Mode** (default): Adds new companies, updates existing ones
   - **Replace All**: Deletes all existing data and uploads fresh
4. Click **"Upload"**

You'll see results:
- ✓ Added: 15 companies
- ✓ Updated: 5 companies
- ✗ Failed: 0 companies

---

## 📋 CSV File Format

### Required Columns

Your customer's CSV file **must have** these columns (case-insensitive):

| Column Name | Description | Example | Required |
|-------------|-------------|---------|----------|
| **companyName** or **name** | Company name | TEAM COMPUTERS PVT.LTD | ✅ Required |
| **email** | Primary email | accounts@teamcomputers.com | ✅ Required |
| **contactPerson** | Contact name | John Doe | ❌ Optional |
| **cc** | CC recipients (multiple emails) | manager@team.com; ceo@team.com | ❌ Optional |
| **phone** | Phone number | +91-9876543210 | ❌ Optional |
| **department** | Department name | Finance | ❌ Optional |

### Example CSV Format

⚠️ **IMPORTANT: CC emails must be in QUOTES and separated by semicolons**

```csv
companyName,email,contactPerson,cc,phone,department
TECNOPRISM,afsawa.shaikh@tecnoprism.com,Afsawa Shaikh,"cc1@tecnoprism.com;cc2@tecnoprism.com",+91-9876543210,Finance
TEAM COMPUTERS PVT.LTD,accounts@teamcomputers.com,Priya Sharma,"manager@team.com;ceo@team.com",+91-9876543210,Finance
Microsoft India,billing@microsoft.in,Ravi Kumar,"director@microsoft.in;accounts@microsoft.in",+91-9876543211,Accounts
Infosys Limited,payments@infosys.com,Anjali Verma,"boss@infosys.com;cfo@infosys.com;finance@infosys.com",+91-9876543212,AR Team
```

### CC Recipients Format

You can add **unlimited CC recipients**. Format rules:

1. **Put CC emails in QUOTES**: `"email1@domain.com;email2@domain.com"`
2. **Separate with SEMICOLONS**: Use `;` not `,` between CC emails
3. **No restrictions on domains**: ANY email domain works (gmail, tecnoprism, yahoo, etc.)

✅ **Correct Examples:**
- `"manager@tecnoprism.com;ceo@tecnoprism.com"`
- `"email1@domain.com;email2@domain.com;email3@domain.com"`
- Single CC: `finance@company.com` (no quotes needed)

❌ **Wrong Examples:**
- `manager@tecnoprism.com,ceo@tecnoprism.com` ← Don't use commas without quotes!
- `manager@tecnoprism.com ceo@tecnoprism.com` ← Missing semicolon!

### CC Recipients Format

You can add **unlimited CC recipients**. Separate multiple emails with:
- **Semicolons** (`;`) - Recommended
- **Commas** (`,`)

Examples:
```csv
manager@company.com; ceo@company.com; director@company.com
boss@company.com, accounts@company.com, finance@company.com
```

---

## 🎨 How It Works

### 1. Company Name Matching

When sending an invoice email, the system:

1. Takes the **company name** from the invoice
2. Searches the database (case-insensitive)
3. Finds matching contact info
4. Sends email to primary email + CC recipients

**Example:**
- Invoice has: `TEAM COMPUTERS PVT.LTD`
- Database finds: `team computers pvt.ltd` ✓ (matches)
- Sends to: `accounts@teamcomputers.com`
- CC to: `manager@team.com`, `ceo@team.com`

### 2. Email Sending with CC

When you click the 📧 (Email) button in invoices:

```
TO: accounts@teamcomputers.com
CC: manager@team.com, ceo@team.com, director@team.com
Subject: Payment Reminder - Invoice INV-001
```

All CC recipients receive a copy automatically!

---

## 🖥️ Company Management Interface

### Features

1. **Search Companies**: Real-time search by name, email, or contact person
2. **Add Company**: Manually add a single company with all details
3. **Edit Company**: Update any company information including CC recipients
4. **Delete Company**: Remove companies you no longer need
5. **Upload CSV**: Bulk upload from customer files
6. **Download Template**: Get a sample CSV file to share with customers

### Adding a Company Manually

1. Click **"Add Company"**
2. Fill in the form:
   - Company Name* (required)
   - Email* (required)
   - Contact Person (optional)
   - CC Recipients (optional - enter multiple emails separated by comma)
   - Phone (optional)
   - Department (optional)
3. Click **"Add Company"**

### Editing a Company

1. Click the ✏️ (Edit) icon next to any company
2. Modify any field
3. Add/remove CC recipients
4. Click **"Update Company"**

---

## 📥 Download CSV Template

Need to give a template to your customer?

1. Click **"Download Template"** button
2. Share the file: `company_contacts_template.csv`
3. Customer fills it with their company details
4. You upload it back to the system

---

## ✉️ Email Sending Workflow

### Complete Process

```
[Invoice Dashboard]
    ↓
Click 📧 button
    ↓
System checks database for company name
    ↓
Finds: accounts@company.com + 3 CC emails
    ↓
Sends email to all recipients
    ↓
✓ Email sent to accounts@company.com (CC: 3)
```

### Success Message

When email is sent, you'll see:
```
✓ Email sent to accounts@teamcomputers.com (CC: 3)
```

This means:
- ✅ Main email sent to primary address
- ✅ 3 people received CC copies

---

## 🔍 How Email Lookup Works

The system uses the MongoDB database to find company contact information:

```
[Invoice Dashboard]
    ↓
Click 📧 button
    ↓
System queries database for company name
    ↓
Finds: accounts@company.com + CC emails
    ↓
Sends email to all recipients
    ↓
✓ Success!
```

If company is not found in database, you'll see an error message asking you to add the company first.

---

## 💡 Pro Tips

### Tip 1: Company Name Consistency

Ensure invoice company names match database entries:

❌ **Don't use different variations:**
- Invoice: `TEAM COMPUTERS`
- Database: `TEAM COMPUTERS PVT.LTD`
→ Won't match!

✅ **Use exact same name:**
- Invoice: `TEAM COMPUTERS PVT.LTD`
- Database: `TEAM COMPUTERS PVT.LTD`
→ Perfect match!

### Tip 2: Multiple Variations

If a company appears with different names, add multiple entries:

```csv
TEAM COMPUTERS PVT.LTD,accounts@team.com,John Doe
TEAM COMPUTERS,accounts@team.com,John Doe
Team Computers Ltd,accounts@team.com,John Doe
```

### Tip 3: Testing CC Recipients

1. Add your own email as CC for testing
2. Send a test invoice email
3. Verify you received the CC copy
4. Update with real CC emails

### Tip 4: Department Usage

Use department field to organize contacts:
- Finance
- Accounts Receivable
- Billing
- Collections

---

## 🆘 Common Issues & Solutions

### Issue 1: "No email found for company"

**Problem:** Company not in database

**Solution:**
1. Go to **Companies** page
2. Search for the company name
3. If missing, click **"Add Company"** or **"Upload CSV"**
4. Add the company details
5. Try sending email again

### Issue 2: CC emails not working

**Problem:** CC recipients not receiving emails

**SOLUTION - Follow These Steps:**

**Step 1: Check CSV Format**
- CC emails MUST be in QUOTES if using CSV upload
- Use SEMICOLONS (;) to separate multiple emails
- Example: `"email1@domain.com;email2@domain.com"`

**Step 2: Verify Database Entry**
1. Go to **Companies** page
2. Search for the company
3. Click **Edit** button
4. Check the CC Recipients field
5. If empty or wrong, update it with correct emails (one per line or separated by commas/semicolons)
6. Click **Update Company**

**Step 3: Check Backend Console Logs**
After sending an email, check your backend terminal. You should see:
```
📋 Retrieved company contact for "COMPANY NAME":
  email: 'main@company.com'
  ccEmails: [ 'cc1@domain.com', 'cc2@domain.com' ]
  ccCount: 2

📧 Sending email with CC recipients:
  cc: 'cc1@domain.com, cc2@domain.com'

✅ Email sent successfully!
  accepted: [ 'main@company.com', 'cc1@domain.com', 'cc2@domain.com' ]
  rejected: []
```

**If you see `ccEmails: []` (empty array):**
- CC emails are NOT in the database
- Re-upload CSV with correct format OR edit company manually

**If you see `rejected: [...]` with email addresses:**
- Gmail blocked those addresses
- Check if emails are valid
- Try sending to different email addresses to test

**Step 4: Test with Gmail Addresses**
To verify the system works:
1. Add your own Gmail as a CC recipient
2. Send a test email
3. Check if you receive the CC copy
4. If yes, the system works - recipient emails might be blocking

**Step 5: No Domain Restrictions**
The system accepts ALL email domains:
- ✅ gmail.com
- ✅ tecnoprism.com  
- ✅ yahoo.com
- ✅ Any custom domain

If emails still don't work, the recipient's email server might be blocking your sender email.

---

### Issue 3: CSV upload failed

**Problem:** CSV format is wrong

**Solution:**
1. Download the template CSV
2. Ensure columns are: `companyName,email,contactPerson,cc,phone,department`
3. Don't use extra spaces
4. Save as CSV (not Excel)
5. Try uploading again

### Issue 4: Company name doesn't match

**Problem:** Invoice has `ABC Ltd` but database has `ABC Limited`

**Solution:**
- Add the company with both names (create 2 entries with same email)
- Or standardize all invoice company names

---

## 📊 CSV Format Examples

### Example 1: Basic (Only Required Fields)

```csv
companyName,email
TEAM COMPUTERS PVT.LTD,accounts@teamcomputers.com
Microsoft India,billing@microsoft.in
Infosys Limited,payments@infosys.com
```

### Example 2: With CC Recipients

```csv
companyName,email,contactPerson,cc
TEAM COMPUTERS PVT.LTD,accounts@teamcomputers.com,Priya Sharma,manager@team.com; ceo@team.com
Microsoft India,billing@microsoft.in,Ravi Kumar,director@microsoft.in
Infosys Limited,payments@infosys.com,Anjali Verma,boss@infosys.com; cfo@infosys.com; finance@infosys.com
```

### Example 3: Full Details

```csv
companyName,email,contactPerson,cc,phone,department
TEAM COMPUTERS PVT.LTD,accounts@teamcomputers.com,Priya Sharma,manager@team.com; ceo@team.com,+91-9876543210,Finance
Microsoft India Pvt Ltd,billing@microsoft.in,Ravi Kumar,director@microsoft.in; accounts@microsoft.in,+91-9876543211,Accounts
Infosys Limited,payments@infosys.com,Anjali Verma,boss@infosys.com; cfo@infosys.com,+91-9876543212,Collections
TCS Private Limited,ar@tcs.com,Deepak Singh,,+91-9876543213,AR Team
```

---

## 🎓 Best Practices

### 1. Regular Updates
- Update contact info when customers change emails
- Remove inactive companies
- Keep CC lists current

### 2. Testing
- Test with your own email first
- Verify CC recipients receive emails
- Check spam folders

### 3. Organization
- Use consistent company naming
- Fill in contact person names
- Add department info for context

### 4. Backup
- Export your data periodically
- Keep original CSV files from customers
- Document any manual changes

---

## 🔒 Security Notes

✅ **Database is secure** - MongoDB authentication required  
✅ **Email validation** - Only valid emails accepted  
✅ **CSV sanitization** - Files are checked before import  
✅ **No data leakage** - Company contacts are private  

---

## ✅ Quick Checklist

Before sending invoices, ensure:

- [ ] Company contacts uploaded to database
- [ ] Company names in invoices match database exactly
- [ ] CC recipients added for important companies
- [ ] Test email sent successfully
- [ ] Backend server is running
- [ ] Email credentials configured in `.env`

---

## 📞 Summary

**Old Way (CSV File):**
- ❌ Manual CSV editing
- ❌ No CC support
- ❌ No web interface
- ❌ Limited to 3 fields

**New Way (Database + Web Interface):**
- ✅ Upload customer CSV files directly
- ✅ Unlimited CC recipients
- ✅ Beautiful web interface
- ✅ Search and manage easily
- ✅ Add phone, department, notes
- ✅ Automatic company matching

---

🎉 **You're all set!** Start uploading your customer contact files and sending emails with CC support!
