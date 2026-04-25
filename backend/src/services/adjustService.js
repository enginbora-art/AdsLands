const axios = require('axios');

const BASE = 'https://api.adjust.com/kpis/v1';

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function getAppName(apiToken, appToken) {
  try {
    const resp = await axios.get(`https://api.adjust.com/accounts/v1/apps/${appToken}`, {
      headers: { Authorization: `Token token=${apiToken}` },
      timeout: 8000,
    });
    return resp.data?.name || appToken;
  } catch {
    return appToken;
  }
}

async function getAdjustMetrics(apiToken, appToken, fromDate, toDate) {
  const resp = await axios.get(`${BASE}/${appToken}`, {
    headers: { Authorization: `Token token=${apiToken}` },
    params: {
      start_date: fromDate,
      end_date: toDate,
      kpis: 'installs,clicks,impressions,cost',
      grouping: 'day',
    },
    timeout: 10000,
  });
  const result = resp.data?.result_set;
  if (!result) return { date: fromDate, spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };

  const totals = result.totals || {};
  const spend = parseFloat(totals.cost || 0);
  const conversions = parseInt(totals.installs || 0);
  return {
    date: fromDate,
    spend,
    impressions: parseInt(totals.impressions || 0),
    clicks: parseInt(totals.clicks || 0),
    conversions,
    roas: spend > 0 ? Math.round((conversions * 130) / spend * 100) / 100 : 0,
  };
}

async function getCampaignReport(apiToken, appToken) {
  const resp = await axios.get(`${BASE}/${appToken}/campaigns`, {
    headers: { Authorization: `Token token=${apiToken}` },
    params: {
      start_date: dateStr(30),
      end_date: dateStr(0),
      kpis: 'installs,clicks,impressions,cost',
    },
    timeout: 15000,
  });
  return resp.data?.result_set?.rows || [];
}

async function validateToken(apiToken, appToken) {
  try {
    await axios.get(`${BASE}/${appToken}`, {
      headers: { Authorization: `Token token=${apiToken}` },
      params: { start_date: dateStr(1), end_date: dateStr(1), kpis: 'installs' },
      timeout: 8000,
    });
    return { valid: true };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) return { valid: false, error: 'Geçersiz API token.' };
    if (status === 404) return { valid: false, error: 'App token bulunamadı.' };
    return { valid: false, error: err.message };
  }
}

module.exports = { getAppName, getAdjustMetrics, getCampaignReport, validateToken };
