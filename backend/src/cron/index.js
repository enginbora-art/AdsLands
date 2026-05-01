const cron = require('node-cron');
const pool = require('../db');
const { fetchYesterdayMetrics, fetchTodayMetrics } = require('../services/metricsFetcher');
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.adslands.com';

async function checkExpiringTokens() {
  const { rows: expiring } = await pool.query(`
    SELECT i.id, i.company_id, i.platform, i.token_expiry,
           CEIL(EXTRACT(EPOCH FROM (i.token_expiry - NOW())) / 86400)::int AS days_left
    FROM integrations i
    WHERE i.platform IN ('meta', 'linkedin')
      AND i.is_active = true
      AND i.token_expiry IS NOT NULL
      AND i.token_expiry < NOW() + INTERVAL '7 days'
      AND i.token_expiry > NOW()
  `);

  for (const row of expiring) {
    // Bugün zaten bildirim gönderildiyse atla
    const { rows: [existing] } = await pool.query(`
      SELECT id FROM notifications
      WHERE company_id = $1
        AND type = 'token_expiry_warning'
        AND meta->>'integration_id' = $2
        AND created_at >= NOW() - INTERVAL '20 hours'
      LIMIT 1
    `, [row.company_id, row.id]);
    if (existing) continue;

    const platformLabel = row.platform === 'meta' ? 'Meta Ads' : 'LinkedIn Ads';
    const title   = `${platformLabel} bağlantısının süresi doluyor`;
    const message = `${platformLabel} bağlantınızın süresi ${row.days_left} gün içinde dolacak. Kesintisiz veri akışı için yeniden bağlanın.`;
    const meta    = JSON.stringify({
      action_url:     '/integrations',
      platform:       row.platform,
      integration_id: row.id,
      days_left:      row.days_left,
    });

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

      // E-posta bildirim
      if (process.env.RESEND_API_KEY && admin.email) {
        try {
          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
            to:   admin.email,
            subject: title,
            html: `<p>${message}</p><p><a href="${FRONTEND_URL}/integrations">Yeniden Bağlan →</a></p>`,
          });
        } catch (emailErr) {
          console.error('[cron] Token expiry e-posta hatası:', emailErr.message);
        }
      }
    }

    console.log(`⏰ Token expiry uyarısı: platform=${row.platform} company=${row.company_id} days_left=${row.days_left}`);
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
      // Aktif aboneliği olmayan, trial'ı 7 gün içinde bitecek şirketler
      const { rows: companies } = await pool.query(`
        SELECT c.id AS company_id, c.trial_ends_at,
               CEIL(EXTRACT(EPOCH FROM (c.trial_ends_at - NOW())) / 86400)::int AS days_left
        FROM companies c
        WHERE c.trial_ends_at IS NOT NULL
          AND c.trial_ends_at > NOW()
          AND c.trial_ends_at <= NOW() + INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM subscriptions s
            WHERE s.company_id = c.id
              AND s.status = 'active'
              AND (s.cancel_at_period_end = false OR s.cancel_at_period_end IS NULL)
          )
      `);

      for (const comp of companies) {
        // Bugün zaten bildirim gönderildiyse atla
        const { rows: [existing] } = await pool.query(`
          SELECT id FROM notifications
          WHERE company_id = $1
            AND type = 'trial_warning'
            AND created_at >= NOW() - INTERVAL '20 hours'
          LIMIT 1
        `, [comp.company_id]);
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

  console.log('⏰ Cron jobs aktif (02:00 gece sync, 08:00 token expiry, 09:00 trial uyarı, 07-23/2h gün içi)');
}

module.exports = { startCronJobs };
