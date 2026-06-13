const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All revenue analytics routes require admin role
router.use(authenticate, requireRole('admin'));

// GET /api/revenue — list pre-aggregated revenue analytics
router.get('/', async (req, res) => {
  try {
    const { period_type, department_id } = req.query;
    let sql = `SELECT ra.*, dep.name as department_name
               FROM revenue_analytics ra
               LEFT JOIN departments dep ON ra.department_id = dep.id
               WHERE 1=1`;
    const params = [];
    if (period_type) { params.push(period_type); sql += ` AND ra.period_type=$${params.length}`; }
    if (department_id) { params.push(department_id); sql += ` AND ra.department_id=$${params.length}`; }
    sql += ` ORDER BY ra.period_start DESC LIMIT 100`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// GET /api/revenue/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT ra.*, dep.name as department_name FROM revenue_analytics ra
       LEFT JOIN departments dep ON ra.department_id = dep.id WHERE ra.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Revenue record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue record' });
  }
});

// POST /api/revenue — create pre-aggregated record
router.post('/', async (req, res) => {
  try {
    const { period_type, period_start, period_end, department_id, total_revenue, total_appointments, total_patients } = req.body;
    if (!period_type || !period_start || !period_end) {
      return res.status(400).json({ error: 'period_type, period_start and period_end are required' });
    }
    const result = await query(
      `INSERT INTO revenue_analytics (period_type, period_start, period_end, department_id, total_revenue, total_appointments, total_patients)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (period_type, period_start, department_id) DO UPDATE SET
         total_revenue=EXCLUDED.total_revenue,
         total_appointments=EXCLUDED.total_appointments,
         total_patients=EXCLUDED.total_patients
       RETURNING *`,
      [period_type, period_start, period_end, department_id || null,
       total_revenue || 0, total_appointments || 0, total_patients || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create revenue record' });
  }
});

// PUT /api/revenue/:id
router.put('/:id', async (req, res) => {
  try {
    const { total_revenue, total_appointments, total_patients } = req.body;
    const result = await query(
      `UPDATE revenue_analytics SET
         total_revenue=COALESCE($1,total_revenue),
         total_appointments=COALESCE($2,total_appointments),
         total_patients=COALESCE($3,total_patients)
       WHERE id=$4 RETURNING *`,
      [total_revenue??null, total_appointments??null, total_patients??null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Revenue record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update revenue record' });
  }
});

// DELETE /api/revenue/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await query(`DELETE FROM revenue_analytics WHERE id=$1 RETURNING id`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Revenue record not found' });
    res.json({ message: 'Revenue record deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete revenue record' });
  }
});

module.exports = router;
