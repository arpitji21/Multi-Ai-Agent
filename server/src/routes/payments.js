const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments — admin only
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

// POST /api/payments — patient or admin can record payment
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'doctor') return res.status(403).json({ error: 'Forbidden' });
    const { appointment_id, amount, payment_method, description } = req.body;
    let patient_id = req.body.patient_id;
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      patient_id = pat.rows[0]?.id;
    }
    if (!patient_id) return res.status(400).json({ error: 'patient_id required' });
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

// GET /api/payments/patient/:patient_id — own records (patient) or admin
router.get('/patient/:patient_id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      const ownId = pat.rows[0]?.id?.toString();
      if (ownId !== req.params.patient_id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'doctor') {
      return res.status(403).json({ error: 'Forbidden' });
    }
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

// GET /api/payments/:id — admin or patient (own payment)
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'doctor') return res.status(403).json({ error: 'Forbidden' });
    const result = await query(
      `SELECT p.*, pu.name as patient_name, pat.user_id as patient_user_id,
              a.appointment_date, du.name as doctor_name
       FROM payments p
       JOIN patients pat ON p.patient_id = pat.id
       JOIN users pu ON pat.user_id = pu.id
       LEFT JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       LEFT JOIN users du ON d.user_id = du.id
       WHERE p.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    const payment = result.rows[0];
    if (req.user.role === 'patient' && payment.patient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// PUT /api/payments/:id — admin updates status
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { status, payment_method, description } = req.body;
    const allowed = ['pending', 'completed', 'refunded', 'failed'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    const result = await query(
      `UPDATE payments SET
         status=COALESCE($1,status),
         payment_method=COALESCE($2,payment_method),
         description=COALESCE($3,description)
       WHERE id=$4 RETURNING *`,
      [status || null, payment_method || null, description || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// DELETE /api/payments/:id — admin voids (soft: marks as refunded)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE payments SET status='refunded' WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ message: 'Payment voided (refunded)' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to void payment' });
  }
});

module.exports = router;
