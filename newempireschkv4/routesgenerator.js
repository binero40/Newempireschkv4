const express = require('express');
const router = express.Router();
const db = require('../database');
const { keyAuth } = require('../middleware/keyAuth');

const BIN_PREFIXES = {
  // Visa
  '4532': 'US', '4556': 'US', '4916': 'US', '5424': 'US',
  '4023': 'MX', '4031': 'MX', '4045': 'MX', '4098': 'MX',
  '4550': 'IT', '4580': 'IT', '4970': 'IT', '4974': 'IT',
  '4403': 'FR', '5200': 'FR', '5300': 'FR', '5301': 'FR',
  '4766': 'SG', '5335': 'SG', '5337': 'SG', '5289': 'SG',
};

const BRAND_BINS = {
  Visa: Object.keys(BIN_PREFIXES).filter(b => b.startsWith('4')),
  Mastercard: Object.keys(BIN_PREFIXES).filter(b => b.startsWith('5')),
};

function luhnCheckDigit(partial) {
  const digits = partial.split('').reverse().map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 1) {
      const doubled = d * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += d;
    }
  });
  return (10 - (sum % 10)) % 10;
}

function generateCard(bin, count = 1) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    let body = bin;
    while (body.length < 15) body += Math.floor(Math.random() * 10).toString();
    const checkDigit = luhnCheckDigit(body);
    const number = body + checkDigit;

    // Random valid expiry (future date)
    const now = new Date();
    const year = now.getFullYear() + Math.floor(Math.random() * 3) + 1;
    const month = Math.floor(Math.random() * 12) + 1;
    const expiry = `${String(month).padStart(2,'0')}/${String(year % 100).toString().padStart(2,'0')}`;

    const cvv = String(Math.floor(Math.random() * 900) + 100);

    cards.push({
      number,
      name: `NEA User ${i + 1}`,
      expiry,
      cvv,
      bin,
      country: BIN_PREFIXES[bin] || 'Unknown'
    });
  }
  return cards;
}

/**
 * POST /api/generator
 * Body: { bin: "4532", count: 5, country: "US" (optional override) }
 */
router.post('/', keyAuth, (req, res) => {
  const { bin, count = 1, country } = req.body;

  if (!bin) return res.status(400).json({ error: 'bin required (4-6 digits)' });
  if (!/^\d{4,6}$/.test(bin)) return res.status(400).json({ error: 'bin must be 4-6 digits' });

  const num = Math.min(parseInt(count), 50);
  const cards = generateCard(bin, num);

  // Save
  const insert = db.prepare('INSERT INTO generated_cards (card_number, name, expiry, cvv, bin, country) VALUES (?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    cards.forEach(c => insert.run(c.number, c.name, c.expiry, c.cvv, c.bin, c.country));
  });
  tx();

  res.json({ generated: num, cards });
});

/**
 * GET /api/generator/bins - List available BINs
 */
router.get('/bins', keyAuth, (req, res) => {
  const bins = Object.entries(BIN_PREFIXES).map(([bin, cty]) => ({
    bin,
    brand: bin.startsWith('4') ? 'Visa' : 'Mastercard',
    country: cty
  }));
  res.json({ count: bins.length, bins });
});

/**
 * GET /api/generator/history - Previously generated cards
 */
router.get('/history', keyAuth, (req, res) => {
  const { limit = 50 } = req.query;
  const rows = db.prepare('SELECT * FROM generated_cards ORDER BY created_at DESC LIMIT ?').all(parseInt(limit));
  res.json({ count: rows.length, cards: rows });
});

module.exports = router;