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

// GET /api/integrations — kullanıcının entegrasyonlarını listele
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.platform, i.account_id, i.is_active, i.created_at,
        COALESCE(SUM(m.spend), 0) AS total_spend,
        COALESCE(AVG(m.roas), 0) AS avg_roas,
        COALESCE(SUM(m.conversions), 0) AS total_conversions,
        COALESCE(SUM(m.clicks), 0) AS total_clicks
       FROM integrations i
       LEFT JOIN ad_metrics m ON m.integration_id = i.id
         AND m.date >= CURRENT_DATE - INTERVAL '30 days'
       WHERE i.user_id = $1 AND i.is_active = true
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

// GET /api/integrations/google/connect?platform=google_analytics|google_ads
router.get('/google/connect', authMiddleware, (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'platform google_analytics veya google_ads olmalı' });
  }
  const authUrl = getAuthUrl(req.user.id, platform);
  res.json({ authUrl });
});

// GET /api/integrations/google/callback?code=...&state=...
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/integrations?error=${encodeURIComponent(error)}`);
  }

  let userId, platform;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    userId = parsed.userId;
    platform = parsed.platform;
  } catch {
    return res.redirect(`${FRONTEND_URL}/integrations?error=invalid_state`);
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

    const result = await pool.query(
      `INSERT INTO integrations
         (user_id, platform, access_token, refresh_token, account_id, token_expiry, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (user_id, platform) DO UPDATE SET
         access_token  = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
         account_id    = COALESCE(EXCLUDED.account_id, integrations.account_id),
         token_expiry  = EXCLUDED.token_expiry,
         is_active     = true
       RETURNING *`,
      [
        userId,
        platform,
        tokens.access_token,
        tokens.refresh_token || null,
        accountId,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      ]
    );

    await seedHistoricalMetrics(result.rows[0]).catch(console.error);

    res.redirect(`${FRONTEND_URL}/integrations?success=true&platform=${platform}`);
  } catch (err) {
    console.error('Google OAuth callback hatası:', err);
    res.redirect(`${FRONTEND_URL}/integrations?error=oauth_failed`);
  }
});

// GET /api/integrations/google/data?platform=google_analytics|google_ads
router.get('/google/data', authMiddleware, async (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }

  try {
    const row = await pool.query(
      `SELECT * FROM integrations WHERE user_id = $1 AND platform = $2 AND is_active = true`,
      [req.user.id, platform]
    );
    if (!row.rows.length) return res.status(404).json({ error: 'Bağlı hesap bulunamadı.' });

    const integration = row.rows[0];
    if (!integration.account_id) {
      return res.status(400).json({ error: 'Hesap ID bulunamadı. Lütfen yeniden bağlanın.' });
    }

    const tokens = {
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const data =
      platform === 'google_analytics'
        ? await getAnalyticsData(tokens, integration.account_id)
        : await getAdsData(tokens, integration.account_id);

    res.json({ platform, account_id: integration.account_id, data });
  } catch (err) {
    console.error('Google data hatası:', err);
    res.status(500).json({ error: err.message || 'Veri çekilemedi.' });
  }
});

// DELETE /api/integrations/google?platform=google_analytics|google_ads
router.delete('/google', authMiddleware, async (req, res) => {
  const { platform } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    await pool.query(
      'UPDATE integrations SET is_active = false WHERE user_id = $1 AND platform = $2',
      [req.user.id, platform]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── Mock OAuth (Meta, TikTok) ─────────────────────────────────────────────────

// GET /api/integrations/:platform/connect — mock OAuth bağlantısı
router.get('/:platform/connect', authMiddleware, async (req, res) => {
  const { platform } = req.params;
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }

  try {
    const accountId = `mock_${platform}_${req.user.id.slice(0, 8)}`;
    const result = await pool.query(
      `INSERT INTO integrations (user_id, platform, access_token, refresh_token, account_id, is_active)
       VALUES ($1, $2, 'mock_token', 'mock_refresh', $3, true)
       ON CONFLICT (user_id, platform) DO UPDATE
         SET is_active = true, access_token = 'mock_token', account_id = EXCLUDED.account_id
       RETURNING *`,
      [req.user.id, platform, accountId]
    );
    await seedHistoricalMetrics(result.rows[0]);
    res.redirect(`${FRONTEND_URL}/integrations?integration_connected=${platform}`);
  } catch (err) {
    console.error(err);
    res.redirect(`${FRONTEND_URL}/integrations?integration_error=${platform}`);
  }
});

// DELETE /api/integrations/:id — ID ile bağlantıyı kes
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE integrations SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entegrasyon bulunamadı.' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/integrations/:id/metrics — belirli entegrasyonun metrikleri
router.get('/:id/metrics', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date, spend, impressions, clicks, conversions, roas
       FROM ad_metrics
       WHERE integration_id = $1
       ORDER BY date DESC LIMIT 30`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
