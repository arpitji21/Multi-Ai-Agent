import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Heart, Pill, FileText, Brain, Calendar,
  ClipboardList, AlertCircle, Activity, Stethoscope, Clock,
  ChevronRight, RefreshCw
} from 'lucide-react';
import api from '../lib/api';
import { PageLoading } from '../components/Loader';

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-200">{value || '—'}</span>
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

export default function DoctorPatientView() {
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const apptId = searchParams.get('appt');

  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [emrs, setEmrs] = useState([]);
  const [reports, setReports] = useState([]);
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    load();
  }, [patientId]);

  async function load() {
    setLoading(true);
    try {
      const [patRes, histRes, remRes, emrRes, apptRes, rptRes] = await Promise.all([
        api.get(`/patients/${patientId}`),
        api.get(`/patients/${patientId}/medical-history`).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/medicine-reminders`).catch(() => ({ data: [] })),
        api.get('/emr').catch(() => ({ data: [] })),
        api.get('/appointments').catch(() => ({ data: [] })),
        api.get('/reports').catch(() => ({ data: [] })),
      ]);
      setPatient(patRes.data);
      setHistory(histRes.data || []);
      setReminders(remRes.data || []);
      setEmrs((emrRes.data || []).filter(e => e.patient_id === parseInt(patientId)));
      // Filter reports to this patient by matching patient name or patient_id field
      const allReports = rptRes.data || [];
      const pid = parseInt(patientId);
      setReports(allReports.filter(r => r.patient_id === pid));
      if (apptId) {
        const found = (apptRes.data || []).find(a => a.id === parseInt(apptId));
        setAppointment(found || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function generateAiSummary() {
    setAiLoading(true);
    try {
      const historyText = history.map(h => `${h.condition || h.diagnosis}: ${h.treatment}`).join('; ');
      const medsText = reminders.map(r => `${r.medication_name} ${r.dosage || ''} (${r.frequency || ''})`).join(', ');
      const lastEMR = emrs[0];
      const reportsText = reports.length > 0
        ? reports.map(r => {
            const findings = r.doctor_summary || r.patient_summary || r.key_findings || null;
            return `${r.report_type || 'Report'} (${r.created_at?.split('T')[0]}): ${findings || 'No AI analysis yet'}`;
          }).join('\n')
        : 'No prior reports on file';

      const res = await api.post('/ai/chat', {
        message: `Generate a concise pre-appointment clinical summary for patient ${patient?.name}.

PATIENT DEMOGRAPHICS:
Blood group: ${patient?.blood_group || 'Unknown'}
Allergies: ${patient?.allergies || 'None known'}
Health score: ${patient?.health_score || 'N/A'}

MEDICAL HISTORY:
${historyText || 'None on file'}

CURRENT MEDICATIONS:
${medsText || 'None on file'}

PREVIOUS REPORTS:
${reportsText}

LAST EMR DIAGNOSIS:
${lastEMR?.diagnosis || 'No previous EMR'} ${lastEMR?.treatment_plan ? `— Treatment: ${lastEMR.treatment_plan}` : ''}

APPOINTMENT REASON: ${appointment?.reason || 'General consultation'}

Provide a structured pre-appointment briefing covering:
1. KEY CLINICAL POINTS: Most important facts for the doctor to know
2. MEDICATION REVIEW: Current meds, potential interactions, refill needs
3. PREVIOUS REPORT HIGHLIGHTS: Key findings from past reports
4. AREAS TO ASSESS: What to focus on in today's consultation
5. ALERTS: Any critical flags (allergies, abnormal values, urgent concerns)`,
        context: { type: 'pre_appointment_summary', patient_id: patientId },
      });
      setAiSummary(res.data.reply);
    } catch (err) {
      setAiSummary('Unable to generate AI summary at this time. Please review patient records manually.');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!patient) return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <AlertCircle className="h-12 w-12 text-rose-400" />
      <p className="text-zinc-400">Patient not found</p>
      <button onClick={() => navigate('/doctor')} className="btn-ghost btn-sm">Go Back</button>
    </div>
  );

  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const TABS = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'history', label: 'Medical History', icon: Stethoscope },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'emr', label: 'EMR Records', icon: ClipboardList },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Patient header */}
      <div className="glass-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-2xl font-bold text-brand-300">
              {patient.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{patient.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                {age && <span>{age} years</span>}
                {patient.gender && <span>· {patient.gender}</span>}
                {patient.blood_group && (
                  <span className="badge bg-rose-500/10 border-rose-500/30 text-rose-400">
                    <Heart className="h-3 w-3" /> {patient.blood_group}
                  </span>
                )}
                {patient.health_score && (
                  <span className="badge bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                    <Activity className="h-3 w-3" /> Score: {patient.health_score}
                  </span>
                )}
              </div>
              {patient.allergies && (
                <p className="mt-1 text-xs text-amber-400">
                  ⚠ Allergies: {patient.allergies}
                </p>
              )}
            </div>
          </div>

          {appointment && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Current Appointment</p>
              <p className="text-zinc-200">{appointment.appointment_date?.split('T')[0]} at {appointment.appointment_time}</p>
              <p className="text-zinc-500">{appointment.reason || 'General consultation'}</p>
              <span className={`mt-1.5 inline-flex ${statusBadge(appointment.status)}`}>{appointment.status}</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Pre-Appointment Summary */}
      <div className="glass-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-400" />
            AI Pre-Appointment Summary
          </h2>
          {!aiSummary && (
            <button
              onClick={generateAiSummary}
              disabled={aiLoading}
              className="btn-primary btn-sm"
            >
              {aiLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating…
                </span>
              ) : (
                <><Brain className="h-3.5 w-3.5" /> Generate Summary</>
              )}
            </button>
          )}
          {aiSummary && (
            <button
              onClick={() => { setAiSummary(null); generateAiSummary(); }}
              className="btn-ghost btn-sm"
              title="Regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {aiLoading && !aiSummary && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="shimmer-bar h-4 rounded" />)}
          </div>
        )}

        {aiSummary ? (
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
            <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">{aiSummary}</p>
          </div>
        ) : !aiLoading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Brain className="h-10 w-10 text-zinc-700" />
            <p className="text-sm text-zinc-500">
              Generate an AI-powered pre-appointment briefing covering patient history, medications, and clinical alerts.
            </p>
          </div>
        )}

        {/* Quick stat pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
            <Stethoscope className="h-3 w-3 text-brand-400" />
            {history.length} medical record{history.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
            <Pill className="h-3 w-3 text-blue-400" />
            {reminders.length} medication{reminders.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400">
            <ClipboardList className="h-3 w-3 text-emerald-400" />
            {emrs.length} EMR record{emrs.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card">
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 pt-4">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'border-b-2 border-brand-500 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Personal Details</p>
                <InfoRow label="Date of Birth" value={patient.date_of_birth?.split('T')[0]} />
                <InfoRow label="Gender" value={patient.gender} />
                <InfoRow label="Phone" value={patient.phone} />
                <InfoRow label="Email" value={patient.email} />
                <InfoRow label="Address" value={patient.address} />
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Clinical Details</p>
                <InfoRow label="Blood Group" value={patient.blood_group} />
                <InfoRow label="Allergies" value={patient.allergies || 'None known'} />
                <InfoRow label="Health Score" value={patient.health_score ? `${patient.health_score}/100` : null} />
                <InfoRow label="Emergency Contact" value={patient.emergency_contact} />
              </div>
            </div>
          )}

          {/* Medical History Tab */}
          {tab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Stethoscope className="h-10 w-10 text-zinc-700" />
                  <p className="text-zinc-500">No medical history on file</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 h-full w-px bg-white/[0.06]" />
                  <div className="space-y-3">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="relative flex gap-4 pl-10">
                        <div className="absolute left-[11px] top-3 h-2.5 w-2.5 rounded-full border-2 border-brand-500 bg-black" />
                        <div className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-zinc-200">{h.condition || h.diagnosis}</p>
                            <span className="text-xs text-zinc-600">{h.date?.split('T')[0]}</span>
                          </div>
                          {h.treatment && <p className="mt-1 text-sm text-zinc-400">Treatment: {h.treatment}</p>}
                          {h.notes && <p className="mt-1 text-xs italic text-zinc-600">{h.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Medications Tab */}
          {tab === 'medications' && (
            <div>
              {reminders.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Pill className="h-10 w-10 text-zinc-700" />
                  <p className="text-zinc-500">No current medications on file</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {reminders.map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                          <Pill className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200">{r.medication_name}</p>
                          <p className="text-xs text-zinc-500">{r.dosage}</p>
                        </div>
                      </div>
                      {r.frequency && (
                        <p className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="h-3 w-3" /> {r.frequency}
                        </p>
                      )}
                      {r.instructions && <p className="mt-1 text-xs text-zinc-600 italic">{r.instructions}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EMR Records Tab */}
          {tab === 'emr' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">{emrs.length} EMR record{emrs.length !== 1 ? 's' : ''} created by you</p>
                <button
                  onClick={() => navigate(`/doctor/ai-tools?tab=emr&patient=${patientId}&pname=${encodeURIComponent(patient.name)}`)}
                  className="btn-primary btn-sm"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> New EMR
                </button>
              </div>
              {emrs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <ClipboardList className="h-10 w-10 text-zinc-700" />
                  <p className="text-zinc-500">No EMR records yet for this patient</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emrs.map(e => (
                    <div key={e.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium text-zinc-100">{e.diagnosis || 'Consultation'}</p>
                        <span className="text-xs text-zinc-600">
                          {e.appointment_date?.split('T')[0] || e.created_at?.split('T')[0]}
                        </span>
                      </div>
                      {e.treatment_plan && (
                        <p className="text-sm text-zinc-400"><span className="text-zinc-500">Treatment:</span> {e.treatment_plan}</p>
                      )}
                      {e.prescription && (
                        <p className="mt-1 text-sm text-zinc-400"><span className="text-zinc-500">Prescription:</span> {e.prescription}</p>
                      )}
                      {e.follow_up_date && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400">
                          <Calendar className="h-3 w-3" /> Follow-up: {e.follow_up_date?.split('T')[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick action footer */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate(`/doctor/ai-tools?tab=emr&patient=${patientId}&pname=${encodeURIComponent(patient.name)}${apptId ? `&appt=${apptId}` : ''}`)}
          className="btn-primary"
        >
          <ClipboardList className="h-4 w-4" /> Create EMR
        </button>
        <button
          onClick={() => navigate(`/doctor/ai-tools?tab=prescription&patient=${patientId}&pname=${encodeURIComponent(patient.name)}`)}
          className="btn-ghost"
        >
          <Pill className="h-4 w-4" /> Draft Prescription
        </button>
        <button
          onClick={() => navigate(`/doctor/ai-tools?tab=followup&patient=${patientId}&pname=${encodeURIComponent(patient.name)}${apptId ? `&appt=${apptId}` : ''}`)}
          className="btn-ghost"
        >
          <RefreshCw className="h-4 w-4" /> Follow-up Advisor
        </button>
      </div>
    </div>
  );
}
