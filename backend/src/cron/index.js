const cron = require('node-cron');
const pool = require('../db');
const { fetchYesterdayMetrics, fetchTodayMetrics } = require('../services/metricsFetcher');
const { markDisconnected, markExpiring, refreshWithBackoff } = require('../services/tokenRefresh');
const { getSetting } = require('../config/appSettings');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.adslands.com';

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', google_analytics: 'Google Analytics',
  meta: 'Meta Ads', tiktok: 'TikTok Ads', linkedin: 'LinkedIn Ads',
};

async function sendExpiryNotification(row, daysLeft) {
  const dedupHours = await getSetting('notification_dedup_hours', 20);
  const { rows: [existing] } = await pool.query(`
    SELECT id FROM notifications
    WHERE company_id = $1 AND type = 'token_expiry_warning'
      AND meta->>'integration_id' = $2
      AND created_at >= NOW() - make_interval(hours => $3)
    LIMIT 1
  `, [row.company_id, row.id, dedupHours]);
  if (existing) return;

  const platformLabel = PLATFORM_LABELS[row.platform] || row.platform;
  const title   = `${platformLabel} bağlantısının süresi doluyor`;
  const message = `${platformLabel} bağlantınızın süresi ${daysLeft} gün içinde dolacak. Kesintisiz veri akışı için yeniden bağlanın.`;
  const meta    = JSON.stringify({ action_url: '/integrations', platform: row.platform, integration_id: row.id, days_left: daysLeft });

  const { rows: admins } = await pool.query(
    'SELECT id, email FROM users WHERE company_id = $1 AND is_company_admin = true AND is_active = true',
    [row.company_id]
  );

  for (const admin of admins) {
    await pool.query(
      `INSERT INTO notifications (user_id, company_id, type, title, message, meta)
       VALUES ($1, $2, 'token_expiry_warning', $3, $4, $5)`,
      [admin.id, row.company_id, title, message, meta]
    ).catch(console.error);

    if (process.env.RESEND_API_KEY && admin.email) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from:    `AdsLands <${process.env.FROM_EMAIL}>`,
          to:      admin.email,
          subject: title,
          html:    `<p>${message}</p><p><a href="${FRONTEND_URL}/integrations">Yeniden Bağlan →</a></p>`,
        });
      } catch (emailErr) {
        console.error('[cron] Token expiry e-posta hatası:', emailErr.message);
      }
    }
  }

  console.log(`⏰ Token expiry uyarısı: platform=${row.platform} company=${row.company_id} days_left=${daysLeft}`);
}

async function checkExpiringTokens() {
  const [trialWarnDays, metaWarnDays] = await Promise.all([
    getSetting('trial_warning_days', 7),
    getSetting('meta_token_warning_days', 15),
  ]);

  // ── 1. Tüm platformlar: N gün içinde dolacak tokenlar ───────────────────────
  const { rows: expiring } = await pool.query(`
    SELECT i.id, i.company_id, i.platform, i.token_expiry, i.refresh_token,
           CEIL(EXTRACT(EPOCH FROM (i.token_expiry - NOW())) / 86400)::int AS days_left
    FROM integrations i
    WHERE i.is_active = true
      AND i.status != 'disconnected'
      AND i.token_expiry IS NOT NULL
      AND i.token_expiry < NOW() + make_interval(days => $1)
      AND i.token_expiry > NOW()
  `, [trialWarnDays]);

  for (const row of expiring) {
    // Google ve TikTok: refresh_token varsa otomatik yenile
    if (['google_ads', 'google_analytics', 'tiktok'].includes(row.platform) && row.refresh_token) {
      try {
        await refreshWithBackoff(row);
        console.log(`⏰ Proaktif token yenileme: platform=${row.platform} company=${row.company_id}`);
        continue; // başarılı — uyarı gönderme
      } catch (err) {
        console.error(`[cron] Proaktif refresh başarısız (${row.platform}):`, err.message);
        await markDisconnected(row.id, row.company_id, row.platform).catch(console.error);
        continue;
      }
    }

    // LinkedIn: refresh_token varsa otomatik yenile
    if (row.platform === 'linkedin' && row.refresh_token) {
      try {
        await refreshWithBackoff(row);
        console.log(`⏰ LinkedIn proaktif token yenileme: company=${row.company_id}`);
        continue;
      } catch (err) {
        console.error('[cron] LinkedIn proaktif refresh başarısız:', err.message);
      }
    }

    // Yenilenemeyenler: expiring olarak işaretle ve uyarı gönder
    await markExpiring(row.id).catch(console.error);
    await sendExpiryNotification(row, row.days_left).catch(console.error);
  }

  // ── 2. Meta özel: 45 gün kullanılmamış token uyarısı ───────────────────────
  // Meta long-lived token 60 gün kullanılmazsa düşer; 45. günde uyar
  const { rows: metaOld } = await pool.query(`
    SELECT i.id, i.company_id, i.platform, i.token_expiry
    FROM integrations i
    WHERE i.platform = 'meta'
      AND i.is_active = true
      AND i.status != 'disconnected'
      AND i.token_expiry IS NOT NULL
      AND i.token_expiry < NOW() + make_interval(days => $1)
      AND i.token_expiry > NOW()
  `, [metaWarnDays]);

  for (const row of metaOld) {
    const daysLeft = Math.ceil((new Date(row.token_expiry) - Date.now()) / 86400000);
    await markExpiring(row.id).catch(console.error);
    await sendExpiryNotification(row, daysLeft).catch(console.error);
  }

  // ── 3. Süresi dolmuş tokenlar: direkt disconnect ──────────────────────────
  const { rows: expired } = await pool.query(`
    SELECT i.id, i.company_id, i.platform
    FROM integrations i
    WHERE i.is_active = true
      AND i.status = 'connected'
      AND i.token_expiry IS NOT NULL
      AND i.token_expiry < NOW()
  `);

  for (const row of expired) {
    await markDisconnected(row.id, row.company_id, row.platform).catch(console.error);
    console.log(`⏰ Süresi dolmuş token disconnect: platform=${row.platform} company=${row.company_id}`);
  }
}

function startCronJobs() {
  // Her gece 02:00'de metrikleri çek ve anomali kontrolü yap
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ Cron: gece metrik çekimi başladı...');
    try {
      await fetchYesterdayMetrics();
    } catch (err) {
      console.error('Cron hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Her gün 09:00'da trial bitenler için uyarı bildirimi gönder
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Cron: trial uyarı kontrolü...');
    try {
      const [trialWarnDays, dedupHours] = await Promise.all([
        getSetting('trial_warning_days', 7),
        getSetting('notification_dedup_hours', 20),
      ]);

      // Aktif aboneliği olmayan, trial'ı N gün içinde bitecek şirketler
      const { rows: companies } = await pool.query(`
        SELECT c.id AS company_id, c.trial_ends_at,
               CEIL(EXTRACT(EPOCH FROM (c.trial_ends_at - NOW())) / 86400)::int AS days_left
        FROM companies c
        WHERE c.trial_ends_at IS NOT NULL
          AND c.trial_ends_at > NOW()
          AND c.trial_ends_at <= NOW() + make_interval(days => $1)
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.company_id = c.id
              AND s.status = 'active'
              AND (s.cancel_at_period_end = false OR s.cancel_at_period_end IS NULL)
          )
      `, [trialWarnDays]);

      for (const comp of companies) {
        const { rows: [existing] } = await pool.query(`
          SELECT id FROM notifications
          WHERE company_id = $1
            AND type = 'trial_warning'
            AND created_at >= NOW() - make_interval(hours => $2)
          LIMIT 1
        `, [comp.company_id, dedupHours]);
        if (existing) continue;

        // Şirketin admin kullanıcılarına bildirim ekle
        const { rows: admins } = await pool.query(
          `SELECT id FROM users WHERE company_id = $1 AND is_company_admin = true AND is_active = true`,
          [comp.company_id]
        );
        for (const admin of admins) {
          await pool.query(`
            INSERT INTO notifications (user_id, company_id, type, title, message, meta)
            VALUES ($1, $2, 'trial_warning', $3, $4, $5)
          `, [
            admin.id,
            comp.company_id,
            'Deneme süreniz sona eriyor',
            `${comp.days_left} gün sonra deneme süreniz bitiyor. Kesintisiz kullanmak için abonelik başlatın.`,
            JSON.stringify({ action_url: '/pricing', days_left: comp.days_left }),
          ]);
        }
        console.log(`⏰ Trial uyarı bildirimi gönderildi: company_id=${comp.company_id} days_left=${comp.days_left}`);
      }
    } catch (err) {
      console.error('Trial cron hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Her sabah 08:00 — Meta/LinkedIn token expiry kontrolü
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Cron: token expiry kontrolü...');
    try {
      await checkExpiringTokens();
    } catch (err) {
      console.error('Token expiry cron hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  // 07:00-23:00 arası her 2 saatte bir gün içi metrik güncellemesi
  cron.schedule('0 7-23/2 * * *', async () => {
    console.log('⏰ Cron: gün içi metrik güncelleme başladı...');
    try {
      await fetchTodayMetrics();
    } catch (err) {
      console.error('Gün içi cron hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Campaign anomaly checks — daily at 10:00
  cron.schedule('0 10 * * *', async () => {
    const { detectCampaignAnomalies } = require('../services/anomalyDetector');
    try {
      const { rows: companies } = await pool.query(
        "SELECT DISTINCT brand_id AS id FROM campaigns WHERE status = 'active' AND end_date >= CURRENT_DATE"
      );
      for (const c of companies) {
        await detectCampaignAnomalies(c.id).catch(err => console.error('[Kampanya anomali]', c.id, err.message));
      }
    } catch (err) {
      console.error('[Kampanya anomali cron]', err.message);
    }
  });

  console.log('⏰ Cron jobs aktif (02:00 gece sync, 08:00 token expiry, 09:00 trial uyarı, 07-23/2h gün içi)');
}

module.exports = { startCronJobs };
