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
      `SELECT c.id, c.name AS company_name
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
    const baseSelect = `
      SELECT bl.*,
             b.month, b.year,
             brand_c.name AS brand_name,
             actor_c.name AS actor_company_name,
             COALESCE(u.full_name, u.email) AS user_name
      FROM budget_logs bl
      JOIN budgets b ON b.id = bl.budget_id
      JOIN companies brand_c ON brand_c.id = b.company_id
      JOIN companies actor_c ON actor_c.id = bl.company_id
      JOIN users u ON u.id = bl.user_id`;

    if (req.user.company_type === 'brand') {
      query = `${baseSelect}
        WHERE b.company_id = $1
        ORDER BY bl.created_at DESC LIMIT $2`;
      params = [req.user.company_id, limit];
    } else {
      query = `${baseSelect}
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
    if (!budget) return res.json(null);

    const { rows: channels } = await pool.query(
      'SELECT platform, amount::float AS amount FROM budget_channels WHERE budget_id = $1 ORDER BY created_at',
      [budget.id]
    );
    res.json({ ...budget, channels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/budgets
router.post('/', authMiddleware, async (req, res) => {
  const { month, year, total_budget, channels, brand_id } = req.body;
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

  // Derive legacy column values from channels for backward compat (dashboard warning reads these)
  const toNum = (v) => parseFloat(v) || 0;
  const safeChannels = (channels || []).filter(ch => ch.platform && toNum(ch.amount) > 0);
  const googleBudget = toNum(safeChannels.find(c => c.platform === 'google_ads')?.amount);
  const metaBudget   = toNum(safeChannels.find(c => c.platform === 'meta')?.amount);
  const tiktokBudget = toNum(safeChannels.find(c => c.platform === 'tiktok')?.amount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing budget + channels (for log old_value)
    const { rows: [existing] } = await client.query(
      'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
      [targetCompanyId, month, year]
    );
    let existingChannels = [];
    if (existing) {
      const { rows } = await client.query(
        'SELECT platform, amount::float AS amount FROM budget_channels WHERE budget_id = $1',
        [existing.id]
      );
      existingChannels = rows;
    }

    // Upsert budget (keep legacy columns in sync)
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
      [targetCompanyId, month, year, total_budget, googleBudget, metaBudget, tiktokBudget]
    );

    // Replace budget_channels
    await client.query('DELETE FROM budget_channels WHERE budget_id = $1', [newBudget.id]);
    for (const ch of safeChannels) {
      await client.query(
        'INSERT INTO budget_channels (budget_id, platform, amount) VALUES ($1, $2, $3)',
        [newBudget.id, ch.platform, toNum(ch.amount)]
      );
    }

    // Fetch saved channels to return
    const { rows: savedChannels } = await client.query(
      'SELECT platform, amount::float AS amount FROM budget_channels WHERE budget_id = $1 ORDER BY created_at',
      [newBudget.id]
    );

    // Budget log
    const oldValue = existing ? {
      total_budget: toNum(existing.total_budget),
      channels: existingChannels.map(c => ({ platform: c.platform, amount: toNum(c.amount) })),
    } : null;
    const newValue = {
      total_budget: toNum(newBudget.total_budget),
      channels: savedChannels.map(c => ({ platform: c.platform, amount: toNum(c.amount) })),
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
    res.json({ ...newBudget, channels: savedChannels });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});

module.exports = router;
