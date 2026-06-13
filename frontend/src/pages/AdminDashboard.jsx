import { useState, useEffect, useRef } from 'react';
import {
  Users, UserCheck, Calendar, DollarSign, TrendingUp, Activity,
  FileText, Stethoscope, Brain, Download, Printer, Send,
  ArrowUpRight, ArrowDownRight, RefreshCw, ChevronUp, ChevronDown,
  BarChart2, CheckCircle, XCircle
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

/* ── Date-range pill selector ── */
function RangePicker({ value, onChange }) {
  const opts = [
    { label: '1M', value: 1 },
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '12M', value: 12 },
  ];
  return (
    <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
      {opts.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${value === o.value ? 'bg-brand-gradient text-white shadow-glass' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          {o.label}
        </button>
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
            <Icon size={18} />
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

/* ── Doctor utilization table with active-status column ── */
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
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
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
                <td className="px-4 py-3">
                  {doc.available ? (
                    <span className="badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                      <CheckCircle size={10} /> Active
                    </span>
                  ) : (
                    <span className="badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400">
                      <XCircle size={10} /> Offline
                    </span>
                  )}
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

/* ── Mini inline chart for AI responses ── */
function MiniChart({ data, type = 'bar' }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <ResponsiveContainer width="100%" height={100}>
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }} barSize={12}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="value" name="Value" fill="#ED2024" radius={[3, 3, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<DarkTooltip />} />
            <Line type="monotone" dataKey="value" name="Value" stroke="#10b981" strokeWidth={1.5} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ── Detect chart context from query + analytics data ── */
function buildChartForQuery(query, analyticsContext) {
  const q = query.toLowerCase();
  if ((q.includes('revenue') || q.includes('earning')) && analyticsContext?.revenue_history?.length) {
    return {
      data: analyticsContext.revenue_history.slice(-6).map(r => ({ name: r.month, value: parseFloat(r.revenue || 0) })),
      type: 'bar',
    };
  }
  if ((q.includes('department') || q.includes('dept')) && analyticsContext?.department_performance?.length) {
    return {
      data: analyticsContext.department_performance.slice(0, 6).map(d => ({ name: d.name, value: parseFloat(d.revenue || 0) })),
      type: 'bar',
    };
  }
  if (q.includes('appointment') || q.includes('trend')) {
    return null;
  }
  return null;
}

/* ── Period-based export ── */
function buildPeriodCSV(overview, trends, utilization, period) {
  const now = new Date();
  const rows = [];

  if (period === 'weekly') {
    rows.push(['=== Weekly Appointment Report ===', `Generated: ${now.toISOString().split('T')[0]}`]);
    rows.push(['']);
    rows.push(['Week', 'Total Appointments', 'Completed', 'Cancelled']);
    const weekData = trends.slice(-4);
    weekData.forEach(t => rows.push([t.week, t.total, t.completed, t.cancelled]));
  } else if (period === 'monthly') {
    rows.push(['=== Monthly Analytics Report ===', `Generated: ${now.toISOString().split('T')[0]}`]);
    rows.push(['']);
    rows.push(['Metric', 'Value']);
    const s = overview?.stats || {};
    rows.push(['Total Patients', s.total_patients ?? 0]);
    rows.push(['Total Doctors', s.total_doctors ?? 0]);
    rows.push(['Active Doctors', s.active_doctors ?? 0]);
    rows.push(['Monthly Revenue ($)', s.monthly_revenue ?? 0]);
    rows.push(['Today Appointments', s.today_appointments ?? 0]);
    rows.push(['']);
    rows.push(['Month', 'Revenue ($)']);
    (overview?.revenue_history || []).slice(-3).forEach(r => rows.push([r.month, parseFloat(r.revenue || 0).toFixed(2)]));
    rows.push(['']);
    rows.push(['Department', 'Appointments', 'Revenue ($)']);
    (overview?.department_performance || []).forEach(d => rows.push([d.name, d.appointments, parseFloat(d.revenue || 0).toFixed(2)]));
  } else if (period === 'quarterly') {
    rows.push(['=== Quarterly Analytics Report ===', `Generated: ${now.toISOString().split('T')[0]}`]);
    rows.push(['']);
    rows.push(['Doctor', 'Specialization', 'Department', 'Active', 'Total Appts', 'Completed', 'Cancelled', 'Completion %', 'Revenue ($)']);
    utilization.forEach(doc => {
      const rate = doc.total_appointments > 0 ? Math.round((doc.completed / doc.total_appointments) * 100) : 0;
      rows.push([doc.name, doc.specialization || '', doc.department || '', doc.available ? 'Yes' : 'No', doc.total_appointments, doc.completed, doc.cancelled, `${rate}%`, parseFloat(doc.revenue || 0).toFixed(2)]);
    });
    rows.push(['']);
    rows.push(['Last 12 Weeks of Appointments']);
    rows.push(['Week', 'Total', 'Completed', 'Cancelled']);
    trends.slice(-12).forEach(t => rows.push([t.week, t.total, t.completed, t.cancelled]));
  }

  return rows.map(r => r.join(',')).join('\n');
}

/* ── AI Chat Panel ── */
function AIChatPanel({ analyticsContext }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your Admin Analytics AI. Ask me anything — 'Show revenue trends', 'Which department performs best?', 'What's the appointment cancellation rate?', or any hospital data question.", chart: null }
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
    setMessages(m => [...m, { role: 'user', text: msg, chart: null }]);
    setLoading(true);
    const chartPayload = buildChartForQuery(msg, analyticsContext);
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
      setMessages(m => [...m, { role: 'ai', text: res.data.reply || 'No response from AI.', chart: chartPayload }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'AI analytics assistant is temporarily unavailable. Please try again.', chart: null }]);
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
          <p className="text-xs text-zinc-500">Ask natural-language questions — responses include inline data charts</p>
        </div>
      </div>

      <div className="mb-3 h-80 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${m.role === 'ai' ? 'bg-brand-gradient text-white' : 'bg-white/10 text-zinc-300'}`}>
                {m.role === 'ai' ? 'AI' : 'A'}
              </div>
              <div className={`max-w-[80%] ${m.role === 'ai' ? 'flex-1' : ''}`}>
                <div className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === 'ai' ? 'rounded-tl-none border border-white/10 bg-white/5 text-zinc-300' : 'rounded-tr-none bg-brand-gradient text-white'}`}>
                  {m.text}
                </div>
                {m.role === 'ai' && m.chart && (
                  <MiniChart data={m.chart.data} type={m.chart.type} />
                )}
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
  const [revRange, setRevRange] = useState(12);
  const [trendRange, setTrendRange] = useState(12);

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

  function exportPeriod(period) {
    const csv = buildPeriodCSV(overview, trends, utilization, period);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediai-${period}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ overview, trends, utilization }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediai-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = overview?.stats || {};
  const allRevenue = (overview?.revenue_history || []).map(r => ({ ...r, revenue: parseFloat(r.revenue || 0) }));
  const revenueHistory = allRevenue.slice(-revRange);
  const deptPerf = (overview?.department_performance || []).slice(0, 8).map(d => ({
    name: d.name,
    revenue: parseFloat(d.revenue || 0),
    appointments: parseInt(d.appointments || 0),
  }));
  const allTrends = trends.map(t => ({ ...t, total: parseInt(t.total || 0), completed: parseInt(t.completed || 0), cancelled: parseInt(t.cancelled || 0) }));
  const trendData = allTrends.slice(-trendRange);

  const prevMonthRevenue = allRevenue.length >= 2 ? allRevenue[allRevenue.length - 2].revenue : 0;
  const thisMonthRevenue = allRevenue.length >= 1 ? allRevenue[allRevenue.length - 1].revenue : stats.monthly_revenue || 0;
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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={loadAll} disabled={loading} className="btn-ghost btn-sm gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <div className="relative group">
            <button className="btn-ghost btn-sm gap-1.5">
              <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            <div className="absolute right-0 top-full z-20 mt-1 hidden min-w-44 rounded-xl border border-white/10 bg-zinc-900/95 py-1 shadow-glass group-hover:block">
              <button onClick={() => exportPeriod('weekly')} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white">Weekly Report (CSV)</button>
              <button onClick={() => exportPeriod('monthly')} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white">Monthly Report (CSV)</button>
              <button onClick={() => exportPeriod('quarterly')} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white">Quarterly Report (CSV)</button>
              <div className="my-1 border-t border-white/[0.07]" />
              <button onClick={exportJSON} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white">Full Data (JSON)</button>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn-ghost btn-sm gap-1.5">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* 7 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard icon={Users} label="Total Patients" value={loading ? '—' : (stats.total_patients ?? 0)} color="text-blue-400" trend={12} />
        <StatCard icon={Stethoscope} label="Total Doctors" value={loading ? '—' : (stats.total_doctors ?? 0)} color="text-purple-400" />
        <StatCard icon={Calendar} label="Today's Appts" value={loading ? '—' : (stats.today_appointments ?? 0)} color="text-brand-400" />
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
          color={revenueGrowth != null && revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          sub="vs last month"
        />
        <StatCard icon={UserCheck} label="Active Doctors" value={loading ? '—' : (stats.active_doctors ?? 0)} color="text-amber-400" />
        <StatCard icon={FileText} label="Reports Today" value={loading ? '—' : (stats.today_reports ?? 0)} color="text-cyan-400" />
      </div>

      {/* Charts Row 1: Revenue + Appointment Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Area Chart with date-range selector */}
        <div className="glass-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={18} />
              Revenue Trend
            </h2>
            <RangePicker value={revRange} onChange={setRevRange} />
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

        {/* Appointment Trends Line Chart with date-range selector */}
        <div className="glass-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="text-blue-400" size={18} />
              Appointment Trends
            </h2>
            <RangePicker value={trendRange} onChange={setTrendRange} />
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

      {/* Charts Row 2: Department (Revenue + Appointments grouped) + Cancellation Rate */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Department Grouped Bar Chart: Revenue + Appointment counts */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <BarChart2 className="text-brand-400" size={18} />
              Department Performance
            </h2>
            <span className="text-xs text-zinc-500">Revenue & appointments</span>
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
              <BarChart data={deptPerf} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="appt" orientation="right" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
                <Bar yAxisId="rev" dataKey="revenue" name="Revenue ($)" fill="#ED2024" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="appt" dataKey="appointments" name="Appointments" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cancellation Rate Stacked Bar Chart */}
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
          ) : allTrends.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
              <Calendar className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">Cancellation data will appear as appointments are tracked</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={allTrends.slice(-8)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
                <Bar dataKey="completed" name="Completed" fill="#10b981" stackId="a" />
                <Bar dataKey="cancelled" name="Cancelled" fill="#f43f5e" stackId="a" radius={[4, 4, 0, 0]} />
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
