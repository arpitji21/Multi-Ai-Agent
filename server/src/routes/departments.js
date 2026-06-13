const express = require('express');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/departments
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, COUNT(doc.id) as doctor_count
       FROM departments d
       LEFT JOIN doctors doc ON doc.department_id = d.id
       GROUP BY d.id ORDER BY d.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM departments WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Department not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// POST /api/departments — admin only
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const result = await query(
      `INSERT INTO departments (name, description, icon) VALUES ($1,$2,$3) RETURNING *`,
      [name, description, icon || 'stethoscope']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// PUT /api/departments/:id — admin only
router.put('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    const result = await query(
      `UPDATE departments SET name=$1, description=$2, icon=$3, updated_at=NOW() WHERE id=$4 RETURNING *`,
      [name, description, icon, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id — admin only
// Unlinks assigned doctors before deleting to avoid FK constraint failure
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await query(`UPDATE doctors SET department_id=NULL WHERE department_id=$1`, [req.params.id]);
    await query(`DELETE FROM departments WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
