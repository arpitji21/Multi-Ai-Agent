import { useState, useEffect } from 'react';
import { Users, Calendar, Activity, CheckCircle, TrendingUp, FileText, Clock, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

function StatCard({ title, value, icon: Icon, color, sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 font-medium">{title}</p>
          <h3 className={`mt-1.5 text-3xl font-bold ${color}`}>{value}</h3>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ patients: 0, appointments: 0, reports: 0, completed: 0 });
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, aRes] = await Promise.all([
          api.get('/patients'),
          api.get('/appointments'),
        ]);
        const patients = pRes.data;
        const appts = aRes.data;
        const completed = appts.filter(a => a.status === 'completed').length;
        setStats({
          patients: patients.length,
          appointments: appts.length,
          reports: 0,
          completed,
        });
        setAppointments(appts.slice(0, 5));
      } catch (e) {
        console.error('Failed to fetch dashboard stats', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusBadge = (status) => {
    const map = {
      booked: 'badge bg-blue-500/10 border-blue-500/30 text-blue-400',
      confirmed: 'badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      completed: 'badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
      cancelled: 'badge bg-rose-500/10 border-rose-500/30 text-rose-400',
    };
    return map[status] || 'badge bg-white/10 border-white/20 text-zinc-300';
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white">System <span className="gradient-text">Overview</span></h2>
        <p className="mt-1 text-zinc-400">Welcome back to the Medical Staff Portal · MediAI Hospital Suite</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Patients" value={loading ? '—' : stats.patients} icon={Users} color="text-blue-400" />
        <StatCard title="Appointments" value={loading ? '—' : stats.appointments} icon={Calendar} color="text-brand-400" />
        <StatCard title="Pending Review" value="5" icon={Activity} color="text-amber-400" />
        <StatCard title="Completed" value={loading ? '—' : stats.completed} icon={CheckCircle} color="text-emerald-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="section-title mb-5 flex items-center gap-2">
            <Activity className="text-brand-500" size={20} />
            Recent Appointments
          </h3>
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Calendar className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">No appointments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {appointments.map(a => (
                <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{a.patient_name || a.doctor_name || 'N/A'}</p>
                    <p className="text-xs text-zinc-500">{a.appointment_date?.split('T')[0]} · {a.appointment_time}</p>
                  </div>
                  <span className={statusBadge(a.status)}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Status */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h3 className="section-title mb-4">System Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Database', status: 'Online', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                { label: 'API Server', status: 'Running', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
                { label: 'AI Service', status: 'Ready', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{item.label}</span>
                  <span className={`badge ${item.bg} ${item.color}`}>{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="section-title mb-3 text-sm">Quick Links</h3>
            <div className="space-y-1.5">
              {[
                { label: 'View All Patients', icon: Users },
                { label: 'Appointments', icon: Calendar },
                { label: 'Reports', icon: FileText },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition cursor-pointer">
                  <item.icon size={14} className="text-brand-400" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
