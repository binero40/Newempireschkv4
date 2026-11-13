utils/keyGen.js
const crypto = require('crypto');

function generateKey(days, maxChecks = 1000) {
  const now = new Date();
  const expiry = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  const random = crypto.randomBytes(16).toString('hex').toUpperCase();
  const key = `NEA-${random.slice(0, 4)}-${random.slice(4, 8)}-${random.slice(8, 12)}-${random.slice(12, 16)}`;

  return {
    key,
    valid_until: expiry.toISOString(),
    max_checks: maxChecks,
    checks_used: 0,
  };
}

function validateKeyFormat(key) {
  return /^NEA-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
}

module.exports = { generateKey, validateKeyFormat };