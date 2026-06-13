const { query } = require('../db');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Audit log middleware — attaches a 'finish' listener so the log fires
// AFTER route handlers have set req.user via authenticate().
function auditLog(req, res, next) {
  res.on('finish', () => {
    if (!req.user || !WRITE_METHODS.has(req.method)) return;
    // Skip auth routes — they write their own audit entries for LOGIN/LOGOUT
    if (req.path.startsWith('/auth/')) return;
    // Only log successful write operations (2xx)
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const parts = req.path.replace(/^\//, '').split('/');
    const resourceType = parts[0] || 'unknown';
    const resourceId = parts[1] && !isNaN(parts[1]) ? parseInt(parts[1]) : null;
    const action = req.method === 'POST' ? 'CREATE'
      : req.method === 'PUT' || req.method === 'PATCH' ? 'UPDATE'
      : req.method === 'DELETE' ? 'DELETE'
      : req.method;

    query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, action, resourceType, resourceId, req.ip]
    ).catch((err) => console.error('[audit] Failed to write audit log:', err.message));
  });
  next();
}

module.exports = { auditLog };
