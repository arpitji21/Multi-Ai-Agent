const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/appointments
router.get('/', authenticate, async (req, res) => {
  try {
    let sql, params = [];
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (pat.rows.length === 0) return res.json([]);
      params = [pat.rows[0].id];
      sql = `SELECT a.*, u.name as doctor_name, d.specialization, dep.name as department_name
             FROM appointments a
             JOIN doctors doc ON a.doctor_id = doc.id
             JOIN users u ON doc.user_id = u.id
             LEFT JOIN departments dep ON doc.department_id = dep.id
             LEFT JOIN doctors d ON a.doctor_id = d.id
             WHERE a.patient_id=$1 ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    } else if (req.user.role === 'doctor') {
      const doc = await query(`SELECT id FROM doctors WHERE user_id=$1`, [req.user.id]);
      if (doc.rows.length === 0) return res.json([]);
      params = [doc.rows[0].id];
      sql = `SELECT a.*, u.name as patient_name, u.phone as patient_phone, p.blood_group, p.gender
             FROM appointments a
             JOIN patients pat ON a.patient_id = pat.id
             JOIN users u ON pat.user_id = u.id
             LEFT JOIN patients p ON p.user_id = u.id
             WHERE a.doctor_id=$1 ORDER BY a.appointment_date DESC, a.appointment_time`;
    } else {
      sql = `SELECT a.*, pu.name as patient_name, du.name as doctor_name, dep.name as department_name
             FROM appointments a
             JOIN patients pat ON a.patient_id = pat.id
             JOIN users pu ON pat.user_id = pu.id
             JOIN doctors doc ON a.doctor_id = doc.id
             JOIN users du ON doc.user_id = du.id
             LEFT JOIN departments dep ON doc.department_id = dep.id
             ORDER BY a.appointment_date DESC, a.appointment_time DESC
             LIMIT $1 OFFSET $2`;
      params = [parseInt(req.query.limit) || 100, parseInt(req.query.offset) || 0];
    }
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST /api/appointments
router.post('/', authenticate, async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, reason, department_id } = req.body;
    if (!doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ error: 'doctor_id, appointment_date, and appointment_time are required' });
    }

    // Get patient id from logged in user
    let patient_id = req.body.patient_id;
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (pat.rows.length === 0) return res.status(400).json({ error: 'Patient profile not found' });
      patient_id = pat.rows[0].id;
    }

    // Check slot availability
    const conflict = await query(
      `SELECT id FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND appointment_time=$3 AND status != 'cancelled'`,
      [doctor_id, appointment_date, appointment_time]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: 'This slot is already booked' });
    }

    const result = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES ($1,$2,$3,$4,$5,'booked') RETURNING *`,
      [patient_id, doctor_id, appointment_date, appointment_time, reason || '']
    );

    // Create notification
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT u.id, 'Appointment Booked', $1, 'appointment'
       FROM patients p JOIN users u ON p.user_id=u.id WHERE p.id=$2`,
      [`Your appointment is confirmed for ${appointment_date} at ${appointment_time}`, patient_id]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, pu.name as patient_name, du.name as doctor_name, dep.name as department_name,
              d.specialization, p.blood_group, p.gender, p.date_of_birth, p.allergies
       FROM appointments a
       JOIN patients pat ON a.patient_id = pat.id
       JOIN users pu ON pat.user_id = pu.id
       JOIN doctors doc ON a.doctor_id = doc.id
       JOIN users du ON doc.user_id = du.id
       LEFT JOIN departments dep ON doc.department_id = dep.id
       LEFT JOIN patients p ON p.user_id = pu.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// PUT /api/appointments/:id/status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['booked', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const result = await query(
      `UPDATE appointments SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// PUT /api/appointments/:id/reschedule
router.put('/:id/reschedule', authenticate, async (req, res) => {
  try {
    const { appointment_date, appointment_time } = req.body;
    const result = await query(
      `UPDATE appointments SET appointment_date=$1, appointment_time=$2, status='booked', updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [appointment_date, appointment_time, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to reschedule' });
  }
});

// GET /api/appointments/stats/overview
router.get('/stats/overview', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [total, today, monthly, cancelled] = await Promise.all([
      query(`SELECT COUNT(*) FROM appointments`),
      query(`SELECT COUNT(*) FROM appointments WHERE appointment_date=CURRENT_DATE`),
      query(`SELECT COUNT(*) FROM appointments WHERE DATE_TRUNC('month', appointment_date)=DATE_TRUNC('month', NOW())`),
      query(`SELECT COUNT(*) FROM appointments WHERE status='cancelled'`),
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      today: parseInt(today.rows[0].count),
      monthly: parseInt(monthly.rows[0].count),
      cancelled: parseInt(cancelled.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
