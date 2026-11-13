const express = require('express');
const router = express.Router();
const { keyAuth, trackCheck } = require('../middleware/keyAuth');
const { batchCheck } = require('../utils/amazonCheck');
const { lookupBIN } = require('../utils/binLookup');
const db = require('../database');

/**
 * POST /api/checker
 * Body: {
 *   cards: ["4532015112345678|12/26|123", ...],  // up to 10
 *   cookie: "session-id=...; session-token=...",
 *   country: "US" | "MX" | "IT" | "FR" | "SG",
 *   amazonType: "normal" | "amazonpay"
 * }
 */
router.post('/', keyAuth, trackCheck, async (req, res) => {
  const { cards, cookie, country, amazonType } = req.body;

  if (!cards || !Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: 'cards[] required' });
  }
  if (!cookie) return res.status(400).json({ error: 'cookie required' });
  if (!country || !['US','MX','IT','FR','SG'].includes(country)) {
    return res.status(400).json({ error: 'country must be US, MX, IT, FR, or SG' });
  }

  const MAX = parseInt(process.env.MAX_CARDS_PER_COOKIE) || 10;
  if (cards.length > MAX) {
    return res.status(400).json({ error: `Max ${MAX} cards per cookie` });
  }

  // Parse cards
  const parsed = cards.map(c => {
    const parts = c.split('|');
    return {
      number: parts[0].trim(),
      expiry: parts[1] ? parts[1].trim() : '',
      cvv: parts[2] ? parts[2].trim() : ''
    };
  });

  try {
    const results = await batchCheck(parsed, cookie, country, amazonType || 'normal');

    // Save to DB
    const insert = db.prepare(`
      INSERT INTO results (card_number, expiry, cvv, status, bin_info, country, amazon_type, cookie_country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      results.forEach(r => {
        insert.run(
          r.card, r.expiry, r.cvv, r.status,
          JSON.stringify(r.binInfo), country, amazonType || 'normal', country
        );
      });
    });
    tx();

    res.json({
      success: true,
      checked: results.length,
      results
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/checker/results?status=LIVE&country=US&limit=50
 */
router.get('/results', keyAuth, (req, res) => {
  const { status, country, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM results';
  const conds = [];
  const params = [];

  if (status) { conds.push('status = ?'); params.push(status); }
  if (country) { conds.push('country = ?'); params.push(country); }
  if (conds.length) query += ' WHERE ' + conds.join(' AND ');
  query += ' ORDER BY checked_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = db.prepare(query).all(...params);
  res.json({ count: rows.length, results: rows });
});

/**
 * GET /api/checker/download?status=LIVE&format=txt
 */
router.get('/download', keyAuth, (req, res) => {
  const { status = 'LIVE', country } = req.query;
  
  let query = 'SELECT * FROM results WHERE status = ?';
  const params = [status];
  if (country) { query += ' AND country = ?'; params.push(country); }
  query += ' ORDER BY checked_at DESC';

  const rows = db.prepare(query).all(...params);
  
  let txt = '';
  rows.forEach(r => {
    const bin = JSON.parse(r.bin_info || '{}');
    txt += `${r.card_number}|${r.expiry}|${r.cvv}  [${r.status}] BIN:${bin.bin} Brand:${bin.brand} Country:${bin.country}\n`;
  });

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="empires_${status}_cards.txt"`);
  res.send(txt);
});

module.exports = router;