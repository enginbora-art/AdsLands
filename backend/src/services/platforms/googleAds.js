function mockVal(date, offset, min, max) {
  const d = new Date(date);
  const h = ((d.getDate() * 17 + d.getMonth() * 31 + offset) % 100) / 100;
  return min + (max - min) * h;
}

function generateMetric(date, seed) {
  const spend = Math.round(mockVal(date, seed, 800, 2200) * 100) / 100;
  const impressions = Math.floor(mockVal(date, seed + 1, 40000, 120000));
  const clicks = Math.floor(impressions * mockVal(date, seed + 2, 0.02, 0.05));
  const conversions = Math.floor(clicks * mockVal(date, seed + 3, 0.04, 0.08));
  const roas = spend > 0 ? Math.round((conversions * 180) / spend * 100) / 100 : 0;
  return { date, spend, impressions, clicks, conversions, roas };
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16) % 100;
    return generateMetric(date, seed);
  },
  async pauseCampaign(integration) {
    console.log(`[MOCK] Google Ads kampanya durduruldu: ${integration.account_id}`);
    return { success: true };
  },
  generateMetric,
};
