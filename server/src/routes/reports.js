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

// DELETE /api/reports/:id — admin or own patient
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'doctor') return res.status(403).json({ error: 'Forbidden' });
    const check = await query(`SELECT r.id, p.user_id FROM reports r JOIN patients p ON r.patient_id=p.id WHERE r.id=$1`, [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
    if (req.user.role === 'patient' && check.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    // Delete associated file from disk
    const fileCheck = await query(`SELECT file_path FROM reports WHERE id=$1`, [req.params.id]);
    if (fileCheck.rows.length > 0) {
      const filePath = path.join(uploadDir, fileCheck.rows[0].file_path);
      fs.unlink(filePath, () => {});
    }
    await query(`DELETE FROM reports WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
