function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 17 + d.getMonth() * 31 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const spend = Math.round(mockVal(date, seed, 300, 1200) * 100) / 100;
  const impressions = Math.floor(mockVal(date, seed + 1, 15000, 60000));
  const clicks = Math.floor(impressions * mockVal(date, seed + 2, 0.01, 0.035));
  const conversions = Math.floor(clicks * mockVal(date, seed + 3, 0.04, 0.09));
  const roas = spend > 0 ? Math.round((conversions * 140) / spend * 100) / 100 : 0;
  return { date, spend, impressions, clicks, conversions, roas };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const { getAppsflyerMetrics } = require('../appsflyerService');
    if (integration.access_token && integration.access_token !== 'mock_token') {
      try {
        return await getAppsflyerMetrics(integration.access_token, integration.account_id, date, date);
      } catch {
        // fallthrough to mock
      }
    }
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  generateMetric,
};
