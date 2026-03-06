import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, Users, Clock, CheckCircle2,
    IndianRupee, FileText, AlertTriangle, ArrowUpRight, ArrowDownRight,
    BarChart3, PieChart as PieIcon, Activity
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
    Legend, RadialBarChart, RadialBar, Label
} from 'recharts';
import { useTheme } from '../context/ThemeContext';

/* ───── custom tooltip ───── */
const CustomTooltip = ({ active, payload, label, prefix = '\u20B9' }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700">
            <p className="text-xs font-bold text-gray-500 dark:text-slate-400 mb-1.5">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-xs text-gray-500 dark:text-slate-400">{p.name}:</span>
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{prefix}{Number(p.value).toLocaleString('en-IN')}</span>
                </div>
            ))}
        </div>
    );
};

const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
        <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.payload.fill }} />
                <span className="text-xs text-gray-500 dark:text-slate-400">{d.name}:</span>
                <span className="text-sm font-bold text-gray-800 dark:text-white">{d.value} invoices</span>
            </div>
        </div>
    );
};

/* ───── donut center label ───── */
const CenterLabel = ({ viewBox, value, isDark, sub }) => {
    const { cx, cy } = viewBox || {};
    if (!cx || !cy) return null;
    return (
        <g>
            <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '22px', fontWeight: 700, fill: isDark ? '#fff' : '#1f2937' }}>
                {value}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: '11px', fontWeight: 500, fill: isDark ? '#64748b' : '#9ca3af' }}>
                {sub || 'Total'}
            </text>
        </g>
    );
};

const Dashboard = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [stats, setStats] = useState({
        totalInvoices: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0,
        paidCount: 0, pendingCount: 0, overdueAmount: 0, overdueCount: 0, totalMembers: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [statusData, setStatusData] = useState([]);
    const [trendData, setTrendData] = useState([]);
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const [statsRes, trendRes, membersRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL}/api/invoices/stats`),
                    fetch(`${import.meta.env.VITE_API_URL}/api/invoices`),
                    fetch(`${import.meta.env.VITE_API_URL}/api/members`)
                ]);
                if (statsRes.ok && trendRes.ok && membersRes.ok) {
                    const sd = await statsRes.json();
                    const trendInvoices = await trendRes.json();
                    const members = await membersRes.json();

                    setStats({
                        totalInvoices: sd.totalInvoices, totalAmount: sd.totalAmount,
                        paidAmount: sd.paidAmount || 0, pendingAmount: sd.pendingAmount || sd.balanceDue || 0,
                        overdueAmount: sd.overdueAmount || 0, paidCount: sd.paidCount,
                        pendingCount: sd.pendingCount, overdueCount: sd.overdueCount || 0,
                        totalMembers: members.length
                    });
                    setLastUpdated(new Date());

                    setRevenueData([
                        { name: 'Total', amount: sd.totalAmount },
                        { name: 'Collected', amount: sd.paidAmount },
                        { name: 'Pending', amount: sd.balanceDue },
                        { name: 'Overdue', amount: sd.overdueAmount || 0 }
                    ]);

                    setStatusData([
                        { name: 'Paid', value: sd.paidCount, fill: '#10B981' },
                        { name: 'Pending', value: sd.pendingCount, fill: '#F59E0B' },
                        { name: 'Overdue', value: sd.overdueCount || 0, fill: '#EF4444' }
                    ]);

                    const invoicesArray = Array.isArray(trendInvoices) ? trendInvoices : (trendInvoices.invoices || []);

                    // Recent 5 invoices for activity feed
                    const sorted = [...invoicesArray].sort((a, b) => new Date(b.createdAt || b.invoiceDate) - new Date(a.createdAt || a.invoiceDate));
                    setRecentInvoices(sorted.slice(0, 5));

                    // Monthly trend
                    const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthlyPaid = {};
                    const monthlyTotal = {};
                    invoicesArray.forEach(inv => {
                        const dateText = inv.invoiceDate || inv.createdAt;
                        if (!dateText) return;
                        let date;
                        if (typeof dateText === 'string' && dateText.includes('-') && dateText.split('-')[0].length === 2) {
                            const [dd, mm, yyyy] = dateText.split('-');
                            date = new Date(`${yyyy}-${mm}-${dd}`);
                        } else { date = new Date(dateText); }
                        if (isNaN(date.getTime())) return;
                        const month = allMonths[date.getMonth()];
                        monthlyTotal[month] = (monthlyTotal[month] || 0) + (parseFloat(inv.total_Amount) || 0);
                        const paid = parseFloat(inv.paidAmount) || (inv.paymentStatus === 'Paid' ? (parseFloat(inv.total_Amount) || 0) : 0);
                        monthlyPaid[month] = (monthlyPaid[month] || 0) + paid;
                    });
                    const trend = allMonths
                        .filter(m => monthlyTotal[m] > 0 || monthlyPaid[m] > 0)
                        .map(m => ({ month: m, revenue: monthlyTotal[m] || 0, collected: monthlyPaid[m] || 0 }));
                    setTrendData(trend.length > 0 ? trend : [{ month: 'No Data', revenue: 0, collected: 0 }]);
                }
            } catch (error) { console.error('Dashboard error:', error); }
            finally { setIsLoading(false); }
        };
        fetchStats();
        // Auto-refresh every 30 seconds for live data
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const collectionRate = stats.totalAmount > 0 ? Math.round((stats.paidAmount / stats.totalAmount) * 100) : 0;

    const BAR_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const gridColor = isDark ? '#1e293b' : '#f1f5f9';
    const axisColor = isDark ? '#64748b' : '#94a3b8';

    const StatCard = ({ title, value, icon: Icon, color, bg, trend: trendVal, trendLabel, sub }) => (
        <motion.div
            whileHover={{ y: -4, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
            transition={{ duration: 0.2 }}
            className={`bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 group ${isLoading ? 'animate-pulse' : ''}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${bg} transition-transform group-hover:scale-110`}>
                    <Icon size={20} className={color} />
                </div>
                {trendVal !== undefined && !isLoading && (
                    <div className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold ${trendVal >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {trendVal >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(trendVal)}%
                    </div>
                )}
            </div>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 mb-1 uppercase tracking-wider">{title}</p>
            {isLoading
                ? <div className="h-8 bg-gray-100 dark:bg-slate-800 rounded-lg w-2/3 mb-1" />
                : <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</h3>}
            {sub && <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 font-medium">{sub}</p>}
        </motion.div>
    );

    return (
        <div className="p-4 sm:p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen transition-colors">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mb-6 md:mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
            >
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Financial Analytics</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">Real-time financial performance overview</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${collectionRate >= 70 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : collectionRate >= 40 ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: collectionRate >= 70 ? '#10B981' : collectionRate >= 40 ? '#F59E0B' : '#EF4444' }} />
                            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: collectionRate >= 70 ? '#10B981' : collectionRate >= 40 ? '#F59E0B' : '#EF4444' }} />
                        </span>
                        {collectionRate}% Collection Rate
                    </span>
                    {lastUpdated && (
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium hidden sm:inline">
                            Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
            </motion.div>

            {/* Stat Cards */}
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
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 mb-6 md:mb-8"
            >
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                    <StatCard title="Total Revenue" value={`\u20B9${Math.round(stats.totalAmount).toLocaleString('en-IN')}`} icon={IndianRupee} color="text-blue-600 dark:text-blue-400" bg="bg-blue-50 dark:bg-blue-500/10" sub={`${stats.totalInvoices} invoices`} />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                    <StatCard title="Collected" value={`\u20B9${Math.round(stats.paidAmount).toLocaleString('en-IN')}`} icon={CheckCircle2} color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10" sub={`${stats.paidCount} paid`} trend={collectionRate} />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                    <StatCard title="Pending Dues" value={`\u20B9${Math.round(stats.pendingAmount - (stats.overdueAmount || 0)).toLocaleString('en-IN')}`} icon={Clock} color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-500/10" sub={`${stats.pendingCount - (stats.overdueCount || 0)} invoices`} />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                    <StatCard title="Overdue" value={`\u20B9${Math.round(stats.overdueAmount || 0).toLocaleString('en-IN')}`} icon={AlertTriangle} color="text-red-600 dark:text-red-400" bg="bg-red-50 dark:bg-red-500/10" sub={`${stats.overdueCount || 0} overdue`} />
                </motion.div>
                <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                    <StatCard title="Team" value={stats.totalMembers} icon={Users} color="text-violet-600 dark:text-violet-400" bg="bg-violet-50 dark:bg-violet-500/10" sub="Active members" />
                </motion.div>
            </motion.div>

            {/* Charts Row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5 mb-6 md:mb-8"
            >

                {/* Revenue Trend — Area Chart (spans 2 cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 md:p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><Activity size={16} className="text-blue-600 dark:text-blue-400" /></div>
                            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Revenue Trend</h2>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Revenue</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Collected</span>
                        </div>
                    </div>
                    <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <RTooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gradRevenue)" dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="collected" name="Collected" stroke="#10B981" strokeWidth={2} fill="url(#gradCollected)" dot={{ r: 3, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Donut */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 md:p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-lg"><PieIcon size={16} className="text-violet-600 dark:text-violet-400" /></div>
                        <h2 className="text-sm font-bold text-gray-800 dark:text-white">Invoice Status</h2>
                    </div>
                    <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} cornerRadius={6} strokeWidth={0}>
                                    {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    <Label content={(props) => <CenterLabel {...props} value={stats.totalInvoices} isDark={isDark} />} position="center" />
                                </Pie>
                                <RTooltip content={<PieTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-5 mt-2">
                        {statusData.map(d => (
                            <div key={d.name} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-slate-400">{d.name}</span>
                                <span className="text-[11px] font-bold text-gray-800 dark:text-white">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Bottom Row */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5"
            >

                {/* Revenue Breakdown — Bar Chart (spans 2 cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 md:p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg"><BarChart3 size={16} className="text-amber-600 dark:text-amber-400" /></div>
                        <h2 className="text-sm font-bold text-gray-800 dark:text-white">Revenue Breakdown</h2>
                    </div>
                    <div className="w-full h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barSize={40} barGap={8}>
                                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11, fontWeight: 600 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 11 }} tickFormatter={v => v >= 100000 ? `${(v/100000).toFixed(1)}L` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                                <RTooltip content={<CustomTooltip />} />
                                <Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]}>
                                    {revenueData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-5 md:p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"><FileText size={16} className="text-indigo-600 dark:text-indigo-400" /></div>
                            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Recent Invoices</h2>
                        </div>
                        <a href="/invoices" className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wider">View All</a>
                    </div>
                    <div className="space-y-3">
                        {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-800" />
                                <div className="flex-1"><div className="h-3 bg-gray-100 dark:bg-slate-800 rounded w-3/4 mb-2" /><div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded w-1/2" /></div>
                            </div>
                        )) : recentInvoices.length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-8">No invoices yet</p>
                        ) : recentInvoices.map((inv, i) => {
                            const isPaid = inv.paymentStatus === 'Paid' || (inv.balance_due != null && inv.balance_due <= 0);
                            const isOverdue = !isPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
                            return (
                                <div key={inv._id || i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${isPaid ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : isOverdue ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                                        {isPaid ? <CheckCircle2 size={16} /> : isOverdue ? <AlertTriangle size={16} /> : <Clock size={16} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-800 dark:text-slate-200 truncate">{inv.companyName || inv.sellerName || inv.invoiceNumber}</p>
                                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{inv.invoiceNumber} {'\u00B7'} {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}</p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-800 dark:text-white">{'\u20B9'}{Number(inv.total_Amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
