const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

function adminBlock(req, res) {
  if (req.user.role === 'admin') {
    res.status(403).json({ error: 'Admin bütçe işlemleri yapamaz.' });
    return true;
  }
  return false;
}

async function verifyAgencyBrand(agencyId, brandId) {
  const r = await pool.query(
    'SELECT id FROM connections WHERE agency_id = $1 AND brand_id = $2',
    [agencyId, brandId]
  );
  return r.rows.length > 0;
}

// GET /api/budgets/brands — ajansın bağlı markalarını listele
router.get('/brands', authMiddleware, async (req, res) => {
  if (req.user.role !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar erişebilir.' });
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.company_name, u.email
       FROM connections c
       JOIN users u ON u.id = c.brand_id
       WHERE c.agency_id = $1
       ORDER BY u.company_name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets/logs?limit=10
router.get('/logs', authMiddleware, async (req, res) => {
  if (adminBlock(req, res)) return;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  try {
    let query, params;
    if (req.user.role === 'brand') {
      query = `
        SELECT bl.*, b.month, b.year, u.company_name AS brand_name
        FROM budget_logs bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN users u ON u.id = b.user_id
        WHERE b.user_id = $1
        ORDER BY bl.changed_at DESC LIMIT $2`;
      params = [req.user.id, limit];
    } else {
      query = `
        SELECT bl.*, b.month, b.year, u.company_name AS brand_name
        FROM budget_logs bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN users u ON u.id = b.user_id
        WHERE b.user_id IN (SELECT brand_id FROM connections WHERE agency_id = $1)
           OR bl.user_id = $1
        ORDER BY bl.changed_at DESC LIMIT $2`;
      params = [req.user.id, limit];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets?month=4&year=2026[&brand_id=uuid]
router.get('/', authMiddleware, async (req, res) => {
  if (adminBlock(req, res)) return;

  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);
  if (!month || !year) return res.status(400).json({ error: 'month ve year zorunludur.' });

  let targetUserId = req.user.id;

  if (req.user.role === 'agency' && req.query.brand_id) {
    if (!(await verifyAgencyBrand(req.user.id, req.query.brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetUserId = req.query.brand_id;
  }

  try {
    const result = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [targetUserId, month, year]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/budgets
router.post('/', authMiddleware, async (req, res) => {
  if (adminBlock(req, res)) return;

  const { month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, brand_id } = req.body;
  if (!month || !year || total_budget === undefined) {
    return res.status(400).json({ error: 'month, year ve total_budget zorunludur.' });
  }

  let targetUserId = req.user.id;

  if (req.user.role === 'agency') {
    if (!brand_id) return res.status(400).json({ error: 'Ajans hesabı için brand_id zorunludur.' });
    if (!(await verifyAgencyBrand(req.user.id, brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetUserId = brand_id;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Mevcut bütçeyi al (log için)
    const existing = await client.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [targetUserId, month, year]
    );
    const oldBudget = existing.rows[0] || null;

    // İşlemi yapan kullanıcının şirket adını al
    const actorRes = await client.query('SELECT company_name FROM users WHERE id = $1', [req.user.id]);
    const actorName = actorRes.rows[0]?.company_name || '';

    // Bütçeyi upsert et
    const result = await client.query(
      `INSERT INTO budgets (user_id, month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, month, year) DO UPDATE SET
         total_budget       = EXCLUDED.total_budget,
         google_ads_budget  = EXCLUDED.google_ads_budget,
         meta_ads_budget    = EXCLUDED.meta_ads_budget,
         tiktok_ads_budget  = EXCLUDED.tiktok_ads_budget,
         updated_at         = NOW()
       RETURNING *`,
      [targetUserId, month, year, total_budget,
       google_ads_budget || 0, meta_ads_budget || 0, tiktok_ads_budget || 0]
    );
    const newBudget = result.rows[0];

    // Log kaydı
    const toNum = (v) => parseFloat(v) || 0;
    const oldValue = oldBudget ? {
      total_budget:       toNum(oldBudget.total_budget),
      google_ads_budget:  toNum(oldBudget.google_ads_budget),
      meta_ads_budget:    toNum(oldBudget.meta_ads_budget),
      tiktok_ads_budget:  toNum(oldBudget.tiktok_ads_budget),
    } : null;
    const newValue = {
      total_budget:       toNum(newBudget.total_budget),
      google_ads_budget:  toNum(newBudget.google_ads_budget),
      meta_ads_budget:    toNum(newBudget.meta_ads_budget),
      tiktok_ads_budget:  toNum(newBudget.tiktok_ads_budget),
    };

    await client.query(
      `INSERT INTO budget_logs (budget_id, user_id, user_type, company_name, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newBudget.id, req.user.id, req.user.role, actorName,
       oldBudget ? 'updated' : 'created',
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
