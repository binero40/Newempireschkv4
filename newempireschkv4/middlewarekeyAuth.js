const db = require('../database');
const { v4: uuidv4 } = require('uuid');

function keyAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key || (req.body && req.body.key);
  
  if (!key) {
    return res.status(401).json({ error: 'API key required. Pass via X-API-Key header or ?key= param' });
  }

  const row = db.prepare('SELECT * FROM keys WHERE key = ? AND is_active = 1').get(key);
  
  if (!row) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const now = new Date().toISOString();
  if (row.valid_until < now) {
    return res.status(401).json({ error: 'Key expired on ' + row.valid_until });
  }

  if (row.checks_used >= row.max_checks) {
    return res.status(403).json({ error: 'Key limit reached' });
  }

  req.apiKey = row;
  next();
}

function trackCheck(req, res, next) {
  if (req.apiKey) {
    db.prepare('UPDATE keys SET checks_used = checks_used + 1 WHERE id = ?').run(req.apiKey.id);
  }
  next();
}

module.exports = { keyAuth, trackCheck };