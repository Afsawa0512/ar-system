import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FilePlus, FileText, UserPlus, LogOut, Briefcase, X, Building2, Landmark } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const handleLogout = () => {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('user');
        window.location.href = '/';
    };

    const menuItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/add-invoice', icon: FilePlus, label: 'Add Invoice' },
        { path: '/invoices', icon: FileText, label: 'Invoices' },
        { path: '/companies', icon: Building2, label: 'Companies' },
        { path: '/bank-accounts', icon: Landmark, label: 'Bank Accounts' },
        { path: '/add-member', icon: UserPlus, label: 'Members' },
    ];

    return (
        <>
            {/* Backdrop for Mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={onClose}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 h-screen p-6 transition-transform duration-300 border-r border-slate-200 dark:border-slate-800 shadow-xl md:shadow-sm md:sticky md:top-0 md:translate-x-0 md:flex md:flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo Section */}
                <div className="mb-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/30">
                            <Briefcase size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">FinancePortal</h1>
                        </div>
                    </div>
                    {/* Close button for mobile */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-400"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1.5 overflow-y-auto">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-3">Menu</p>
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => {
                                if (window.innerWidth < 768) onClose();
                            }}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'text-gray-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
                                        <item.icon size={18} />
                                    </div>
                                    <span className="font-semibold text-sm">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Logout Button */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all w-full group"
                    >
                        <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-500/20 group-hover:bg-red-200 dark:group-hover:bg-red-500/30">
                            <LogOut size={18} />
                        </div>
                        <span className="font-semibold text-sm">Logout</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
