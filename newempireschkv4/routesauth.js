const express = require('express');
const router = express.Router();
const db = require('../database');
const { keyAuth } = require('../middleware/keyAuth');

// Validate a key (public endpoint for clients to test)
router.get('/validate', (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ error: 'Missing key param' });

  const row = db.prepare('SELECT key, valid_until, max_checks, checks_used, is_active FROM keys WHERE key = ?').get(key);
  
  if (!row) return res.json({ valid: false, reason: 'Key not found' });
  if (!row.is_active) return res.json({ valid: false, reason: 'Key deactivated' });
  if (new Date(row.valid_until) < new Date()) return res.json({ valid: false, reason: 'Key expired' });
  if (row.checks_used >= row.max_checks) return res.json({ valid: false, reason: 'Limit reached' });

  res.json({
    valid: true,
    expires: row.valid_until,
    remaining: row.max_checks - row.checks_used,
    label: row.label
  });
});

module.exports = router;