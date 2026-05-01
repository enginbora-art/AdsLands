const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const pptxService = require('../services/pptxService');
const { checkAiLimit, logAiUsage } = require('../middleware/aiLimit');
const { queueAiRequest, getQueueStatus } = require('../services/aiQueue');

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
      `SELECT id, title, report_type, content, format, file_url, created_at
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
router.post('/generate', authMiddleware, checkAiLimit('ai_report'), async (req, res) => {
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

    const { size: queueSize } = getQueueStatus();
    if (queueSize > 0) {
      res.write(`data: ${JSON.stringify({ queueStatus: 'queued', size: queueSize })}\n\n`);
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    await queueAiRequest(async ({ waitMs, startedAt }) => {
      res.write(`data: ${JSON.stringify({ queueStatus: 'processing' })}\n\n`);

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

      const final = await stream.finalMessage();
      const { input_tokens = 0, output_tokens = 0 } = final.usage || {};
      const processMs = Date.now() - startedAt;

      res.write('data: [DONE]\n\n');
      res.end();

      if (req.aiCtx) {
        logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'ai_report', input_tokens, output_tokens, 'claude-opus-4-7', { waitMs, processMs, status: 'completed' });
      }
    }, { companyId: req.user.company_id, companyName: req.user.company_name, feature: 'ai_report' });
  } catch (err) {
    if (err?.code === 'QUEUE_CLEARED') {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
      return;
    }
    console.error('Report generate error:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// GET /api/reports/download/:fileId — serve generated PPTX (no auth, fileId is secret UUID)
router.get('/download/:fileId', (req, res) => {
  const filePath = pptxService.getFilePath(req.params.fileId);
  if (!filePath) return res.status(404).json({ error: 'Dosya bulunamadı veya süresi doldu.' });
  res.download(filePath, 'adslands-raporu.pptx');
});

// POST /api/reports/generate-pptx — visual PPTX report with pptxgenjs
router.post('/generate-pptx', authMiddleware, checkAiLimit('ai_report'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI analiz şu an kullanılamıyor.' });
  }

  const { days = 30, platforms, report_type = 'brand', slides, brand_id } = req.body;

  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const platformClause = platforms?.length ? 'AND i.platform = ANY($3)' : '';
    const params = platforms?.length ? [days, companyId, platforms] : [days, companyId];

    // Aggregated metrics per channel
    const { rows: integrations } = await pool.query(`
      SELECT i.platform, i.account_id,
        COALESCE(SUM(m.spend), 0)::float           AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int       AS total_conversions,
        COALESCE(SUM(m.clicks), 0)::int            AS total_clicks,
        COALESCE(SUM(m.impressions), 0)::int       AS total_impressions
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= CURRENT_DATE - ($1 || ' days')::interval
      WHERE i.company_id = $2 AND i.is_active = true ${platformClause}
      GROUP BY i.platform, i.account_id
    `, params);

    // Daily trend data
    const { rows: dailyData } = await pool.query(`
      SELECT m.date,
        COALESCE(SUM(m.spend), 0)::float           AS daily_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS daily_roas
      FROM ad_metrics m
      JOIN integrations i ON i.id = m.integration_id
      WHERE i.company_id = $2 AND i.is_active = true
        AND m.date >= CURRENT_DATE - ($1 || ' days')::interval
        ${platformClause}
      GROUP BY m.date
      ORDER BY m.date
    `, params);

    const { rows: [company] } = await pool.query(
      'SELECT name, sector FROM companies WHERE id = $1', [companyId]
    );

    // Compute aggregate metrics
    const totalSpend    = integrations.reduce((s, r) => s + r.total_spend, 0);
    const avgRoas       = integrations.length
      ? integrations.reduce((s, r) => s + r.avg_roas, 0) / integrations.filter(r => r.avg_roas > 0).length || 0
      : 0;
    const totalConv     = integrations.reduce((s, r) => s + r.total_conversions, 0);
    const totalClicks   = integrations.reduce((s, r) => s + r.total_clicks, 0);
    const totalImpressions = integrations.reduce((s, r) => s + r.total_impressions, 0);
    const avgCpa        = totalConv > 0 ? totalSpend / totalConv : 0;
    const avgCtr        = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const metricsText = integrations.length > 0
      ? integrations.map(m => {
          const ctr = m.total_impressions > 0 ? (m.total_clicks / m.total_impressions * 100).toFixed(2) : '0';
          const cpa = m.total_conversions > 0 ? (m.total_spend / m.total_conversions).toFixed(0) : '0';
          return `• ${m.platform}: Harcama ₺${Number(m.total_spend).toLocaleString('tr-TR')}, ROAS ${Number(m.avg_roas).toFixed(2)}x, CPA ₺${cpa}, CTR %${ctr}, Dönüşüm ${m.total_conversions}`;
        }).join('\n')
      : 'Henüz veri yok.';

    // Call Claude for structured analysis JSON
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const aiResponse = await queueAiRequest(async ({ waitMs, startedAt }) => {
      const resp = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1200,
      system: `Sen bir dijital pazarlama uzmanısın. Verilen reklam metriklerini analiz et ve SADECE aşağıdaki JSON formatında yanıt ver, başka metin ekleme:

{
  "summary": ["Yönetici özeti madde 1 (somut rakamlarla, 1-2 cümle)", "Madde 2", "Madde 3"],
  "recommendations": [
    { "title": "Kısa aksiyon başlığı", "description": "1-2 cümle somut açıklama.", "priority": "high" },
    { "title": "...", "description": "...", "priority": "medium" },
    { "title": "...", "description": "...", "priority": "low" }
  ],
  "strengths": ["Güçlü yön 1", "Güçlü yön 2", "Güçlü yön 3"],
  "improvements": ["Gelişim alanı 1", "Gelişim alanı 2", "Gelişim alanı 3"]
}

priority değerleri: "high", "medium", "low". Türkçe yaz.`,
      messages: [{
        role: 'user',
        content: `Şirket: ${company?.name || 'Bilinmiyor'} | Sektör: ${company?.sector || 'Belirtilmemiş'}
Analiz dönemi: Son ${days} gün
Rapor tipi: ${report_type === 'agency' ? 'Ajans teknik raporu' : 'Marka sunumu'}

Kanal metrikleri:
${metricsText}

Toplam harcama: ₺${Number(totalSpend).toLocaleString('tr-TR')}
Ortalama ROAS: ${Number(avgRoas).toFixed(2)}x
Toplam dönüşüm: ${totalConv}
Ortalama CPA: ₺${Math.round(avgCpa)}
Ortalama CTR: %${avgCtr.toFixed(2)}`,
      }]
      });
      if (req.aiCtx && resp.usage) {
        const processMs = Date.now() - startedAt;
        logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'ai_report', resp.usage.input_tokens || 0, resp.usage.output_tokens || 0, 'claude-opus-4-7', { waitMs, processMs, status: 'completed' });
      }
      return resp;
    }, { companyId: req.user.company_id, companyName: req.user.company_name, feature: 'ai_report' });

    let aiData = { summary: [], recommendations: [], strengths: [], improvements: [] };
    try {
      const rawText = aiResponse.content[0]?.text || '{}';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      aiData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch { /* use defaults */ }

    // Build metrics object for slides
    const metrics = {
      roas:   `${Number(avgRoas).toFixed(2)}x`,
      spend:  `₺${Number(totalSpend).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
      conv:   totalConv.toLocaleString('tr-TR'),
      cpa:    avgCpa > 0 ? `₺${Math.round(avgCpa)}` : '—',
      roasNum: avgRoas,
      cpaNum:  avgCpa,
      ctrNum:  avgCtr,
    };

    const period = `Son ${days} gün`;
    const brandName  = company?.name || 'Marka';
    const agencyName = req.user.company_type === 'agency' ? req.user.company_name : null;

    const { fileId } = await pptxService.generatePptx({
      brandName,
      agencyName,
      period,
      reportType: report_type,
      slides,
      metrics,
      summaryBullets:  aiData.summary || [],
      channelData:     integrations,
      dailyData,
      recommendations: aiData.recommendations || [],
      strengths:       aiData.strengths || [],
      improvements:    aiData.improvements || [],
    });

    res.json({
      fileId,
      downloadUrl: `/api/reports/download/${fileId}`,
      brandName,
      period,
      metrics,
    });
  } catch (err) {
    if (err?.code === 'QUEUE_CLEARED') {
      return res.status(503).json({ error: err.message });
    }
    console.error('generate-pptx error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Rapor oluşturulamadı.' });
  }
});

// POST /api/reports/build — Template-based PPT/PDF builder that saves to DB
router.post('/build', authMiddleware, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI analiz şu an kullanılamıyor.' });
  }

  const { days = 30, report_type = 'brand', slides, format = 'pptx', brand_id } = req.body;

  try {
    const companyId = await resolveCompanyId(req.user, brand_id);

    const { rows: integrations } = await pool.query(`
      SELECT i.platform, i.account_id,
        COALESCE(SUM(m.spend), 0)::float           AS total_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS avg_roas,
        COALESCE(SUM(m.conversions), 0)::int       AS total_conversions,
        COALESCE(SUM(m.clicks), 0)::int            AS total_clicks,
        COALESCE(SUM(m.impressions), 0)::int       AS total_impressions
      FROM integrations i
      LEFT JOIN ad_metrics m ON m.integration_id = i.id
        AND m.date >= CURRENT_DATE - ($1 || ' days')::interval
      WHERE i.company_id = $2 AND i.is_active = true
      GROUP BY i.platform, i.account_id
    `, [days, companyId]);

    const { rows: dailyData } = await pool.query(`
      SELECT m.date,
        COALESCE(SUM(m.spend), 0)::float           AS daily_spend,
        COALESCE(AVG(NULLIF(m.roas, 0)), 0)::float AS daily_roas
      FROM ad_metrics m
      JOIN integrations i ON i.id = m.integration_id
      WHERE i.company_id = $2 AND i.is_active = true
        AND m.date >= CURRENT_DATE - ($1 || ' days')::interval
      GROUP BY m.date ORDER BY m.date
    `, [days, companyId]);

    const { rows: [company] } = await pool.query(
      'SELECT name, sector FROM companies WHERE id = $1', [companyId]
    );

    const totalSpend    = integrations.reduce((s, r) => s + r.total_spend, 0);
    const validRoas     = integrations.filter(r => r.avg_roas > 0);
    const avgRoas       = validRoas.length ? validRoas.reduce((s, r) => s + r.avg_roas, 0) / validRoas.length : 0;
    const totalConv     = integrations.reduce((s, r) => s + r.total_conversions, 0);
    const totalClicks   = integrations.reduce((s, r) => s + r.total_clicks, 0);
    const totalImpressions = integrations.reduce((s, r) => s + r.total_impressions, 0);
    const avgCpa        = totalConv > 0 ? totalSpend / totalConv : 0;
    const avgCtr        = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const metricsText = integrations.length > 0
      ? integrations.map(m => {
          const ctr = m.total_impressions > 0 ? (m.total_clicks / m.total_impressions * 100).toFixed(2) : '0';
          const cpa = m.total_conversions > 0 ? (m.total_spend / m.total_conversions).toFixed(0) : '0';
          return `• ${m.platform}: Harcama ₺${Number(m.total_spend).toLocaleString('tr-TR')}, ROAS ${Number(m.avg_roas).toFixed(2)}x, CPA ₺${cpa}, CTR %${ctr}`;
        }).join('\n')
      : 'Henüz veri yok.';

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const aiResponse = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1200,
      system: `Sen bir dijital pazarlama uzmanısın. Verilen reklam metriklerini analiz et ve SADECE aşağıdaki JSON formatında yanıt ver:
{"summary":["Özet 1","Özet 2","Özet 3"],"recommendations":[{"title":"Başlık","description":"Açıklama","priority":"high"},{"title":"...","description":"...","priority":"medium"},{"title":"...","description":"...","priority":"low"}],"strengths":["Güçlü 1","Güçlü 2","Güçlü 3"],"improvements":["Gelişim 1","Gelişim 2","Gelişim 3"]}
priority değerleri: "high","medium","low". Türkçe yaz.`,
      messages: [{
        role: 'user',
        content: `Şirket: ${company?.name || 'Bilinmiyor'} | Sektör: ${company?.sector || 'Belirtilmemiş'}
Analiz dönemi: Son ${days} gün | Rapor tipi: ${report_type === 'agency' ? 'Ajans teknik raporu' : 'Marka sunumu'}
Kanal metrikleri:\n${metricsText}
Toplam harcama: ₺${Number(totalSpend).toLocaleString('tr-TR')} | Ort. ROAS: ${Number(avgRoas).toFixed(2)}x | Toplam dönüşüm: ${totalConv} | Ort. CPA: ₺${Math.round(avgCpa)} | CTR: %${avgCtr.toFixed(2)}`,
      }],
    });

    let aiData = { summary: [], recommendations: [], strengths: [], improvements: [] };
    try {
      const rawText = aiResponse.content[0]?.text || '{}';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      aiData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch { /* use defaults */ }

    const metrics = {
      roas:    `${Number(avgRoas).toFixed(2)}x`,
      spend:   `₺${Number(totalSpend).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
      conv:    totalConv.toLocaleString('tr-TR'),
      cpa:     avgCpa > 0 ? `₺${Math.round(avgCpa)}` : '—',
      roasNum: avgRoas,
      cpaNum:  avgCpa,
      ctrNum:  avgCtr,
    };

    const period    = `Son ${days} gün`;
    const brandName = company?.name || 'Marka';
    const agencyName = req.user.company_type === 'agency' ? req.user.company_name : null;

    const { fileId } = await pptxService.generatePptx({
      brandName, agencyName, period,
      reportType: report_type,
      slides,
      metrics,
      summaryBullets:  aiData.summary || [],
      channelData:     integrations,
      dailyData,
      recommendations: aiData.recommendations || [],
      strengths:       aiData.strengths || [],
      improvements:    aiData.improvements || [],
    });

    const downloadUrl  = `/api/reports/download/${fileId}`;
    const reportTitle  = `${brandName} — ${period}`;
    const contentJson  = JSON.stringify({ period, format, channels: integrations.length, totalSpend: Math.round(totalSpend), avgRoas: Number(avgRoas).toFixed(2) });

    const { rows: [saved] } = await pool.query(
      `INSERT INTO reports (company_id, brand_id, title, content, report_type, format, file_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [companyId, brand_id || null, reportTitle, contentJson, report_type, format, downloadUrl, req.user.user_id]
    );

    res.json({ fileId, downloadUrl, brandName, period, metrics, reportId: saved.id });
  } catch (err) {
    console.error('reports/build error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Rapor oluşturulamadı.' });
  }
});

module.exports = router;
