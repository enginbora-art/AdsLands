const axios = require('axios');

const TOKEN_URL = 'https://id.adform.com/sts/connect/token';
const API_BASE  = 'https://api.adform.com';

async function getToken(username, password) {
  const body = new URLSearchParams({
    grant_type: 'password',
    username,
    password,
    scope:      'buyer.campaigns buyer.stats',
    client_id:  'adform',
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });
  return { access_token: data.access_token, expires_in: data.expires_in || 3600 };
}

async function getAccountName(token, trackingId) {
  try {
    const { data } = await axios.get(`${API_BASE}/v1/buyer/advertisers`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 6000,
    });
    const list = Array.isArray(data) ? data : (data.advertisers || []);
    const match = list.find(a =>
      String(a.trackingSetupId) === String(trackingId) ||
      String(a.id) === String(trackingId)
    );
    return match?.name || null;
  } catch {
    return null;
  }
}

async function validateCredentials(username, password) {
  try {
    const tok = await getToken(username, password);
    return { valid: true, token: tok.access_token };
  } catch (err) {
    const msg = err?.response?.data?.error_description
      || err?.response?.data?.error
      || 'Adform kimlik doğrulama başarısız.';
    return { valid: false, error: msg };
  }
}

async function getCampaignMetrics(token, dateFrom, dateTo) {
  try {
    const { data } = await axios.post(
      `${API_BASE}/v1/buyer/stats/data`,
      {
        filter: { date: { from: dateFrom, to: dateTo } },
        dimensions: [{ type: 'Day' }],
        metrics:    ['Impressions', 'Clicks', 'Cost', 'Conversions'],
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return data;
  } catch {
    return null;
  }
}

module.exports = { getToken, getAccountName, validateCredentials, getCampaignMetrics };
