const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

async function getBrandData(companyId) {
  const integrations = await pool.query(
    `SELECT i.id, i.platform, i.account_id, i.is_active,
       COALESCE(SUM(m.spend), 0) AS total_spend,
       COALESCE(AVG(NULLIF(m.roas, 0)), 0) AS avg_roas,
       COALESCE(SUM(m.conversions), 0) AS total_conversions,
       COALESCE(SUM(m.clicks), 0) AS total_clicks,
       COALESCE(SUM(m.impressions), 0) AS total_impressions
     FROM integrations i
     LEFT JOIN ad_metrics m ON m.integration_id = i.id
       AND m.date >= CURRENT_DATE - INTERVAL '30 days'
     WHERE i.company_id = $1 AND i.is_active = true
     GROUP BY i.id`,
    [companyId]
  );

  const anomalies = await pool.query(
    `SELECT a.*, i.platform FROM anomalies a
     JOIN integrations i ON a.integration_id = i.id
     WHERE a.company_id = $1
     ORDER BY a.detected_at DESC LIMIT 20`,
    [companyId]
  );

  const { rows: [todayRow] } = await pool.query(
    `SELECT COALESCE(SUM(m.spend), 0) AS today_spend
     FROM ad_metrics m JOIN integrations i ON i.id = m.integration_id
     WHERE i.company_id = $1 AND m.date = CURRENT_DATE AND i.is_active = true`,
    [companyId]
  );

  const now = new Date();
  const { rows: [budget] } = await pool.query(
    'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
    [companyId, now.getMonth() + 1, now.getFullYear()]
  );

  const summary = integrations.rows.reduce((acc, i) => ({
    total_spend: acc.total_spend + parseFloat(i.total_spend),
    total_conversions: acc.total_conversions + parseInt(i.total_conversions),
    total_clicks: acc.total_clicks + parseInt(i.total_clicks),
  }), { total_spend: 0, avg_roas: 0, total_conversions: 0, total_clicks: 0 });

  const roasVals = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
  summary.avg_roas = roasVals.length
    ? roasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasVals.length
    : 0;

  return {
    integrations: integrations.rows,
    anomalies: anomalies.rows,
    today_spend: parseFloat(todayRow.today_spend),
    budget: budget || null,
    summary,
  };
}

// GET /api/dashboard/brand
router.get('/brand', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'brand') {
    return res.status(403).json({ error: 'Sadece marka hesapları erişebilir.' });
  }
  try {
    res.json(await getBrandData(req.user.company_id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/agency/brand/:brandCompanyId
router.get('/agency/brand/:brandCompanyId', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajans hesapları erişebilir.' });
  }

  const { brandCompanyId } = req.params;
  const { rows: [conn] } = await pool.query(
    'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
    [req.user.company_id, brandCompanyId]
  );
  if (!conn) return res.status(403).json({ error: 'Bu markaya erişim yetkiniz yok.' });

  try {
    const { rows: [brand] } = await pool.query(
      'SELECT id, name FROM companies WHERE id = $1', [brandCompanyId]
    );
    const data = await getBrandData(brandCompanyId);
    res.json({ brand, ...data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/agency
router.get('/agency', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajans hesapları erişebilir.' });
  }

  try {
    const { rows: brands } = await pool.query(
      `SELECT co.id, co.name
       FROM connections c JOIN companies co ON co.id = c.brand_company_id
       WHERE c.agency_company_id = $1`,
      [req.user.company_id]
    );

    const now = new Date();
    const clientsWithData = await Promise.all(brands.map(async (brand) => {
      const integrations = await pool.query(
        `SELECT i.id, i.platform, i.account_id,
           COALESCE(SUM(m.spend), 0) AS total_spend,
           COALESCE(AVG(NULLIF(m.roas, 0)), 0) AS avg_roas
         FROM integrations i
         LEFT JOIN ad_metrics m ON m.integration_id = i.id
           AND m.date >= CURRENT_DATE - INTERVAL '30 days'
         WHERE i.company_id = $1 AND i.is_active = true
         GROUP BY i.id`,
        [brand.id]
      );
      const anomalies = await pool.query(
        `SELECT a.metric, a.actual_value, a.expected_value, a.detected_at, i.platform
         FROM anomalies a JOIN integrations i ON a.integration_id = i.id
         WHERE a.company_id = $1 AND a.status = 'open'
         ORDER BY a.detected_at DESC LIMIT 5`,
        [brand.id]
      );
      const { rows: [todayRow] } = await pool.query(
        `SELECT COALESCE(SUM(m.spend), 0) AS today_spend
         FROM ad_metrics m JOIN integrations i ON i.id = m.integration_id
         WHERE i.company_id = $1 AND m.date = CURRENT_DATE AND i.is_active = true`,
        [brand.id]
      );
      const { rows: [budgetRow] } = await pool.query(
        'SELECT total_budget FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
        [brand.id, now.getMonth() + 1, now.getFullYear()]
      );

      const totalSpend = integrations.rows.reduce((s, i) => s + parseFloat(i.total_spend), 0);
      const roasVals = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
      const avg_roas = roasVals.length
        ? roasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasVals.length
        : 0;

      return {
        brand,
        integrations: integrations.rows,
        anomalies: anomalies.rows,
        today_spend: parseFloat(todayRow.today_spend),
        monthly_budget: parseFloat(budgetRow?.total_budget || 0),
        summary: { total_spend: totalSpend, avg_roas },
      };
    }));

    const summary = {
      total_clients: clientsWithData.length,
      total_managed_budget: clientsWithData.reduce((s, c) => s + c.monthly_budget, 0),
      total_today_spend: clientsWithData.reduce((s, c) => s + c.today_spend, 0),
      total_anomalies: clientsWithData.reduce((s, c) => s + c.anomalies.length, 0),
    };

    res.json({ clients: clientsWithData, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/anomalies
router.get('/anomalies', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, i.platform FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE a.company_id = $1 ORDER BY a.detected_at DESC LIMIT 20`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
