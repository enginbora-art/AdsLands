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
  getUserInfo,
  getAdsCustomerName,
} = require('../services/googleService');
const { validateToken: validateAppsflyer, getAppName: getAppsflyerName } = require('../services/appsflyerService');
const { validateToken: validateAdjust, getAppName: getAdjustName } = require('../services/adjustService');

// ── Ad hesabı / marka adı benzerlik skoru (0-1) ───────────────────────────────
function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const norm = s => s.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  const words = s => norm(s).split(/\s+/).filter(w => w.length > 1);
  const na = norm(a), nb = norm(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 1;
  const wa = words(a), wb = words(b);
  if (!wa.length || !wb.length) return 0;
  const common = wa.filter(w => wb.some(bw => bw.includes(w) || w.includes(bw)));
  return common.length / Math.max(wa.length, wb.length);
}

const VALID_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust'];
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Ajans adına marka entegrasyonu yönetimi: brand_id varsa doğrulayıp döndür
async function resolveCompanyId(user, brandId) {
  if (!brandId) return user.company_id;
  if (user.company_type !== 'agency') throw Object.assign(new Error('Yetkisiz.'), { status: 403 });
  const { rows: [conn] } = await pool.query(
    'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
    [user.company_id, brandId]
  );
  if (!conn) throw Object.assign(new Error('Bu markaya erişim yetkiniz yok.'), { status: 403 });
  return brandId;
}

// GET /api/integrations?brand_id=xxx
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
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
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

router.get('/google/connect', authMiddleware, async (req, res) => {
  const { platform, brand_id } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'platform google_analytics veya google_ads olmalı' });
  }
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const authUrl = getAuthUrl(companyId, platform);
    res.json({ authUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
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

    // ── Hesap doğrulama ───────────────────────────────────────────────────────
    const tokenObj = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    // Hesap adını çek: Google Ads → customer descriptiveName, GA → userinfo name
    let accountName = null;
    if (platform === 'google_ads' && accountId) {
      accountName = await getAdsCustomerName(tokenObj, accountId).catch((e) => {
        console.error('[verify] getAdsCustomerName hatası:', e?.message);
        return null;
      });
    }
    if (!accountName) {
      const info = await getUserInfo(tokenObj).catch((e) => {
        console.error('[verify] getUserInfo hatası:', e?.message);
        return null;
      });
      accountName = info?.name || info?.email || null;
    }

    // Şirket (marka) adını çek
    const { rows: [company] } = await pool.query(
      'SELECT name FROM companies WHERE id = $1', [companyId]
    );
    const brandName = company?.name || '';

    const similarity = nameSimilarity(accountName || '', brandName);
    const matched = similarity >= 0.7;

    console.log(`[integration verify] platform=${platform} companyId=${companyId} account="${accountName}" brand="${brandName}" similarity=${similarity.toFixed(3)} matched=${matched}`);

    // Log kaydet
    await pool.query(
      `INSERT INTO integration_logs
         (integration_id, company_id, platform, account_name, brand_name, similarity, matched, action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [integration.id, companyId, platform, accountName, brandName,
       similarity, matched, matched ? 'auto_accepted' : 'pending_verify']
    ).catch(console.error);

    if (!matched) {
      const params = new URLSearchParams({
        verify:          platform,
        account_name:    accountName || '',
        brand_name:      brandName,
        similarity:      similarity.toFixed(3),
        integration_id:  integration.id,
      });
      return res.redirect(`${FRONTEND_URL}/integrations?${params.toString()}`);
    }

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

// POST /api/integrations/log-verify — kullanıcı doğrulama kararını kaydet
router.post('/log-verify', authMiddleware, async (req, res) => {
  const { integration_id, action } = req.body; // action: 'confirmed' | 'cancelled'
  if (!['confirmed', 'cancelled'].includes(action)) {
    return res.status(400).json({ error: 'Geçersiz action.' });
  }
  try {
    const dbAction = action === 'confirmed' ? 'user_confirmed' : 'user_cancelled';
    await pool.query(
      `UPDATE integration_logs SET action = $1
       WHERE integration_id = $2 AND action = 'pending_verify'`,
      [dbAction, integration_id]
    );
    if (action === 'cancelled') {
      await pool.query(
        'UPDATE integrations SET is_active = false WHERE id = $1 AND company_id IN (SELECT company_id FROM integrations WHERE id = $1)',
        [integration_id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

router.delete('/google', authMiddleware, async (req, res) => {
  const { platform, brand_id } = req.query;
  if (!['google_analytics', 'google_ads'].includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    await pool.query(
      'UPDATE integrations SET is_active = false WHERE company_id = $1 AND platform = $2',
      [companyId, platform]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// ── AppsFlyer Token Connect ───────────────────────────────────────────────────

router.post('/appsflyer/connect', authMiddleware, async (req, res) => {
  const { api_token, app_id, brand_id } = req.body;
  if (!api_token) return res.status(400).json({ error: 'api_token zorunlu.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const { valid, error: tokenErr } = await validateAppsflyer(api_token, app_id || '').catch(() => ({ valid: false, error: 'API erişilemiyor.' }));
    if (!valid) return res.status(400).json({ error: tokenErr || 'Token doğrulanamadı.' });

    const appName = app_id ? await getAppsflyerName(api_token, app_id).catch(() => app_id) : null;
    const { rows: [company] } = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const brandName = company?.name || '';
    const similarity = nameSimilarity(appName || '', brandName);
    const matched = similarity >= 0.7;

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, account_id, is_active)
       VALUES ($1, 'appsflyer', $2, $3, true)
       ON CONFLICT (company_id, platform) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             account_id = COALESCE(EXCLUDED.account_id, integrations.account_id),
             is_active = true
       RETURNING *`,
      [companyId, api_token, app_id || null]
    );

    await seedHistoricalMetrics(integration).catch(console.error);

    console.log(`[appsflyer verify] app="${appName}" brand="${brandName}" similarity=${similarity.toFixed(3)} matched=${matched}`);

    await pool.query(
      `INSERT INTO integration_logs (integration_id, company_id, platform, account_name, brand_name, similarity, matched, action)
       VALUES ($1, $2, 'appsflyer', $3, $4, $5, $6, $7)`,
      [integration.id, companyId, appName, brandName, similarity, matched, matched ? 'auto_accepted' : 'pending_verify']
    ).catch(console.error);

    if (!matched) {
      return res.json({
        verify: true,
        platform: 'appsflyer',
        account_name: appName || '',
        brand_name: brandName,
        similarity: similarity.toFixed(3),
        integration_id: integration.id,
      });
    }

    res.json({ success: true, integration_id: integration.id });
  } catch (err) {
    console.error('AppsFlyer connect hatası:', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// ── Adjust Token Connect ──────────────────────────────────────────────────────

router.post('/adjust/connect', authMiddleware, async (req, res) => {
  const { api_token, app_token, brand_id } = req.body;
  if (!api_token || !app_token) return res.status(400).json({ error: 'api_token ve app_token zorunlu.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const { valid, error: tokenErr } = await validateAdjust(api_token, app_token).catch(() => ({ valid: false, error: 'API erişilemiyor.' }));
    if (!valid) return res.status(400).json({ error: tokenErr || 'Token doğrulanamadı.' });

    const appName = await getAdjustName(api_token, app_token).catch(() => app_token);
    const { rows: [company] } = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const brandName = company?.name || '';
    const similarity = nameSimilarity(appName || '', brandName);
    const matched = similarity >= 0.7;

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, account_id, is_active)
       VALUES ($1, 'adjust', $2, $3, true)
       ON CONFLICT (company_id, platform) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             account_id = EXCLUDED.account_id,
             is_active = true
       RETURNING *`,
      [companyId, api_token, app_token]
    );

    await seedHistoricalMetrics(integration).catch(console.error);

    console.log(`[adjust verify] app="${appName}" brand="${brandName}" similarity=${similarity.toFixed(3)} matched=${matched}`);

    await pool.query(
      `INSERT INTO integration_logs (integration_id, company_id, platform, account_name, brand_name, similarity, matched, action)
       VALUES ($1, $2, 'adjust', $3, $4, $5, $6, $7)`,
      [integration.id, companyId, appName, brandName, similarity, matched, matched ? 'auto_accepted' : 'pending_verify']
    ).catch(console.error);

    if (!matched) {
      return res.json({
        verify: true,
        platform: 'adjust',
        account_name: appName || '',
        brand_name: brandName,
        similarity: similarity.toFixed(3),
        integration_id: integration.id,
      });
    }

    res.json({ success: true, integration_id: integration.id });
  } catch (err) {
    console.error('Adjust connect hatası:', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// ── Mock OAuth (Meta, TikTok) ─────────────────────────────────────────────────

router.get('/:platform/connect', authMiddleware, async (req, res) => {
  const { platform } = req.params;
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: 'Geçersiz platform.' });
  }
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const accountId = `mock_${platform}_${companyId.slice(0, 8)}`;
    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, refresh_token, account_id, is_active)
       VALUES ($1, $2, 'mock_token', 'mock_refresh', $3, true)
       ON CONFLICT (company_id, platform) DO UPDATE
         SET is_active = true, access_token = 'mock_token', account_id = EXCLUDED.account_id
       RETURNING *`,
      [companyId, platform, accountId]
    );
    await seedHistoricalMetrics(integration);
    const brandParam = req.query.brand_id ? `&brand_id=${req.query.brand_id}` : '';
    res.redirect(`${FRONTEND_URL}/integrations?success=${platform}${brandParam}`);
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
