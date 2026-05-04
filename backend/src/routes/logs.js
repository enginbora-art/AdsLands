const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const requireAdmin = (req, res, next) => {
  if (!req.user.is_company_admin && !req.user.is_platform_admin) {
    return res.status(403).json({ error: 'Yönetici yetkisi gerekiyor.' });
  }
  next();
};

// GET /api/logs/users — user filter dropdown
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  const cid = req.user.company_id;
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT u.id, COALESCE(u.full_name, u.email) AS name, c.name AS company_name
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.company_id = $1
        OR u.company_id IN (SELECT brand_company_id FROM connections WHERE agency_company_id = $1)
      ORDER BY name
    `, [cid]);
    res.json(rows);
  } catch (err) {
    console.error('[logs/users]', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/logs
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  const cid     = req.user.company_id;
  const isBrand = req.user.company_type === 'brand';
  const limit   = Math.min(parseInt(req.query.limit) || 20, 100);
  const page    = Math.max(parseInt(req.query.page)  || 1, 1);
  const offset  = (page - 1) * limit;

  const { user_id, module, action_type, start_date, end_date, search } = req.query;

  const budgetFilter = isBrand
    ? 'b.company_id = $1'
    : '(b.company_id IN (SELECT brand_company_id FROM connections WHERE agency_company_id = $1) OR bl.company_id = $1)';

  const campFilter = isBrand
    ? 'cl.brand_company_id = $1'
    : '(cl.brand_company_id IN (SELECT brand_company_id FROM connections WHERE agency_company_id = $1) OR cl.actor_company_id = $1)';

  const params = [cid];
  let p = 2;
  const extra = [];

  if (module && ['budget', 'campaign', 'channel'].includes(module)) {
    extra.push(`module = $${p++}`);
    params.push(module);
  }

  const ACTION_MAP = {
    created: ['created', 'campaign_created'],
    updated: ['updated', 'campaign_updated', 'channel_updated'],
    deleted: ['campaign_deleted'],
    added:   ['channel_added'],
    removed: ['channel_removed'],
  };
  if (action_type && ACTION_MAP[action_type]) {
    const acts = ACTION_MAP[action_type];
    extra.push(`action IN (${acts.map(() => `$${p++}`).join(',')})`);
    acts.forEach(a => params.push(a));
  }

  if (user_id) {
    extra.push(`user_id = $${p++}`);
    params.push(user_id);
  }
  if (start_date) {
    extra.push(`created_at >= $${p++}::date`);
    params.push(start_date);
  }
  if (end_date) {
    extra.push(`created_at < $${p++}::date + interval '1 day'`);
    params.push(end_date);
  }
  if (search && search.trim()) {
    extra.push(`(user_name ILIKE $${p} OR brand_name ILIKE $${p} OR actor_company_name ILIKE $${p} OR COALESCE(campaign_name,'') ILIKE $${p})`);
    params.push(`%${search.trim()}%`);
    p++;
  }

  const whereSQL = extra.length ? `WHERE ${extra.join(' AND ')}` : '';
  const limitP  = p;
  const offsetP = p + 1;
  params.push(limit, offset);

  const query = `
    WITH all_logs AS (
      SELECT bl.id, bl.action, bl.old_value, bl.new_value, bl.created_at,
             b.month, b.year,
             brand_c.name  AS brand_name,
             actor_c.name  AS actor_company_name,
             COALESCE(u.full_name, u.email) AS user_name,
             u.id           AS user_id,
             NULL::varchar  AS campaign_name,
             NULL::varchar  AS platform,
             'budget'::varchar AS log_type,
             'budget'::varchar AS module
      FROM budget_logs bl
      JOIN budgets    b       ON b.id      = bl.budget_id
      JOIN companies  brand_c ON brand_c.id = b.company_id
      JOIN companies  actor_c ON actor_c.id = bl.company_id
      JOIN users      u       ON u.id      = bl.user_id
      WHERE ${budgetFilter}

      UNION ALL

      SELECT cl.id, cl.action, NULL AS old_value, cl.new_value, cl.created_at,
             NULL::int AS month, NULL::int AS year,
             brand_c.name  AS brand_name,
             actor_c.name  AS actor_company_name,
             COALESCE(u.full_name, u.email) AS user_name,
             u.id           AS user_id,
             cl.campaign_name,
             cl.platform,
             'campaign'::varchar AS log_type,
             CASE WHEN cl.action LIKE 'channel_%' THEN 'channel' ELSE 'campaign' END AS module
      FROM campaign_logs cl
      JOIN companies brand_c ON brand_c.id = cl.brand_company_id
      JOIN companies actor_c ON actor_c.id = cl.actor_company_id
      JOIN users     u       ON u.id       = cl.user_id
      WHERE ${campFilter}
    )
    SELECT *, COUNT(*) OVER() AS total_count
    FROM all_logs
    ${whereSQL}
    ORDER BY created_at DESC
    LIMIT $${limitP} OFFSET $${offsetP}
  `;

  try {
    const { rows } = await pool.query(query, params);
    const total = rows[0] ? parseInt(rows[0].total_count) : 0;
    res.json({ logs: rows, total, page, limit });
  } catch (err) {
    console.error('[logs]', err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
