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
  if (userRole === 'doctor') return 'doctor_assistant';
  if (userRole === 'admin') return 'admin_assistant';
  return 'patient_assistant';
}

/* ── Appointment Scheduling Agent ── */
async function runAppointmentScheduler(message, userId, history) {
  try {
    // Load available doctors and slots
    const doctorsRes = await query(`
      SELECT d.id, u.name, d.specialization, d.consultation_fee, dep.name AS department
      FROM doctors d
      JOIN users u ON u.id=d.user_id
      LEFT JOIN departments dep ON dep.id=d.department_id
      WHERE d.available=true
      ORDER BY d.specialization
    `);

    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    // Get booked slots so we can show available ones
    const bookedRes = await query(`
      SELECT doctor_id, appointment_date, appointment_time
      FROM appointments
      WHERE appointment_date BETWEEN $1 AND $2
        AND status NOT IN ('cancelled')
    `, [today, nextWeek]);

    const bookedMap = {};
    for (const b of bookedRes.rows) {
      const key = `${b.doctor_id}_${b.appointment_date}`;
      if (!bookedMap[key]) bookedMap[key] = new Set();
      bookedMap[key].add(b.appointment_time);
    }

    const TIME_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    const DATES = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(Date.now() + i * 86400000);
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        DATES.push(d.toISOString().split('T')[0]);
      }
    }

    // Build slot summary for AI
    const doctorSlots = doctorsRes.rows.map(doc => {
      const available = [];
      for (const date of DATES.slice(0, 3)) {
        const key = `${doc.id}_${date}`;
        const freeSlots = TIME_SLOTS.filter(t => !bookedMap[key]?.has(t));
        if (freeSlots.length > 0) {
          available.push({ date, slots: freeSlots.slice(0, 3) });
        }
      }
      return { ...doc, available_slots: available };
    });

    const systemPrompt = getSystemPrompt('appointment_scheduler');
    const contextMsg = `[Available Doctors & Slots]\n${doctorSlots.map(d =>
      `Dr. ${d.name} (ID:${d.id}) - ${d.specialization}${d.department ? ` / ${d.department}` : ''} - $${d.consultation_fee || 0}/visit\nAvailable: ${d.available_slots.map(s => `${s.date} at ${s.slots.join(', ')}`).join(' | ') || 'No slots in next 3 days'}`
    ).join('\n')}\n\n[Patient Request]\n${message}`;

    const reply = await callAI(systemPrompt, contextMsg, {
      agentType: 'appointment_scheduler',
      context: { doctors: doctorSlots },
      history,
      maxTokens: 800,
    });

    // Check if this is a booking confirmation (message contains "confirm", "book" + doctor id / slot info)
    const msgLower = message.toLowerCase();
    const isConfirmation = msgLower.includes('confirm') || msgLower.includes('book slot') || msgLower.includes('yes, book');

    if (isConfirmation && userId) {
      // Try to extract doctor_id and slot from message or history
      const doctorIdMatch = message.match(/Dr\.?\s*[Ii][Dd][\s:]*(\d+)|doctor\s+(\d+)|id[\s:]*(\d+)/i);
      const dateMatch = message.match(/(\d{4}-\d{2}-\d{2})/);
      const timeMatch = message.match(/(\d{1,2}:\d{2})/);

      if (doctorIdMatch && dateMatch && timeMatch) {
        const doctorId = parseInt(doctorIdMatch[1] || doctorIdMatch[2] || doctorIdMatch[3]);
        const aptDate = dateMatch[1];
        const aptTime = timeMatch[1];
        try {
          const patRes = await query(`SELECT id FROM patients WHERE user_id=$1`, [userId]);
          if (patRes.rows.length > 0) {
            await query(
              `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
               VALUES ($1,$2,$3,$4,$5,'booked')`,
              [patRes.rows[0].id, doctorId, aptDate, aptTime, message.slice(0, 200)]
            );
            return { reply: typeof reply === 'string' ? reply + '\n\n✅ **Appointment successfully booked!** You will find it in your appointments list.' : 'Appointment booked successfully!', agentType: 'appointment_scheduler', booked: true };
          }
        } catch (bookErr) {
          console.error('Booking error:', bookErr.message);
        }
      }
    }

    return { reply: typeof reply === 'string' ? reply : JSON.stringify(reply), agentType: 'appointment_scheduler' };
  } catch (e) {
    console.error('Appointment scheduler error:', e.message);
    return {
      reply: 'To book an appointment, please go to the **Appointments** tab and click **Book New Appointment**. You can select your preferred doctor, date, and time slot from there.',
      agentType: 'appointment_scheduler',
    };
  }
}

/* ── Orchestrator ── */
async function orchestrate({ message, context, userRole, userId, history }) {
  const agentType = resolveAgentType(context?.type, userRole);
  const systemPrompt = getSystemPrompt(agentType);

  // Appointment scheduler has its own flow
  if (agentType === 'appointment_scheduler') {
    return runAppointmentScheduler(message, userId, history);
  }

  let enrichedContext = { ...context };
  let enrichedMessage = message;

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
            (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='completed' AND created_at >= NOW() - INTERVAL '30 days') AS monthly_revenue
        `),
        query(`
          SELECT dep.name, COUNT(a.id) AS appointments,
                 COALESCE(SUM(pay.amount),0) AS revenue
          FROM departments dep
          LEFT JOIN doctors doc ON doc.department_id=dep.id
          LEFT JOIN appointments a ON a.doctor_id=doc.id AND a.created_at >= NOW() - INTERVAL '30 days'
          LEFT JOIN payments pay ON pay.appointment_id=a.id AND pay.status='completed'
          GROUP BY dep.name ORDER BY revenue DESC LIMIT 5
        `),
        query(`
          SELECT TO_CHAR(DATE_TRUNC('month', created_at),'Mon YYYY') AS month,
                 COALESCE(SUM(amount),0) AS revenue,
                 COUNT(*) AS transactions
          FROM payments WHERE status='completed'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY DATE_TRUNC('month', created_at) DESC LIMIT 6
        `),
      ]);
      enrichedContext.stats = statsRes.rows[0];
      enrichedContext.department_performance = deptRes.rows;
      enrichedContext.revenue_history = revRes.rows.reverse();

      const s = enrichedContext.stats;
      const deptSummary = (enrichedContext.department_performance || [])
        .map(d => `${d.name}: ${d.appointments} appts, $${parseFloat(d.revenue).toLocaleString()} revenue`)
        .join('; ');
      const revSummary = (enrichedContext.revenue_history || [])
        .map(r => `${r.month}: $${parseFloat(r.revenue).toLocaleString()}`)
        .join(', ');
      enrichedMessage = `[Hospital Context - Live Data]\nPatients: ${s.total_patients}, Doctors: ${s.total_doctors} (${s.active_doctors} active), Today's appointments: ${s.today_appointments}, Monthly revenue: $${parseFloat(s.monthly_revenue || 0).toLocaleString()}, Monthly completed appointments: ${s.monthly_completed}\nDepartment performance (last 30 days): ${deptSummary || 'No data'}\nRevenue history: ${revSummary || 'No data'}\n\n[Question]\n${message}`;
    } catch (e) {
      console.error('Admin context enrichment error:', e.message);
    }
  }

  if (agentType === 'doctor_assistant' && context?.patient_id) {
    try {
      const [patRes, apptRes, rptRes] = await Promise.all([
        query(`SELECT p.*, u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1`, [context.patient_id]),
        query(`
          SELECT a.*, d.specialization FROM appointments a
          JOIN doctors d ON d.id=a.doctor_id
          WHERE a.patient_id=$1 ORDER BY a.appointment_date DESC LIMIT 3
        `, [context.patient_id]),
        query(`SELECT r.*, aa.patient_summary, aa.abnormal_values, aa.is_critical FROM reports r LEFT JOIN ai_analyses aa ON aa.report_id=r.id WHERE r.patient_id=$1 ORDER BY r.created_at DESC LIMIT 3`, [context.patient_id]),
      ]);
      enrichedContext.patient = patRes.rows[0];
      enrichedContext.recent_appointments = apptRes.rows;
      enrichedContext.recent_reports = rptRes.rows;

      if (enrichedContext.patient) {
        const p = enrichedContext.patient;
        const age = p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000) : 'unknown';
        const recentRpts = (enrichedContext.recent_reports || []).map(r =>
          `${r.report_type} (${r.created_at?.split('T')[0]}): ${r.patient_summary || 'No AI analysis'}`
        ).join('; ') || 'None';
        enrichedMessage = `[Patient Context]\nName: ${p.first_name} ${p.last_name}, Age: ${age}, Gender: ${p.gender || 'unknown'}\nBlood Group: ${p.blood_group || 'unknown'}, Allergies: ${p.allergies || 'none'}, Health Score: ${p.health_score}/100\nRecent Reports: ${recentRpts}\n\n[Request]\n${message}`;
      }
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
    } catch (e) { /* non-fatal */ }
  }

  const reply = await callAI(systemPrompt, enrichedMessage, {
    agentType,
    context: enrichedContext,
    history,
    maxTokens: 1000,
  });

  return { reply: typeof reply === 'string' ? reply : JSON.stringify(reply, null, 2), agentType };
}

/* ── PDF and image text extraction ── */
async function extractTextFromReport(report) {
  if (!report.file_path) return '';

  const uploadsDir = path.join(__dirname, '../../uploads');
  const filePath = path.join(uploadsDir, report.file_path);

  if (!fs.existsSync(filePath)) return '';

  const fileType = (report.file_type || '').toLowerCase();
  const fileName = (report.file_name || '').toLowerCase();

  // Plain text files
  if (fileType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
    try {
      return fs.readFileSync(filePath, 'utf8').slice(0, 4000);
    } catch (e) { return ''; }
  }

  // PDF files — pdf-parse@1.1.1 exports a callable function
  if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return (data.text || '').trim().slice(0, 4000);
    } catch (e) {
      console.error('PDF parse error:', e.message);
      return '';
    }
  }

  // Image files — OCR via tesseract.js
  if (
    fileType.includes('image') ||
    fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') || fileName.endsWith('.tiff') ||
    fileName.endsWith('.bmp') || fileName.endsWith('.gif')
  ) {
    try {
      const { recognize } = require('tesseract.js');
      const result = await recognize(filePath, 'eng', { logger: () => { } });
      return (result.data.text || '').trim().slice(0, 4000);
    } catch (e) {
      console.error('OCR error:', e.message);
      return '';
    }
  }

  return '';
}

/* ── Report Analysis Agent ── */
async function analyzeReport(report) {
  const fileContent = await extractTextFromReport(report);
  const hasContent = fileContent.trim().length > 20;

  const systemPrompt = getSystemPrompt('report_analysis');
  const userMessage = hasContent
    ? `Analyze this medical report and return structured JSON.

Report Type: ${report.report_type || 'general'}
File Name: ${report.file_name}

Report Content:
${fileContent}

Return ONLY valid JSON matching the schema in your instructions.`
    : `Analyze this medical report based on type/metadata and return structured JSON.

Report Type: ${report.report_type || 'general'}
File Name: ${report.file_name}
File Type: ${report.file_type || 'unknown'}
Patient Notes: ${report.notes || 'none'}

Note: File content could not be extracted (binary format). Generate a professional template analysis for this report type.

Return ONLY valid JSON matching the schema in your instructions.`;

  try {
    const raw = await callAI(systemPrompt, userMessage, {
      agentType: 'report_analysis',
      maxTokens: 1200,
      temperature: 0.3,
    });

    let parsed;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      parsed = raw;
    } else {
      const str = typeof raw === 'string' ? raw : '';
      const jsonMatch = str.match(/\{[\s\S]+\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]);
    }

    return {
      patient_summary: parsed.patient_summary || generateReportFallback(report, 'patient', fileContent),
      doctor_summary: parsed.doctor_summary || generateReportFallback(report, 'doctor', fileContent),
      key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
      abnormal_values: Array.isArray(parsed.abnormal_values) ? parsed.abnormal_values : [],
      is_critical: Boolean(parsed.is_critical),
      emergency_reason: parsed.emergency_reason || null,
      recommendations: parsed.recommendations || 'Follow up with your healthcare provider.',
      health_score_impact: typeof parsed.health_score_impact === 'number' ? parsed.health_score_impact : 0,
    };
  } catch (err) {
    console.error('Report analysis error:', err.message);
    return generateReportFallback(report, 'full', fileContent);
  }
}

/* ── Local Rule-Based Report Analysis (No API Key needed) ── */
function analyzeTextLocally(text, reportType) {
  const findings = [];
  const abnormals = [];
  let isCritical = false;
  let patientSummary = "";
  let doctorSummary = "";

  const lowerText = text.toLowerCase();

  // Define common markers and their meanings
  const markers = [
    { name: 'Hemoglobin', keys: ['hemoglobin', 'hgb', 'hb'], normal: [12, 17], unit: 'g/dL', info: 'Carries oxygen in blood.' },
    { name: 'Glucose', keys: ['glucose', 'glu', 'sugar'], normal: [70, 100], unit: 'mg/dL', info: 'Blood sugar level.' },
    { name: 'Cholesterol', keys: ['cholesterol', 'chol'], normal: [0, 200], unit: 'mg/dL', info: 'Fats in the blood.' },
    { name: 'WBC', keys: ['wbc', 'white blood cell', 'leukocyte'], normal: [4000, 11000], unit: '/mcL', info: 'Immune system cells.' },
    { name: 'Platelets', keys: ['platelets', 'plt'], normal: [150000, 450000], unit: '/mcL', info: 'Helps in blood clotting.' },
    { name: 'Creatinine', keys: ['creatinine', 'creat'], normal: [0.7, 1.3], unit: 'mg/dL', info: 'Kidney function marker.' },
    { name: 'Blood Pressure', keys: ['bp', 'blood pressure'], info: 'Force of blood against artery walls.' }
  ];

  markers.forEach(m => {
    const found = m.keys.some(k => lowerText.includes(k));
    if (found) {
      findings.push(`${m.name} detected`);

      // Basic value extraction logic (simplified regex)
      const regex = new RegExp(`(?:${m.keys.join('|')})\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)`, 'i');
      const match = text.match(regex);
      if (match) {
        const val = parseFloat(match[1]);
        if (m.normal) {
          if (val < m.normal[0] || val > m.normal[1]) {
            abnormals.push(`${m.name} is ${val} ${m.unit} (Normal: ${m.normal[0]}-${m.normal[1]})`);
            if (val < m.normal[0] * 0.6 || val > m.normal[1] * 1.5) isCritical = true;
          }
        }
      }
    }
  });

  if (reportType === 'blood') {
    patientSummary = "Your blood report shows markers like " + (findings.join(', ') || 'general indices') + ". ";
    if (abnormals.length > 0) {
      patientSummary += "Some values are outside the standard range. ";
    } else {
      patientSummary += "Most values appear to be within normal limits based on local analysis. ";
    }
    doctorSummary = "Automated local analysis of blood panel. Detected: " + findings.join('; ') + ". Flags: " + (abnormals.join('; ') || 'None') + ".";
  } else if (reportType === 'ecg') {
    patientSummary = "This heart tracing (ECG) has been recorded. It shows your heart's electrical activity.";
    doctorSummary = "ECG study received. Local analysis detected rhythm data. Clinical correlation required.";
    if (lowerText.includes('tachycardia')) { abnormals.push('Fast heart rate (Tachycardia)'); isCritical = true; }
    if (lowerText.includes('bradycardia')) { abnormals.push('Slow heart rate (Bradycardia)'); }
  } else {
    patientSummary = "Your " + (reportType || 'medical') + " report has been processed. We've identified key markers for your doctor to review.";
    doctorSummary = "General report analysis (" + reportType + "). Text extraction successful. Manual review recommended.";
  }

  return {
    patient_summary: patientSummary,
    doctor_summary: doctorSummary,
    key_findings: findings,
    abnormal_values: abnormals,
    is_critical: isCritical,
    recommendations: abnormals.length > 0 ? "Please schedule a consultation to discuss these results." : "Continue with your current health plan and discuss these results at your next visit."
  };
}

function generateReportFallback(report, mode, textContent = "") {
  const type = (report.report_type || 'general').toLowerCase();

  // If we have extracted text, use the rule-based engine
  if (textContent && textContent.length > 50) {
    const local = analyzeTextLocally(textContent, type);
    if (mode === 'patient') return local.patient_summary;
    if (mode === 'doctor') return local.doctor_summary;
    return local;
  }

  const typeMap = {
    blood: {
      patient_summary: 'Your blood test results have been received and reviewed. The report provides information about your blood cell counts, chemistry, and overall blood health. Please discuss the specific values with your doctor at your next appointment.',
      doctor_summary: `CBC/Blood panel received. File: ${report.file_name}. Hematological and biochemical review recommended. Compare with baseline values and assess clinical correlation.`,
      key_findings: ['Blood panel received', 'Complete blood count documented', 'Biochemical markers recorded'],
    },
    ecg: {
      patient_summary: 'Your ECG (heart tracing) report has been uploaded and is ready for your doctor\'s review. The ECG records the electrical activity of your heart and your cardiologist will interpret the findings.',
      doctor_summary: 'ECG tracing received. Rhythm analysis, axis, ST/T wave changes, and interval measurements require physician interpretation. Compare with prior ECGs if available.',
      key_findings: ['Cardiac rhythm documented', 'ECG tracing recorded', 'Physician interpretation required'],
    },
    xray: {
      patient_summary: 'Your X-ray images have been uploaded successfully. X-rays provide images of your bones and some soft tissues. Your doctor will review and interpret the images.',
      doctor_summary: 'Radiograph received. Systematic review of bony structures, soft tissues, and pathological findings required. Clinical correlation with patient symptoms recommended.',
      key_findings: ['Radiographic study received', 'Images uploaded for review', 'Radiological assessment pending'],
    },
    mri: {
      patient_summary: 'Your MRI scan has been uploaded. MRI provides detailed images of your internal organs and tissues. A radiologist will review the images and report findings to your doctor.',
      doctor_summary: 'MRI study received. Detailed sequence review required. Specialist radiological interpretation recommended before clinical decision-making.',
      key_findings: ['MRI study received', 'Multi-sequence imaging documented', 'Radiologist review required'],
    },
  };

  const defaults = {
    patient_summary: `Your ${type} report has been uploaded and processed. Your healthcare provider will review the findings and discuss them with you at your next appointment. If you have any urgent concerns, please contact your doctor directly.`,
    doctor_summary: `Medical report (${type}) received. File: ${report.file_name}. Clinical interpretation and correlation with patient presentation required.`,
    key_findings: ['Report uploaded successfully', 'Document ready for physician review'],
  };

  const data = { ...defaults, ...(typeMap[type] || {}) };

  if (mode === 'patient') return data.patient_summary;
  if (mode === 'doctor') return data.doctor_summary;
  return {
    patient_summary: data.patient_summary,
    doctor_summary: data.doctor_summary,
    key_findings: data.key_findings,
    abnormal_values: [],
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

    if (typeof raw === 'object' && raw !== null) return raw;
    const str = typeof raw === 'string' ? raw : '';
    const jsonMatch = str.match(/\{[\s\S]+\}/);
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
    let reportAdjustment = 0;

    for (const r of reportRes.rows) {
      if (r.is_critical) reportAdjustment -= 8;
      if (typeof r.health_score_impact === 'number') reportAdjustment += r.health_score_impact;
      const abnormals = Array.isArray(r.abnormal_values) ? r.abnormal_values.length :
        (typeof r.abnormal_values === 'string' ? JSON.parse(r.abnormal_values || '[]').length : 0);
      reportAdjustment -= abnormals * 2;
    }

    let apptAdjustment = 0;
    for (const a of apptRes.rows) {
      if (a.status === 'completed') apptAdjustment += 1;
      if (a.status === 'cancelled') apptAdjustment -= 2;
    }

    const computed = Math.min(100, Math.max(30, baseScore + reportAdjustment + apptAdjustment));
    const rounded = Math.round(computed);
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
        SELECT p.*, u.email, u.name FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1
      `, [patientId]);
      if (pRes.rows[0]) {
        const p = pRes.rows[0];
        patientContext = `Patient: ${p.name || 'Unknown'}, Blood Group: ${p.blood_group || 'unknown'}, Allergies: ${p.allergies || 'none'}`;
      }
    } catch (e) { /* non-fatal */ }
  }

  const userMessage = `Generate a structured EMR from these doctor notes:

${patientContext ? `[Patient Info]\n${patientContext}\n\n` : ''}[Doctor Notes/Dictation]
${notes}

IMPORTANT: Return ONLY valid JSON matching the schema: { "subjective": "...", "objective": "...", "assessment": "...", "plan": "...", "diagnoses": ["..."], "prescriptions": ["..."], "follow_up_date": "YYYY-MM-DD" }`;

  try {
    const raw = await callAI(systemPrompt, userMessage, {
      agentType: 'emr_generator',
      maxTokens: 1200,
      temperature: 0.3,
    });

    let parsed;
    if (typeof raw === 'object' && raw !== null) {
      parsed = raw;
    } else {
      const str = typeof raw === 'string' ? raw : '';
      const jsonMatch = str.match(/\{[\s\S]+\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Standardized field mapping for frontend compatibility
    return {
      subjective: parsed.subjective || "",
      objective: parsed.objective || "",
      assessment: parsed.assessment || "",
      plan: parsed.plan || "",
      diagnosis: parsed.diagnosis || (Array.isArray(parsed.diagnoses) ? parsed.diagnoses.join(", ") : (parsed.assessment || "")),
      treatment_plan: parsed.treatment_plan || parsed.plan || "",
      prescription: parsed.prescription || (Array.isArray(parsed.prescriptions) ? parsed.prescriptions.join(", ") : ""),
      follow_up_date: parsed.follow_up_date || null,
      diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [],
      prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : []
    };
  } catch (e) {
    console.error('EMR generation error:', e.message);
    return {
      subjective: notes,
      objective: 'To be completed by physician',
      assessment: 'Physician assessment required',
      plan: 'Treatment plan to be determined',
      diagnoses: [],
      prescriptions: [],
      diagnosis: 'Requires review',
      treatment_plan: 'Pending',
      prescription: 'None',
      follow_up_date: null,
      requires_review: true,
    };
  }
}

module.exports = { orchestrate, analyzeReport, symptomCheck, calculateHealthScore, generateEMR };
