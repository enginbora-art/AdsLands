const cron = require('node-cron');
const { fetchYesterdayMetrics } = require('../services/metricsFetcher');

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

  console.log('⏰ Cron jobs aktif (her gece 02:00 metrik çekimi)');
}

module.exports = { startCronJobs };
