import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, User, CheckCircle, AlertCircle, Eye,
  Activity, ChevronRight, Star, Brain, Pill, ClipboardList,
  RefreshCw, TrendingUp, Heart, ShieldCheck, Bell, FileText
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { PageLoading } from '../components/Loader';

function StatCard({ icon: Icon, label, value, color = 'text-brand-400', sub, loading }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold ${color}`}>
            {loading ? <span className="shimmer-bar inline-block h-8 w-16 rounded" /> : value}
          </p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function statusBadge(status) {
  const map = {
    booked: 'badge bg-blue-500/10 border-blue-500/30 text-blue-400',
    confirmed: 'badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    completed: 'badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
    cancelled: 'badge bg-rose-500/10 border-rose-500/30 text-rose-400',
  };
  return map[status] || 'badge bg-white/10 border-white/20 text-zinc-300';
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [reportsCount, setReportsCount] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [aRes, nRes, pRes, rRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/notifications'),
        api.get('/patients'),
        api.get('/reports').catch(() => ({ data: [] })),
      ]);
      setAppointments(aRes.data || []);
      setNotifications((nRes.data || []).slice(0, 5));
      const mine = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
      setProfile(mine);
      setReportsCount(rRes.data ? rRes.data.length : 0);
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
      setReportsLoading(false);
    }
  }

  async function cancelAppointment(id) {
    setCancelling(id);
    try {
      await api.put(`/appointments/${id}/status`, { status: 'cancelled' });
      // Reload appointment state after cancellation
      const aRes = await api.get('/appointments');
      setAppointments(aRes.data || []);
    } catch (e) {
      console.error('Cancel failed', e);
    } finally {
      setCancelling(null);
    }
  }

  if (loading) return <PageLoading />;

  const upcoming = appointments
    .filter(a => ['booked', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));

  const history = appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
    .slice(0, 8);

  const pastCount = appointments.filter(a => a.status === 'completed').length;
  const score = profile?.health_score ?? 75;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
  const scoreBorderColor = score >= 80 ? 'border-emerald-500/30' : score >= 60 ? 'border-amber-500/30' : 'border-rose-500/30';
  const scoreBgColor = score >= 80 ? 'bg-emerald-500/10' : score >= 60 ? 'bg-amber-500/10' : 'bg-rose-500/10';

  const age = profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Good {greeting},{' '}
            <span className="text-brand-500 font-bold">{user?.name?.split(' ')[0] || 'Patient'}</span>
          </h1>
          <p className="mt-1 text-zinc-400">
            Patient · {profile?.email || 'MediAI Hospital'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile?.health_score && (
            <div className={`flex items-center gap-1 rounded-xl border ${scoreBorderColor} ${scoreBgColor} px-3 py-1.5`}>
              <Star className={`h-4 w-4 fill-current ${scoreColor}`} />
              <span className={`text-sm font-semibold ${scoreColor}`}>Health Score: {profile.health_score}</span>
            </div>
          )}
          <span className="badge bg-blue-500/10 border-blue-500/30 text-blue-400">
            <Heart className="h-3 w-3 shrink-0" />
            Blood: {profile?.blood_group || '—'}
          </span>
          {profile?.allergies ? (
            <span className="badge bg-rose-500/10 border-rose-500/30 text-rose-400" title={`Allergies: ${profile.allergies}`}>
              ⚠️ Allergies
            </span>
          ) : (
            <span className="badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              <CheckCircle className="h-3 w-3 shrink-0" />
              No Allergies
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Wellness Index" value={`${score}%`} color={scoreColor} sub="Overall status" />
        <StatCard icon={Calendar} label="Upcoming Visits" value={upcoming.length} color="text-blue-400" sub="Scheduled visits" />
        <StatCard icon={CheckCircle} label="Completed Visits" value={pastCount} color="text-emerald-400" sub="All time" />
        <StatCard icon={FileText} label="Uploaded Reports" value={reportsCount} color="text-brand-400" sub="Uploaded files" loading={reportsLoading} />
      </div>

      {/* AI Patient Tools Quick Access */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-400" />
          AI Patient Tools
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Symptom Checker', icon: Activity, color: 'text-emerald-400', path: '/appointments' },
            { label: 'Upload Lab Report', icon: FileText, color: 'text-blue-400', path: '/my-health' },
            { label: 'AI Health Insights', icon: Brain, color: 'text-brand-400', path: '/my-health' },
            { label: 'Preventative Care', icon: ShieldCheck, color: 'text-violet-400', path: '/my-health?tab=preventative' },
          ].map(tool => (
            <button
              key={tool.label}
              onClick={() => navigate(tool.path)}
              className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] ${tool.color}`}>
                <tool.icon className="h-5 w-5" />
              </div>
              <span className="text-center text-xs font-medium text-zinc-300">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Schedule */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-400" />
              Upcoming Visits
            </h2>
            <span className="badge bg-blue-500/10 border-blue-500/30 text-blue-400">
              {upcoming.length} visit{upcoming.length !== 1 ? 's' : ''}
            </span>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Calendar className="h-12 w-12 text-zinc-700" />
              <p className="text-zinc-500">No appointments scheduled</p>
              <button onClick={() => navigate('/appointments')} className="btn-ghost btn-sm">
                Book a Visit
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-300">
                      {a.doctor_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{a.doctor_name || 'General Doctor'}</p>
                      <p className="text-xs text-zinc-500">{a.reason || 'Consultation'} · {a.appointment_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(a.status)}>{a.status}</span>
                    {['booked', 'confirmed'].includes(a.status) && (
                      <button
                        onClick={() => cancelAppointment(a.id)}
                        disabled={cancelling === a.id}
                        className="btn-danger btn-sm"
                      >
                        {cancelling === a.id ? '…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Recent Updates / Notifications */}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-amber-400" />
                Recent Updates
              </h2>
              {notifications.length > 0 && (
                <span className="badge bg-amber-500/10 border-amber-500/30 text-amber-400">
                  {notifications.length} updates
                </span>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600">No recent updates</p>
            ) : (
              <div className="space-y-2">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 transition hover:border-white/15"
                  >
                    <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.is_read ? 'bg-zinc-700' : 'bg-brand-500'}`} />
                    <div>
                      <p className="text-xs font-bold text-zinc-200">{n.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patient Profile Details */}
          <div className="glass-card p-5">
            <h2 className="section-title mb-4 text-base">My Profile</h2>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Age', value: age ? `${age} years` : '—' },
                { label: 'Gender', value: profile?.gender || '—' },
                { label: 'Blood Group', value: profile?.blood_group || '—', cls: 'text-rose-400 font-bold' },
                { label: 'Allergies', value: profile?.allergies || 'None', cls: profile?.allergies ? 'text-amber-400' : 'text-zinc-400' },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-zinc-500">{r.label}</span>
                  <span className={r.cls || 'text-zinc-200'}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Past Activity / Appointments Table */}
      <div className="glass-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-400" />
            Recent Activity
          </h2>
          <button
            onClick={() => navigate('/appointments')}
            className="flex items-center gap-1 text-xs text-brand-400 transition hover:text-brand-300"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium text-zinc-500">
                <th className="pb-3 pr-4">Doctor</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Reason</th>
                <th className="pb-3 pr-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {history.map((a) => (
                <tr key={a.id} className="group transition hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-zinc-200">{a.doctor_name || '—'}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_date?.split('T')[0]}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_time}</td>
                  <td className="py-3 pr-4 max-w-xs truncate text-zinc-500">{a.reason || '—'}</td>
                  <td className="py-3 pr-4"><span className={statusBadge(a.status)}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {history.length === 0 && (
            <p className="py-8 text-center text-zinc-500">No past activity found</p>
          )}
        </div>
      </div>
    </div>
  );
}
