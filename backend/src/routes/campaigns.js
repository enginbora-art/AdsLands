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
  if (c.status === 'completed') return 'completed'; // completed is final
  const now = new Date();
  const { rows: [{ matched_count }] } = await pool.query(
    "SELECT COUNT(*) AS matched_count FROM campaign_channels WHERE campaign_id = $1 AND external_campaign_id IS NOT NULL",
    [campaignId]
  );
  const hasMatch = parseInt(matched_count) > 0;
  let newStatus;
  if (new Date(c.end_date) < now) {
    newStatus = 'completed';
  } else if (hasMatch && new Date(c.start_date) <= now) {
    newStatus = 'active';
  } else if (hasMatch) {
    newStatus = 'ready';
  } else {
    newStatus = 'draft';
  }
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
        (SELECT COUNT(*) FROM campaign_channels cc WHERE cc.campaign_id = c.id AND cc.external_campaign_id IS NOT NULL)::int AS matched_channel_count,
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
        CASE c.status WHEN 'active' THEN 0 WHEN 'ready' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
        c.created_at DESC
    `, params);

    // Auto-update statuses (lightweight — no DB query per campaign)
    const now = new Date();
    for (const c of rows) {
      if (c.status === 'completed') continue;
      let expectedStatus = c.status;
      if (new Date(c.end_date) < now) {
        expectedStatus = 'completed';
      } else if (c.matched_channel_count > 0 && new Date(c.start_date) <= now) {
        expectedStatus = 'active';
      } else if (c.matched_channel_count > 0) {
        expectedStatus = 'ready';
      } else {
        expectedStatus = 'draft';
      }
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
  const { platform, ad_model, external_campaign_id, external_campaign_name, allocated_budget, kpi } = req.body;
  if (!platform) return res.status(400).json({ error: 'Platform gerekli.' });
  const adModel = (ad_model || '').trim();
  try {
    const companyId = req.user.company_type === 'agency' ? req.body.brand_id || req.user.company_id : req.user.company_id;
    const { rows: [c] } = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, companyId]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: [existingCh] } = await pool.query(
      'SELECT id FROM campaign_channels WHERE campaign_id = $1 AND platform = $2 AND ad_model = $3',
      [req.params.id, platform, adModel]
    );
    const isChannelUpdate = !!existingCh;

    const { rows: [channel] } = await pool.query(`
      INSERT INTO campaign_channels
        (campaign_id, platform, ad_model, external_campaign_id, external_campaign_name, allocated_budget,
         kpi_roas, kpi_cpa, kpi_ctr, kpi_impression, kpi_conversion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (campaign_id, platform, ad_model) DO UPDATE
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
      req.params.id, platform, adModel,
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

const PLATFORM_TO_INTEGRATION = { google: 'google_ads', youtube: 'google_ads', dv360: 'dv360' };
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
    } else if (integrationPlatform === 'dv360') {
      const advertiserId = integration.extra?.advertiser_id;
      if (!advertiserId) {
        return res.json({ campaigns: [], manual: true, message: 'DV360 advertiser seçilmemiş. Entegrasyon ayarlarından advertiser seçin.' });
      }
      const { listCampaigns: listDv360Campaigns } = require('../services/dv360Service');
      candidates = await listDv360Campaigns(tokens, advertiserId, integration.id);
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
    await autoUpdateStatus(req.params.id).catch(() => {});
    res.json(updated);
  } catch (err) {
    console.error('[campaigns PUT /:id/channels/:platform/match]', err);
    res.status(500).json({ error: 'Eşleştirme kaydedilemedi.' });
  }
});

// PUT /api/campaigns/:id/complete — kullanıcı tarafından erken sonlandırma
router.put('/:id/complete', authMiddleware, requireActiveSubscription, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.body?.brand_id);
    const { rows: [campaign] } = await pool.query(
      `SELECT c.* FROM campaigns c
       WHERE c.id = $1 AND (
         c.brand_id = $2
         OR EXISTS (SELECT 1 FROM connections WHERE agency_company_id = $2 AND brand_company_id = c.brand_id)
       )`,
      [req.params.id, companyId]
    );
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    if (campaign.status === 'draft') return res.status(400).json({ error: 'Taslak kampanyalar sonlandırılamaz. Silmek için Sil butonunu kullanın.' });
    if (campaign.status === 'completed') return res.status(400).json({ error: 'Kampanya zaten tamamlandı.' });

    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date(campaign.end_date) > new Date(today) ? today : campaign.end_date;

    await pool.query(
      "UPDATE campaigns SET status = 'completed', end_date = $1 WHERE id = $2",
      [endDate, campaign.id]
    );
    logCampaignAction(req.user, campaign.id, campaign.brand_id, 'campaign_completed', campaign.name, null,
      { reason: 'Kullanıcı kampanyayı erken sonlandırdı', end_date: endDate });
    res.json({ success: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[campaigns PUT /:id/complete]', err);
    res.status(500).json({ error: 'Kampanya sonlandırılamadı.' });
  }
});

// GET /api/campaigns/:id/performance
router.get('/:id/performance', authMiddleware, requireActiveSubscription, async (req, res) => {
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
      'SELECT * FROM campaign_channels WHERE campaign_id = $1 ORDER BY platform, created_at',
      [req.params.id]
    );

    // Fetch platform-level actuals once per unique platform (avoid N+1 for same platform)
    const uniquePlatforms = [...new Set(channels.map(c => c.platform))];
    const platformActuals = {};
    await Promise.all(uniquePlatforms.map(async (plt) => {
      const { rows: [m] } = await pool.query(`
        SELECT
          COALESCE(SUM(m.spend), 0)::float       AS actual_spend,
          COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS actual_roas,
          COALESCE(SUM(m.conversions), 0)::int    AS actual_conversions,
          COALESCE(SUM(m.clicks), 0)::int         AS actual_clicks,
          COALESCE(SUM(m.impressions), 0)::bigint AS actual_impressions
        FROM integrations i
        JOIN ad_metrics m ON m.integration_id = i.id
          AND m.date >= $3 AND m.date <= LEAST($4::date, CURRENT_DATE)
        WHERE i.company_id = $1 AND i.platform = $2 AND i.is_active = true
      `, [campaign.brand_id, plt, campaign.start_date, campaign.end_date]);
      platformActuals[plt] = m;
    }));

    function resolveKpi(ch) {
      let kpiType = ch.kpi_type || null;
      if (!kpiType) {
        if (ch.kpi_roas)            kpiType = 'roas';
        else if (ch.kpi_cpa)        kpiType = 'cpa';
        else if (ch.kpi_ctr)        kpiType = 'ctr';
        else if (ch.kpi_impression) kpiType = 'impression';
        else if (ch.kpi_conversion) kpiType = 'conversion';
      }
      const plannedKpi = kpiType === 'roas'       ? (parseFloat(ch.kpi_roas)       || null)
                       : kpiType === 'cpa'         ? (parseFloat(ch.kpi_cpa)        || null)
                       : kpiType === 'ctr'         ? (parseFloat(ch.kpi_ctr)        || null)
                       : kpiType === 'impression'  ? (parseFloat(ch.kpi_impression) || null)
                       : kpiType === 'conversion'  ? (parseFloat(ch.kpi_conversion) || null)
                       : parseFloat(ch.planned_kpi) || null;
      return { kpiType, plannedKpi };
    }

    // Group channels by platform
    const grouped = {};
    for (const ch of channels) {
      const plt = ch.platform;
      if (!grouped[plt]) grouped[plt] = [];
      const m = platformActuals[plt];
      const allocBudget = parseFloat(ch.allocated_budget) || 0;

      const { kpiType, plannedKpi } = resolveKpi(ch);
      // Actual KPI — derived from platform totals (best effort; no per-ad-model breakdown from ad_metrics)
      const actualKpi = null; // populated when campaign_actuals has per-channel data

      grouped[plt].push({
        id: ch.id, platform: ch.platform, ad_model: ch.ad_model || '',
        external_campaign_id: ch.external_campaign_id, external_campaign_name: ch.external_campaign_name,
        allocated_budget: allocBudget,
        kpi_type: kpiType, planned_kpi: plannedKpi, actual_kpi: actualKpi,
        kpi_achievement: null,
        buying_type: ch.buying_type,
      });
    }

    // Build platform_groups with platform-level actuals
    const platform_groups = Object.entries(grouped).map(([plt, rows]) => {
      const m = platformActuals[plt];
      const totalAllocated = rows.reduce((s, r) => s + r.allocated_budget, 0);
      const actualSpend    = m?.actual_spend || 0;
      const budgetAchievement = totalAllocated > 0
        ? Math.round((actualSpend / totalAllocated) * 1000) / 10 : null;

      // Merge any legacy duplicate ad_model names (should not occur with unique constraint,
      // but may exist in data imported before the constraint was added)
      const merged = {};
      for (const r of rows) {
        const key = r.ad_model || '';
        if (!merged[key]) {
          merged[key] = { ...r };
        } else {
          merged[key].allocated_budget += r.allocated_budget;
          if (merged[key].planned_kpi != null && r.planned_kpi != null)
            merged[key].planned_kpi = (parseFloat(merged[key].planned_kpi) || 0) + (parseFloat(r.planned_kpi) || 0);
        }
      }
      const deduped = Object.values(merged);

      // Distribute actual spend proportionally across ad_models for progress bars
      const adModelRows = deduped.map(r => {
        const share = totalAllocated > 0 ? r.allocated_budget / totalAllocated : 0;
        const modelActual = Math.round(actualSpend * share * 100) / 100;
        const modelAchievement = r.allocated_budget > 0
          ? Math.round((modelActual / r.allocated_budget) * 1000) / 10 : null;
        return { ...r, actual_spend: modelActual, budget_achievement: modelAchievement };
      });

      return {
        platform: plt,
        total_allocated: totalAllocated,
        total_actual: actualSpend,
        budget_achievement: budgetAchievement,
        actual_roas: m?.actual_roas || 0,
        ad_models: adModelRows,
      };
    });

    const totalAllocated = platform_groups.reduce((s, g) => s + g.total_allocated, 0);
    const totalActual    = platform_groups.reduce((s, g) => s + g.total_actual, 0);
    const overallBudget  = totalAllocated > 0
      ? Math.round((totalActual / totalAllocated) * 1000) / 10 : null;

    const withBudget = platform_groups.filter(g => g.budget_achievement !== null);
    const onTrack = withBudget.filter(g => g.budget_achievement >= 90).length;
    const warning = withBudget.filter(g => g.budget_achievement >= 70 && g.budget_achievement < 90).length;
    const critical = withBudget.filter(g => g.budget_achievement < 70).length;

    res.json({
      platform_groups,
      summary: {
        total_allocated: totalAllocated,
        total_actual:    totalActual,
        budget_achievement: overallBudget,
        on_track: onTrack,
        warning,
        critical,
      },
    });
  } catch (err) {
    console.error('[campaigns GET /:id/performance]', err);
    res.status(500).json({ error: 'Performans verileri yüklenemedi.' });
  }
});

// ── Excel Medya Planı Import ──────────────────────────────────────────────────

const IGNORE_KEYWORDS   = ['tv', 'radyo', 'gazete', 'dergi', 'televizyon'];
const PHASE1_KEYWORDS   = ['dijital', 'digital', 'transfer', 'plan', 'medya'];
const CONTENT_KEYWORDS  = [
  'google', 'meta', 'tiktok', 'youtube', 'facebook', 'instagram', 'linkedin',
  'cpm', 'cpc', 'cpv', 'programatik', 'display', 'video', 'search',
  'reach', 'gösterim', 'tıklanma', 'izlenme', 'bütçe', 'budget', 'impression', 'click',
];

function isIgnoredSheet(name) {
  return IGNORE_KEYWORDS.some(k => (name || '').toLowerCase().includes(k));
}
function isPhase1Sheet(name) {
  const lower = (name || '').toLowerCase();
  return !isIgnoredSheet(name) && PHASE1_KEYWORDS.some(k => lower.includes(k));
}
function scoreSheetContent(XLSX, ws) {
  if (!ws) return 0;
  const text = XLSX.utils.sheet_to_csv(ws, { FS: ' ', defval: '' }).toLowerCase();
  return CONTENT_KEYWORDS.filter(k => text.includes(k)).length;
}
function sheetRowCount(XLSX, ws) {
  const ref = ws?.['!ref'];
  return ref ? XLSX.utils.decode_range(ref).e.r + 1 : 0;
}

// Multer: memory storage, 10 MB limit, xlsx/xls only
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Sadece .xlsx veya .xls dosyası yükleyebilirsiniz.'));
  },
});

function uploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: err.message || 'Dosya yüklenemedi.' });
  });
}

// POST /api/campaigns/import-plan — parse Excel with AI
router.post('/import-plan',
  authMiddleware, requireActiveSubscription, uploadMiddleware, checkAiLimit('plan_import'),
  async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Dosya gerekli.' });

  try {
    const XLSX = require('xlsx');
    const buf        = req.file.buffer;
    const forceSheet = req.body?.force_sheet || null;

    // Pass A: sheet names only — zero cell data loaded
    const wbMeta   = XLSX.read(buf, { type: 'buffer', bookSheets: true });
    const allNames = wbMeta.SheetNames || [];
    if (!allNames.length) {
      return res.status(422).json({ error: 'Bu dosyada dijital plan bulunamadı. Lütfen dijital plan içeren bir Excel yükleyin.' });
    }

    let targetNames;

    if (forceSheet) {
      // User explicitly selected a sheet — skip all heuristics
      if (!allNames.includes(forceSheet)) {
        return res.status(400).json({ error: 'Seçilen sheet bulunamadı.' });
      }
      targetNames = [forceSheet];

    } else {
      // Phase 1 — name keyword match (fast path)
      const phase1 = allNames.filter(isPhase1Sheet);

      if (phase1.length > 0) {
        targetNames = phase1;

      } else {
        // Phase 2 — content scoring: load non-ignored sheets, first 20 rows each
        const candidates = allNames.filter(n => !isIgnoredSheet(n));
        const scanNames  = candidates.length > 0 ? candidates : allNames;

        const wbScan = XLSX.read(buf, {
          type: 'buffer', sheets: scanNames, sheetRows: 20, cellNF: false, cellHTML: false,
        });

        const scored = scanNames
          .map(name => ({
            name,
            score:     scoreSheetContent(XLSX, wbScan.Sheets[name]),
            row_count: sheetRowCount(XLSX, wbScan.Sheets[name]),
          }))
          .sort((a, b) => b.score - a.score || b.row_count - a.row_count);

        const best = scored[0];
        if (best && best.score >= 3) {
          targetNames = [best.name];
        } else {
          // Phase 3 — ask the user to pick
          const rowCounts = Object.fromEntries(
            scanNames.map(n => [n, sheetRowCount(XLSX, wbScan.Sheets[n])])
          );
          return res.json({
            needs_sheet_selection: true,
            available_sheets: allNames.map(n => ({ name: n, row_count: rowCounts[n] ?? null })),
            lines: [],
          });
        }
      }
    }

    // Pass 2: load only target sheets with cell data
    const wb = XLSX.read(buf, {
      type: 'buffer',
      sheets: targetNames,
      cellDates: true,
      cellNF: false,
      cellHTML: false,
    });

    // Convert sheets → filtered tab-separated text, max 500 rows each
    const sheetsText = targetNames.map(name => {
      const ws = wb.Sheets[name];
      if (!ws) return '';
      const rows = XLSX.utils.sheet_to_csv(ws, { FS: '\t', defval: '' })
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.replace(/\t+/g, '').length > 0)
        .slice(0, 500);
      return rows.length ? `=== Sheet: ${name} ===\n${rows.join('\n')}` : '';
    }).filter(Boolean).join('\n\n').slice(0, 50000);

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI analiz servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.' });
    }

    // Fetch learned mappings for this company
    const companyId = req.aiCtx.companyId;
    const { rows: learnedMappings } = await pool.query(
      'SELECT raw_value, platform, ad_model FROM platform_mappings WHERE company_id = $1 ORDER BY match_count DESC LIMIT 60',
      [companyId]
    ).catch(() => ({ rows: [] }));

    const Anthropic = require('@anthropic-ai/sdk');
    const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 110_000 });

    const t0 = Date.now();
    let response;
    try {
      response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `Sen bir medya planı analiz uzmanısın. Verilen Excel verisinden SADECE dijital plan bilgilerini çıkar. TV, radyo, gazete, dergi sheet'lerini tamamen yoksay.
${learnedMappings.length > 0 ? `
ÖĞRENİLMİŞ EŞLEŞTİRMELER (bu şirket için önceki importlarda kullanıcılar tarafından düzeltildi — ÖNCELİKLİ KULLAN):
${learnedMappings.map(m => `- "${m.raw_value}" → platform: "${m.platform}", ad_model: "${m.ad_model}"`).join('\n')}
Eğer çıkardığın bir satır bu ham değerlerden biriyle eşleşiyorsa, sağdaki platform ve ad_model değerlerini kullan.
` : ''}

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

Birim fiyat ve satın alma tipi çıkarımı (ZORUNLU):
Birim fiyat kolonları farklı isimler alabilir — şunları tara:
"Birim Fiyat", "Unit Price", "CPM", "CPC", "CPV",
"Birim Fiyat (CPC)", "Birim Fiyat (CPV)", "Birim Fiyat (CPM)",
"Birim Fiyat (CPM/CPC/CPV)", "Price (CPC) (TL)", "Price (CPV) (TL)",
"CPC (TL)", "CPM (TL)", "CPV (TL)", "Fiyat", "Birim Maliyet"
Bu kolonlarda sayısal değer varsa unit_price olarak al.

buying_type belirleme sırası:
1. Kolon başlığında CPM / CPC / CPV geçiyorsa oradan al
2. "Satın Alma Tipi", "Purchasing Type", "Satın Alma Modeli" kolonundan al
3. Birim fiyatın hangi isimli kolonda olduğuna göre belirle
4. Hiçbirinden anlaşılamazsa planlanan KPI tipinden tahmin et:
   gösterim / impression → CPM
   tıklanma / click → CPC
   izlenme / view → CPV

Birim fiyat bulunamazsa missing_fields listesine ekle:
"[Platform] [Reklam Modeli] birim fiyatı eksik"
(örnek: "Google Search birim fiyatı eksik")

Platform belirleme — öncelik sırası (önce eşleşen kuralı uygula, sonrakine geçme):

1. Reklam Modeli bazlı (en yüksek öncelik):
   Reklam Modeli / Format kolonu şu değerlerden birini içeriyorsa (büyük/küçük harf fark etmez):
   "Preroll", "Liveroll", "Midroll", "Liveroll&Preroll", "Pre-roll", "Live-roll"
   → platform = "video" (Network/Şirket ne olursa olsun)
   → ad_model = "[Network/Şirket Adı] - [Reklam Modeli]"
   Örnek: Membrana + Preroll → platform="video", ad_model="Membrana - Preroll"
   Örnek: Tooplay + Liveroll&Preroll → platform="video", ad_model="Tooplay - Liveroll&Preroll"

2. Programatik + YouTube kombinasyonu:
   Network/Şirket "Programatik", "DV360" veya "Staff Programatik" içeriyorsa
   VE Site/Mecra/Yayın Ortamı "YouTube" veya "Youtube" ise:
   → platform = "programatik"
   → ad_model = "YouTube - [o satırdaki Reklam Modeli / Format]"
   Örnek: "YouTube - Trueview", "YouTube - VRC"

3. Programatik genel:
   Network/Şirket "Programatik", "DV360", "Staff Programatik", "Programatik Network",
   "Programmatic", "Display", "GDN", "Native" içeriyorsa:
   → platform = "programatik"
   → ad_model = "[Reklam Modeli]" (örnek: "DOOH", "Native")

4. Video IO network kuralı:
   Network/Şirket olarak Membrana, Digitalvol, Tooplay, Adplus, Mediology gibi bir
   video network adı varsa VE kural 1'e girmemişse (Reklam Modeli preroll/liveroll değil):
   → platform = "video"
   → ad_model = "[Network Adı] - [Reklam Modeli / Format]"
   Örnek: "Membrana - Outstream", "Tooplay - Instream"

5. Diğer platformlar (standart normalizasyon):
   - "Facebook", "Instagram", "Facebook & Instagram", "Facebook / İnstagram", "Meta" → "meta"
   - "YouTube", "Youtube" (Network/Şirket doğrudan YouTube ise) → "youtube"
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
    } catch (aiErr) {
      console.error('[import-plan] Anthropic API hatası:', aiErr.status, aiErr.message);
      if (aiErr instanceof Anthropic.AuthenticationError || aiErr.status === 401) {
        return res.status(503).json({ error: 'AI analiz servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.' });
      }
      if (aiErr instanceof Anthropic.RateLimitError || aiErr.status === 429) {
        return res.status(429).json({ error: 'AI servis kapasitesi doldu. Birkaç dakika sonra tekrar deneyin.' });
      }
      if (aiErr instanceof Anthropic.APITimeoutError || aiErr.code === 'ETIMEDOUT') {
        return res.status(504).json({ error: 'Analiz çok uzun sürdü. Daha küçük bir dosya yüklemeyi deneyin.' });
      }
      if (aiErr.status >= 500 || aiErr instanceof Anthropic.InternalServerError) {
        return res.status(503).json({ error: 'AI analiz servisi geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.' });
      }
      return res.status(503).json({ error: 'AI analiz servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.' });
    }

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

    // Count how many output lines matched a learned mapping
    const mappingTargets = new Set(learnedMappings.map(m => `${m.platform}|${m.ad_model || ''}`));
    const appliedMappingsCount = parsed.lines.filter(ln =>
      mappingTargets.has(`${ln.platform}|${ln.ad_model || ''}`)
    ).length;

    res.json({ ...parsed, applied_mappings_count: appliedMappingsCount });
  } catch (err) {
    console.error('[import-plan]', err.message || err);
    res.status(500).json({ error: 'İçe aktarma başarısız. Lütfen tekrar deneyin.' });
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

    // One row per line — each (platform, ad_model) combination gets its own channel.
    // On duplicate ad_model within the same platform: SUM budgets and KPIs.
    for (const ln of lines) {
      const platform = (ln.platform || 'other').toLowerCase();
      const adModel  = (ln.ad_model || '').trim();
      await client.query(`
        INSERT INTO campaign_channels
          (campaign_id, platform, ad_model, external_campaign_name,
           allocated_budget, planned_kpi, kpi_type,
           buying_type, unit_price, targeting, frequency, imported_from_plan)
        VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,true)
        ON CONFLICT (campaign_id, platform, ad_model) DO UPDATE SET
          allocated_budget       = campaign_channels.allocated_budget + EXCLUDED.allocated_budget,
          planned_kpi            = COALESCE(campaign_channels.planned_kpi, 0) + COALESCE(EXCLUDED.planned_kpi, 0),
          external_campaign_name = EXCLUDED.external_campaign_name,
          kpi_type               = COALESCE(campaign_channels.kpi_type, EXCLUDED.kpi_type),
          buying_type            = COALESCE(campaign_channels.buying_type, EXCLUDED.buying_type),
          unit_price             = COALESCE(campaign_channels.unit_price, EXCLUDED.unit_price),
          targeting              = COALESCE(campaign_channels.targeting, EXCLUDED.targeting),
          frequency              = COALESCE(campaign_channels.frequency, EXCLUDED.frequency),
          imported_from_plan     = true
      `, [
        campaign.id, platform, adModel,
        Number(ln.budget) || 0,
        ln.planned_kpi != null ? Number(ln.planned_kpi) : null,
        ln.kpi_type || null,
        ln.buying_type || null, ln.unit_price || null,
        ln.targeting || null, ln.frequency || null,
      ]);
    }

    await client.query('COMMIT');
    logCampaignAction(req.user, campaign.id, companyId, 'campaign_created', name.trim(), null, { imported: true, lines: lines.length });
    // imported campaigns always start as draft (no matched channels yet)
    res.status(201).json({ id: campaign.id, name: campaign.name });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[import-confirm]', err);
    res.status(500).json({ error: err.message || 'Kampanya oluşturulamadı.' });
  } finally {
    client.release();
  }
});

// POST /api/campaigns/import-mappings — save learned platform/ad_model corrections
router.post('/import-mappings', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { mappings, brand_id } = req.body;
  if (!Array.isArray(mappings) || !mappings.length) {
    return res.status(400).json({ error: 'mappings zorunlu.' });
  }
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    for (const m of mappings) {
      if (!m.raw_value || !m.platform) continue;
      await pool.query(`
        INSERT INTO platform_mappings
          (company_id, raw_value, platform, ad_model, match_count, updated_at)
        VALUES ($1, $2, $3, $4, 1, NOW())
        ON CONFLICT (company_id, raw_value) DO UPDATE SET
          platform    = EXCLUDED.platform,
          ad_model    = EXCLUDED.ad_model,
          match_count = platform_mappings.match_count + 1,
          updated_at  = NOW()
      `, [companyId, m.raw_value, m.platform, m.ad_model || '']);
    }
    res.json({ saved: mappings.length });
  } catch (err) {
    console.error('[import-mappings]', err);
    res.status(500).json({ error: err.message || 'Eşleştirmeler kaydedilemedi.' });
  }
});

module.exports = router;
