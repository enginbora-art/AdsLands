const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/dashboard/brand
router.get('/brand', authMiddleware, async (req, res) => {
  if (req.user.role !== 'brand') return res.status(403).json({ error: 'Sadece marka hesapları erişebilir.' });
  try {
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
       WHERE i.user_id = $1 AND i.is_active = true
       GROUP BY i.id`,
      [req.user.id]
    );
    const anomalies = await pool.query(
      `SELECT a.*, i.platform FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE i.user_id = $1 ORDER BY a.detected_at DESC LIMIT 10`,
      [req.user.id]
    );
    const todayResult = await pool.query(
      `SELECT COALESCE(SUM(m.spend), 0) AS today_spend
       FROM ad_metrics m JOIN integrations i ON i.id = m.integration_id
       WHERE i.user_id = $1 AND m.date = CURRENT_DATE AND i.is_active = true`,
      [req.user.id]
    );
    const now = new Date();
    const budgetResult = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [req.user.id, now.getMonth() + 1, now.getFullYear()]
    );

    const summary = integrations.rows.reduce((acc, i) => ({
      total_spend: acc.total_spend + parseFloat(i.total_spend),
      total_conversions: acc.total_conversions + parseInt(i.total_conversions),
      total_clicks: acc.total_clicks + parseInt(i.total_clicks),
    }), { total_spend: 0, avg_roas: 0, total_conversions: 0, total_clicks: 0 });

    const roasValues = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
    summary.avg_roas = roasValues.length
      ? roasValues.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasValues.length : 0;

    res.json({
      integrations: integrations.rows,
      anomalies: anomalies.rows,
      today_spend: parseFloat(todayResult.rows[0].today_spend),
      budget: budgetResult.rows[0] || null,
      summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/agency/brand/:brandId — belirli bir markanın detay verisi
router.get('/agency/brand/:brandId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'agency') return res.status(403).json({ error: 'Sadece ajans hesapları erişebilir.' });

  const { brandId } = req.params;
  const conn = await pool.query(
    'SELECT id FROM connections WHERE agency_id = $1 AND brand_id = $2',
    [req.user.id, brandId]
  );
  if (!conn.rows.length) return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });

  try {
    const brandResult = await pool.query(
      'SELECT id, company_name, email FROM users WHERE id = $1', [brandId]
    );
    const brand = brandResult.rows[0];

    const integrations = await pool.query(
      `SELECT i.id, i.platform, i.account_id, i.is_active,
         COALESCE(SUM(m.spend), 0) AS total_spend,
         COALESCE(AVG(NULLIF(m.roas, 0)), 0) AS avg_roas,
         COALESCE(SUM(m.conversions), 0) AS total_conversions,
         COALESCE(SUM(m.clicks), 0) AS total_clicks
       FROM integrations i
       LEFT JOIN ad_metrics m ON m.integration_id = i.id
         AND m.date >= CURRENT_DATE - INTERVAL '30 days'
       WHERE i.user_id = $1 AND i.is_active = true
       GROUP BY i.id`,
      [brandId]
    );
    const anomalies = await pool.query(
      `SELECT a.*, i.platform FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE i.user_id = $1 ORDER BY a.detected_at DESC LIMIT 20`,
      [brandId]
    );
    const todayResult = await pool.query(
      `SELECT COALESCE(SUM(m.spend), 0) AS today_spend
       FROM ad_metrics m JOIN integrations i ON i.id = m.integration_id
       WHERE i.user_id = $1 AND m.date = CURRENT_DATE AND i.is_active = true`,
      [brandId]
    );
    const now = new Date();
    const budgetResult = await pool.query(
      'SELECT * FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
      [brandId, now.getMonth() + 1, now.getFullYear()]
    );

    const summary = integrations.rows.reduce((acc, i) => ({
      total_spend: acc.total_spend + parseFloat(i.total_spend),
      total_conversions: acc.total_conversions + parseInt(i.total_conversions),
      total_clicks: acc.total_clicks + parseInt(i.total_clicks),
    }), { total_spend: 0, avg_roas: 0, total_conversions: 0, total_clicks: 0 });

    const roasValues = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
    summary.avg_roas = roasValues.length
      ? roasValues.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasValues.length : 0;

    res.json({
      brand,
      integrations: integrations.rows,
      anomalies: anomalies.rows,
      today_spend: parseFloat(todayResult.rows[0].today_spend),
      budget: budgetResult.rows[0] || null,
      summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/agency
router.get('/agency', authMiddleware, async (req, res) => {
  if (req.user.role !== 'agency') return res.status(403).json({ error: 'Sadece ajans hesapları erişebilir.' });

  try {
    const clients = await pool.query(
      `SELECT u.id, u.company_name, u.email
       FROM users u JOIN connections c ON c.brand_id = u.id
       WHERE c.agency_id = $1`,
      [req.user.id]
    );

    const now = new Date();

    const clientsWithData = await Promise.all(clients.rows.map(async (brand) => {
      const integrations = await pool.query(
        `SELECT i.id, i.platform, i.account_id,
           COALESCE(SUM(m.spend), 0) AS total_spend,
           COALESCE(AVG(NULLIF(m.roas, 0)), 0) AS avg_roas,
           COALESCE(SUM(m.conversions), 0) AS total_conversions,
           COALESCE(SUM(m.clicks), 0) AS total_clicks
         FROM integrations i
         LEFT JOIN ad_metrics m ON m.integration_id = i.id
           AND m.date >= CURRENT_DATE - INTERVAL '30 days'
         WHERE i.user_id = $1 AND i.is_active = true
         GROUP BY i.id`,
        [brand.id]
      );
      const anomalies = await pool.query(
        `SELECT a.metric, a.actual_value, a.expected_value, a.detected_at, i.platform
         FROM anomalies a JOIN integrations i ON a.integration_id = i.id
         WHERE i.user_id = $1 AND a.notified_at IS NOT NULL
         ORDER BY a.detected_at DESC LIMIT 5`,
        [brand.id]
      );
      const todayResult = await pool.query(
        `SELECT COALESCE(SUM(m.spend), 0) AS today_spend
         FROM ad_metrics m JOIN integrations i ON i.id = m.integration_id
         WHERE i.user_id = $1 AND m.date = CURRENT_DATE AND i.is_active = true`,
        [brand.id]
      );
      const budgetResult = await pool.query(
        'SELECT total_budget FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3',
        [brand.id, now.getMonth() + 1, now.getFullYear()]
      );

      const totalSpend = integrations.rows.reduce((s, i) => s + parseFloat(i.total_spend), 0);
      const roasValues = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
      const avg_roas = roasValues.length
        ? roasValues.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasValues.length : 0;

      return {
        brand,
        integrations: integrations.rows,
        anomalies: anomalies.rows,
        today_spend: parseFloat(todayResult.rows[0].today_spend),
        monthly_budget: parseFloat(budgetResult.rows[0]?.total_budget || 0),
        summary: { total_spend: totalSpend, avg_roas },
      };
    }));

    const summary = {
      total_clients: clientsWithData.length,
      total_managed_budget: clientsWithData.reduce((s, c) => s + c.monthly_budget, 0),
      total_today_spend: clientsWithData.reduce((s, c) => s + c.today_spend, 0),
      total_anomalies: clientsWithData.reduce((s, c) => s + c.anomalies.length, 0),
    };

    res.json({ clients: clientsWithData, summary, total_anomalies: summary.total_anomalies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/anomalies
router.get('/anomalies', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, i.platform FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE i.user_id = $1 ORDER BY a.detected_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
