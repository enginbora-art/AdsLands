const pool = require('../db');
const { encrypt, decrypt } = require('./tokenEncryption');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.adslands.com';

const PLATFORM_LABELS = {
  google_ads:       'Google Ads',
  google_analytics: 'Google Analytics',
  meta:             'Meta Ads',
  tiktok:           'TikTok Ads',
  linkedin:         'LinkedIn Ads',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Status helpers ────────────────────────────────────────────────────────────

async function markDisconnected(integrationId, companyId, platform) {
  await pool.query(
    "UPDATE integrations SET status = 'disconnected' WHERE id = $1",
    [integrationId]
  );

  const platformLabel = PLATFORM_LABELS[platform] || platform;
  const title   = `${platformLabel} bağlantısı koptu`;
  const message = `${platformLabel} bağlantısı koptu — veri akışı durdu. Entegrasyonlar sayfasından yeniden bağlayın.`;
  const meta    = JSON.stringify({ action_url: '/integrations', platform, integration_id: integrationId });

  // 1 saatte bir bildirim gönder (dedup)
  const { rows: [existing] } = await pool.query(`
    SELECT id FROM notifications
    WHERE company_id = $1 AND type = 'integration_disconnected'
      AND meta->>'integration_id' = $2
      AND created_at >= NOW() - INTERVAL '1 hour'
    LIMIT 1
  `, [companyId, integrationId]);
  if (existing) return;

  const { rows: admins } = await pool.query(
    'SELECT id, email FROM users WHERE company_id = $1 AND is_company_admin = true AND is_active = true',
    [companyId]
  );

  for (const admin of admins) {
    await pool.query(
      `INSERT INTO notifications (user_id, company_id, type, title, message, meta)
       VALUES ($1, $2, 'integration_disconnected', $3, $4, $5)`,
      [admin.id, companyId, title, message, meta]
    ).catch(console.error);

    if (process.env.RESEND_API_KEY && admin.email) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from:    `AdsLands <${process.env.FROM_EMAIL}>`,
          to:      admin.email,
          subject: title,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
              <h2 style="color:#ef4444">⚠ ${title}</h2>
              <p>${message}</p>
              <a href="${FRONTEND_URL}/integrations"
                 style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">
                Entegrasyonlar →
              </a>
            </div>`,
        });
      } catch (emailErr) {
        console.error('[tokenRefresh] E-posta hatası:', emailErr.message);
      }
    }
  }

  console.warn(`[tokenRefresh] DISCONNECTED: platform=${platform} integration=${integrationId} company=${companyId}`);
}

async function markExpiring(integrationId) {
  await pool.query(
    "UPDATE integrations SET status = 'expiring' WHERE id = $1 AND status = 'connected'",
    [integrationId]
  );
}

// ── Platform-specific refresh ─────────────────────────────────────────────────

async function refreshGoogleToken(integration) {
  const { createGoogleClient } = require('./googleService');
  const rawRefresh = decrypt(integration.refresh_token);
  if (!rawRefresh) throw new Error('Google refresh token yok');

  const client = createGoogleClient();
  client.setCredentials({ refresh_token: rawRefresh });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) throw new Error('Google refresh geçersiz veya iptal edilmiş');

  await pool.query(
    "UPDATE integrations SET access_token=$1, token_expiry=$2, status='connected' WHERE id=$3",
    [
      encrypt(credentials.access_token),
      credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      integration.id,
    ]
  );
  console.log(`[tokenRefresh] Google token yenilendi: ${integration.id}`);
}

async function refreshLinkedinToken(integration) {
  const { refreshAccessToken } = require('./linkedinService');
  const rawRefresh = decrypt(integration.refresh_token);
  if (!rawRefresh) throw new Error('LinkedIn refresh token yok');

  const result = await refreshAccessToken(rawRefresh);
  const tokenExpiry = new Date(Date.now() + (result.expires_in || 5_184_000) * 1000);

  await pool.query(
    `UPDATE integrations SET access_token=$1, token_expiry=$2, status='connected'
     ${result.refresh_token !== rawRefresh ? ', refresh_token=$4' : ''}
     WHERE id=$3`,
    result.refresh_token !== rawRefresh
      ? [encrypt(result.access_token), tokenExpiry, integration.id, encrypt(result.refresh_token)]
      : [encrypt(result.access_token), tokenExpiry, integration.id]
  );
  console.log(`[tokenRefresh] LinkedIn token yenilendi: ${integration.id}`);
}

async function refreshMetaToken(integration) {
  const axios = require('axios');
  const rawToken = decrypt(integration.access_token);
  if (!rawToken || rawToken === 'mock_token') throw new Error('Geçerli Meta token yok');

  const { data } = await axios.get('https://graph.facebook.com/oauth/access_token', {
    params: {
      grant_type:        'fb_exchange_token',
      client_id:         process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '',
      client_secret:     process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
      fb_exchange_token: rawToken,
    },
    timeout: 12000,
  });
  if (!data.access_token) throw new Error('Meta token uzatma başarısız');

  const tokenExpiry = new Date(Date.now() + (data.expires_in || 5_184_000) * 1000);
  await pool.query(
    "UPDATE integrations SET access_token=$1, token_expiry=$2, status='connected' WHERE id=$3",
    [encrypt(data.access_token), tokenExpiry, integration.id]
  );
  console.log(`[tokenRefresh] Meta token uzatıldı: ${integration.id}`);
}

async function refreshTiktokToken(integration) {
  const axios = require('axios');
  const rawRefresh = decrypt(integration.refresh_token);
  if (!rawRefresh || rawRefresh === 'mock_refresh') throw new Error('Geçerli TikTok refresh token yok');

  const { data } = await axios.post(
    'https://business-api.tiktok.com/open_api/v1.3/tt_user/oauth2/refresh_token/',
    {
      app_id:        process.env.TIKTOK_APP_ID || '',
      secret:        process.env.TIKTOK_APP_SECRET || '',
      refresh_token: rawRefresh,
    },
    { timeout: 12000 }
  );
  if (data.code !== 0 || !data.data?.access_token) {
    throw new Error(`TikTok refresh başarısız: ${data.message || 'bilinmeyen hata'}`);
  }

  // TikTok: access_token 24h, refresh_token 365 days
  const tokenExpiry = new Date(Date.now() + (data.data.access_token_expire_in || 86400) * 1000);
  await pool.query(
    "UPDATE integrations SET access_token=$1, refresh_token=$2, token_expiry=$3, status='connected' WHERE id=$4",
    [
      encrypt(data.data.access_token),
      encrypt(data.data.refresh_token || rawRefresh),
      tokenExpiry,
      integration.id,
    ]
  );
  console.log(`[tokenRefresh] TikTok token yenilendi: ${integration.id}`);
}

// ── Backoff retry wrapper ─────────────────────────────────────────────────────

async function refreshWithBackoff(integration, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      switch (integration.platform) {
        case 'google_ads':
        case 'google_analytics':
          await refreshGoogleToken(integration); break;
        case 'linkedin':
          await refreshLinkedinToken(integration); break;
        case 'meta':
          await refreshMetaToken(integration); break;
        case 'tiktok':
          await refreshTiktokToken(integration); break;
        default:
          throw new Error(`Platform '${integration.platform}' için refresh desteklenmiyor`);
      }
      return; // success
    } catch (err) {
      lastErr = err;
      console.warn(`[tokenRefresh] ${integration.platform} refresh deneme ${attempt}/${maxRetries}: ${err.message}`);
      if (attempt < maxRetries) await sleep(Math.pow(2, attempt) * 1000); // 2s, 4s
    }
  }
  throw lastErr;
}

// ── Auth-error detection ──────────────────────────────────────────────────────

function isAuthError(err) {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  if (status === 401 || status === 403) return true;
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('invalid_token') ||
    msg.includes('token expired') ||
    msg.includes('unauthenticated') ||
    msg.includes('unauthorized') ||
    msg.includes('access denied') ||
    msg.includes('invalid credentials')
  );
}

// ── High-level wrapper for metric fetchers ────────────────────────────────────

async function withAuthRetry(integration, fn) {
  try {
    return await fn(integration);
  } catch (err) {
    if (!isAuthError(err)) throw err;

    console.warn(`[tokenRefresh] Auth hatası (${integration.platform} / ${integration.id}), token yenileniyor...`);

    try {
      await refreshWithBackoff(integration);
      const { rows: [fresh] } = await pool.query('SELECT * FROM integrations WHERE id = $1', [integration.id]);
      return await fn(fresh || integration);
    } catch (refreshErr) {
      await markDisconnected(integration.id, integration.company_id, integration.platform).catch(console.error);
      throw refreshErr;
    }
  }
}

module.exports = { markDisconnected, markExpiring, refreshWithBackoff, withAuthRetry, isAuthError };
