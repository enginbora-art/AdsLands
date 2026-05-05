const { getAdvertiserDailyMetrics } = require('../dv360Service');

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const advertiserId = integration.extra?.advertiser_id;
    if (!advertiserId) {
      throw new Error('DV360 advertiser_id bulunamadı — Entegrasyonlar sayfasından advertiser seçin.');
    }

    const tokens = {
      access_token:  integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date:   integration.token_expiry
        ? new Date(integration.token_expiry).getTime()
        : null,
    };

    return getAdvertiserDailyMetrics(tokens, advertiserId, date, integration.id);
  },
};
