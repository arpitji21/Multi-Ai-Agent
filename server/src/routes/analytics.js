const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/overview — admin dashboard stats
router.get('/overview', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const [patients, doctors, todayAppts, monthlyRevenue, activeDoctors, reports] = await Promise.all([
      query(`SELECT COUNT(*) FROM patients`),
      query(`SELECT COUNT(*) FROM doctors`),
      query(`SELECT COUNT(*) FROM appointments WHERE appointment_date=CURRENT_DATE`),
      query(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE DATE_TRUNC('month', created_at)=DATE_TRUNC('month', NOW()) AND status='completed'`),
      query(`SELECT COUNT(*) FROM doctors WHERE available=true`),
      query(`SELECT COUNT(*) FROM reports WHERE DATE(created_at)=CURRENT_DATE`),
    ]);

    // Monthly revenue for last 12 months
    const revenueHistory = await query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month,
              DATE_TRUNC('month', created_at) as month_date,
              COALESCE(SUM(amount),0) as revenue,
              COUNT(*) as appointments
       FROM payments
       WHERE created_at >= NOW() - INTERVAL '12 months' AND status='completed'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month_date`
    );

    // Department performance
    const deptPerf = await query(
      `SELECT dep.name, COUNT(a.id) as appointments,
              COALESCE(SUM(p.amount),0) as revenue
       FROM departments dep
       LEFT JOIN doctors d ON d.department_id = dep.id
       LEFT JOIN appointments a ON a.doctor_id = d.id AND a.status='completed'
       LEFT JOIN payments p ON p.appointment_id = a.id AND p.status='completed'
       GROUP BY dep.id, dep.name ORDER BY revenue DESC`
    );

    res.json({
      stats: {
        total_patients: parseInt(patients.rows[0].count),
        total_doctors: parseInt(doctors.rows[0].count),
        today_appointments: parseInt(todayAppts.rows[0].count),
        monthly_revenue: parseFloat(monthlyRevenue.rows[0].total),
        active_doctors: parseInt(activeDoctors.rows[0].count),
        today_reports: parseInt(reports.rows[0].count),
      },
      revenue_history: revenueHistory.rows,
      department_performance: deptPerf.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/analytics/revenue — detailed revenue
router.get('/revenue', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as period,
              DATE_TRUNC('month', created_at) as month_date,
              SUM(amount) as revenue, COUNT(*) as transactions
       FROM payments WHERE status='completed'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month_date DESC LIMIT 12`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// GET /api/analytics/doctor-utilization — admin
router.get('/doctor-utilization', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.name, d.specialization, dep.name as department,
              COUNT(a.id) as total_appointments,
              COUNT(CASE WHEN a.status='completed' THEN 1 END) as completed,
              COUNT(CASE WHEN a.status='cancelled' THEN 1 END) as cancelled,
              COALESCE(SUM(p.amount),0) as revenue
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN departments dep ON d.department_id = dep.id
       LEFT JOIN appointments a ON a.doctor_id = d.id
       LEFT JOIN payments p ON p.appointment_id = a.id AND p.status='completed'
       GROUP BY d.id, u.name, d.specialization, dep.name
       ORDER BY total_appointments DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch doctor utilization' });
  }
});

// GET /api/analytics/appointment-trends
router.get('/appointment-trends', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT TO_CHAR(DATE_TRUNC('week', appointment_date), 'Mon DD') as week,
              COUNT(*) as total,
              COUNT(CASE WHEN status='completed' THEN 1 END) as completed,
              COUNT(CASE WHEN status='cancelled' THEN 1 END) as cancelled
       FROM appointments
       WHERE appointment_date >= NOW() - INTERVAL '3 months'
       GROUP BY DATE_TRUNC('week', appointment_date)
       ORDER BY DATE_TRUNC('week', appointment_date)`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment trends' });
  }
});

// GET /api/analytics/patient-stats/:patient_id — for patient health trends
router.get('/patient-stats/:patient_id', authenticate, async (req, res) => {
  try {
    const [reports, appointments, analyses] = await Promise.all([
      query(`SELECT COUNT(*) FROM reports WHERE patient_id=$1`, [req.params.patient_id]),
      query(`SELECT COUNT(*) FROM appointments WHERE patient_id=$1`, [req.params.patient_id]),
      query(
        `SELECT aa.created_at, aa.key_findings
         FROM ai_analyses aa
         JOIN reports r ON aa.report_id = r.id
         WHERE r.patient_id=$1 ORDER BY aa.created_at DESC LIMIT 5`,
        [req.params.patient_id]
      ),
    ]);
    res.json({
      total_reports: parseInt(reports.rows[0].count),
      total_appointments: parseInt(appointments.rows[0].count),
      recent_analyses: analyses.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient stats' });
  }
});

module.exports = router;
