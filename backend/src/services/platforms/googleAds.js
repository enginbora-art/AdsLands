const { getAdsDailyMetric } = require('../googleService');

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const customerId = integration.extra?.customer_id
                    || integration.extra?.customerId
                    || integration.account_id;
    if (!customerId) {
      throw new Error('Google Ads müşteri ID bulunamadı — entegrasyonu yeniden bağlayın.');
    }

    const tokens = {
      access_token:  integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date:   integration.token_expiry
        ? new Date(integration.token_expiry).getTime()
        : null,
    };

    return getAdsDailyMetric(tokens, customerId, date, integration.id);
  },
};
