import { useState, useEffect } from 'react';
import {
  Users, UserCheck, Calendar, DollarSign, TrendingUp, Activity,
  FileText, Stethoscope, BarChart2, ArrowUpRight
} from 'lucide-react';
import api from '../lib/api';
import { PageLoading } from '../components/Loader';

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400', trend }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend != null && (
            <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <ArrowUpRight className={`h-3 w-3 ${trend < 0 ? 'rotate-90' : ''}`} />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/analytics/overview');
        setAnalytics(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageLoading />;

  const stats = analytics?.stats || {};
  const deptPerf = analytics?.department_performance || [];
  const revenueHistory = analytics?.revenue_history || [];

  const totalRevenue = revenueHistory.reduce((s, r) => s + parseFloat(r.revenue || 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Admin <span className="gradient-text">Dashboard</span>
        </h1>
        <p className="mt-1 text-zinc-400">Hospital management overview · MediAI Suite</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Total Patients" value={stats.total_patients ?? 0} color="text-blue-400" trend={12} />
        <StatCard icon={Stethoscope} label="Total Doctors" value={stats.total_doctors ?? 0} color="text-purple-400" />
        <StatCard icon={Calendar} label="Today's Appointments" value={stats.today_appointments ?? 0} color="text-brand-400" />
        <StatCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={`$${(stats.monthly_revenue ?? 0).toLocaleString()}`}
          color="text-emerald-400"
          trend={8}
        />
        <StatCard icon={UserCheck} label="Active Doctors" value={stats.active_doctors ?? 0} color="text-amber-400" />
        <StatCard icon={FileText} label="Reports Today" value={stats.today_reports ?? 0} color="text-cyan-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue History */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Revenue History
            </h2>
            <span className="text-sm font-semibold text-emerald-400">
              ${totalRevenue.toLocaleString()} total
            </span>
          </div>
          {revenueHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BarChart2 className="h-12 w-12 text-zinc-700" />
              <p className="text-zinc-500">Revenue charts available after first payments</p>
              <p className="text-xs text-zinc-600">Demo: Book appointments and record payments to see trends</p>
            </div>
          ) : (
            <div className="space-y-3">
              {revenueHistory.map((r, i) => {
                const max = Math.max(...revenueHistory.map(x => parseFloat(x.revenue)));
                const pct = max > 0 ? (parseFloat(r.revenue) / max) * 100 : 0;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-10 text-right text-xs text-zinc-500">{r.month}</span>
                    <div className="relative flex-1 rounded-full bg-white/5">
                      <div
                        className="h-2 rounded-full bg-brand-gradient transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-xs font-medium text-emerald-400">
                      ${parseFloat(r.revenue).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Department Performance */}
        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-400" />
              Department Performance
            </h2>
          </div>
          {deptPerf.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Activity className="h-12 w-12 text-zinc-700" />
              <p className="text-zinc-500">No department data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deptPerf.slice(0, 8).map((dept, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{dept.name}</p>
                    <p className="text-xs text-zinc-500">{dept.appointments} appointments</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400">
                    ${parseFloat(dept.revenue).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Analytics Chat Panel (stub) */}
      <div className="glass-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="section-title">AI Analytics Assistant</h2>
            <p className="text-xs text-zinc-500">Ask about revenue, patients, appointments, or doctor performance</p>
          </div>
          <span className="ml-auto badge bg-amber-500/10 border-amber-500/30 text-amber-400">Coming in Phase 5</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-xs text-white font-bold">AI</div>
              <div className="rounded-xl rounded-tl-none border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300">
                Hello! I'm your Admin AI Assistant. Ask me anything like "Show revenue this month", "Which department performs best?", or "What are appointment growth trends?"
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              className="input flex-1"
              placeholder='Try: "Show monthly revenue trend"'
              disabled
            />
            <button className="btn-primary" disabled>Ask AI</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {['Revenue this month', 'Top performing department', 'Appointment trends', 'Doctor utilization'].map(q => (
            <button key={q} className="btn-ghost btn-sm" disabled>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
