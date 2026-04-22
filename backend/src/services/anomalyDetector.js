const { Resend } = require('resend');
const pool = require('../db');
const getPlatformService = require('./platforms');

const ANOMALY_THRESHOLD = 1.5; // 30 günlük ortalamanın %50 üzeri

const PLATFORM_LABELS = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_analytics: 'Google Analytics',
};

async function detectAndHandle(integration) {
  const metrics = await pool.query(
    `SELECT spend, date FROM ad_metrics
     WHERE integration_id = $1
     ORDER BY date DESC LIMIT 31`,
    [integration.id]
  );

  if (metrics.rows.length < 8) return;

  const [latest, ...history] = metrics.rows;
  const avgSpend = history.reduce((s, r) => s + parseFloat(r.spend), 0) / history.length;

  if (avgSpend === 0 || parseFloat(latest.spend) <= avgSpend * ANOMALY_THRESHOLD) return;

  const platformLabel = PLATFORM_LABELS[integration.platform] || integration.platform;
  console.log(`⚠️  Anomali tespit edildi: ${platformLabel} — harcama: ₺${latest.spend} (ort: ₺${avgSpend.toFixed(0)})`);

  // 1. Reklamı durdur
  const platformService = getPlatformService(integration.platform);
  await platformService.pauseCampaign(integration);

  // 2. Anomaliyi kaydet
  await pool.query(
    `INSERT INTO anomalies (integration_id, metric, expected_value, actual_value, action_taken, notified_at)
     VALUES ($1, 'spend', $2, $3, 'campaign_paused', NOW())`,
    [integration.id, avgSpend.toFixed(2), latest.spend]
  );

  // 3. E-posta gönder
  await notifyAnomaly(integration, latest.spend, avgSpend, platformLabel);
}

async function notifyAnomaly(integration, actualSpend, expectedSpend, platformLabel) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const ownerResult = await pool.query(
    'SELECT email, company_name, role FROM users WHERE id = $1',
    [integration.user_id]
  );
  const owner = ownerResult.rows[0];
  if (!owner) return;

  const connectedResult = await pool.query(
    `SELECT u.email, u.company_name FROM users u
     JOIN connections c ON (
       (c.brand_id = $1 AND c.agency_id = u.id) OR
       (c.agency_id = $1 AND c.brand_id = u.id)
     )`,
    [integration.user_id]
  );

  const recipients = [owner, ...connectedResult.rows];

  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
      <div style="margin-bottom:24px;">
        <span style="font-size:18px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
      </div>
      <div style="background:#2D1A1A;border:1px solid #FF6B5A44;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <div style="font-size:11px;color:#FF6B5A;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">⚠️ Anomali Tespit Edildi</div>
        <div style="font-size:15px;font-weight:600;">${owner.company_name} — ${platformLabel}</div>
      </div>
      <p style="color:#94A8B3;line-height:1.7;margin:0 0 20px;">
        Günlük harcama 30 günlük ortalamanın <strong style="color:#FF6B5A;">%${Math.round((actualSpend / expectedSpend - 1) * 100)} üzerinde</strong> tespit edildi.
      </p>
      <div style="background:#162533;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div>
          <div style="font-size:11px;color:#5A7080;margin-bottom:4px;">GERÇEK HARCAMA</div>
          <div style="font-size:20px;font-weight:700;color:#FF6B5A;">₺${Number(actualSpend).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#5A7080;margin-bottom:4px;">30 GÜNLÜK ORT.</div>
          <div style="font-size:20px;font-weight:700;">₺${Number(expectedSpend).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}</div>
        </div>
      </div>
      <p style="color:#94A8B3;font-size:13px;">Kampanya otomatik olarak <strong style="color:#F0F5F3;">durdurulmuştur</strong>. Detaylar için platforma giriş yapın.</p>
    </div>
  `;

  for (const recipient of recipients) {
    await resend.emails.send({
      from: 'AdsLands <onboarding@resend.dev>',
      to: recipient.email,
      subject: `⚠️ Anomali: ${owner.company_name} — ${platformLabel} harcaması beklenenden yüksek`,
      html,
    }).catch(err => console.error('Anomali maili gönderilemedi:', err.message));
  }
}

module.exports = { detectAndHandle };
