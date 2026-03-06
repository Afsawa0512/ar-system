import React, { useState, useEffect } from 'react';
import { UserPlus, Mail, Phone, Shield, Power, Edit2, Trash2, Search, X, Check, MoreVertical, Plus, Users, AlertCircle } from 'lucide-react';

const AddMember = () => {
    const [members, setMembers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        role: 'Member',
        status: 'Active'
    });
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchMembers();
    }, []);

    const addToast = (type, text) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, type, text }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    };

    const fetchMembers = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members`);
            if (response.ok) {
                const data = await response.json();
                setMembers(data);
            }
        } catch (error) {
            console.error('Error fetching members:', error);
            addToast('error', 'Failed to load team members');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const url = editingId
            ? `${import.meta.env.VITE_API_URL}/api/members/${editingId}`
            : `${import.meta.env.VITE_API_URL}/api/members`;

        const method = editingId ? 'PUT' : 'POST';

        const payload = { ...formData };
        if (editingId && !payload.password) {
            delete payload.password;
        }

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                addToast('success', editingId ? 'Member details updated successfully!' : 'New member registered successfully!');
                resetForm();
                setShowModal(false);
                fetchMembers();
            } else {
                addToast('error', data.message || 'Operation failed');
            }
        } catch (error) {
            addToast('error', 'Connection error. Is the server running?');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            username: '',
            password: '',
            phone: '',
            role: 'Member',
            status: 'Active'
        });
        setEditingId(null);
    };

    const handleEdit = (member) => {
        setEditingId(member._id);
        setFormData({
            name: member.name,
            email: member.email,
            username: member.username,
            password: '',
            phone: member.phone,
            role: member.role,
            status: member.status
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this member?')) return;

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members/${id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                addToast('success', 'Member removed from team');
                fetchMembers();
            }
        } catch (error) {
            addToast('error', 'Failed to delete member');
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Toast Container */}
            <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-3">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-4 p-5 rounded-2xl shadow-xl border backdrop-blur-md animate-in slide-in-from-right-full duration-300 min-w-[340px] ${toast.type === 'success'
                            ? 'bg-white/90 dark:bg-slate-900/90 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                            : 'bg-white/90 dark:bg-slate-900/90 border-rose-100 dark:border-rose-500/20 text-rose-800 dark:text-rose-200'
                            }`}
                    >
                        <div className={`p-2 rounded-xl ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                            {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                        </div>
                        <div className="flex-1">
                            <p className="font-bold text-[13px]">{toast.type === 'success' ? 'Success' : 'Attention'}</p>
                            <p className="text-xs font-medium opacity-80 mt-0.5 leading-relaxed">{toast.text}</p>
                        </div>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors opacity-40 hover:opacity-100"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 md:mb-16">
                <div className="text-center lg:text-left space-y-1">
                    <div className="flex items-center justify-center lg:justify-start gap-3 mb-1">
                        <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
                            <Users size={22} />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Team Members</h1>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto lg:mx-0 leading-relaxed">
                        Manage team access, roles, and profile security details.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Simplified search */}
                    <div className="relative group w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-all" size={17} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-sm w-full shadow-sm transition-all outline-none dark:text-slate-200"
                        />
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true); }}
                        className="group relative flex items-center justify-center gap-2.5 px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 text-sm w-full sm:w-auto overflow-hidden"
                    >
                        {/* Light sweep effect */}
                        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                        <UserPlus size={18} className="group-hover:rotate-12 transition-transform duration-300" />
                        Add Member
                    </button>
                </div>
            </div>

            {/* Simplified Table Layout */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[11px] font-bold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                                <th className="px-8 py-5 text-left">Member Profile</th>
                                <th className="px-8 py-5 text-left">Security & Access</th>
                                <th className="px-8 py-5 text-left">Status</th>
                                <th className="px-8 py-5 text-right pr-12">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filteredMembers.length > 0 ? filteredMembers.map((member) => (
                                <tr key={member._id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-all duration-200">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold text-xl shadow-inner">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 ${member.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 dark:text-white text-base leading-none mb-1.5 transition-colors">{member.name}</p>
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">@{member.username}</span>
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Mail size={11} />
                                                        {member.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-2.5">
                                            <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg w-fit border ${member.role === 'Admin' ? 'bg-purple-50 border-purple-100 text-purple-700 dark:bg-purple-900/20 dark:border-purple-500/30 dark:text-purple-300' :
                                                member.role === 'Manager' ? 'bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500/30 dark:text-blue-300' :
                                                    'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                                }`}>
                                                <Shield size={12} />
                                                <span className="text-[11px] font-bold uppercase tracking-wide">{member.role}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 ml-0.5">
                                                <Phone size={11} />
                                                {member.phone}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${member.status === 'Active'
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right pr-12">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(member)}
                                                className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl transition-all"
                                                title="Edit Member"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(member._id)}
                                                className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                                                title="Delete Member"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Users size={54} />
                                            <p className="font-bold text-lg">No team members found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Simplified Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowModal(false)} />
                    <div className="relative bg-white dark:bg-slate-950 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]">

                        {/* Modal Header */}
                        <div className="px-8 py-7 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${editingId ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
                                    {editingId ? <Edit2 size={20} /> : <UserPlus size={20} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {editingId ? 'Edit Team Member' : 'Add New Member'}
                                    </h2>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">Enter account and contact details</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <form onSubmit={handleSubmit} id="member-form" className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <div className="space-y-1.5 md:col-span-2">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Full Identity</label>
                                        <input
                                            type="text" name="name" value={formData.name} onChange={handleChange} required
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-slate-900 dark:text-white transition-all outline-none"
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Username</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                                            <input
                                                type="text" name="username" value={formData.username} onChange={handleChange} required
                                                className="w-full pl-9 pr-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-slate-900 dark:text-white transition-all outline-none"
                                                placeholder="username"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Secure Password</label>
                                        <input
                                            type="password" name="password" value={formData.password} onChange={handleChange}
                                            required={!editingId}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-slate-900 dark:text-white transition-all outline-none placeholder:text-slate-400"
                                            placeholder={editingId ? "Leave empty to keep" : "Create password"}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Email Address</label>
                                        <input
                                            type="email" name="email" value={formData.email} onChange={handleChange} required
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-slate-900 dark:text-white transition-all outline-none"
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Phone Number</label>
                                        <input
                                            type="text" name="phone" value={formData.phone} onChange={handleChange} required
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 font-medium text-slate-900 dark:text-white transition-all outline-none"
                                            placeholder="+91"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Team Role</label>
                                        <select name="role" value={formData.role} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-medium text-slate-900 dark:text-white cursor-pointer">
                                            <option value="Member">Member</option>
                                            <option value="Manager">Manager</option>
                                            <option value="Admin">Administrator</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1 uppercase tracking-wider">Access Status</label>
                                        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 outline-none font-medium text-slate-900 dark:text-white cursor-pointer">
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 shrink-0">
                            <button
                                type="submit" form="member-form" disabled={loading}
                                className={`flex-1 py-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                                    } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {editingId ? 'Update Details' : 'Register Member'}
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-10 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddMember;
