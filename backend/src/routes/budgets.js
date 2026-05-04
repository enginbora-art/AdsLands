const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');
const { checkAiLimit, logAiUsage } = require('../middleware/aiLimit');
const { queueAiRequest, getQueueStatus } = require('../services/aiQueue');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer',
  adjust: 'Adjust', other: 'Diğer',
};

async function verifyAgencyBrand(agencyCompanyId, brandCompanyId) {
  const { rows } = await pool.query(
    'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
    [agencyCompanyId, brandCompanyId]
  );
  return rows.length > 0;
}

// GET /api/budgets/brands — ajansın bağlı marka şirketlerini listele
router.get('/brands', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar erişebilir.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name AS company_name
       FROM connections conn
       JOIN companies c ON c.id = conn.brand_company_id
       WHERE conn.agency_company_id = $1
       ORDER BY c.name`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets/logs
router.get('/logs', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  try {
    const isBrand = req.user.company_type === 'brand';
    const cid = req.user.company_id;

    const budgetFilter = isBrand
      ? 'b.company_id = $1'
      : '(b.company_id IN (SELECT brand_company_id FROM connections WHERE agency_company_id = $1) OR bl.company_id = $1)';

    const campFilter = isBrand
      ? 'cl.brand_company_id = $1'
      : '(cl.brand_company_id IN (SELECT brand_company_id FROM connections WHERE agency_company_id = $1) OR cl.actor_company_id = $1)';

    const query = `
      SELECT id, action, old_value, new_value, created_at,
             month, year, brand_name, actor_company_name, user_name,
             NULL::varchar AS campaign_name, NULL::varchar AS platform, 'budget' AS log_type
      FROM (
        SELECT bl.id, bl.action, bl.old_value, bl.new_value, bl.created_at,
               b.month, b.year,
               brand_c.name AS brand_name,
               actor_c.name AS actor_company_name,
               COALESCE(u.full_name, u.email) AS user_name
        FROM budget_logs bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN companies brand_c ON brand_c.id = b.company_id
        JOIN companies actor_c ON actor_c.id = bl.company_id
        JOIN users u ON u.id = bl.user_id
        WHERE ${budgetFilter}
      ) budget_rows

      UNION ALL

      SELECT id, action, NULL AS old_value, new_value, created_at,
             NULL::int AS month, NULL::int AS year,
             brand_name, actor_company_name, user_name,
             campaign_name, platform, 'campaign' AS log_type
      FROM (
        SELECT cl.id, cl.action, cl.new_value, cl.created_at,
               brand_c.name AS brand_name,
               actor_c.name AS actor_company_name,
               COALESCE(u.full_name, u.email) AS user_name,
               cl.campaign_name, cl.platform
        FROM campaign_logs cl
        JOIN companies brand_c ON brand_c.id = cl.brand_company_id
        JOIN companies actor_c ON actor_c.id = cl.actor_company_id
        JOIN users u ON u.id = cl.user_id
        WHERE ${campFilter}
      ) campaign_rows

      ORDER BY created_at DESC
      LIMIT $2
    `;

    const { rows } = await pool.query(query, [cid, limit]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/budgets?month=4&year=2026[&brand_id=uuid]
router.get('/', authMiddleware, async (req, res) => {
  const month = parseInt(req.query.month);
  const year  = parseInt(req.query.year);
  if (!month || !year) return res.status(400).json({ error: 'month ve year zorunludur.' });

  let targetCompanyId = req.user.company_id;

  if (req.user.company_type === 'agency' && req.query.brand_id) {
    if (!(await verifyAgencyBrand(req.user.company_id, req.query.brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetCompanyId = req.query.brand_id;
  }

  try {
    const { rows: [budget] } = await pool.query(
      'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
      [targetCompanyId, month, year]
    );
    if (!budget) return res.json(null);

    const { rows: channels } = await pool.query(
      `SELECT platform, amount::float AS amount,
              kpi_roas::float, kpi_cpa::float, kpi_ctr::float,
              kpi_impression, kpi_conversion
       FROM budget_channels WHERE budget_id = $1 ORDER BY created_at`,
      [budget.id]
    );
    res.json({ ...budget, channels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/budgets
router.post('/', authMiddleware, async (req, res) => {
  const { month, year, total_budget, channels, brand_id } = req.body;
  if (!month || !year || total_budget === undefined) {
    return res.status(400).json({ error: 'month, year ve total_budget zorunludur.' });
  }

  let targetCompanyId = req.user.company_id;

  if (req.user.company_type === 'agency') {
    if (!brand_id) return res.status(400).json({ error: 'Ajans hesabı için brand_id zorunludur.' });
    if (!(await verifyAgencyBrand(req.user.company_id, brand_id))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
    targetCompanyId = brand_id;
  }

  // Derive legacy column values from channels for backward compat (dashboard warning reads these)
  const toNum = (v) => parseFloat(v) || 0;
  const safeChannels = (channels || []).filter(ch => ch.platform && toNum(ch.amount) > 0);
  const googleBudget = toNum(safeChannels.find(c => c.platform === 'google_ads')?.amount);
  const metaBudget   = toNum(safeChannels.find(c => c.platform === 'meta')?.amount);
  const tiktokBudget = toNum(safeChannels.find(c => c.platform === 'tiktok')?.amount);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing budget + channels (for log old_value)
    const { rows: [existing] } = await client.query(
      'SELECT * FROM budgets WHERE company_id = $1 AND month = $2 AND year = $3',
      [targetCompanyId, month, year]
    );
    let existingChannels = [];
    if (existing) {
      const { rows } = await client.query(
        'SELECT platform, amount::float AS amount FROM budget_channels WHERE budget_id = $1',
        [existing.id]
      );
      existingChannels = rows;
    }

    // Upsert budget (keep legacy columns in sync)
    const { rows: [newBudget] } = await client.query(
      `INSERT INTO budgets (company_id, month, year, total_budget, google_ads_budget, meta_ads_budget, tiktok_ads_budget, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (company_id, month, year) DO UPDATE SET
         total_budget      = EXCLUDED.total_budget,
         google_ads_budget = EXCLUDED.google_ads_budget,
         meta_ads_budget   = EXCLUDED.meta_ads_budget,
         tiktok_ads_budget = EXCLUDED.tiktok_ads_budget,
         updated_at        = NOW()
       RETURNING *`,
      [targetCompanyId, month, year, total_budget, googleBudget, metaBudget, tiktokBudget]
    );

    // Replace budget_channels
    await client.query('DELETE FROM budget_channels WHERE budget_id = $1', [newBudget.id]);
    for (const ch of safeChannels) {
      const kpi = ch.kpi || {};
      await client.query(
        `INSERT INTO budget_channels (budget_id, platform, amount, kpi_roas, kpi_cpa, kpi_ctr, kpi_impression, kpi_conversion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newBudget.id, ch.platform, toNum(ch.amount),
          kpi.roas       != null ? parseFloat(kpi.roas)       : null,
          kpi.cpa        != null ? parseFloat(kpi.cpa)        : null,
          kpi.ctr        != null ? parseFloat(kpi.ctr)        : null,
          kpi.impression != null ? parseInt(kpi.impression)   : null,
          kpi.conversion != null ? parseInt(kpi.conversion)   : null,
        ]
      );
    }

    // Fetch saved channels to return
    const { rows: savedChannels } = await client.query(
      `SELECT platform, amount::float AS amount,
              kpi_roas::float, kpi_cpa::float, kpi_ctr::float,
              kpi_impression, kpi_conversion
       FROM budget_channels WHERE budget_id = $1 ORDER BY created_at`,
      [newBudget.id]
    );

    // Budget log
    const oldValue = existing ? {
      total_budget: toNum(existing.total_budget),
      channels: existingChannels.map(c => ({ platform: c.platform, amount: toNum(c.amount) })),
    } : null;
    const newValue = {
      total_budget: toNum(newBudget.total_budget),
      channels: savedChannels.map(c => ({ platform: c.platform, amount: toNum(c.amount) })),
    };

    await client.query(
      `INSERT INTO budget_logs (budget_id, user_id, company_id, action, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newBudget.id, req.user.user_id, req.user.company_id,
       existing ? 'updated' : 'created',
       oldValue ? JSON.stringify(oldValue) : null,
       JSON.stringify(newValue)]
    );

    await client.query('COMMIT');
    res.json({ ...newBudget, channels: savedChannels });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});

// GET /api/budgets/kpi-analysis/:brandId — Claude streaming KPI analizi
router.get('/kpi-analysis/:brandId', authMiddleware, requireActiveSubscription, checkAiLimit('kpi_analysis'), async (req, res) => {
  const { brandId } = req.params;

  // Ajans erişim kontrolü
  if (req.user.company_type === 'agency') {
    if (!(await verifyAgencyBrand(req.user.company_id, brandId))) {
      return res.status(403).json({ error: 'Bu markaya erişiminiz yok.' });
    }
  } else if (req.user.company_id !== brandId) {
    return res.status(403).json({ error: 'Erişim reddedildi.' });
  }

  try {
    // Aktif ayın bütçe kanallarını ve KPI'larını çek
    const now = new Date();
    const { rows: channels } = await pool.query(
      `SELECT bc.platform, bc.amount::float,
              bc.kpi_roas::float, bc.kpi_cpa::float, bc.kpi_ctr::float,
              bc.kpi_impression, bc.kpi_conversion
       FROM budget_channels bc
       JOIN budgets b ON b.id = bc.budget_id
       WHERE b.company_id = $1
         AND b.month = $2 AND b.year = $3
         AND (bc.kpi_roas IS NOT NULL OR bc.kpi_cpa IS NOT NULL OR bc.kpi_ctr IS NOT NULL
              OR bc.kpi_impression IS NOT NULL OR bc.kpi_conversion IS NOT NULL)`,
      [brandId, now.getMonth() + 1, now.getFullYear()]
    );

    if (channels.length === 0) {
      return res.status(404).json({ error: 'Bu marka için KPI girilmiş kanal bulunamadı.' });
    }

    // Son 30 günlük gerçek performans verilerini çek
    const { rows: metrics } = await pool.query(
      `SELECT i.platform,
              SUM(m.spend)::float              AS total_spend,
              AVG(NULLIF(m.roas, 0))::float    AS avg_roas,
              SUM(m.impressions)::bigint       AS total_impressions,
              SUM(m.clicks)::bigint            AS total_clicks,
              SUM(m.conversions)::bigint       AS total_conversions
       FROM ad_metrics m
       JOIN integrations i ON i.id = m.integration_id
       WHERE i.company_id = $1
         AND m.date >= NOW() - INTERVAL '30 days'
       GROUP BY i.platform`,
      [brandId]
    );

    const metricMap = Object.fromEntries(metrics.map(m => [m.platform, m]));

    // Her kanal için prompt verisi hazırla
    const channelLines = channels.map(ch => {
      const label = PLATFORM_LABELS[ch.platform] || ch.platform;
      const real = metricMap[ch.platform];
      const realCpa = real && parseInt(real.total_conversions) > 0
        ? (parseFloat(real.total_spend) / parseInt(real.total_conversions)).toFixed(0) : null;
      const realCtr = real && parseInt(real.total_impressions) > 0
        ? (parseInt(real.total_clicks) / parseInt(real.total_impressions) * 100).toFixed(2) : null;

      const kpiLines = [
        ch.kpi_roas        != null ? `  - Hedef ROAS: ${ch.kpi_roas}x` : null,
        ch.kpi_cpa         != null ? `  - Hedef CPA: ₺${ch.kpi_cpa}` : null,
        ch.kpi_ctr         != null ? `  - Hedef CTR: %${ch.kpi_ctr}` : null,
        ch.kpi_impression  != null ? `  - Hedef İmpresyon: ${Number(ch.kpi_impression).toLocaleString('tr-TR')}` : null,
        ch.kpi_conversion  != null ? `  - Hedef Dönüşüm: ${ch.kpi_conversion}` : null,
      ].filter(Boolean).join('\n');

      const realLines = real ? [
        `  - Gerçek Harcama: ₺${parseFloat(real.total_spend).toFixed(0)}`,
        real.avg_roas       ? `  - Gerçek ROAS: ${parseFloat(real.avg_roas).toFixed(2)}x` : null,
        realCtr             ? `  - Gerçek CTR: %${realCtr}` : null,
        realCpa             ? `  - Gerçek CPA: ₺${realCpa}` : null,
        real.total_impressions ? `  - Gerçek İmpresyon: ${Number(real.total_impressions).toLocaleString('tr-TR')}` : null,
        real.total_conversions ? `  - Gerçek Dönüşüm: ${real.total_conversions}` : null,
      ].filter(Boolean).join('\n') : '  - Gerçek veri yok (entegrasyon bağlı değil veya veri yok)';

      return `### ${label} (Bütçe: ₺${ch.amount?.toLocaleString?.('tr-TR') ?? ch.amount})\nKPI Hedefleri:\n${kpiLines}\nGerçek Performans (son 30 gün):\n${realLines}`;
    }).join('\n\n');

    const userPrompt = `${channelLines}\n\nBu verilere göre her kanal için:\n1) Hangi KPI'lar tutturuldu, hangisi kaçırıldı\n2) Neden kaçırıldı (varsa yorum)\n3) Ne yapılmalı (somut 1-2 öneri)\nSonunda genel bütçe optimizasyon tavsiyesi ver.`;

    // SSE stream başlat
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const { size: queueSize } = getQueueStatus();
    if (queueSize > 0) {
      res.write(`data: ${JSON.stringify({ queueStatus: 'queued', size: queueSize })}\n\n`);
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    await queueAiRequest(async ({ waitMs, startedAt }) => {
      res.write(`data: ${JSON.stringify({ queueStatus: 'processing' })}\n\n`);

      const stream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: 'Sen bir dijital reklam performans analistisin. Ajansın belirlediği KPI hedefleri ile gerçek performans verilerini karşılaştırarak somut ve uygulanabilir öneriler sun. Türkçe yanıt ver. Her kanal için ayrı değerlendir.',
        messages: [{ role: 'user', content: userPrompt }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      const final = await stream.finalMessage();
      const { input_tokens = 0, output_tokens = 0 } = final.usage || {};
      const processMs = Date.now() - startedAt;

      res.write('data: [DONE]\n\n');
      res.end();

      if (req.aiCtx) {
        logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'kpi_analysis', input_tokens, output_tokens, 'claude-sonnet-4-6', { waitMs, processMs, status: 'completed' });
      }
    }, { companyId: req.user.company_id, companyName: req.user.company_name, feature: 'kpi_analysis' });
  } catch (err) {
    if (err?.code === 'QUEUE_CLEARED') {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
      return;
    }
    console.error('[KPI Analysis] Hata:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
