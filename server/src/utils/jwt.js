const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mediai_dev_secret_change_in_prod';
const JWT_EXPIRES_IN = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
