const { refreshIfNeeded, createGoogleClient } = require('./googleService');

const DV360_BASE = 'https://displayvideo.googleapis.com/v3';
const DBM_BASE   = 'https://doubleclickbidmanager.googleapis.com/v2';

// ── Token yardımcıları ────────────────────────────────────────────────────────

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

// ── Partner / Advertiser listeleme ────────────────────────────────────────────

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
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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
      // bu partner'a erişim yok, atla
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
        endDate:   c.campaignFlight?.dateRange ? formatDV360Date(c.campaignFlight.dateRange.endDate)   : null,
        budget: c.campaignBudgets?.[0]?.budgetAmountMicros
          ? parseInt(c.campaignBudgets[0].budgetAmountMicros) / 1_000_000 : null,
        status: c.entityStatus || 'UNKNOWN',
      }))
      .filter(c => c.id && c.name);
  });
}

// ── DBM v2 Reporting API ──────────────────────────────────────────────────────

async function createDbmQuery(token, advertiserId, startDate, endDate, campaignId = null) {
  const filters = [{ type: 'FILTER_ADVERTISER', value: String(advertiserId) }];
  if (campaignId) filters.push({ type: 'FILTER_ADVERTISER_CAMPAIGN', value: String(campaignId) });

  const body = {
    metadata: {
      title: `AdsLands_${advertiserId}_${startDate}_${Date.now()}`,
      dataRange: {
        range: 'CUSTOM_DATES',
        customStartDate: dateToObj(startDate),
        customEndDate:   dateToObj(endDate),
      },
      format: 'CSV',
    },
    params: {
      type: 'STANDARD',
      groupBys: ['FILTER_DATE'],
      filters,
      metrics: [
        'METRIC_REVENUE_ADVERTISER',
        'METRIC_IMPRESSIONS',
        'METRIC_CLICKS',
        'METRIC_TRUEVIEW_VIEWS',
        'METRIC_TRUEVIEW_VIEW_RATE',
      ],
    },
  };

  const resp = await fetch(`${DBM_BASE}/queries`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DBM sorgu oluşturulamadı (${resp.status})`);
  }
  const data = await resp.json();
  return String(data.queryId);
}

async function runDbmQuery(token, queryId) {
  const resp = await fetch(`${DBM_BASE}/queries/${queryId}:run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `DBM sorgu çalıştırılamadı (${resp.status})`);
  }
  const report = await resp.json();
  return String(report.key?.reportId || '');
}

async function pollDbmReport(token, queryId, reportId, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const resp = await fetch(`${DBM_BASE}/queries/${queryId}/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`DBM rapor sorgusu başarısız (${resp.status})`);
    const data = await resp.json();

    const state = data.metadata?.status?.state;
    if (state === 'DONE') {
      const url = data.metadata?.googleCloudStoragePath
               || data.metadata?.reportDownloadUrl
               || data.reportDownloadUrl;
      if (!url) throw new Error('DBM raporu tamamlandı ama indirme URL\'si yok');
      return url;
    }
    if (state === 'FAILED') {
      throw new Error(`DBM raporu başarısız: ${data.metadata?.status?.failure?.errorCode || 'bilinmeyen hata'}`);
    }

    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('DBM raporu zaman aşımına uğradı');
}

async function downloadAndParseCsv(downloadUrl) {
  const resp = await fetch(downloadUrl);
  if (!resp.ok) throw new Error(`DBM CSV indirilemedi (${resp.status})`);
  const text = await resp.text();
  return parseDv360Csv(text);
}

// DV360/DBM CSV formatı:
//   Birkaç satır metadata başlığı → boş satır → sütun başlıkları → veri → boş satır → footer
function parseDv360Csv(csv) {
  const lines = csv.split('\n').map(l => l.trim());

  // Sütun başlıklarını bul: "Date" içeren ve virgülle ayrılmış ilk satır
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.startsWith('"date"') || lower.startsWith('date,') || lower.startsWith('"date,')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const rawHeaders = parseCsvLine(lines[headerIdx]);
  const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  const dateIdx        = headers.findIndex(h => h === 'date');
  const spendIdx       = headers.findIndex(h => h.includes('revenue') || h.includes('spend'));
  const impressionsIdx = headers.findIndex(h => h.includes('impression'));
  const clicksIdx      = headers.findIndex(h => h.includes('click'));
  const viewsIdx       = headers.findIndex(h => h.includes('trueview') && h.includes('view') && !h.includes('rate'));
  const vcrIdx         = headers.findIndex(h => h.includes('view_rate') || h.includes('vcr'));

  const results = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.toLowerCase().startsWith('report') || line.toLowerCase().startsWith('total')) break;

    const cols = parseCsvLine(line);
    if (!cols[dateIdx]) continue;

    const dateStr = parseDv360CsvDate(cols[dateIdx]);
    if (!dateStr) continue;

    results.push({
      date:        dateStr,
      spend:       parseFloat((cols[spendIdx]       || '0').replace(/,/g, '')) || 0,
      impressions: parseInt((cols[impressionsIdx]   || '0').replace(/,/g, ''))  || 0,
      clicks:      parseInt((cols[clicksIdx]        || '0').replace(/,/g, ''))  || 0,
      views:       parseInt((cols[viewsIdx]         || '0').replace(/,/g, ''))  || 0,
      vcr:         parseFloat((cols[vcrIdx]         || '0').replace(/[%,]/g, '')) / 100 || 0,
    });
  }
  return results;
}

// "1,234" veya "1234" veya quoted strings handle et
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

// DBM date: "01/15/2024" → "2024-01-15" veya zaten "2024-01-15"
function parseDv360CsvDate(str) {
  if (!str) return null;
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [m, d, y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function dateToObj(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function formatDV360Date(dateObj) {
  if (!dateObj) return null;
  if (typeof dateObj === 'string') return dateObj;
  const { year, month, day } = dateObj;
  if (!year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── Yüksek seviye API'ler ─────────────────────────────────────────────────────

// Bir advertiser için bir günün metriklerini çek (metricsFetcher cron için)
async function getAdvertiserDailyMetrics(tokens, advertiserId, date, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const queryId  = await createDbmQuery(token, advertiserId, date, date);
    const reportId = await runDbmQuery(token, queryId);
    const url      = await pollDbmReport(token, queryId, reportId, 90_000);
    const rows     = await downloadAndParseCsv(url);

    const row = rows.find(r => r.date === date);
    return {
      date,
      spend:       row?.spend       ?? 0,
      impressions: row?.impressions ?? 0,
      clicks:      row?.clicks      ?? 0,
      conversions: 0,
      roas:        0,
      views:       row?.views       ?? 0,
      vcr:         row?.vcr         ?? 0,
    };
  });
}

// Kampanya istatistikleri — tarih aralığı, günlük breakdown
async function getCampaignStats(tokens, advertiserId, campaignId, startDate, endDate, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const queryId  = await createDbmQuery(token, advertiserId, startDate, endDate, campaignId);
    const reportId = await runDbmQuery(token, queryId);
    const url      = await pollDbmReport(token, queryId, reportId, 90_000);
    return downloadAndParseCsv(url);
  });
}

module.exports = {
  withAuthRetry,
  listPartners,
  listAdvertisers,
  listAllAdvertisers,
  listCampaigns,
  getCampaignStats,
  getAdvertiserDailyMetrics,
};
