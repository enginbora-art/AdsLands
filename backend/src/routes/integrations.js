const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { seedHistoricalMetrics } = require('../services/metricsFetcher');
const {
  getAuthUrl,
  getTokens,
  getAnalyticsProperties,
  getAnalyticsData,
  getAdsData,
  listAdsCustomers,
} = require('../services/googleService');

const VALID_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'google_analytics'];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/integrations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.platform, i.account_id, i.is_active, i.created_at,
        COALESCE(SUM(m.spend), 0) AS total_spend,
        COALESCE(AVG(m.roas), 0) AS avg_roas,
        COALESCE(SUM(m.conversions), 0) AS total_conversions,
        COALESCE(SUM(m.clicks), 0) AS total_clicks
       FROM integrations i
       LEFT JOIN ad_metrics m ON m.integration_id = i.id
         AND m.date >= CURRENT_DATE - INTERVAL '30 days'
       WHERE i.company_id = $1 AND i.is_active = true
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

router.get('/google/connect', authMiddleware, (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'platform google_analytics veya google_ads olmalı' });
  }
  const authUrl = getAuthUrl(req.user.company_id, platform);
  res.json({ authUrl });
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/integrations?error=${encodeURIComponent(error)}`);
  }

  let companyId, platform;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    companyId = parsed.userId; // eski alan adı korundu (googleService.js'de)
    platform = parsed.platform;
  } catch {
    return res.redirect(`${FRONTEND_URL}/integrations?error=google`);
  }

  try {
    const tokens = await getTokens(code);
    let accountId = null;
    if (platform === 'google_analytics') {
      const props = await getAnalyticsProperties(tokens).catch(() => []);
      accountId = props[0]?.propertyId || null;
    } else if (platform === 'google_ads') {
      const customers = await listAdsCustomers(tokens).catch(() => []);
      accountId = customers[0] || null;
    }

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations
         (company_id, platform, access_token, refresh_token, account_id, token_expiry, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (company_id, platform) DO UPDATE SET
         access_token  = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
         account_id    = COALESCE(EXCLUDED.account_id, integrations.account_id),
         token_expiry  = EXCLUDED.token_expiry,
         is_active     = true
       RETURNING *`,
      [companyId, platform, tokens.access_token, tokens.refresh_token || null,
       accountId, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
    );

    await seedHistoricalMetrics(integration).catch(console.error);
    res.redirect(`${FRONTEND_URL}/integrations?success=${platform}`);
  } catch (err) {
    console.error('Google OAuth callback hatası:', err);
    res.redirect(`${FRONTEND_URL}/integrations?error=${platform || 'google'}`);
  }
});

router.get('/google/data', authMiddleware, async (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true',
      [req.user.company_id, platform]
    );
    if (!integration) return res.status(404).json({ error: 'Bağlı hesap bulunamadı.' });
    if (!integration.account_id) {
      return res.status(400).json({ error: 'Hesap ID bulunamadı. Lütfen yeniden bağlanın.' });
    }
    const tokens = {
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };
    const data = platform === 'google_analytics'
      ? await getAnalyticsData(tokens, integration.account_id)
      : await getAdsData(tokens, integration.account_id);
    res.json({ platform, account_id: integration.account_id, data });
  } catch (err) {
    console.error('Google data hatası:', err);
    res.status(500).json({ error: err.message || 'Veri çekilemedi.' });
  }
});

router.delete('/google', authMiddleware, async (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    await pool.query(
      'UPDATE integrations SET is_active = false WHERE company_id = $1 AND platform = $2',
      [req.user.company_id, platform]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── Mock OAuth (Meta, TikTok) ─────────────────────────────────────────────────

router.get('/:platform/connect', authMiddleware, async (req, res) => {
  const { platform } = req.params;
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    const accountId = `mock_${platform}_${req.user.company_id.slice(0, 8)}`;
    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, refresh_token, account_id, is_active)
       VALUES ($1, $2, 'mock_token', 'mock_refresh', $3, true)
       ON CONFLICT (company_id, platform) DO UPDATE
         SET is_active = true, access_token = 'mock_token', account_id = EXCLUDED.account_id
       RETURNING *`,
      [req.user.company_id, platform, accountId]
    );
    await seedHistoricalMetrics(integration);
    res.redirect(`${FRONTEND_URL}/integrations?success=${platform}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${FRONTEND_URL}/integrations?error=${platform}`);
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(
      'UPDATE integrations SET is_active = false WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, req.user.company_id]
    );
    if (!row) return res.status(404).json({ error: 'Entegrasyon bulunamadı.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

router.get('/:id/metrics', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT date, spend, impressions, clicks, conversions, roas
       FROM ad_metrics WHERE integration_id = $1
       ORDER BY date DESC LIMIT 30`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
