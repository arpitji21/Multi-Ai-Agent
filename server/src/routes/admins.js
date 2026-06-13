const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

// GET /api/admins — list all admin users
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.user_id, u.name, u.email, u.phone, u.is_active,
              a.access_level, a.created_at
       FROM admins a
       JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'Failed to fetch admins' });
  }
});

// GET /api/admins/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.user_id, u.name, u.email, u.phone, u.is_active,
              a.access_level, a.created_at
       FROM admins a
       JOIN users u ON a.user_id = u.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin' });
  }
});

// POST /api/admins — create a new admin user
router.post('/', async (req, res) => {
  try {
    const { name, email, password, phone, access_level } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, 'admin', $4, true) RETURNING id, name, email, role`,
      [name, email, hashed, phone || null]
    );
    const user = userResult.rows[0];
    const adminResult = await query(
      `INSERT INTO admins (user_id, access_level) VALUES ($1, $2) RETURNING *`,
      [user.id, access_level || 'standard']
    );
    res.status(201).json({ ...adminResult.rows[0], name: user.name, email: user.email });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

// PUT /api/admins/:id — update admin
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, access_level, is_active } = req.body;
    const adminCheck = await query(`SELECT user_id FROM admins WHERE id=$1`, [req.params.id]);
    if (adminCheck.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    const userId = adminCheck.rows[0].user_id;

    if (name !== undefined || phone !== undefined || is_active !== undefined) {
      await query(
        `UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone),
         is_active=COALESCE($3,is_active) WHERE id=$4`,
        [name || null, phone || null, is_active ?? null, userId]
      );
    }
    if (access_level !== undefined) {
      await query(`UPDATE admins SET access_level=$1 WHERE id=$2`, [access_level, req.params.id]);
    }
    const result = await query(
      `SELECT a.id, a.user_id, u.name, u.email, u.phone, u.is_active, a.access_level
       FROM admins a JOIN users u ON a.user_id = u.id WHERE a.id=$1`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// DELETE /api/admins/:id — deactivate (soft delete) admin
router.delete('/:id', async (req, res) => {
  try {
    const adminCheck = await query(`SELECT user_id FROM admins WHERE id=$1`, [req.params.id]);
    if (adminCheck.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    // Prevent self-deletion
    const adminUser = await query(`SELECT user_id FROM admins WHERE id=$1`, [req.params.id]);
    if (adminUser.rows[0].user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    await query(`UPDATE users SET is_active=false WHERE id=$1`, [adminCheck.rows[0].user_id]);
    res.json({ message: 'Admin deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate admin' });
  }
});

module.exports = router;
