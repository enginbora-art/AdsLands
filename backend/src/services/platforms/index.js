const googleAds = require('./googleAds');
const meta = require('./meta');
const tiktok = require('./tiktok');
const googleAnalytics = require('./googleAnalytics');

const services = { google_ads: googleAds, meta, tiktok, google_analytics: googleAnalytics };

module.exports = (platform) => {
  const svc = services[platform];
  if (!svc) throw new Error(`Bilinmeyen platform: ${platform}`);
  return svc;
};
