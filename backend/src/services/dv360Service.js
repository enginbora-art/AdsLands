const { refreshIfNeeded, createGoogleClient } = require('./googleService');

const DV360_BASE = 'https://displayvideo.googleapis.com/v3';

async function getToken(tokens, integrationId) {
  const fresh = await refreshIfNeeded(tokens, integrationId);
  const client = createGoogleClient();
  client.setCredentials(fresh);
  const { token } = await client.getAccessToken();
  return { token, fresh };
}

async function withAuthRetry(tokens, integrationId, fn) {
  const { token, fresh } = await getToken(tokens, integrationId);
  return fn(token, fresh);
}

async function listPartners(tokens, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const resp = await fetch(`${DV360_BASE}/partners?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `DV360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.partners || []).map(p => ({
      id: String(p.partnerId),
      name: p.displayName || `Partner ${p.partnerId}`,
    }));
  });
}

async function listAdvertisers(tokens, partnerId, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const url = `${DV360_BASE}/advertisers?partnerId=${partnerId}&pageSize=200&filter=entityStatus%3D"ENTITY_STATUS_ACTIVE"`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `DV360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.advertisers || []).map(a => ({
      id: String(a.advertiserId),
      name: a.displayName || `Advertiser ${a.advertiserId}`,
      partnerId: String(a.partnerId),
    }));
  });
}

async function listAllAdvertisers(tokens, integrationId = null) {
  const partners = await listPartners(tokens, integrationId);
  if (!partners.length) return [];

  const all = [];
  for (const partner of partners.slice(0, 10)) {
    try {
      const advs = await listAdvertisers(tokens, partner.id, integrationId);
      all.push(...advs.map(a => ({ ...a, partnerName: partner.name })));
    } catch {
      // partner erişimi yok, atla
    }
  }
  return all;
}

async function listCampaigns(tokens, advertiserId, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const resp = await fetch(
      `${DV360_BASE}/advertisers/${advertiserId}/campaigns?pageSize=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `DV360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.campaigns || [])
      .filter(c => c.entityStatus !== 'ENTITY_STATUS_ARCHIVED')
      .map(c => ({
        id: String(c.campaignId),
        name: c.displayName || '',
        startDate: c.campaignFlight?.dateRange ? formatDV360Date(c.campaignFlight.dateRange.startDate) : null,
        endDate: c.campaignFlight?.dateRange ? formatDV360Date(c.campaignFlight.dateRange.endDate) : null,
        budget: c.campaignBudgets?.[0]?.budgetAmountMicros
          ? parseInt(c.campaignBudgets[0].budgetAmountMicros) / 1_000_000
          : null,
        status: c.entityStatus || 'UNKNOWN',
      }))
      .filter(c => c.id && c.name);
  });
}

async function getCampaignStats(tokens, advertiserId, campaignId, startDate, endDate, integrationId = null) {
  // DV360 raporları DoubleClick Bid Manager Reporting API üzerinden async çalışır.
  // Şimdilik kampanya objesinden bütçe bilgisini döndür; async rapor akışı ayrı endpoint gerektirir.
  return withAuthRetry(tokens, integrationId, async (token) => {
    const resp = await fetch(
      `${DV360_BASE}/advertisers/${advertiserId}/campaigns/${campaignId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    const c = await resp.json();
    return {
      campaignId: String(c.campaignId),
      name: c.displayName,
      budget: c.campaignBudgets?.[0]?.budgetAmountMicros
        ? parseInt(c.campaignBudgets[0].budgetAmountMicros) / 1_000_000
        : null,
      status: c.entityStatus,
    };
  });
}

function formatDV360Date(dateObj) {
  if (!dateObj) return null;
  if (typeof dateObj === 'string') return dateObj;
  const { year, month, day } = dateObj;
  if (!year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

module.exports = { withAuthRetry, listPartners, listAdvertisers, listAllAdvertisers, listCampaigns, getCampaignStats };
