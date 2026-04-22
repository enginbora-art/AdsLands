function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 19 + d.getMonth() * 37 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const sessions = Math.floor(mockVal(date, seed, 800, 4000));
  const users = Math.floor(sessions * mockVal(date, seed + 1, 0.7, 0.9));
  const conversions = Math.floor(sessions * mockVal(date, seed + 2, 0.02, 0.06));
  const revenue = Math.round(conversions * mockVal(date, seed + 3, 120, 300) * 100) / 100;
  return { date, spend: 0, impressions: sessions, clicks: users, conversions, roas: 0, revenue };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  async pauseCampaign() {
    return { success: true };
  },
  generateMetric,
};
