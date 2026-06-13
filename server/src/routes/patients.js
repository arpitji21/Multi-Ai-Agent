const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper: verify requesting patient owns this record, or is admin/doctor
async function ownOrStaff(req, res, patientId) {
  if (req.user.role === 'admin' || req.user.role === 'doctor') return true;
  const pat = await query(`SELECT user_id FROM patients WHERE id=$1`, [patientId]);
  if (pat.rows.length === 0) { res.status(404).json({ error: 'Patient not found' }); return false; }
  if (pat.rows[0].user_id !== req.user.id) { res.status(403).json({ error: 'Forbidden' }); return false; }
  return true;
}

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

// POST /api/patients — admin creates a patient (registration handled in /auth/register)
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, phone, date_of_birth, gender, blood_group, address, emergency_contact, allergies } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    const existing = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1,$2,$3,'patient',$4,true) RETURNING id, name, email, role`,
      [name, email, hashed, phone || null]
    );
    const user = userResult.rows[0];
    const patResult = await query(
      `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, allergies)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user.id, date_of_birth || null, gender || null, blood_group || null,
       address || null, emergency_contact || null, allergies || null]
    );
    res.status(201).json({ ...patResult.rows[0], name: user.name, email: user.email });
  } catch (err) {
    console.error('Create patient error:', err);
    res.status(500).json({ error: 'Failed to create patient' });
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

// GET /api/patients/:id — admin/doctor or own record only
router.get('/:id', authenticate, async (req, res) => {
  try {
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
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

// PUT /api/patients/:id — own record or admin only (doctors cannot edit)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'doctor') return res.status(403).json({ error: 'Doctors cannot edit patient profiles' });
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
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

// DELETE /api/patients/:id — admin soft-deletes (deactivates)
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const patCheck = await query(`SELECT user_id FROM patients WHERE id=$1`, [req.params.id]);
    if (patCheck.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    await query(`UPDATE users SET is_active=false WHERE id=$1`, [patCheck.rows[0].user_id]);
    res.json({ message: 'Patient deactivated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate patient' });
  }
});

// GET /api/patients/:id/medical-history — own record or staff
router.get('/:id/medical-history', authenticate, async (req, res) => {
  try {
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
    const result = await query(
      `SELECT * FROM medical_history WHERE patient_id=$1 ORDER BY date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch medical history' });
  }
});

// POST /api/patients/:id/medical-history — doctor or admin only
router.post('/:id/medical-history', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
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

// GET /api/patients/:id/health-score — own record or staff
router.get('/:id/health-score', authenticate, async (req, res) => {
  try {
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
    const result = await query(`SELECT health_score FROM patients WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json({ health_score: result.rows[0].health_score || 75 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health score' });
  }
});

// GET /api/patients/:id/medicine-reminders — own record or staff
router.get('/:id/medicine-reminders', authenticate, async (req, res) => {
  try {
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
    const result = await query(
      `SELECT * FROM prescriptions WHERE patient_id=$1 AND reminder_active=true ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// DELETE /api/patients/:id/medical-history/:hid — doctor or admin
router.delete('/:id/medical-history/:hid', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM medical_history WHERE id=$1 AND patient_id=$2 RETURNING id`,
      [req.params.hid, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medical history entry not found' });
    res.json({ message: 'Medical history entry deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete medical history' });
  }
});

// PUT /api/patients/:id/medical-history/:hid — doctor or admin
router.put('/:id/medical-history/:hid', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { condition, diagnosis, treatment, date, notes } = req.body;
    const result = await query(
      `UPDATE medical_history SET
         condition=COALESCE($1,condition),
         diagnosis=COALESCE($2,diagnosis),
         treatment=COALESCE($3,treatment),
         date=COALESCE($4,date),
         notes=COALESCE($5,notes)
       WHERE id=$6 AND patient_id=$7 RETURNING *`,
      [condition||null, diagnosis||null, treatment||null, date||null, notes||null, req.params.hid, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Medical history entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update medical history' });
  }
});

// POST /api/patients/:id/medicine-reminders — own record or doctor
router.post('/:id/medicine-reminders', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Forbidden' });
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
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

// PUT /api/patients/:id/medicine-reminders/:rid — own record or doctor
router.put('/:id/medicine-reminders/:rid', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Forbidden' });
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
    const { medication_name, dosage, frequency, start_date, end_date, reminder_active, instructions } = req.body;
    const result = await query(
      `UPDATE prescriptions SET
         medication_name=COALESCE($1,medication_name),
         dosage=COALESCE($2,dosage),
         frequency=COALESCE($3,frequency),
         start_date=COALESCE($4,start_date),
         end_date=COALESCE($5,end_date),
         reminder_active=COALESCE($6,reminder_active),
         instructions=COALESCE($7,instructions),
         updated_at=NOW()
       WHERE id=$8 AND patient_id=$9 RETURNING *`,
      [medication_name||null, dosage||null, frequency||null, start_date||null,
       end_date||null, reminder_active??null, instructions||null, req.params.rid, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prescription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/patients/:id/medicine-reminders/:rid — own record or doctor
router.delete('/:id/medicine-reminders/:rid', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Forbidden' });
    const allowed = await ownOrStaff(req, res, req.params.id);
    if (!allowed) return;
    const result = await query(
      `DELETE FROM prescriptions WHERE id=$1 AND patient_id=$2 RETURNING id`,
      [req.params.rid, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prescription not found' });
    res.json({ message: 'Prescription deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

module.exports = router;
