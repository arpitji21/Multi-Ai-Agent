const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/emr — doctor gets all EMRs for their patients
router.get('/', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'doctor') {
      const doc = await query(`SELECT id FROM doctors WHERE user_id=$1`, [req.user.id]);
      result = await query(
        `SELECT e.*, u.name as patient_name, a.appointment_date
         FROM emr_records e
         JOIN patients p ON e.patient_id = p.id
         JOIN users u ON p.user_id = u.id
         LEFT JOIN appointments a ON e.appointment_id = a.id
         WHERE e.doctor_id=$1 ORDER BY e.created_at DESC`,
        [doc.rows[0]?.id]
      );
    } else {
      result = await query(
        `SELECT e.*, pu.name as patient_name, du.name as doctor_name
         FROM emr_records e
         JOIN patients p ON e.patient_id = p.id
         JOIN users pu ON p.user_id = pu.id
         JOIN doctors d ON e.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         ORDER BY e.created_at DESC LIMIT 50`
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EMRs' });
  }
});

// POST /api/emr — create EMR
router.post('/', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { patient_id, appointment_id, diagnosis, treatment_plan, prescription, follow_up_date, notes, vital_signs } = req.body;
    const doc = await query(`SELECT id FROM doctors WHERE user_id=$1`, [req.user.id]);
    if (doc.rows.length === 0) return res.status(400).json({ error: 'Doctor profile not found' });

    const result = await query(
      `INSERT INTO emr_records (patient_id, doctor_id, appointment_id, diagnosis, treatment_plan, prescription, follow_up_date, notes, vital_signs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patient_id, doc.rows[0].id, appointment_id || null, diagnosis, treatment_plan, prescription, follow_up_date || null, notes, vital_signs ? JSON.stringify(vital_signs) : null]
    );

    // Update appointment status to completed if appointment_id provided
    if (appointment_id) {
      await query(`UPDATE appointments SET status='completed', updated_at=NOW() WHERE id=$1`, [appointment_id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create EMR' });
  }
});

// GET /api/emr/patient/:patient_id
router.get('/patient/:patient_id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, du.name as doctor_name, d.specialization
       FROM emr_records e
       JOIN doctors d ON e.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE e.patient_id=$1 ORDER BY e.created_at DESC`,
      [req.params.patient_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EMRs' });
  }
});

// GET /api/emr/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, du.name as doctor_name, d.specialization, pu.name as patient_name
       FROM emr_records e
       JOIN doctors d ON e.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       JOIN patients p ON e.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       WHERE e.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'EMR not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EMR' });
  }
});

module.exports = router;
