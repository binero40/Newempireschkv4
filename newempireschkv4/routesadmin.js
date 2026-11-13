const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateKey } = require('../utils/keyGen');
const crypto = require('crypto');

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.query.secret;
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid admin secret' });
  }
  next();
}

// All admin routes require auth
router.use(adminAuth);

/**
 * POST /api/admin/keys - Generate a new key
 * Body: { days: 30, maxChecks: 5000, label: "Client Name" }
 */
router.post('/keys', (req, res) => {
  const { days = 1, maxChecks = 1000, label = '' } = req.body;
  const keyData = generateKey(days, maxChecks);

  const stmt = db.prepare(`
    INSERT INTO keys (key, label, valid_until, max_checks, checks_used, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(keyData.key, label, keyData.valid_until, keyData.max_checks, 0);

  res.json({
    id: result.lastInsertRowid,
    key: keyData.key,
    label,
    days,
    maxChecks,
    expires: keyData.valid_until,
    status: 'active'
  });
});

/**
 * GET /api/admin/keys - List all keys
 */
router.get('/keys', (req, res) => {
  const rows = db.prepare('SELECT * FROM keys ORDER BY created_at DESC').all();
  res.json({ count: rows.length, keys: rows });
});

/**
 * DELETE /api/admin/keys/:id - Revoke a key
 */
router.delete('/keys/:id', (req, res) => {
  db.prepare('UPDATE keys SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ status: 'revoked' });
});

/**
 * POST /api/admin/keys/:id/extend - Extend key by N days
 * Body: { days: 7 }
 */
router.post('/keys/:id/extend', (req, res) => {
  const { days = 7 } = req.body;
  const row = db.prepare('SELECT valid_until FROM keys WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Key not found' });

  const newDate = new Date(new Date(row.valid_until).getTime() + days * 86400000).toISOString();
  db.prepare('UPDATE keys SET valid_until = ? WHERE id = ?').run(newDate, req.params.id);

  res.json({ new_expiry: newDate });
});

/**
 * GET /api/admin/stats - Dashboard stats
 */
router.get('/stats', (req, res) => {
  const totalKeys = db.prepare('SELECT COUNT(*) as c FROM keys WHERE is_active = 1').get().c;
  const totalChecks = db.prepare('SELECT COALESCE(SUM(checks_used),0) as c FROM keys').get().c;
  const totalLives = db.prepare('SELECT COUNT(*) as c FROM results WHERE status = ?').get('LIVE').c;
  const totalDeads = db.prepare('SELECT COUNT(*) as c FROM results WHERE status = ?').get('DEAD').c;
  const totalCookies = db.prepare('SELECT COUNT(*) as c FROM cookies').get().c;

  res.json({
    active_keys: totalKeys,
    total_checks: totalChecks,
    lives: totalLives,
    deads: totalDeads,
    cookies: totalCookies,
    uptime: Math.floor(process.uptime()) + 's'
  });
});

module.exports = router;