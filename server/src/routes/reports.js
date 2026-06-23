const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG files are allowed'));
  },
});

// GET /api/reports — role-scoped list
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    const { patient_id } = req.query;

    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (pat.rows.length === 0) return res.json([]);
      result = await query(
        `SELECT r.*, aa.patient_summary, aa.doctor_summary, aa.key_findings, aa.is_critical
         FROM reports r
         LEFT JOIN ai_analyses aa ON aa.report_id = r.id
         WHERE r.patient_id=$1 ORDER BY r.created_at DESC`,
        [pat.rows[0].id]
      );
    } else if (req.user.role === 'doctor' || req.user.role === 'admin') {
      let q = `
        SELECT r.*, u.name as patient_name, aa.patient_summary, aa.doctor_summary, aa.is_critical, aa.key_findings, aa.abnormal_values
        FROM reports r
        JOIN patients p ON r.patient_id = p.id
        JOIN users u ON p.user_id = u.id
        LEFT JOIN ai_analyses aa ON aa.report_id = r.id
      `;
      let params = [];
      if (patient_id) {
        q += ` WHERE r.patient_id = $1`;
        params.push(patient_id);
      }
      q += ` ORDER BY r.created_at DESC LIMIT 100`;
      result = await query(q, params);
    } else {
      result = await query(
        `SELECT r.*, u.name as patient_name
         FROM reports r
         JOIN patients p ON r.patient_id = p.id
         JOIN users u ON p.user_id = u.id
         ORDER BY r.created_at DESC LIMIT 100`
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /api/reports/stats/overview — admin only
router.get('/stats/overview', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [total, today, pending] = await Promise.all([
      query(`SELECT COUNT(*) FROM reports`),
      query(`SELECT COUNT(*) FROM reports WHERE DATE(created_at)=CURRENT_DATE`),
      query(`SELECT COUNT(*) FROM reports r LEFT JOIN ai_analyses aa ON aa.report_id=r.id WHERE aa.id IS NULL`),
    ]);
    res.json({
      total: parseInt(total.rows[0].count),
      today: parseInt(today.rows[0].count),
      pending_analysis: parseInt(pending.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report stats' });
  }
});

// POST /api/reports/upload
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { report_type, notes } = req.body;

    let patient_id = req.body.patient_id;
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (pat.rows.length === 0) return res.status(400).json({ error: 'Patient profile not found' });
      patient_id = pat.rows[0].id;
    }
    if (!patient_id) return res.status(400).json({ error: 'patient_id required' });

    const result = await query(
      `INSERT INTO reports (patient_id, file_name, file_path, file_type, report_type, notes, file_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [patient_id, req.file.originalname, req.file.filename, req.file.mimetype,
        report_type || 'general', notes || '', req.file.size]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload report' });
  }
});

// GET /api/reports/patient/:patient_id/timeline — own record or staff
router.get('/patient/:patient_id/timeline', authenticate, async (req, res) => {
  try {
    const requestedPatId = parseInt(req.params.patient_id);
    if (req.user.role === 'patient') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (!pat.rows.length || pat.rows[0].id !== requestedPatId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const result = await query(
      `SELECT r.id, r.file_name, r.report_type, r.created_at,
              aa.patient_summary, aa.is_critical, aa.key_findings
       FROM reports r
       LEFT JOIN ai_analyses aa ON aa.report_id = r.id
       WHERE r.patient_id=$1 ORDER BY r.created_at DESC`,
      [requestedPatId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// GET /api/reports/:id — own report (patient) or staff
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT r.*, p.user_id as patient_user_id,
              aa.patient_summary, aa.doctor_summary, aa.key_findings, aa.abnormal_values, aa.is_critical
       FROM reports r
       JOIN patients p ON r.patient_id = p.id
       LEFT JOIN ai_analyses aa ON aa.report_id = r.id
       WHERE r.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    const report = result.rows[0];
    if (req.user.role === 'patient' && report.patient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// PUT /api/reports/:id — admin or doctor can update metadata
router.put('/:id', authenticate, requireRole('admin', 'doctor'), async (req, res) => {
  try {
    const { report_type, notes } = req.body;
    const result = await query(
      `UPDATE reports SET
         report_type=COALESCE($1,report_type),
         notes=COALESCE($2,notes)
       WHERE id=$3 RETURNING *`,
      [report_type || null, notes || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

const { spawn } = require('child_process');

// DELETE /api/reports/:id — admin or own patient
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const reportRes = await query(`SELECT patient_id FROM reports WHERE id=$1`, [req.params.id]);
    if (reportRes.rows.length === 0) return res.status(404).json({ error: 'Report not found' });

    // Auth check: Admin or the patient themselves
    if (req.user.role !== 'admin') {
      const pat = await query(`SELECT id FROM patients WHERE user_id=$1`, [req.user.id]);
      if (pat.rows.length === 0 || pat.rows[0].id !== reportRes.rows[0].patient_id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await query(`DELETE FROM reports WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

/* ── POST /api/reports/certificate — Generate professional medical certificate (Local Python) ── */
router.post('/certificate', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const { patient_id, cert_type, start_date, end_date, reason, fitness_date, custom_body } = req.body;

    if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

    // Fetch patient and doctor info for the certificate
    const info = await query(`
      SELECT p.id, u.name as patient_name, d.id as doctor_id, du.name as doctor_name
      FROM patients p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN appointments a ON a.patient_id = p.id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      LEFT JOIN users du ON d.user_id = du.id
      WHERE p.id = $1
      ORDER BY a.created_at DESC LIMIT 1
    `, [patient_id]);

    if (info.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

    const data = {
      ...info.rows[0],
      cert_type: cert_type || 'Medical Certificate',
      start_date,
      end_date,
      reason,
      fitness_date,
      custom_body,
      verify_id: `MEDIAI-${Date.now()}`
    };

    const fileName = `cert_${patient_id}_${Date.now()}.pdf`;
    const outputPath = path.join(__dirname, '../../uploads/certificates', fileName);

    if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const pythonProcess = spawn('python', [
      path.join(__dirname, '../utils/generate_certificate.py'),
      JSON.stringify(data),
      outputPath
    ]);

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.startsWith('SUCCESS:')) {
        const publicUrl = `/uploads/certificates/${fileName}`;
        res.json({ message: 'Certificate generated successfully', pdf_url: publicUrl });
      } else if (output.startsWith('ERROR:')) {
        console.error('Python PDF Error:', output);
        res.status(500).json({ error: 'Failed to generate certificate PDF' });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

  } catch (err) {
    console.error('Certificate generation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
