import { useState, useEffect } from 'react';
import {
  Calendar, Clock, User, ChevronRight, Plus, X, CheckCircle,
  AlertCircle, Search, Stethoscope, ChevronLeft, MessageSquare,
  Brain, CheckSquare
} from 'lucide-react';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

const STATUS_BADGE = {
  booked: 'badge bg-blue-500/10 border-blue-500/30 text-blue-400',
  confirmed: 'badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  completed: 'badge bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
  cancelled: 'badge bg-rose-500/10 border-rose-500/30 text-rose-400',
};

const TIMES = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30',
];

const TABS = ['upcoming', 'past', 'cancelled'];

// ─── Natural-Language Booking Helper ─────────────────────────────────────────
function NLBookingBar({ departments, onDeptSelected }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState('');

  async function parseSuggestion() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSuggestion(null);
    try {
      const res = await api.post('/ai/symptom-check', {
        symptoms: [text],
        duration: 'unspecified',
        severity: 5,
      });
      const suggestedDept = res.data?.suggested_department;
      const match = departments.find(d =>
        d.name.toLowerCase().includes(suggestedDept?.toLowerCase() || '') ||
        suggestedDept?.toLowerCase().includes(d.name.toLowerCase())
      ) || departments[0];
      setSuggestion({ dept: match, urgency: res.data?.urgency, message: res.data?.message });
    } catch (e) {
      setError('Could not parse request. Please search manually below.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card border-violet-500/20 bg-violet-500/[0.03] p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={16} className="text-violet-400" />
        <p className="text-sm font-semibold text-zinc-200">Describe what you need</p>
        <span className="badge bg-violet-500/10 border-violet-500/30 text-violet-400 text-[10px]">AI Assisted</span>
      </div>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder='e.g. "I have chest pain and need a heart specialist"'
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && parseSuggestion()}
        />
        <button onClick={parseSuggestion} disabled={loading || !text.trim()} className="btn-primary shrink-0">
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Brain size={15} />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {suggestion && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="flex-1">
            <p className="text-xs text-zinc-400">AI suggests:</p>
            <p className="text-sm font-semibold text-zinc-100">{suggestion.dept?.name}</p>
            {suggestion.message && (
              <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{suggestion.message}</p>
            )}
          </div>
          {suggestion.urgency && (
            <span className={`badge ${suggestion.urgency === 'urgent' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              {suggestion.urgency}
            </span>
          )}
          <button
            onClick={() => { onDeptSelected(suggestion.dept); setSuggestion(null); setText(''); }}
            className="btn-primary btn-sm"
          >
            <CheckSquare size={14} /> Book This
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Booking Wizard (Patient only) ───────────────────────────────────────────
function BookingWizard({ onClose, onDone, prefillDept = null }) {
  const [step, setStep] = useState(prefillDept ? 2 : 1);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedDept, setSelectedDept] = useState(prefillDept);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedDept) {
      api.get(`/doctors?department_id=${selectedDept.id}`)
        .then(r => setDoctors(r.data || []))
        .catch(() => setDoctors([]));
    }
  }, [selectedDept]);

  const minDate = new Date().toISOString().split('T')[0];

  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  async function book() {
    setSaving(true);
    setError('');
    try {
      await api.post('/appointments', {
        doctor_id: selectedDoctor.id,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        reason,
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || 'Booking failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 animate-fade-in">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Book Appointment</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Step {step} of {totalSteps}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex gap-1">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-brand-500' : 'bg-white/10'}`}
            />
          ))}
        </div>

        {/* Step 1: Department */}
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-zinc-200">Choose Department</h4>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                className="input pl-8"
                placeholder="Search departments…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
              {filteredDepts.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDept(d); setSearch(''); }}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-brand-500/40 hover:bg-brand-500/5 ${
                    selectedDept?.id === d.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-white/10 bg-white/[0.02]'
                  }`}
                >
                  <Stethoscope size={16} className="text-brand-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{d.name}</p>
                    {d.description && <p className="text-xs text-zinc-500">{d.description}</p>}
                  </div>
                  {selectedDept?.id === d.id && <CheckCircle size={14} className="ml-auto text-brand-400" />}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!selectedDept} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Doctor */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-zinc-200">Choose Doctor</h4>
            <p className="text-xs text-zinc-500">{selectedDept?.name}</p>
            {doctors.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <User size={32} className="text-zinc-700" />
                <p className="text-sm text-zinc-500">No doctors available in this department</p>
              </div>
            ) : (
              <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
                {doctors.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDoctor(d)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-brand-500/40 hover:bg-brand-500/5 ${
                      selectedDoctor?.id === d.id ? 'border-brand-500/60 bg-brand-500/10' : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-400">
                      {d.name?.[0] || 'D'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-200">{d.name || `Doctor #${d.id}`}</p>
                      <p className="text-xs text-zinc-500">{d.specialization} · {d.experience_years}yr exp</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-400">${d.consultation_fee}</p>
                      {d.rating && <p className="text-xs text-zinc-500">★ {d.rating}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-ghost">
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setStep(3)} disabled={!selectedDoctor} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-zinc-200">Pick a Date & Time</h4>
            <div>
              <label className="field-label">Date</label>
              <input
                type="date"
                className="input"
                min={minDate}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            </div>
            {selectedDate && (
              <div>
                <label className="field-label mb-2 block">Available Slots</label>
                <div className="grid grid-cols-4 gap-2">
                  {TIMES.map(t => (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className={`rounded-xl border py-2 text-xs font-medium transition ${
                        selectedTime === t
                          ? 'border-brand-500 bg-brand-500/20 text-brand-300'
                          : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-ghost">
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setStep(4)} disabled={!selectedDate || !selectedTime} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <h4 className="font-semibold text-zinc-200">Confirm Appointment</h4>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Department</span>
                <span className="font-medium text-zinc-200">{selectedDept?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Doctor</span>
                <span className="font-medium text-zinc-200">{selectedDoctor?.name || `#${selectedDoctor?.id}`}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Date</span>
                <span className="font-medium text-zinc-200">{selectedDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Time</span>
                <span className="font-medium text-zinc-200">{selectedTime}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Fee</span>
                <span className="font-medium text-emerald-400">${selectedDoctor?.consultation_fee}</span>
              </div>
            </div>
            <div>
              <label className="field-label">Reason for visit (optional)</label>
              <textarea
                className="input min-h-[70px] resize-none"
                placeholder="Describe your symptoms or reason…"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-400">
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="btn-ghost">
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={book} disabled={saving} className="btn-primary">
                {saving ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Booking…
                  </span>
                ) : (
                  <><CheckCircle size={16} /> Confirm Booking</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Appointments Page (role-aware) ──────────────────────────────────────
export default function Appointments() {
  const { user } = useAuthStore();
  const isPatient = user?.role === 'patient';
  const [appointments, setAppointments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [showBooking, setShowBooking] = useState(false);
  const [prefillDept, setPrefillDept] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAppointments();
    if (isPatient) {
      api.get('/departments').then(r => setDepartments(r.data || [])).catch(() => {});
    }
  }, []);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data || []);
    } catch (e) {
      console.error('Failed to fetch appointments', e);
    } finally {
      setLoading(false);
    }
  }

  async function cancelAppointment(id) {
    setCancelling(id);
    try {
      await api.put(`/appointments/${id}/status`, { status: 'cancelled' });
      await fetchAppointments();
      showToast('Appointment cancelled successfully.');
    } catch (e) {
      console.error('Cancel failed', e);
    } finally {
      setCancelling(null);
    }
  }

  async function updateStatus(id, status) {
    setUpdating(id);
    try {
      await api.put(`/appointments/${id}/status`, { status });
      await fetchAppointments();
      showToast(`Appointment marked as ${status}.`);
    } catch (e) {
      console.error('Status update failed', e);
    } finally {
      setUpdating(null);
    }
  }

  function showToast(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  }

  function openBookingWithDept(dept) {
    setPrefillDept(dept);
    setShowBooking(true);
  }

  const filtered = appointments.filter(a => {
    if (tab === 'upcoming') return ['booked', 'confirmed'].includes(a.status);
    if (tab === 'past') return a.status === 'completed';
    return a.status === 'cancelled';
  });

  return (
    <div className="animate-fade-in space-y-6">
      {showBooking && (
        <BookingWizard
          prefillDept={prefillDept}
          onClose={() => { setShowBooking(false); setPrefillDept(null); }}
          onDone={() => {
            setShowBooking(false);
            setPrefillDept(null);
            fetchAppointments();
            showToast('Appointment booked! Your doctor will confirm shortly.');
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">
            {isPatient ? 'My ' : ''}<span className="gradient-text">Appointments</span>
          </h2>
          <p className="mt-1 text-zinc-400">
            {isPatient ? 'Manage and schedule your visits.' : 'View and manage patient appointments.'}
          </p>
        </div>
        {isPatient && (
          <button onClick={() => { setPrefillDept(null); setShowBooking(true); }} className="btn-primary">
            <Plus size={16} /> Book Appointment
          </button>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Natural-language booking bar (patient only) */}
      {isPatient && (
        <NLBookingBar
          departments={departments}
          onDeptSelected={dept => openBookingWithDept(dept)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-white/15 text-white shadow-inner' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Appointment list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="shimmer-bar h-36 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Calendar className="h-12 w-12 text-zinc-700" />
          <p className="text-zinc-500">No {tab} appointments</p>
          {isPatient && tab === 'upcoming' && (
            <button onClick={() => setShowBooking(true)} className="btn-primary">
              <Plus size={16} /> Book Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(a => (
            <div key={a.id} className="glass-card p-5 space-y-4 hover:border-white/20 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
                    <User size={18} className="text-brand-400" />
                  </div>
                  <div>
                    {isPatient ? (
                      <>
                        <p className="font-semibold text-zinc-200 text-sm">
                          {a.doctor_name || `Doctor #${a.doctor_id}`}
                        </p>
                        <p className="text-xs text-zinc-500">{a.specialization || 'General Medicine'}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-zinc-200 text-sm">
                          {a.patient_name || `Patient #${a.patient_id}`}
                        </p>
                        <p className="text-xs text-zinc-500">{a.department_name || 'General'}</p>
                      </>
                    )}
                  </div>
                </div>
                <span className={STATUS_BADGE[a.status] || 'badge bg-white/10 border-white/20 text-zinc-300'}>
                  {a.status}
                </span>
              </div>

              <div className="flex items-center gap-4 rounded-xl bg-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Calendar size={12} /> {a.appointment_date?.split('T')[0]}
                </div>
                <div className="h-3 w-px bg-white/15" />
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Clock size={12} /> {a.appointment_time}
                </div>
              </div>

              {a.reason && (
                <p className="text-xs text-zinc-500 line-clamp-2 italic">"{a.reason}"</p>
              )}

              {/* Patient actions: cancel */}
              {isPatient && ['booked', 'confirmed'].includes(a.status) && (
                <button
                  onClick={() => cancelAppointment(a.id)}
                  disabled={cancelling === a.id}
                  className="btn-danger btn-sm w-full"
                >
                  {cancelling === a.id ? 'Cancelling…' : 'Cancel Appointment'}
                </button>
              )}

              {/* Doctor/admin actions: confirm + complete */}
              {!isPatient && a.status === 'booked' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(a.id, 'confirmed')}
                    disabled={updating === a.id}
                    className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => updateStatus(a.id, 'cancelled')}
                    disabled={updating === a.id}
                    className="flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!isPatient && a.status === 'confirmed' && (
                <button
                  onClick={() => updateStatus(a.id, 'completed')}
                  disabled={updating === a.id}
                  className="w-full rounded-xl border border-zinc-500/30 bg-zinc-500/10 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-500/20 transition"
                >
                  Mark Completed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
