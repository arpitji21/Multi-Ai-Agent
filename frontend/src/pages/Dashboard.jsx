import { useState, useEffect } from 'react';
import {
  Calendar, Activity, FileText, Bell, Heart, Clock,
  ChevronRight, TrendingUp, AlertCircle, CheckCircle, Brain
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

function StatCard({ title, value, icon: Icon, color, sub, loading }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400 font-medium">{title}</p>
          <h3 className={`mt-1.5 text-3xl font-bold ${color}`}>
            {loading ? <span className="shimmer-bar inline-block h-8 w-12 rounded" /> : value}
          </h3>
          {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]">
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  booked: 'badge bg-blue-500/10 border-blue-500/30 text-blue-400',
  confirmed: 'badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  completed: 'badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
  cancelled: 'badge bg-rose-500/10 border-rose-500/30 text-rose-400',
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [healthScore, setHealthScore] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [aRes, nRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/notifications'),
      ]);
      setAppointments(aRes.data || []);
      setNotifications((nRes.data || []).slice(0, 5));

      // Try fetching own patient profile for health score
      try {
        const pRes = await api.get('/patients');
        const mine = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
        if (mine?.health_score !== undefined) setHealthScore(mine.health_score);
      } catch (_) {}
    } catch (e) {
      console.error('Dashboard load error', e);
    } finally {
      setLoading(false);
    }
  }

  async function getAiSummary() {
    setAiLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: 'Give me a brief health summary based on my profile.',
        context: { type: 'health_summary' },
      });
      setAiSummary(res.data.reply);
    } catch (e) {
      setAiSummary('AI health summary is currently unavailable. Please check back shortly.');
    } finally {
      setAiLoading(false);
    }
  }

  const upcoming = appointments
    .filter(a => ['booked', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date))
    .slice(0, 5);

  const past = appointments.filter(a => a.status === 'completed').length;
  const unread = notifications.filter(n => !n.is_read).length;

  const score = healthScore ?? 75;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">
            Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0] || 'Patient'}</span>
          </h2>
          <p className="mt-1 text-zinc-400">Here's your health overview for today.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
          <Heart size={16} className={scoreColor} />
          <span className="text-sm text-zinc-300">Health Score</span>
          <span className={`text-lg font-bold ${scoreColor}`}>{score}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Upcoming Appointments"
          value={upcoming.length}
          icon={Calendar}
          color="text-blue-400"
          sub="Next visit scheduled"
          loading={loading}
        />
        <StatCard
          title="Past Appointments"
          value={past}
          icon={CheckCircle}
          color="text-emerald-400"
          sub="Completed visits"
          loading={loading}
        />
        <StatCard
          title="Notifications"
          value={unread}
          icon={Bell}
          color="text-amber-400"
          sub="Unread alerts"
          loading={loading}
        />
        <StatCard
          title="Health Score"
          value={score}
          icon={TrendingUp}
          color={scoreColor}
          sub="Out of 100"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming appointments */}
        <div className="glass-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="section-title flex items-center gap-2">
              <Calendar className="text-brand-500" size={18} />
              Upcoming Appointments
            </h3>
            <a href="/appointments" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition">
              Book new <ChevronRight size={14} />
            </a>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer-bar h-14 rounded-xl" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Calendar className="h-10 w-10 text-zinc-700" />
              <p className="text-sm text-zinc-500">No upcoming appointments</p>
              <a href="/appointments" className="btn-primary btn-sm">Book Appointment</a>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {upcoming.map(a => (
                <div key={a.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
                      <Activity size={16} className="text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">
                        {a.doctor_name || `Dr. (ID ${a.doctor_id})`}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock size={10} />
                        {a.appointment_date?.split('T')[0]} · {a.appointment_time}
                      </div>
                    </div>
                  </div>
                  <span className={STATUS_BADGE[a.status] || 'badge bg-white/10 border-white/20 text-zinc-300'}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Notifications */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-4 flex items-center gap-2 text-base">
              <Bell className="text-amber-400" size={16} />
              Notifications
            </h3>
            {notifications.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-600">No notifications</p>
            ) : (
              <div className="space-y-2.5">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`flex gap-2.5 rounded-xl p-2.5 transition ${n.is_read ? 'opacity-60' : 'bg-white/[0.04]'}`}
                  >
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{n.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Health Summary */}
          <div className="glass-card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2 text-base">
              <Brain className="text-violet-400" size={16} />
              AI Health Summary
            </h3>
            {aiSummary ? (
              <p className="text-sm leading-relaxed text-zinc-300">{aiSummary}</p>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-xs text-zinc-500">Get an AI-powered overview of your health status.</p>
                <button
                  onClick={getAiSummary}
                  disabled={aiLoading}
                  className="btn-primary btn-sm"
                >
                  {aiLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Generating…
                    </span>
                  ) : (
                    <>
                      <Brain size={14} /> Generate Summary
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Quick nav */}
          <div className="glass-card p-4">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Quick Links</p>
            <div className="space-y-1">
              {[
                { label: 'Upload a Report', href: '/my-health' },
                { label: 'Medicine Reminders', href: '/my-health' },
                { label: 'Symptom Checker', href: '/my-health' },
              ].map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  {l.label}
                  <ChevronRight size={14} className="text-zinc-600" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
