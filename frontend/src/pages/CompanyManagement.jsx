import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Download, Plus, Search, Trash2, Edit2, Mail, Phone, Building2, User, X, Check, AlertCircle, FileDown } from 'lucide-react';

const CompanyManagement = () => {
    const [companies, setCompanies] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [replaceAll, setReplaceAll] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [toast, setToast] = useState(null);
    const [formData, setFormData] = useState({
        companyName: '',
        email: '',
        contactPerson: '',
        ccEmails: '',
        phone: '',
        department: ''
    });

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies?search=${encodeURIComponent(searchTerm)}`);
            if (response.ok) {
                const data = await response.json();
                setCompanies(data.contacts);
            }
        } catch (error) {
            console.error('Error fetching companies:', error);
            showToast('Failed to load companies', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCompanies();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleFileChange = (e) => {
        setUploadFile(e.target.files[0]);
        setUploadResult(null);
    };

    const handleUpload = async () => {
        if (!uploadFile) {
            showToast('Please select a file', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('replaceAll', replaceAll);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                setUploadResult(data.results);
                showToast(`Successfully processed! Added: ${data.results.added}, Updated: ${data.results.updated}`, 'success');
                fetchCompanies();
                setTimeout(() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setUploadResult(null);
                }, 3000);
            } else {
                showToast(data.message || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast('Failed to upload file', 'error');
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies/template/download`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'company_contacts_template.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Template downloaded successfully', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Failed to download template', 'error');
        }
    };

    const handleAddCompany = async () => {
        try {
            // Parse CC emails (support comma, semicolon, and newline separators)
            const ccEmailsArray = formData.ccEmails 
                ? formData.ccEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e && e.includes('@')) 
                : [];

            const payload = {
                ...formData,
                ccEmails: ccEmailsArray
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast('Company added successfully', 'success');
                fetchCompanies();
                setShowAddModal(false);
                setFormData({ companyName: '', email: '', contactPerson: '', ccEmails: '', phone: '', department: '' });
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to add company', 'error');
            }
        } catch (error) {
            console.error('Add error:', error);
            showToast('Failed to add company', 'error');
        }
    };

    const handleUpdateCompany = async () => {
        try {
            // Parse CC emails (support comma, semicolon, and newline separators)
            const ccEmailsArray = formData.ccEmails 
                ? formData.ccEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e && e.includes('@')) 
                : [];

            const payload = {
                ...formData,
                ccEmails: ccEmailsArray
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies/${editingCompany._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showToast('Company updated successfully', 'success');
                fetchCompanies();
                setEditingCompany(null);
                setFormData({ companyName: '', email: '', contactPerson: '', ccEmails: '', phone: '', department: '' });
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to update company', 'error');
            }
        } catch (error) {
            console.error('Update error:', error);
            showToast('Failed to update company', 'error');
        }
    };

    const handleDeleteCompany = async (id) => {
        if (!window.confirm('Are you sure you want to delete this company?')) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/companies/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Company deleted successfully', 'success');
                fetchCompanies();
            } else {
                showToast('Failed to delete company', 'error');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete company', 'error');
        }
    };

    const openEditModal = (company) => {
        setEditingCompany(company);
        setFormData({
            companyName: company.companyName,
            email: company.email,
            contactPerson: company.contactPerson || '',
            ccEmails: (company.ccEmails || []).join('\n'), // Join with newlines for better viewing
            phone: company.phone || '',
            department: company.department || ''
        });
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto dark:bg-slate-950 min-h-screen transition-colors duration-500">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] flex items-start gap-3 px-5 py-4 rounded-2xl shadow-xl border text-sm font-semibold max-w-sm transition-all duration-300 ${
                    toast.type === 'success' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800'
                }`}>
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-rose-100 dark:bg-rose-900'}`}>
                        {toast.type === 'success' ? <Check size={11} className="text-emerald-600 dark:text-emerald-400" /> : <X size={11} className="text-rose-600 dark:text-rose-400" />}
                    </div>
                    <span className="leading-snug">{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 text-slate-300 hover:text-slate-500 mt-0.5 shrink-0"><X size={13} /></button>
                </div>
            )}

            {/* Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Company Contacts</h1>
                    <p className="text-slate-500 text-sm font-medium">Manage customer email addresses & CC recipients</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={handleDownloadTemplate} className="flex items-center gap-2.5 px-5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:border-slate-300 dark:hover:border-slate-600 transition-all text-sm shadow-sm">
                        <FileDown size={18} />
                        <span>Download Template</span>
                    </button>
                    <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2.5 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all text-sm shadow-md">
                        <Upload size={18} />
                        <span>Upload CSV</span>
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2.5 px-5 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-bold hover:bg-black dark:hover:bg-slate-700 transition-all text-sm shadow-md">
                        <Plus size={18} />
                        <span>Add Company</span>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" size={18} />
                    <input type="text" placeholder="Search companies..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-slate-400 w-full text-[13px] outline-none dark:text-slate-200 transition-all shadow-sm" />
                </div>
            </div>

            {/* Companies Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Company Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact Person</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">CC Recipients</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest animate-pulse">Loading...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : companies.length > 0 ? (
                                companies.map((company) => (
                                    <tr key={company._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                                                    <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-semibold text-slate-900 dark:text-white">{company.companyName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <Mail size={14} />
                                                <span>{company.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <User size={14} />
                                                <span>{company.contactPerson || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {company.ccEmails && company.ccEmails.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {company.ccEmails.map((email, idx) => (
                                                        <span key={idx} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-xs font-medium">{email}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm">No CC</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                                <Phone size={14} />
                                                <span>{company.phone || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openEditModal(company)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-xl transition-all">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteCompany(company._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-xl transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                                <Building2 size={32} className="opacity-20" />
                                            </div>
                                            <div>
                                                <p className="font-medium mb-1">No companies found</p>
                                                <p className="text-sm">Upload a CSV file or add companies manually</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Upload Company CSV</h2>
                            <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
                                <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                                <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csvUpload" />
                                <label htmlFor="csvUpload" className="cursor-pointer">
                                    <span className="text-blue-600 hover:text-blue-700 font-semibold">Choose CSV file</span>
                                    <p className="text-sm text-slate-500 mt-2">or drag and drop here</p>
                                </label>
                                {uploadFile && <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">Selected: {uploadFile.name}</p>}
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                <AlertCircle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                <div className="text-sm">
                                    <p className="font-semibold text-amber-900 dark:text-amber-100 mb-1">CSV Format Required:</p>
                                    <p className="text-amber-700 dark:text-amber-300">companyName, email, contactPerson, cc, phone, department</p>
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} className="w-5 h-5 rounded border-slate-300" />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Replace all existing companies</span>
                            </label>

                            {uploadResult && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                    <p className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Upload Results:</p>
                                    <ul className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                                        <li>✓ Added: {uploadResult.added}</li>
                                        <li>✓ Updated: {uploadResult.updated}</li>
                                        {uploadResult.failed > 0 && <li>✗ Failed: {uploadResult.failed}</li>}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setShowUploadModal(false)} className="flex-1 px-6 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleUpload} disabled={!uploadFile} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    Upload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {(showAddModal || editingCompany) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{editingCompany ? 'Edit Company' : 'Add Company'}</h2>
                            <button onClick={() => { setShowAddModal(false); setEditingCompany(null); setFormData({ companyName: '', email: '', contactPerson: '', ccEmails: '', phone: '', department: '' }); }}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Company Name *</label>
                                <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors" required />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email *</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors" required />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Contact Person</label>
                                <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    CC Recipients (Multiple Emails)
                                </label>
                                <textarea 
                                    value={formData.ccEmails} 
                                    onChange={(e) => setFormData({ ...formData, ccEmails: e.target.value })}
                                    placeholder="manager@company.com&#10;ceo@company.com&#10;finance@company.com"
                                    rows="3"
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                                />
                                <p className="text-xs text-slate-500 mt-1.5 flex items-start gap-1.5">
                                    <Mail size={12} className="mt-0.5 shrink-0" />
                                    <span>Enter each email on a new line, or separate with commas/semicolons. All will receive invoice copies.</span>
                                </p>
                                {formData.ccEmails && formData.ccEmails.trim() && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {formData.ccEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e).map((email, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md text-xs font-medium">
                                                <Mail size={10} />
                                                {email}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone</label>
                                    <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Department</label>
                                    <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 transition-colors" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button onClick={() => { setShowAddModal(false); setEditingCompany(null); setFormData({ companyName: '', email: '', contactPerson: '', ccEmails: '', phone: '', department: '' }); }}
                                    className="flex-1 px-6 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    Cancel
                                </button>
                                <button onClick={editingCompany ? handleUpdateCompany : handleAddCompany} disabled={!formData.companyName || !formData.email}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {editingCompany ? 'Update' : 'Add'} Company
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyManagement;
