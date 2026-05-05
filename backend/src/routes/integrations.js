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
  listAdsCustomersWithDetails,
  getUserInfo,
  getAdsCustomerName,
} = require('../services/googleService');
const { validateToken: validateAppsflyer, getAppName: getAppsflyerName } = require('../services/appsflyerService');
const { validateToken: validateAdjust, getAppName: getAdjustName } = require('../services/adjustService');
const { validateCredentials: validateAdform, getAccountName: getAdformName } = require('../services/adformService');
const { getLinkedinAuthUrl, exchangeToken: exchangeLinkedinToken, getAdAccounts: getLinkedinAccounts, getAccountName: getLinkedinName } = require('../services/linkedinService');
const { listAllAdvertisers, listCampaigns: listDv360Campaigns } = require('../services/dv360Service');
const { getUserProfiles: getCm360Profiles, listAdvertisers: listCm360Advertisers, getCampaigns: getCm360Campaigns } = require('../services/cm360Service');
const { encrypt, decrypt } = require('../services/tokenEncryption');

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

const VALID_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust', 'adform', 'linkedin', 'dv360', 'cm360'];
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
      `SELECT i.id, i.platform, i.account_id, i.is_active, i.status, i.token_expiry, i.created_at,
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
  if (!['google_analytics', 'google_ads', 'dv360', 'cm360'].includes(platform)) {
    return res.status(400).json({ error: 'platform google_analytics, google_ads, dv360 veya cm360 olmalı' });
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
    let needsCustomerSelection = false;
    if (platform === 'google_analytics') {
      const props = await getAnalyticsProperties(tokens).catch(() => []);
      accountId = props[0]?.propertyId || null;
    } else if (platform === 'google_ads') {
      const customers = await listAdsCustomersWithDetails(tokens).catch((e) => {
        console.warn('[google/callback] listAdsCustomersWithDetails hatası:', e?.message);
        return [];
      });
      console.log(`[google/callback] google_ads customers found: ${customers.length}`);
      const nonMgr = customers.filter(c => !c.isManager);
      accountId = (nonMgr[0] || customers[0])?.id || null;
      // Müşteri listesi başarısız olsa bile seçim modali her zaman açılmalı.
      // Gerçek listeleme /google_ads/customers endpoint'inde yapılır.
      needsCustomerSelection = true;
    } else if (platform === 'dv360') {
      accountId = null;
    } else if (platform === 'cm360') {
      accountId = null;
      needsCustomerSelection = true; // needs profile selection modal
    }

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations
         (company_id, platform, access_token, refresh_token, account_id, token_expiry, is_active, status)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'connected')
       ON CONFLICT (company_id, platform) DO UPDATE SET
         access_token  = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
         account_id    = COALESCE(EXCLUDED.account_id, integrations.account_id),
         token_expiry  = EXCLUDED.token_expiry,
         is_active     = true,
         status        = 'connected'
       RETURNING *`,
      [companyId, platform, encrypt(tokens.access_token), encrypt(tokens.refresh_token || null),
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
      const verifyParams = new URLSearchParams({
        verify:          platform,
        account_name:    accountName || '',
        brand_name:      brandName,
        similarity:      similarity.toFixed(3),
        integration_id:  integration.id,
      });
      if (needsCustomerSelection) verifyParams.set('needs_customer', '1');
      const verifyUrl = `${FRONTEND_URL}/integrations?${verifyParams.toString()}`;
      console.log('[google/callback] verify redirect, needsCustomer:', needsCustomerSelection, 'url:', verifyUrl);
      return res.redirect(verifyUrl);
    }

    const successParams = new URLSearchParams({ success: platform });
    if (needsCustomerSelection) successParams.set('needs_customer', '1');
    const redirectUrl = `${FRONTEND_URL}/integrations?${successParams.toString()}`;
    console.log('[google/callback] customers:', customers?.length ?? 'n/a', 'needsCustomer:', needsCustomerSelection, 'redirect:', redirectUrl);
    res.redirect(redirectUrl);
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

    // Google Ads için customer_id: extra'dan veya account_id'den al
    const accountId = platform === 'google_ads'
      ? (integration.extra?.customer_id || integration.extra?.customerId || integration.account_id)
      : integration.account_id;

    if (!accountId) {
      return res.status(400).json({ error: 'Hesap ID bulunamadı. Lütfen yeniden bağlanın.' });
    }
    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };
    const data = platform === 'google_analytics'
      ? await getAnalyticsData(tokens, accountId, integration.id)
      : await getAdsData(tokens, accountId, integration.id);
    res.json({ platform, account_id: accountId, data });
  } catch (err) {
    console.error('Google data hatası:', err);
    const msg = err.message?.includes('DEVELOPER_TOKEN') || err.message?.includes('developer-token')
      ? 'Google Ads bağlantısı kontrol edilmeli.'
      : err.message?.includes('PERMISSION_DENIED') || err.message?.includes('AuthenticationError')
        ? 'Google Ads hesap erişimi reddedildi. Lütfen yeniden bağlanın.'
        : err.message || 'Veri çekilemedi.';
    res.status(err.message?.includes('DEVELOPER_TOKEN') ? 503 : 500).json({ error: msg });
  }
});

// ── Google Ads Customer seçimi ────────────────────────────────────────────────

// GET /api/integrations/google_ads/customers
router.get('/google_ads/customers', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [companyId, 'google_ads']
    );
    if (!integration) return res.status(404).json({ error: 'Google Ads entegrasyonu bulunamadı.' });

    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };
    const customers = await listAdsCustomersWithDetails(tokens, integration.id);
    const selectedId = integration.extra?.customer_id || integration.account_id || null;
    res.json({ customers, selected_customer_id: selectedId });
  } catch (err) {
    console.error('[google_ads/customers]', err);
    res.status(500).json({ error: err.message || 'Müşteri listesi alınamadı.' });
  }
});

// POST /api/integrations/google_ads/customer — seçilen müşteriyi kaydet
router.post('/google_ads/customer', authMiddleware, async (req, res) => {
  const { customer_id, customer_name, brand_id } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id zorunlu.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const { rows: [row] } = await pool.query(
      `UPDATE integrations
       SET extra      = COALESCE(extra, '{}') || $1::jsonb,
           account_id = $2,
           status     = 'connected'
       WHERE company_id = $3 AND platform = 'google_ads' AND is_active = true
       RETURNING id`,
      [JSON.stringify({ customer_id: String(customer_id), customer_name }), String(customer_id), companyId]
    );
    if (!row) return res.status(404).json({ error: 'Google Ads entegrasyonu bulunamadı.' });
    res.json({ success: true, integration_id: row.id });
  } catch (err) {
    console.error('[google_ads/customer POST]', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
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
  if (!['google_analytics', 'google_ads', 'dv360', 'cm360'].includes(platform)) {
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
      [companyId, encrypt(api_token), app_id || null]
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
      [companyId, encrypt(api_token), app_token]
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

// ── Adform API Token Connect ──────────────────────────────────────────────────

router.post('/adform/connect', authMiddleware, async (req, res) => {
  const { username, password, tracking_id, brand_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const { valid, token, error: authErr } = await validateAdform(username, password)
      .catch(() => ({ valid: false, error: 'Adform API erişilemiyor.' }));
    if (!valid) return res.status(400).json({ error: authErr || 'Kimlik doğrulama başarısız.' });

    const accountName = tracking_id ? await getAdformName(token, tracking_id).catch(() => null) : null;
    const { rows: [company] } = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const brandName = company?.name || '';
    const similarity = nameSimilarity(accountName || '', brandName);
    const matched    = similarity >= 0.7;

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, account_id, extra, is_active)
       VALUES ($1, 'adform', $2, $3, $4, true)
       ON CONFLICT (company_id, platform) DO UPDATE
         SET access_token = EXCLUDED.access_token,
             account_id   = COALESCE(EXCLUDED.account_id, integrations.account_id),
             extra        = EXCLUDED.extra,
             is_active    = true
       RETURNING *`,
      [companyId, encrypt(token), tracking_id || null, JSON.stringify({ username, password: encrypt(password) })]
    );

    await seedHistoricalMetrics(integration).catch(console.error);

    await pool.query(
      `INSERT INTO integration_logs (integration_id, company_id, platform, account_name, brand_name, similarity, matched, action)
       VALUES ($1, $2, 'adform', $3, $4, $5, $6, $7)`,
      [integration.id, companyId, accountName, brandName, similarity, matched, matched ? 'auto_accepted' : 'pending_verify']
    ).catch(console.error);

    if (!matched) {
      return res.json({
        verify:         true,
        platform:       'adform',
        account_name:   accountName || '',
        brand_name:     brandName,
        similarity:     similarity.toFixed(3),
        integration_id: integration.id,
      });
    }

    res.json({ success: true, integration_id: integration.id });
  } catch (err) {
    console.error('Adform connect hatası:', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// ── LinkedIn OAuth ────────────────────────────────────────────────────────────

router.get('/linkedin/connect', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const authUrl   = getLinkedinAuthUrl(companyId, req.query.brand_id || null);
    res.json({ authUrl });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/linkedin/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/integrations?error=linkedin`);

  let companyId;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    companyId = parsed.companyId;
  } catch {
    return res.redirect(`${FRONTEND_URL}/integrations?error=linkedin`);
  }

  try {
    const { access_token, refresh_token, expires_in } = await exchangeLinkedinToken(code);
    const tokenExpiry = new Date(Date.now() + (expires_in || 5_184_000) * 1000); // ~60 gün default

    const accounts = await getLinkedinAccounts(access_token).catch(() => []);
    const account  = accounts[0] || null;
    const accountId   = account?.id || null;
    const accountName = account?.name || (accountId ? await getLinkedinName(access_token, accountId).catch(() => null) : null);

    const { rows: [integration] } = await pool.query(
      `INSERT INTO integrations (company_id, platform, access_token, refresh_token, account_id, token_expiry, is_active, status)
       VALUES ($1, 'linkedin', $2, $3, $4, $5, true, 'connected')
       ON CONFLICT (company_id, platform) DO UPDATE
         SET access_token  = EXCLUDED.access_token,
             refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
             account_id    = COALESCE(EXCLUDED.account_id, integrations.account_id),
             token_expiry  = EXCLUDED.token_expiry,
             is_active     = true,
             status        = 'connected'
       RETURNING *`,
      [companyId, encrypt(access_token), refresh_token ? encrypt(refresh_token) : null, accountId, tokenExpiry]
    );

    await seedHistoricalMetrics(integration).catch(console.error);

    const { rows: [company] } = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const brandName  = company?.name || '';
    const similarity = nameSimilarity(accountName || '', brandName);
    const matched    = similarity >= 0.7;

    await pool.query(
      `INSERT INTO integration_logs (integration_id, company_id, platform, account_name, brand_name, similarity, matched, action)
       VALUES ($1, $2, 'linkedin', $3, $4, $5, $6, $7)`,
      [integration.id, companyId, accountName, brandName, similarity, matched, matched ? 'auto_accepted' : 'pending_verify']
    ).catch(console.error);

    if (!matched) {
      const params = new URLSearchParams({
        verify:         'linkedin',
        account_name:   accountName || '',
        brand_name:     brandName,
        similarity:     similarity.toFixed(3),
        integration_id: integration.id,
      });
      return res.redirect(`${FRONTEND_URL}/integrations?${params.toString()}`);
    }

    res.redirect(`${FRONTEND_URL}/integrations?success=linkedin`);
  } catch (err) {
    console.error('LinkedIn OAuth callback hatası:', err);
    res.redirect(`${FRONTEND_URL}/integrations?error=linkedin`);
  }
});

// ── DV360 Advertiser seçimi ───────────────────────────────────────────────────

// GET /api/integrations/dv360/advertisers — bağlı hesaptaki advertiser'ları listele
router.get('/dv360/advertisers', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [companyId, 'dv360']
    );
    if (!integration) return res.status(404).json({ error: 'DV360 entegrasyonu bulunamadı.' });

    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const advertisers = await listAllAdvertisers(tokens, integration.id);
    res.json({ advertisers, selected_advertiser_id: integration.extra?.advertiser_id || null });
  } catch (err) {
    console.error('[dv360/advertisers]', err);
    res.status(500).json({ error: err.message || 'Advertiser listesi alınamadı.' });
  }
});

// POST /api/integrations/dv360/advertiser — seçilen advertiser'ı kaydet
router.post('/dv360/advertiser', authMiddleware, async (req, res) => {
  const { advertiser_id, advertiser_name, partner_id, brand_id } = req.body;
  if (!advertiser_id) return res.status(400).json({ error: 'advertiser_id zorunlu.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const { rows: [row] } = await pool.query(
      `UPDATE integrations
       SET extra = COALESCE(extra, '{}') || $1::jsonb,
           account_id = $2,
           status = 'connected'
       WHERE company_id = $3 AND platform = 'dv360' AND is_active = true
       RETURNING id`,
      [JSON.stringify({ advertiser_id, advertiser_name, partner_id }), String(advertiser_id), companyId]
    );
    if (!row) return res.status(404).json({ error: 'DV360 entegrasyonu bulunamadı.' });
    res.json({ success: true, integration_id: row.id });
  } catch (err) {
    console.error('[dv360/advertiser POST]', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// GET /api/integrations/dv360/campaigns — seçili advertiser'ın kampanyaları
router.get('/dv360/campaigns', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [companyId, 'dv360']
    );
    if (!integration) return res.status(404).json({ error: 'DV360 entegrasyonu bulunamadı.' });
    const advertiserId = integration.extra?.advertiser_id;
    if (!advertiserId) return res.status(400).json({ error: 'Advertiser seçilmemiş.' });

    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const campaigns = await listDv360Campaigns(tokens, advertiserId, integration.id);
    res.json({ campaigns, advertiser_id: advertiserId });
  } catch (err) {
    console.error('[dv360/campaigns]', err);
    res.status(500).json({ error: err.message || 'Kampanya listesi alınamadı.' });
  }
});

// ── CM360 Profile seçimi ──────────────────────────────────────────────────────

// GET /api/integrations/cm360/profiles — CM360 hesabındaki profilleri listele
router.get('/cm360/profiles', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [companyId, 'cm360']
    );
    if (!integration) return res.status(404).json({ error: 'CM360 entegrasyonu bulunamadı.' });

    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const profiles = await getCm360Profiles(tokens, integration.id);
    res.json({ profiles, selected_profile_id: integration.extra?.profile_id || null });
  } catch (err) {
    console.error('[cm360/profiles]', err);
    res.status(500).json({ error: err.message || 'Profil listesi alınamadı.' });
  }
});

// POST /api/integrations/cm360/profile — seçilen profili kaydet
router.post('/cm360/profile', authMiddleware, async (req, res) => {
  const { profile_id, profile_name, account_id, account_name, brand_id } = req.body;
  if (!profile_id) return res.status(400).json({ error: 'profile_id zorunlu.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const { rows: [row] } = await pool.query(
      `UPDATE integrations
       SET extra      = COALESCE(extra, '{}') || $1::jsonb,
           account_id = $2,
           status     = 'connected'
       WHERE company_id = $3 AND platform = 'cm360' AND is_active = true
       RETURNING id`,
      [JSON.stringify({ profile_id: String(profile_id), profile_name, account_id, account_name }), String(account_id || profile_id), companyId]
    );
    if (!row) return res.status(404).json({ error: 'CM360 entegrasyonu bulunamadı.' });
    res.json({ success: true, integration_id: row.id });
  } catch (err) {
    console.error('[cm360/profile POST]', err);
    res.status(500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// GET /api/integrations/cm360/campaigns — seçili profildeki kampanyalar
router.get('/cm360/campaigns', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [companyId, 'cm360']
    );
    if (!integration) return res.status(404).json({ error: 'CM360 entegrasyonu bulunamadı.' });
    const profileId = integration.extra?.profile_id;
    if (!profileId) return res.status(400).json({ error: 'Profil seçilmemiş.' });

    const tokens = {
      access_token:  decrypt(integration.access_token),
      refresh_token: decrypt(integration.refresh_token),
      expiry_date:   integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
    };

    const campaigns = await getCm360Campaigns(tokens, profileId, integration.id);
    res.json({ campaigns, profile_id: profileId });
  } catch (err) {
    console.error('[cm360/campaigns]', err);
    res.status(500).json({ error: err.message || 'Kampanya listesi alınamadı.' });
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
      `INSERT INTO integrations (company_id, platform, access_token, refresh_token, account_id, is_active, status)
       VALUES ($1, $2, 'mock_token', 'mock_refresh', $3, true, 'connected')
       ON CONFLICT (company_id, platform) DO UPDATE
         SET is_active = true, access_token = 'mock_token', account_id = EXCLUDED.account_id, status = 'connected'
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
