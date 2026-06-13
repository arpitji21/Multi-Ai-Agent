const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: get doctor record id for current user
async function getOwnDoctorId(userId) {
  const r = await query(`SELECT id FROM doctors WHERE user_id=$1`, [userId]);
  return r.rows[0]?.id ?? null;
}

// Helper: verify doctor owns the profile being accessed, or is admin
async function ownDoctorOrAdmin(req, res, doctorId) {
  if (req.user.role === 'admin') return true;
  const ownId = await getOwnDoctorId(req.user.id);
  if (ownId !== parseInt(doctorId)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

// GET /api/doctors — all authenticated users can list doctors
router.get('/', authenticate, async (req, res) => {
  try {
    const { department_id } = req.query;
    let sql = `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization,
                      d.license_number, d.department_id, dep.name as department_name,
                      d.consultation_fee, d.available, d.rating, d.experience_years
               FROM doctors d
               JOIN users u ON d.user_id = u.id
               LEFT JOIN departments dep ON d.department_id = dep.id
               WHERE u.is_active = true`;
    const params = [];
    if (department_id) {
      params.push(department_id);
      sql += ` AND d.department_id = $${params.length}`;
    }
    sql += ' ORDER BY d.rating DESC NULLS LAST';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctors' });
  }
});

// GET /api/doctors/me/profile — doctor's own profile
router.get('/me/profile', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization,
              d.license_number, d.department_id, dep.name as department_name,
              d.consultation_fee, d.available, d.rating, d.experience_years, d.bio
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN departments dep ON d.department_id = dep.id
       WHERE d.user_id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/doctors — admin creates a doctor user
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, specialization, license_number, department_id, consultation_fee, experience_years, bio } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1,$2,$3,'doctor',$4,true) RETURNING id, name, email, role`,
      [name, email, hashed, phone || null]
    );
    const user = userResult.rows[0];
    const docResult = await query(
      `INSERT INTO doctors (user_id, specialization, license_number, department_id, consultation_fee, experience_years, bio)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user.id, specialization || 'General Medicine', license_number || null,
       department_id || null, consultation_fee || 0, experience_years || 0, bio || null]
    );
    res.status(201).json({ ...docResult.rows[0], name: user.name, email: user.email });
  } catch (err) {
    console.error('Create doctor error:', err);
    res.status(500).json({ error: 'Failed to create doctor' });
  }
});

// GET /api/doctors/:id — any authenticated user
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization,
              d.license_number, d.department_id, dep.name as department_name,
              d.consultation_fee, d.available, d.rating, d.experience_years, d.bio
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN departments dep ON d.department_id = dep.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor' });
  }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const booked = await query(
      `SELECT appointment_time FROM appointments
       WHERE doctor_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled')`,
      [req.params.id, date]
    );
    const bookedTimes = booked.rows.map(r => r.appointment_time);
    const slots = [];
    for (let h = 9; h < 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ time, available: !bookedTimes.includes(time) });
      }
    }
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// GET /api/doctors/:id/today-appointments — own doctor or admin only
router.get('/:id/today-appointments', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const allowed = await ownDoctorOrAdmin(req, res, req.params.id);
    if (!allowed) return;
    const result = await query(
      `SELECT a.*, u.name as patient_name, u.phone as patient_phone,
              p.date_of_birth, p.blood_group, p.allergies
       FROM appointments a
       JOIN patients pat ON a.patient_id = pat.id
       JOIN users u ON pat.user_id = u.id
       LEFT JOIN patients p ON p.user_id = u.id
       WHERE a.doctor_id=$1 AND a.appointment_date=CURRENT_DATE
       ORDER BY a.appointment_time`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch today appointments' });
  }
});

// PUT /api/doctors/:id — own profile (doctor) or admin
router.put('/:id', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const allowed = await ownDoctorOrAdmin(req, res, req.params.id);
    if (!allowed) return;
    const { specialization, consultation_fee, available, experience_years, bio, department_id } = req.body;
    // Doctors cannot change their own department; only admins can
    const deptVal = req.user.role === 'admin' ? (department_id ?? null) : undefined;
    const result = await query(
      `UPDATE doctors SET
         specialization=COALESCE($1,specialization),
         consultation_fee=COALESCE($2,consultation_fee),
         available=COALESCE($3,available),
         experience_years=COALESCE($4,experience_years),
         bio=COALESCE($5,bio),
         ${req.user.role === 'admin' && deptVal !== undefined ? 'department_id=$6,' : ''}
         updated_at=NOW()
       WHERE id=${req.user.role === 'admin' && deptVal !== undefined ? '$7' : '$6'}
       RETURNING *`,
      req.user.role === 'admin' && deptVal !== undefined
        ? [specialization, consultation_fee, available, experience_years, bio, deptVal, req.params.id]
        : [specialization, consultation_fee, available, experience_years, bio, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// DELETE /api/doctors/:id — admin soft-deletes (deactivates)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const docCheck = await query(`SELECT user_id FROM doctors WHERE id=$1`, [req.params.id]);
    if (docCheck.rows.length === 0) return res.status(404).json({ error: 'Doctor not found' });
    await query(`UPDATE users SET is_active=false WHERE id=$1`, [docCheck.rows[0].user_id]);
    res.json({ message: 'Doctor deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate doctor' });
  }
});

module.exports = router;
