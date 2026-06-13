import { useState, useEffect } from 'react';
import {
  Calendar, Users, FileText, TrendingUp, Clock, CheckCircle,
  Activity, Stethoscope, ChevronRight, AlertCircle, Star
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { PageLoading } from '../components/Loader';

function StatCard({ icon: Icon, label, value, color = 'text-brand-400', sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={`mt-1.5 text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] ${color}`}>
          <Icon className="h-5 w-5" />
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
  const [appointments, setAppointments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [apptRes, profileRes] = await Promise.all([
          api.get('/appointments'),
          api.get('/doctors/me/profile'),
        ]);
        setAppointments(apptRes.data);
        setProfile(profileRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <PageLoading />;

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.appointment_date?.startsWith(today));
  const upcoming = appointments.filter(a => a.appointment_date > today && a.status !== 'cancelled');
  const completed = appointments.filter(a => a.status === 'completed');
  const pending = appointments.filter(a => a.status === 'booked');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},
            {' '}<span className="gradient-text">Dr. {user?.name?.split(' ').slice(-1)[0]}</span>
          </h1>
          <p className="mt-1 text-zinc-400">
            {profile?.specialization} · {profile?.department_name || 'MediAI Hospital'}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Today's Appointments" value={todayAppts.length} color="text-blue-400" />
        <StatCard icon={Clock} label="Upcoming" value={upcoming.length} color="text-amber-400" />
        <StatCard icon={CheckCircle} label="Completed" value={completed.length} color="text-emerald-400" />
        <StatCard icon={AlertCircle} label="Pending Confirmation" value={pending.length} color="text-brand-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Schedule */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-400" />
              Today's Schedule
            </h2>
            <span className="badge bg-blue-500/10 border-blue-500/30 text-blue-400">{todayAppts.length} appointments</span>
          </div>
          {todayAppts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Calendar className="h-12 w-12 text-zinc-700" />
              <p className="text-zinc-500">No appointments today</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {todayAppts.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-sm font-semibold text-zinc-300">
                      {a.patient_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{a.patient_name || 'Patient'}</p>
                      <p className="text-xs text-zinc-500">{a.reason || 'Consultation'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-zinc-300">{a.appointment_time}</span>
                    <span className={statusBadge(a.status)}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h2 className="section-title mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-400" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { label: 'View Patient Queue', icon: Users, color: 'text-blue-400' },
                { label: 'Create EMR', icon: FileText, color: 'text-emerald-400' },
                { label: 'View Reports', icon: TrendingUp, color: 'text-amber-400' },
              ].map((action) => (
                <button
                  key={action.label}
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                    {action.label}
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Profile Card */}
          <div className="glass-card p-6">
            <h2 className="section-title mb-4">My Profile</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Specialization</span>
                <span className="text-zinc-200">{profile?.specialization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Department</span>
                <span className="text-zinc-200">{profile?.department_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Consultation Fee</span>
                <span className="text-emerald-400">${profile?.consultation_fee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status</span>
                <span className={profile?.available ? 'text-emerald-400' : 'text-rose-400'}>
                  {profile?.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="glass-card p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">Recent Appointments</h2>
          <span className="text-xs text-zinc-500">{appointments.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-medium text-zinc-500">
                <th className="pb-3 pr-4">Patient</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Reason</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {appointments.slice(0, 10).map((a) => (
                <tr key={a.id} className="group transition hover:bg-white/[0.02]">
                  <td className="py-3 pr-4 font-medium text-zinc-200">{a.patient_name}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_date?.split('T')[0]}</td>
                  <td className="py-3 pr-4 text-zinc-400">{a.appointment_time}</td>
                  <td className="py-3 pr-4 max-w-xs truncate text-zinc-500">{a.reason || '—'}</td>
                  <td className="py-3"><span className={statusBadge(a.status)}>{a.status}</span></td>
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
