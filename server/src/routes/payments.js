const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, pu.name as patient_name, du.name as doctor_name
       FROM payments p
       JOIN patients pat ON p.patient_id = pat.id
       JOIN users pu ON pat.user_id = pu.id
       LEFT JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// POST /api/payments — record payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { appointment_id, amount, payment_method, description } = req.body;
    let patient_id = req.body.patient_id;
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      patient_id = pat.rows[0]?.id;
    }
    const result = await query(
      `INSERT INTO payments (patient_id, appointment_id, amount, payment_method, description, status)
       VALUES ($1,$2,$3,$4,$5,'completed') RETURNING *`,
      [patient_id, appointment_id || null, amount, payment_method || 'cash', description || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET /api/payments/patient/:patient_id
router.get('/patient/:patient_id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, a.appointment_date, du.name as doctor_name
       FROM payments p
       LEFT JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       WHERE p.patient_id=$1 ORDER BY p.created_at DESC`,
      [req.params.patient_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

module.exports = router;
