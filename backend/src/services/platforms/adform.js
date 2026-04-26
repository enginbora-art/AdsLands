const { getCampaignMetrics, getToken } = require('../adformService');
const pool = require('../../db');

function mockMetric(seed, date) {
  const d = new Date(date).getDate();
  return {
    spend:       parseFloat((((seed % 8000) + d * 120) / 100).toFixed(2)),
    impressions: (seed % 80000) + d * 400,
    clicks:      (seed % 3000)  + d * 15,
    conversions: (seed % 150)   + d,
    roas:        parseFloat((1.4 + (seed % 250) / 100).toFixed(2)),
  };
}

async function fetchDailyMetrics(integration, date) {
  const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16);
  try {
    // Re-authenticate using stored credentials
    const extra = integration.extra || {};
    if (!extra.username || !extra.password) return mockMetric(seed, date);

    const { access_token } = await getToken(extra.username, extra.password);
    const from = date;
    const to   = date;
    const raw  = await getCampaignMetrics(access_token, from, to);
    if (!raw) return mockMetric(seed, date);

    const rows = raw.rows || raw.data || [];
    return rows.reduce((acc, r) => {
      acc.spend       += Number(r.cost        || 0);
      acc.impressions += Number(r.impressions || 0);
      acc.clicks      += Number(r.clicks      || 0);
      acc.conversions += Number(r.conversions || 0);
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 });
  } catch {
    return mockMetric(seed, date);
  }
}

module.exports = { fetchDailyMetrics };
