const { refreshIfNeeded, createGoogleClient } = require('../googleService');

const GA4_BASE = 'https://analyticsdata.googleapis.com/v1beta';

async function getToken(integration) {
  const tokens = {
    access_token:  integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date:   integration.token_expiry
      ? new Date(integration.token_expiry).getTime()
      : null,
  };
  const fresh = await refreshIfNeeded(tokens, integration.id);
  const client = createGoogleClient();
  client.setCredentials(fresh);
  const { token } = await client.getAccessToken();
  return token;
}

function throwIfAuthError(status, body) {
  if (status === 401 || status === 403) {
    const authErr = new Error('unauthenticated');
    authErr.status = status;
    throw authErr;
  }
  throw new Error(body?.error?.message || `GA4 API hatası (${status})`);
}

module.exports = {
  async fetchDailyMetrics(integration, date) {
    const propertyId = integration.extra?.property_id
                    || integration.extra?.propertyId
                    || integration.account_id;
    if (!propertyId) throw new Error('GA4 property_id bulunamadı — entegrasyonu yeniden bağlayın.');

    const token = await getToken(integration);

    const resp = await fetch(
      `${GA4_BASE}/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: date, endDate: date }],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'conversions' },
            { name: 'totalRevenue' },
          ],
        }),
      }
    );

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throwIfAuthError(resp.status, body);
    }

    const data = await resp.json();
    const row  = data.rows?.[0]?.metricValues || [];

    const sessions    = parseInt(row[0]?.value || 0);
    const users       = parseInt(row[1]?.value || 0);
    const conversions = parseInt(row[2]?.value || 0);
    const revenue     = parseFloat(row[3]?.value || 0);

    return {
      date,
      spend:       0,          // GA4 harcama verisi içermez
      impressions: sessions,   // sessions → impressions alanına map'lendi
      clicks:      users,      // users → clicks alanına map'lendi
      conversions,
      roas:        0,
      revenue,
    };
  },

  async pauseCampaign() {
    return { success: false };
  },

  generateMetric: undefined,
};
