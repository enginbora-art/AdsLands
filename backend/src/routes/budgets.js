const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/budgets?month=4&year=2026
router.get('/', authMiddleware, async (req, res) => {
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);

  if (!month || !year) {
    return res.status(400).json({ error: 'month ve year zorunludur.' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3`,
      [req.user.id, month, year]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/budgets
router.post('/', authMiddleware, async (req, res) => {
  const { month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget } = req.body;

  if (!month || !year || total_budget === undefined) {
    return res.status(400).json({ error: 'month, year ve total_budget zorunludur.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO budgets (user_id, month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, month, year) DO UPDATE SET
         total_budget       = EXCLUDED.total_budget,
         google_ads_budget  = EXCLUDED.google_ads_budget,
         meta_ads_budget    = EXCLUDED.meta_ads_budget,
         tiktok_ads_budget  = EXCLUDED.tiktok_ads_budget,
         updated_at         = NOW()
       RETURNING *`,
      [
        req.user.id, month, year,
        total_budget,
        google_ads_budget || 0,
        meta_ads_budget || 0,
        tiktok_ads_budget || 0,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
