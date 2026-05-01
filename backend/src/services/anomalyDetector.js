const { Resend } = require('resend');
const pool = require('../db');
const getPlatformService = require('./platforms');

const PLATFORM_LABELS = {
  google_ads: 'Google Ads',
  meta: 'Meta Ads',
  tiktok: 'TikTok Ads',
  google_analytics: 'Google Analytics',
  linkedin: 'LinkedIn',
  adform: 'Adform',
};

// Read company-specific settings; fall back to safe defaults if table doesn't exist yet
async function getSettings(companyId) {
  try {
    const { rows: [s] } = await pool.query(
      'SELECT * FROM anomaly_settings WHERE company_id = $1',
      [companyId]
    );
    return s || { budget_delta: 50, cpa_delta: 30, roas_delta: 25, email_on: true, platform_on: true };
  } catch {
    return { budget_delta: 50, cpa_delta: 30, roas_delta: 25, email_on: true, platform_on: true };
  }
}

// Insert a notification row for every active user of the company
async function createPlatformNotifications(companyId, anomalyId, platformLabel, actualSpend, expectedSpend) {
  const pct = Math.round((actualSpend / expectedSpend - 1) * 100);
  const title   = `⚠️ Anomali: ${platformLabel}`;
  const message = `Günlük harcama %${pct} artış gösterdi. Gerçek: ₺${Number(actualSpend).toLocaleString('tr-TR')}, Beklenen: ₺${Number(expectedSpend).toLocaleString('tr-TR')}`;
  const meta    = JSON.stringify({ anomaly_id: anomalyId, actual_value: actualSpend, expected_value: expectedSpend });

  const { rows: users } = await pool.query(
    'SELECT id FROM users WHERE company_id = $1 AND is_active = true',
    [companyId]
  );

  for (const u of users) {
    await pool.query(
      `INSERT INTO notifications (user_id, company_id, type, title, message, meta)
       VALUES ($1, $2, 'anomaly_detected', $3, $4, $5)`,
      [u.id, companyId, title, message, meta]
    ).catch(err => console.error('Platform bildirimi oluşturulamadı:', err.message));
  }
}

async function sendAnomalyEmail(integration, actualSpend, expectedSpend, platformLabel) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY eksik — e-posta gönderilmedi.');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const pct = Math.round((actualSpend / expectedSpend - 1) * 100);

  // Brand company users
  const { rows: users } = await pool.query(
    `SELECT u.email, c.name AS company_name
     FROM users u JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = $1 AND u.is_active = true`,
    [integration.company_id]
  );

  // Connected agency/brand admin users
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
        <strong style="color:#FF6B5A;">%${pct} üzerinde</strong>.
      </p>
      <div style="background:#162533;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:4px 0;font-size:11px;color:#5A7080;">GERÇEK HARCAMA</td>
            <td style="padding:4px 0;font-size:11px;color:#5A7080;">30 GÜNLÜK ORT.</td>
          </tr>
          <tr>
            <td style="font-size:20px;font-weight:700;color:#FF6B5A;">₺${Number(actualSpend).toLocaleString('tr-TR')}</td>
            <td style="font-size:20px;font-weight:700;">₺${Number(expectedSpend).toLocaleString('tr-TR')}</td>
          </tr>
        </table>
      </div>
      <p style="color:#94A8B3;font-size:13px;">Kampanya otomatik olarak <strong>durdurulmuştur</strong>.</p>
      <p style="color:#5A7080;font-size:11px;margin-top:24px;">
        Bu bildirimi kapatmak için AdsLands &rsaquo; Anomaliler &rsaquo; Bildirim Ayarları'ndan e-posta bildirimlerini devre dışı bırakabilirsiniz.
      </p>
    </div>
  `;

  const recipients = [...users, ...partners];
  const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  for (const r of recipients) {
    await resend.emails.send({
      from: `AdsLands <${fromEmail}>`,
      to: r.email,
      subject: `⚠️ Anomali: ${companyName} — ${platformLabel} (+%${pct})`,
      html,
    }).catch(err => console.error('Anomali maili gönderilemedi:', r.email, err.message));
  }
}

async function detectAndHandle(integration, isIntraday = false) {
  const { rows: metrics } = await pool.query(
    `SELECT spend, date FROM ad_metrics
     WHERE integration_id = $1
     ORDER BY date DESC LIMIT 31`,
    [integration.id]
  );

  if (metrics.length < 8) return;

  const [latest, ...history] = metrics;
  const avgSpend = history.reduce((s, r) => s + parseFloat(r.spend), 0) / history.length;

  let checkSpend = parseFloat(latest.spend);
  if (isIntraday) {
    // Project current partial-day spend to full-day equivalent
    const currentHour = new Date().getHours();
    const dayProgress = Math.max(currentHour / 24, 1 / 24);
    checkSpend = checkSpend / dayProgress;
  }

  const settings = await getSettings(integration.company_id);
  const threshold = 1 + (settings.budget_delta / 100);

  if (avgSpend === 0 || checkSpend <= avgSpend * threshold) return;

  const actualSpend   = isIntraday ? checkSpend : parseFloat(latest.spend);
  const platformLabel = PLATFORM_LABELS[integration.platform] || integration.platform;
  console.log(`⚠️  Anomali (eşik %${settings.budget_delta}): ${platformLabel} — ₺${actualSpend} (ort: ₺${avgSpend.toFixed(0)})`);

  // Pause campaign
  const platformService = getPlatformService(integration.platform);
  await platformService.pauseCampaign(integration);

  // Insert anomaly record
  const { rows: [anomaly] } = await pool.query(
    `INSERT INTO anomalies (integration_id, company_id, metric, expected_value, actual_value, status)
     VALUES ($1, $2, 'spend', $3, $4, 'open')
     RETURNING id`,
    [integration.id, integration.company_id, avgSpend.toFixed(2), actualSpend]
  );

  // Platform notification (notifications table)
  if (settings.platform_on) {
    await createPlatformNotifications(integration.company_id, anomaly.id, platformLabel, actualSpend, avgSpend);
  }

  // E-posta bildirimi
  if (settings.email_on) {
    await sendAnomalyEmail(integration, actualSpend, avgSpend, platformLabel);
  }
}

module.exports = { detectAndHandle };
