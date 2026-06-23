const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'patient', phone, date_of_birth, gender, blood_group, address, emergency_contact, allergies } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const allowedRoles = ['patient'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Self-registration is only allowed for patients' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, email, role`,
      [name, email, hashed, 'patient', phone || null]
    );
    const user = userResult.rows[0];
    await query(
      `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, date_of_birth || null, gender || null, blood_group || null,
       address || null, emergency_contact || null, allergies || null]
    );

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const refreshToken = signRefreshToken({ id: user.id, role: user.role });
    res.status(201).json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
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

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = signToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, ip_address) VALUES ($1, $2, $3, $4)`,
      [user.id, 'LOGIN', 'auth', req.ip]
    ).catch(() => {});

    res.json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh — issue new access token from refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    // Fetch fresh user info to catch role/status changes
    const result = await query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }
    const user = result.rows[0];
    const newToken = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const newRefreshToken = signRefreshToken({ id: user.id, role: user.role });
    res.json({ token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/logout — client-side token discard; audit the event
router.post('/logout', authenticate, async (req, res) => {
  await query(
    `INSERT INTO audit_logs (user_id, action, resource_type, ip_address) VALUES ($1, $2, $3, $4)`,
    [req.user.id, 'LOGOUT', 'auth', req.ip]
  ).catch(() => {});
  res.json({ message: 'Logged out successfully' });
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
