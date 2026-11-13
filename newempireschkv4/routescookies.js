const express = require('express');
const router = express.Router();
const db = require('../database');
const { keyAuth } = require('../middleware/keyAuth');

/**
 * POST /api/cookies - Import a cookie
 * Body: { country: "US", data: "session-id=...; ..." }
 */
router.post('/', keyAuth, (req, res) => {
  const { country, data } = req.body;
  if (!country || !data) return res.status(400).json({ error: 'country and data required' });
  if (!['US','MX','IT','FR','SG'].includes(country)) {
    return res.status(400).json({ error: 'Invalid country' });
  }

  const stmt = db.prepare('INSERT INTO cookies (country, data) VALUES (?, ?)');
  const result = stmt.run(country, data);
  
  res.json({ id: result.lastInsertRowid, country, status: 'imported' });
});

/**
 * GET /api/cookies - List all imported cookies
 */
router.get('/', keyAuth, (req, res) => {
  const { country } = req.query;
  let query = 'SELECT id, country, created_at, is_valid FROM cookies';
  const params = [];
  if (country) { query += ' WHERE country = ?'; params.push(country); }
  const rows = db.prepare(query).all(...params);
  res.json({ count: rows.length, cookies: rows });
});

/**
 * DELETE /api/cookies/:id
 */
router.delete('/:id', keyAuth, (req, res) => {
  db.prepare('DELETE FROM cookies WHERE id = ?').run(req.params.id);
  res.json({ status: 'deleted' });
});

/**
 * GET /api/cookies/generate?country=US
 * Returns a template / guide for generating a valid Amazon cookie
 * (Actual cookie must be obtained by logging in manually or via a session script)
 */
router.get('/generate/:country', keyAuth, (req, res) => {
  const country = req.params.country.toUpperCase();
  if (!['US','MX','IT','FR','SG'].includes(country)) {
    return res.status(400).json({ error: 'Invalid country' });
  }

  const domains = {
    US: 'amazon.com',
    MX: 'amazon.com.mx',
    IT: 'amazon.it',
    FR: 'amazon.fr',
    SG: 'amazon.sg'
  };

  res.json({
    country,
    domain: domains[country],
    instructions: [
      `1. Open https://www.${domains[country]}`,
      '2. Log in with your Amazon account',
      '3. Open DevTools (F12) > Network tab',
      '4. Make any request (e.g. view cart)',
      '5. Copy the full "Cookie" header value from the request',
      '6. Paste it via POST /api/cookies with the country code'
    ],
    requiredCookies: [
      'session-id',
      'session-token',
      'session-id-time',
      'ubid-main'
    ],
    example: `session-id=134-XXXXXXX-XXXXXXX; session-token=XXXXXX...; ubid-main=...`
  });
});

module.exports = router;