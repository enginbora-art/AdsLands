const { refreshIfNeeded, createGoogleClient } = require('./googleService');

const CM360_BASE = 'https://dfareporting.googleapis.com/dfareporting/v4';

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

// ── User Profiles ─────────────────────────────────────────────────────────────

async function getUserProfiles(tokens, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const resp = await fetch(`${CM360_BASE}/userprofiles`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `CM360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.items || []).map(p => ({
      id: String(p.profileId),
      name: p.userName || `Profile ${p.profileId}`,
      accountId: String(p.accountId),
      accountName: p.accountName || '',
      subAccountId: p.subAccountId ? String(p.subAccountId) : null,
      subAccountName: p.subAccountName || null,
    }));
  });
}

// ── Advertisers ───────────────────────────────────────────────────────────────

async function listAdvertisers(tokens, profileId, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const url = `${CM360_BASE}/userprofiles/${profileId}/advertisers?maxResults=100&active=true`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `CM360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.advertisers || []).map(a => ({
      id: String(a.id),
      name: a.name || `Advertiser ${a.id}`,
      status: a.status,
    }));
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

async function getCampaigns(tokens, profileId, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    const url = `${CM360_BASE}/userprofiles/${profileId}/campaigns?maxResults=100&archived=false`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `CM360 API hatası (${resp.status})`);
    }
    const data = await resp.json();
    return (data.campaigns || []).map(c => ({
      id: String(c.id),
      name: c.name || `Campaign ${c.id}`,
      advertiserId: String(c.advertiserId),
      startDate: c.startDate,
      endDate: c.endDate,
    }));
  });
}

// ── Campaign Stats (async report) ─────────────────────────────────────────────

async function getCampaignStats(tokens, profileId, startDate, endDate, integrationId = null) {
  return withAuthRetry(tokens, integrationId, async (token) => {
    // Step 1: Create report
    const reportBody = {
      name: `AdsLands_${Date.now()}`,
      type: 'STANDARD',
      criteria: {
        dateRange: { startDate, endDate },
        dimensions: [
          { name: 'campaign' },
          { name: 'date' },
        ],
        metricNames: ['impressions', 'clicks', 'totalConversions', 'mediaCost'],
      },
      format: 'CSV',
      delivery: { emailOwner: false },
    };

    const createResp = await fetch(`${CM360_BASE}/userprofiles/${profileId}/reports`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(reportBody),
    });
    if (!createResp.ok) {
      const err = await createResp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `CM360 rapor oluşturma hatası (${createResp.status})`);
    }
    const report = await createResp.json();
    const reportId = report.id;

    // Step 2: Run report
    const runResp = await fetch(`${CM360_BASE}/userprofiles/${profileId}/reports/${reportId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!runResp.ok) {
      const err = await runResp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `CM360 rapor çalıştırma hatası (${runResp.status})`);
    }
    const file = await runResp.json();
    const fileId = file.id;

    // Step 3: Poll until complete (max 90s)
    const deadline = Date.now() + 90_000;
    let fileStatus = null;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000));
      const pollResp = await fetch(
        `${CM360_BASE}/userprofiles/${profileId}/reports/${reportId}/files/${fileId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!pollResp.ok) continue;
      const pollData = await pollResp.json();
      fileStatus = pollData.status;
      if (fileStatus === 'REPORT_AVAILABLE') break;
      if (fileStatus === 'FAILED') throw new Error('CM360 rapor oluşturma başarısız oldu.');
    }
    if (fileStatus !== 'REPORT_AVAILABLE') {
      throw new Error('CM360 rapor zaman aşımına uğradı (90s).');
    }

    // Step 4: Download CSV
    const dlResp = await fetch(
      `${CM360_BASE}/userprofiles/${profileId}/reports/${reportId}/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dlResp.ok) throw new Error(`CM360 rapor indirme hatası (${dlResp.status})`);
    const csv = await dlResp.text();

    return parseCampaignStatsCsv(csv);
  });
}

function parseCampaignStatsCsv(csv) {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex(l => l.toLowerCase().includes('campaign'));
  if (headerIdx === -1) return [];
  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, '_'));
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim().replace(/^"|"$/g, ''); });
    rows.push({
      campaign: row.campaign || '',
      date: row.date || '',
      impressions: parseInt(row.impressions || '0') || 0,
      clicks: parseInt(row.clicks || '0') || 0,
      conversions: parseInt(row.total_conversions || row.totalconversions || '0') || 0,
      spend: parseFloat(row.media_cost || row.mediacost || '0') || 0,
    });
  }
  return rows;
}

module.exports = { getUserProfiles, listAdvertisers, getCampaigns, getCampaignStats, withAuthRetry };
