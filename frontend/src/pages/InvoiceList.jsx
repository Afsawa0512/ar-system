import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Trash2, Eye, X, MapPin, Receipt, Wallet, Check, Mail, FileText, Tag, Building2, Package, Percent, Calendar, ArrowRight, Hash, Send, CheckSquare, Square } from 'lucide-react';

const InvoiceList = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [paymentInput, setPaymentInput] = useState('');
    const headerScrollRef = useRef(null);

    const handleRowScroll = (e) => {
        if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState({ total: 0, pages: 1, currentPage: 1 });
    const [statusCounts, setStatusCounts] = useState({ All: 0, Paid: 0, Due: 0, Overdue: 0, PartiallyPaid: 0 });
    const [toast, setToast] = useState(null);
    const [sendingEmail, setSendingEmail] = useState(null); // Track which invoice is sending
    const [selectedInvoices, setSelectedInvoices] = useState([]); // Track selected invoices for bulk actions
    const [sendingBulk, setSendingBulk] = useState(false); // Track bulk email sending

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const prepareMail = useCallback(async (invoice) => {
        // Check if email can be sent (cooldown)
        if (invoice.nextEmailAvailable && new Date(invoice.nextEmailAvailable) > new Date()) {
            const daysRemaining = Math.ceil((new Date(invoice.nextEmailAvailable) - new Date()) / (1000 * 60 * 60 * 24));
            showToast(`Please wait ${daysRemaining} more day(s) before sending another email`, "error");
            return;
        }

        setSendingEmail(invoice._id);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice._id}/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const ccInfo = data.ccCount > 0 ? ` (CC: ${data.ccCount})` : '';
                showToast(`✓ Email is being sent to ${data.sentTo}${ccInfo}`, "success");
                // Refresh invoice data to get updated email tracking
                fetchInvoices(pagination.currentPage);
            } else {
                showToast(data.message || "Failed to send email", "error");
            }
        } catch (error) {
            console.error('Error sending email:', error);
            showToast("Connection error. Please check backend", "error");
        } finally {
            setSendingEmail(null);
        }
    }, [showToast, pagination.currentPage]);

    // Toggle single invoice selection
    const toggleInvoiceSelection = (invoiceId) => {
        setSelectedInvoices(prev => {
            if (prev.includes(invoiceId)) {
                return prev.filter(id => id !== invoiceId);
            } else {
                return [...prev, invoiceId];
            }
        });
    };

    // Toggle all invoices selection
    const toggleAllInvoices = () => {
        if (selectedInvoices.length === filteredInvoices.length) {
            setSelectedInvoices([]);
        } else {
            setSelectedInvoices(filteredInvoices.map(inv => inv._id));
        }
    };

    // Send emails to multiple invoices
    const sendBulkEmails = async () => {
        if (selectedInvoices.length === 0) {
            showToast('Please select at least one invoice', 'error');
            return;
        }

        if (!window.confirm(`Send emails to ${selectedInvoices.length} selected invoice(s)?`)) {
            return;
        }

        setSendingBulk(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/bulk/send-emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceIds: selectedInvoices })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const { results } = data;
                showToast(
                    `✓ Bulk send completed: ${results.success} queued, ${results.failed} failed, ${results.skipped} skipped`, 
                    results.failed > 0 ? 'error' : 'success'
                );
                
                // Clear selection and refresh
                setSelectedInvoices([]);
                fetchInvoices(pagination.currentPage);
            } else {
                showToast(data.message || "Failed to send bulk emails", "error");
            }
        } catch (error) {
            console.error('Error sending bulk emails:', error);
            showToast("Connection error. Please check backend", "error");
        } finally {
            setSendingBulk(false);
        }
    };


    const fetchInvoices = async (page = 1, search = searchTerm, status = filterStatus) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices?page=${page}&limit=50&search=${encodeURIComponent(search)}&status=${status}`);
            if (response.ok) {
                const data = await response.json();
                setInvoices(data.invoices);
                setPagination({
                    total: data.total,
                    pages: data.pages,
                    currentPage: data.currentPage
                });
                if (data.statusCounts) setStatusCounts(data.statusCounts);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchInvoices(1);
    }, []);

    // Debounced search and filter fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvoices(1, searchTerm, filterStatus);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, filterStatus]);

    // Helper: get invoice number regardless of old/new field name
    const getInvoiceNumber = (inv) => inv.invoiceNumber || inv.invoice_number || '-';

    // Helper: parse DD-MM-YYYY or any date string safely
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
            const [dd, mm, yyyy] = dateStr.split('-');
            const d = new Date(`${yyyy}-${mm}-${dd}`);
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    // Derive payment status from balance_due and dueDate
    const getPaymentStatus = (invoice) => {
        const balance = parseFloat(invoice.balance_due || 0);
        if (balance <= 0) return 'Paid';

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const due = parseDate(invoice.dueDate);
        if (due) {
            due.setHours(0, 0, 0, 0);
            if (due < today) return 'Overdue';
            if (due.getTime() === today.getTime()) return 'Due Today';
        }

        if (invoice.paymentStatus) return invoice.paymentStatus;

        const total = parseFloat(invoice.total_Amount || 0);
        if (balance >= total) return 'Due';
        return 'PartiallyPaid';
    };


    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this invoice?')) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${id}`, { method: 'DELETE' });
                if (res.ok) setInvoices(invoices.filter(inv => inv._id !== id));
            } catch (err) { console.error('Error deleting invoice:', err); }
        }
    };

    const handleMarkAsPaid = async (invoice) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    balance_due: 0,
                    paymentStatus: 'Paid'
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setInvoices(invoices.map(inv => inv._id === invoice._id ? updated : inv));
                setSelectedInvoice(updated);
            }
        } catch (err) { console.error('Error marking as paid:', err); }
    };

    const handlePartialPayment = async (invoice) => {
        const amount = parseFloat(paymentInput);
        if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount'); return; }
        const currentBalance = parseFloat(invoice.balance_due || 0);
        const newBalance = currentBalance - amount;
        if (newBalance < 0) { alert(`Amount cannot exceed balance due (₹${currentBalance.toFixed(2)})`); return; }
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/${invoice._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    balance_due: newBalance,
                    paymentStatus: newBalance <= 0 ? 'Paid' : 'PartiallyPaid'
                }),
            });
            if (res.ok) {
                const updated = await res.json();
                setInvoices(invoices.map(inv => inv._id === invoice._id ? updated : inv));
                setSelectedInvoice(updated);
                setPaymentInput('');
            }
        } catch (err) { console.error('Error recording payment:', err); }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
            case 'Due': return 'bg-amber-50 text-amber-700 border-amber-100/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
            case 'PartiallyPaid': return 'bg-indigo-50 text-indigo-700 border-indigo-100/80 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
            case 'Overdue': return 'bg-rose-50 text-rose-700 border-rose-100/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
            default: return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
        }
    };

    // Use invoices directly since filtering is now server-side
    const filteredInvoices = invoices;

    const calculateDaysLeft = (dueDate) => {
        const due = parseDate(dueDate);
        if (!due) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        // Formula: due - today (Negative means Overdue)
        return Math.round((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
    };


    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto dark:bg-slate-950 min-h-screen transition-colors duration-500 font-sans selection:bg-slate-200 selection:text-slate-900">
            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ x: 300, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 300, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className={`fixed top-6 right-6 z-[100] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-xl border text-sm font-semibold max-w-sm ${
                            toast.type === 'success'
                                ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                                : toast.type === 'error'
                                    ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800'
                                    : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                        }`}
                    >
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        toast.type === 'success' 
                            ? 'bg-emerald-100 dark:bg-emerald-900' 
                            : toast.type === 'error'
                                ? 'bg-rose-100 dark:bg-rose-900'
                                : 'bg-blue-100 dark:bg-blue-900'
                    }`}>
                        {toast.type === 'success'
                            ? <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
                            : toast.type === 'error'
                                ? <X size={11} className="text-rose-600 dark:text-rose-400" />
                                : <Mail size={11} className="text-blue-600 dark:text-blue-400" />}
                    </div>
                    <span className="leading-snug">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-slate-300 hover:text-slate-500 dark:hover:text-slate-300 mt-0.5 shrink-0">
                        <X size={13} />
                    </button>
                    </motion.div>
                )}
            </AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6"
            >
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Invoices</h1>
                    <p className="text-slate-500 text-sm font-medium">Finance ledger management</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedInvoices.length > 0 && (
                        <button
                            onClick={sendBulkEmails}
                            disabled={sendingBulk}
                            className="flex items-center gap-2.5 px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-all text-sm shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sendingBulk ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    <span>Send {selectedInvoices.length} Email{selectedInvoices.length > 1 ? 's' : ''}</span>
                                </>
                            )}
                        </button>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate('/add-invoice')}
                        className="flex items-center gap-2.5 px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-black dark:hover:bg-slate-700 transition-all text-sm shadow-md"
                    >
                        <Plus size={18} />
                        <span>New Invoice</span>
                    </motion.button>
                    <div className="bg-white dark:bg-slate-900 px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <Calendar size={18} className="text-slate-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                {/* Filters */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row gap-6 justify-between items-center bg-white dark:bg-slate-900">
                    <div className="relative w-full xl:w-[450px] group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-slate-400 w-full text-[13px] outline-none dark:text-slate-200 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                        {['All', 'Paid', 'Due', 'Overdue', 'PartiallyPaid'].map(s => {
                            const label = s === 'PartiallyPaid' ? 'Partial' : s;
                            const count = statusCounts[s] || 0;
                            return (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${filterStatus === s
                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                                    {label}
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${filterStatus === s
                                        ? s === 'Overdue' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                                            : s === 'Paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                                                : s === 'Due' ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                                                    : s === 'PartiallyPaid' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
                                                        : 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300'
                                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Table */}
                {/* Scrollable Records List */}
                <div className="flex flex-col">
                    {/* Header - Fixed structure to match records */}
                    <div className="hidden lg:block bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 backdrop-blur-md">
                        <div ref={headerScrollRef} className="overflow-x-auto scrollbar-hide">
                            <div className="flex items-center min-w-max px-3">
                                <div className="w-[50px] shrink-0 px-3 py-5 text-center">
                                    <button 
                                        onClick={toggleAllInvoices}
                                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                        title={selectedInvoices.length === filteredInvoices.length ? "Deselect all" : "Select all"}
                                    >
                                        {selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                                            <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                                        ) : (
                                            <Square size={18} className="text-slate-400" />
                                        )}
                                    </button>
                                </div>
                                <div className="w-[120px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Invoice No</div>
                                <div className="w-[220px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Company Name</div>
                                <div className="w-[160px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Buyer GSTIN</div>
                                <div className="w-[110px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Invoice Date</div>
                                <div className="w-[110px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Due Date</div>
                                <div className="w-[110px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Today Date</div>
                                <div className="w-[180px] shrink-0 px-5 py-5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Status</div>
                                <div className="w-[100px] shrink-0 px-5 py-5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Terms</div>
                                <div className="w-[150px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Place of Supply</div>
                                <div className="w-[180px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Subject</div>
                                <div className="w-[220px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Description</div>
                                <div className="w-[110px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">HSN/SAC</div>
                                <div className="w-[120px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Unit Price</div>
                                <div className="w-[70px] shrink-0 px-5 py-5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Qty</div>
                                <div className="w-[120px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Subtotal</div>
                                <div className="w-[70px] shrink-0 px-5 py-5 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">GST</div>
                                <div className="w-[120px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">GST Amt</div>
                                <div className="w-[130px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Total</div>
                                <div className="w-[120px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Credits</div>
                                <div className="w-[130px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Balance</div>
                                <div className="w-[140px] shrink-0 px-5 py-5 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em]">Email Status</div>
                                <div className="w-[180px] shrink-0 px-5 py-5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] pr-12">Actions</div>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative divide-y divide-gray-100 dark:divide-slate-800">
                        {isLoading && (
                            <div className="absolute inset-0 z-40 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center min-h-[300px]">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest animate-pulse">Syncing Data...</p>
                                </div>
                            </div>
                        )}
                        {filteredInvoices.length > 0 ? filteredInvoices.map((invoice) => {
                            const status = getPaymentStatus(invoice);
                            const daysLeft = calculateDaysLeft(invoice.dueDate);
                            return (
                                <div key={invoice._id}
                                    onMouseEnter={(e) => {
                                        const scrollContainer = e.currentTarget.querySelector('.overflow-x-auto');
                                        if (scrollContainer && headerScrollRef.current) {
                                            headerScrollRef.current.scrollLeft = scrollContainer.scrollLeft;
                                        }
                                    }}
                                    className="group hover:bg-gray-50/30 dark:hover:bg-slate-800/20 transition-all duration-200">
                                    <div className="overflow-x-auto scrollbar-hide group-hover:scrollbar-default scroll-smooth"
                                        onScroll={handleRowScroll}>
                                        <div className="flex items-center min-w-max px-3 py-4">
                                            {/* Checkbox */}
                                            <div className="w-[50px] shrink-0 px-3 flex items-center justify-center">
                                                <button 
                                                    onClick={() => toggleInvoiceSelection(invoice._id)}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                                >
                                                    {selectedInvoices.includes(invoice._id) ? (
                                                        <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                                                    ) : (
                                                        <Square size={18} className="text-slate-400" />
                                                    )}
                                                </button>
                                            </div>
                                            
                                            {/* Invoice # */}
                                            <div className="w-[120px] shrink-0 px-5 font-bold text-slate-900 dark:text-slate-100 text-[13px] tracking-tight tabular-nums">
                                                {getInvoiceNumber(invoice)}
                                            </div>

                                            {/* Company */}
                                            <div className="w-[220px] shrink-0 px-5">
                                                <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm whitespace-normal leading-tight" title={invoice.companyName}>{invoice.companyName || 'N/A'}</div>
                                                <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{invoice.State || ''}</div>
                                            </div>

                                            {/* Buyer GSTIN */}
                                            <div className="w-[160px] shrink-0 px-5 text-[12px] text-slate-600 dark:text-slate-300 font-mono font-medium tabular-nums">
                                                {invoice.buyerGSTIN || '-'}
                                            </div>

                                            {/* Invoice Date */}
                                            <div className="w-[110px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                                {invoice.invoiceDate || '-'}
                                            </div>

                                            {/* Due Date */}
                                            <div className="w-[110px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                                {invoice.dueDate || '-'}
                                            </div>

                                            {/* Today Date */}
                                            <div className="w-[110px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')}
                                            </div>

                                            {/* Status */}
                                            <div className="w-[180px] shrink-0 px-5 text-center flex items-center justify-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest shadow-sm ${status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                                                    status === 'Due' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                                                        status === 'Overdue' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' :
                                                            status === 'Due Today' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                                                                'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                                    }`}>
                                                    {status === 'PartiallyPaid' ? 'Partial' : status === 'Due Today' ? 'Today' : status}
                                                </span>
                                            </div>


                                            {/* Terms */}
                                            <div className="w-[100px] shrink-0 px-5 text-[13px] font-medium whitespace-nowrap text-center">
                                                {invoice.Terms
                                                    ? <span className="text-slate-600 dark:text-slate-300">Net {invoice.Terms}</span>
                                                    : <span className="text-slate-300">-</span>
                                                }
                                            </div>

                                            {/* Place of Supply */}
                                            <div className="w-[150px] shrink-0 px-5 text-[12px] text-slate-600 dark:text-slate-300 font-medium">
                                                {invoice.placeOfSupply || '-'}
                                            </div>

                                            {/* Subject */}
                                            <div className="w-[180px] shrink-0 px-5">
                                                <div className="text-[12px] text-slate-600 dark:text-slate-300 line-clamp-1 font-medium" title={invoice.subject || ''}>{invoice.subject || '-'}</div>
                                            </div>

                                            {/* Description */}
                                            <div className="w-[220px] shrink-0 px-5">
                                                <div className="text-[13px] text-slate-600 dark:text-slate-300 line-clamp-1 font-medium leading-relaxed" title={invoice.description || ''}>
                                                    {invoice.description || 'N/A'}
                                                </div>
                                            </div>

                                            {/* HSN/SAC */}
                                            <div className="w-[110px] shrink-0 px-5 text-[12px] text-slate-600 dark:text-slate-300 font-mono font-medium">
                                                {invoice.hsnSac || '-'}
                                            </div>

                                            {/* Unit Price */}
                                            <div className="w-[120px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                                                ₹{parseFloat(invoice.total_price || 0).toLocaleString('en-IN')}
                                            </div>

                                            {/* Qty */}
                                            <div className="w-[70px] shrink-0 px-5 text-center text-[13px] text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                                {invoice.quantity ?? '-'}
                                            </div>

                                            {/* Subtotal (Unit * Qty) */}
                                            <div className="w-[120px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                                                ₹{parseFloat(invoice.subtotal || (invoice.total_price * (invoice.quantity || 1)) || 0).toLocaleString('en-IN')}
                                            </div>

                                            {/* GST % */}
                                            <div className="w-[70px] shrink-0 px-5 text-center text-[13px] text-slate-600 dark:text-slate-300 font-medium tabular-nums">
                                                {invoice.GST ? `${invoice.GST}%` : '-'}
                                            </div>

                                            {/* GST Amt */}
                                            <div className="w-[120px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                                                ₹{parseFloat(invoice.GST_Amount || 0).toLocaleString('en-IN')}
                                            </div>

                                            {/* Total Amount */}
                                            <div className="w-[130px] shrink-0 px-5 text-[13px] text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                                                ₹{parseFloat(invoice.total_Amount || 0).toLocaleString('en-IN')}
                                            </div>

                                            {/* Credits Applied */}
                                            <div className="w-[120px] shrink-0 px-5 text-[13px] text-orange-600 dark:text-orange-400 font-medium whitespace-nowrap tabular-nums">
                                                {parseFloat(invoice.creditsApplied || 0) > 0 ? `(-) ₹${parseFloat(invoice.creditsApplied).toLocaleString('en-IN')}` : '-'}
                                            </div>

                                            {/* Balance Due */}
                                            <div className="w-[130px] shrink-0 px-5 text-[13px] text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap tabular-nums">
                                                ₹{parseFloat(invoice.balance_due || 0).toLocaleString('en-IN')}
                                            </div>

                                            {/* Email Status */}
                                            <div className="w-[140px] shrink-0 px-5">
                                                {invoice.emailSentCount > 0 && invoice.lastEmailSent ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Sent {invoice.emailSentCount}x</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                            {new Date(invoice.lastEmailSent).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Not sent</span>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="w-[180px] shrink-0 px-5 pr-12 pl-10">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <button onClick={() => { setSelectedInvoice(invoice); setShowViewModal(true); }}
                                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700" title="View Details">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => prepareMail(invoice)}
                                                        disabled={sendingEmail === invoice._id || (invoice.nextEmailAvailable && new Date(invoice.nextEmailAvailable) > new Date())}
                                                        className={`p-2 rounded-xl transition-all shadow-sm border relative ${
                                                            sendingEmail === invoice._id 
                                                                ? 'text-blue-400 cursor-wait bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                                                                : (invoice.nextEmailAvailable && new Date(invoice.nextEmailAvailable) > new Date())
                                                                    ? 'text-slate-300 cursor-not-allowed opacity-50 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                                                                    : invoice.emailSentCount > 0
                                                                        ? 'text-emerald-500 hover:text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-800'
                                                                        : 'text-slate-400 hover:text-emerald-600 bg-white dark:bg-slate-800 hover:bg-emerald-50 border-slate-100 dark:border-slate-700 dark:hover:bg-emerald-900/40'
                                                        }`}
                                                        title={
                                                            sendingEmail === invoice._id 
                                                                ? '📧 Sending email...' 
                                                                : (invoice.nextEmailAvailable && new Date(invoice.nextEmailAvailable) > new Date())
                                                                    ? `⏳ Cooldown active\nNext email: ${new Date(invoice.nextEmailAvailable).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                                                                    : invoice.emailSentCount > 0 && invoice.lastEmailSent
                                                                        ? `✅ Email sent ${invoice.emailSentCount} time(s)\nLast sent: ${new Date(invoice.lastEmailSent).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n\nClick to send again`
                                                                        : '📧 Send Email'
                                                        }>
                                                        {sendingEmail === invoice._id ? (
                                                            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                                                        ) : (
                                                            <Mail size={16} />
                                                        )}
                                                        {invoice.emailSentCount > 0 && (
                                                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-md ring-2 ring-white dark:ring-slate-800">
                                                                {invoice.emailSentCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <button onClick={() => handleDelete(invoice._id)}
                                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-xl transition-all shadow-sm bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className="py-20 text-center text-gray-400 bg-white dark:bg-slate-900">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                        <Search size={32} className="opacity-20" />
                                    </div>
                                    <p className="text-sm font-medium">No invoices found matching your criteria</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Pagination Controls */}
                {pagination.pages > 1 && (
                    <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-[13px] text-slate-500 dark:text-slate-400 font-medium">
                            Showing <span className="text-slate-900 dark:text-white">Page {pagination.currentPage}</span> of <span className="text-slate-900 dark:text-white">{pagination.pages}</span>
                            <span className="mx-2 opacity-30 text-slate-300">|</span>
                            <span className="tabular-nums text-slate-400">{pagination.total} total records</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.currentPage === 1}
                                onClick={() => fetchInvoices(pagination.currentPage - 1)}
                                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all border ${pagination.currentPage === 1
                                    ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                            >
                                Previous
                            </button>
                            <button
                                disabled={pagination.currentPage === pagination.pages}
                                onClick={() => fetchInvoices(pagination.currentPage + 1)}
                                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all border ${pagination.currentPage === pagination.pages
                                    ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

                {/* ── View Modal ── */}
                {showViewModal && selectedInvoice && (() => {
                    const inv = selectedInvoice;
                    const status = getPaymentStatus(inv);
                    const totalAmt = parseFloat(inv.total_Amount || 0);
                    const balanceDue = parseFloat(inv.balance_due || 0);
                    const paidAmt = totalAmt - balanceDue;
                    const unitPrice = parseFloat(inv.total_price || 0);
                    const quantity = inv.quantity || 1;
                    const subtotal = unitPrice * quantity;
                    const gstAmt = parseFloat(inv.GST_Amount || 0);
                    const gstRate = inv.GST ? `${inv.GST}%` : '18%';
                    const daysLeft = calculateDaysLeft(inv.dueDate);
                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)} />
                            <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                                {/* Header */}
                                <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                                            <Receipt size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{getInvoiceNumber(inv)}</h2>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Transaction Ledger</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                        <X size={20} className="text-slate-400" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="overflow-y-auto p-6 space-y-4 flex-1">

                                    {/* Status / Dates row */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Status</p>
                                            <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300 uppercase">{status === 'PartiallyPaid' ? 'Partial' : status}</p>
                                        </div>
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Date</p>
                                            <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">{inv.invoiceDate || '-'}</p>
                                        </div>
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Due</p>
                                            <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300 tabular-nums">{inv.dueDate || '-'}</p>
                                        </div>
                                    </div>

                                    {/* Overdue Alert */}
                                    {status !== 'Paid' && daysLeft !== null && (
                                        <div className={`rounded-xl p-3 border ${daysLeft < 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-100'}`}>
                                            <p className={`text-sm font-bold ${daysLeft < 0 ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {daysLeft < 0 ? `${Math.abs(daysLeft)} Days Overdue` : (daysLeft === 0 ? 'Due Today' : `${Math.abs(daysLeft)} Days Remaining`)}
                                            </p>
                                        </div>
                                    )}

                                    {/* Seller Info */}
                                    {(inv.sellerName || inv.sellerGSTIN) && (
                                        <div className="bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/20">
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase mb-2">From / Seller</p>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{inv.sellerName || '-'}</p>
                                            {inv.sellerGSTIN && <p className="text-xs text-slate-500 mt-1 font-mono">GSTIN: {inv.sellerGSTIN}</p>}
                                            {inv.sellerAddress && <p className="text-xs text-slate-400 mt-1">{inv.sellerAddress}</p>}
                                        </div>
                                    )}

                                    {/* Company / Buyer */}
                                    <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Bill To / Customer</p>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white">{inv.companyName || 'N/A'}</p>
                                        {inv.buyerGSTIN && <p className="text-xs text-slate-500 mt-1 font-mono">GSTIN: {inv.buyerGSTIN}</p>}
                                        {inv.buyerAddress && <p className="text-xs text-slate-400 mt-1">{inv.buyerAddress}</p>}
                                        <div className="flex gap-4 mt-2 flex-wrap">
                                            {inv.State && <span className="text-xs text-slate-500">{inv.State}</span>}
                                            {inv.placeOfSupply && <span className="text-xs text-slate-500">Supply: <span className="font-bold text-slate-700 dark:text-slate-300">{inv.placeOfSupply}</span></span>}
                                            {inv.Terms && <span className="text-xs text-slate-500">Terms: <span className="font-bold text-slate-700 dark:text-slate-300">{inv.Terms} Days</span></span>}
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    {inv.subject && (
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Subject</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{inv.subject}</p>
                                        </div>
                                    )}

                                    {/* Work Description Detailed View */}
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-700/50 shadow-sm transition-all hover:bg-white dark:hover:bg-slate-800/60 hover:shadow-md">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                                    <FileText size={16} className="text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Description</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {inv.hsnSac && (
                                                    <span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-400 font-mono">
                                                        HSN: {inv.hsnSac}
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                                    <Package size={12} />
                                                    Qty: {inv.quantity ?? 1}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="relative pl-2 border-l-2 border-blue-500/20 dark:border-blue-500/10">
                                            <div className="max-h-48 overflow-y-auto text-sm text-slate-600 dark:text-slate-300 leading-7 font-medium scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 pr-4 whitespace-pre-wrap">
                                                {inv.description || "No description provided for this invoice."}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-100 dark:border-slate-700">
                                        <div className="space-y-3">
                                            <div className="flex justify-between text-[13px] text-slate-500">
                                                <span>Unit Price × Qty</span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">₹{unitPrice.toLocaleString('en-IN')} × {quantity}</span>
                                            </div>
                                            <div className="flex justify-between text-[13px] text-slate-500">
                                                <span>Subtotal</span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">₹{subtotal.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="flex justify-between text-[13px] text-slate-500">
                                                <span>GST ({gstRate})</span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">₹{gstAmt.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-slate-900 dark:text-white">
                                                <span className="text-xs font-bold uppercase tracking-widest">Grand Total</span>
                                                <span className="text-2xl font-bold tabular-nums">₹{totalAmt.toLocaleString('en-IN')}</span>
                                            </div>
                                            {parseFloat(inv.creditsApplied || 0) > 0 && (
                                                <div className="flex justify-between text-[13px] text-orange-600 dark:text-orange-400">
                                                    <span>Credits Applied</span>
                                                    <span className="font-bold tabular-nums">(-) ₹{parseFloat(inv.creditsApplied).toLocaleString('en-IN')}</span>
                                                </div>
                                            )}
                                        </div>
                                        {inv.totalInWords && (
                                            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total in Words</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-300 italic">{inv.totalInWords}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Payment Status Info */}
                                    {(status === 'PartiallyPaid' || status === 'Paid') && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Settled</p>
                                                <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">₹{paidAmt.toLocaleString('en-IN')}</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Balance</p>
                                                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">₹{balanceDue.toLocaleString('en-IN')}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Details */}
                                    {(status === 'PartiallyPaid' || status === 'Paid') && (inv.paymentMethod || inv.paidToBankName || inv.paymentReference) && (
                                        <div className="bg-emerald-50/50 dark:bg-emerald-500/10 rounded-xl p-5 border border-emerald-100 dark:border-emerald-500/20">
                                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-3 flex items-center gap-1.5">
                                                <Check size={12} /> Payment Details
                                            </p>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                                                {inv.paymentMethod && (
                                                    <><span className="text-slate-400">Payment Method</span><span className="font-medium text-slate-700 dark:text-slate-200">{inv.paymentMethod}</span></>
                                                )}
                                                {inv.paidToBankName && (
                                                    <><span className="text-slate-400">Paid to Bank</span><span className="font-medium text-slate-700 dark:text-slate-200">{inv.paidToBankName}</span></>
                                                )}
                                                {inv.paymentDate && (
                                                    <><span className="text-slate-400">Payment Date</span><span className="font-medium text-slate-700 dark:text-slate-200">{new Date(inv.paymentDate).toLocaleDateString('en-IN')}</span></>
                                                )}
                                                {inv.paymentReference && (
                                                    <><span className="text-slate-400">Reference / TXN ID</span><span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{inv.paymentReference}</span></>
                                                )}
                                            </div>
                                            {inv.paymentNotes && (
                                                <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-500/20">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Notes</p>
                                                    <p className="text-[13px] text-slate-600 dark:text-slate-300">{inv.paymentNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Bank / Remittance Details */}
                                    {(inv.bankName || inv.bankAccountNo || inv.bankIFSC) && (
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Bank / Remittance Details</p>
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                                                {inv.bankAccountName && (
                                                    <><span className="text-slate-400">Account Name</span><span className="font-medium text-slate-700 dark:text-slate-200">{inv.bankAccountName}</span></>
                                                )}
                                                {inv.bankAccountNo && (
                                                    <><span className="text-slate-400">Account No.</span><span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{inv.bankAccountNo}</span></>
                                                )}
                                                {inv.bankName && (
                                                    <><span className="text-slate-400">Bank</span><span className="font-medium text-slate-700 dark:text-slate-200">{inv.bankName}</span></>
                                                )}
                                                {inv.bankAddress && (
                                                    <><span className="text-slate-400">Branch</span><span className="font-medium text-slate-700 dark:text-slate-200">{inv.bankAddress}</span></>
                                                )}
                                                {inv.bankIFSC && (
                                                    <><span className="text-slate-400">IFSC</span><span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{inv.bankIFSC}</span></>
                                                )}
                                                {inv.bankSWIFT && (
                                                    <><span className="text-slate-400">SWIFT</span><span className="font-medium text-slate-700 dark:text-slate-200 font-mono">{inv.bankSWIFT}</span></>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Record Payment */}
                                    {status !== 'Paid' && (
                                        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border-2 border-blue-200 dark:border-blue-500/30">
                                            <h3 className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                                                <Wallet size={15} /> Record Payment
                                            </h3>
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Enter amount"
                                                        value={paymentInput}
                                                        onChange={(e) => setPaymentInput(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg focus:border-blue-500 outline-none font-bold text-slate-900 dark:text-white text-sm"
                                                    />
                                                </div>
                                                <button onClick={() => handlePartialPayment(inv)}
                                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 text-sm">
                                                    Add
                                                </button>
                                            </div>
                                            <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">Balance Due: ₹{balanceDue.toLocaleString('en-IN')}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
                                    {status !== 'Paid' && (
                                        <button onClick={() => handleMarkAsPaid(inv)}
                                            className="flex-1 py-3 bg-slate-900 dark:bg-slate-950 text-white rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 text-sm shadow-lg">
                                            <Check size={18} /> Mark as Paid
                                        </button>
                                    )}
                                    <button onClick={() => window.print()}
                                        className="px-6 py-3 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 text-sm shadow-sm">
                                        <Receipt size={16} /> Print
                                    </button>
                                    <button onClick={() => setShowViewModal(false)}
                                        className="px-6 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all text-sm">
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
};

export default InvoiceList;
