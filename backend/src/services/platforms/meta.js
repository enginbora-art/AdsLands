const axios = require('axios');

function findAction(list, type) {
  return parseFloat((list || []).find(a => a.action_type === type)?.value || 0);
}

function throwIfAuthError(err) {
  const status = err.response?.status;
  const fbCode = err.response?.data?.error?.code;
  // Facebook: 190 = invalid/expired token, 102 = session key invalid
  if (status === 401 || status === 403 || fbCode === 190 || fbCode === 102) {
    const authErr = new Error('invalid_token');
    authErr.status = 401;
    throw authErr;
  }
  throw err;
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const rawId = String(integration.account_id || '').replace(/^act_/, '');
    if (!rawId) throw new Error('Meta account_id bulunamadı');
    if (!integration.access_token) throw new Error('Meta access_token bulunamadı');

    let resp;
    try {
      resp = await axios.get(
        `https://graph.facebook.com/v19.0/act_${rawId}/insights`,
        {
          params: {
            access_token: integration.access_token,
            time_range: JSON.stringify({ since: date, until: date }),
            fields: 'spend,impressions,clicks,actions,action_values',
            level: 'account',
          },
          timeout: 15000,
        }
      );
    } catch (err) {
      throwIfAuthError(err);
    }

    const row = resp.data?.data?.[0] || {};
    const spend = parseFloat(row.spend || 0);

    const purchases = findAction(row.actions, 'offsite_conversion.fb_pixel_purchase')
                   || findAction(row.actions, 'purchase');
    const convValue = findAction(row.action_values, 'offsite_conversion.fb_pixel_purchase')
                   || findAction(row.action_values, 'purchase');

    const roas = spend > 0 && convValue > 0
      ? Math.round((convValue / spend) * 100) / 100 : 0;

    return {
      date,
      spend,
      impressions: parseInt(row.impressions || 0),
      clicks:      parseInt(row.clicks      || 0),
      conversions: Math.round(purchases),
      roas,
    };
  },

  async pauseCampaign(integration) {
    console.log(`[Meta] pauseCampaign henüz desteklenmiyor: ${integration.account_id}`);
    return { success: false };
  },

  generateMetric: undefined,
};
