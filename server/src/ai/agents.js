const { callAI, smartFallback } = require('./client');
const { getSystemPrompt } = require('./prompts');
const { query } = require('../db');
const fs = require('fs');
const path = require('path');

/* ── Context-type → agent-type mapping ── */
function resolveAgentType(contextType, userRole) {
  const map = {
    report_comparison: 'report_comparison',
    report_analysis: 'report_analysis',
    health_progress: 'health_progress',
    symptom_check: 'symptom_checker',
    emr: 'emr_generator',
    emr_generator: 'emr_generator',
    emr_generation: 'emr_generator',
    prescription_draft: 'doctor_assistant',
    report_summary: 'doctor_assistant',
    followup_recommendation: 'doctor_assistant',
    appointment: 'appointment_scheduler',
    appointment_scheduler: 'appointment_scheduler',
    admin_analytics: 'admin_assistant',
    analytics: 'hospital_analytics',
    hospital_analytics: 'hospital_analytics',
    doctor: 'doctor_assistant',
    doctor_assistant: 'doctor_assistant',
    patient: 'patient_assistant',
    patient_assistant: 'patient_assistant',
  };

  if (contextType && map[contextType]) return map[contextType];

  // Route by role if no context type
  if (userRole === 'doctor') return 'doctor_assistant';
  if (userRole === 'admin') return 'admin_assistant';
  return 'patient_assistant';
}

/* ── Orchestrator ── */
async function orchestrate({ message, context, userRole, userId, history }) {
  const agentType = resolveAgentType(context?.type, userRole);
  const systemPrompt = getSystemPrompt(agentType);

  // Enrich context with relevant DB data
  let enrichedContext = { ...context };

  if (agentType === 'admin_assistant' || agentType === 'hospital_analytics') {
    try {
      const [statsRes, deptRes, revRes] = await Promise.all([
        query(`
          SELECT
            (SELECT COUNT(*) FROM patients) AS total_patients,
            (SELECT COUNT(*) FROM doctors WHERE available=true) AS active_doctors,
            (SELECT COUNT(*) FROM doctors) AS total_doctors,
            (SELECT COUNT(*) FROM appointments WHERE appointment_date=CURRENT_DATE) AS today_appointments,
            (SELECT COUNT(*) FROM appointments WHERE status='completed' AND appointment_date >= NOW() - INTERVAL '30 days') AS monthly_completed,
            (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND created_at >= NOW() - INTERVAL '30 days') AS monthly_revenue
        `),
        query(`
          SELECT dep.name, COUNT(a.id) AS appointments,
                 COALESCE(SUM(pay.amount),0) AS revenue
          FROM departments dep
          LEFT JOIN doctors doc ON doc.department_id=dep.id
          LEFT JOIN appointments a ON a.doctor_id=doc.id AND a.created_at >= NOW() - INTERVAL '30 days'
          LEFT JOIN payments pay ON pay.appointment_id=a.id AND pay.status='paid'
          GROUP BY dep.name ORDER BY revenue DESC LIMIT 5
        `),
        query(`
          SELECT TO_CHAR(DATE_TRUNC('month', created_at),'Mon YYYY') AS month,
                 COALESCE(SUM(amount),0) AS revenue,
                 COUNT(*) AS transactions
          FROM payments WHERE status='paid'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at) DESC LIMIT 6
        `),
      ]);
      enrichedContext.stats = statsRes.rows[0];
      enrichedContext.department_performance = deptRes.rows;
      enrichedContext.revenue_history = revRes.rows.reverse();
    } catch (e) {
      console.error('Context enrichment error:', e.message);
    }
  }

  if (agentType === 'doctor_assistant' && context?.patient_id) {
    try {
      const [patRes, apptRes, rptRes] = await Promise.all([
        query(`SELECT p.*, u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1`, [context.patient_id]),
        query(`SELECT a.*, d.specialty FROM appointments a JOIN doctors d ON d.id=a.doctor_id WHERE a.patient_id=$1 ORDER BY a.appointment_date DESC LIMIT 3`, [context.patient_id]),
        query(`SELECT r.*, aa.patient_summary, aa.abnormal_values, aa.is_critical FROM reports r LEFT JOIN ai_analyses aa ON aa.report_id=r.id WHERE r.patient_id=$1 ORDER BY r.created_at DESC LIMIT 3`, [context.patient_id]),
      ]);
      enrichedContext.patient = patRes.rows[0];
      enrichedContext.recent_appointments = apptRes.rows;
      enrichedContext.recent_reports = rptRes.rows;
    } catch (e) {
      console.error('Doctor context enrichment error:', e.message);
    }
  }

  if (agentType === 'patient_assistant' && userId) {
    try {
      const patRes = await query(`
        SELECT p.health_score, p.allergies, p.blood_group, p.gender
        FROM patients p JOIN users u ON u.id=p.user_id WHERE u.id=$1
      `, [userId]);
      if (patRes.rows[0]) enrichedContext.health_score = patRes.rows[0].health_score;
    } catch (e) {}
  }

  // Build enriched user message
  let enrichedMessage = message;

  if ((agentType === 'admin_assistant' || agentType === 'hospital_analytics') && enrichedContext.stats) {
    const s = enrichedContext.stats;
    const deptSummary = (enrichedContext.department_performance || [])
      .map(d => `${d.name}: ${d.appointments} appts, $${parseFloat(d.revenue).toLocaleString()} revenue`)
      .join('; ');
    const revSummary = (enrichedContext.revenue_history || [])
      .map(r => `${r.month}: $${parseFloat(r.revenue).toLocaleString()}`)
      .join(', ');
    enrichedMessage = `[Hospital Context]\nPatients: ${s.total_patients}, Doctors: ${s.total_doctors} (${s.active_doctors} active), Today's appointments: ${s.today_appointments}, Monthly revenue: $${parseFloat(s.monthly_revenue || 0).toLocaleString()}, Monthly completed appointments: ${s.monthly_completed}\nDepartment performance (last 30 days): ${deptSummary || 'No data'}\nRevenue history: ${revSummary || 'No data'}\n\n[User Question]\n${message}`;
  }

  if (agentType === 'doctor_assistant' && enrichedContext.patient) {
    const p = enrichedContext.patient;
    const recentRpts = (enrichedContext.recent_reports || []).map(r =>
      `${r.report_type} (${r.created_at?.split('T')[0]}): ${r.patient_summary || 'No AI analysis'}`
    ).join('; ') || 'None';
    enrichedMessage = `[Patient Context]\nName: ${p.first_name} ${p.last_name}, Age: ${p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000) : 'unknown'}, Gender: ${p.gender || 'unknown'}\nBlood Group: ${p.blood_group || 'unknown'}, Allergies: ${p.allergies || 'none'}, Health Score: ${p.health_score}/100\nRecent Reports: ${recentRpts}\n\n[Doctor Request]\n${message}`;
  }

  const reply = await callAI(systemPrompt, enrichedMessage, {
    agentType,
    context: enrichedContext,
    history,
    maxTokens: 1000,
  });

  return { reply: typeof reply === 'string' ? reply : JSON.stringify(reply, null, 2), agentType };
}

/* ── Report Analysis Agent ── */
async function analyzeReport(report, existingAnalysis) {
  // Try to read the uploaded file content
  let fileContent = '';
  if (report.file_path) {
    const uploadsDir = path.join(__dirname, '../../uploads');
    const filePath = path.join(uploadsDir, report.file_path);
    try {
      if (fs.existsSync(filePath) && (report.file_type?.includes('text') || report.file_name?.endsWith('.txt'))) {
        fileContent = fs.readFileSync(filePath, 'utf8').slice(0, 3000);
      }
    } catch (e) { /* ignore */ }
  }

  const systemPrompt = getSystemPrompt('report_analysis');
  const userMessage = `Analyze this medical report and return structured JSON analysis.

Report Type: ${report.report_type || 'general'}
File Name: ${report.file_name}
File Type: ${report.file_type || 'unknown'}
Patient Notes: ${report.notes || 'none'}
${fileContent ? `\nReport Content:\n${fileContent}` : '\n[Binary file — analyze based on report type and available metadata]'}

Return ONLY valid JSON matching the schema in your instructions.`;

  try {
    const raw = await callAI(systemPrompt, userMessage, {
      agentType: 'report_analysis',
      maxTokens: 1200,
      temperature: 0.3,
    });

    // Parse JSON response
    let parsed;
    if (typeof raw === 'object') {
      parsed = raw;
    } else {
      const jsonMatch = raw.match(/\{[\s\S]+\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]);
    }

    return {
      patient_summary: parsed.patient_summary || generateReportFallback(report, 'patient'),
      doctor_summary: parsed.doctor_summary || generateReportFallback(report, 'doctor'),
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
      abnormal_values: Array.isArray(parsed.abnormal_values) ? parsed.abnormal_values : [],
      is_critical: Boolean(parsed.is_critical),
      emergency_reason: parsed.emergency_reason || null,
      recommendations: parsed.recommendations || 'Follow up with your healthcare provider.',
      health_score_impact: typeof parsed.health_score_impact === 'number' ? parsed.health_score_impact : 0,
    };
  } catch (err) {
    // Intelligent fallback for report analysis
    return generateReportFallback(report, 'full');
  }
}

function generateReportFallback(report, mode) {
  const type = (report.report_type || 'general').toLowerCase();
  const typeMap = {
    blood: {
      patient_summary: 'Your blood test results have been received and reviewed. The report provides important information about your blood cell counts, chemistry, and overall blood health. Please discuss the specific values with your doctor at your next appointment.',
      doctor_summary: `CBC/Blood panel received. Patient: ${report.file_name}. Complete hematological and biochemical review recommended. Compare with baseline values and assess clinical correlation.`,
      key_findings: ['Blood panel received', 'Complete blood count analyzed', 'Biochemical markers recorded'],
      abnormal_values: [],
    },
    ecg: {
      patient_summary: 'Your ECG (heart tracing) report has been uploaded and is ready for your doctor\'s review. The ECG records the electrical activity of your heart. Your cardiologist will interpret the findings at your appointment.',
      doctor_summary: 'ECG tracing received. Rhythm analysis, axis deviation, ST/T wave changes, and interval measurements require physician interpretation. Compare with prior ECGs if available.',
      key_findings: ['Cardiac rhythm documented', 'ECG tracing recorded', 'Heart rate assessment pending'],
      abnormal_values: [],
    },
    xray: {
      patient_summary: 'Your X-ray images have been uploaded successfully. X-rays provide detailed images of your bones and some soft tissues. Your doctor will review and interpret the images.',
      doctor_summary: 'Radiograph received. Systematic review of bony structures, soft tissues, and any pathological findings required. Clinical correlation with patient symptoms recommended.',
      key_findings: ['Radiographic study received', 'Images uploaded for review', 'Radiological assessment pending'],
      abnormal_values: [],
    },
    mri: {
      patient_summary: 'Your MRI scan has been uploaded. MRI provides detailed images of your internal organs and tissues without radiation. A specialist radiologist will review the images and report findings to your doctor.',
      doctor_summary: 'MRI study received. Detailed sequence review including T1/T2 weighted images required. Specialist radiological interpretation recommended before clinical decision-making.',
      key_findings: ['MRI study received', 'Multi-sequence imaging documented', 'Radiologist review required'],
      abnormal_values: [],
    },
  };

  const defaults = {
    patient_summary: `Your ${type} report has been successfully uploaded and processed. Your healthcare provider will review the findings and discuss them with you at your next appointment. If you have any urgent concerns, please contact your doctor's office directly.`,
    doctor_summary: `Medical report (${type}) received and catalogued. File: ${report.file_name}. Clinical interpretation and correlation with patient presentation required. Review in context of patient's complete medical history.`,
    key_findings: ['Report uploaded successfully', 'Document ready for physician review', 'Clinical correlation recommended'],
    abnormal_values: [],
  };

  const data = typeMap[type] || defaults;

  if (mode === 'patient') return data.patient_summary;
  if (mode === 'doctor') return data.doctor_summary;
  return {
    patient_summary: data.patient_summary,
    doctor_summary: data.doctor_summary,
    key_findings: data.key_findings,
    abnormal_values: data.abnormal_values,
    is_critical: false,
    emergency_reason: null,
    recommendations: 'Discuss report findings with your healthcare provider at your next scheduled appointment.',
    health_score_impact: 0,
  };
}

/* ── Symptom Check Agent ── */
async function symptomCheck({ symptoms, duration, severity, userId }) {
  const systemPrompt = getSystemPrompt('symptom_checker');
  const userMessage = `Patient symptom assessment:
Symptoms: ${symptoms.join(', ')}
Duration: ${duration || 'not specified'}
Severity (1-10): ${severity || 5}

Return ONLY valid JSON matching the response schema.`;

  try {
    const raw = await callAI(systemPrompt, userMessage, {
      agentType: 'symptom_check',
      context: { symptoms, severity },
      maxTokens: 600,
      temperature: 0.4,
    });

    if (typeof raw === 'object') return raw;

    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { suggested_department: 'General Medicine', urgency: 'routine', message: raw };
  } catch (e) {
    return smartFallback('symptom_check', symptoms.join(', '), { symptoms, severity });
  }
}

/* ── Dynamic Health Score Calculator ── */
async function calculateHealthScore(patientId) {
  try {
    const [patRes, reportRes, apptRes] = await Promise.all([
      query(`SELECT health_score FROM patients WHERE id=$1`, [patientId]),
      query(`
        SELECT aa.is_critical, aa.health_score_impact, aa.abnormal_values
        FROM ai_analyses aa
        JOIN reports r ON r.id=aa.report_id
        WHERE r.patient_id=$1 AND r.created_at >= NOW() - INTERVAL '90 days'
        ORDER BY r.created_at DESC LIMIT 10
      `, [patientId]),
      query(`
        SELECT status, appointment_date FROM appointments
        WHERE patient_id=$1 AND appointment_date >= NOW() - INTERVAL '90 days'
      `, [patientId]),
    ]);

    let baseScore = patRes.rows[0]?.health_score || 75;

    // Adjust based on recent reports
    let reportAdjustment = 0;
    for (const r of reportRes.rows) {
      if (r.is_critical) reportAdjustment -= 8;
      if (r.health_score_impact) reportAdjustment += r.health_score_impact;
      const abnormals = Array.isArray(r.abnormal_values) ? r.abnormal_values.length : 0;
      reportAdjustment -= abnormals * 2;
    }

    // Adjust based on appointments
    let apptAdjustment = 0;
    for (const a of apptRes.rows) {
      if (a.status === 'completed') apptAdjustment += 1;
      if (a.status === 'cancelled') apptAdjustment -= 2;
    }

    const computed = Math.min(100, Math.max(30, baseScore + reportAdjustment + apptAdjustment));
    const rounded = Math.round(computed);

    // Update the stored health score
    await query(`UPDATE patients SET health_score=$1, updated_at=NOW() WHERE id=$2`, [rounded, patientId]);

    return { health_score: rounded, computed: true };
  } catch (e) {
    console.error('Health score calc error:', e.message);
    return { health_score: 75, computed: false };
  }
}

/* ── EMR Generator Agent ── */
async function generateEMR({ notes, patientId, doctorId }) {
  const systemPrompt = getSystemPrompt('emr_generator');

  let patientContext = '';
  if (patientId) {
    try {
      const pRes = await query(`
        SELECT p.*, u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1
      `, [patientId]);
      if (pRes.rows[0]) {
        const p = pRes.rows[0];
        patientContext = `Patient: ${p.first_name} ${p.last_name}, Blood Group: ${p.blood_group || 'unknown'}, Allergies: ${p.allergies || 'none'}`;
      }
    } catch (e) {}
  }

  const userMessage = `Generate a structured EMR from these doctor notes:

${patientContext ? `[Patient Info]\n${patientContext}\n\n` : ''}[Doctor Notes/Dictation]
${notes}

Return structured JSON EMR with subjective, objective, assessment, plan, diagnoses array, prescriptions array (name, dose, frequency, duration), and follow_up_date fields.`;

  try {
    const raw = await callAI(systemPrompt, userMessage, {
      agentType: 'emr_generator',
      maxTokens: 1200,
      temperature: 0.3,
    });

    if (typeof raw === 'object') return raw;
    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { structured_notes: raw, requires_review: true };
  } catch (e) {
    return {
      subjective: notes,
      objective: 'To be completed by physician',
      assessment: 'Physician assessment required',
      plan: 'Treatment plan to be determined',
      diagnoses: [],
      prescriptions: [],
      requires_review: true,
    };
  }
}

module.exports = { orchestrate, analyzeReport, symptomCheck, calculateHealthScore, generateEMR };
