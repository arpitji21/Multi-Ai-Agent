import { useState, useEffect, useRef } from 'react';
import {
  Users, UserCheck, Calendar, DollarSign, TrendingUp, Activity,
  FileText, Stethoscope, Brain, Download, Printer, Send,
  ArrowUpRight, ArrowDownRight, RefreshCw, ChevronUp, ChevronDown,
  BarChart2
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';

/* ── Shared dark tooltip ── */
function DarkTooltip({ active, payload, label, prefix = '', suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/95 px-3 py-2 shadow-glass backdrop-blur-xl">
      <p className="mb-1.5 text-xs font-semibold text-zinc-400">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-zinc-300">{p.name}:</span>
          <span className="font-semibold text-white">{prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat card ── */
function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400', trend }) {
  const up = trend >= 0;
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-400">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] ${color}`}>
            <Icon className="h-4.5 w-4.5" size={18} />
          </div>
          {trend != null && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
              {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sortable doctor utilization table ── */
function DoctorUtilTable({ data, loading }) {
  const [sort, setSort] = useState({ col: 'total_appointments', dir: 'desc' });
  const toggle = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  const sorted = [...data].sort((a, b) => {
    const av = parseFloat(a[sort.col] ?? 0), bv = parseFloat(b[sort.col] ?? 0);
    return sort.dir === 'asc' ? av - bv : bv - av;
  });
  const Th = ({ col, label }) => (
    <th
      onClick={() => toggle(col)}
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition"
    >
      <span className="flex items-center gap-1">
        {label}
        {sort.col === col ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} className="opacity-30" />}
      </span>
    </th>
  );
  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="shimmer-bar h-12 rounded-xl"/>)}</div>;
  if (!data.length) return <div className="py-12 text-center text-zinc-500">No doctor data available</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.07]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Doctor</th>
            <Th col="total_appointments" label="Appointments" />
            <Th col="completed" label="Completed" />
            <Th col="cancelled" label="Cancelled" />
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Completion %</th>
            <Th col="revenue" label="Revenue" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {sorted.map((doc, i) => {
            const rate = doc.total_appointments > 0 ? Math.round((doc.completed / doc.total_appointments) * 100) : 0;
            return (
              <tr key={i} className="group transition hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-200">{doc.name}</p>
                  <p className="text-xs text-zinc-500">{doc.specialization}{doc.department ? ` · ${doc.department}` : ''}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{doc.total_appointments}</td>
                <td className="px-4 py-3 text-emerald-400">{doc.completed}</td>
                <td className="px-4 py-3 text-rose-400">{doc.cancelled}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400">{rate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-400">
                  ${parseFloat(doc.revenue || 0).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── AI Chat Panel ── */
function AIChatPanel({ analyticsContext }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your Admin Analytics AI. Ask me anything — 'Show revenue trends', 'Which department performs best?', 'What's the appointment cancellation rate?', or any hospital data question." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const QUICK = ['Revenue this month', 'Top performing department', 'Appointment trends', 'Doctor utilization summary'];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: msg,
        context: {
          type: 'admin_analytics',
          stats: analyticsContext?.stats,
          revenue_history: analyticsContext?.revenue_history?.slice(-6),
          department_performance: analyticsContext?.department_performance?.slice(0, 5),
        },
      });
      setMessages(m => [...m, { role: 'ai', text: res.data.reply || 'No response from AI.' }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'AI analytics assistant is temporarily unavailable. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient">
          <Brain className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="section-title text-base">AI Analytics Assistant</h2>
          <p className="text-xs text-zinc-500">Ask natural-language questions about hospital data</p>
        </div>
      </div>

      <div className="mb-3 h-72 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${m.role === 'ai' ? 'bg-brand-gradient text-white' : 'bg-white/10 text-zinc-300'}`}>
                {m.role === 'ai' ? 'AI' : 'A'}
              </div>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'ai' ? 'rounded-tl-none border border-white/10 bg-white/5 text-zinc-300' : 'rounded-tr-none bg-brand-gradient text-white'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white">AI</div>
              <div className="flex items-center gap-1.5 rounded-xl rounded-tl-none border border-white/10 bg-white/5 px-4 py-2.5">
                {[0,1,2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} disabled={loading} className="btn-ghost btn-sm">{q}</button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder='Ask: "Which doctor has the highest revenue?"'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [utilization, setUtilization] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setChartsLoading(true);
    try {
      const [ovRes, trendRes, utilRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/analytics/appointment-trends'),
        api.get('/analytics/doctor-utilization'),
      ]);
      setOverview(ovRes.data);
      setTrends(trendRes.data || []);
      setUtilization(utilRes.data || []);
    } catch (err) {
      console.error('Admin analytics load error', err);
    } finally {
      setLoading(false);
      setChartsLoading(false);
    }
  }

  function exportJSON() {
    setExporting(true);
    try {
      const blob = new Blob([JSON.stringify({ overview, trends, utilization }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediai-analytics-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  function exportCSV() {
    const rows = [['Department', 'Appointments', 'Revenue']];
    (overview?.department_performance || []).forEach(d => {
      rows.push([d.name, d.appointments, parseFloat(d.revenue || 0).toFixed(2)]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediai-departments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = overview?.stats || {};
  const revenueHistory = (overview?.revenue_history || []).map(r => ({
    ...r,
    revenue: parseFloat(r.revenue || 0),
  }));
  const deptPerf = (overview?.department_performance || []).slice(0, 8).map(d => ({
    ...d,
    revenue: parseFloat(d.revenue || 0),
    appointments: parseInt(d.appointments || 0),
  }));
  const trendData = trends.map(t => ({
    ...t,
    total: parseInt(t.total || 0),
    completed: parseInt(t.completed || 0),
    cancelled: parseInt(t.cancelled || 0),
  }));

  const prevMonthRevenue = revenueHistory.length >= 2 ? revenueHistory[revenueHistory.length - 2].revenue : 0;
  const thisMonthRevenue = revenueHistory.length >= 1 ? revenueHistory[revenueHistory.length - 1].revenue : stats.monthly_revenue || 0;
  const revenueGrowth = prevMonthRevenue > 0 ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : null;

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Admin <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="mt-1 text-zinc-400">Hospital analytics & management · MediAI Suite</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} disabled={loading} className="btn-ghost btn-sm gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={exportCSV} className="btn-ghost btn-sm gap-1.5">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportJSON} disabled={exporting} className="btn-ghost btn-sm gap-1.5">
            <Download size={14} /> JSON
          </button>
          <button onClick={() => window.print()} className="btn-ghost btn-sm gap-1.5">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* 7 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard icon={Users} label="Total Patients" value={loading ? '—' : stats.total_patients ?? 0} color="text-blue-400" trend={12} />
        <StatCard icon={Stethoscope} label="Total Doctors" value={loading ? '—' : stats.total_doctors ?? 0} color="text-purple-400" />
        <StatCard icon={Calendar} label="Today's Appts" value={loading ? '—' : stats.today_appointments ?? 0} color="text-brand-400" />
        <StatCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={loading ? '—' : `$${(stats.monthly_revenue ?? 0).toLocaleString()}`}
          color="text-emerald-400"
          trend={revenueGrowth}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue Growth"
          value={loading ? '—' : revenueGrowth != null ? `${revenueGrowth > 0 ? '+' : ''}${revenueGrowth}%` : 'N/A'}
          color={revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          sub="vs last month"
        />
        <StatCard icon={UserCheck} label="Active Doctors" value={loading ? '—' : stats.active_doctors ?? 0} color="text-amber-400" />
        <StatCard icon={FileText} label="Reports Today" value={loading ? '—' : stats.today_reports ?? 0} color="text-cyan-400" />
      </div>

      {/* Charts Row 1: Revenue + Appointment Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Area Chart */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={18} />
              Revenue Trend
            </h2>
            <span className="text-xs text-zinc-500">Last 12 months</span>
          </div>
          {chartsLoading ? (
            <div className="shimmer-bar h-48 rounded-xl" />
          ) : revenueHistory.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <BarChart2 className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Revenue data will appear after payments are recorded</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<DarkTooltip prefix="$" />} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Appointment Trends Line Chart */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="text-blue-400" size={18} />
              Appointment Trends
            </h2>
            <span className="text-xs text-zinc-500">Last 3 months (weekly)</span>
          </div>
          {chartsLoading ? (
            <div className="shimmer-bar h-48 rounded-xl" />
          ) : trendData.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Activity className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Appointment trend data will appear as appointments are booked</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2: Department Bar + Cancellation Rate */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department Revenue Bar Chart */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <BarChart2 className="text-brand-400" size={18} />
              Department Revenue
            </h2>
            <span className="text-xs text-zinc-500">All departments</span>
          </div>
          {chartsLoading ? (
            <div className="shimmer-bar h-48 rounded-xl" />
          ) : deptPerf.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <BarChart2 className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Department data will appear after appointments are completed</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptPerf} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<DarkTooltip prefix="$" />} />
                <Bar dataKey="revenue" name="Revenue" fill="#ED2024" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cancellation Rate Chart */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Calendar className="text-amber-400" size={18} />
              Cancellation Rate
            </h2>
            <span className="text-xs text-zinc-500">Weekly view</span>
          </div>
          {chartsLoading ? (
            <div className="shimmer-bar h-48 rounded-xl" />
          ) : trendData.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Calendar className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Cancellation data will appear as appointments are tracked</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                <Bar dataKey="cancelled" name="Cancelled" fill="#f43f5e" radius={[0, 0, 0, 0]} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Doctor Utilization Table */}
      <div className="glass-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Stethoscope className="text-purple-400" size={18} />
            Doctor Utilization
          </h2>
          <span className="text-xs text-zinc-500">{utilization.length} doctor{utilization.length !== 1 ? 's' : ''} · click headers to sort</span>
        </div>
        <DoctorUtilTable data={utilization} loading={chartsLoading} />
      </div>

      {/* AI Analytics Chat */}
      <AIChatPanel analyticsContext={overview} />
    </div>
  );
}
