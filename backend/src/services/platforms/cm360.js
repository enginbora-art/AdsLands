const { getCampaignStats } = require('../cm360Service');

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const profileId = integration.extra?.profile_id
                   || integration.extra?.profileId
                   || integration.account_id;
    if (!profileId) {
      throw new Error('CM360 profile_id bulunamadı — Entegrasyonlar sayfasından profil seçin.');
    }

    const tokens = {
      access_token:  integration.access_token,
      refresh_token: integration.refresh_token,
      expiry_date:   integration.token_expiry
        ? new Date(integration.token_expiry).getTime()
        : null,
    };

    const rows = await getCampaignStats(tokens, profileId, date, date, integration.id);

    let spend = 0, impressions = 0, clicks = 0, conversions = 0;
    for (const row of rows) {
      spend       += row.spend       || 0;
      impressions += row.impressions || 0;
      clicks      += row.clicks      || 0;
      conversions += row.conversions || 0;
    }
    return { date, spend, impressions, clicks, conversions, roas: 0 };
  },
};
