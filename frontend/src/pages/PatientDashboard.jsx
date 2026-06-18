import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Brain, CheckCircle2, History, Activity,
  Pill, AlertCircle, TrendingUp, Zap, Plus, Trash2, Edit2,
  Check, X, Clock, Calendar, ChevronDown, BarChart2, ClipboardList
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

const TABS = [
  { id: 'reports', label: 'Reports & AI', icon: Brain },
  { id: 'clinical', label: 'Clinical Records', icon: ClipboardList },
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'progress', label: 'Health Progress', icon: TrendingUp },
  { id: 'medicines', label: 'Medicines', icon: Pill },
  { id: 'symptoms', label: 'Symptom Checker', icon: Zap },
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

  // Derive a health index score from AI analysis: start at 100, subtract for abnormal values
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
            {Array.isArray(r.key_findings) && r.key_findings.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {r.key_findings.slice(0, 3).map((f, i) => (
                  <span key={i} className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">{f}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Metrics summary row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Health Index', a: scoreA, b: scoreB, unit: '', higher: true },
          { label: 'Abnormal Flags', a: abnormalCountA, b: abnormalCountB, unit: '', higher: false },
          { label: 'Key Findings', a: findingsCountA, b: findingsCountB, unit: '', higher: null },
        ].map(m => {
          const improved = m.higher !== null ? (m.higher ? m.b > m.a : m.b < m.a) : null;
          return (
            <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
              <p className="text-[10px] text-zinc-500 mb-1">{m.label}</p>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span className="text-blue-400 font-semibold">{m.a}{m.unit}</span>
                <span className="text-zinc-600">→</span>
                <span className={`font-semibold ${improved === true ? 'text-emerald-400' : improved === false ? 'text-rose-400' : 'text-zinc-300'}`}>
                  {m.b}{m.unit}
                </span>
              </div>
            </div>
          );
        })}
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
            <Line type="monotone" dataKey="Findings" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {compResult ? (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-violet-400">AI Comparison</p>
          <p className="text-sm leading-relaxed text-zinc-300">{compResult}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={runComparison}
            disabled={comparing}
            className="btn-primary btn-sm"
          >
            {comparing ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Comparing…
              </span>
            ) : (
              <><Brain size={14} /> AI Compare Reports</>
            )}
          </button>
          {compError && <p className="text-xs text-rose-400">{compError}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Reports & AI Analysis ──────────────────────────────────────────────────
function ReportsTab() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState('');
  const [comparing, setComparing] = useState([]);
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

  function toggleCompare(id) {
    setComparing(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  }

  const compareReports = reports.filter(r => comparing.includes(r.id));

  return (
    <div className="space-y-6">
      {/* Upload card */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute right-4 top-4 opacity-[0.06]">
          <FileText size={100} />
        </div>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-500">
            <Upload size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white">Upload Medical Report</h3>
            <p className="text-xs text-zinc-400">PDF, JPG, PNG — Uploaded reports will be visible to your doctor</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex-1 cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files[0])}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20 transition"
            />
          </label>
          {file && <p className="truncate text-xs text-zinc-400 max-w-[160px]">{file.name}</p>}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary shrink-0"
          >
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading…
              </span>
            ) : (
              <><Upload size={16} /> Upload Now</>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-400">
            <AlertCircle size={13} /> {error}
          </div>
        )}
      </div>

      {/* Report list */}
      <div className="glass-soft p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title flex items-center gap-2 text-base">
            <FileText size={16} className="text-zinc-500" /> Uploaded Reports
          </h3>
        </div>
        {loadingReports ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="shimmer-bar h-14 rounded-xl" />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <FileText size={36} className="text-zinc-700" />
            <p className="text-sm text-zinc-500">No reports uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] p-3.5 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                    <FileText size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200 truncate max-w-[300px]">{r.file_name}</p>
                    <p className="text-xs text-zinc-500">{r.report_type} · {r.created_at?.split('T')[0]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/${r.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View File
                  </a>
                </div>
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
  
        // Get current patient
        const patientRes = await api.get('/patients');
  
        const patient = Array.isArray(patientRes.data)
          ? patientRes.data[0]
          : patientRes.data;
  
        if (!patient?.id) {
          setLoading(false);
          return;
        }
  
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
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2 text-base">
          <ClipboardList size={16} className="text-zinc-500" /> My Clinical Records
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="shimmer-bar h-20 rounded-xl" />)}
        </div>
      ) : emrs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ClipboardList size={36} className="text-zinc-700" />
          <p className="text-sm text-zinc-500">No clinical records found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {emrs.map(e => (
            <div key={e.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-100">{e.diagnosis || 'Clinical Consultation'}</p>
                    <p className="text-xs text-zinc-500">
                      Dr. {e.doctor_name || 'Hospital Staff'} · {e.created_at?.split('T')[0]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await api.get(`/emr/${e.id}/pdf`);
                      if (res.data.pdf_url) window.open(res.data.pdf_url, '_blank');
                    } catch (err) {
                      alert('Failed to load report PDF.');
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-400 hover:bg-brand-500/20 transition"
                >
                  <FileText size={14} /> PDF Report
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {e.treatment_plan && (
                  <p className="text-xs text-zinc-400"><span className="text-zinc-500">Treatment:</span> {e.treatment_plan}</p>
                )}
                {e.prescription && (
                  <p className="text-xs text-zinc-400"><span className="text-zinc-500">Prescription:</span> {e.prescription}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
   
  

// ─── Medical Timeline ──────────────────────────────────────────────────────
function TimelineTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [aRes, rRes] = await Promise.all([
          api.get('/appointments'),
          api.get('/reports'),
        ]);
        const appts = (aRes.data || []).map(a => ({
          id: `appt-${a.id}`,
          type: 'appointment',
          date: a.appointment_date?.split('T')[0] || '',
          title: `Appointment · ${a.doctor_name || 'Doctor'}`,
          sub: `${a.appointment_time} · ${a.status}`,
          status: a.status,
        }));
        const rpts = (rRes.data || []).map(r => ({
          id: `rpt-${r.id}`,
          type: 'report',
          date: r.created_at?.split('T')[0] || '',
          title: r.file_name,
          sub: `${r.report_type} report`,
        }));
        const all = [...appts, ...rpts].sort((a, b) => b.date.localeCompare(a.date));
        setItems(all);
      } catch (e) {
        console.error('Timeline load error', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  const TYPE_ICON = {
    appointment: <Calendar size={14} className="text-blue-400" />,
    report: <FileText size={14} className="text-brand-400" />,
  };

  const TYPE_DOT = {
    appointment: 'bg-blue-500',
    report: 'bg-brand-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit">
        {['all', 'appointment', 'report'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              filter === f ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {f}s
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="shimmer-bar h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <History size={36} className="text-zinc-700" />
          <p className="text-sm text-zinc-500">No timeline entries yet</p>
        </div>
      ) : (
        <div className="relative pl-5">
          <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10" />
          <div className="space-y-4">
            {filtered.map(item => (
              <div key={item.id} className="relative flex gap-4">
                <div className={`absolute -left-[13px] mt-1.5 h-3 w-3 rounded-full border-2 border-black ${TYPE_DOT[item.type]}`} />
                <div className="glass-soft flex-1 rounded-xl border border-white/[0.07] p-3.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    {TYPE_ICON[item.type]}
                    <p className="text-sm font-medium text-zinc-200 truncate">{item.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{item.date}</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-xs text-zinc-500">{item.sub}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Health Progress ────────────────────────────────────────────────────────
const MOCK_METRICS = [
  { month: 'Jan', healthScore: 72, heartRate: 78, bp: 125 },
  { month: 'Feb', healthScore: 75, heartRate: 76, bp: 122 },
  { month: 'Mar', healthScore: 73, heartRate: 80, bp: 128 },
  { month: 'Apr', healthScore: 78, heartRate: 74, bp: 120 },
  { month: 'May', healthScore: 80, heartRate: 72, bp: 118 },
  { month: 'Jun', healthScore: 82, heartRate: 70, bp: 116 },
];

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#1a0809', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 },
  labelStyle: { color: '#a1a1aa' },
  itemStyle: { color: '#d4d4d8' },
};

function ProgressTab() {
  const [patient, setPatient] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.get('/patients').then(r => {
      const p = Array.isArray(r.data) ? r.data[0] : r.data;
      setPatient(p);
    }).catch(() => {});
  }, []);

  async function getAiInsight(score, patient) {
    setAiLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: `My current health score is ${score}/100. Blood group: ${patient?.blood_group || 'unknown'}. Gender: ${patient?.gender || 'unknown'}. Allergies: ${patient?.allergies || 'none'}. Give me a brief (3–4 sentences) personalized health progress insight and one actionable tip to improve my score.`,
        context: { type: 'health_progress' },
      });
      setAiInsight(res.data.reply);
    } catch (e) {
      setAiInsight('AI insight temporarily unavailable. Please try again shortly.');
    } finally {
      setAiLoading(false);
    }
  }

  const score = patient?.health_score ?? 75;
  const scoreColor = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';

  return (
    <div className="space-y-6">
      {/* Score ring */}
      <div className="glass-card p-6 flex flex-wrap items-center gap-6">
        <div className="relative flex h-28 w-28 items-center justify-center shrink-0">
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={scoreColor} strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">Your Health Score</h3>
          <p className="mt-1 text-sm text-zinc-400">
            {score >= 80
              ? 'Excellent! Your health metrics are in a great range.'
              : score >= 60
              ? 'Good, but there is room for improvement in some areas.'
              : 'Some metrics need attention. Schedule a check-up soon.'}
          </p>
          <div className="mt-3 flex gap-2 flex-wrap">
            {patient?.blood_group && (
              <span className="badge border-white/15 bg-white/5 text-zinc-300">Blood: {patient.blood_group}</span>
            )}
            {patient?.gender && (
              <span className="badge border-white/15 bg-white/5 text-zinc-300">{patient.gender}</span>
            )}
            {patient?.allergies && (
              <span className="badge border-amber-500/30 bg-amber-500/10 text-amber-300">
                Allergy: {patient.allergies}
              </span>
            )}
          </div>
          <button
            onClick={() => getAiInsight(score, patient)}
            disabled={aiLoading}
            className="mt-3 btn-primary btn-sm"
          >
            {aiLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyzing…
              </span>
            ) : (
              <><Brain size={14} /> AI Progress Insight</>
            )}
          </button>
        </div>
      </div>

      {/* AI Progress Insight */}
      {aiInsight && (
        <div className="glass-card border-violet-500/20 bg-violet-500/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20">
              <Brain size={16} className="text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-200">AI Health Progress Insight</p>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{aiInsight}</p>
        </div>
      )}

      {/* Health Score trend */}
      <div className="glass-card p-5">
        <h4 className="section-title mb-4 text-base flex items-center gap-2">
          <TrendingUp size={16} className="text-emerald-400" /> Health Score Trend
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={MOCK_METRICS}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ED2024" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ED2024" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} domain={[60, 100]} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="healthScore" stroke="#ED2024" strokeWidth={2} fill="url(#scoreGrad)" dot={{ fill: '#ED2024', r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Vitals chart */}
      <div className="glass-card p-5">
        <h4 className="section-title mb-4 text-base flex items-center gap-2">
          <Activity size={16} className="text-blue-400" /> Vitals Overview
        </h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={MOCK_METRICS}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#71717a' }} />
            <Line type="monotone" dataKey="heartRate" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} name="Heart Rate" />
            <Line type="monotone" dataKey="bp" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} name="Blood Pressure" />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-zinc-600 text-center italic">
          Sample trend data — real values will populate as you upload reports.
        </p>
      </div>
    </div>
  );
}

// ─── Medicine Reminders ─────────────────────────────────────────────────────
function MedicinesTab() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    medication_name: '', dosage: '', frequency: '', start_date: '', end_date: '', instructions: '',
  });
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const pRes = await api.get('/patients');
      const p = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
      if (!p?.id) return;
      setPatientId(p.id);
      const mRes = await api.get(`/patients/${p.id}/medicine-reminders`);
      setMedicines(mRes.data || []);
    } catch (e) {
      console.error('Medicines load error', e);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({ medication_name: '', dosage: '', frequency: '', start_date: '', end_date: '', instructions: '' });
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(m) {
    setForm({
      medication_name: m.medication_name,
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      start_date: m.start_date || '',
      end_date: m.end_date || '',
      instructions: m.instructions || '',
    });
    setEditId(m.id);
    setShowForm(true);
  }

  async function save() {
    if (!patientId || !form.medication_name) return;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/patients/${patientId}/medicine-reminders/${editId}`, form);
      } else {
        await api.post(`/patients/${patientId}/medicine-reminders`, form);
      }
      await loadAll();
      resetForm();
    } catch (e) {
      console.error('Save medicine failed', e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!patientId) return;
    try {
      await api.delete(`/patients/${patientId}/medicine-reminders/${id}`);
      setMedicines(m => m.filter(x => x.id !== id));
    } catch (e) {
      console.error('Delete medicine failed', e);
    }
  }

  const FREQ_BADGE = {
    daily: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    'twice daily': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    weekly: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2">
          <Pill size={18} className="text-brand-400" /> Medicine Reminders
        </h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary btn-sm">
          <Plus size={14} /> Add
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5 space-y-4">
          <h4 className="font-semibold text-zinc-200">{editId ? 'Edit Reminder' : 'New Reminder'}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Medication Name *</label>
              <input className="input" placeholder="e.g. Lisinopril" value={form.medication_name}
                onChange={e => setForm(f => ({ ...f, medication_name: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Dosage</label>
              <input className="input" placeholder="e.g. 10mg" value={form.dosage}
                onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Frequency</label>
              <input className="input" placeholder="e.g. once daily" value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">Start Date</label>
              <input type="date" className="input" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input type="date" className="input" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Instructions</label>
              <input className="input" placeholder="Take with food, avoid alcohol…" value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="btn-ghost btn-sm"><X size={14} /> Cancel</button>
            <button onClick={save} disabled={saving || !form.medication_name} className="btn-primary btn-sm">
              {saving ? 'Saving…' : <><Check size={14} /> Save</>}
            </button>
          </div>
        </div>
      )}

      {/* Daily Schedule View */}
      {!loading && medicines.length > 0 && (
        <div className="glass-soft p-5">
          <h4 className="section-title mb-4 flex items-center gap-2 text-sm">
            <Clock size={14} className="text-brand-400" /> Today's Schedule
          </h4>
          <div className="space-y-2">
            {(() => {
              const slots = [
                { time: '08:00 AM', label: 'Morning', icon: '🌅' },
                { time: '02:00 PM', label: 'Afternoon', icon: '☀️' },
                { time: '08:00 PM', label: 'Evening', icon: '🌙' },
              ];
              const freqToSlots = freq => {
                const f = (freq || '').toLowerCase();
                if (f.includes('three') || f.includes('3')) return [0, 1, 2];
                if (f.includes('twice') || f.includes('two') || f.includes('2') || f.includes('bid')) return [0, 2];
                if (f.includes('weekly')) return null;
                return [0];
              };
              return slots.map((slot, si) => {
                const meds = medicines.filter(m => {
                  const indices = freqToSlots(m.frequency);
                  return indices && indices.includes(si);
                });
                return (
                  <div key={slot.time} className={`flex items-start gap-3 rounded-xl border p-3 ${meds.length > 0 ? 'border-brand-500/20 bg-brand-500/[0.03]' : 'border-white/[0.05] opacity-50'}`}>
                    <div className="w-28 shrink-0">
                      <p className="text-xs font-semibold text-zinc-300">{slot.icon} {slot.time}</p>
                      <p className="text-[10px] text-zinc-500">{slot.label}</p>
                    </div>
                    {meds.length === 0 ? (
                      <p className="text-xs text-zinc-600 pt-0.5">No medications</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {meds.map(m => (
                          <div key={m.id} className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-1">
                            <p className="text-xs font-medium text-zinc-200">{m.medication_name}</p>
                            {m.dosage && <p className="text-[10px] text-zinc-500">{m.dosage}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="shimmer-bar h-20 rounded-2xl" />)}
        </div>
      ) : medicines.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <Pill size={36} className="text-zinc-700" />
          <p className="text-sm text-zinc-500">No medicine reminders yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">
            <Plus size={14} /> Add first reminder
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {medicines.map(m => (
            <div key={m.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10">
                    <Pill size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-200 text-sm">{m.medication_name}</p>
                    {m.dosage && <p className="text-xs text-zinc-500">{m.dosage}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(m)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 transition">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => remove(m.id)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.frequency && (
                  <span className={`badge text-xs ${FREQ_BADGE[m.frequency.toLowerCase()] || 'border-white/10 bg-white/5 text-zinc-400'}`}>
                    {m.frequency}
                  </span>
                )}
                {m.start_date && (
                  <span className="badge border-white/10 bg-white/5 text-zinc-500 text-xs">
                    From {m.start_date}
                  </span>
                )}
                {m.reminder_active && (
                  <span className="badge border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
                    Active
                  </span>
                )}
              </div>
              {m.instructions && (
                <p className="text-xs text-zinc-500 italic">{m.instructions}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Symptom Checker ────────────────────────────────────────────────────────
const COMMON_SYMPTOMS = [
  'Chest pain', 'Shortness of breath', 'Headache', 'Fatigue',
  'Fever', 'Cough', 'Nausea', 'Dizziness', 'Joint pain', 'Back pain',
  'Skin rash', 'Vision changes', 'Stomach pain', 'Insomnia',
];

function SymptomsTab() {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([]);
  const [extra, setExtra] = useState('');
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState(5);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function toggleSymptom(s) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function check() {
    setLoading(true);
    const symptoms = [...selected];
    if (extra) symptoms.push(extra);
    try {
      const res = await api.post('/ai/symptom-check', {
        symptoms,
        duration,
        severity,
      });
      setResult(res.data);
      setStep(4);
    } catch (e) {
      setResult({
        suggested_department: 'General Medicine',
        urgency: 'routine',
        message: 'Please book an appointment with a General Medicine specialist for a proper evaluation.',
      });
      setStep(4);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1);
    setSelected([]);
    setExtra('');
    setDuration('');
    setSeverity(5);
    setResult(null);
  }

  const URGENCY_STYLE = {
    urgent: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
    routine: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    monitor: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2">
          <Zap size={18} className="text-amber-400" /> Symptom Checker
        </h3>
        {step > 1 && (
          <button onClick={reset} className="btn-ghost btn-sm">Start over</button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(s => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-amber-500' : 'bg-white/10'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">Select all symptoms you're experiencing:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.map(s => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                  selected.includes(s)
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div>
            <label className="field-label">Other symptoms</label>
            <input
              className="input"
              placeholder="Describe any other symptoms…"
              value={extra}
              onChange={e => setExtra(e.target.value)}
            />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={selected.length === 0 && !extra}
            className="btn-primary w-full"
          >
            Next <ChevronDown size={16} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">How long have you had these symptoms?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {['1-2 days', '3-7 days', '1-2 weeks', '2-4 weeks', '1-3 months', '3+ months'].map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                  duration === d
                    ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <button onClick={() => setStep(1)} className="btn-ghost">Back</button>
            <button onClick={() => setStep(3)} disabled={!duration} className="btn-primary">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-sm text-zinc-400">
              Rate your pain/discomfort severity: <span className="font-bold text-white">{severity}/10</span>
            </p>
            <input
              type="range" min="1" max="10" value={severity}
              onChange={e => setSeverity(parseInt(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-xs text-zinc-600">
              <span>Mild</span><span>Moderate</span><span>Severe</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
            <p className="text-xs font-semibold text-zinc-400">Summary</p>
            <p className="text-xs text-zinc-300">Symptoms: {selected.join(', ')}{extra ? `, ${extra}` : ''}</p>
            <p className="text-xs text-zinc-300">Duration: {duration}</p>
            <p className="text-xs text-zinc-300">Severity: {severity}/10</p>
          </div>

          <div className="flex justify-between gap-2">
            <button onClick={() => setStep(2)} className="btn-ghost">Back</button>
            <button onClick={check} disabled={loading} className="btn-primary">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Analyzing…
                </span>
              ) : (
                <><Brain size={16} /> Check Symptoms</>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className={`rounded-xl border p-5 space-y-4 ${URGENCY_STYLE[result.urgency] || 'border-white/15 bg-white/5 text-zinc-300'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Brain size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-70">AI Recommendation</p>
              <p className="font-bold text-lg">{result.suggested_department}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{result.message}</p>
          <div className="flex flex-wrap gap-2">
            <span className="badge border-current bg-current/10 capitalize opacity-80">
              Urgency: {result.urgency}
            </span>
          </div>
          <div className="flex gap-2">
            <a href="/appointments" className="btn-primary btn-sm">
              <Calendar size={14} /> Book Appointment
            </a>
            <button onClick={reset} className="btn-ghost btn-sm">Check Again</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main My Health page ────────────────────────────────────────────────────
export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState('reports');

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-white">
          My <span className="gradient-text">Health</span>
        </h2>
        <p className="mt-1 text-zinc-400">Reports, timeline, progress, medicines & symptom checker.</p>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit max-w-full">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white/15 text-white shadow-inner'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'clinical' && <ClinicalRecordsTab />}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'progress' && <ProgressTab />}
        {activeTab === 'medicines' && <MedicinesTab />}
        {activeTab === 'symptoms' && <SymptomsTab />}
      </div>
    </div>
  );
}
// {urgency}
//             </span>
//           </div>
//           <div className="flex gap-2">
//             <a href="/appointments" className="btn-primary btn-sm">
//               <Calendar size={14} /> Book Appointment
//             </a>
//             <button onClick={reset} className="btn-ghost btn-sm">Check Again</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Main My Health page ────────────────────────────────────────────────────
// export default function PatientDashboard() {
//   const [activeTab, setActiveTab] = useState('reports');

//   return (
//     <div className="animate-fade-in space-y-6">
//       {/* Header */}
//       <div>
//         <h2 className="text-3xl font-bold text-white">
//           My <span className="gradient-text">Health</span>
//         </h2>
//         <p className="mt-1 text-zinc-400">Reports, timeline, progress, medicines & symptom checker.</p>
//       </div>

//       {/* Tab bar */}
//       <div className="flex overflow-x-auto gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 w-fit max-w-full">
//         {TABS.map(t => {
//           const Icon = t.icon;
//           return (
//             <button
//               key={t.id}
//               onClick={() => setActiveTab(t.id)}
//               className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
//                 activeTab === t.id
//                   ? 'bg-white/15 text-white shadow-inner'
//                   : 'text-zinc-400 hover:text-zinc-200'
//               }`}
//             >
//               <Icon size={14} />
//               {t.label}
//             </button>
//           );
//         })}
//       </div>

//       {/* Tab content */}
//       <div className="min-h-[400px]">
//         {activeTab === 'reports' && <ReportsTab />}
//         {activeTab === 'timeline' && <TimelineTab />}
//         {activeTab === 'progress' && <ProgressTab />}
//         {activeTab === 'medicines' && <MedicinesTab />}
//         {activeTab === 'symptoms' && <SymptomsTab />}
//       </div>
//     </div>
//   );
// }
