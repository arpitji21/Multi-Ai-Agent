const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  console.warn('[WARN] JWT_SECRET not set — using insecure dev default. Set JWT_SECRET in production.');
}

const ACCESS_SECRET = JWT_SECRET || 'mediai_dev_secret_change_in_prod_DO_NOT_USE';
const REFRESH_SECRET = JWT_REFRESH_SECRET || 'mediai_refresh_dev_secret_DO_NOT_USE';

function signToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(payload) {
  return jwt.sign({ id: payload.id, role: payload.role }, REFRESH_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

module.exports = { signToken, signRefreshToken, verifyToken, verifyRefreshToken };
