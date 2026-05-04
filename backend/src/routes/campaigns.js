const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

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

// DELETE /api/campaigns/:id
router.delete('/:id', authMiddleware, requireActiveSubscription, async (req, res) => {
  try {
    const { rows: [c] } = await pool.query(
      'SELECT id, name, brand_id FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!c) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
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

// GET /api/campaigns/:id/platform-campaigns?platform=xxx
router.get('/:id/platform-campaigns', authMiddleware, requireActiveSubscription, async (req, res) => {
  const { platform } = req.query;
  if (!platform) return res.status(400).json({ error: 'Platform gerekli.' });
  try {
    const companyId = req.user.company_id;
    const { rows: [campaign] } = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND brand_id = $2',
      [req.params.id, companyId]
    );
    if (!campaign) return res.status(404).json({ error: 'Kampanya bulunamadı.' });

    const { rows: [integration] } = await pool.query(
      'SELECT id FROM integrations WHERE company_id = $1 AND platform = $2 AND is_active = true',
      [companyId, platform]
    );

    if (!integration) {
      return res.json({ campaigns: [], manual: true, message: `${PLATFORM_LABELS[platform] || platform} entegrasyonu bulunamadı.` });
    }

    // Return empty list with manual flag — real platform API calls can be added per platform
    // Provide fuzzy-match suggestion based on campaign name if user provides search term
    const { search } = req.query;
    if (search) {
      const score = stringSimilarity(campaign.name, search);
      return res.json({
        campaigns: score >= 0.3 ? [{ id: search, name: search, similarity: Math.round(score * 100) }] : [],
        manual: true,
      });
    }

    res.json({ campaigns: [], manual: true, message: 'Kampanya ID\'sini platform panelinden alıp manuel olarak girin.' });
  } catch (err) {
    console.error('[campaigns GET /:id/platform-campaigns]', err);
    res.status(500).json({ error: 'Platform kampanyaları yüklenemedi.' });
  }
});

module.exports = router;
