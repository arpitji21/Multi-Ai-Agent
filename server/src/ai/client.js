const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const openAIKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

const openai = openAIKey ? new OpenAI({ apiKey: openAIKey }) : null;
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

/* ── Smart contextual fallback when no API key is configured ── */
function smartFallback(agentType, userMessage, context = {}) {
  const msg = (userMessage || '').toLowerCase();

  if (agentType === 'admin_analytics' || agentType === 'admin_assistant' || agentType === 'hospital_analytics') {
    const s = context.stats || {};
    const depts = (context.department_performance || []).slice(0, 3);
    const rev = (context.revenue_history || []).slice(-3);
    let resp = `**Hospital Analytics Summary**\n\n`;
    if (s.total_patients) resp += `• **Patients**: ${s.total_patients} total registered\n`;
    if (s.total_doctors) resp += `• **Doctors**: ${s.total_doctors} total (${s.active_doctors || 0} active)\n`;
    if (s.today_appointments) resp += `• **Today**: ${s.today_appointments} appointment${s.today_appointments !== 1 ? 's' : ''} scheduled\n`;
    if (s.monthly_revenue != null) resp += `• **Monthly Revenue**: $${parseFloat(s.monthly_revenue).toLocaleString()}\n`;
    if (depts.length > 0) {
      resp += `\n**Top Departments by Revenue:**\n`;
      depts.forEach((d, i) => {
        resp += `${i + 1}. ${d.name} — $${parseFloat(d.revenue || 0).toLocaleString()} (${d.appointments} appointments)\n`;
      });
    }
    if (rev.length > 0) {
      resp += `\n**Recent Revenue Trend:** `;
      resp += rev.map(r => `${r.month}: $${parseFloat(r.revenue || 0).toLocaleString()}`).join(' → ');
    }
    if (msg.includes('forecast') || msg.includes('predict')) {
      resp += `\n\n**Forecast**: Based on recent trends, revenue is projected to ${parseFloat(rev[rev.length - 1]?.revenue || 0) > parseFloat(rev[0]?.revenue || 0) ? 'continue growing' : 'stabilize'} over the next quarter.`;
    }
    return resp || 'No analytics data available at this time.';
  }

  if (agentType === 'patient_assistant') {
    if (msg.includes('book') || msg.includes('appointment') || msg.includes('schedule')) {
      return `To book an appointment:\n\n1. Go to the **Appointments** tab in your portal\n2. Click **Book New Appointment**\n3. Select a doctor, date, and available time slot\n4. Choose your reason for visit and confirm\n\nYou can filter doctors by specialty if you have a specific medical need. Your booked appointment will appear in your upcoming visits list.`;
    }
    if (msg.includes('medication') || msg.includes('medicine') || msg.includes('prescription')) {
      return `For medication questions:\n\n• Your current prescriptions are listed under the **Medicines** tab\n• Always take medications as directed by your doctor\n• If you have concerns about side effects or interactions, contact your prescribing doctor\n• Use the **Medicine Reminders** feature to set up daily alerts\n\n⚠️ Never adjust your medication dosage without consulting your doctor first.`;
    }
    if (msg.includes('pain') || msg.includes('hurt') || msg.includes('ache')) {
      return `I'm sorry to hear you're experiencing discomfort. For medical concerns:\n\n• Use the **Symptom Checker** tab for initial guidance\n• For mild symptoms: rest, stay hydrated, and monitor\n• For moderate symptoms: book an appointment with your doctor\n• For **severe or sudden symptoms** (chest pain, difficulty breathing, severe headache): seek emergency care immediately\n\nWould you like me to help you book an appointment?`;
    }
    const statsMsg = context.health_score ? `Your current health score is **${context.health_score}/100**. ` : '';
    return `${statsMsg}Hello! I'm your MediAI Patient Assistant. I can help you with:\n\n• **Booking appointments** — find the right doctor for your needs\n• **Understanding your reports** — plain-language explanations\n• **Medication reminders** — tracking your prescriptions\n• **Symptom guidance** — initial triage and department recommendations\n• **Health progress** — insights from your medical history\n\nWhat would you like help with today?`;
  }

  if (agentType === 'doctor_assistant') {
    const patient = context.patient || {};
    if (msg.includes('pre-appointment') || msg.includes('summary') || msg.includes('patient')) {
      let resp = `**Pre-Appointment Clinical Summary**\n\n`;
      if (patient.name) resp += `**Patient**: ${patient.name}`;
      if (patient.age) resp += `, ${patient.age} years old`;
      if (patient.gender) resp += `, ${patient.gender}`;
      resp += '\n';
      if (patient.blood_group) resp += `**Blood Group**: ${patient.blood_group}\n`;
      if (patient.allergies) resp += `⚠️ **Allergies**: ${patient.allergies}\n`;
      if (patient.health_score) resp += `**Health Score**: ${patient.health_score}/100\n`;
      resp += `\n**Key Focus Areas for This Visit**:\n`;
      resp += `• Review chief complaint and interval history\n`;
      resp += `• Assess medication compliance and tolerability\n`;
      resp += `• Update vital signs and compare with baseline\n`;
      resp += `• Review any recent lab or imaging results\n`;
      if (patient.allergies) resp += `• ⚠️ Confirm allergy status — patient reports allergy to: ${patient.allergies}\n`;
      resp += `\n**Recommended Actions**: Physical examination, medication review, and update of medical history if warranted.`;
      return resp;
    }
    if (msg.includes('prescription') || msg.includes('medication')) {
      return `**Prescription Draft Guidance**\n\nWhen drafting prescriptions:\n\n• Verify patient allergies before prescribing (documented allergies: ${patient.allergies || 'none on file'})\n• Start with the lowest effective dose\n• Document indication, dose, frequency, route, and duration clearly\n• Provide patient education on side effects and when to seek care\n• Schedule follow-up for chronic medications\n\n⚕️ Remember to check for drug interactions and contraindications based on the patient's current medication list.`;
    }
    return `**Doctor AI Assistant**\n\nI can help you with:\n• Pre-appointment patient summaries\n• Prescription drafting guidance\n• Clinical note structure (SOAP format)\n• Follow-up recommendations\n• Report interpretation highlights\n\nFor the current patient context, I recommend reviewing their latest reports and medication list before the visit.`;
  }

  if (agentType === 'report_analysis') {
    return null; // handled separately in agent logic
  }

  if (agentType === 'symptom_check') {
    const symptoms = context.symptoms || [];
    const severity = context.severity || 5;
    const critical = ['chest pain', 'shortness of breath', 'difficulty breathing', 'severe headache', 'loss of consciousness', 'seizure', 'stroke'];
    const hasCritical = symptoms.some(s => critical.some(c => s.toLowerCase().includes(c)));
    if (hasCritical || severity >= 9) {
      return {
        suggested_department: 'Emergency Medicine',
        urgency: 'urgent',
        message: `⚠️ **Seek Emergency Care Now**\n\nYour symptoms (${symptoms.join(', ')}) may indicate a serious medical condition requiring immediate evaluation. Please go to the nearest Emergency Department or call emergency services immediately.\n\nDo not wait — early treatment is critical.`,
      };
    }
    const deptMap = {
      'chest': 'Cardiology',
      'heart': 'Cardiology',
      'breath': 'Pulmonology',
      'cough': 'Pulmonology',
      'lung': 'Pulmonology',
      'headache': 'Neurology',
      'vision': 'Ophthalmology',
      'stomach': 'Gastroenterology',
      'nausea': 'Gastroenterology',
      'joint': 'Orthopedics',
      'back pain': 'Orthopedics',
      'skin': 'Dermatology',
      'rash': 'Dermatology',
      'fever': 'General Medicine',
      'fatigue': 'General Medicine',
    };
    let dept = 'General Medicine';
    const symptomStr = symptoms.join(' ').toLowerCase();
    for (const [key, val] of Object.entries(deptMap)) {
      if (symptomStr.includes(key)) { dept = val; break; }
    }
    const urgency = severity >= 7 ? 'monitor' : 'routine';
    return {
      suggested_department: dept,
      urgency,
      message: `Based on your symptoms (${symptoms.slice(0, 3).join(', ')}${symptoms.length > 3 ? '…' : ''}), I recommend seeing a **${dept}** specialist.\n\n${urgency === 'monitor' ? '⚠️ Your symptom severity warrants prompt attention. Book an appointment within 1-2 days.' : '✅ These appear to be non-urgent symptoms. Schedule an appointment at your convenience within the next week.'}\n\nMeanwhile: rest, stay hydrated, and monitor for worsening symptoms. Seek emergency care if symptoms become severe.`,
    };
  }

  if (agentType === 'emr_generator') {
    return {
      subjective: userMessage,
      objective: "Vitals and physical examination to be recorded by physician.",
      assessment: "Clinical assessment based on patient history.",
      plan: "Follow-up and treatment as discussed.",
      diagnosis: "Pending clinical review",
      treatment_plan: "Review patient history and schedule follow-up.",
      prescription: "None at this time.",
      follow_up_date: null,
      diagnoses: ["Pending review"],
      prescriptions: []
    };
  }

  // Generic fallback for other contexts
  return `I'm your MediAI Assistant. I've received your message and I'm ready to help. Please note that enhanced AI capabilities require an API key to be configured. For immediate medical concerns, please contact your healthcare provider directly.`;
}

/* ── Gemini implementation ── */
async function callGemini(systemPrompt, userMessage, options = {}) {
  const model = genAI.getGenerativeModel({ 
    model: options.model || 'gemini-1.5-flash',
    systemInstruction: systemPrompt
  });

  const chat = model.startChat({
    history: (options.history || []).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.message }]
    })).slice(-6)
  });

  const result = await chat.sendMessage(userMessage);
  const response = await result.response;
  return response.text();
}

/* ── OpenAI implementation ── */
async function callOpenAI(systemPrompt, userMessage, options = {}) {
  const messages = [{ role: 'system', content: systemPrompt }];
  if (options.history && options.history.length > 0) {
    options.history.slice(-6).forEach(h => {
      if (h.role === 'user' || h.role === 'assistant') {
        messages.push({ role: h.role, content: h.message });
      }
    });
  }
  messages.push({ role: 'user', content: userMessage });

  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages,
    max_tokens: options.maxTokens || 800,
    temperature: options.temperature || 0.7,
  });

  return response.choices[0].message.content;
}

/* ── Main AI call function ── */
async function callAI(systemPrompt, userMessage, options = {}) {
  // Primary: Gemini
  if (genAI) {
    try {
      return await callGemini(systemPrompt, userMessage, options);
    } catch (err) {
      console.error('Gemini API error:', err.message);
      // Fallback to OpenAI if Gemini fails
      if (openai) {
        try {
          return await callOpenAI(systemPrompt, userMessage, options);
        } catch (oerr) {
          console.error('OpenAI API fallback error:', oerr.message);
        }
      }
    }
  } 
  // Secondary: OpenAI
  else if (openai) {
    try {
      return await callOpenAI(systemPrompt, userMessage, options);
    } catch (err) {
      console.error('OpenAI API error:', err.message);
    }
  }

  // Final fallback: Smart predefined responses
  const fallback = smartFallback(options.agentType || 'generic', userMessage, options.context || {});
  if (typeof fallback === 'object' && fallback !== null) return fallback;
  return fallback || `MediAI Assistant: I received your message. Enhanced AI responses require API configuration.`;
}

module.exports = { callAI, smartFallback, isAIEnabled: !!(openai || genAI) };
