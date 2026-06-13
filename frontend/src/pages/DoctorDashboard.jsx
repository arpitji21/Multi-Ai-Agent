import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, FileText, TrendingUp, Clock, CheckCircle,
  Activity, Stethoscope, ChevronRight, AlertCircle, Star,
  DollarSign, Brain, Pill, ClipboardList, RefreshCw, Eye
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

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState([]);
  const [emrs, setEmrs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [apptRes, profileRes, reportsRes, emrRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/doctors/me/profile'),
        api.get('/reports').catch(() => ({ data: [] })),
        api.get('/emr').catch(() => ({ data: [] })),
      ]);
      setAppointments(apptRes.data || []);
      setProfile(profileRes.data);
      setReports(reportsRes.data || []);
      setEmrs(emrRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(apptId, status) {
    setStatusUpdating(apptId);
    try {
      await api.put(`/appointments/${apptId}/status`, { status });
      setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status } : a));
    } catch (err) {
      console.error(err);
    } finally {
      setStatusUpdating(null);
    }
  }

  if (loading) return <PageLoading />;

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.appointment_date?.startsWith(today));
  const pendingQueue = appointments.filter(a => a.status === 'booked').slice(0, 5);
  const completed = appointments.filter(a => a.status === 'completed');
  const revenueEst = completed.length * (profile?.consultation_fee || 0);

  const reviewedEmrIds = new Set(emrs.map(e => e.appointment_id).filter(Boolean));
  const reportsAwaitingReview = reports.filter(r => !r.ai_analysis_id).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Good {greeting},{' '}
            <span className="gradient-text">Dr. {user?.name?.split(' ').slice(-1)[0]}</span>
          </h1>
          <p className="mt-1 text-zinc-400">
            {profile?.specialization} · {profile?.department_name || 'MediAI Hospital'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile?.rating && (
            <div className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold text-amber-400">{profile.rating}</span>
            </div>
          )}
          <span className="badge bg-blue-500/10 border-blue-500/30 text-blue-400">
            <Stethoscope className="h-3 w-3" />
            {profile?.experience_years}y exp
          </span>
          {reportsAwaitingReview > 0 && (
            <span className="badge bg-rose-500/10 border-rose-500/30 text-rose-400">
              <FileText className="h-3 w-3" />
              {reportsAwaitingReview} reports pending
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Today's Appointments" value={todayAppts.length} color="text-blue-400" sub="Scheduled today" />
        <StatCard icon={AlertCircle} label="Patient Queue" value={pendingQueue.length} color="text-amber-400" sub="Awaiting confirmation" />
        <StatCard icon={CheckCircle} label="Completed" value={completed.length} color="text-emerald-400" sub="All time" />
        <StatCard
          icon={DollarSign}
          label="Est. Revenue"
          value={`$${revenueEst.toLocaleString()}`}
          color="text-brand-400"
          sub={`$${profile?.consultation_fee || 0} per visit`}
        />
      </div>

      {/* AI Tools Quick Access */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Brain className="h-5 w-5 text-violet-400" />
          AI Clinical Tools
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'EMR Generator', icon: ClipboardList, color: 'text-emerald-400', tab: 'emr' },
            { label: 'Prescription Drafter', icon: Pill, color: 'text-blue-400', tab: 'prescription' },
            { label: 'Report Summarizer', icon: FileText, color: 'text-amber-400', tab: 'report' },
            { label: 'Follow-up Advisor', icon: RefreshCw, color: 'text-violet-400', tab: 'followup' },
          ].map(tool => (
            <button
              key={tool.tab}
              onClick={() => navigate(`/doctor/ai-tools?tab=${tool.tab}`)}
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
        {/* Today's Schedule */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-400" />
              Today's Schedule
            </h2>
            <span className="badge bg-blue-500/10 border-blue-500/30 text-blue-400">
              {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''}
            </span>
          </div>
          {todayAppts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Calendar className="h-12 w-12 text-zinc-700" />
              <p className="text-zinc-500">No appointments scheduled for today</p>
              <button onClick={() => navigate('/doctor/appointments')} className="btn-ghost btn-sm">
                View All Appointments
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {todayAppts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-300">
                      {a.patient_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{a.patient_name || 'Patient'}</p>
                      <p className="text-xs text-zinc-500">{a.reason || 'Consultation'} · {a.appointment_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={statusBadge(a.status)}>{a.status}</span>
                    <button
                      onClick={() => navigate(`/doctor/patient/${a.patient_id}?appt=${a.id}`)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-400"
                      title="View patient"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {a.status === 'booked' && (
                      <button
                        onClick={() => updateStatus(a.id, 'confirmed')}
                        disabled={statusUpdating === a.id}
                        className="btn-success btn-sm"
                      >
                        {statusUpdating === a.id ? '…' : 'Confirm'}
                      </button>
                    )}
                    {a.status === 'confirmed' && (
                      <button
                        onClick={() => navigate(`/doctor/ai-tools?tab=emr&appt=${a.id}&patient=${a.patient_id}&pname=${encodeURIComponent(a.patient_name || '')}`)}
                        className="btn-primary btn-sm"
                      >
                        Create EMR
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
          {/* Patient Queue */}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-amber-400" />
                Patient Queue
              </h2>
              {pendingQueue.length > 0 && (
                <span className="badge bg-amber-500/10 border-amber-500/30 text-amber-400">
                  {pendingQueue.length} pending
                </span>
              )}
            </div>
            {pendingQueue.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600">No patients waiting</p>
            ) : (
              <div className="space-y-2">
                {pendingQueue.map(a => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 transition hover:border-white/15"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-300">
                        {a.patient_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-200">{a.patient_name}</p>
                        <p className="text-xs text-zinc-600">{a.appointment_date?.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/doctor/patient/${a.patient_id}?appt=${a.id}`)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-blue-400"
                        title="View patient"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => updateStatus(a.id, 'confirmed')}
                        disabled={statusUpdating === a.id}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                      >
                        {statusUpdating === a.id ? '…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Doctor Profile Card */}
          <div className="glass-card p-5">
            <h2 className="section-title mb-4 text-base">My Profile</h2>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Specialization', value: profile?.specialization },
                { label: 'Department', value: profile?.department_name || '—' },
                { label: 'Fee / Visit', value: `$${profile?.consultation_fee}`, cls: 'text-emerald-400' },
                { label: 'Status', value: profile?.available ? 'Available' : 'Unavailable', cls: profile?.available ? 'text-emerald-400' : 'text-rose-400' },
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

      {/* All Appointments Table */}
      <div className="glass-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-400" />
            Recent Appointments
          </h2>
          <button
            onClick={() => navigate('/doctor/appointments')}
            className="flex items-center gap-1 text-xs text-brand-400 transition hover:text-brand-300"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium text-zinc-500">
                <th className="pb-3 pr-4">Patient</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Reason</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appointments.slice(0, 8).map((a) => (
                <tr key={a.id} className="group transition hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-zinc-200">{a.patient_name || '—'}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_date?.split('T')[0]}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_time}</td>
                  <td className="py-3 pr-4 max-w-xs truncate text-zinc-500">{a.reason || '—'}</td>
                  <td className="py-3 pr-4"><span className={statusBadge(a.status)}>{a.status}</span></td>
                  <td className="py-3">
                    <button
                      onClick={() => navigate(`/doctor/patient/${a.patient_id}?appt=${a.id}`)}
                      className="flex items-center gap-1 text-xs text-blue-400 transition hover:text-blue-300"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {appointments.length === 0 && (
            <p className="py-8 text-center text-zinc-500">No appointments found</p>
          )}
        </div>
      </div>
    </div>
  );
}
