const axios = require('axios');

// TikTok auth error codes
const TIKTOK_AUTH_CODES = new Set([40100, 40101, 40102, 40103]);

function throwIfAuthError(err) {
  const status = err.response?.status;
  if (status === 401 || status === 403) {
    const authErr = new Error('invalid_token');
    authErr.status = 401;
    throw authErr;
  }
  throw err;
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const advertiserId = String(
      integration.extra?.advertiser_id || integration.account_id || ''
    );
    if (!advertiserId) throw new Error('TikTok advertiser_id bulunamadı');
    if (!integration.access_token) throw new Error('TikTok access_token bulunamadı');

    let resp;
    try {
      resp = await axios.post(
        'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
        {
          advertiser_id: advertiserId,
          start_date:    date,
          end_date:      date,
          report_type:   'BASIC',
          data_level:    'AUCTION_ADVERTISER',
          dimensions:    ['stat_time_day'],
          metrics:       ['spend', 'impressions', 'clicks', 'conversions', 'total_purchase_value'],
          page_size:     10,
        },
        {
          headers: {
            'Access-Token': integration.access_token,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
    } catch (err) {
      throwIfAuthError(err);
    }

    const body = resp.data;
    if (TIKTOK_AUTH_CODES.has(body?.code)) {
      const authErr = new Error('invalid_token');
      authErr.status = 401;
      throw authErr;
    }
    if (body?.code !== 0) {
      throw new Error(`TikTok API hatası (${body?.code}): ${body?.message || 'bilinmeyen hata'}`);
    }

    const row = body?.data?.list?.[0]?.metrics || {};
    const spend    = parseFloat(row.spend    || 0);
    const convValue = parseFloat(row.total_purchase_value || 0);
    const roas = spend > 0 && convValue > 0
      ? Math.round((convValue / spend) * 100) / 100 : 0;

    return {
      date,
      spend,
      impressions: parseInt(row.impressions  || 0),
      clicks:      parseInt(row.clicks       || 0),
      conversions: parseInt(row.conversions  || 0),
      roas,
    };
  },

  async pauseCampaign(integration) {
    console.log(`[TikTok] pauseCampaign henüz desteklenmiyor: ${integration.account_id}`);
    return { success: false };
  },

  generateMetric: undefined,
};
