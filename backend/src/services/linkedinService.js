const axios = require('axios');

const AUTH_URL  = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_BASE  = 'https://api.linkedin.com/v2';

function redirectUri() {
  return process.env.LINKEDIN_REDIRECT_URI
    || 'https://api.adslands.com/api/integrations/linkedin/callback';
}

function getLinkedinAuthUrl(companyId, brandId) {
  const state = Buffer.from(JSON.stringify({ companyId, brandId: brandId || null })).toString('base64');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.LINKEDIN_CLIENT_ID || '',
    redirect_uri:  redirectUri(),
    scope:         'r_ads r_ads_reporting',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeToken(code) {
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri(),
    client_id:     process.env.LINKEDIN_CLIENT_ID || '',
    client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
  });
  const { data } = await axios.post(TOKEN_URL, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 12000,
  });
  return { access_token: data.access_token, expires_in: data.expires_in };
}

async function getAdAccounts(accessToken) {
  try {
    const { data } = await axios.get(`${API_BASE}/adAccountsV2`, {
      headers: {
        Authorization:      `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
      },
      params: { q: 'search', 'search.type.values[0]': 'BUSINESS' },
      timeout: 8000,
    });
    return (data.elements || []).map(a => ({
      id:       a.id,
      name:     a.name,
      currency: a.currency,
    }));
  } catch {
    // Mock fallback until Marketing API access is approved
    return [{ id: 'mock_li_001', name: 'LinkedIn Mock Account', currency: 'USD' }];
  }
}

async function getAccountName(accessToken, accountId) {
  try {
    const { data } = await axios.get(`${API_BASE}/adAccountsV2/${accountId}`, {
      headers: {
        Authorization:      `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
      },
      timeout: 6000,
    });
    return data.name || null;
  } catch {
    return null;
  }
}

module.exports = { getLinkedinAuthUrl, exchangeToken, getAdAccounts, getAccountName };
