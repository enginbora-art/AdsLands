const { google } = require('googleapis');

const PLATFORM_SCOPES = {
  google_analytics: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'openid',
    'email',
    'profile',
  ],
  google_ads: [
    'https://www.googleapis.com/auth/adwords',
    'openid',
    'email',
    'profile',
  ],
};

function createClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(userId, platform) {
  const client = createClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: PLATFORM_SCOPES[platform],
    state: Buffer.from(JSON.stringify({ userId, platform })).toString('base64'),
    prompt: 'consent',
  });
}

async function getTokens(code) {
  const client = createClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function refreshIfNeeded(tokens) {
  if (!tokens.expiry_date || tokens.expiry_date > Date.now() + 60_000) return tokens;
  const client = createClient();
  client.setCredentials(tokens);
  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

async function getAnalyticsProperties(tokens) {
  const fresh = await refreshIfNeeded(tokens);
  const client = createClient();
  client.setCredentials(fresh);
  const admin = google.analyticsadmin({ version: 'v1beta', auth: client });
  const resp = await admin.accountSummaries.list();
  const properties = [];
  for (const account of resp.data.accountSummaries || []) {
    for (const prop of account.propertySummaries || []) {
      properties.push({
        propertyId: prop.property.replace('properties/', ''),
        displayName: prop.displayName,
        accountName: account.displayName,
      });
    }
  }
  return properties;
}

async function getAnalyticsData(tokens, propertyId) {
  const fresh = await refreshIfNeeded(tokens);
  const client = createClient();
  client.setCredentials(fresh);
  const dataApi = google.analyticsdata({ version: 'v1beta', auth: client });

  const resp = await dataApi.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
        { name: 'screenPageViews' },
      ],
      dimensions: [{ name: 'date' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
  });

  return (resp.data.rows || []).map(row => ({
    date: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value || 0),
    users: parseInt(row.metricValues[1].value || 0),
    conversions: parseInt(row.metricValues[2].value || 0),
    revenue: parseFloat(row.metricValues[3].value || 0),
    pageViews: parseInt(row.metricValues[4].value || 0),
  }));
}

async function getUserInfo(tokens) {
  try {
    const fresh = await refreshIfNeeded(tokens);
    const client = createClient();
    client.setCredentials(fresh);
    const { token } = await client.getAccessToken();
    const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    return await resp.json(); // { name, email, given_name, family_name, ... }
  } catch {
    return null;
  }
}

async function getAdsCustomerName(tokens, customerId) {
  try {
    const fresh = await refreshIfNeeded(tokens);
    const client = createClient();
    client.setCredentials(fresh);
    const { token } = await client.getAccessToken();
    const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!devToken || devToken === 'your_developer_token') return null;
    const cleanId = String(customerId).replace(/-/g, '');
    const resp = await fetch(
      `https://googleads.googleapis.com/v18/customers/${cleanId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'developer-token': devToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'SELECT customer.descriptive_name FROM customer LIMIT 1' }),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.results?.[0]?.customer?.descriptiveName || null;
  } catch {
    return null;
  }
}

async function listAdsCustomers(tokens) {
  const fresh = await refreshIfNeeded(tokens);
  const client = createClient();
  client.setCredentials(fresh);
  const { token } = await client.getAccessToken();
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) return [];

  const resp = await fetch(
    'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
    { headers: { Authorization: `Bearer ${token}`, 'developer-token': devToken } }
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.resourceNames || []).map(n => n.replace('customers/', ''));
}

async function getAdsData(tokens, customerId) {
  const fresh = await refreshIfNeeded(tokens);
  const client = createClient();
  client.setCredentials(fresh);
  const { token } = await client.getAccessToken();
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN eksik');

  const cleanId = String(customerId).replace(/-/g, '');
  const resp = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': devToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT segments.date, metrics.cost_micros,
                 metrics.impressions, metrics.clicks, metrics.conversions
          FROM campaign
          WHERE segments.date DURING LAST_30_DAYS
          ORDER BY segments.date
        `,
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Google Ads API hatası (${resp.status})`);
  }

  const data = await resp.json();
  const byDate = {};
  for (const r of data.results || []) {
    const date = r.segments?.date;
    if (!date) continue;
    if (!byDate[date]) byDate[date] = { date, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    byDate[date].spend += parseInt(r.metrics?.costMicros || 0) / 1_000_000;
    byDate[date].impressions += parseInt(r.metrics?.impressions || 0);
    byDate[date].clicks += parseInt(r.metrics?.clicks || 0);
    byDate[date].conversions += parseFloat(r.metrics?.conversions || 0);
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// MCC OAuth URL — ayrı redirect URI + mcc platform state
function getMccAuthUrl(agencyCompanyId) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_MCC_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/adwords', 'openid', 'email', 'profile'],
    state: Buffer.from(JSON.stringify({ companyId: agencyCompanyId, platform: 'mcc' })).toString('base64'),
    prompt: 'consent',
  });
}

async function getMccTokens(code) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_MCC_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI
  );
  const { tokens } = await client.getToken(code);
  return tokens;
}

// MCC altındaki tüm müşteri hesaplarını listele
async function listMccCustomers(tokens) {
  const fresh = await refreshIfNeeded(tokens);
  const client = createClient();
  client.setCredentials(fresh);
  const { token } = await client.getAccessToken();
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken || devToken === 'your_developer_token') return [];

  // Önce erişilebilir tüm müşterileri al
  const listResp = await fetch(
    'https://googleads.googleapis.com/v18/customers:listAccessibleCustomers',
    { headers: { Authorization: `Bearer ${token}`, 'developer-token': devToken } }
  );
  if (!listResp.ok) return [];
  const listData = await listResp.json();
  const customerIds = (listData.resourceNames || []).map(n => n.replace('customers/', ''));

  // Her müşteri için detay al
  const customers = [];
  for (const customerId of customerIds.slice(0, 50)) {
    try {
      const resp = await fetch(
        `https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'developer-token': devToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1',
          }),
        }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const c = data.results?.[0]?.customer;
      if (!c) continue;
      customers.push({
        id: String(c.id),
        name: c.descriptiveName || `Hesap ${c.id}`,
        currency: c.currencyCode || 'TRY',
        isManager: c.manager || false,
      });
    } catch {
      // bu hesabı atla
    }
  }
  return customers;
}

module.exports = {
  getAuthUrl,
  getTokens,
  refreshIfNeeded,
  getAnalyticsProperties,
  getAnalyticsData,
  getAdsData,
  listAdsCustomers,
  getUserInfo,
  getAdsCustomerName,
  getMccAuthUrl,
  getMccTokens,
  listMccCustomers,
};
