import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload, FileText, X, CheckCircle2, AlertCircle,
    File, Image, FileSpreadsheet, Trash2, CloudUpload,
    Loader2, ArrowLeft, FileUp, Hash, User, MapPin,
    IndianRupee, Calendar, Plus, Save, Check, ChevronDown, ChevronUp,
    Sparkles, ScanSearch, RefreshCw
} from 'lucide-react';

const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry",
    "Ladakh", "Jammu and Kashmir"
];

const ACCEPTED_TYPES = {
    'application/pdf': { label: 'PDF', icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
    'image/png': { label: 'PNG', icon: Image, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    'image/jpeg': { label: 'JPG', icon: Image, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    'image/jpg': { label: 'JPG', icon: Image, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'XLSX', icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    'application/vnd.ms-excel': { label: 'XLS', icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    'text/csv': { label: 'CSV', icon: FileSpreadsheet, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-500/10' },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const calculateFinancials = (data) => {
    const qty = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.total_price) || 0;
    const gstRate = parseFloat(data.GST) || 0;
    const subtotal = price * qty;
    const gstAmt = Math.round(subtotal * (gstRate / 100));
    const total = subtotal + gstAmt;

    let newPaid = parseFloat(data.paidAmount) || 0;
    if (data.paymentStatus === 'Paid') newPaid = total;
    else if (data.paymentStatus === 'Due') newPaid = 0;
    else if (data.paymentStatus === 'PartiallyPaid') newPaid = Math.min(newPaid, total);

    return {
        subtotal,
        GST_Amount: gstAmt,
        total_Amount: total,
        balance_due: Math.max(0, total - newPaid),
        paidAmount: newPaid
    };
};

const defaultFormData = () => ({
    // Seller
    sellerName: '',
    sellerAddress: '',
    sellerGSTIN: '',
    // Buyer
    companyName: '',
    buyerAddress: '',
    buyerGSTIN: '',
    State: '',
    placeOfSupply: '',
    // Dates
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    Terms: '',
    // Item
    subject: '',
    description: '',
    hsnSac: '',
    quantity: 1,
    total_price: 0,
    // Financials
    subtotal: 0,
    GST: 18,
    GST_Amount: 0,
    total_Amount: 0,
    creditsApplied: 0,
    balance_due: 0,
    totalInWords: '',
    paymentStatus: 'Due',
    paidAmount: 0,
    // Bank
    bankAccountName: '',
    bankAccountNo: '',
    bankName: '',
    bankAddress: '',
    bankIFSC: '',
    bankSWIFT: ''
});

// ──────────────── Invoice Detail Form (per file) ────────────────
const InvoiceForm = ({ data, onChange }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'paidAmount') {
            const val = parseFloat(value) || 0;
            if (val > (data.total_Amount || 0)) return;
        }
        const updated = { ...data, [name]: value };

        // Recalculate terms if dates change
        if (name === 'dueDate' || name === 'invoiceDate') {
            const invDate = new Date(name === 'invoiceDate' ? value : updated.invoiceDate);
            const due = new Date(name === 'dueDate' ? value : updated.dueDate);
            if (updated.invoiceDate && updated.dueDate) {
                invDate.setHours(0, 0, 0, 0);
                due.setHours(0, 0, 0, 0);
                updated.Terms = Math.round((due - invDate) / (1000 * 60 * 60 * 24)).toString();
            }
        }

        // Recalculate financials
        const fin = calculateFinancials(updated);
        onChange({ ...updated, ...fin });
    };

    const handleStatusChange = (status) => {
        const updated = { ...data, paymentStatus: status };
        const fin = calculateFinancials(updated);
        onChange({ ...updated, ...fin });
    };

    const inputClass = "w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition-all";
    const labelClass = "text-[11px] font-semibold text-gray-500 dark:text-slate-500 ml-0.5";
    const readOnlyClass = "w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-500 text-sm font-medium cursor-not-allowed outline-none";

    return (
        <div className="space-y-5 pt-4">
            {/* Seller / From */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <User size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Seller / From</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Seller Name</label>
                        <input type="text" name="sellerName" value={data.sellerName} onChange={handleChange} className={inputClass} placeholder="e.g. Tecnoprism Pvt. Ltd." />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Seller GSTIN</label>
                        <input type="text" name="sellerGSTIN" value={data.sellerGSTIN} onChange={handleChange} className={inputClass} placeholder="e.g. 24AAICT6160D1ZI" />
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                        <label className={labelClass}>Seller Address</label>
                        <input type="text" name="sellerAddress" value={data.sellerAddress} onChange={handleChange} className={inputClass} placeholder="Full address" />
                    </div>
                </div>
            </div>

            {/* Invoice Details */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Hash size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Invoice Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Invoice Date</label>
                        <input required type="date" name="invoiceDate" value={data.invoiceDate} onChange={handleChange} className={`${inputClass} dark:[color-scheme:dark]`} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Due Date</label>
                        <input required type="date" name="dueDate" value={data.dueDate} onChange={handleChange} className={`${inputClass} dark:[color-scheme:dark]`} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Terms (days)</label>
                        <input type="text" value={data.Terms} readOnly className={readOnlyClass} placeholder="Auto" />
                    </div>
                </div>
            </div>

            {/* Bill To / Buyer */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <User size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Bill To (Buyer)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Company Name</label>
                        <input required type="text" name="companyName" value={data.companyName} onChange={handleChange} className={inputClass} placeholder="Buyer / Client Company" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Buyer GSTIN</label>
                        <input type="text" name="buyerGSTIN" value={data.buyerGSTIN} onChange={handleChange} className={inputClass} placeholder="e.g. 29AADCV0550G1ZF" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Buyer Address</label>
                        <input type="text" name="buyerAddress" value={data.buyerAddress} onChange={handleChange} className={inputClass} placeholder="Full billing address" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>State</label>
                        <select name="State" value={data.State} onChange={handleChange} className={`${inputClass} appearance-none`}>
                            <option value="">Select State</option>
                            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Place of Supply</label>
                        <input type="text" name="placeOfSupply" value={data.placeOfSupply} onChange={handleChange} className={inputClass} placeholder="e.g. Karnataka (29)" />
                    </div>
                </div>
            </div>

            {/* Subject & Description */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Plus size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Subject, Item & Description</span>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Subject</label>
                        <input type="text" name="subject" value={data.subject} onChange={handleChange} className={inputClass} placeholder="e.g. Placement Service Fees for Krishna" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-3 space-y-1">
                            <label className={labelClass}>Item Description</label>
                            <textarea name="description" value={data.description} onChange={handleChange} className={`${inputClass} resize-y h-16`} placeholder="Detailed description of service or product..." />
                        </div>
                        <div className="space-y-1">
                            <label className={labelClass}>HSN / SAC Code</label>
                            <input type="text" name="hsnSac" value={data.hsnSac} onChange={handleChange} className={inputClass} placeholder="e.g. 998512" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Financials */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <IndianRupee size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Financial Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="space-y-1">
                        <label className={labelClass}>Rate / Unit Price (₹)</label>
                        <input required type="number" name="total_price" value={data.total_price} onChange={handleChange} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Quantity</label>
                        <input required type="number" name="quantity" value={data.quantity} onChange={handleChange} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>GST Rate (%)</label>
                        <select name="GST" value={data.GST} onChange={handleChange} className={`${inputClass} appearance-none`}>
                            <option value="0">0%</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18">18%</option>
                            <option value="28">28%</option>
                        </select>
                    </div>
                </div>
                {/* Summary */}
                <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>₹{(data.subtotal || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-slate-400">
                        <span>GST ({data.GST}%)</span>
                        <span>₹{(data.GST_Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                        <span className="text-sm font-bold text-gray-800 dark:text-white">Total</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{(data.total_Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                {/* Credits & Total in Words */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Credits Applied (₹)</label>
                        <input type="number" name="creditsApplied" value={data.creditsApplied} onChange={handleChange} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Total in Words</label>
                        <input type="text" name="totalInWords" value={data.totalInWords} onChange={handleChange} className={inputClass} placeholder="e.g. Eighty-Three Thousand..." />
                    </div>
                </div>
            </div>

            {/* Bank / Remittance Details */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Bank / Remittance Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Account Name</label>
                        <input type="text" name="bankAccountName" value={data.bankAccountName} onChange={handleChange} className={inputClass} placeholder="Account holder name" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Account No.</label>
                        <input type="text" name="bankAccountNo" value={data.bankAccountNo} onChange={handleChange} className={inputClass} placeholder="Bank account number" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Bank Name</label>
                        <input type="text" name="bankName" value={data.bankName} onChange={handleChange} className={inputClass} placeholder="e.g. ICICI Bank" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className={labelClass}>Bank Address</label>
                        <input type="text" name="bankAddress" value={data.bankAddress} onChange={handleChange} className={inputClass} placeholder="Branch address" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>IFSC Code</label>
                        <input type="text" name="bankIFSC" value={data.bankIFSC} onChange={handleChange} className={inputClass} placeholder="e.g. ICIC0000003" />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>SWIFT Code</label>
                        <input type="text" name="bankSWIFT" value={data.bankSWIFT} onChange={handleChange} className={inputClass} placeholder="e.g. ICICINBB003" />
                    </div>
                </div>
            </div>

            {/* Payment Status */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Calendar size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Payment Status</span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                    {['Due', 'Paid', 'PartiallyPaid'].map(s => (
                        <button key={s} type="button" onClick={() => handleStatusChange(s)}
                            className={`px-4 py-2 rounded-lg font-semibold text-xs transition-all ${data.paymentStatus === s
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}
                        >
                            {s === 'PartiallyPaid' ? 'Partial' : s}
                        </button>
                    ))}
                </div>
                {data.paymentStatus === 'PartiallyPaid' && (
                    <div className="space-y-2 max-w-xs">
                        <div className="space-y-1">
                            <label className={labelClass}>Amount Received (₹)</label>
                            <input required type="number" name="paidAmount" value={data.paidAmount} onChange={handleChange} max={data.total_Amount} className={inputClass} />
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-lg flex items-center justify-between">
                            <span className="text-xs font-semibold text-orange-800 dark:text-orange-200">Balance Due</span>
                            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">₹{(data.balance_due || 0).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}
                {data.paymentStatus === 'Due' && data.total_Amount > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-lg flex items-center justify-between max-w-xs">
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Full Balance Due</span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">₹{(data.total_Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                )}
                {data.paymentStatus === 'Paid' && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-lg flex items-center gap-2 max-w-xs">
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Marked as Fully Paid</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ──────────────── Main Component ────────────────
const UploadInvoice = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({});
    const [uploadProgress, setUploadProgress] = useState({});
    const [errors, setErrors] = useState([]);
    const [nextInvoiceNum, setNextInvoiceNum] = useState(1);

    // Fetch the next invoice number on mount
    useEffect(() => {
        const fetchLatest = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/latest`);
                if (res.ok) {
                    const latest = await res.json();
                    if (latest?.invoiceNumber?.includes('-')) {
                        const num = parseInt(latest.invoiceNumber.split('-')[1], 10);
                        setNextInvoiceNum(num + 1);
                    }
                }
            } catch (e) { /* default 1 */ }
        };
        fetchLatest();
    }, []);

    const validateFile = (file) => {
        if (!ACCEPTED_TYPES[file.type]) return `"${file.name}" — unsupported format.`;
        if (file.size > MAX_FILE_SIZE) return `"${file.name}" — exceeds 10MB.`;
        return null;
    };

    const addFiles = useCallback((newFiles) => {
        const fileArray = Array.from(newFiles);
        const newErrors = [];
        const validFiles = [];

        fileArray.forEach((file) => {
            const error = validateFile(file);
            if (error) { newErrors.push(error); return; }
            const isDuplicate = files.some(f => f.file.name === file.name && f.file.size === file.size);
            if (isDuplicate) return;

            const id = `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const form = defaultFormData();
            form.companyName = file.name.replace(/\.[^/.]+$/, '');
            form.description = `Uploaded from file: ${file.name}`;

            validFiles.push({
                id,
                file,
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                formData: form,
                expanded: true
            });
        });

        if (newErrors.length > 0) {
            setErrors(prev => [...prev, ...newErrors]);
            setTimeout(() => setErrors([]), 5000);
        }
        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
            validFiles.forEach(f => {
                setUploadStatus(prev => ({ ...prev, [f.id]: 'extracting' }));
                setUploadProgress(prev => ({ ...prev, [f.id]: 0 }));
            });
            // Auto-extract each file
            validFiles.forEach(f => extractFile(f));
        }
    }, [files]);

    // Extract invoice data from file using Python backend
    const extractFile = async (fileObj) => {
        const { id, file } = fileObj;
        setUploadStatus(prev => ({ ...prev, [id]: 'extracting' }));
        setUploadProgress(prev => ({ ...prev, [id]: 10 }));

        const fd = new FormData();
        fd.append('file', file);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    const cur = prev[id] || 10;
                    if (cur < 85) return { ...prev, [id]: cur + Math.random() * 15 };
                    return prev;
                });
            }, 400);

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/extract`, {
                method: 'POST',
                body: fd
            });

            clearInterval(progressInterval);
            setUploadProgress(prev => ({ ...prev, [id]: 100 }));

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.message || 'Extraction failed');
            }

            const result = await response.json();
            const inv = result.invoice || {};
            const extracted = result.extractedData || {};

            // Auto-fill form with extracted data
            const extractedForm = {
                sellerName: inv.sellerName || extracted.sellerName || '',
                sellerAddress: inv.sellerAddress || extracted.sellerAddress || '',
                sellerGSTIN: inv.sellerGSTIN || extracted.sellerGSTIN || '',
                companyName: inv.companyName || extracted.companyName || '',
                buyerAddress: inv.buyerAddress || extracted.buyerAddress || '',
                buyerGSTIN: inv.buyerGSTIN || extracted.buyerGSTIN || '',
                State: inv.State || extracted.State || '',
                placeOfSupply: inv.placeOfSupply || extracted.placeOfSupply || '',
                invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : extracted.invoiceDate || '',
                dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : extracted.dueDate || '',
                Terms: inv.Terms || extracted.Terms || '',
                subject: inv.subject || extracted.subject || '',
                description: inv.description || extracted.description || '',
                hsnSac: inv.hsnSac || extracted.hsnSac || '',
                quantity: inv.quantity || extracted.quantity || 1,
                total_price: inv.total_price || extracted.total_price || 0,
                subtotal: inv.subtotal || extracted.subtotal || 0,
                GST: inv.GST || extracted.GST || 18,
                GST_Amount: inv.GST_Amount || extracted.GST_Amount || 0,
                total_Amount: inv.total_Amount || extracted.total_Amount || 0,
                creditsApplied: inv.creditsApplied || extracted.creditsApplied || 0,
                balance_due: inv.balance_due != null ? inv.balance_due : extracted.balance_due || 0,
                totalInWords: inv.totalInWords || extracted.totalInWords || '',
                paymentStatus: inv.paymentStatus || extracted.paymentStatus || 'Due',
                paidAmount: 0,
                bankAccountName: inv.bankAccountName || extracted.bankAccountName || '',
                bankAccountNo: inv.bankAccountNo || extracted.bankAccountNo || '',
                bankName: inv.bankName || extracted.bankName || '',
                bankAddress: inv.bankAddress || extracted.bankAddress || '',
                bankIFSC: inv.bankIFSC || extracted.bankIFSC || '',
                bankSWIFT: inv.bankSWIFT || extracted.bankSWIFT || '',
            };

            setFiles(prev => prev.map(f => f.id === id ? {
                ...f,
                formData: extractedForm,
                savedInvoiceId: inv._id,
                invoiceNumber: inv.invoiceNumber || ''
            } : f));
            setUploadStatus(prev => ({ ...prev, [id]: 'success' }));

        } catch (err) {
            console.error('Extraction error:', err);
            setUploadStatus(prev => ({ ...prev, [id]: 'error' }));
            setErrors(prev => [...prev, `${file.name}: ${err.message}`]);
            setTimeout(() => setErrors(prev => prev.filter(e => !e.startsWith(file.name))), 7000);
        }
    };

    const removeFile = (id) => {
        setFiles(prev => {
            const f = prev.find(x => x.id === id);
            if (f?.preview) URL.revokeObjectURL(f.preview);
            return prev.filter(x => x.id !== id);
        });
        setUploadStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
        setUploadProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const updateFormData = (id, newData) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, formData: newData } : f));
    };

    const toggleExpanded = (id) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); addFiles(e.dataTransfer.files); };
    const handleFileInput = (e) => { addFiles(e.target.files); e.target.value = ''; };

    // Re-extract a file (retry)
    const retryExtract = (fileObj) => {
        extractFile(fileObj);
    };

    const allUploaded = files.length > 0 && files.every(f => uploadStatus[f.id] === 'success');
    const isExtracting = files.some(f => uploadStatus[f.id] === 'extracting');
    const hasErrors = files.some(f => uploadStatus[f.id] === 'error');

    const getFileTypeInfo = (file) => ACCEPTED_TYPES[file.type] || { label: 'FILE', icon: File, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10' };

    return (
        <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto min-h-screen transition-colors duration-300">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors mb-4 group">
                    <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <CloudUpload size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Upload Invoices</h1>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-slate-500 mt-0.5">Drop files — data is auto-extracted & saved instantly</p>
                    </div>
                </div>
            </div>

            {/* Error Alerts */}
            {errors.length > 0 && (
                <div className="mb-6 space-y-2">
                    {errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                            <p className="text-sm font-medium text-red-700 dark:text-red-300">{err}</p>
                            <button onClick={() => setErrors(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                        </div>
                    ))}
                </div>
            )}

            {/* Main Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">

                {/* Drop Zone */}
                <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative cursor-pointer m-5 md:m-8 rounded-2xl border-2 border-dashed transition-all duration-300 group
                        ${isDragging ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/10 scale-[1.01]' : 'border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50/50 dark:hover:bg-slate-800/30'}`}
                >
                    <div className="flex flex-col items-center justify-center py-10 md:py-14 px-6">
                        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300
                            ${isDragging ? 'bg-blue-100 dark:bg-blue-500/20 scale-110' : 'bg-gray-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:scale-105'}`}
                        >
                            <FileUp size={26} className={`transition-colors duration-300 ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500 group-hover:text-blue-500'}`} />
                        </div>
                        <h3 className={`text-base font-bold mb-1.5 transition-colors ${isDragging ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-slate-300'}`}>
                            {isDragging ? 'Drop files here' : 'Drag & drop your invoices'}
                        </h3>
                        <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">or click to browse from your computer</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {['PDF', 'PNG', 'JPG', 'XLSX', 'CSV'].map(ext => (
                                <span key={ext} className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">{ext}</span>
                            ))}
                            <span className="text-[10px] text-gray-400 dark:text-slate-600 font-medium ml-1">Max 10MB</span>
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
                </div>

                {/* File Cards with Full Forms */}
                {files.length > 0 && (
                    <div className="px-5 md:px-8 pb-6 md:pb-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-gray-700 dark:text-slate-300">Invoice Files</h3>
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg">{files.length}</span>
                            </div>
                            {files.length > 1 && (
                                <button onClick={() => { files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); }); setFiles([]); setUploadStatus({}); setUploadProgress({}); }}
                                    className="text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors flex items-center gap-1">
                                    <Trash2 size={12} /> Clear all
                                </button>
                            )}
                        </div>

                        {files.map(({ id, file, preview, formData: form, expanded, savedInvoiceId, invoiceNumber }, fileIdx) => {
                            const typeInfo = getFileTypeInfo(file);
                            const TypeIcon = typeInfo.icon;
                            const status = uploadStatus[id];
                            const progress = uploadProgress[id] || 0;
                            const invNum = invoiceNumber || `INV-${(nextInvoiceNum + fileIdx).toString().padStart(3, '0')}`;

                            return (
                                <div key={id} className={`rounded-xl border overflow-hidden transition-all duration-300
                                    ${status === 'success' ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/5'
                                        : status === 'error' ? 'border-red-200 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5'
                                            : status === 'extracting' ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-500/5'
                                                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>

                                    {/* File Header (always visible) */}
                                    <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => status !== 'extracting' && toggleExpanded(id)}>
                                        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${typeInfo.bg}`}>
                                            {preview ? <img src={preview} alt={file.name} className="w-full h-full object-cover rounded-xl" /> : <TypeIcon size={20} className={typeInfo.color} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {status === 'success' && invNum && (
                                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">{invNum}</span>
                                                )}
                                                <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{form.companyName || form.sellerName || file.name}</p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold uppercase ${typeInfo.color}`}>{typeInfo.label}</span>
                                                <span className="text-gray-300 dark:text-slate-700">&bull;</span>
                                                <span className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</span>
                                                <span className="text-gray-300 dark:text-slate-700">&bull;</span>
                                                <span className="text-xs text-gray-400 dark:text-slate-500 truncate">{file.name}</span>
                                                {status === 'success' && form.total_Amount > 0 && (
                                                    <>
                                                        <span className="text-gray-300 dark:text-slate-700">&bull;</span>
                                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">₹{Number(form.total_Amount).toLocaleString('en-IN')}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status badges */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {status === 'extracting' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                                                    <ScanSearch size={14} className="text-blue-600 dark:text-blue-400 animate-pulse" />
                                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">Extracting...</span>
                                                </div>
                                            )}
                                            {status === 'success' && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                                                    <Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" />
                                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Extracted & Saved</span>
                                                </div>
                                            )}
                                            {status === 'error' && (
                                                <button onClick={(e) => { e.stopPropagation(); retryExtract(files.find(f => f.id === id)); }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-500/20 rounded-lg hover:bg-red-200 transition-colors">
                                                    <RefreshCw size={14} className="text-red-600 dark:text-red-400" />
                                                    <span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase">Retry</span>
                                                </button>
                                            )}
                                            {status !== 'extracting' && (
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(id); }}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                                    <X size={16} />
                                                </button>
                                            )}
                                            {status !== 'extracting' && (
                                                <button onClick={(e) => { e.stopPropagation(); toggleExpanded(id); }}
                                                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">
                                                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Extraction Progress Bar */}
                                    {status === 'extracting' && (
                                        <div className="px-4 pb-3">
                                            <div className="w-full h-1.5 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(progress, 95)}%` }} />
                                            </div>
                                            <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1 font-medium flex items-center gap-1">
                                                <ScanSearch size={10} /> Extracting invoice data with Python...
                                            </p>
                                        </div>
                                    )}

                                    {/* Expandable Invoice Form — shows extracted data */}
                                    {expanded && status === 'success' && (
                                        <div className="px-4 pb-5 border-t border-emerald-100 dark:border-emerald-500/10">
                                            <div className="flex items-center gap-2 py-3 mb-1">
                                                <Sparkles size={13} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Extracted Data (saved to database)</span>
                                            </div>
                                            <InvoiceForm data={form} onChange={(newData) => updateFormData(id, newData)} />
                                        </div>
                                    )}

                                    {/* Error state — show manual form */}
                                    {expanded && status === 'error' && (
                                        <div className="px-4 pb-5 border-t border-red-100 dark:border-red-500/10">
                                            <div className="flex items-center gap-2 py-3 mb-1">
                                                <AlertCircle size={13} className="text-red-500" />
                                                <span className="text-[11px] font-bold text-red-600 dark:text-red-400">Extraction failed — click Retry to try again</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer Actions */}
                {files.length > 0 && (
                    <div className="px-5 md:px-8 py-5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/20">
                        <div className="flex items-center gap-3">
                            {allUploaded ? (
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={18} />
                                    <span className="text-sm font-semibold">All invoices extracted & saved!</span>
                                </div>
                            ) : isExtracting ? (
                                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                    <ScanSearch size={18} className="animate-pulse" />
                                    <span className="text-sm font-semibold">Extracting invoice data...</span>
                                </div>
                            ) : hasErrors ? (
                                <p className="text-sm text-red-500 dark:text-red-400 font-medium">
                                    Some files failed extraction — click Retry
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-slate-400">
                                    <span className="font-semibold">{files.length}</span> file(s) processed
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => navigate('/invoices')}
                                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors">
                                {allUploaded ? 'View Invoices' : 'Cancel'}
                            </button>
                            {allUploaded && (
                                <button onClick={() => navigate('/invoices')}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20">
                                    <CheckCircle2 size={16} /> View in Invoice List
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {files.length === 0 && (
                    <div className="px-5 md:px-8 pb-8">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { icon: FileText, title: 'PDF Invoices', desc: 'Upload scanned or digital PDF invoices', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
                                { icon: Image, title: 'Image Files', desc: 'PNG, JPG photos of paper invoices', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                                { icon: FileSpreadsheet, title: 'Spreadsheets', desc: 'XLSX, XLS, or CSV invoice data', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                            ].map((item, i) => (
                                <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20">
                                    <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3`}>
                                        <item.icon size={18} className={item.color} />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{item.title}</h4>
                                    <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadInvoice;
