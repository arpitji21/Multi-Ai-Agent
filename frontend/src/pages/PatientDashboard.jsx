import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Brain, History, Activity,
  AlertCircle, TrendingUp, Zap, Plus, Trash2, Edit2,
  Check, X, Clock, Calendar, ChevronDown, BarChart2, ClipboardList,
  ShieldCheck, HeartPulse, Lightbulb
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

const TABS = [
  { id: 'reports', label: 'Reports & AI', icon: Brain },
  { id: 'clinical', label: 'Clinical Records (EMR)', icon: ClipboardList },
  { id: 'preventative', label: 'Preventative Care', icon: ShieldCheck },
];

// ─── Report Comparison Panel ─────────────────────────────────────────────────
function ReportComparisonPanel({ reports, onClear }) {
  const [comparing, setComparing] = useState(false);
  const [compResult, setCompResult] = useState(null);
  const [compError, setCompError] = useState('');

  async function runComparison() {
    setComparing(true);
    setCompError('');
    try {
      const res = await api.post('/ai/chat', {
        message: `Compare these two medical reports for the patient:\n\nReport A (${reports[0]?.report_type}, ${reports[0]?.created_at?.split('T')[0]}):\n${reports[0]?.patient_summary || 'No summary available'}\n\nReport B (${reports[1]?.report_type}, ${reports[1]?.created_at?.split('T')[0]}):\n${reports[1]?.patient_summary || 'No summary available'}\n\nProvide: 1) Key changes (improvements or deteriorations), 2) Consistent findings, 3) Recommendation. Be concise.`,
        context: { type: 'report_comparison' },
      });
      setCompResult(res.data.reply);
    } catch (e) {
      setCompError('Comparison failed. Please try again.');
    } finally {
      setComparing(false);
    }
  }

  const rA = reports[0];
  const rB = reports[1];

  const dateA = rA?.created_at?.split('T')[0] || 'Report A';
  const dateB = rB?.created_at?.split('T')[0] || 'Report B';

  function deriveScore(report) {
    const base = report?.health_score ?? 70;
    const abnormals = Array.isArray(report?.abnormal_values) ? report.abnormal_values.length : 0;
    const findings = Array.isArray(report?.key_findings) ? report.key_findings.length : 0;
    return Math.max(40, Math.min(100, base - abnormals * 5 + Math.min(findings, 3)));
  }

  const scoreA = deriveScore(rA);
  const scoreB = deriveScore(rB);
  const abnormalCountA = Array.isArray(rA?.abnormal_values) ? rA.abnormal_values.length : 0;
  const abnormalCountB = Array.isArray(rB?.abnormal_values) ? rB.abnormal_values.length : 0;
  const findingsCountA = Array.isArray(rA?.key_findings) ? rA.key_findings.length : 0;
  const findingsCountB = Array.isArray(rB?.key_findings) ? rB.key_findings.length : 0;

  const trendData = [
    { name: dateA, 'Health Index': scoreA, 'Abnormal Flags': abnormalCountA, 'Findings': findingsCountA },
    { name: dateB, 'Health Index': scoreB, 'Abnormal Flags': abnormalCountB, 'Findings': findingsCountB },
  ];

  return (
    <div className="glass-card p-5 space-y-4 border-violet-500/30 bg-violet-500/[0.03]">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-zinc-200 flex items-center gap-2">
          <BarChart2 size={16} className="text-violet-400" /> Report Comparison
        </h4>
        <button onClick={onClear} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map((r, idx) => (
          <div key={r.id} className={`rounded-xl border p-3 ${idx === 0 ? 'border-blue-500/30 bg-blue-500/[0.04]' : 'border-emerald-500/30 bg-emerald-500/[0.04]'}`}>
            <div className={`mb-1 text-xs font-bold uppercase tracking-wider ${idx === 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
              Report {idx === 0 ? 'A' : 'B'}
            </div>
            <p className="text-sm font-medium text-zinc-200 truncate">{r.file_name}</p>
            <p className="text-xs text-zinc-500">{r.report_type} · {r.created_at?.split('T')[0]}</p>
            {r.patient_summary && (
              <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2">{r.patient_summary}</p>
            )}
          </div>
        ))}
      </div>

      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
            <Line type="monotone" dataKey="Health Index" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 5 }} />
            <Line type="monotone" dataKey="Abnormal Flags" stroke="#f87171" strokeWidth={2} dot={{ fill: '#f87171', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {compResult ? (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-violet-400">AI Comparison</p>
          <p className="text-sm leading-relaxed text-zinc-300">{compResult}</p>
        </div>
      ) : (
        <button onClick={runComparison} disabled={comparing} className="btn-primary btn-sm">
          {comparing ? 'Comparing…' : <><Brain size={14} /> AI Compare Reports</>}
        </button>
      )}
    </div>
  );
}

// ─── Reports & AI Analysis ──────────────────────────────────────────────────
function ReportsTab() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    setLoadingReports(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data || []);
    } catch (e) {
      console.error('Failed to load reports', e);
    } finally {
      setLoadingReports(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post('/reports/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await fetchReports();
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-500">
            <Upload size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Upload Medical Report</h3>
            <p className="text-xs text-zinc-400">PDF, JPG, PNG — Securely analyzed by AI</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setFile(e.target.files[0])}
            className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />
          <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary shrink-0">
            {uploading ? 'Uploading…' : <><Upload size={16} /> Upload Now</>}
          </button>
        </div>
      </div>

      <div className="glass-soft p-5">
        <h3 className="section-title flex items-center gap-2 mb-4">
          <FileText size={16} /> Uploaded Reports
        </h3>
        {loadingReports ? (
          <div className="shimmer-bar h-20 rounded-xl" />
        ) : reports.length === 0 ? (
          <p className="text-center py-10 text-zinc-500">No reports yet</p>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 hover:bg-white/[0.06] transition">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{r.file_name}</p>
                  <p className="text-xs text-zinc-500">{r.report_type} · {r.created_at?.split('T')[0]}</p>
                </div>
                <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/${r.file_path}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand-400">View File</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clinical Records (EMR) ──────────────────────────────────────────────────
function ClinicalRecordsTab() {
  const [emrs, setEmrs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEMRs() {
      try {
        setLoading(true);
        const patientRes = await api.get('/patients');
        const patient = Array.isArray(patientRes.data) ? patientRes.data[0] : patientRes.data;
        if (!patient?.id) return;
        const emrRes = await api.get(`/emr/patient/${patient.id}`);
        setEmrs(emrRes.data || []);
      } catch (err) {
        console.error('Failed to load EMRs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadEMRs();
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="section-title flex items-center gap-2 text-base">
        <ClipboardList size={16} /> My Clinical Records (EMR)
      </h3>
      {loading ? (
        <div className="shimmer-bar h-20 rounded-xl" />
      ) : emrs.length === 0 ? (
        <div className="py-16 text-center text-zinc-500">No clinical records found</div>
      ) : (
        <div className="space-y-3">
          {emrs.map(e => (
            <div key={e.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-100">{e.diagnosis || 'Consultation'}</p>
                  <p className="text-xs text-zinc-500">Dr. {e.doctor_name} · {e.created_at?.split('T')[0]}</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const response = await api.get(
                        `/emr/${e.id}/pdf`,
                        {
                          responseType: 'blob'
                        }
                      );

                      const blob = new Blob(
                        [response.data],
                        { type: 'application/pdf' }
                      );

                      const url = window.URL.createObjectURL(blob);

                      const link = document.createElement('a');

                      link.href = url;
                      link.download = `EMR-${e.id}.pdf`;

                      document.body.appendChild(link);

                      link.click();

                      link.remove();

                      window.URL.revokeObjectURL(url);

                    } catch (err) {
                      console.error('PDF download failed', err);
                    }
                  }}
                  className="btn-primary btn-sm px-3"
                >
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preventative Care Tab ───────────────────────────────────────────────────
function PreventativeCareTab() {
  const [patient, setPatient] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/patients');
        const p = Array.isArray(res.data) ? res.data[0] : res.data;
        setPatient(p);
        
        const recs = [
          {
            title: 'Blood Group Awareness',
            desc: `As someone with ${p?.blood_group || 'recorded'} blood group, you should be aware of specific dietary guidelines that can optimize your energy levels.`,
            icon: HeartPulse,
            color: 'text-rose-400'
          },
          {
            title: 'Preventative Screening',
            desc: 'Regular screenings can detect issues early. Talk to your doctor about age-appropriate screenings for your profile.',
            icon: ShieldCheck,
            color: 'text-emerald-400'
          },
          {
            title: 'Digital Records Management',
            desc: 'Keeping your clinical records updated in this portal helps doctors provide more accurate and faster care during emergencies.',
            icon: ClipboardList,
            color: 'text-blue-400'
          },
          {
            title: 'Allergy Preparedness',
            desc: p?.allergies ? `Your allergy to ${p.allergies} is noted. Ensure you always communicate this to any new medical staff.` : 'Keep your allergy profile updated for better safety during prescriptions.',
            icon: Lightbulb,
            color: 'text-amber-400'
          }
        ];
        setRecommendations(recs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass-card border-brand-500/20 bg-brand-500/[0.02] p-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Lightbulb className="text-brand-400" /> Preventative Care Advisor
        </h3>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Proactive health management tailored to your medical profile.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {recommendations.map((rec, i) => {
          const Icon = rec.icon;
          return (
            <div key={i} className="glass-card p-5 group hover:border-brand-500/30 transition-all">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 group-hover:bg-brand-500/10">
                <Icon className={rec.color} size={20} />
              </div>
              <h4 className="font-bold text-zinc-100">{rec.title}</h4>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{rec.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('reports');

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-white">My <span className="gradient-text">Health</span></h2>
        <p className="mt-1 text-zinc-400">Securely manage your medical history and clinical records.</p>
      </div>

      <div className="flex overflow-x-auto gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit max-w-full">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeTab === t.id ? 'bg-white/15 text-white shadow-inner' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'clinical' && <ClinicalRecordsTab />}
        {activeTab === 'preventative' && <PreventativeCareTab />}
      </div>
    </div>
  );
}
