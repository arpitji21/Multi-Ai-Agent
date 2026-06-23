const PDFDocument = require('pdfkit');
const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const path = require('path');


const router = express.Router();

// Helper: resolve patient_id for requesting patient user
async function getOwnPatientId(userId) {
  const r = await query(`SELECT id FROM patients WHERE user_id=$1`, [userId]);
  return r.rows[0]?.id ?? null;
}

// Helper: resolve doctor_id for requesting doctor user
async function getOwnDoctorId(userId) {
  const r = await query(`SELECT id FROM doctors WHERE user_id=$1`, [userId]);
  return r.rows[0]?.id ?? null;
}

// GET /api/emr/:id/pdf — Download PDF of EMR
// router.get('/:id/pdf', authenticate, async (req, res) => {
//   try {
//     const result = await query(
//       `SELECT e.*, du.name as doctor_name, d.specialization, pu.name as patient_name,
//               p.user_id as patient_user_id
//        FROM emr_records e
//        JOIN doctors d ON e.doctor_id = d.id
//        JOIN users du ON d.user_id = du.id
//        JOIN patients p ON e.patient_id = p.id
//        JOIN users pu ON p.user_id = pu.id
//        WHERE e.id=$1`,
//       [req.params.id]
//     );
//     if (result.rows.length === 0) return res.status(404).json({ error: 'EMR not found' });

//     const emr = result.rows[0];
    
//     // Auth check
//     if (req.user.role === 'patient' && emr.patient_user_id !== req.user.id) {
//       return res.status(403).json({ error: 'Forbidden' });
//     }
//     if (req.user.role === 'doctor') {
//         const docId = await getOwnDoctorId(req.user.id);
//         if (emr.doctor_id !== docId) return res.status(403).json({ error: 'Forbidden' });
//     }

//     const pdfDir = path.join(__dirname, '../../uploads/emr_reports');
//     if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

//     const pdfName = `emr_${emr.id}_${Date.now()}.pdf`;
//     const pdfPath = path.join(pdfDir, pdfName);

//     // Run Python script to generate PDF
//     const pythonProcess = spawn('python', [
//       path.join(__dirname, '../utils/generate_pdf.py'),
//       JSON.stringify(emr),
//       pdfPath
//     ]);

//     let errorData = '';
//     pythonProcess.stderr.on('data', (data) => {
//       errorData += data.toString();
//     });

//     pythonProcess.on('close', (code) => {
//       if (code !== 0) {
//         console.error('Python PDF generation error:', errorData);
//         return res.status(500).json({ error: 'Failed to generate PDF' });
//       }
//       // Return the URL to the generated PDF
//       res.json({ pdf_url: `/uploads/emr_reports/${pdfName}` });
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to process PDF request' });
//   }
// });

// router.get('/:id/pdf', authenticate, async (req, res) => {
//   try {
//     const result = await query(
//       `SELECT e.*, du.name as doctor_name, d.specialization,
//               pu.name as patient_name,
//               p.user_id as patient_user_id
//        FROM emr_records e
//        JOIN doctors d ON e.doctor_id = d.id
//        JOIN users du ON d.user_id = du.id
//        JOIN patients p ON e.patient_id = p.id
//        JOIN users pu ON p.user_id = pu.id
//        WHERE e.id=$1`,
//       [req.params.id]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'EMR not found' });
//     }

//     const emr = result.rows[0];

//     // Authorization
//     if (
//       req.user.role === 'patient' &&
//       emr.patient_user_id !== req.user.id
//     ) {
//       return res.status(403).json({ error: 'Forbidden' });
//     }

//     if (req.user.role === 'doctor') {
//       const docId = await getOwnDoctorId(req.user.id);

//       if (emr.doctor_id !== docId) {
//         return res.status(403).json({ error: 'Forbidden' });
//       }
//     }

//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader(
//       'Content-Disposition',
//       `attachment; filename=EMR-${emr.id}.pdf`
//     );

//     const doc = new PDFDocument();

//     doc.pipe(res);

//     doc.fontSize(22).text('Electronic Medical Record', {
//       align: 'center'
//     });

//     doc.moveDown();

//     doc.fontSize(14).text(`Patient: ${emr.patient_name}`);
//     doc.text(`Doctor: ${emr.doctor_name}`);
//     doc.text(`Specialization: ${emr.specialization || 'N/A'}`);

//     doc.moveDown();

//     doc.text(`Diagnosis: ${emr.diagnosis || 'N/A'}`);

//     doc.moveDown();

//     doc.text(`Treatment Plan:`);
//     doc.text(emr.treatment_plan || 'N/A');

//     doc.moveDown();

//     doc.text(`Prescription:`);
//     doc.text(emr.prescription || 'N/A');

//     doc.moveDown();

//     doc.text(`Notes:`);
//     doc.text(emr.notes || 'N/A');

//     doc.moveDown();

//     doc.text(
//       `Follow Up Date: ${
//         emr.follow_up_date
//           ? new Date(emr.follow_up_date).toLocaleDateString()
//           : 'N/A'
//       }`
//     );

//     doc.end();

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       error: 'Failed to generate PDF'
//     });
//   }
// });


router.get('/:id/pdf', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, du.name as doctor_name, d.specialization,
              pu.name as patient_name,
              p.user_id as patient_user_id
       FROM emr_records e
       JOIN doctors d ON e.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       JOIN patients p ON e.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       WHERE e.id=$1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'EMR not found' });
    }

    const emr = result.rows[0];

    // Authorization
    if (
      req.user.role === 'patient' &&
      emr.patient_user_id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (req.user.role === 'doctor') {
      const docId = await getOwnDoctorId(req.user.id);

      if (emr.doctor_id !== docId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=EMR-${emr.id}.pdf`
    );

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    doc.pipe(res);

    // ===== TITLE =====
    doc
      .fontSize(24)
      .fillColor('#ED2024')
      .text('MediAI Hospital EMR Report', {
        align: 'center'
      });

    doc.moveDown(1);

    // ===== PATIENT INFO BOX =====
    doc
      .roundedRect(50, 110, 500, 85, 5)
      .lineWidth(1)
      .stroke('#CCCCCC');

    doc
      .fillColor('black')
      .fontSize(11);

    doc.text(
      `Patient Name: ${emr.patient_name || 'N/A'}`,
      70,
      125
    );

    doc.text(
      `Doctor Name: ${emr.doctor_name || 'N/A'}`,
      300,
      125
    );

    doc.text(
      `Date: ${
        emr.created_at
          ? new Date(emr.created_at).toLocaleDateString()
          : 'N/A'
      }`,
      70,
      155
    );

    doc.text(
      `Specialization: ${emr.specialization || 'N/A'}`,
      300,
      155
    );

    let y = 230;

    function addSection(title, content) {
      doc
        .fillColor('#333333')
        .rect(50, y, 500, 25)
        .fill();

      doc
        .fillColor('white')
        .fontSize(12)
        .text(title, 60, y + 6);

      y += 40;

      doc
        .fillColor('black')
        .fontSize(11)
        .text(
          content || 'No information available.',
          60,
          y,
          {
            width: 470
          }
        );

      y = doc.y + 20;
    }

    // ===== VITALS =====
    if (emr.vital_signs) {
      let vitals = emr.vital_signs;

      if (typeof vitals === 'string') {
        try {
          vitals = JSON.parse(vitals);
        } catch {
          vitals = null;
        }
      }

      if (vitals) {
        addSection(
          'VITAL SIGNS',
          `Blood Pressure: ${vitals.bp || '-'} mmHg

Temperature: ${vitals.temp || '-'} °F

Heart Rate: ${vitals.pulse || '-'} bpm`
        );
      }
    }

    // ===== DIAGNOSIS =====
    addSection(
      'DIAGNOSIS',
      emr.diagnosis || 'No diagnosis recorded.'
    );

    // ===== NOTES =====
    addSection(
      'CLINICAL NOTES',
      emr.notes || 'No clinical notes available.'
    );

    // ===== TREATMENT =====
    addSection(
      'TREATMENT PLAN',
      emr.treatment_plan ||
        'No treatment plan recorded.'
    );

    // ===== PRESCRIPTION =====
    addSection(
      'PRESCRIBED MEDICATIONS',
      emr.prescription ||
        'No medications prescribed.'
    );

    // ===== FOLLOW UP =====
    if (emr.follow_up_date) {
      addSection(
        'FOLLOW-UP INSTRUCTIONS',
        `Scheduled Follow-up: ${new Date(
          emr.follow_up_date
        ).toLocaleDateString()}`
      );
    }

    // ===== FOOTER =====
    doc
      .fontSize(8)
      .fillColor('gray')
      .text(
        'This is a computer-generated EMR report from MediAI Hospital Suite. Please consult your physician for medical advice.',
        50,
        760,
        {
          align: 'center',
          width: 500
        }
      );

    doc.end();

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Failed to generate PDF'
    });
  }
});



// GET /api/emr — doctor sees their own EMRs; admin sees all
router.get('/', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'doctor') {
      const docId = await getOwnDoctorId(req.user.id);
      result = await query(
        `SELECT e.*, u.name as patient_name, a.appointment_date
         FROM emr_records e
         JOIN patients p ON e.patient_id = p.id
         JOIN users u ON p.user_id = u.id
         LEFT JOIN appointments a ON e.appointment_id = a.id
         WHERE e.doctor_id=$1 ORDER BY e.created_at DESC`,
        [docId]
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

// POST /api/emr — doctor creates EMR for their patient
router.post('/', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { patient_id, appointment_id, diagnosis, treatment_plan, prescription, follow_up_date, notes, vital_signs } = req.body;
    const docId = await getOwnDoctorId(req.user.id);
    if (!docId) return res.status(400).json({ error: 'Doctor profile not found' });

    // If appointment provided, verify doctor owns it
    if (appointment_id) {
      const appt = await query(`SELECT doctor_id FROM appointments WHERE id=$1`, [appointment_id]);
      if (appt.rows.length > 0 && appt.rows[0].doctor_id !== docId) {
        return res.status(403).json({ error: 'Cannot create EMR for another doctor\'s appointment' });
      }
    }

    const result = await query(
      `INSERT INTO emr_records (patient_id, doctor_id, appointment_id, diagnosis, treatment_plan, prescription, follow_up_date, notes, vital_signs)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [patient_id, docId, appointment_id || null, diagnosis, treatment_plan, prescription,
       follow_up_date || null, notes, vital_signs ? JSON.stringify(vital_signs) : null]
    );

    if (appointment_id) {
      await query(`UPDATE appointments SET status='completed', updated_at=NOW() WHERE id=$1`, [appointment_id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create EMR' });
  }
});

// GET /api/emr/patient/:patient_id — own record (patient), or staff (doctor/admin)
router.get('/patient/:patient_id', authenticate, async (req, res) => {
  try {
    const requestedPatId = parseInt(req.params.patient_id);

    if (req.user.role === 'patient') {
      const ownPatId = await getOwnPatientId(req.user.id);
      if (ownPatId !== requestedPatId) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role === 'doctor') {
      // Doctor can see all EMRs for this patient to ensure continuity of care
      const result = await query(
        `SELECT e.*, du.name as doctor_name, d.specialization
         FROM emr_records e
         JOIN doctors d ON e.doctor_id = d.id
         JOIN users du ON d.user_id = du.id
         WHERE e.patient_id=$1 ORDER BY e.created_at DESC`,
        [requestedPatId]
      );
      return res.json(result.rows);
    }
    // Patient (own) or admin: see all EMRs for this patient
    const result = await query(
      `SELECT e.*, du.name as doctor_name, d.specialization
       FROM emr_records e
       JOIN doctors d ON e.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       WHERE e.patient_id=$1 ORDER BY e.created_at DESC`,
      [requestedPatId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EMRs' });
  }
});

// GET /api/emr/:id — own EMR record (patient), own EMR (doctor created it), or admin
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, du.name as doctor_name, d.specialization, pu.name as patient_name,
              p.user_id as patient_user_id
       FROM emr_records e
       JOIN doctors d ON e.doctor_id = d.id
       JOIN users du ON d.user_id = du.id
       JOIN patients p ON e.patient_id = p.id
       JOIN users pu ON p.user_id = pu.id
       WHERE e.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'EMR not found' });

    const emr = result.rows[0];
    if (req.user.role === 'patient' && emr.patient_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'doctor') {
      const docId = await getOwnDoctorId(req.user.id);
      if (emr.doctor_id !== docId) return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(emr);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch EMR' });
  }
});

// PUT /api/emr/:id — doctor who created it or admin
router.put('/:id', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  try {
    const check = await query(`SELECT doctor_id FROM emr_records WHERE id=$1`, [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'EMR not found' });
    if (req.user.role === 'doctor') {
      const docId = await getOwnDoctorId(req.user.id);
      if (check.rows[0].doctor_id !== docId) return res.status(403).json({ error: 'Forbidden' });
    }
    const { diagnosis, treatment_plan, prescription, follow_up_date, notes, vital_signs } = req.body;
    const result = await query(
      `UPDATE emr_records SET
         diagnosis=COALESCE($1,diagnosis),
         treatment_plan=COALESCE($2,treatment_plan),
         prescription=COALESCE($3,prescription),
         follow_up_date=COALESCE($4,follow_up_date),
         notes=COALESCE($5,notes),
         vital_signs=COALESCE($6::jsonb,vital_signs),
         updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [diagnosis||null, treatment_plan||null, prescription||null, follow_up_date||null,
       notes||null, vital_signs ? JSON.stringify(vital_signs) : null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update EMR' });
  }
});

// DELETE /api/emr/:id — admin only
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(`DELETE FROM emr_records WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'EMR not found' });
    res.json({ message: 'EMR deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete EMR' });
  }
});

module.exports = router;
