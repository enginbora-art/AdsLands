const GRAPH = 'https://graph.facebook.com/v20.0';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function getMetaBmAuthUrl(agencyCompanyId) {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/metabm/callback`;
  const state = Buffer.from(JSON.stringify({ companyId: agencyCompanyId })).toString('base64');
  const scope = 'business_management,ads_management,ads_read';
  return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&response_type=code`;
}

async function exchangeMetaToken(code) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/metabm/callback`;

  const resp = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Meta token alınamadı.');
  }
  const data = await resp.json();
  return data.access_token;
}

async function listAdAccounts(accessToken) {
  const resp = await fetch(
    `${GRAPH}/me/adaccounts?fields=id,name,currency,account_status,business&access_token=${accessToken}&limit=100`
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Ad account listesi alınamadı.');
  }
  const data = await resp.json();
  return (data.data || []).map(a => ({
    id: a.id,
    name: a.name,
    currency: a.currency || 'TRY',
    status: a.account_status === 1 ? 'active' : 'inactive',
    businessName: a.business?.name || null,
  }));
}

async function getUserName(accessToken) {
  try {
    const resp = await fetch(`${GRAPH}/me?fields=name,email&access_token=${accessToken}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.name || data.email || null;
  } catch {
    return null;
  }
}

module.exports = { getMetaBmAuthUrl, exchangeMetaToken, listAdAccounts, getUserName };
