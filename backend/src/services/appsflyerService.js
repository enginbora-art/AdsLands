const axios = require('axios');

const BASE = 'https://hq1.appsflyer.com/api';

function dateStr(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function getAppName(apiToken, appId) {
  try {
    const resp = await axios.get(`${BASE}/reports/v5/${appId}/daily_report/v5`, {
      params: { api_token: apiToken, from: dateStr(1), to: dateStr(1), groupings: 'app_id' },
      timeout: 8000,
    });
    return resp.data?.[0]?.['App Name'] || appId;
  } catch {
    return appId;
  }
}

async function getCampaignReport(apiToken, appId) {
  const resp = await axios.get(`${BASE}/reports/v5/${appId}/daily_report/v5`, {
    params: {
      api_token: apiToken,
      from: dateStr(30),
      to: dateStr(0),
      groupings: 'date,campaign',
    },
    timeout: 15000,
  });
  return resp.data || [];
}

async function getAppsflyerMetrics(apiToken, appId, fromDate, toDate) {
  const resp = await axios.get(`${BASE}/reports/v5/${appId}/daily_report/v5`, {
    params: { api_token: apiToken, from: fromDate, to: toDate, groupings: 'date' },
    timeout: 10000,
  });
  const rows = resp.data || [];
  const byDate = {};
  for (const r of rows) {
    const date = r['Date'] || r.date;
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date, spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
    byDate[date].spend += parseFloat(r['Cost'] || r.cost || 0);
    byDate[date].impressions += parseInt(r['Impressions'] || r.impressions || 0);
    byDate[date].clicks += parseInt(r['Clicks'] || r.clicks || 0);
    byDate[date].conversions += parseInt(r['Installs'] || r.installs || 0);
  }
  const rows2 = Object.values(byDate);
  for (const row of rows2) {
    row.roas = row.spend > 0 ? Math.round((row.conversions * 150) / row.spend * 100) / 100 : 0;
  }
  if (rows2.length === 1) return rows2[0];
  return rows2[0] || { date: fromDate, spend: 0, impressions: 0, clicks: 0, conversions: 0, roas: 0 };
}

async function validateToken(apiToken, appId) {
  try {
    await axios.get(`${BASE}/reports/v5/${appId}/daily_report/v5`, {
      params: { api_token: apiToken, from: dateStr(1), to: dateStr(1) },
      timeout: 8000,
    });
    return { valid: true };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401 || status === 403) return { valid: false, error: 'Geçersiz API token veya uygulama izni yok.' };
    if (status === 404) return { valid: false, error: 'Uygulama ID bulunamadı.' };
    return { valid: false, error: err.message };
  }
}

module.exports = { getAppName, getCampaignReport, getAppsflyerMetrics, validateToken };
