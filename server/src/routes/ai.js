const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { orchestrate, analyzeReport, symptomCheck, calculateHealthScore, generateEMR } = require('../ai/agents');
const { callAI, isAIEnabled } = require('../ai/client');
const { getSystemPrompt } = require('../ai/prompts');
const { runPythonScript } = require('../utils/pythonBridge');

const router = express.Router();

const clinicalUploadDir = path.join(__dirname, '../../uploads/clinical');
if (!fs.existsSync(clinicalUploadDir)) fs.mkdirSync(clinicalUploadDir, { recursive: true });

const clinicalUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, clinicalUploadDir),
    filename: (_, file, cb) => cb(null, `clinical_${Date.now()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.pdf', '.txt', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

async function runClinicalAnalyzer(payload) {
  try {
    return await runPythonScript('clinical_analyzer.py', payload);
  } catch (err) {
    console.warn('Python clinical analyzer unavailable:', err.message);
    return null;
  }
}

async function enhanceWithAI(agentType, structured, userMessage) {
  if (!isAIEnabled || !structured?.success) return structured;
  try {
    const systemPrompt = getSystemPrompt(agentType);
    const raw = await callAI(systemPrompt, userMessage, {
      agentType,
      maxTokens: 900,
      temperature: 0.3,
    });
    const narrative = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
    return { ...structured, narrative, ai_enhanced: true };
  } catch {
    return structured;
  }
}

/* ── POST /api/ai/chat — Central Orchestrator ── */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context, session_id } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Store user message
    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context, session_id)
       VALUES ($1, 'user', $2, $3, $4)`,
      [req.user.id, message, context ? JSON.stringify(context) : null, session_id || null]
    );

    // Load recent conversation history for context
    let history = [];
    try {
      const histRes = await query(
        `SELECT role, message FROM ai_conversations
         WHERE user_id=$1 ${session_id ? 'AND session_id=$2' : ''}
         ORDER BY created_at DESC LIMIT 10`,
        session_id ? [req.user.id, session_id] : [req.user.id]
      );
      history = histRes.rows.reverse();
    } catch (e) { /* non-fatal */ }

    // Run through the orchestrator
    const { reply, agentType } = await orchestrate({
      message,
      context,
      userRole: req.user.role,
      userId: req.user.id,
      history,
    });

    // Store assistant reply
    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context, session_id)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [req.user.id, reply, JSON.stringify({ agentType }), session_id || null]
    );

    res.json({ reply, role: req.user.role, agent: agentType });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'AI chat failed', reply: 'I\'m temporarily unavailable. Please try again shortly.' });
  }
});

/* ── GET /api/ai/conversations — own conversations ── */
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const { session_id, limit = 50 } = req.query;
    const params = [req.user.id];
    const sessionClause = session_id ? `AND session_id=$2` : '';
    if (session_id) params.push(session_id);
    const result = await query(
      `SELECT * FROM ai_conversations WHERE user_id=$1 ${sessionClause}
       ORDER BY created_at ASC LIMIT ${parseInt(limit) || 50}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/* ── PUT /api/ai/conversations/:id ── */
router.put('/conversations/:id', authenticate, async (req, res) => {
  try {
    const { context } = req.body;
    const result = await query(
      `UPDATE ai_conversations SET context=$1 WHERE id=$2 AND user_id=$3 RETURNING *`,
      [context ? JSON.stringify(context) : null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found or not yours' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

/* ── DELETE /api/ai/conversations — clear own history ── */
router.delete('/conversations', authenticate, async (req, res) => {
  try {
    const { session_id } = req.query;
    if (session_id) {
      await query(`DELETE FROM ai_conversations WHERE user_id=$1 AND session_id=$2`, [req.user.id, session_id]);
    } else {
      await query(`DELETE FROM ai_conversations WHERE user_id=$1`, [req.user.id]);
    }
    res.json({ message: 'Conversation history cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear conversations' });
  }
});

/* ── DELETE /api/ai/conversations/:id ── */
router.delete('/conversations/:id', authenticate, async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin' ? `WHERE id=$1` : `WHERE id=$1 AND user_id=$2`;
    const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
    const result = await query(`DELETE FROM ai_conversations ${whereClause} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/* ── POST /api/ai/symptom-check ── */
router.post('/symptom-check', authenticate, async (req, res) => {
  try {
    const { symptoms, duration, severity } = req.body;
    if (!symptoms || symptoms.length === 0) {
      return res.status(400).json({ error: 'symptoms array is required' });
    }
    const result = await symptomCheck({ symptoms, duration, severity, userId: req.user.id });
    res.json(result);
  } catch (err) {
    console.error('Symptom check error:', err);
    res.status(500).json({
      suggested_department: 'General Medicine',
      urgency: 'routine',
      message: 'Based on your symptoms, we recommend consulting with a General Medicine specialist. Please book an appointment.',
    });
  }
});

/* ── POST /api/ai/analyze-report/:report_id ── */
router.post('/analyze-report/:report_id', authenticate, async (req, res) => {
  try {
    const { report_id } = req.params;

    const reportResult = await query(
      `SELECT r.*, p.id AS patient_id, p.user_id AS patient_user_id
       FROM reports r
       LEFT JOIN patients p ON p.id=r.patient_id
       WHERE r.id=$1`,
      [report_id]
    );
    if (reportResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    const report = reportResult.rows[0];

    // Access check — patient can only view own reports
    if (req.user.role === 'patient' && report.patient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check for existing analysis
    const existing = await query(`SELECT * FROM ai_analyses WHERE report_id=$1`, [report_id]);
    if (existing.rows.length > 0) {
      const a = existing.rows[0];
      // Parse JSONB fields if they come back as strings
      return res.json({
        ...a,
        key_findings: typeof a.key_findings === 'string' ? JSON.parse(a.key_findings) : a.key_findings,
        abnormal_values: typeof a.abnormal_values === 'string' ? JSON.parse(a.abnormal_values) : a.abnormal_values,
      });
    }

    // Run the AI analysis
    const analysis = await analyzeReport(report);

    // Store in DB
    const saved = await query(
      `INSERT INTO ai_analyses
         (report_id, patient_summary, doctor_summary, key_findings, abnormal_values, is_critical, health_score_impact)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        report_id,
        analysis.patient_summary,
        analysis.doctor_summary,
        JSON.stringify(analysis.key_findings),
        JSON.stringify(analysis.abnormal_values),
        analysis.is_critical || false,
        analysis.health_score_impact || 0,
      ]
    );

    // Emergency detection — notify doctor(s) if critical
    if (analysis.is_critical && report.patient_id) {
      try {
        const doctorRes = await query(
          `SELECT DISTINCT a.doctor_id FROM appointments a
           WHERE a.patient_id=$1 AND a.doctor_id IS NOT NULL
           ORDER BY a.created_at DESC LIMIT 3`,
          [report.patient_id]
        );
        for (const d of doctorRes.rows) {
          await query(
            `INSERT INTO notifications (user_id, type, title, message)
             SELECT u.id, 'critical_report',
               'CRITICAL: Report Alert — Immediate Review Required',
               $1
             FROM doctors doc JOIN users u ON u.id=doc.user_id
             WHERE doc.id=$2`,
            [
              `🚨 Critical values detected in patient report "${report.file_name}". ${analysis.emergency_reason || 'Immediate clinical review required.'}`,
              d.doctor_id,
            ]
          ).catch(notifErr => {
            console.error('Emergency notification insert error:', notifErr.message);
          });
        }

        // Also update the report with a critical flag note
        await query(
          `UPDATE reports SET notes=COALESCE(notes,'') || $1 WHERE id=$2`,
          [`\n[CRITICAL: ${analysis.emergency_reason || 'Critical values detected'}]`, report_id]
        ).catch(() => {});
      } catch (e) {
        console.error('Emergency notification error:', e.message);
      }

      // Recalculate health score after critical report
      if (report.patient_id) {
        calculateHealthScore(report.patient_id).catch(() => {});
      }
    }

    res.json({
      ...saved.rows[0],
      key_findings: analysis.key_findings,
      abnormal_values: analysis.abnormal_values,
      recommendations: analysis.recommendations,
    });
  } catch (err) {
    console.error('Report analysis error:', err);
    res.status(500).json({ error: 'Report analysis failed' });
  }
});

/* ── POST /api/ai/generate-emr — EMR from doctor notes ── */
router.post('/generate-emr', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { notes, patient_id, doctor_id } = req.body;
    if (!notes) return res.status(400).json({ error: 'notes are required' });
    const emr = await generateEMR({ notes, patientId: patient_id, doctorId: doctor_id || req.user.id });
    res.json({ emr, generated_at: new Date().toISOString(), requires_review: true });
  } catch (err) {
    console.error('EMR generation error:', err);
    res.status(500).json({ error: 'EMR generation failed' });
  }
});

/* ── POST /api/ai/health-score/:patient_id — Recalculate health score ── */
router.post('/health-score/:patient_id', authenticate, async (req, res) => {
  try {
    const { patient_id } = req.params;
    // Access check
    if (req.user.role === 'patient') {
      const patRes = await query(`SELECT id FROM patients WHERE user_id=$1 AND id=$2`, [req.user.id, patient_id]);
      if (patRes.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await calculateHealthScore(parseInt(patient_id));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Health score calculation failed' });
  }
});

/* ── Voice transcript endpoints (placeholder — browser MediaRecorder follow-up) ── */
router.get('/voice-transcripts', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM voice_transcripts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

router.post('/voice-transcripts', authenticate, async (req, res) => {
  try {
    const { transcript, audio_duration, emr_id } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });

    // If it's a doctor, auto-generate EMR from transcript
    let emrData = null;
    if (req.user.role === 'doctor' && transcript.length > 20) {
      emrData = await generateEMR({ notes: transcript }).catch(() => null);
    }

    const result = await query(
      `INSERT INTO voice_transcripts (user_id, transcript, audio_duration, emr_id, processed)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, transcript, audio_duration || null, emr_id || null, emrData ? true : false]
    );
    res.status(201).json({ ...result.rows[0], emr: emrData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transcript' });
  }
});

router.get('/voice-transcripts/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM voice_transcripts WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transcript not found' });
    if (req.user.role !== 'admin' && result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

router.put('/voice-transcripts/:id', authenticate, async (req, res) => {
  try {
    const check = await query(`SELECT user_id FROM voice_transcripts WHERE id=$1`, [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Transcript not found' });
    if (req.user.role !== 'admin' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { transcript, processed, emr_id } = req.body;
    const result = await query(
      `UPDATE voice_transcripts SET
         transcript=COALESCE($1,transcript),
         processed=COALESCE($2,processed),
         emr_id=COALESCE($3,emr_id)
       WHERE id=$4 RETURNING *`,
      [transcript || null, processed ?? null, emr_id || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

router.delete('/voice-transcripts/:id', authenticate, async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin' ? `WHERE id=$1` : `WHERE id=$1 AND user_id=$2`;
    const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
    const result = await query(`DELETE FROM voice_transcripts ${whereClause} RETURNING id`, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transcript not found' });
    res.json({ message: 'Transcript deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});

/* ── POST /api/ai/clinical/summarize-report — Python lab parsing + optional AI polish ── */
router.post('/clinical/summarize-report', authenticate, requireRole('doctor', 'admin'), clinicalUpload.single('file'), async (req, res) => {
  let tempFile = null;
  try {
    const reportType = req.body.report_type || 'general';
    let text = (req.body.text || '').trim();

    if (req.file) {
      tempFile = req.file.path;
      if (req.file.originalname.match(/\.(txt|csv)$/i)) {
        text = fs.readFileSync(tempFile, 'utf8').slice(0, 12000);
      }
    }

    let result = await runClinicalAnalyzer({
      mode: 'summarize',
      text,
      file_path: tempFile && !text ? tempFile : undefined,
      report_type: reportType,
    });

    if (!result?.success) {
      if (!text) {
        return res.status(400).json({ error: result?.error || 'Provide report text or upload a PDF/txt file' });
      }
      const { reply } = await orchestrate({
        message: `Summarize this medical report for a doctor:\n\n${text.slice(0, 6000)}`,
        context: { type: 'report_summary' },
        userRole: req.user.role,
        userId: req.user.id,
        history: [],
      });
      return res.json({
        success: true,
        engine: 'ai_fallback',
        narrative: reply,
        key_findings: [],
        abnormal_values: [],
        is_critical: reply.toLowerCase().includes('critical'),
      });
    }

    if (isAIEnabled) {
      result = await enhanceWithAI(
        'doctor_assistant',
        result,
        `Refine this structured report analysis for a physician. Keep all critical flags. Structured data:\n${JSON.stringify({
          lab_values: result.lab_values,
          abnormal_values: result.abnormal_values,
          clinical_impression: result.clinical_impression,
          recommended_actions: result.recommended_actions,
        }, null, 2)}\n\nOriginal report excerpt:\n${text.slice(0, 2000)}`
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Clinical summarize error:', err);
    res.status(500).json({ error: 'Report summarization failed' });
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlink(tempFile, () => {});
    }
  }
});

/* ── POST /api/ai/clinical/followup-plan — Evidence-based follow-up + optional AI polish ── */
router.post('/clinical/followup-plan', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { patient_id, diagnosis, treatment, notes } = req.body;
    if (!diagnosis?.trim()) {
      return res.status(400).json({ error: 'diagnosis is required' });
    }

    let patient = {};
    if (patient_id) {
      const patRes = await query(
        `SELECT p.*, u.name FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`,
        [patient_id]
      );
      if (patRes.rows[0]) {
        const p = patRes.rows[0];
        patient = {
          name: p.name,
          age: p.date_of_birth
            ? Math.floor((Date.now() - new Date(p.date_of_birth)) / 31557600000)
            : null,
          gender: p.gender,
          allergies: p.allergies,
          blood_group: p.blood_group,
        };
      }
    }

    let result = await runClinicalAnalyzer({
      mode: 'followup',
      diagnosis,
      treatment: treatment || '',
      notes: notes || '',
      patient,
    });

    if (!result?.success) {
      const { reply } = await orchestrate({
        message: `Recommend a follow-up plan.\nDiagnosis: ${diagnosis}\nTreatment: ${treatment || 'N/A'}\nNotes: ${notes || 'None'}`,
        context: { type: 'followup_recommendation', patient_id },
        userRole: req.user.role,
        userId: req.user.id,
        history: [],
      });
      return res.json({
        success: true,
        engine: 'ai_fallback',
        narrative: reply,
        follow_up_date: null,
      });
    }

    if (isAIEnabled) {
      result = await enhanceWithAI(
        'doctor_assistant',
        result,
        `Enhance this evidence-based follow-up plan for ${patient.name || 'the patient'}. Diagnosis: ${diagnosis}. Treatment: ${treatment || 'N/A'}. Notes: ${notes || 'None'}.\n\nBase plan:\n${result.narrative}\n\nKeep structured sections and add patient-specific clinical nuance.`
      );
    }

    res.json(result);
  } catch (err) {
    console.error('Clinical followup error:', err);
    res.status(500).json({ error: 'Follow-up plan generation failed' });
  }
});

module.exports = router;
