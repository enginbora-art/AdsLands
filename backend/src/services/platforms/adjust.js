function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 19 + d.getMonth() * 37 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const spend = Math.round(mockVal(date, seed, 250, 900) * 100) / 100;
  const impressions = Math.floor(mockVal(date, seed + 1, 10000, 45000));
  const clicks = Math.floor(impressions * mockVal(date, seed + 2, 0.012, 0.04));
  const conversions = Math.floor(clicks * mockVal(date, seed + 3, 0.035, 0.08));
  const roas = spend > 0 ? Math.round((conversions * 130) / spend * 100) / 100 : 0;
  return { date, spend, impressions, clicks, conversions, roas };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const { getAdjustMetrics } = require('../adjustService');
    if (integration.access_token && integration.access_token !== 'mock_token') {
      try {
        return await getAdjustMetrics(integration.access_token, integration.account_id, date, date);
      } catch {
        // fallthrough to mock
      }
    }
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  generateMetric,
};
