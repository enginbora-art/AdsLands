function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 13 + d.getMonth() * 29 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const spend = Math.round(mockVal(date, seed, 500, 1500) * 100) / 100;
  const impressions = Math.floor(mockVal(date, seed + 1, 25000, 80000));
  const clicks = Math.floor(impressions * mockVal(date, seed + 2, 0.015, 0.04));
  const conversions = Math.floor(clicks * mockVal(date, seed + 3, 0.03, 0.07));
  const roas = spend > 0 ? Math.round((conversions * 160) / spend * 100) / 100 : 0;
  return { date, spend, impressions, clicks, conversions, roas };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  async pauseCampaign(integration) {
    console.log(`[MOCK] Meta Ads kampanya durduruldu: ${integration.account_id}`);
    return { success: true };
  },
  generateMetric,
};
