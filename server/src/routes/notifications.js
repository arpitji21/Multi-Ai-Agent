const express = require('express');
const { query } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await query(`UPDATE notifications SET is_read=true WHERE user_id=$1`, [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

module.exports = router;
