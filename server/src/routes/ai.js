const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/ai/chat — main AI orchestrator (stub, will be filled in Phase 5)
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Store conversation
    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context)
       VALUES ($1, 'user', $2, $3)`,
      [req.user.id, message, context ? JSON.stringify(context) : null]
    );

    // Placeholder response — AI integration in Phase 5
    const reply = `I'm your MediAI Assistant. I received your message: "${message}". Full AI capabilities will be enabled shortly.`;

    await query(
      `INSERT INTO ai_conversations (user_id, role, message, context)
       VALUES ($1, 'assistant', $2, $3)`,
      [req.user.id, reply, null]
    );

    res.json({ reply, role: req.user.role });
  } catch (err) {
    res.status(500).json({ error: 'AI chat failed' });
  }
});

// GET /api/ai/conversations
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

// POST /api/ai/symptom-check
router.post('/symptom-check', authenticate, async (req, res) => {
  try {
    const { symptoms } = req.body;
    // Placeholder — full AI in Phase 5
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

    // Check if analysis exists
    const existing = await query(`SELECT * FROM ai_analyses WHERE report_id=$1`, [report_id]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    // Placeholder analysis — full AI in Phase 5
    const analysis = await query(
      `INSERT INTO ai_analyses (report_id, patient_summary, doctor_summary, key_findings, abnormal_values, is_critical)
       VALUES ($1,$2,$3,$4,$5,false) RETURNING *`,
      [
        report_id,
        'Your report has been received and is being analyzed. The AI analysis will provide insights about your health metrics.',
        'Report received. Preliminary review indicates standard parameters. Detailed AI analysis pending integration.',
        JSON.stringify(['Report uploaded successfully', 'Analysis in progress']),
        JSON.stringify([]),
      ]
    );
    res.json(analysis.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Report analysis failed' });
  }
});

module.exports = router;
