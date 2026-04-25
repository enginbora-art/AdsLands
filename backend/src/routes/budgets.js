const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

async function verifyAgencyBrand(agencyCompanyId, brandCompanyId) {
  const { rows } = await pool.query(
    'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
    [agencyCompanyId, brandCompanyId]
  );
  return rows.length > 0;
}

// GET /api/budgets/brands — ajansın bağlı marka şirketlerini listele
router.get('/brands', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar erişebilir.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name
       FROM connections conn
       JOIN companies c ON c.id = conn.brand_company_id
       WHERE conn.agency_company_id = $1
       ORDER BY c.name`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets/logs
router.get('/logs', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    let query, params;
    if (req.user.company_type === 'brand') {
      query = `
        SELECT bl.*, b.month, b.year, c.name AS brand_name
        FROM budget_logs bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN companies c ON c.id = b.company_id
        WHERE b.company_id = $1
        ORDER BY bl.created_at DESC LIMIT $2`;
      params = [req.user.company_id, limit];
    } else {
      query = `
        SELECT bl.*, b.month, b.year, c.name AS brand_name
        FROM budget_logs bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN companies c ON c.id = b.company_id
        WHERE b.company_id IN (
          SELECT brand_company_id FROM connections WHERE agency_company_id = $1
        ) OR bl.company_id = $1
        ORDER BY bl.created_at DESC LIMIT $2`;
      params = [req.user.company_id, limit];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets?month=4&year=2026[&brand_id=uuid]
router.get('/', authMiddleware, async (req, res) => {
  const month = parseInt(req.query.month);
  const year  = parseInt(req.query.year);
  if (!month || !year) return res.status(400).json({ error: 'month ve year zorunludur.' });

  let targetCompanyId = req.user.company_id;

  if (req.user.company_type === 'agency' && req.query.brand_id) {
    if (!(await verifyAgencyBrand(req.user.company_id, req.query.brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetCompanyId = req.query.brand_id;
  }

  try {
    const { rows: [budget] } = await pool.query(
      'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
      [targetCompanyId, month, year]
    );
    res.json(budget || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/budgets
router.post('/', authMiddleware, async (req, res) => {
  const { month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, brand_id } = req.body;
  if (!month || !year || total_budget === undefined) {
    return res.status(400).json({ error: 'month, year ve total_budget zorunludur.' });
  }

  let targetCompanyId = req.user.company_id;

  if (req.user.company_type === 'agency') {
    if (!brand_id) return res.status(400).json({ error: 'Ajans hesabı için brand_id zorunludur.' });
    if (!(await verifyAgencyBrand(req.user.company_id, brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetCompanyId = brand_id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existing] } = await client.query(
      'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
      [targetCompanyId, month, year]
    );

    const { rows: [newBudget] } = await client.query(
      `INSERT INTO budgets (company_id, month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (company_id, month, year) DO UPDATE SET
         total_budget      = EXCLUDED.total_budget,
         google_ads_budget = EXCLUDED.google_ads_budget,
         meta_ads_budget   = EXCLUDED.meta_ads_budget,
         tiktok_ads_budget = EXCLUDED.tiktok_ads_budget,
         updated_at        = NOW()
       RETURNING *`,
      [targetCompanyId, month, year, total_budget,
       google_ads_budget || 0, meta_ads_budget || 0, tiktok_ads_budget || 0]
    );

    const toNum = (v) => parseFloat(v) || 0;
    const oldValue = existing ? {
      total_budget: toNum(existing.total_budget),
      google_ads_budget: toNum(existing.google_ads_budget),
      meta_ads_budget: toNum(existing.meta_ads_budget),
      tiktok_ads_budget: toNum(existing.tiktok_ads_budget),
    } : null;
    const newValue = {
      total_budget: toNum(newBudget.total_budget),
      google_ads_budget: toNum(newBudget.google_ads_budget),
      meta_ads_budget: toNum(newBudget.meta_ads_budget),
      tiktok_ads_budget: toNum(newBudget.tiktok_ads_budget),
    };

    await client.query(
      `INSERT INTO budget_logs (budget_id, user_id, company_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newBudget.id, req.user.user_id, req.user.company_id,
       existing ? 'updated' : 'created',
       oldValue ? JSON.stringify(oldValue) : null,
       JSON.stringify(newValue)]
    );

    await client.query('COMMIT');
    res.json(newBudget);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});

module.exports = router;
