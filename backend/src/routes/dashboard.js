const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/dashboard/brand — marka dashboard verisi
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
      `SELECT a.*, i.platform
       FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE i.user_id = $1
       ORDER BY a.detected_at DESC LIMIT 10`,
      [req.user.id]
    );

    const summary = integrations.rows.reduce((acc, i) => ({
      total_spend: acc.total_spend + parseFloat(i.total_spend),
      avg_roas: 0,
      total_conversions: acc.total_conversions + parseInt(i.total_conversions),
      total_clicks: acc.total_clicks + parseInt(i.total_clicks),
    }), { total_spend: 0, avg_roas: 0, total_conversions: 0, total_clicks: 0 });

    const roasValues = integrations.rows.filter(i => parseFloat(i.avg_roas) > 0);
    summary.avg_roas = roasValues.length
      ? roasValues.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasValues.length
      : 0;

    res.json({
      integrations: integrations.rows,
      anomalies: anomalies.rows,
      summary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/agency — ajans dashboard verisi (müşteri listesi)
router.get('/agency', authMiddleware, async (req, res) => {
  if (req.user.role !== 'agency') return res.status(403).json({ error: 'Sadece ajans hesapları erişebilir.' });

  try {
    const clients = await pool.query(
      `SELECT u.id, u.company_name, u.email
       FROM users u
       JOIN connections c ON c.brand_id = u.id
       WHERE c.agency_id = $1`,
      [req.user.id]
    );

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
         FROM anomalies a
         JOIN integrations i ON a.integration_id = i.id
         WHERE i.user_id = $1 AND a.notified_at IS NOT NULL
         ORDER BY a.detected_at DESC LIMIT 5`,
        [brand.id]
      );

      const totalSpend = integrations.rows.reduce((s, i) => s + parseFloat(i.total_spend), 0);

      return {
        brand,
        integrations: integrations.rows,
        anomalies: anomalies.rows,
        summary: { total_spend: totalSpend },
      };
    }));

    const totalAnomalies = await pool.query(
      `SELECT COUNT(*) FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       JOIN connections c ON c.brand_id = i.user_id
       WHERE c.agency_id = $1`,
      [req.user.id]
    );

    res.json({
      clients: clientsWithData,
      total_anomalies: parseInt(totalAnomalies.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/dashboard/anomalies — kullanıcıya ait tüm anomaliler
router.get('/anomalies', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, i.platform
       FROM anomalies a
       JOIN integrations i ON a.integration_id = i.id
       WHERE i.user_id = $1
       ORDER BY a.detected_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
