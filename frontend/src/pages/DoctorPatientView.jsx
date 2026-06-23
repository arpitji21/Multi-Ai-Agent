import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Heart, Pill, FileText, Brain, Calendar,
  ClipboardList, AlertCircle, Activity, Stethoscope, Clock,
  ChevronRight, RefreshCw, Award, X, Check
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
  const [tab, setTab] = useState('overview');

  // Certificate State
  const [showCertModal, setShowCertModal] = useState(false);
  const [certForm, setCertForm] = useState({
    cert_type: 'Medical Certificate',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0],
    fitness_date: new Date(Date.now() + 4*24*60*60*1000).toISOString().split('T')[0],
    reason: 'medical reasons',
  });
  const [certLoading, setCertLoading] = useState(false);

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
        api.get(`/emr/patient/${patientId}`).catch(() => ({ data: [] })),
        api.get('/appointments').catch(() => ({ data: [] })),
        api.get(`/reports?patient_id=${patientId}`).catch(() => ({ data: [] })),
      ]);
      setPatient(patRes.data);
      setHistory(histRes.data || []);
      setReminders(remRes.data || []);
      setEmrs(emrRes.data || []);
      setReports(rptRes.data || []);
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

  async function generateCert() {
    setCertLoading(true);
    try {
      const res = await api.post('/reports/certificate', {
        patient_id: patientId,
        ...certForm
      });
      if (res.data.pdf_url) {
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${res.data.pdf_url}`;
        window.open(url, '_blank');
        setShowCertModal(false);
      }
    } catch (err) {
      alert('Failed to generate certificate');
    } finally {
      setCertLoading(false);
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
    { id: 'reports', label: 'Reports', icon: FileText },
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

      {/* Quick stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
            <Stethoscope size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">History</p>
            <p className="text-lg font-bold text-white">{history.length} Records</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Pill size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Meds</p>
            <p className="text-lg font-bold text-white">{reminders.length} Active</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">EMR</p>
            <p className="text-lg font-bold text-white">{emrs.length} Saved</p>
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
                <p className="text-sm text-zinc-500">{emrs.length} clinical record{emrs.length !== 1 ? 's' : ''} for this patient</p>
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
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const res = await api.get(`/emr/${e.id}/pdf`);
                                if (res.data.pdf_url) {
                                  // pdf_url is a relative path like /uploads/emr_reports/xxx.pdf
                                  // We need to resolve it against the backend origin, not the frontend
                                  const backendBase = api.defaults.baseURL.replace(/\/api$/, '');
                                  window.open(`${backendBase}${res.data.pdf_url}`, '_blank');
                                }
                              } catch (err) {
                                alert('Failed to generate PDF. Please try again.');
                              }
                            }}
                            className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300 transition"
                          >
                            <FileText size={14} /> Download PDF
                          </button>
                          <span className="text-xs text-zinc-600">
                            {e.appointment_date?.split('T')[0] || e.created_at?.split('T')[0]}
                          </span>
                        </div>
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

          {/* Reports Tab */}
          {tab === 'reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">{reports.length} medical report{reports.length !== 1 ? 's' : ''} on file</p>
                <button
                  onClick={() => navigate(`/doctor/ai-tools?tab=report&patient=${patientId}`)}
                  className="btn-ghost btn-sm"
                >
                  <Brain className="h-3.5 w-3.5" /> Report Tools
                </button>
              </div>
              {reports.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <FileText className="h-10 w-10 text-zinc-700" />
                  <p className="text-zinc-500">No reports uploaded for this patient</p>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {reports.map((r) => (
                    <div key={r.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-brand-500/30">
                      {/* Image Preview if applicable */}
                      {(r.file_type?.includes('image') || r.file_name?.match(/\.(jpg|jpeg|png)$/i)) && (
                        <div className="aspect-video w-full overflow-hidden border-b border-white/10 bg-black/40">
                          <img
                            src={`/uploads/${r.file_path}`}
                            alt={r.file_name}
                            className="h-full w-full object-cover opacity-60 transition group-hover:opacity-100"
                          />
                        </div>
                      )}
                      
                      <div className="p-4">
                        <div className="mb-3 flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-zinc-100">{r.report_type?.toUpperCase() || 'GENERAL REPORT'}</p>
                            <p className="text-xs text-zinc-500">{r.created_at?.split('T')[0]}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
                          <span className="text-[10px] text-zinc-600 truncate max-w-[150px]">{r.file_name}</span>
                          <a
                            href={`/uploads/${r.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 transition"
                            onClick={(e) => {
                              // Prevent SPA navigation if href is external
                              e.stopPropagation();
                            }}
                          >
                            View Original <ChevronRight size={14} />
                          </a>
                        </div>
                      </div>
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
          onClick={() => setShowCertModal(true)}
          className="btn-ghost text-brand-400 border-brand-500/30 hover:bg-brand-500/10"
        >
          <Award className="h-4 w-4" /> Medical Certificate
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

      {/* Certificate Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in zoom-in-95 glass-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="text-brand-400" size={20} /> Generate Certificate
              </h3>
              <button onClick={() => setShowCertModal(false)} className="text-zinc-500 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="field-label">Certificate Type</label>
                <select 
                  className="input"
                  value={certForm.cert_type}
                  onChange={e => setCertForm({...certForm, cert_type: e.target.value})}
                >
                  <option value="Medical Certificate">Medical Certificate (General)</option>
                  <option value="Sick Note">Sick Note (Leave)</option>
                  <option value="Fitness Certificate">Fitness Certificate</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Start Date</label>
                  <input type="date" className="input" value={certForm.start_date} onChange={e => setCertForm({...certForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="field-label">End Date</label>
                  <input type="date" className="input" value={certForm.end_date} onChange={e => setCertForm({...certForm, end_date: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="field-label">Fitness Date</label>
                <input type="date" className="input" value={certForm.fitness_date} onChange={e => setCertForm({...certForm, fitness_date: e.target.value})} />
              </div>

              <div>
                <label className="field-label">Reason / Condition</label>
                <input 
                  className="input" 
                  placeholder="e.g. viral fever, recovery from surgery..." 
                  value={certForm.reason}
                  onChange={e => setCertForm({...certForm, reason: e.target.value})}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setShowCertModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button 
                  onClick={generateCert} 
                  disabled={certLoading}
                  className="btn-primary flex-1"
                >
                  {certLoading ? 'Generating...' : <><Check size={16} /> Generate PDF</>}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 text-center">
                Uses local PDF engine. No API credits required.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
