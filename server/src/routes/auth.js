const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'patient', phone, date_of_birth, gender, blood_group, address } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const allowedRoles = ['patient', 'doctor', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, email, role`,
      [name, email, hashed, role, phone || null]
    );
    const user = userResult.rows[0];

    // Create role-specific profile
    if (role === 'patient') {
      await query(
        `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, date_of_birth || null, gender || null, blood_group || null, address || null]
      );
    } else if (role === 'doctor') {
      const { specialization, license_number, department_id, consultation_fee } = req.body;
      await query(
        `INSERT INTO doctors (user_id, specialization, license_number, department_id, consultation_fee)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, specialization || 'General', license_number || null, department_id || null, consultation_fee || 0]
      );
    } else if (role === 'admin') {
      await query(`INSERT INTO admins (user_id) VALUES ($1)`, [user.id]);
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

    // Log audit
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address) VALUES ($1, $2, $3, $4)`,
      [user.id, 'LOGIN', 'auth', req.ip]
    ).catch(() => {});

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
