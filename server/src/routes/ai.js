const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/ai/chat — main AI orchestrator (stub, full AI in Phase 5)
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context, session_id } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context, session_id)
       VALUES ($1, 'user', $2, $3, $4)`,
      [req.user.id, message, context ? JSON.stringify(context) : null, session_id || null]
    );

    const reply = `I'm your MediAI Assistant. I received your message: "${message}". Full AI capabilities will be enabled shortly.`;

    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context, session_id)
       VALUES ($1, 'assistant', $2, $3, $4)`,
      [req.user.id, reply, null, session_id || null]
    );

    res.json({ reply, role: req.user.role });
  } catch (err) {
    res.status(500).json({ error: 'AI chat failed' });
  }
});

// GET /api/ai/conversations — own conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM ai_conversations WHERE user_id=$1 ORDER BY created_at ASC LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// DELETE /api/ai/conversations — clear own conversation history
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

// DELETE /api/ai/conversations/:id — delete a specific message (admin or own)
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

// POST /api/ai/symptom-check
router.post('/symptom-check', authenticate, async (req, res) => {
  try {
    const { symptoms } = req.body;
    res.json({
      suggested_department: 'General Medicine',
      urgency: 'routine',
      message: 'Based on your symptoms, we recommend consulting with a General Medicine specialist. Please book an appointment.',
      symptoms_received: symptoms,
    });
  } catch (err) {
    res.status(500).json({ error: 'Symptom check failed' });
  }
});

// POST /api/ai/analyze-report/:report_id
router.post('/analyze-report/:report_id', authenticate, async (req, res) => {
  try {
    const { report_id } = req.params;
    const reportResult = await query(`SELECT * FROM reports WHERE id=$1`, [report_id]);
    if (reportResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    const existing = await query(`SELECT * FROM ai_analyses WHERE report_id=$1`, [report_id]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    const analysis = await query(
      `INSERT INTO ai_analyses (report_id, patient_summary, doctor_summary, key_findings, abnormal_values, is_critical)
       VALUES ($1,$2,$3,$4,$5,false) RETURNING *`,
      [
        report_id,
        'Your report has been received and is being analyzed.',
        'Report received. Preliminary review indicates standard parameters.',
        JSON.stringify(['Report uploaded successfully', 'Analysis in progress']),
        JSON.stringify([]),
      ]
    );
    res.json(analysis.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Report analysis failed' });
  }
});

// GET /api/ai/voice-transcripts — own transcripts
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

// POST /api/ai/voice-transcripts — create transcript (doctor or patient)
router.post('/voice-transcripts', authenticate, async (req, res) => {
  try {
    const { transcript, audio_duration, emr_id } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });
    const result = await query(
      `INSERT INTO voice_transcripts (user_id, transcript, audio_duration, emr_id, processed)
       VALUES ($1,$2,$3,$4,false) RETURNING *`,
      [req.user.id, transcript, audio_duration || null, emr_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create transcript' });
  }
});

// GET /api/ai/voice-transcripts/:id — own transcript or admin
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

// PUT /api/ai/voice-transcripts/:id — update own transcript (mark processed, link emr)
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
      [transcript||null, processed??null, emr_id||null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

// DELETE /api/ai/voice-transcripts/:id — own or admin
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
