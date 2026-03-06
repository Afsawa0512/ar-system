import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, User, Lock, ArrowRight, ShieldCheck, Zap, Globe, Sparkles } from 'lucide-react';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/members/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('isAuthenticated', 'true');
                sessionStorage.setItem('user', JSON.stringify(data.user));
                navigate('/dashboard');
            } else {
                setError(data.message || 'Invalid credentials');
            }
        } catch (err) {
            setError('Connection error. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center p-6 overflow-hidden font-inter bg-gray-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Immersive Background Elements */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-100 dark:bg-blue-600/10 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-100 dark:bg-indigo-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-purple-50 dark:bg-purple-600/5 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>

                {/* Thin grid overlay */}
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }}>
                </div>
            </div>

            {/* Glassmorphism Card */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="relative z-10 w-full max-w-[480px]"
            >
                <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white dark:border-white/5 rounded-[40px] shadow-2xl shadow-blue-500/10 dark:shadow-none overflow-hidden p-8 md:p-12">

                    {/* Header */}
                    <div className="text-center space-y-4 mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20 mb-2">
                            <IndianRupee className="text-white" size={32} />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-outfit">FinancePortal</h1>
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Welcome back to your workspace</p>
                        </div>
                    </div>

                    {/* Error Display */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="mb-8 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl text-center"
                            >
                                <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold">{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-500 ml-1 font-outfit">Username</label>
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-600/5 rounded-2xl text-slate-900 dark:text-white font-semibold outline-none transition-all placeholder:text-slate-400 shadow-sm"
                                    placeholder="Enter username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-500 ml-1 font-outfit">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-blue-600/5 rounded-2xl text-slate-900 dark:text-white font-semibold outline-none transition-all placeholder:text-slate-400 shadow-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4.5 rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/10 mt-4 disabled:opacity-70 disabled:cursor-not-allowed group font-outfit"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Enter Portal
                                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Features Snippet */}
                    <div className="mt-12 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-center gap-6 text-[10px] font-semibold text-slate-400 font-outfit">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={14} className="text-blue-500" />
                            Secure
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-400" />
                            Premium
                        </div>
                        <div className="flex items-center gap-2">
                            <Globe size={14} className="text-purple-400" />
                            Fast
                        </div>
                    </div>
                </div>

                {/* Footer Copy */}
                <p className="mt-8 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide">
                    &copy; 2026 FinancePortal Systems. All Rights Reserved.
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
