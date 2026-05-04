const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkAiLimit, logAiUsage } = require('../middleware/aiLimit');
const { queueAiRequest, getQueueStatus } = require('../services/aiQueue');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

const VALID_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust', 'adform', 'linkedin'];

async function resolveCompanyId(user, brandId) {
  if (user.company_type === 'agency') {
    if (!brandId) throw Object.assign(new Error('brand_id zorunludur.'), { status: 400 });
    const { rows: [conn] } = await pool.query(
      'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
      [user.company_id, brandId]
    );
    if (!conn) throw Object.assign(new Error('Bu markaya erişiminiz yok.'), { status: 403 });
    return brandId;
  }
  return user.company_id;
}

// GET /api/channels?days=30&platform=all&brand_id=xxx
// OR:  ?start_date=2026-04-01&end_date=2026-04-30&platform=all&brand_id=xxx
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const platformFilter = req.query.platform && VALID_PLATFORMS.includes(req.query.platform)
      ? req.query.platform : null;

    // Resolve date range — explicit start/end takes priority over days
    let startDate, endDate, prevStartDate, prevEndDate;
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (req.query.start_date && req.query.end_date
        && DATE_RE.test(req.query.start_date) && DATE_RE.test(req.query.end_date)) {
      startDate = req.query.start_date;
      endDate   = req.query.end_date;
      const s   = new Date(startDate);
      const e   = new Date(endDate);
      if (isNaN(s) || isNaN(e) || e < s) return res.status(400).json({ error: 'Geçersiz tarih aralığı.' });
      const diffMs  = e.getTime() - s.getTime();
      const prevE   = new Date(s.getTime() - 86400000);
      const prevS   = new Date(prevE.getTime() - diffMs);
      prevStartDate = prevS.toISOString().split('T')[0];
      prevEndDate   = prevE.toISOString().split('T')[0];
    } else {
      const days = Math.min(parseInt(req.query.days) || 30, 365);
      const now  = new Date();
      const s    = new Date(now); s.setDate(now.getDate() - days);
      const pS   = new Date(now); pS.setDate(now.getDate() - days * 2);
      const pE   = new Date(now); pE.setDate(now.getDate() - days - 1);
      startDate     = s.toISOString().split('T')[0];
      endDate       = now.toISOString().split('T')[0];
      prevStartDate = pS.toISOString().split('T')[0];
      prevEndDate   = pE.toISOString().split('T')[0];
    }

    const { rows: [company] } = await pool.query(
      'SELECT sector FROM companies WHERE id = $1', [companyId]
    );

    const platformClause = platformFilter ? 'AND i.platform = $4' : '';
    const params     = platformFilter ? [startDate, endDate, companyId, platformFilter] : [startDate, endDate, companyId];
    const prevParams = platformFilter ? [prevStartDate, prevEndDate, companyId, platformFilter] : [prevStartDate, prevEndDate, companyId];

    const { rows: integrations } = await pool.query(`
      SELECT i.id, i.platform, i.account_id,
        COALESCE(SUM(m.spend), 0)::float        AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int    AS total_conversions,
        COALESCE(SUM(m.clicks), 0)::int         AS total_clicks,
        COALESCE(SUM(m.impressions), 0)::int    AS total_impressions
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= $1 AND m.date <= $2
      WHERE i.company_id = $3 AND i.is_active = true ${platformClause}
      GROUP BY i.id
    `, params);

    const { rows: prevIntegrations } = await pool.query(`
      SELECT i.id, i.platform,
        COALESCE(SUM(m.spend), 0)::float           AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int       AS total_conversions,
        COALESCE(SUM(m.clicks), 0)::int            AS total_clicks
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= $1 AND m.date <= $2
      WHERE i.company_id = $3 AND i.is_active = true ${platformClause}
      GROUP BY i.id
    `, prevParams);

    const { rows: dailyMetrics } = await pool.query(`
      SELECT m.date::text, i.platform,
        SUM(m.spend)::float            AS spend,
        AVG(NULLIF(m.roas, 0))::float  AS roas
      FROM ad_metrics m
      JOIN integrations i ON i.id = m.integration_id
      WHERE i.company_id = $1
        AND m.date >= $2 AND m.date <= $3
        AND i.is_active = true
      GROUP BY m.date, i.platform
      ORDER BY m.date
    `, [companyId, startDate, endDate]);

    const { rows: anomalyRows } = await pool.query(`
      SELECT DISTINCT a.detected_at::date::text AS date
      FROM anomalies a
      JOIN integrations i ON a.integration_id = i.id
      WHERE a.company_id = $1
        AND a.detected_at::date >= $2 AND a.detected_at::date <= $3
    `, [companyId, startDate, endDate]);

    // Bu ayın KPI hedefleri — platform filtresi bağımsız, her zaman tümü gelir
    const now = new Date();
    const { rows: kpiRows } = await pool.query(`
      SELECT bc.platform,
             bc.kpi_roas::float, bc.kpi_cpa::float, bc.kpi_ctr::float,
             bc.kpi_impression::int, bc.kpi_conversion::int
      FROM budget_channels bc
      JOIN budgets b ON b.id = bc.budget_id
      WHERE b.company_id = $1
        AND b.month = $2 AND b.year = $3
        AND (bc.kpi_roas IS NOT NULL OR bc.kpi_cpa IS NOT NULL OR bc.kpi_ctr IS NOT NULL
             OR bc.kpi_impression IS NOT NULL OR bc.kpi_conversion IS NOT NULL)
    `, [companyId, now.getMonth() + 1, now.getFullYear()]);

    const kpi_targets = Object.fromEntries(kpiRows.map(r => [r.platform, {
      kpi_roas:       r.kpi_roas,
      kpi_cpa:        r.kpi_cpa,
      kpi_ctr:        r.kpi_ctr,
      kpi_impression: r.kpi_impression,
      kpi_conversion: r.kpi_conversion,
    }]));

    res.json({
      sector: company?.sector || null,
      integrations,
      prevIntegrations,
      dailyMetrics,
      anomalyDates: anomalyRows.map(r => r.date),
      kpi_targets,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

// POST /api/channels/ai-analyze — SSE streaming
router.post('/ai-analyze', authMiddleware, requireActiveSubscription, checkAiLimit('channel_analysis'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI analiz şu an kullanılamıyor.' });
  }

  const { metrics, sector, benchmarks, days } = req.body;
  if (!metrics?.length) return res.status(400).json({ error: 'Metrik verisi gerekli.' });

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const metricsText = metrics.map(m =>
    `• ${m.platform}: Harcama ₺${Number(m.spend).toLocaleString('tr-TR')}, ROAS ${Number(m.roas).toFixed(2)}x, CPA ₺${m.cpa || '—'}, CTR %${Number(m.ctr).toFixed(2)}, Dönüşüm ${m.conversions}`
  ).join('\n');

  const bmText = (benchmarks || []).map(b =>
    `• ${b.platform}: ROAS ${b.roas}x, CTR %${b.ctr}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const { size: queueSize } = getQueueStatus();
  if (queueSize > 0) {
    res.write(`data: ${JSON.stringify({ queueStatus: 'queued', size: queueSize })}\n\n`);
  }

  try {
    await queueAiRequest(async ({ waitMs, startedAt }) => {
      res.write(`data: ${JSON.stringify({ queueStatus: 'processing' })}\n\n`);

      const stream = client.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 1400,
        system: `Sen deneyimli bir dijital pazarlama uzmanısın. Türkçe yaz. Verilen reklam performans verilerini sektör benchmarklarıyla karşılaştırarak analiz et. Şunları ver:
1. Genel performans değerlendirmesi (2-3 cümle)
2. En iyi performans gösteren kanal ve neden
3. Geliştirilmesi gereken kanal ve somut öneriler
4. 3 uygulanabilir aksiyon önerisi (öncelik sırasıyla)
5. Bütçe optimizasyon tavsiyesi
Teknik jargon kullanma, net ve anlaşılır ol.`,
        messages: [{
          role: 'user',
          content: `Sektör: ${sector || 'Diğer'}\nAnaliz dönemi: Son ${days || 30} gün\n\nKanal Performansı:\n${metricsText}\n\nSektör Benchmarkları:\n${bmText}`,
        }],
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }

      const final = await stream.finalMessage();
      const { input_tokens = 0, output_tokens = 0 } = final.usage || {};
      const processMs = Date.now() - startedAt;

      res.write('data: [DONE]\n\n');
      res.end();

      if (req.aiCtx) {
        logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'channel_analysis', input_tokens, output_tokens, 'claude-opus-4-7', { waitMs, processMs, status: 'completed' });
      }
    }, { companyId: req.user.company_id, companyName: req.user.company_name, feature: 'channel_analysis' });
  } catch (err) {
    if (err?.code === 'QUEUE_CLEARED') {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
      return;
    }
    console.error('AI analyze error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI analiz başarısız: ' + err.message });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: 'AI analiz başarısız: ' + err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
