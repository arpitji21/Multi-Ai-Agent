const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — own notifications only
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

// POST /api/notifications — admin can send notifications to any user
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { user_id, title, message, type } = req.body;
    if (!user_id || !title || !message) {
      return res.status(400).json({ error: 'user_id, title and message are required' });
    }
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, title, message, type || 'general']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification' });
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

// PUT /api/notifications/:id/read — own notification only
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// DELETE /api/notifications/:id — own notification or admin
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const whereClause = req.user.role === 'admin'
      ? `WHERE id=$1`
      : `WHERE id=$1 AND user_id=$2`;
    const params = req.user.role === 'admin'
      ? [req.params.id]
      : [req.params.id, req.user.id];
    const result = await query(
      `DELETE FROM notifications ${whereClause} RETURNING id`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
