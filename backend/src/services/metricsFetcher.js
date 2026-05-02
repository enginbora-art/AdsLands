const pool = require('../db');
const getPlatformService = require('./platforms');
const { detectAndHandle } = require('./anomalyDetector');
const { validateAndNormalize } = require('./metricNormalizer');
const { decryptIntegration } = require('./tokenEncryption');
const { callWithRetry } = require('./platformQueue');
const { ACTIVE_INTEGRATIONS_SQL } = require('./subscriptionService');

async function saveMetric(integrationId, metric) {
  await pool.query(
    `INSERT INTO ad_metrics (integration_id, date, spend, impressions, clicks, conversions, roas)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (integration_id, date) DO UPDATE
     SET spend = EXCLUDED.spend, impressions = EXCLUDED.impressions,
         clicks = EXCLUDED.clicks, conversions = EXCLUDED.conversions, roas = EXCLUDED.roas,
         updated_at = NOW()`,
    [integrationId, metric.date, metric.spend, metric.impressions, metric.clicks, metric.conversions, metric.roas]
  );
}

async function seedHistoricalMetrics(integration) {
  const decrypted = decryptIntegration(integration);
  const svc  = getPlatformService(decrypted.platform);
  const seed = parseInt(decrypted.id.replace(/-/g, '').slice(0, 8), 16) % 100;

  for (let i = 30; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    try {
      const raw    = svc.generateMetric(dateStr, seed);
      const metric = validateAndNormalize(decrypted.platform, raw);
      await saveMetric(decrypted.id, metric);
    } catch (err) {
      console.error(`[Normalizer] Hata (${decrypted.platform}, ${dateStr}):`, err.message);
    }
  }
}

async function fetchYesterdayMetrics() {
  const integrations = await pool.query(ACTIVE_INTEGRATIONS_SQL(false));

  for (const integration of integrations.rows) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr    = yesterday.toISOString().split('T')[0];
      const decrypted  = decryptIntegration(integration);
      const svc        = getPlatformService(decrypted.platform);
      const raw        = await callWithRetry(decrypted.platform, () => svc.fetchDailyMetrics(decrypted, dateStr));
      const metric     = validateAndNormalize(decrypted.platform, raw);
      await saveMetric(decrypted.id, metric);
      await detectAndHandle(decrypted);
    } catch (err) {
      console.error(`[Normalizer] Hata (${integration.platform}):`, err.message);
    }
  }

  console.log(`✅ ${integrations.rows.length} aktif entegrasyon için metrikler güncellendi.`);
}

async function fetchTodayMetrics(companyId) {
  const integrations = await pool.query(
    ACTIVE_INTEGRATIONS_SQL(!!companyId),
    companyId ? [companyId] : []
  );

  for (const integration of integrations.rows) {
    try {
      const today     = new Date().toISOString().split('T')[0];
      const decrypted = decryptIntegration(integration);
      const svc       = getPlatformService(decrypted.platform);
      const raw       = await callWithRetry(decrypted.platform, () => svc.fetchDailyMetrics(decrypted, today));
      const metric    = validateAndNormalize(decrypted.platform, raw);
      await saveMetric(decrypted.id, metric);
      await detectAndHandle(decrypted, true);
    } catch (err) {
      console.error(`[Normalizer] Hata (${integration.platform}):`, err.message);
    }
  }

  console.log(`✅ ${integrations.rows.length} aktif entegrasyon için gün içi metrikler güncellendi.`);
}

module.exports = { fetchYesterdayMetrics, fetchTodayMetrics, seedHistoricalMetrics, saveMetric };
