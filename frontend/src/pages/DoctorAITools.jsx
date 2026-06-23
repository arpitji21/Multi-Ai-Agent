import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Pill, FileText, RefreshCw, Brain, Save,
  CheckCircle, AlertCircle, Mic, Upload, ArrowLeft, Calendar,
  ChevronDown, Loader
} from 'lucide-react';
import api from '../lib/api';

const TABS = [
  { id: 'emr', label: 'EMR Generator', icon: ClipboardList, color: 'text-emerald-400' },
  { id: 'prescription', label: 'Prescription Drafter', icon: Pill, color: 'text-blue-400' },
  { id: 'report', label: 'Report Summarizer', icon: FileText, color: 'text-amber-400' },
  { id: 'followup', label: 'Follow-up Advisor', icon: RefreshCw, color: 'text-violet-400' },
];

function AiSpinner() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <Loader className="h-4 w-4 animate-spin text-brand-400" />
      AI is processing…
    </div>
  );
}

function SaveBanner({ message, type = 'success', pdfUrl }) {
  if (!message) return null;
  return (
    <div className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${type === 'success'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
      }`}>
      <div className="flex items-center gap-2">
        {type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        {message}
      </div>
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 font-bold underline decoration-emerald-500/30 underline-offset-4 hover:text-white transition"
        >
          <FileText size={14} /> Download PDF
        </a>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── EMR GENERATOR ── */
function EMRGenerator({ patients, prefill }) {
  const [patientId, setPatientId] = useState(prefill.patient || '');
  const [apptId, setApptId] = useState(prefill.appt || '');
  const [notes, setNotes] = useState('');
  const [vitalBP, setVitalBP] = useState('');
  const [vitalTemp, setVitalTemp] = useState('');
  const [vitalPulse, setVitalPulse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOutput, setAiOutput] = useState(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescription, setPrescription] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  async function generateEMR() {
    if (!notes.trim()) return;
    setAiLoading(true);
    setAiOutput(null);
    try {
      const res = await api.post('/ai/generate-emr', {
        notes,
        patient_id: patientId ? parseInt(patientId) : null,
        vitals: { bp: vitalBP, temp: vitalTemp, pulse: vitalPulse }
      });

      const data = res.data.emr || res.data;
      setAiOutput(JSON.stringify(data));

      setDiagnosis(data.diagnosis || '');
      setTreatment(data.treatment_plan || '');
      setPrescription(data.prescription || '');

      const aiDate = data.follow_up_date || '';

      if (/^\d{4}-\d{2}-\d{2}$/.test(aiDate)) {
        setFollowUp(aiDate);
      } else {
        setFollowUp('');
      }
    } catch {
      setAiOutput('AI generation failed. Please fill in the fields manually.');
    } finally {
      setAiLoading(false);
    }
  }

  async function saveEMR() {
    if (!patientId || !diagnosis) {
      setBanner({ msg: 'Patient and diagnosis are required.', type: 'error' });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const vital_signs = (vitalBP || vitalTemp || vitalPulse)
        ? { bp: vitalBP, temp: vitalTemp, pulse: vitalPulse }
        : null;

      console.log('Saving EMR:', {
        patient_id: parseInt(patientId),
        appointment_id: apptId ? parseInt(apptId) : null,
        diagnosis,
        treatment_plan: treatment,
        prescription,
        follow_up_date: followUp,
      });

      const res = await api.post('/emr', {
        patient_id: parseInt(patientId),
        appointment_id: apptId ? parseInt(apptId) : null,
        diagnosis,
        treatment_plan: treatment,
        prescription,
        follow_up_date:
          followUp && /^\d{4}-\d{2}-\d{2}$/.test(followUp)
            ? followUp
            : null,
        notes,
        vital_signs,
      });

      const emrId = res.data.id;
      let pdfUrl = null;
      try {
        const pdfRes = await api.get(`/emr/${emrId}/pdf`);
        if (pdfRes.data.pdf_url) {
          // Resolve relative path against the backend origin
          const backendBase = api.defaults.baseURL.replace(/\/api$/, '');
          pdfUrl = `${backendBase}${pdfRes.data.pdf_url}`;
        }
      } catch (e) { console.error('PDF fetch error', e); }

      setBanner({ msg: 'EMR saved successfully!', type: 'success', pdfUrl });
      setNotes(''); setAiOutput(null); setDiagnosis(''); setTreatment(''); setPrescription(''); setFollowUp('');
    } catch (err) {
      setBanner({ msg: err.response?.data?.error || 'Failed to save EMR.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Patient</label>
          <select
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            className="input mt-1.5"
          >
            <option value="">Select patient…</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Appointment ID (optional)</label>
          <input
            type="number"
            value={apptId}
            onChange={e => setApptId(e.target.value)}
            className="input"
            placeholder="Link to appointment…"
          />
        </div>
      </div>

      {/* Vitals */}
      <div>
        <p className="field-label mb-2">Vital Signs (optional)</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'BP (mmHg)', val: vitalBP, set: setVitalBP, ph: '120/80' },
            { label: 'Temp (°F)', val: vitalTemp, set: setVitalTemp, ph: '98.6' },
            { label: 'Pulse (bpm)', val: vitalPulse, set: setVitalPulse, ph: '72' },
          ].map(v => (
            <div key={v.label}>
              <label className="text-xs text-zinc-500">{v.label}</label>
              <input value={v.val} onChange={e => v.set(e.target.value)} placeholder={v.ph} className="input text-sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between">
          <label className="field-label">Clinical Notes / Consultation Summary</label>
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-500">
            <Mic className="h-3 w-3" /> Voice dictation (coming soon)
          </div>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={6}
          className="input mt-1.5 resize-none"
          placeholder="Type or paste consultation notes here. AI will generate a structured EMR from these notes…"
        />
      </div>

      <button
        onClick={generateEMR}
        disabled={aiLoading || !notes.trim()}
        className="btn-primary w-full"
      >
        {aiLoading ? <AiSpinner /> : <><Brain className="h-4 w-4" /> Generate Structured EMR</>}
      </button>

      {/* AI Output & editable fields */}
      {(aiOutput || diagnosis) && (
        <div className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-300">
            <Brain className="h-4 w-4" /> AI-Generated EMR — Review & Edit
          </p>

          <div>
            <label className="field-label">Diagnosis</label>
            <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="input" placeholder="Primary diagnosis…" />
          </div>
          <div>
            <label className="field-label">Treatment Plan</label>
            <textarea value={treatment} onChange={e => setTreatment(e.target.value)} rows={3} className="input resize-none" placeholder="Treatment steps…" />
          </div>
          <div>
            <label className="field-label">Prescription</label>
            <textarea value={prescription} onChange={e => setPrescription(e.target.value)} rows={3} className="input resize-none" placeholder="Medications, dosages, frequency…" />
          </div>
          <div>
            <label className="field-label">Follow-up Date</label>
            <input
              type="date"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              className="input"
            />
          </div>

          {banner && <SaveBanner message={banner.msg} type={banner.type} pdfUrl={banner.pdfUrl} />}

          <button onClick={saveEMR} disabled={saving} className="btn-success w-full">
            {saving ? <AiSpinner /> : <><Save className="h-4 w-4" /> Save EMR to Patient Record</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── PRESCRIPTION DRAFTER ── */
function PrescriptionDrafter({ patients, prefill }) {
  const [patientId, setPatientId] = useState(prefill.patient || '');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  async function generatePrescription() {
    if (!complaint.trim()) return;
    setAiLoading(true);
    setDraft('');
    try {
      const res = await api.post('/ai/chat', {
        message: `You are a clinical prescription assistant. Generate a professional prescription draft based on:
Chief Complaint: ${complaint}
Clinical Notes: ${notes || 'None provided'}

Format the prescription as:
1. MEDICATIONS: List each medication with name, dosage, frequency, duration
2. INSTRUCTIONS: Patient instructions and precautions
3. REFILLS: Refill guidance
4. WARNINGS: Drug interactions or allergy flags to check

Make it clinically appropriate but note this is a draft for doctor review.`,
        context: { type: 'prescription_draft', patient_id: patientId },
      });
      setDraft(res.data.reply);
    } catch {
      setDraft('Unable to generate prescription. Please draft manually.');
    } finally {
      setAiLoading(false);
    }
  }

  async function savePrescription() {
    if (!patientId || !draft) {
      setBanner({ msg: 'Patient and prescription are required.', type: 'error' });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      await api.post('/emr', {
        patient_id: parseInt(patientId),
        diagnosis: complaint,
        prescription: draft,
        notes: `Chief complaint: ${complaint}\n${notes}`,
      });
      setBanner({ msg: 'Prescription saved to patient EMR!', type: 'success' });
      setComplaint(''); setNotes(''); setDraft('');
    } catch (err) {
      setBanner({ msg: err.response?.data?.error || 'Failed to save.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="field-label">Patient</label>
        <select value={patientId} onChange={e => setPatientId(e.target.value)} className="input mt-1.5">
          <option value="">Select patient…</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="field-label">Chief Complaint / Condition</label>
        <input
          value={complaint}
          onChange={e => setComplaint(e.target.value)}
          className="input"
          placeholder="e.g. Hypertension, Type 2 Diabetes, Upper respiratory infection…"
        />
      </div>

      <div>
        <label className="field-label">Additional Clinical Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          className="input resize-none"
          placeholder="Symptoms, test results, patient history relevant to prescription…"
        />
      </div>

      <button onClick={generatePrescription} disabled={aiLoading || !complaint.trim()} className="btn-primary w-full">
        {aiLoading ? <AiSpinner /> : <><Pill className="h-4 w-4" /> Generate Draft Prescription</>}
      </button>

      {draft && (
        <div className="space-y-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <Pill className="h-4 w-4" /> Draft Prescription — Review & Edit
          </p>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={10}
            className="input resize-none font-mono text-xs"
          />
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-400">
            ⚠ This is an AI-generated draft. Review carefully before prescribing. Always verify drug interactions and patient allergies.
          </div>
          {banner && <SaveBanner message={banner.msg} type={banner.type} pdfUrl={banner.pdfUrl} />}
          <button onClick={savePrescription} disabled={saving} className="btn-success w-full">
            {saving ? <AiSpinner /> : <><Save className="h-4 w-4" /> Save Prescription to EMR</>}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── CLINICAL REPORT SUMMARIZER ── */
function LabValuesTable({ labValues }) {
  if (!labValues?.length) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.03] text-zinc-500">
          <tr>
            <th className="px-3 py-2">Marker</th>
            <th className="px-3 py-2">Value</th>
            <th className="px-3 py-2">Reference</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {labValues.map((lv, i) => (
            <tr key={i} className={lv.is_critical ? 'bg-rose-500/10' : lv.status !== 'normal' ? 'bg-amber-500/5' : ''}>
              <td className="px-3 py-2 font-medium text-zinc-200">{lv.marker}</td>
              <td className="px-3 py-2 text-zinc-300">{lv.value} {lv.unit}</td>
              <td className="px-3 py-2 text-zinc-500">{lv.reference_range}</td>
              <td className={`px-3 py-2 capitalize ${lv.is_critical ? 'text-rose-400 font-semibold' : lv.status !== 'normal' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {lv.is_critical ? 'critical' : lv.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StructuredClinicalResult({ data, accent = 'amber' }) {
  if (!data) return null;
  const accentMap = {
    amber: { border: 'border-amber-500/20', bg: 'bg-amber-500/[0.04]', title: 'text-amber-300' },
    violet: { border: 'border-violet-500/20', bg: 'bg-violet-500/[0.04]', title: 'text-violet-300' },
  };
  const s = accentMap[accent] || accentMap.amber;

  return (
    <div className={`space-y-4 rounded-2xl border p-5 ${s.border} ${s.bg}`}>
      {data.engine && (
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          Engine: {data.engine}{data.ai_enhanced ? ' + AI refinement' : ''}
        </p>
      )}

      {data.lab_values?.length > 0 && (
        <div>
          <p className={`mb-2 text-sm font-semibold ${s.title}`}>Parsed Lab Values</p>
          <LabValuesTable labValues={data.lab_values} />
        </div>
      )}

      {data.key_findings?.length > 0 && (
        <div>
          <p className={`mb-2 text-sm font-semibold ${s.title}`}>Key Findings</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {data.key_findings.map((f, i) => <li key={i}>• {f}</li>)}
          </ul>
        </div>
      )}

      {data.abnormal_values?.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-rose-300">Abnormal Values</p>
          <ul className="space-y-1 text-sm text-rose-200/90">
            {data.abnormal_values.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}

      {data.clinical_impression && (
        <div>
          <p className={`mb-1 text-sm font-semibold ${s.title}`}>Clinical Impression</p>
          <p className="text-sm text-zinc-300">{data.clinical_impression}</p>
        </div>
      )}

      {data.recommended_actions?.length > 0 && (
        <div>
          <p className={`mb-2 text-sm font-semibold ${s.title}`}>Recommended Actions</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {data.recommended_actions.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}

      {data.required_tests?.length > 0 && (
        <div>
          <p className={`mb-2 text-sm font-semibold ${s.title}`}>Required Tests</p>
          <ul className="space-y-1 text-sm text-zinc-300">
            {data.required_tests.map((t, i) => <li key={i}>• {t}</li>)}
          </ul>
        </div>
      )}

      {data.monitoring_plan && (
        <div>
          <p className={`mb-1 text-sm font-semibold ${s.title}`}>Monitoring Plan</p>
          <p className="text-sm text-zinc-300">{data.monitoring_plan}</p>
        </div>
      )}

      {data.lifestyle_recommendations && (
        <div>
          <p className={`mb-1 text-sm font-semibold ${s.title}`}>Lifestyle Recommendations</p>
          <p className="text-sm text-zinc-300">{data.lifestyle_recommendations}</p>
        </div>
      )}

      {data.emergency_warning_signs && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-rose-300">Emergency Warning Signs</p>
          <p className="text-sm text-rose-200/90">{data.emergency_warning_signs}</p>
        </div>
      )}

      {data.narrative && (
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">{data.narrative}</p>
        </div>
      )}
    </div>
  );
}

function ReportSummarizer() {
  const [mode, setMode] = useState('paste');
  const [reportText, setReportText] = useState('');
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileError, setFileError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setFileContent('');
    setFileError('');
    if (!selected) return;

    const isText = selected.type.startsWith('text/') ||
      selected.name.endsWith('.txt') ||
      selected.name.endsWith('.csv');

    if (isText) {
      const reader = new FileReader();
      reader.onload = ev => setFileContent(ev.target.result || '');
      reader.onerror = () => setFileError('Could not read file. Try pasting the text instead.');
      reader.readAsText(selected);
    } else if (selected.name.endsWith('.pdf')) {
      setFileError('');
    } else {
      setFileError('Supported formats: .txt, .csv, .pdf');
    }
  }

  async function summarize() {
    setAiLoading(true);
    setSummary(null);
    try {
      let res;
      if (mode === 'upload' && file?.name.endsWith('.pdf')) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('report_type', 'general');
        res = await api.post('/ai/clinical/summarize-report', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        const text = (mode === 'paste' ? reportText : fileContent).trim();
        if (!text) return;
        res = await api.post('/ai/clinical/summarize-report', { text, report_type: 'general' });
      }
      setSummary(res.data);
    } catch {
      setSummary({ success: false, narrative: 'Unable to process report summary. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  }

  const hasCritical = summary?.is_critical || summary?.abnormal_values?.some(a => /critical/i.test(a));
  const canSubmit = mode === 'paste'
    ? !!reportText.trim()
    : file?.name?.endsWith('.pdf') ? !!file : !!fileContent.trim();

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          { id: 'paste', label: 'Paste Text' },
          { id: 'upload', label: 'Upload File' },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setFile(null); setFileContent(''); setFileError(''); }}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${mode === m.id
                ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'paste' ? (
        <div>
          <label className="field-label">Report Text</label>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            rows={10}
            className="input mt-1.5 resize-none font-mono text-xs"
            placeholder="Paste the full clinical report here (blood tests, radiology, pathology, etc.)…"
          />
        </div>
      ) : (
        <div>
          <label className="field-label">Upload Report (.txt, .csv, .pdf)</label>
          <label className="mt-1.5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-10 transition hover:border-white/30 hover:bg-white/[0.04]">
            <Upload className="h-8 w-8 text-zinc-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">Click to upload or drag & drop</p>
              <p className="mt-1 text-xs text-zinc-600">PDF parsed server-side with Python (pdfplumber)</p>
            </div>
            {file && !fileError && <p className="text-xs text-brand-400">✓ {file.name} — ready to analyze</p>}
            <input type="file" className="hidden" accept=".txt,.csv,.pdf,text/*,application/pdf" onChange={handleFileChange} />
          </label>
          {fileError && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              ⚠ {fileError}
            </div>
          )}
          {fileContent && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-zinc-500">Extracted content preview:</p>
              <textarea
                value={fileContent}
                onChange={e => setFileContent(e.target.value)}
                rows={6}
                className="input resize-none font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}

      <button
        onClick={summarize}
        disabled={aiLoading || !canSubmit}
        className="btn-primary w-full"
      >
        {aiLoading ? <AiSpinner /> : <><FileText className="h-4 w-4" /> Summarize Report (Python + AI)</>}
      </button>

      {summary && (
        <div className={`space-y-3 ${hasCritical ? 'rounded-2xl border border-rose-500/30 p-1' : ''}`}>
          {hasCritical && (
            <p className="px-4 pt-3 text-sm font-semibold text-rose-300">⚠ Critical Values Detected</p>
          )}
          <StructuredClinicalResult data={summary} accent="amber" />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── FOLLOW-UP RECOMMENDER ── */
function FollowUpRecommender({ patients, prefill }) {
  const [patientId, setPatientId] = useState(prefill.patient || '');
  const [patientName, setPatientName] = useState(prefill.pname || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    if (prefill.pname) setPatientName(decodeURIComponent(prefill.pname));
  }, [prefill.pname]);

  async function getRecommendation() {
    if (!diagnosis.trim()) return;
    setAiLoading(true);
    setRecommendation(null);
    setPlanData(null);
    try {
      const res = await api.post('/ai/clinical/followup-plan', {
        patient_id: patientId ? parseInt(patientId) : null,
        diagnosis,
        treatment,
        notes,
      });

      const data = res.data;
      setPlanData(data);
      setRecommendation(data.narrative || '');

      if (data.follow_up_date) {
        setSuggestedDate(data.follow_up_date);
      } else {
        const dateMatch = data.narrative?.match(/(\d+)\s*(week|month|day)/i);
        if (dateMatch) {
          const num = parseInt(dateMatch[1]);
          const unit = dateMatch[2].toLowerCase();
          const d = new Date();
          if (unit.startsWith('day')) d.setDate(d.getDate() + num);
          else if (unit.startsWith('week')) d.setDate(d.getDate() + num * 7);
          else if (unit.startsWith('month')) d.setMonth(d.getMonth() + num);
          setSuggestedDate(d.toISOString().split('T')[0]);
        }
      }
    } catch {
      setRecommendation('Unable to generate follow-up plan. Please schedule manually.');
    } finally {
      setAiLoading(false);
    }
  }

  async function confirmFollowUp() {
    if (!patientId || !suggestedDate) {
      setBanner({ msg: 'Patient and follow-up date required.', type: 'error' });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      // Create the actual follow-up appointment via dedicated doctor endpoint
      await api.post('/appointments/followup', {
        patient_id: parseInt(patientId),
        appointment_date: suggestedDate,
        appointment_time: '09:00',
        reason: `Follow-up: ${diagnosis}`,
      });

      // Also save the recommendation to EMR for clinical record
      await api.post('/emr', {
        patient_id: parseInt(patientId),
        diagnosis,
        treatment_plan: treatment,
        follow_up_date: suggestedDate,
        notes: `AI Follow-up Recommendation:\n${recommendation}`,
      }).catch(() => { });

      setBanner({ msg: `Follow-up appointment booked for ${suggestedDate} and saved to EMR!`, type: 'success' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to schedule follow-up.';
      setBanner({ msg, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Patient</label>
          <select
            value={patientId}
            onChange={e => {
              setPatientId(e.target.value);
              const p = patients.find(p => p.id === parseInt(e.target.value));
              if (p) setPatientName(p.name);
            }}
            className="input mt-1.5"
          >
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Diagnosis / Condition Treated</label>
          <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="input" placeholder="Primary diagnosis…" />
        </div>
      </div>

      <div>
        <label className="field-label">Treatment Provided</label>
        <input value={treatment} onChange={e => setTreatment(e.target.value)} className="input" placeholder="Medications given, procedures performed…" />
      </div>

      <div>
        <label className="field-label">Consultation Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input resize-none" placeholder="Any additional context for follow-up planning…" />
      </div>

      <button onClick={getRecommendation} disabled={aiLoading || !diagnosis.trim()} className="btn-primary w-full">
        {aiLoading ? <AiSpinner /> : <><RefreshCw className="h-4 w-4" /> Generate Follow-up Plan (Python + AI)</>}
      </button>

      {recommendation && (
        <div className="space-y-4">
          {planData?.condition_matched && planData.condition_matched !== 'default' && (
            <p className="text-xs text-zinc-500">
              Matched guideline: <span className="text-violet-400 capitalize">{planData.condition_matched}</span>
              {planData.interval_days ? ` · ${planData.interval_days} day interval` : ''}
            </p>
          )}
          <StructuredClinicalResult data={planData || { narrative: recommendation }} accent="violet" />

          {/* Confirm follow-up */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="mb-3 text-sm font-medium text-zinc-200">Confirm Follow-up Date</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-zinc-500">Suggested Date</label>
                <input
                  type="date"
                  value={suggestedDate}
                  onChange={e => setSuggestedDate(e.target.value)}
                  className="input mt-1"
                />
              </div>
              <button onClick={confirmFollowUp} disabled={saving || !suggestedDate} className="btn-success mt-5">
                {saving ? <AiSpinner /> : <><Calendar className="h-4 w-4" /> Confirm & Save</>}
              </button>
            </div>
          </div>

          {banner && <SaveBanner message={banner.msg} type={banner.type} pdfUrl={banner.pdfUrl} />}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── MAIN PAGE ── */
export default function DoctorAITools() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'emr');
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const prefill = {
    patient: searchParams.get('patient') || '',
    appt: searchParams.get('appt') || '',
    pname: searchParams.get('pname') || '',
  };

  useEffect(() => {
    api.get('/patients').then(r => setPatients(r.data || [])).finally(() => setLoadingPatients(false));
  }, []);

  const activeTabDef = TABS.find(t => t.id === activeTab) || TABS[0];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/doctor')} className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </button>
        <div className="h-4 w-px bg-white/15" />
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-400" />
          AI Clinical Tools
        </h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${activeTab === tab.id
                ? 'bg-white/15 text-white shadow-inner'
                : 'text-zinc-500 hover:text-zinc-300'
              }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.07] ${activeTabDef.color}`}>
            <activeTabDef.icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{activeTabDef.label}</h2>
            <p className="text-xs text-zinc-500">
              {activeTab === 'emr' && 'Enter consultation notes → AI generates structured EMR → review & save'}
              {activeTab === 'prescription' && 'Enter chief complaint → AI drafts prescription → edit & save to EMR'}
              {activeTab === 'report' && 'Paste or upload clinical report → AI extracts key findings'}
              {activeTab === 'followup' && 'Enter diagnosis & treatment → AI recommends follow-up plan & timeline'}
            </p>
          </div>
        </div>

        {loadingPatients ? (
          <div className="flex items-center gap-2 py-8 text-zinc-400">
            <Loader className="h-4 w-4 animate-spin" /> Loading patient list…
          </div>
        ) : (
          <>
            {activeTab === 'emr' && <EMRGenerator patients={patients} prefill={prefill} />}
            {activeTab === 'prescription' && <PrescriptionDrafter patients={patients} prefill={prefill} />}
            {activeTab === 'report' && <ReportSummarizer />}
            {activeTab === 'followup' && <FollowUpRecommender patients={patients} prefill={prefill} />}
          </>
        )}
      </div>
    </div>
  );
}
