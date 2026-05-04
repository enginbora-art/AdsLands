const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const DEFAULT_BENCH = { roas: 2.5, cpa: 120, ctr: 2.2, convRate: 2.5 };

async function getSectorBenchmarks() {
  try {
    const { rows } = await pool.query('SELECT sector, metric, value FROM sector_benchmarks ORDER BY sector');
    const map = {};
    for (const { sector, metric, value } of rows) {
      if (!map[sector]) map[sector] = {};
      // DB stores conv_rate, code uses convRate
      const key = metric === 'conv_rate' ? 'convRate' : metric;
      map[sector][key] = Number(value);
    }
    return map;
  } catch {
    return {};
  }
}

// POST /api/benchmark/analyze — SSE streaming AI analysis
router.post('/analyze', authMiddleware, async (req, res) => {
  const { metrics, sector } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY ayarlanmamış.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const sectorName = sector || 'Genel';
    const SECTOR_BENCHMARKS = await getSectorBenchmarks();
    const bench = SECTOR_BENCHMARKS[sectorName] || DEFAULT_BENCH;

    const hasData = metrics && (metrics.roas != null || metrics.cpa != null);
    const fmt2 = (v) => v != null ? v.toFixed(2) : '—';
    const fmt0 = (v) => v != null ? v.toFixed(0) : '—';

    const metricsText = hasData
      ? `Şirketin mevcut performans verileri (son 30 gün):
- ROAS: ${fmt2(metrics.roas)}x
- CPA (dönüşüm başı maliyet): ₺${fmt0(metrics.cpa)}
- CTR (tıklama oranı): %${fmt2(metrics.ctr)}
- Dönüşüm oranı: %${fmt2(metrics.convRate)}`
      : `Şirkete ait yeterli performans verisi henüz mevcut değil. ${sectorName} sektöründeki genel benchmark değerlerini açıkla ve bir şirketin bu değerlere ulaşmak için neler yapması gerektiğini anlat.`;

    const prompt = `${metricsText}

${sectorName} sektörü benchmark ortalamaları:
- ROAS: ${bench.roas}x
- CPA: ₺${bench.cpa}
- CTR: %${bench.ctr}
- Dönüşüm oranı: %${bench.convRate}

Şu başlıklar altında kapsamlı bir benchmark analizi yaz (Türkçe, markdown formatında):

## Genel Değerlendirme
## Güçlü Yönler
## İyileştirilmesi Gereken Alanlar
## Somut Öneriler
## Kısa Vadeli Hedefler

Her bölüm somut rakamlar, sektörle yüzde farklar ve uygulanabilir öneriler içermeli. Maksimum 700 kelime.`;

    const stream = await client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system: 'Sen deneyimli bir dijital reklam ve performans pazarlama danışmanısın. Sektör benchmark verileriyle karşılaştırmalı analiz yapıyorsun ve somut, uygulanabilir öneriler sunuyorsun. Türkçe yaz, profesyonel ve özlü ol.',
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[benchmark/analyze]', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
