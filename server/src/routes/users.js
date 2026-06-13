/**
 * /api/users — admin-managed user CRUD resource
 * Patients, doctors, and admins manage their own profiles via their respective routes.
 * This resource gives admins full visibility and lifecycle control over the users table.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(authenticate, requireRole('admin'));

// GET /api/users — list all users with optional role filter
router.get('/', async (req, res) => {
  try {
    const { role, is_active } = req.query;
    let sql = `SELECT id, name, email, role, phone, is_active, created_at, updated_at FROM users WHERE 1=1`;
    const params = [];
    if (role) { params.push(role); sql += ` AND role=$${params.length}`; }
    if (is_active !== undefined) { params.push(is_active === 'true'); sql += ` AND is_active=$${params.length}`; }
    sql += ` ORDER BY created_at DESC`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, phone, is_active, created_at, updated_at FROM users WHERE id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users — admin creates a user (any role)
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required' });
    }
    if (!['patient', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, phone)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, phone, is_active, created_at`,
      [name, email, hash, role, phone || null]
    );
    const user = result.rows[0];

    // Auto-provision role extension table row
    if (role === 'patient') {
      await query(`INSERT INTO patients (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
    } else if (role === 'doctor') {
      await query(`INSERT INTO doctors (user_id, specialization) VALUES ($1,'General Medicine') ON CONFLICT (user_id) DO NOTHING`, [user.id]);
    } else if (role === 'admin') {
      await query(`INSERT INTO admins (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);
    }

    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — admin updates name, phone, is_active (not role or password here)
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, is_active, password } = req.body;
    let hashClause = '';
    const params = [name || null, phone || null, is_active ?? null, req.params.id];
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      hashClause = ', password_hash=$5';
      params.splice(3, 0, hash); // insert before id
      params[params.length - 1] = req.params.id; // keep id last
    }
    const idPos = password ? 5 : 4;
    const result = await query(
      `UPDATE users SET
         name=COALESCE($1,name),
         phone=COALESCE($2,phone),
         is_active=COALESCE($3,is_active)
         ${password ? ', password_hash=$4' : ''}
         ,updated_at=NOW()
       WHERE id=$${idPos} RETURNING id, name, email, role, phone, is_active, updated_at`,
      password
        ? [name || null, phone || null, is_active ?? null, await bcrypt.hash(password, 12), req.params.id]
        : [name || null, phone || null, is_active ?? null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id — hard delete (cascades to role tables via FK)
router.delete('/:id', async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await query(`DELETE FROM users WHERE id=$1 RETURNING id, email`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: `User ${result.rows[0].email} deleted` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
