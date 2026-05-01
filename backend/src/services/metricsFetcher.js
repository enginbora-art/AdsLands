const pool = require('../db');
const getPlatformService = require('./platforms');
const { detectAndHandle } = require('./anomalyDetector');

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
  const svc = getPlatformService(integration.platform);
  const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;

  for (let i = 30; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const metric = svc.generateMetric(dateStr, seed);
    await saveMetric(integration.id, metric);
  }
}

async function fetchYesterdayMetrics() {
  const integrations = await pool.query(
    "SELECT * FROM integrations WHERE is_active = true"
  );

  for (const integration of integrations.rows) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const svc = getPlatformService(integration.platform);
      const metric = await svc.fetchDailyMetrics(integration, dateStr);
      await saveMetric(integration.id, metric);
      await detectAndHandle(integration);
    } catch (err) {
      console.error(`Metrik çekme hatası (${integration.platform}):`, err.message);
    }
  }

  console.log(`✅ ${integrations.rows.length} entegrasyon için metrikler güncellendi.`);
}

async function fetchTodayMetrics(companyId) {
  const query = companyId
    ? 'SELECT * FROM integrations WHERE is_active = true AND company_id = $1'
    : 'SELECT * FROM integrations WHERE is_active = true';
  const params = companyId ? [companyId] : [];
  const integrations = await pool.query(query, params);

  for (const integration of integrations.rows) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const svc = getPlatformService(integration.platform);
      const metric = await svc.fetchDailyMetrics(integration, today);
      await saveMetric(integration.id, metric);
      await detectAndHandle(integration, true);
    } catch (err) {
      console.error(`Gün içi metrik hatası (${integration.platform}):`, err.message);
    }
  }

  console.log(`✅ ${integrations.rows.length} entegrasyon için gün içi metrikler güncellendi.`);
}

module.exports = { fetchYesterdayMetrics, fetchTodayMetrics, seedHistoricalMetrics, saveMetric };
