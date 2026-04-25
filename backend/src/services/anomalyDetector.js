const { Resend } = require('resend');
const pool = require('../db');
const getPlatformService = require('./platforms');

const ANOMALY_THRESHOLD = 1.5;
const PLATFORM_LABELS = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_analytics: 'Google Analytics',
};

async function detectAndHandle(integration) {
  const { rows: metrics } = await pool.query(
    `SELECT spend, date FROM ad_metrics
     WHERE integration_id = $1
     ORDER BY date DESC LIMIT 31`,
    [integration.id]
  );

  if (metrics.length < 8) return;

  const [latest, ...history] = metrics;
  const avgSpend = history.reduce((s, r) => s + parseFloat(r.spend), 0) / history.length;

  if (avgSpend === 0 || parseFloat(latest.spend) <= avgSpend * ANOMALY_THRESHOLD) return;

  const platformLabel = PLATFORM_LABELS[integration.platform] || integration.platform;
  console.log(`⚠️  Anomali: ${platformLabel} — ₺${latest.spend} (ort: ₺${avgSpend.toFixed(0)})`);

  const platformService = getPlatformService(integration.platform);
  await platformService.pauseCampaign(integration);

  await pool.query(
    `INSERT INTO anomalies (integration_id, company_id, metric, expected_value, actual_value, status)
     VALUES ($1, $2, 'spend', $3, $4, 'open')`,
    [integration.id, integration.company_id, avgSpend.toFixed(2), latest.spend]
  );

  await notifyAnomaly(integration, latest.spend, avgSpend, platformLabel);
}

async function notifyAnomaly(integration, actualSpend, expectedSpend, platformLabel) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Şirketin aktif kullanıcılarını bul
  const { rows: users } = await pool.query(
    `SELECT u.email, c.name AS company_name
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = $1 AND u.is_active = true`,
    [integration.company_id]
  );

  // Bağlı şirketleri de dahil et
  const { rows: partners } = await pool.query(
    `SELECT u.email FROM users u
     JOIN connections conn ON (
       (conn.agency_company_id = $1 AND u.company_id = conn.brand_company_id)
       OR
       (conn.brand_company_id = $1 AND u.company_id = conn.agency_company_id)
     )
     WHERE u.is_active = true AND u.is_company_admin = true`,
    [integration.company_id]
  );

  const companyName = users[0]?.company_name || 'Şirket';
  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
      <div style="margin-bottom:24px;">
        <span style="font-size:18px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
      </div>
      <div style="background:#2D1A1A;border:1px solid #FF6B5A44;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:11px;color:#FF6B5A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⚠️ Anomali Tespit Edildi</div>
        <div style="font-size:15px;font-weight:600;">${companyName} — ${platformLabel}</div>
      </div>
      <p style="color:#94A8B3;line-height:1.7;margin:0 0 20px;">
        Günlük harcama 30 günlük ortalamanın
        <strong style="color:#FF6B5A;">%${Math.round((actualSpend / expectedSpend - 1) * 100)} üzerinde</strong>.
      </p>
      <div style="background:#162533;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:11px;color:#5A7080;margin-bottom:4px;">GERÇEK HARCAMA</div>
          <div style="font-size:20px;font-weight:700;color:#FF6B5A;">₺${Number(actualSpend).toLocaleString('tr-TR')}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#5A7080;margin-bottom:4px;">30 GÜNLÜK ORT.</div>
          <div style="font-size:20px;font-weight:700;">₺${Number(expectedSpend).toLocaleString('tr-TR')}</div>
        </div>
      </div>
      <p style="color:#94A8B3;font-size:13px;">Kampanya otomatik olarak <strong>durdurulmuştur</strong>.</p>
    </div>
  `;

  const recipients = [...users, ...partners];
  for (const r of recipients) {
    await resend.emails.send({
      from: 'AdsLands <onboarding@resend.dev>',
      to: r.email,
      subject: `⚠️ Anomali: ${companyName} — ${platformLabel}`,
      html,
    }).catch(err => console.error('Anomali maili gönderilemedi:', err.message));
  }
}

module.exports = { detectAndHandle };
