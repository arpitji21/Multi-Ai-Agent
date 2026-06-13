const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/doctors
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

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization,
              d.license_number, d.department_id, dep.name as department_name,
              d.consultation_fee, d.available, d.rating, d.experience_years
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

// GET /api/doctors/me/profile
router.get('/me/profile', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const result = await query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization,
              d.license_number, d.department_id, dep.name as department_name,
              d.consultation_fee, d.available, d.rating, d.experience_years
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

// GET /api/doctors/:id/slots?date=YYYY-MM-DD
router.get('/:id/slots', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    // Get booked slots
    const booked = await query(
      `SELECT appointment_time FROM appointments
       WHERE doctor_id=$1 AND appointment_date=$2 AND status NOT IN ('cancelled')`,
      [req.params.id, date]
    );
    const bookedTimes = booked.rows.map(r => r.appointment_time);
    // Generate 9am-5pm slots in 30min increments
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

// PUT /api/doctors/:id
router.put('/:id', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { specialization, consultation_fee, available, experience_years } = req.body;
    const result = await query(
      `UPDATE doctors SET specialization=$1, consultation_fee=$2, available=$3,
       experience_years=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [specialization, consultation_fee, available, experience_years, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update doctor' });
  }
});

// GET /api/doctors/:id/today-appointments
router.get('/:id/today-appointments', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
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

module.exports = router;
