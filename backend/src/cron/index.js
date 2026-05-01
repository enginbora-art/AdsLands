const cron = require('node-cron');
const pool = require('../db');
const { fetchYesterdayMetrics, fetchTodayMetrics } = require('../services/metricsFetcher');

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

  // 07:00-23:00 arası her 2 saatte bir gün içi metrik güncellemesi
  cron.schedule('0 7-23/2 * * *', async () => {
    console.log('⏰ Cron: gün içi metrik güncelleme başladı...');
    try {
      await fetchTodayMetrics();
    } catch (err) {
      console.error('Gün içi cron hatası:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  console.log('⏰ Cron jobs aktif (02:00 gece sync, 09:00 trial uyarı, 07-23/2h gün içi)');
}

module.exports = { startCronJobs };
