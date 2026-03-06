import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save, X, IndianRupee, MapPin, User, Calendar, Hash, Plus, Trash2,
    AlertCircle, Check, Building2, Upload, FileText, Image, FileSpreadsheet,
    CloudUpload, FileUp, Loader2, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp,
    Sparkles, ScanSearch, RefreshCw, File, PenLine
} from 'lucide-react';

// constants
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
    return { subtotal, GST_Amount: gstAmt, total_Amount: total, balance_due: Math.max(0, total - newPaid), paidAmount: newPaid };
};

const defaultFormData = () => ({
    invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0], dueDate: '', Terms: '',
    sellerName: '', sellerAddress: '', sellerGSTIN: '',
    companyName: '', buyerAddress: '', buyerGSTIN: '', State: '', placeOfSupply: '',
    subject: '', description: '', hsnSac: '', quantity: 1, total_price: 0,
    subtotal: 0, GST: 18, GST_Amount: 0, total_Amount: 0, creditsApplied: 0,
    balance_due: 0, totalInWords: '', paymentStatus: 'Due', paidAmount: 0,
    bankAccountName: '', bankAccountNo: '', bankName: '', bankAddress: '', bankIFSC: '', bankSWIFT: '',
    paymentMethod: '', paidToBankAccountId: '', paidToBankName: '', paymentDate: '', paymentReference: '', paymentNotes: ''
});


// ---- SHARED INVOICE FORM ----

const InvoiceForm = ({ data, onChange, isUploaded = false }) => {
    const [ifscLoading, setIfscLoading] = useState(false);
    const [ifscError, setIfscError] = useState('');
    const [bankAccounts, setBankAccounts] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState(isUploaded ? 'uploaded' : 'manual');
    const [loadingBankAccounts, setLoadingBankAccounts] = useState(!isUploaded);

    // Fetch saved bank accounts (skip for uploaded invoices)
    useEffect(() => {
        if (isUploaded) return;
        const fetchBankAccounts = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bank-accounts`);
                if (res.ok) {
                    const accounts = await res.json();
                    setBankAccounts(accounts);
                    // Auto-select default account if exists
                    const defaultAccount = accounts.find(acc => acc.isDefault);
                    if (defaultAccount && !data.bankAccountNo) {
                        handleBankSelection(defaultAccount._id, accounts);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch bank accounts:', err);
            } finally {
                setLoadingBankAccounts(false);
            }
        };
        fetchBankAccounts();
    }, []);

    const handleBankSelection = (bankId, accounts = bankAccounts) => {
        setSelectedBankId(bankId);
        if (bankId === 'manual') {
            // Clear bank fields for manual entry
            const updated = {
                ...data,
                bankAccountName: '',
                bankAccountNo: '',
                bankName: '',
                bankAddress: '',
                bankIFSC: '',
                bankSWIFT: ''
            };
            onChange(updated);
        } else {
            // Populate with selected account
            const account = accounts.find(acc => acc._id === bankId);
            if (account) {
                const updated = {
                    ...data,
                    bankAccountName: account.accountName,
                    bankAccountNo: account.accountNo,
                    bankName: account.bankName,
                    bankAddress: account.bankAddress,
                    bankIFSC: account.ifscCode,
                    bankSWIFT: account.swiftCode || ''
                };
                onChange(updated);
            }
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'paidAmount') {
            const val = parseFloat(value) || 0;
            if (val > (data.total_Amount || 0)) return;
        }
        const updated = { ...data, [name]: value };
        if (name === 'dueDate' || name === 'invoiceDate') {
            const invDate = new Date(name === 'invoiceDate' ? value : updated.invoiceDate);
            const due = new Date(name === 'dueDate' ? value : updated.dueDate);
            if (updated.invoiceDate && updated.dueDate) {
                invDate.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0);
                updated.Terms = Math.round((due - invDate) / (1000 * 60 * 60 * 24)).toString();
            }
        }
        
        // Handle IFSC code lookup
        if (name === 'bankIFSC') {
            const ifsc = value.toUpperCase();
            updated.bankIFSC = ifsc;
            
            // Validate IFSC format (11 characters)
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (ifsc.length === 11 && ifscRegex.test(ifsc)) {
                fetchBankDetails(ifsc);
            } else if (ifsc.length === 0) {
                setIfscError('');
            }
        }
        
        const fin = calculateFinancials(updated);
        onChange({ ...updated, ...fin });
    };

    const fetchBankDetails = async (ifscCode) => {
        setIfscLoading(true);
        setIfscError('');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/ifsc/${ifscCode}`);
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    const updated = {
                        ...data,
                        bankName: result.data.bankName,
                        bankAddress: result.data.bankAddress,
                        bankIFSC: result.data.bankIFSC,
                        bankSWIFT: result.data.bankSWIFT || data.bankSWIFT
                    };
                    const fin = calculateFinancials(updated);
                    onChange({ ...updated, ...fin });
                }
            } else {
                setIfscError('IFSC code not found');
            }
        } catch (err) {
            console.error('IFSC lookup error:', err);
            setIfscError('Failed to fetch bank details');
        } finally {
            setIfscLoading(false);
        }
    };

    const handleStatusChange = (status) => {
        const updated = { ...data, paymentStatus: status };
        const fin = calculateFinancials(updated);
        onChange({ ...updated, ...fin });
    };

    const inp = "w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-slate-200 text-sm font-medium focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 focus:border-blue-500 outline-none transition-all";
    const lbl = "text-[11px] font-semibold text-gray-500 dark:text-slate-500 ml-0.5";
    const ro = "w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-500 dark:text-slate-500 text-sm font-medium cursor-not-allowed outline-none";

    return (
        <div className="space-y-6 pt-2">
            {/* Seller / From */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Building2 size={14} className="text-indigo-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Seller / From</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1"><label className={lbl}>Seller Name</label><input type="text" name="sellerName" value={data.sellerName} onChange={handleChange} className={inp} placeholder="e.g. Tecnoprism Pvt. Ltd." /></div>
                    <div className="space-y-1"><label className={lbl}>Seller GSTIN</label><input type="text" name="sellerGSTIN" value={data.sellerGSTIN} onChange={handleChange} className={inp} placeholder="e.g. 24AAICT6160D1ZI" /></div>
                    <div className="space-y-1"><label className={lbl}>Seller Address</label><input type="text" name="sellerAddress" value={data.sellerAddress} onChange={handleChange} className={inp} placeholder="Full address" /></div>
                </div>
            </div>

            {/* Invoice Details */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Hash size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Invoice Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1"><label className={lbl}>Invoice Date</label><input required type="date" name="invoiceDate" value={data.invoiceDate} onChange={handleChange} className={`${inp} dark:[color-scheme:dark]`} /></div>
                    <div className="space-y-1"><label className={lbl}>Due Date</label><input required type="date" name="dueDate" value={data.dueDate} onChange={handleChange} className={`${inp} dark:[color-scheme:dark]`} /></div>
                    <div className="space-y-1"><label className={lbl}>Terms (days)</label><input type="text" value={data.Terms} readOnly className={ro} placeholder="Auto" /></div>
                </div>
            </div>

            {/* Bill To / Buyer */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <User size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Bill To (Buyer)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1"><label className={lbl}>Company Name</label><input required type="text" name="companyName" value={data.companyName} onChange={handleChange} className={inp} placeholder="Buyer / Client Company" /></div>
                    <div className="space-y-1"><label className={lbl}>Buyer GSTIN</label><input type="text" name="buyerGSTIN" value={data.buyerGSTIN} onChange={handleChange} className={inp} placeholder="e.g. 29AADCV0550G1ZF" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1"><label className={lbl}>Buyer Address</label><input type="text" name="buyerAddress" value={data.buyerAddress} onChange={handleChange} className={inp} placeholder="Full billing address" /></div>
                    <div className="space-y-1"><label className={lbl}>State</label>
                        <select name="State" value={data.State} onChange={handleChange} className={`${inp} appearance-none`}>
                            <option value="">Select State</option>
                            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1"><label className={lbl}>Place of Supply</label><input type="text" name="placeOfSupply" value={data.placeOfSupply} onChange={handleChange} className={inp} placeholder="e.g. Karnataka (29)" /></div>
                </div>
            </div>

            {/* Subject & Description */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <Plus size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Subject, Item & Description</span>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1"><label className={lbl}>Subject</label><input type="text" name="subject" value={data.subject} onChange={handleChange} className={inp} placeholder="e.g. Placement Service Fees" /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div className="sm:col-span-3 space-y-1"><label className={lbl}>Item Description</label><textarea name="description" value={data.description} onChange={handleChange} className={`${inp} resize-y h-16`} placeholder="Detailed description..." /></div>
                        <div className="space-y-1"><label className={lbl}>HSN / SAC Code</label><input type="text" name="hsnSac" value={data.hsnSac} onChange={handleChange} className={inp} placeholder="e.g. 998512" /></div>
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
                    <div className="space-y-1"><label className={lbl}>Rate / Unit Price</label><input required type="number" name="total_price" value={data.total_price} onChange={handleChange} className={inp} /></div>
                    <div className="space-y-1"><label className={lbl}>Quantity</label><input required type="number" name="quantity" value={data.quantity} onChange={handleChange} className={inp} /></div>
                    <div className="space-y-1"><label className={lbl}>GST Rate (%)</label>
                        <select name="GST" value={data.GST} onChange={handleChange} className={`${inp} appearance-none`}>
                            <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                        </select>
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-slate-400"><span>Subtotal</span><span>{'\u20B9'}{(data.subtotal || 0).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-slate-400"><span>GST ({data.GST}%)</span><span>{'\u20B9'}{(data.GST_Amount || 0).toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                        <span className="text-sm font-bold text-gray-800 dark:text-white">Total</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{'\u20B9'}{(data.total_Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <div className="space-y-1"><label className={lbl}>Credits Applied</label><input type="number" name="creditsApplied" value={data.creditsApplied} onChange={handleChange} className={inp} /></div>
                    <div className="space-y-1"><label className={lbl}>Total in Words</label><input type="text" name="totalInWords" value={data.totalInWords} onChange={handleChange} className={inp} placeholder="e.g. Eighty-Three Thousand..." /></div>
                </div>
            </div>

            {/* Bank / Remittance */}
            <div>
                <div className="flex items-center gap-1.5 mb-3">
                    <MapPin size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-600 dark:text-slate-400">Bank / Remittance Details</span>
                </div>
                
                {/* Bank Account Selector - hidden when bank details are auto-extracted from upload */}
                {isUploaded && (data.bankAccountName || data.bankAccountNo || data.bankName) && (
                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Bank details auto-extracted from uploaded invoice</span>
                    </div>
                )}
                {!isUploaded && (
                <div className="mb-4">
                    <label className={lbl}>Select Bank Account</label>
                    <select 
                        value={selectedBankId} 
                        onChange={(e) => handleBankSelection(e.target.value)}
                        className={`${inp} appearance-none`}
                        disabled={loadingBankAccounts}
                    >
                        <option value="manual">✍️ Enter Manually</option>
                        {bankAccounts.map(acc => (
                            <option key={acc._id} value={acc._id}>
                                {acc.nickname ? `${acc.nickname} - ` : ''}{acc.bankName} ({acc.accountNo.slice(-4)})
                                {acc.isDefault ? ' ⭐ Default' : ''}
                            </option>
                        ))}
                    </select>
                    {bankAccounts.length === 0 && !loadingBankAccounts && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            No saved accounts. You can add bank accounts in settings for quick selection.
                        </p>
                    )}
                </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="space-y-1">
                        <label className={lbl}>Account Name</label>
                        <input 
                            type="text" 
                            name="bankAccountName" 
                            value={data.bankAccountName} 
                            onChange={handleChange} 
                            className={inp} 
                            placeholder="Account holder name"
                            disabled={selectedBankId !== 'manual'}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={lbl}>Account No.</label>
                        <input 
                            type="text" 
                            name="bankAccountNo" 
                            value={data.bankAccountNo} 
                            onChange={handleChange} 
                            className={inp} 
                            placeholder="Bank account number"
                            disabled={selectedBankId !== 'manual'}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={lbl}>Bank Name</label>
                        <input 
                            type="text" 
                            name="bankName" 
                            value={data.bankName} 
                            onChange={handleChange} 
                            className={inp} 
                            placeholder="e.g. ICICI Bank"
                            disabled={selectedBankId !== 'manual'}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className={lbl}>Bank Address</label>
                        <input 
                            type="text" 
                            name="bankAddress" 
                            value={data.bankAddress} 
                            onChange={handleChange} 
                            className={inp} 
                            placeholder="Branch address"
                            disabled={selectedBankId !== 'manual'}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={lbl}>IFSC Code</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                name="bankIFSC" 
                                value={data.bankIFSC} 
                                onChange={handleChange} 
                                className={inp} 
                                placeholder="e.g. ICIC0000003" 
                                maxLength={11}
                                disabled={selectedBankId !== 'manual'}
                            />
                            {selectedBankId === 'manual' && ifscLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <Loader2 size={16} className="text-blue-500 animate-spin" />
                                </div>
                            )}
                            {selectedBankId === 'manual' && !ifscLoading && data.bankIFSC.length === 11 && data.bankName && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                </div>
                            )}
                        </div>
                        {selectedBankId === 'manual' && ifscError && (
                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {ifscError}
                            </p>
                        )}
                        {selectedBankId === 'manual' && !ifscError && data.bankIFSC.length === 11 && data.bankName && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Bank details fetched successfully
                            </p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className={lbl}>SWIFT Code</label>
                        <input 
                            type="text" 
                            name="bankSWIFT" 
                            value={data.bankSWIFT} 
                            onChange={handleChange} 
                            className={inp} 
                            placeholder="e.g. ICICINBB003"
                            disabled={selectedBankId !== 'manual'}
                        />
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
                            className={`px-5 py-2 rounded-xl font-semibold text-xs transition-all ${data.paymentStatus === s
                                ? 'bg-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}>
                            {s === 'PartiallyPaid' ? 'Partial' : s}
                        </button>
                    ))}
                </div>
                {data.paymentStatus === 'PartiallyPaid' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1"><label className={lbl}>Amount Received</label><input required type="number" name="paidAmount" value={data.paidAmount} onChange={handleChange} max={data.total_Amount} className={inp} /></div>
                            <div className="space-y-1">
                                <label className={lbl}>Payment Date</label>
                                <input type="date" name="paymentDate" value={data.paymentDate} onChange={handleChange} className={`${inp} dark:[color-scheme:dark]`} />
                            </div>
                        </div>
                        
                        {/* Payment Method & Bank Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className={lbl}>Payment Method</label>
                                <select name="paymentMethod" value={data.paymentMethod} onChange={handleChange} className={`${inp} appearance-none`}>
                                    <option value="">Select Method</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Credit/Debit Card</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className={lbl}>Paid to Bank Account</label>
                                <select 
                                    value={data.paidToBankAccountId} 
                                    onChange={(e) => {
                                        const selectedAccount = bankAccounts.find(acc => acc._id === e.target.value);
                                        handleChange({ 
                                            target: { 
                                                name: 'paidToBankAccountId', 
                                                value: e.target.value 
                                            } 
                                        });
                                        if (selectedAccount) {
                                            handleChange({ 
                                                target: { 
                                                    name: 'paidToBankName', 
                                                    value: selectedAccount.bankName 
                                                } 
                                            });
                                        }
                                    }}
                                    className={`${inp} appearance-none`}
                                    disabled={loadingBankAccounts}
                                >
                                    <option value="">Select Bank</option>
                                    {bankAccounts.map(acc => (
                                        <option key={acc._id} value={acc._id}>
                                            {acc.nickname ? `${acc.nickname} - ` : ''}{acc.bankName} (••••{acc.accountNo.slice(-4)})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <label className={lbl}>Transaction Reference / ID</label>
                            <input type="text" name="paymentReference" value={data.paymentReference} onChange={handleChange} className={inp} placeholder="e.g., TXN123456789" />
                        </div>
                        
                        <div className="space-y-1">
                            <label className={lbl}>Payment Notes (Optional)</label>
                            <textarea name="paymentNotes" value={data.paymentNotes} onChange={handleChange} className={`${inp} resize-y h-16`} placeholder="Additional notes about this payment..." />
                        </div>
                        
                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-xl flex items-center justify-between">
                            <span className="text-xs font-semibold text-orange-800 dark:text-orange-200">Balance Due</span>
                            <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{'\u20B9'}{(data.balance_due || 0).toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                )}
                {data.paymentStatus === 'Due' && data.total_Amount > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl flex items-center justify-between max-w-xs">
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Full Balance Due</span>
                        <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{'\u20B9'}{(data.total_Amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                )}
                {data.paymentStatus === 'Paid' && (
                    <div className="space-y-3">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center gap-2">
                            <Check size={14} className="text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Marked as Fully Paid - ₹{(data.total_Amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                        
                        {/* Payment Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className={lbl}>Payment Date</label>
                                <input type="date" name="paymentDate" value={data.paymentDate} onChange={handleChange} className={`${inp} dark:[color-scheme:dark]`} />
                            </div>
                            <div className="space-y-1">
                                <label className={lbl}>Payment Method</label>
                                <select name="paymentMethod" value={data.paymentMethod} onChange={handleChange} className={`${inp} appearance-none`}>
                                    <option value="">Select Method</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Card">Credit/Debit Card</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <label className={lbl}>Paid to Bank Account</label>
                            <select 
                                value={data.paidToBankAccountId} 
                                onChange={(e) => {
                                    const selectedAccount = bankAccounts.find(acc => acc._id === e.target.value);
                                    handleChange({ 
                                        target: { 
                                            name: 'paidToBankAccountId', 
                                            value: e.target.value 
                                        } 
                                    });
                                    if (selectedAccount) {
                                        handleChange({ 
                                            target: { 
                                                name: 'paidToBankName', 
                                                value: selectedAccount.bankName 
                                            } 
                                        });
                                    }
                                }}
                                className={`${inp} appearance-none`}
                                disabled={loadingBankAccounts}
                            >
                                <option value="">Select Bank</option>
                                {bankAccounts.map(acc => (
                                    <option key={acc._id} value={acc._id}>
                                        {acc.nickname ? `${acc.nickname} - ` : ''}{acc.bankName} (••••{acc.accountNo.slice(-4)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="space-y-1">
                            <label className={lbl}>Transaction Reference / ID</label>
                            <input type="text" name="paymentReference" value={data.paymentReference} onChange={handleChange} className={inp} placeholder="e.g., TXN123456789" />
                        </div>
                        
                        <div className="space-y-1">
                            <label className={lbl}>Payment Notes (Optional)</label>
                            <textarea name="paymentNotes" value={data.paymentNotes} onChange={handleChange} className={`${inp} resize-y h-16`} placeholder="Additional notes about this payment..." />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// ---- MAIN COMPONENT ----

const AddInvoice = () => {
    const navigate = useNavigate();
    // null = selection screen, 'upload' = upload flow, 'manual' = manual creation
    const [mode, setMode] = useState(null);

    // next invoice number
    const [nextInvoiceNum, setNextInvoiceNum] = useState(1);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/latest`);
                if (res.ok) {
                    const latest = await res.json();
                    if (latest?.invoiceNumber) {
                        // Try to parse as number (new format) or extract from INV-XXX (old format)
                        const num = parseInt(latest.invoiceNumber, 10);
                        if (!isNaN(num)) {
                            setNextInvoiceNum(num + 1);
                        } else if (latest.invoiceNumber.includes('-')) {
                            setNextInvoiceNum(parseInt(latest.invoiceNumber.split('-')[1], 10) + 1);
                        }
                    }
                }
            } catch { /* default 1 */ }
        })();
    }, []);

    // ---- MANUAL MODE STATE ----
    const [manualForm, setManualForm] = useState(defaultFormData());
    const [manualLoading, setManualLoading] = useState(false);

    useEffect(() => {
        if (mode === 'manual') {
            setManualForm(prev => ({ ...prev, invoiceNumber: nextInvoiceNum.toString() }));
        }
    }, [mode, nextInvoiceNum]);

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setManualLoading(true);
        try {
            // Ensure invoice number is set (fallback to nextInvoiceNum if not already set)
            const invoiceData = {
                ...manualForm,
                invoiceNumber: manualForm.invoiceNumber || nextInvoiceNum.toString()
            };
            
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoiceData),
            });
            if (res.ok) {
                // Increment the next invoice number for the next invoice
                setNextInvoiceNum(prev => prev + 1);
                navigate('/invoices');
            } else { 
                const err = await res.json(); 
                alert(`Error: ${err.message}`); 
            }
        } catch (err) { 
            alert('Failed to save invoice.'); 
        }
        finally { setManualLoading(false); }
    };

    // ---- UPLOAD MODE STATE ----
    const fileInputRef = useRef(null);
    const [files, setFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({});
    const [uploadProgress, setUploadProgress] = useState({});
    const [errors, setErrors] = useState([]);

    const validateFile = (file) => {
        if (!ACCEPTED_TYPES[file.type]) return `"${file.name}" \u2014 unsupported format.`;
        if (file.size > MAX_FILE_SIZE) return `"${file.name}" \u2014 exceeds 10MB.`;
        return null;
    };

    const extractFile = async (fileObj) => {
        const { id, file } = fileObj;
        setUploadStatus(prev => ({ ...prev, [id]: 'extracting' }));
        setUploadProgress(prev => ({ ...prev, [id]: 10 }));
        const fd = new FormData();
        fd.append('file', file);
        try {
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    const cur = prev[id] || 10;
                    if (cur < 85) return { ...prev, [id]: cur + Math.random() * 15 };
                    return prev;
                });
            }, 400);
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/extract`, { method: 'POST', body: fd });
            clearInterval(progressInterval);
            setUploadProgress(prev => ({ ...prev, [id]: 100 }));
            if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.message || 'Extraction failed'); }
            const result = await response.json();
            const inv = result.invoice || {};
            const extracted = result.extractedData || {};
            const extractedForm = {
                sellerName: inv.sellerName || extracted.sellerName || '', sellerAddress: inv.sellerAddress || extracted.sellerAddress || '',
                sellerGSTIN: inv.sellerGSTIN || extracted.sellerGSTIN || '', companyName: inv.companyName || extracted.companyName || '',
                buyerAddress: inv.buyerAddress || extracted.buyerAddress || '', buyerGSTIN: inv.buyerGSTIN || extracted.buyerGSTIN || '',
                State: inv.State || extracted.State || '', placeOfSupply: inv.placeOfSupply || extracted.placeOfSupply || '',
                invoiceDate: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : extracted.invoiceDate || '',
                dueDate: inv.dueDate ? inv.dueDate.split('T')[0] : extracted.dueDate || '',
                Terms: inv.Terms || extracted.Terms || '', subject: inv.subject || extracted.subject || '',
                description: inv.description || extracted.description || '', hsnSac: inv.hsnSac || extracted.hsnSac || '',
                quantity: inv.quantity || extracted.quantity || 1, total_price: inv.total_price || extracted.total_price || 0,
                subtotal: inv.subtotal || extracted.subtotal || 0, GST: inv.GST || extracted.GST || 18,
                GST_Amount: inv.GST_Amount || extracted.GST_Amount || 0, total_Amount: inv.total_Amount || extracted.total_Amount || 0,
                creditsApplied: inv.creditsApplied || extracted.creditsApplied || 0,
                balance_due: inv.balance_due != null ? inv.balance_due : extracted.balance_due || 0,
                totalInWords: inv.totalInWords || extracted.totalInWords || '',
                paymentStatus: inv.paymentStatus || extracted.paymentStatus || 'Due', paidAmount: 0,
                bankAccountName: inv.bankAccountName || extracted.bankAccountName || '',
                bankAccountNo: inv.bankAccountNo || extracted.bankAccountNo || '',
                bankName: inv.bankName || extracted.bankName || '', bankAddress: inv.bankAddress || extracted.bankAddress || '',
                bankIFSC: inv.bankIFSC || extracted.bankIFSC || '', bankSWIFT: inv.bankSWIFT || extracted.bankSWIFT || '',
            };
            setFiles(prev => prev.map(f => f.id === id ? { ...f, formData: extractedForm, savedInvoiceId: inv._id, invoiceNumber: inv.invoiceNumber || '' } : f));
            setUploadStatus(prev => ({ ...prev, [id]: 'success' }));
        } catch (err) {
            console.error('Extraction error:', err);
            setUploadStatus(prev => ({ ...prev, [id]: 'error' }));
            setErrors(prev => [...prev, `${file.name}: ${err.message}`]);
            setTimeout(() => setErrors(prev => prev.filter(e => !e.startsWith(file.name))), 7000);
        }
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
            validFiles.push({ id, file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null, formData: form, expanded: true });
        });
        if (newErrors.length > 0) { setErrors(prev => [...prev, ...newErrors]); setTimeout(() => setErrors([]), 5000); }
        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
            validFiles.forEach(f => { setUploadStatus(prev => ({ ...prev, [f.id]: 'extracting' })); setUploadProgress(prev => ({ ...prev, [f.id]: 0 })); });
            validFiles.forEach(f => extractFile(f));
        }
    }, [files]);

    const removeFile = async (id) => {
        const fileObj = files.find(x => x.id === id);
        // Delete from database if it was saved
        if (fileObj?.savedInvoiceId) {
            try {
                await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${fileObj.savedInvoiceId}`, { method: 'DELETE' });
            } catch (err) { console.error('Failed to delete invoice:', err); }
        }
        if (fileObj?.preview) URL.revokeObjectURL(fileObj.preview);
        setFiles(prev => prev.filter(x => x.id !== id));
        setUploadStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
        setUploadProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const cancelAndDiscardAll = async () => {
        // Delete all saved invoices from database
        const deletePromises = files
            .filter(f => f.savedInvoiceId)
            .map(f => fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${f.savedInvoiceId}`, { method: 'DELETE' }).catch(() => {}));
        await Promise.all(deletePromises);
        // Clean up previews
        files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
        setFiles([]); setUploadStatus({}); setUploadProgress({}); setErrors([]);
        setMode(null);
    };

    const toggleExpanded = (id) => { setFiles(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f)); };
    const updateFormData = (id, newData) => { setFiles(prev => prev.map(f => f.id === id ? { ...f, formData: newData } : f)); };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); addFiles(e.dataTransfer.files); };
    const handleFileInput = (e) => { addFiles(e.target.files); e.target.value = ''; };

    const allUploaded = files.length > 0 && files.every(f => uploadStatus[f.id] === 'success');
    const isExtracting = files.some(f => uploadStatus[f.id] === 'extracting');
    const hasErrors = files.some(f => uploadStatus[f.id] === 'error');
    const getFileTypeInfo = (file) => ACCEPTED_TYPES[file.type] || { label: 'FILE', icon: File, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-500/10' };

    // ---- RENDER ----

    return (
        <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto min-h-screen transition-colors duration-300">

            {/* Header */}
            <div className="mb-6 md:mb-8">
                {mode ? (
                    <button onClick={() => { setMode(null); setFiles([]); setUploadStatus({}); setUploadProgress({}); setErrors([]); }}
                        className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors mb-4 group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back to options
                    </button>
                ) : (
                    <button onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors mb-4 group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" /> Back
                    </button>
                )}
                <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${mode === 'upload' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/25'
                        : mode === 'manual' ? 'bg-gradient-to-br from-emerald-600 to-teal-600 shadow-emerald-500/25'
                            : 'bg-gradient-to-br from-slate-700 to-slate-900 shadow-slate-500/25'}`}>
                        {mode === 'upload' ? <CloudUpload size={22} className="text-white" /> : mode === 'manual' ? <PenLine size={22} className="text-white" /> : <Plus size={22} className="text-white" />}
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {mode === 'upload' ? 'Upload Invoices' : mode === 'manual' ? 'Create Invoice' : 'Add Invoice'}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-slate-500 mt-0.5">
                            {mode === 'upload' ? 'Drop files \u2014 data is auto-extracted & saved instantly'
                                : mode === 'manual' ? 'Fill in the details manually to create a new invoice'
                                    : 'Choose how you want to add a new invoice'}
                        </p>
                    </div>
                </div>
            </div>

            {/* MODE SELECTION */}
            {!mode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                    {/* Upload Card */}
                    <button onClick={() => setMode('upload')}
                        className="group text-left bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 p-8 md:p-10 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:scale-[1.01] active:scale-[0.99]">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 transition-all duration-300">
                            <CloudUpload size={30} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upload Invoice</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
                            Upload PDF, image, or spreadsheet files. Data will be auto-extracted using AI and saved instantly.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {['PDF', 'PNG', 'JPG', 'XLSX', 'CSV'].map(ext => (
                                <span key={ext} className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">{ext}</span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-bold group-hover:gap-3 transition-all">
                            <span>Start uploading</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>

                    {/* Manual Card */}
                    <button onClick={() => setMode('manual')}
                        className="group text-left bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 p-8 md:p-10 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:scale-[1.01] active:scale-[0.99]">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-all duration-300">
                            <PenLine size={30} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Manual Creation</h2>
                        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-6">
                            Fill in all invoice details manually seller, buyer, items, financials, and bank information.
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {['Seller', 'Buyer', 'Items', 'GST', 'Bank'].map(tag => (
                                <span key={tag} className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">{tag}</span>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold group-hover:gap-3 transition-all">
                            <span>Create manually</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                </div>
            )}

            {/* UPLOAD MODE */}
            {mode === 'upload' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">

                    {/* Error Alerts */}
                    {errors.length > 0 && (
                        <div className="m-5 space-y-2">
                            {errors.map((err, i) => (
                                <div key={i} className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                                    <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">{err}</p>
                                    <button onClick={() => setErrors(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto text-red-400 hover:text-red-600 shrink-0"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Drop Zone */}
                    <div onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        className={`relative cursor-pointer m-5 md:m-8 rounded-2xl border-2 border-dashed transition-all duration-300 group
                            ${isDragging ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/10 scale-[1.01]' : 'border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50/50 dark:hover:bg-slate-800/30'}`}>
                        <div className="flex flex-col items-center justify-center py-10 md:py-14 px-6">
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300
                                ${isDragging ? 'bg-blue-100 dark:bg-blue-500/20 scale-110' : 'bg-gray-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:scale-105'}`}>
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

                    {/* File Cards */}
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
                                const invNum = invoiceNumber || (nextInvoiceNum + fileIdx).toString();

                                return (
                                    <div key={id} className={`rounded-xl border overflow-hidden transition-all duration-300
                                        ${status === 'success' ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/5'
                                            : status === 'error' ? 'border-red-200 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/5'
                                                : status === 'extracting' ? 'border-blue-200 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-500/5'
                                                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/30'}`}>
                                        {/* File Header */}
                                        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => status !== 'extracting' && toggleExpanded(id)}>
                                            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${typeInfo.bg}`}>
                                                {preview ? <img src={preview} alt={file.name} className="w-full h-full object-cover rounded-xl" /> : <TypeIcon size={20} className={typeInfo.color} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {status === 'success' && invNum && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">{invNum}</span>}
                                                    <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 truncate">{form.companyName || form.sellerName || file.name}</p>
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[10px] font-bold uppercase ${typeInfo.color}`}>{typeInfo.label}</span>
                                                    <span className="text-gray-300 dark:text-slate-700">&bull;</span>
                                                    <span className="text-xs text-gray-400 dark:text-slate-500">{formatFileSize(file.size)}</span>
                                                    {status === 'success' && form.total_Amount > 0 && (<><span className="text-gray-300 dark:text-slate-700">&bull;</span><span className="text-xs font-bold text-blue-600 dark:text-blue-400">{'\u20B9'}{Number(form.total_Amount).toLocaleString('en-IN')}</span></>)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {status === 'extracting' && (<div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-500/20 rounded-lg"><ScanSearch size={14} className="text-blue-600 dark:text-blue-400 animate-pulse" /><span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">Extracting...</span></div>)}
                                                {status === 'success' && (<div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg"><Sparkles size={14} className="text-emerald-600 dark:text-emerald-400" /><span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Extracted & Saved</span></div>)}
                                                {status === 'error' && (
                                                    <button onClick={(e) => { e.stopPropagation(); extractFile(files.find(f => f.id === id)); }}
                                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-500/20 rounded-lg hover:bg-red-200 transition-colors">
                                                        <RefreshCw size={14} className="text-red-600 dark:text-red-400" /><span className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase">Retry</span>
                                                    </button>
                                                )}
                                                {status !== 'extracting' && (<button onClick={(e) => { e.stopPropagation(); removeFile(id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"><X size={16} /></button>)}
                                                {status !== 'extracting' && (<button onClick={(e) => { e.stopPropagation(); toggleExpanded(id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>)}
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        {status === 'extracting' && (
                                            <div className="px-4 pb-3">
                                                <div className="w-full h-1.5 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.min(progress, 95)}%` }} />
                                                </div>
                                                <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1 font-medium flex items-center gap-1"><ScanSearch size={10} /> Extracting invoice data with Python...</p>
                                            </div>
                                        )}
                                        {/* Expanded Form */}
                                        {expanded && status === 'success' && (
                                            <div className="px-4 pb-5 border-t border-emerald-100 dark:border-emerald-500/10">
                                                <div className="flex items-center gap-2 py-3 mb-1"><Sparkles size={13} className="text-emerald-500" /><span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Extracted Data (saved to database)</span></div>
                                                <InvoiceForm data={form} onChange={(newData) => updateFormData(id, newData)} isUploaded={true} />
                                            </div>
                                        )}
                                        {expanded && status === 'error' && (
                                            <div className="px-4 pb-5 border-t border-red-100 dark:border-red-500/10">
                                                <div className="flex items-center gap-2 py-3 mb-1"><AlertCircle size={13} className="text-red-500" /><span className="text-[11px] font-bold text-red-600 dark:text-red-400">Extraction failed click Retry to try again</span></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Upload Footer */}
                    {files.length > 0 && (
                        <div className="px-5 md:px-8 py-5 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50 dark:bg-slate-800/20">
                            <div className="flex items-center gap-3">
                                {allUploaded ? (<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={18} /><span className="text-sm font-semibold">All invoices extracted & saved!</span></div>)
                                    : isExtracting ? (<div className="flex items-center gap-2 text-blue-600 dark:text-blue-400"><ScanSearch size={18} className="animate-pulse" /><span className="text-sm font-semibold">Extracting invoice data...</span></div>)
                                        : hasErrors ? (<p className="text-sm text-red-500 dark:text-red-400 font-medium">Some files failed click Retry</p>)
                                            : (<p className="text-sm text-gray-500 dark:text-slate-400"><span className="font-semibold">{files.length}</span> file(s) processed</p>)}
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={cancelAndDiscardAll}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-200 dark:border-red-500/20 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
                                    <Trash2 size={15} /> Cancel & Discard
                                </button>
                                {allUploaded && (<button onClick={() => navigate('/invoices')} className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold text-sm hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20"><CheckCircle2 size={16} /> View in Invoice List</button>)}
                            </div>
                        </div>
                    )}

                    {/* Empty tips */}
                    {files.length === 0 && (
                        <div className="px-5 md:px-8 pb-8">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {[
                                    { icon: FileText, title: 'PDF Invoices', desc: 'Upload scanned or digital PDF invoices', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' },
                                    { icon: Image, title: 'Image Files', desc: 'PNG, JPG photos of paper invoices', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                                    { icon: FileSpreadsheet, title: 'Spreadsheets', desc: 'XLSX, XLS, or CSV invoice data', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                                ].map((item, i) => (
                                    <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20">
                                        <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center mb-3`}><item.icon size={18} className={item.color} /></div>
                                        <h4 className="text-sm font-bold text-gray-700 dark:text-slate-300 mb-1">{item.title}</h4>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-center mt-6">
                                <button type="button" onClick={() => { setMode(null); setFiles([]); setUploadStatus({}); setUploadProgress({}); setErrors([]); }}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                                    <X size={15} /> Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}


            {/* MANUAL MODE */}
            {mode === 'manual' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                    <form onSubmit={handleManualSubmit} className="p-6 md:p-8">

                        {/* Invoice Number (auto-generated) */}
                        <div className="mb-6 flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                <Hash size={18} className="text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Invoice Number</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{manualForm.invoiceNumber || nextInvoiceNum.toString()}</p>
                            </div>
                        </div>

                        <InvoiceForm data={manualForm} onChange={setManualForm} />

                        {/* Footer */}
                        <div className="pt-8 mt-6 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-4">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => setMode(null)}
                                className="px-8 py-3 text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                            >
                                Cancel
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={manualLoading}
                                className="flex items-center gap-2 px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                            >
                                {manualLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save size={18} /> Save Invoice</>}
                            </motion.button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AddInvoice;
