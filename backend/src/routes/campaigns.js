const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');
const { checkAiLimit, logAiUsage } = require('../middleware/aiLimit');

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};

async function logCampaignAction(user, campaignId, brandCompanyId, action, campaignName, platform, newValue) {
  try {
    await pool.query(
      `INSERT INTO campaign_logs
         (campaign_id, user_id, brand_company_id, actor_company_id, action, campaign_name, platform, new_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [campaignId, user.id, brandCompanyId, user.company_id,
       action, campaignName, platform || null,
       newValue != null ? JSON.stringify(newValue) : null]
    );
  } catch (e) { console.error('[campaign_logs]', e.message); }
}

function stringSimilarity(s1, s2) {
  const a = (s1 || '').toLowerCase().trim();
  const b = (s2 || '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const wordsA = new Set(a.split(/[\s\-_]+/).filter(Boolean));
  const wordsB = new Set(b.split(/[\s\-_]+/).filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

function scoreCandidate(campaign, candidate) {
  const nameSim = stringSimilarity(campaign.name, candidate.name);

  const campaignBudget  = parseFloat(campaign.total_budget) || 0;
  const candidateBudget = parseFloat(candidate.budget)      || 0;
  let budgetScore = 0;
  if (campaignBudget > 0 && candidateBudget > 0) {
    const diff = Math.abs(campaignBudget - candidateBudget) / Math.max(campaignBudget, candidateBudget);
    budgetScore = Math.max(0, 1 - diff * 2);
  }

  let dateScore = 0;
  if (campaign.start_date && campaign.end_date && candidate.startDate && candidate.endDate) {
    const cs = new Date(campaign.start_date).getTime();
    const ce = new Date(campaign.end_date).getTime();
    const ds = new Date(candidate.startDate).getTime();
    const de = new Date(candidate.endDate).getTime();
    const overlapStart = Math.max(cs, ds);
    const overlapEnd   = Math.min(ce, de);
    if (overlapEnd > overlapStart) {
      const overlapDays  = (overlapEnd - overlapStart) / 86400000;
      const campaignDays = Math.max((ce - cs) / 86400000, 1);
      dateScore = Math.min(1, overlapDays / campaignDays);
    }
  }

  return nameSim * 0.5 + budgetScore * 0.3 + dateScore * 0.2;
}

async function resolveCompanyId(user, brand_id) {
  if (user.company_type === 'agency' && brand_id) {
    const { rows } = await pool.query(
      'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
      [user.company_id, brand_id]
    );
    if (!rows.length) throw { status: 403, message: 'Bu markaya erişim yok.' };
    return brand_id;
  }
  return user.company_id;
}

async function autoUpdateStatus(campaignId) {
  const { rows: [c] } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!c) return;
  const now = new Date();
  const { rows: [{ count }] } = await pool.query(
    'SELECT COUNT(*) FROM campaign_channels WHERE campaign_id = $1', [campaignId]
  );
  let newStatus = c.status;
  if (new Date(c.end_date) < now) newStatus = 'completed';
  else if (parseInt(count) === 0) newStatus = 'draft';
  else newStatus = 'active';
  if (newStatus !== c.status) {
    await pool.query('UPDATE campaigns SET status = $1 WHERE id = $2', [newStatus, campaignId]);
  }
  return newStatus;
}

// Campaign metrics subquery helper
function campaignMetricsSubquery(alias) {
  return `
    (SELECT
      COALESCE(SUM(m.spend), 0)::float AS total_spend,
      COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
      COALESCE(SUM(m.conversions), 0)::int AS total_conversions
    FROM campaign_channels cc
    JOIN integrations i ON i.company_id = ${alias}.brand_id AND i.platform = cc.platform AND i.is_active = true
    JOIN ad_metrics m ON m.integration_id = i.id
      AND m.date >= ${alias}.start_date AND m.date <= LEAST(${alias}.end_date, CURRENT_DATE)
    WHERE cc.campaign_id = ${alias}.id)
  `;
}

// GET /api/campaigns
router.get('/', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { brand_id, status } = req.query;
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const params = [companyId];
    const statusClause = status ? `AND c.status = $${params.push(status)}` : '';

    const { rows } = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM campaign_channels cc WHERE cc.campaign_id = c.id)::int AS channel_count,
        COALESCE((
          SELECT SUM(m.spend) FROM campaign_channels cc
          JOIN integrations i ON i.company_id = c.brand_id AND i.platform = cc.platform AND i.is_active = true
          JOIN ad_metrics m ON m.integration_id = i.id AND m.date >= c.start_date AND m.date <= LEAST(c.end_date, CURRENT_DATE)
          WHERE cc.campaign_id = c.id
        ), 0)::float AS total_spend,
        COALESCE((
          SELECT AVG(NULLIF(m.roas, 0)) FROM campaign_channels cc
          JOIN integrations i ON i.company_id = c.brand_id AND i.platform = cc.platform AND i.is_active = true
          JOIN ad_metrics m ON m.integration_id = i.id AND m.date >= c.start_date AND m.date <= LEAST(c.end_date, CURRENT_DATE)
          WHERE cc.campaign_id = c.id
        ), 0)::float AS avg_roas,
        COALESCE((
          SELECT SUM(m.conversions) FROM campaign_channels cc
          JOIN integrations i ON i.company_id = c.brand_id AND i.platform = cc.platform AND i.is_active = true
          JOIN ad_metrics m ON m.integration_id = i.id AND m.date >= c.start_date AND m.date <= LEAST(c.end_date, CURRENT_DATE)
          WHERE cc.campaign_id = c.id
        ), 0)::int AS total_conversions,
        EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.company_id = c.brand_id AND n.type LIKE 'campaign_%' AND n.is_read = false
            AND (n.meta->>'campaign_id')::text = c.id::text
            AND n.created_at >= NOW() - INTERVAL '7 days'
        ) AS has_anomaly
      FROM campaigns c
      WHERE c.brand_id = $1 ${statusClause}
      ORDER BY
        CASE c.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
        c.created_at DESC
    `, params);

    // Auto-update statuses
    const now = new Date();
    for (const c of rows) {
      let expectedStatus = c.status;
      if (new Date(c.end_date) < now) expectedStatus = 'completed';
      else if (c.channel_count === 0) expectedStatus = 'draft';
      else expectedStatus = 'active';
      if (expectedStatus !== c.status) {
        c.status = expectedStatus;
        pool.query('UPDATE campaigns SET status = $1 WHERE id = $2', [expectedStatus, c.id]).catch(() => {});
      }
    }

    res.json(rows);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[campaigns GET /]', err);
    res.status(500).json({ error: 'Kampanyalar yüklenemedi.' });
  }
});

// POST /api/campaigns
router.post('/', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { name, total_budget, start_date, end_date, brand_id } = req.body;
  if (!name || !total_budget || !start_date || !end_date) {
    return res.status(400).json({ error: 'Ad, bütçe, başlangıç ve bitiş tarihi zorunludur.' });
  }
  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ error: 'Bitiş tarihi başlangıçtan sonra olmalıdır.' });
  }
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const { rows: [campaign] } = await pool.query(`
      INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, status, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING *
    `, [companyId, name.trim(), total_budget, start_date, end_date, req.user.id]);
    logCampaignAction(req.user, campaign.id, companyId, 'campaign_created', campaign.name, null,
      { total_budget: Number(total_budget), start_date, end_date });
    res.status(201).json(campaign);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[campaigns POST /]', err);
    res.status(500).json({ error: 'Kampanya oluşturulamadı.' });
  }
});

// GET /api/campaigns/:id
router.get('/:id', authMiddleware, requireActiveSubscription, async (req, res) => {
  try {
    const { rows: [campaign] } = await pool.query(`
      SELECT c.* FROM campaigns c
      WHERE c.id = $1 AND (
        c.brand_id = $2
        OR EXISTS (SELECT 1 FROM connections WHERE agency_company_id = $2 AND brand_company_id = c.brand_id)
      )
    `, [req.params.id, req.user.company_id]);
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: channels } = await pool.query(
      'SELECT * FROM campaign_channels WHERE campaign_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    const channelsWithMetrics = await Promise.all(channels.map(async (ch) => {
      const { rows: [m] } = await pool.query(`
        SELECT
          COALESCE(SUM(m.spend), 0)::float AS spend,
          COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS roas,
          COALESCE(SUM(m.conversions), 0)::int AS conversions,
          COALESCE(SUM(m.clicks), 0)::int AS clicks
        FROM integrations i
        JOIN ad_metrics m ON m.integration_id = i.id
          AND m.date >= $3 AND m.date <= LEAST($4::date, CURRENT_DATE)
        WHERE i.company_id = $1 AND i.platform = $2 AND i.is_active = true
      `, [campaign.brand_id, ch.platform, campaign.start_date, campaign.end_date]);
      return { ...ch, metrics: m };
    }));

    const { rows: [totals] } = await pool.query(`
      SELECT
        COALESCE(SUM(m.spend), 0)::float AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int AS total_conversions
      FROM campaign_channels cc
      JOIN integrations i ON i.company_id = $1 AND i.platform = cc.platform AND i.is_active = true
      JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= $2 AND m.date <= LEAST($3::date, CURRENT_DATE)
      WHERE cc.campaign_id = $4
    `, [campaign.brand_id, campaign.start_date, campaign.end_date, req.params.id]);

    const now = new Date();
    const endDate = new Date(campaign.end_date);
    const startDate = new Date(campaign.start_date);
    const totalDays = Math.max(Math.ceil((endDate - startDate) / 86400000), 1);
    const daysRemaining = Math.max(Math.ceil((endDate - now) / 86400000), 0);
    const budgetUsedPct = campaign.total_budget > 0 ? Math.round((totals.total_spend / campaign.total_budget) * 1000) / 10 : 0;

    res.json({
      ...campaign,
      channels: channelsWithMetrics,
      ...totals,
      budget_used_pct: budgetUsedPct,
      days_remaining: daysRemaining,
      total_days: totalDays,
    });
  } catch (err) {
    console.error('[campaigns GET /:id]', err);
    res.status(500).json({ error: 'Kampanya yüklenemedi.' });
  }
});

// PUT /api/campaigns/:id
router.put('/:id', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { name, total_budget, start_date, end_date } = req.body;
  try {
    const { rows: [c] } = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    if (c.status === 'completed') return res.status(400).json({ error: 'Tamamlanmış kampanya düzenlenemez.' });

    const { rows: [updated] } = await pool.query(`
      UPDATE campaigns
      SET name = COALESCE($1, name),
          total_budget = COALESCE($2, total_budget),
          start_date = COALESCE($3, start_date),
          end_date = COALESCE($4, end_date)
      WHERE id = $5 RETURNING *
    `, [name?.trim() || null, total_budget || null, start_date || null, end_date || null, req.params.id]);
    logCampaignAction(req.user, updated.id, updated.brand_id, 'campaign_updated', updated.name, null,
      { total_budget: Number(updated.total_budget), start_date: updated.start_date, end_date: updated.end_date });
    res.json(updated);
  } catch (err) {
    console.error('[campaigns PUT /:id]', err);
    res.status(500).json({ error: 'Kampanya güncellenemedi.' });
  }
});

// DELETE /api/campaigns/:id  — only draft (no channels) campaigns may be deleted
router.delete('/:id', authMiddleware, requireActiveSubscription, async (req, res) => {
  try {
    const { rows: [c] } = await pool.query(
      'SELECT id, name, brand_id, status FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    if (c.status !== 'draft') {
      return res.status(403).json({ error: 'Yalnızca kanal bağlanmamış (taslak) kampanyalar silinebilir.' });
    }
    await pool.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    logCampaignAction(req.user, null, c.brand_id, 'campaign_deleted', c.name, null, null);
    res.json({ success: true });
  } catch (err) {
    console.error('[campaigns DELETE /:id]', err);
    res.status(500).json({ error: 'Kampanya silinemedi.' });
  }
});

// POST /api/campaigns/:id/channels  (also used for updating via upsert)
router.post('/:id/channels', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { platform, external_campaign_id, external_campaign_name, allocated_budget, kpi } = req.body;
  if (!platform) return res.status(400).json({ error: 'Platform gerekli.' });
  try {
    const companyId = req.user.company_type === 'agency' ? req.body.brand_id || req.user.company_id : req.user.company_id;
    const { rows: [c] } = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, companyId]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: [existingCh] } = await pool.query(
      'SELECT id FROM campaign_channels WHERE campaign_id = $1 AND platform = $2',
      [req.params.id, platform]
    );
    const isChannelUpdate = !!existingCh;

    const { rows: [channel] } = await pool.query(`
      INSERT INTO campaign_channels
        (campaign_id, platform, external_campaign_id, external_campaign_name, allocated_budget,
         kpi_roas, kpi_cpa, kpi_ctr, kpi_impression, kpi_conversion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (campaign_id, platform) DO UPDATE
        SET external_campaign_id   = EXCLUDED.external_campaign_id,
            external_campaign_name = EXCLUDED.external_campaign_name,
            allocated_budget       = EXCLUDED.allocated_budget,
            kpi_roas               = EXCLUDED.kpi_roas,
            kpi_cpa                = EXCLUDED.kpi_cpa,
            kpi_ctr                = EXCLUDED.kpi_ctr,
            kpi_impression         = EXCLUDED.kpi_impression,
            kpi_conversion         = EXCLUDED.kpi_conversion
      RETURNING *
    `, [
      req.params.id, platform,
      external_campaign_id || null, external_campaign_name || null, allocated_budget || 0,
      kpi?.roas || null, kpi?.cpa || null, kpi?.ctr || null,
      kpi?.impression || null, kpi?.conversion || null,
    ]);

    await autoUpdateStatus(req.params.id);
    logCampaignAction(req.user, req.params.id, c.brand_id,
      isChannelUpdate ? 'channel_updated' : 'channel_added',
      c.name, platform,
      { external_campaign_id: external_campaign_id || null, allocated_budget: allocated_budget || 0 });
    res.status(201).json(channel);
  } catch (err) {
    console.error('[campaigns POST /:id/channels]', err);
    res.status(500).json({ error: 'Kanal eklenemedi.' });
  }
});

// DELETE /api/campaigns/:id/channels/:channelId
router.delete('/:id/channels/:channelId', authMiddleware, requireActiveSubscription, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { rows: [c] } = await pool.query(
      'SELECT id, name, brand_id FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, companyId]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: [ch] } = await pool.query(
      'SELECT platform FROM campaign_channels WHERE id = $1 AND campaign_id = $2',
      [req.params.channelId, req.params.id]
    );
    if (!ch) return res.status(404).json({ error: 'Kanal bulunamadı.' });

    await pool.query('DELETE FROM campaign_channels WHERE id = $1', [req.params.channelId]);
    await autoUpdateStatus(req.params.id);
    logCampaignAction(req.user, req.params.id, c.brand_id, 'channel_removed', c.name, ch.platform, null);
    res.json({ success: true });
  } catch (err) {
    console.error('[campaigns DELETE /:id/channels/:channelId]', err);
    res.status(500).json({ error: 'Kanal silinemedi.' });
  }
});

const PLATFORM_TO_INTEGRATION = { google: 'google_ads', youtube: 'google_ads' };
const MANUAL_ONLY_PLATFORMS   = new Set(['programatik', 'display', 'video', 'x', 'other']);

// GET /api/campaigns/:id/platform-campaigns?platform=xxx
router.get('/:id/platform-campaigns', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { platform } = req.query;
  if (!platform) return res.status(400).json({ error: 'Platform gerekli.' });
  try {
    const companyId = req.user.company_id;
    const { rows: [campaign] } = await pool.query(`
      SELECT c.* FROM campaigns c
      WHERE c.id = $1 AND (
        c.brand_id = $2
        OR EXISTS (SELECT 1 FROM connections WHERE agency_company_id = $2 AND brand_company_id = c.brand_id)
      )
    `, [req.params.id, companyId]);
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    if (MANUAL_ONLY_PLATFORMS.has(platform)) {
      return res.json({ campaigns: [], manual: true, message: 'Bu platform için kampanya ID\'sini manuel olarak girin.' });
    }

    const integrationPlatform = PLATFORM_TO_INTEGRATION[platform] || platform;
    const isYoutube = platform === 'youtube';

    const { rows: [integration] } = await pool.query(
      'SELECT * FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true LIMIT 1',
      [campaign.brand_id, integrationPlatform]
    );
    if (!integration) {
      return res.json({ campaigns: [], manual: true, message: `${PLATFORM_LABELS[integrationPlatform] || platform} entegrasyonu bulunamadı.` });
    }

    const { decryptIntegration } = require('../services/tokenEncryption');
    const tokens = decryptIntegration(integration);
    if (tokens.access_token === 'mock_token') {
      return res.json({ campaigns: [], manual: true, message: 'Demo entegrasyon — kampanya ID\'sini manuel olarak girin.' });
    }

    let candidates = [];

    if (integrationPlatform === 'google_ads') {
      const customerId = integration.extra?.customer_id || integration.extra?.customerId;
      if (!customerId) {
        return res.json({ campaigns: [], manual: true, message: 'Google Ads müşteri ID\'si bulunamadı.' });
      }
      const { listAdsCampaigns } = require('../services/googleService');
      candidates = await listAdsCampaigns(tokens, customerId, isYoutube, integration.id);
    } else {
      return res.json({ campaigns: [], manual: true, message: `${PLATFORM_LABELS[integrationPlatform] || platform} için otomatik eşleştirme henüz desteklenmiyor.` });
    }

    const scored = candidates
      .map(c => ({ ...c, score: scoreCandidate(campaign, c) }))
      .sort((a, b) => b.score - a.score);

    res.json({ campaigns: scored, manual: false });
  } catch (err) {
    console.error('[campaigns GET /:id/platform-campaigns]', err);
    res.status(500).json({ error: 'Platform kampanyaları yüklenemedi.' });
  }
});

// PUT /api/campaigns/:id/channels/:platform/match
router.put('/:id/channels/:platform/match', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { external_campaign_id, external_campaign_name, match_status } = req.body;
  if (!match_status || !['matched', 'skipped'].includes(match_status)) {
    return res.status(400).json({ error: 'match_status "matched" veya "skipped" olmalı.' });
  }
  try {
    const companyId = req.user.company_id;
    const { rows: [campaign] } = await pool.query(`
      SELECT c.* FROM campaigns c
      WHERE c.id = $1 AND (
        c.brand_id = $2
        OR EXISTS (SELECT 1 FROM connections WHERE agency_company_id = $2 AND brand_company_id = c.brand_id)
      )
    `, [req.params.id, companyId]);
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: [channel] } = await pool.query(
      'SELECT id FROM campaign_channels WHERE campaign_id = $1 AND platform = $2',
      [req.params.id, req.params.platform]
    );
    if (!channel) return res.status(404).json({ error: 'Kanal bulunamadı.' });

    const { rows: [updated] } = await pool.query(`
      UPDATE campaign_channels
      SET external_campaign_id   = $1,
          external_campaign_name = $2,
          match_status           = $3
      WHERE id = $4
      RETURNING *
    `, [
      match_status === 'matched' ? (external_campaign_id || null) : null,
      match_status === 'matched' ? (external_campaign_name || null) : null,
      match_status,
      channel.id,
    ]);

    logCampaignAction(req.user, req.params.id, campaign.brand_id, 'channel_matched',
      campaign.name, req.params.platform,
      { external_campaign_id: external_campaign_id || null, match_status });
    res.json(updated);
  } catch (err) {
    console.error('[campaigns PUT /:id/channels/:platform/match]', err);
    res.status(500).json({ error: 'Eşleştirme kaydedilemedi.' });
  }
});

// ── Excel Medya Planı Import ──────────────────────────────────────────────────

function cellText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(r => r.text || '').join('').trim();
    if (v.formula && v.result != null) return cellText(v.result);
    if (v.text) return String(v.text).trim();
    if (v.hyperlink) return (v.text || v.hyperlink).trim();
  }
  return String(v);
}

const DIGITAL_KEYWORDS = ['dijital', 'digital', 'transfer'];
const IGNORE_KEYWORDS  = ['tv', 'radyo', 'gazete', 'dergi', 'televizyon'];

function isDigitalSheet(name) {
  const lower = (name || '').toLowerCase();
  if (IGNORE_KEYWORDS.some(k => lower.includes(k))) return false;
  return DIGITAL_KEYWORDS.some(k => lower.includes(k));
}

// POST /api/campaigns/import-plan — parse Excel with AI
router.post('/import-plan', authMiddleware, requireActiveSubscription, checkAiLimit('plan_import'), async (req, res) => {
  const { file, filename } = req.body;
  if (!file) return res.status(400).json({ error: 'Dosya gerekli.' });

  const approxBytes = Math.round(file.length * 0.75);
  if (approxBytes > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'Dosya çok büyük. Maksimum 10MB yükleyebilirsiniz.' });
  }

  try {
    const ExcelJS = require('exceljs');
    const buf = Buffer.from(file, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buf);

    const allSheets = [];
    workbook.eachSheet(sheet => {
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, row => {
        const cells = [];
        row.eachCell({ includeEmpty: true }, cell => cells.push(cellText(cell.value)));
        const nonEmpty = cells.filter(Boolean).length;
        if (nonEmpty > 0) rows.push(cells.join('\t'));
      });
      if (rows.length > 0) allSheets.push({ name: sheet.name, rows });
    });

    if (allSheets.length === 0) {
      return res.status(422).json({ error: 'Bu dosyada dijital plan bulunamadı. Lütfen dijital plan içeren bir Excel yükleyin.' });
    }

    // Prefer digital sheets; fall back to all
    const digital = allSheets.filter(s => isDigitalSheet(s.name));
    const chosen  = digital.length > 0 ? digital : allSheets;

    // Truncate to ~12k chars per sheet to stay within token budget
    const sheetsText = chosen.map(s =>
      `=== Sheet: ${s.name} ===\n${s.rows.slice(0, 200).join('\n')}`
    ).join('\n\n').slice(0, 50000);

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI servisi şu an kullanılamıyor.' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const t0 = Date.now();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `Sen bir medya planı analiz uzmanısın. Verilen Excel verisinden SADECE dijital plan bilgilerini çıkar. TV, radyo, gazete, dergi sheet'lerini tamamen yoksay.

Her satır için şunu çıkar:
{
  "platform": "google|meta|tiktok|youtube|programatik|display|video|x|linkedin",
  "ad_model": string,
  "budget": sayı (TL),
  "buying_type": "CPM|CPC|CPV" veya null,
  "unit_price": sayı veya null,
  "planned_kpi": sayı veya null,
  "kpi_type": "impression|click|view" veya null,
  "targeting": string veya null,
  "frequency": string veya null
}

Platform normalizasyonu:
- "Facebook", "Instagram", "Facebook & Instagram", "Facebook / İnstagram", "Meta" → "meta"
- "YouTube", "Youtube" → "youtube"
- "Staff Programatik", "DV360", "Programatik Network", "Programmatic", "Display", "GDN", "Native" → "programatik"
- "X", "Genart/X", "Twitter" → "x"
- "Google", "Google Ads", "Search", "Arama", "Demand Gen" → "google"
- "TikTok" → "tiktok"
- "LinkedIn" → "linkedin"
- "Video" (bağımsız) → "video"

Tarih: Excel seri numarasını YYYY-MM-DD'ye çevir (epoch: 1900-01-01, -2 gün offset).
Adserver fee, yasal işletim ücreti, alt toplam, boş satırları hariç tut.

SADECE JSON yanıt ver, başka hiçbir şey ekleme:
{
  "campaign_name": string veya null,
  "start_date": "YYYY-MM-DD" veya null,
  "end_date": "YYYY-MM-DD" veya null,
  "total_budget": sayı,
  "lines": [...],
  "missing_fields": [string]
}`,
      messages: [{ role: 'user', content: sheetsText }],
    });

    const processMs    = Date.now() - t0;
    const inputTokens  = response.usage?.input_tokens  ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'plan_import', inputTokens, outputTokens, 'claude-sonnet-4-6', { processMs });

    const raw       = response.content[0]?.text || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Plan formatı tanınamadı. Farklı bir format mı kullanıyorsunuz? Bize ulaşın, destekleyelim.' });
    }

    let parsed;
    try { parsed = JSON.parse(jsonMatch[0]); }
    catch { return res.status(422).json({ error: 'Plan formatı tanınamadı. Farklı bir format mı kullanıyorsunuz? Bize ulaşın, destekleyelim.' }); }

    if (!parsed.lines || parsed.lines.length === 0) {
      return res.status(422).json({ error: 'Bu dosyada dijital plan bulunamadı. Lütfen dijital plan içeren bir Excel yükleyin.' });
    }

    res.json(parsed);
  } catch (err) {
    console.error('[import-plan]', err);
    res.status(500).json({ error: err.message || 'İçe aktarma başarısız.' });
  }
});

// POST /api/campaigns/import-confirm — create campaign + channels from parsed plan
router.post('/import-confirm', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { name, total_budget, start_date, end_date, brand_id, lines } = req.body;
  if (!name?.trim() || !total_budget || !start_date || !end_date || !Array.isArray(lines) || !lines.length) {
    return res.status(400).json({ error: 'Eksik veri.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const companyId = await resolveCompanyId(req.user, brand_id);

    const { rows: [campaign] } = await client.query(`
      INSERT INTO campaigns (brand_id, name, total_budget, start_date, end_date, status, created_by)
      VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING *
    `, [companyId, name.trim(), Number(total_budget), start_date, end_date, req.user.id]);

    // Group lines by platform, aggregate budget and KPI
    const groups = {};
    for (const ln of lines) {
      const platform = (ln.platform || 'other').toLowerCase();
      if (!groups[platform]) {
        groups[platform] = {
          budget: 0, planned_kpi: 0, kpi_type: ln.kpi_type || null,
          buying_type: ln.buying_type || null, unit_price: ln.unit_price || null,
          targeting: ln.targeting || null, frequency: ln.frequency || null,
          ad_models: [],
        };
      }
      groups[platform].budget     += Number(ln.budget) || 0;
      groups[platform].planned_kpi += Number(ln.planned_kpi) || 0;
      if (ln.ad_model) groups[platform].ad_models.push(ln.ad_model);
    }

    for (const [platform, g] of Object.entries(groups)) {
      await client.query(`
        INSERT INTO campaign_channels
          (campaign_id, platform, allocated_budget, planned_kpi, kpi_type,
           buying_type, unit_price, targeting, frequency, imported_from_plan, external_campaign_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)
        ON CONFLICT (campaign_id, platform) DO UPDATE SET
          allocated_budget   = EXCLUDED.allocated_budget,
          planned_kpi        = EXCLUDED.planned_kpi,
          kpi_type           = EXCLUDED.kpi_type,
          buying_type        = EXCLUDED.buying_type,
          unit_price         = EXCLUDED.unit_price,
          targeting          = EXCLUDED.targeting,
          frequency          = EXCLUDED.frequency,
          imported_from_plan = true,
          external_campaign_name = EXCLUDED.external_campaign_name
      `, [
        campaign.id, platform,
        g.budget, g.planned_kpi > 0 ? g.planned_kpi : null, g.kpi_type,
        g.buying_type, g.unit_price, g.targeting, g.frequency,
        g.ad_models.length ? g.ad_models.join(', ') : null,
      ]);
    }

    await client.query('COMMIT');
    logCampaignAction(req.user, campaign.id, companyId, 'campaign_created', name.trim(), null, { imported: true, lines: lines.length });
    res.status(201).json({ id: campaign.id, name: campaign.name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import-confirm]', err);
    res.status(500).json({ error: err.message || 'Kampanya oluşturulamadı.' });
  } finally {
    client.release();
  }
});

module.exports = router;
