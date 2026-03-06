import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Trash2, Edit2, Check, X, Star, Loader2, Building2, 
    CheckCircle2, AlertCircle, Landmark, Search
} from 'lucide-react';

const BankAccountManagement = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [formData, setFormData] = useState({
        accountName: '',
        accountNo: '',
        bankName: '',
        bankAddress: '',
        ifscCode: '',
        swiftCode: '',
        branch: '',
        nickname: '',
        isDefault: false
    });

    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bank-accounts`);
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            } else {
                showNotification('Failed to load bank accounts', 'error');
            }
        } catch (err) {
            console.error('Failed to fetch bank accounts:', err);
            showNotification('Unable to connect to server', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = editingId
                ? `${import.meta.env.VITE_API_URL}/api/bank-accounts/${editingId}`
                : `${import.meta.env.VITE_API_URL}/api/bank-accounts`;
            const method = editingId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                await fetchAccounts();
                showNotification(editingId ? 'Bank account updated successfully!' : 'Bank account added successfully!', 'success');
                resetForm();
            } else {
                showNotification('Failed to save bank account', 'error');
            }
        } catch (err) {
            console.error('Failed to save bank account:', err);
            showNotification('Unable to save. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this bank account?')) return;
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bank-accounts/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                await fetchAccounts();
                showNotification('Bank account deleted successfully!', 'success');
            } else {
                showNotification('Failed to delete bank account', 'error');
            }
        } catch (err) {
            console.error('Failed to delete bank account:', err);
            showNotification('Unable to delete. Please try again.', 'error');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bank-accounts/${id}/set-default`, {
                method: 'POST'
            });
            if (res.ok) {
                await fetchAccounts();
                showNotification('Default bank account updated!', 'success');
            } else {
                showNotification('Failed to set default', 'error');
            }
        } catch (err) {
            console.error('Failed to set default:', err);
            showNotification('Unable to update. Please try again.', 'error');
        }
    };

    const handleEdit = (account) => {
        setFormData({
            accountName: account.accountName,
            accountNo: account.accountNo,
            bankName: account.bankName,
            bankAddress: account.bankAddress || '',
            ifscCode: account.ifscCode,
            swiftCode: account.swiftCode || '',
            branch: account.branch || '',
            nickname: account.nickname || '',
            isDefault: account.isDefault
        });
        setEditingId(account._id);
        setShowAddForm(true);
    };

    const handleIFSCLookup = async () => {
        const ifsc = formData.ifscCode.trim().toUpperCase();
        if (!ifsc || ifsc.length !== 11) {
            showNotification('Please enter a valid 11-character IFSC code', 'error');
            return;
        }

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices/ifsc/${ifsc}`);
            if (res.ok) {
                const data = await res.json();
                setFormData(prev => ({
                    ...prev,
                    bankName: data.BANK,
                    branch: data.BRANCH,
                    bankAddress: data.ADDRESS
                }));
                showNotification('Bank details fetched successfully!', 'success');
            } else {
                showNotification('Invalid IFSC code or bank details not found', 'error');
            }
        } catch (err) {
            console.error('IFSC lookup failed:', err);
            showNotification('Unable to fetch bank details', 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            accountName: '',
            accountNo: '',
            bankName: '',
            bankAddress: '',
            ifscCode: '',
            swiftCode: '',
            branch: '',
            nickname: '',
            isDefault: false
        });
        setEditingId(null);
        setShowAddForm(false);
    };

    const filteredAccounts = accounts.filter(acc => {
        const search = searchQuery.toLowerCase();
        return (
            acc.bankName.toLowerCase().includes(search) ||
            acc.accountName.toLowerCase().includes(search) ||
            acc.accountNo.toLowerCase().includes(search) ||
            (acc.ifscCode && acc.ifscCode.toLowerCase().includes(search))
        );
    });

    const inp = "w-full px-3 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white text-sm transition-colors outline-none";
    const lbl = "text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block";

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <Loader2 className="animate-spin text-blue-600 mb-3" size={48} />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading bank accounts...</p>
            </div>
        );
    }

    const defaultAccount = accounts.find(acc => acc.isDefault);
    const totalAccounts = accounts.length;
    const verifiedCount = accounts.filter(acc => acc.ifscCode).length;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                
                {/* Notification Toast */}
                <AnimatePresence>
                    {notification.show && (
                        <motion.div
                            initial={{ x: 300, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 300, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
                                notification.type === 'success' 
                                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200' 
                                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                            }`}
                        >
                            {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span className="font-medium text-sm">{notification.message}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-6"
                >
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                        Bank Accounts
                                    </h1>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        Manage your payment accounts and banking information
                                    </p>
                                </div>
                            </div>
                            
                            {!showAddForm && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowAddForm(true)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
                                >
                                    <Plus size={18} />
                                    Add Account
                                </motion.button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Stats Cards */}
                {totalAccounts > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                    >
                        <motion.div
                            whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Accounts</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalAccounts}</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </motion.div>
                        
                        <motion.div
                            whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Default Account</p>
                                    <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1 truncate">
                                        {defaultAccount ? defaultAccount.bankName : 'Not set'}
                                    </p>
                                </div>
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <Star className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        </motion.div>
                        
                        <motion.div
                            whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Verified</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{verifiedCount}</p>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Search Bar */}
                {totalAccounts > 0 && !showAddForm && (
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search by account name, bank name, or account number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors"
                            />
                        </div>
                    </div>
                )}

                {/* Add/Edit Form */}
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6"
                        >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                                {editingId ? 'Edit Bank Account' : 'Add New Account'}
                            </h2>
                            <button
                                onClick={resetForm}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Account Name */}
                                <div>
                                    <label className={lbl}>Account Holder Name *</label>
                                    <input
                                        type="text"
                                        value={formData.accountName}
                                        onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                                        className={inp}
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                {/* Account Number */}
                                <div>
                                    <label className={lbl}>Account Number *</label>
                                    <input
                                        type="text"
                                        value={formData.accountNo}
                                        onChange={(e) => setFormData({...formData, accountNo: e.target.value})}
                                        className={inp}
                                        placeholder="1234567890"
                                        required
                                    />
                                </div>

                                {/* IFSC Code with Lookup */}
                                <div>
                                    <label className={lbl}>IFSC Code *</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={formData.ifscCode}
                                            onChange={(e) => setFormData({...formData, ifscCode: e.target.value.toUpperCase()})}
                                            className={inp}
                                            placeholder="SBIN0001234"
                                            maxLength="11"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={handleIFSCLookup}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            Fetch
                                        </button>
                                    </div>
                                </div>

                                {/* Bank Name */}
                                <div>
                                    <label className={lbl}>Bank Name *</label>
                                    <input
                                        type="text"
                                        value={formData.bankName}
                                        onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                                        className={inp}
                                        placeholder="State Bank of India"
                                        required
                                    />
                                </div>

                                {/* Branch */}
                                <div>
                                    <label className={lbl}>Branch</label>
                                    <input
                                        type="text"
                                        value={formData.branch}
                                        onChange={(e) => setFormData({...formData, branch: e.target.value})}
                                        className={inp}
                                        placeholder="Main Branch"
                                    />
                                </div>

                                {/* SWIFT Code */}
                                <div>
                                    <label className={lbl}>SWIFT Code (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.swiftCode}
                                        onChange={(e) => setFormData({...formData, swiftCode: e.target.value.toUpperCase()})}
                                        className={inp}
                                        placeholder="SBININBB123"
                                    />
                                </div>

                                {/* Nickname */}
                                <div>
                                    <label className={lbl}>Nickname (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.nickname}
                                        onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                                        className={inp}
                                        placeholder="My Business Account"
                                    />
                                </div>
                            </div>

                            {/* Bank Address */}
                            <div>
                                <label className={lbl}>Bank Address</label>
                                <textarea
                                    value={formData.bankAddress}
                                    onChange={(e) => setFormData({...formData, bankAddress: e.target.value})}
                                    className={inp}
                                    placeholder="Street, City, State, PIN"
                                    rows="2"
                                />
                            </div>

                            {/* Set as Default */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({...formData, isDefault: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Set as default payment account
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium text-sm transition-colors"
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    {saving ? 'Saving...' : (editingId ? 'Update Account' : 'Add Account')}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm transition-colors"
                                >
                                    Cancel
                                </motion.button>
                            </div>
                        </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Accounts List */}
                {!showAddForm && filteredAccounts.length > 0 && (
                    <motion.div
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: {
                                opacity: 1,
                                transition: { staggerChildren: 0.08 }
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {filteredAccounts.map((account) => (
                            <motion.div
                                key={account._id}
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    show: { opacity: 1, y: 0 }
                                }}
                                whileHover={{ y: -3, boxShadow: '0 8px 16px rgba(0,0,0,0.12)' }}
                                transition={{ duration: 0.2 }}
                                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
                            >
                                {/* Account Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {account.bankName}
                                            </h3>
                                            {account.nickname && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{account.nickname}</p>
                                            )}
                                        </div>
                                    </div>
                                    {account.isDefault && (
                                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                    )}
                                </div>

                                {/* Account Details */}
                                <div className="space-y-2 mb-4">
                                    <div className="text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Account Name:</span>
                                        <p className="font-medium text-gray-900 dark:text-white">{account.accountName}</p>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Account No:</span>
                                        <p className="font-mono font-medium text-gray-900 dark:text-white">{account.accountNo}</p>
                                    </div>
                                    <div className="text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">IFSC:</span>
                                        <p className="font-mono font-medium text-gray-900 dark:text-white">{account.ifscCode}</p>
                                    </div>
                                    {account.branch && (
                                        <div className="text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Branch:</span>
                                            <p className="font-medium text-gray-900 dark:text-white">{account.branch}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    {!account.isDefault && (
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleSetDefault(account._id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded transition-colors"
                                        >
                                            <Star size={14} />
                                            Set Default
                                        </motion.button>
                                    )}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleEdit(account)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded transition-colors"
                                    >
                                        <Edit2 size={14} />
                                        Edit
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleDelete(account._id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded transition-colors"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </motion.button>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {/* Empty State */}
                {!showAddForm && accounts.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-center py-16"
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                            <Landmark className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No bank accounts yet
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            Add your first bank account to start managing payment details
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowAddForm(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                            <Plus size={18} />
                            Add Bank Account
                        </motion.button>
                    </motion.div>
                )}

                {/* No Results */}
                {!showAddForm && accounts.length > 0 && filteredAccounts.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-center py-16"
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No accounts found
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Try adjusting your search query
                        </p>
                    </motion.div>
                )}

            </div>
        </div>
    );
};

export default BankAccountManagement;
