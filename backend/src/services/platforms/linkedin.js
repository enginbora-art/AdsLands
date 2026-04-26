// LinkedIn Marketing API access requires app review.
// Using mock data until approval is granted.

function mockMetric(seed, date) {
  const d = new Date(date).getDate();
  return {
    spend:       parseFloat((((seed % 6000) + d * 90) / 100).toFixed(2)),
    impressions: (seed % 50000) + d * 300,
    clicks:      (seed % 2000)  + d * 10,
    conversions: (seed % 100)   + Math.floor(d / 2),
    roas:        parseFloat((1.2 + (seed % 200) / 100).toFixed(2)),
  };
}

async function fetchDailyMetrics(integration, date) {
  const seed = parseInt(integration.id.replace(/-/g, '').slice(0, 8), 16);
  return mockMetric(seed, date);
}

module.exports = { fetchDailyMetrics };
