const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { orchestrate, analyzeReport, symptomCheck, calculateHealthScore, generateEMR } = require('../ai/agents');

const router = express.Router();

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
            `INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
             SELECT u.id, 'critical_report', 'CRITICAL: Report Alert',
               $1, $2, 'report'
             FROM doctors doc JOIN users u ON u.id=doc.user_id
             WHERE doc.id=$3`,
            [
              `🚨 Critical values detected in patient report "${report.file_name}". ${analysis.emergency_reason || 'Immediate clinical review required.'}`,
              report_id,
              d.doctor_id,
            ]
          ).catch(() => {}); // non-fatal if notifications table doesn't support this schema
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

module.exports = router;
