function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 17 + d.getMonth() * 31 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const impressions = Math.floor(mockVal(date, seed + 1, 80000, 400000));
  const clicks      = Math.floor(impressions * mockVal(date, seed + 2, 0.003, 0.008));
  const conversions = Math.floor(clicks * mockVal(date, seed + 3, 0.02, 0.05));
  const spend       = Math.round(mockVal(date, seed, 2000, 8000) * 100) / 100;
  const roas        = spend > 0 ? Math.round((conversions * 200) / spend * 100) / 100 : 0;
  return { date, spend, impressions, clicks, conversions, roas };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  generateMetric,
};
