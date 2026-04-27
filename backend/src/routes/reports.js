const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

async function resolveCompanyId(user, brandId) {
  if (user.company_type === 'agency' && brandId) {
    const { rows: [conn] } = await pool.query(
      'SELECT id FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
      [user.company_id, brandId]
    );
    if (!conn) throw Object.assign(new Error('Bu markaya erişiminiz yok.'), { status: 403 });
    return brandId;
  }
  return user.company_id;
}

// GET /api/reports
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = await resolveCompanyId(req.user, req.query.brand_id);
    const { rows } = await pool.query(
      `SELECT id, title, report_type, content, created_at
       FROM reports WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [companyId]
    );
    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/reports
router.post('/', authMiddleware, async (req, res) => {
  const { title, content, report_type, brand_id } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Başlık ve içerik zorunludur.' });
  try {
    const companyId = await resolveCompanyId(req.user, brand_id);
    const { rows: [report] } = await pool.query(
      `INSERT INTO reports (company_id, brand_id, title, content, report_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, report_type, created_at`,
      [companyId, brand_id || null, title, content, report_type || 'custom', req.user.user_id]
    );
    res.status(201).json(report);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /api/reports/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM reports WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/reports/generate — SSE streaming with Claude
router.post('/generate', authMiddleware, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI analiz şu an kullanılamıyor.' });
  }

  const { days = 30, platforms, report_type, audience, brand_id } = req.body;

  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const platformClause = platforms?.length ? 'AND i.platform = ANY($3)' : '';
    const params = platforms?.length ? [days, companyId, platforms] : [days, companyId];

    const { rows: integrations } = await pool.query(`
      SELECT i.platform, i.account_id,
        COALESCE(SUM(m.spend), 0)::float        AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int    AS total_conversions,
        COALESCE(SUM(m.clicks), 0)::int         AS total_clicks,
        COALESCE(SUM(m.impressions), 0)::int    AS total_impressions
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= CURRENT_DATE - ($1 || ' days')::interval
      WHERE i.company_id = $2 AND i.is_active = true ${platformClause}
      GROUP BY i.platform, i.account_id
    `, params);

    const { rows: prevRows } = await pool.query(`
      SELECT i.platform,
        COALESCE(SUM(m.spend), 0)::float AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int AS total_conversions
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= CURRENT_DATE - ($1 * 2 || ' days')::interval
        AND m.date <  CURRENT_DATE - ($1 || ' days')::interval
      WHERE i.company_id = $2 AND i.is_active = true ${platformClause}
      GROUP BY i.platform
    `, params);

    const { rows: [company] } = await pool.query(
      'SELECT name, sector FROM companies WHERE id = $1', [companyId]
    );

    const metricsText = integrations.length > 0
      ? integrations.map(m => {
          const prev = prevRows.find(p => p.platform === m.platform);
          const ctr = m.total_impressions > 0 ? (m.total_clicks / m.total_impressions * 100).toFixed(2) : '0';
          const cpa = m.total_conversions > 0 ? (m.total_spend / m.total_conversions).toFixed(2) : '—';
          const spendDiff = prev?.total_spend > 0
            ? ` (önceki döneme göre ${((m.total_spend - prev.total_spend) / prev.total_spend * 100).toFixed(1)}%)`
            : '';
          return `• ${m.platform}: Harcama ₺${Number(m.total_spend).toLocaleString('tr-TR')}${spendDiff}, ROAS ${Number(m.avg_roas).toFixed(2)}x, CPA ₺${cpa}, CTR %${ctr}, Dönüşüm ${m.total_conversions}`;
        }).join('\n')
      : 'Henüz veri bulunmamaktadır — genel dijital pazarlama önerileri sun.';

    const REPORT_TYPE_LABELS = {
      performance: 'Genel Performans Analizi',
      budget:      'Bütçe Optimizasyonu',
      benchmark:   'Sektör Benchmark Karşılaştırması',
      period:      'Dönem Karşılaştırma Raporu',
      channel:     'Kanal Etkinlik Analizi',
      forecast:    'Öngörü ve Tahmin Raporu',
    };
    const reportLabel  = REPORT_TYPE_LABELS[report_type] || 'Özel Analiz';
    const audienceNote = audience === 'agency'
      ? 'Ajans içi teknik rapor: tüm metrikler, derinlikli optimizasyon önerileri, teknik dil kullan.'
      : 'Marka yöneticisi sunumu: yönetici özeti öne çıkar, teknik jargondan kaçın, stratejik önerilere odaklan.';

    const systemPrompt = `Sen deneyimli bir dijital pazarlama uzmanı ve veri analistisin. Türkçe yaz. Profesyonel, akıcı ve somut bir dil kullan.

Rapor formatı (markdown):
# [Rapor Başlığı]

## Yönetici Özeti
(En önemli 3 bulgu, somut rakamlarla)

## Detaylı Analiz
(Her kanal veya konu için ayrı alt başlık, önceki dönemle kıyaslama)

## Öneriler
1. [Birinci öneri — öncelikli]
2. [İkinci öneri]
3. [Üçüncü öneri]

## Sonuç
(Kısa özet ve bir sonraki dönem için odak noktaları)

Rakamları kullan. Net ol. Tekrar yapma.`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Rapor Tipi: ${reportLabel}
Hedef Kitle: ${audienceNote}
Şirket: ${company?.name || 'Bilinmiyor'}
Sektör: ${company?.sector || 'Belirtilmemiş'}
Analiz Dönemi: Son ${days} gün

Kanal Metrikleri:
${metricsText}`,
      }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Report generate error:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
