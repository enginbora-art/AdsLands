const googleAds = require('./googleAds');
const meta = require('./meta');
const tiktok = require('./tiktok');
const googleAnalytics = require('./googleAnalytics');
const appsflyer = require('./appsflyer');
const adjust = require('./adjust');
const adform = require('./adform');
const linkedin = require('./linkedin');

const services = { google_ads: googleAds, meta, tiktok, google_analytics: googleAnalytics, appsflyer, adjust, adform, linkedin };

module.exports = (platform) => {
  const svc = services[platform];
  if (!svc) throw new Error(`Bilinmeyen platform: ${platform}`);
  return svc;
};
