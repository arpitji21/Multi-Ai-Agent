const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/patients — admin/doctor can list all, patient sees own
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin' || req.user.role === 'doctor') {
      result = await query(
        `SELECT p.id, p.user_id, u.name, u.email, u.phone, p.date_of_birth, p.gender,
                p.blood_group, p.address, p.emergency_contact, p.allergies, p.health_score,
                u.created_at
         FROM patients p JOIN users u ON p.user_id = u.id
         WHERE u.is_active = true
         ORDER BY u.created_at DESC
         LIMIT $1 OFFSET $2`,
        [parseInt(req.query.limit) || 50, parseInt(req.query.offset) || 0]
      );
    } else {
      result = await query(
        `SELECT p.id, p.user_id, u.name, u.email, u.phone, p.date_of_birth, p.gender,
                p.blood_group, p.address, p.emergency_contact, p.allergies, p.health_score
         FROM patients p JOIN users u ON p.user_id = u.id
         WHERE p.user_id = $1`,
        [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.user_id, u.name, u.email, u.phone, p.date_of_birth, p.gender,
              p.blood_group, p.address, p.emergency_contact, p.allergies, p.health_score,
              u.created_at
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// GET /api/patients/me/profile — patient gets own full profile
router.get('/me/profile', authenticate, requireRole('patient'), async (req, res) => {
  try {
    const result = await query(
      `SELECT p.id, p.user_id, u.name, u.email, u.phone, p.date_of_birth, p.gender,
              p.blood_group, p.address, p.emergency_contact, p.allergies, p.health_score,
              u.created_at
       FROM patients p JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/patients/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { date_of_birth, gender, blood_group, address, emergency_contact, allergies } = req.body;
    const result = await query(
      `UPDATE patients SET date_of_birth=$1, gender=$2, blood_group=$3, address=$4,
       emergency_contact=$5, allergies=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [date_of_birth, gender, blood_group, address, emergency_contact, allergies, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// GET /api/patients/:id/medical-history
router.get('/:id/medical-history', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM medical_history WHERE patient_id=$1 ORDER BY date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
});

// POST /api/patients/:id/medical-history
router.post('/:id/medical-history', authenticate, async (req, res) => {
  try {
    const { condition, diagnosis, treatment, date, notes } = req.body;
    const result = await query(
      `INSERT INTO medical_history (patient_id, condition, diagnosis, treatment, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, condition, diagnosis, treatment, date || new Date(), notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add medical history' });
  }
});

// GET /api/patients/:id/health-score
router.get('/:id/health-score', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT health_score FROM patients WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json({ health_score: result.rows[0].health_score || 75 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health score' });
  }
});

// GET /api/patients/:id/medicine-reminders
router.get('/:id/medicine-reminders', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM prescriptions WHERE patient_id=$1 AND reminder_active=true ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/patients/:id/medicine-reminders
router.post('/:id/medicine-reminders', authenticate, async (req, res) => {
  try {
    const { medication_name, dosage, frequency, start_date, end_date } = req.body;
    const result = await query(
      `INSERT INTO prescriptions (patient_id, medication_name, dosage, frequency, start_date, end_date, reminder_active)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [req.params.id, medication_name, dosage, frequency, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reminder' });
  }
});

module.exports = router;
