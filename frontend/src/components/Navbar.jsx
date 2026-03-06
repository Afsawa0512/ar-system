import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Search, Sun, Moon, Monitor, Menu, X, CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Navbar = ({ onMenuClick }) => {
    const { theme, mode, setThemeMode } = useTheme();
    const [user, setUser] = useState({ name: 'Guest', role: 'Unknown Role' });

    // Theme menu
    const [showThemeMenu, setShowThemeMenu] = useState(false);
    const themeRef = useRef(null);

    // Notifications
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifsLoading, setNotifsLoading] = useState(false);
    const notifsRef = useRef(null);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
            try { setUser(JSON.parse(storedUser)); } catch {}
        }
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (themeRef.current && !themeRef.current.contains(e.target)) setShowThemeMenu(false);
            if (notifsRef.current && !notifsRef.current.contains(e.target)) setShowNotifs(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch notifications (recent invoices for activity)
    const fetchNotifications = async () => {
        setNotifsLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invoices`);
            if (res.ok) {
                const data = await res.json();
                const invoices = Array.isArray(data) ? data : (data.invoices || []);
                const sorted = [...invoices].sort((a, b) => new Date(b.createdAt || b.invoiceDate) - new Date(a.createdAt || a.invoiceDate));
                const recent = sorted.slice(0, 8).map(inv => {
                    const isPaid = inv.paymentStatus === 'Paid' || (inv.balance_due != null && inv.balance_due <= 0);
                    const isOverdue = !isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
                    let type = 'pending';
                    let message = `Invoice ${inv.invoiceNumber || ''} is pending`;
                    let icon = Clock;
                    let color = 'text-amber-500';
                    let bg = 'bg-amber-50 dark:bg-amber-500/10';
                    if (isPaid) {
                        type = 'paid';
                        message = `${inv.companyName || inv.invoiceNumber || 'Invoice'} \u2014 Payment received`;
                        icon = CheckCircle2;
                        color = 'text-emerald-500';
                        bg = 'bg-emerald-50 dark:bg-emerald-500/10';
                    } else if (isOverdue) {
                        type = 'overdue';
                        message = `${inv.companyName || inv.invoiceNumber || 'Invoice'} \u2014 Payment overdue!`;
                        icon = AlertTriangle;
                        color = 'text-red-500';
                        bg = 'bg-red-50 dark:bg-red-500/10';
                    } else {
                        message = `${inv.companyName || inv.invoiceNumber || 'Invoice'} \u2014 Awaiting payment`;
                    }
                    const timeAgo = getTimeAgo(inv.createdAt || inv.invoiceDate);
                    return { id: inv._id, type, message, icon, color, bg, amount: inv.total_Amount || 0, time: timeAgo, invoiceNumber: inv.invoiceNumber };
                });
                setNotifications(recent);
                // Count overdue + recent pending as "unread"
                const unread = recent.filter(n => n.type === 'overdue' || n.type === 'pending').length;
                setUnreadCount(unread);
            }
        } catch (err) { console.error('Notification fetch error:', err); }
        finally { setNotifsLoading(false); }
    };

    useEffect(() => { fetchNotifications(); }, []);

    const getTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const markAllRead = () => { setUnreadCount(0); };

    const themeModes = [
        { key: 'light', label: 'Light', icon: Sun, desc: 'Always light' },
        { key: 'dark', label: 'Dark', icon: Moon, desc: 'Always dark' },
        { key: 'system', label: 'System', icon: Monitor, desc: 'Follow OS' },
    ];

    const CurrentThemeIcon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;

    return (
        <div className="bg-white dark:bg-slate-900 h-16 px-4 md:px-8 flex items-center justify-between shadow-sm border-b border-gray-100 dark:border-slate-800 transition-colors duration-300">
            <div className="flex items-center gap-4 flex-1">
                <button onClick={onMenuClick} className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-600 dark:text-slate-400">
                    <Menu size={24} />
                </button>
                <div className="relative w-full max-w-xs md:max-w-md lg:max-w-lg">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 w-full text-sm outline-none transition-all dark:text-slate-200 dark:placeholder-slate-500" />
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 ml-4">

                {/* Theme Switcher */}
                <div ref={themeRef} className="relative">
                    <button onClick={() => setShowThemeMenu(p => !p)}
                        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                        title={`Theme: ${mode}`}>
                        <CurrentThemeIcon size={18} />
                    </button>
                    {showThemeMenu && (
                        <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-100 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                            <p className="px-3.5 py-2 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Appearance</p>
                            {themeModes.map(t => (
                                <button key={t.key} onClick={() => { setThemeMode(t.key); setShowThemeMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${mode === t.key ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                                    <div className={`p-1.5 rounded-lg ${mode === t.key ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-gray-100 dark:bg-slate-800'}`}>
                                        <t.icon size={14} className={mode === t.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'} />
                                    </div>
                                    <div>
                                        <p className={`text-xs font-semibold ${mode === t.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'}`}>{t.label}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">{t.desc}</p>
                                    </div>
                                    {mode === t.key && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notification Bell */}
                <div ref={notifsRef} className="relative">
                    <button onClick={() => { setShowNotifs(p => !p); if (!showNotifs) fetchNotifications(); }}
                        className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200">
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-white dark:border-slate-900">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                    {showNotifs && (
                        <div className="absolute right-0 top-12 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Notifications</h3>
                                    {unreadCount > 0 && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold rounded-md">{unreadCount}</span>}
                                </div>
                                {unreadCount > 0 && (
                                    <button onClick={markAllRead} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider">
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            {/* List */}
                            <div className="max-h-80 overflow-y-auto">
                                {notifsLoading ? (
                                    <div className="p-6 flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-blue-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Bell size={24} className="mx-auto text-gray-300 dark:text-slate-700 mb-2" />
                                        <p className="text-xs text-gray-400 dark:text-slate-500">No notifications</p>
                                    </div>
                                ) : notifications.map((n, i) => {
                                    const NIcon = n.icon;
                                    return (
                                        <div key={n.id || i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${n.bg}`}>
                                                <NIcon size={14} className={n.color} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 leading-relaxed">{n.message}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">{n.time}</span>
                                                    {n.amount > 0 && <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">{'\u20B9'}{Number(n.amount).toLocaleString('en-IN')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Footer */}
                            {notifications.length > 0 && (
                                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20">
                                    <a href="/invoices" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider flex items-center justify-center gap-1">
                                        <FileText size={10} /> View all invoices
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* User */}
                <div className="flex items-center gap-3 md:border-l md:border-gray-100 md:dark:border-slate-800 md:pl-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-gray-800 dark:text-slate-200">{user.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{user.role}</p>
                    </div>
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 text-sm md:text-base font-bold">
                        {user.name ? user.name.charAt(0).toUpperCase() : <User size={20} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Navbar;
