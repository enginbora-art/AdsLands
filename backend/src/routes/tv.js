'use strict';

const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { checkAiLimit, logAiUsage } = require('../middleware/aiLimit');
const { queueAiRequest } = require('../services/aiQueue');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

async function updatePlanTotals(planId) {
  const { rows: [sums] } = await pool.query(`
    SELECT
      COALESCE(SUM(spot_price), 0) AS total_budget,
      COALESCE(SUM(grp), 0)        AS total_grp
    FROM tv_plan_items WHERE plan_id = $1
  `, [planId]);
  await pool.query(
    'UPDATE tv_media_plans SET total_budget = $1, total_grp = $2 WHERE id = $3',
    [sums.total_budget, sums.total_grp, planId]
  );
}

async function notifyBrand(planId, agencyCompanyId, brandId, planName, month, year) {
  if (!brandId || brandId === agencyCompanyId) return;

  const [
    { rows: brandUsers },
    { rows: [agency] },
    { rows: [brandCo] },
    { rows: items },
  ] = await Promise.all([
    pool.query(
      'SELECT id, email, full_name, is_company_admin FROM users WHERE company_id = $1 AND is_active = true',
      [brandId]
    ),
    pool.query('SELECT name FROM companies WHERE id = $1', [agencyCompanyId]),
    pool.query('SELECT name FROM companies WHERE id = $1', [brandId]),
    pool.query(
      'SELECT DISTINCT channel_name FROM tv_plan_items WHERE plan_id = $1',
      [planId]
    ),
  ]);

  if (!brandUsers.length) return;

  const agencyName = agency?.name || 'Ajans';
  const brandName  = brandCo?.name || 'Marka';
  const monthName  = MONTHS[month - 1] || '';
  const channelList = items.map(i => i.channel_name).join(', ') || '—';

  // Platform bildirimleri
  for (const u of brandUsers) {
    await pool.query(`
      INSERT INTO notifications (user_id, company_id, type, title, message, meta)
      VALUES ($1, $2, 'tv_plan', $3, $4, $5)
    `, [
      u.id, brandId,
      `${agencyName} TV Medya Planı Hazırladı`,
      `"${planName}" planı (${monthName} ${year}) oluşturuldu.`,
      JSON.stringify({ plan_id: planId, plan_name: planName, month, year }),
    ]);
  }

  // E-posta
  if (!process.env.RESEND_API_KEY) return;
  const recipient = brandUsers.find(u => u.is_company_admin) || brandUsers[0];
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: recipient.email,
      subject: `${agencyName} TV Medya Planı Hazırladı`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
          <div style="margin-bottom:24px;">
            <span style="font-size:20px;font-weight:700;">Ads<span style="color:#1D9E75;">Lands</span></span>
          </div>
          <h2 style="font-size:20px;font-weight:700;margin:0 0 16px;">📺 TV Medya Planı Hazırlandı</h2>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 20px;">
            <strong style="color:#F0F5F3;">${agencyName}</strong> ajansı,
            <strong style="color:#F0F5F3;">${brandName}</strong> markası için yeni bir TV medya planı oluşturdu.
          </p>
          <div style="background:#131D24;border-radius:8px;padding:20px;margin-bottom:24px;">
            <div style="margin-bottom:10px;"><span style="color:#9CA3AF;font-size:12px;">PLAN ADI</span><br/><strong style="font-size:16px;">${planName}</strong></div>
            <div style="margin-bottom:10px;"><span style="color:#9CA3AF;font-size:12px;">DÖNEM</span><br/><strong>${monthName} ${year}</strong></div>
            <div><span style="color:#9CA3AF;font-size:12px;">KANALLAR</span><br/><strong>${channelList}</strong></div>
          </div>
          <p style="color:#94A8B3;font-size:13px;line-height:1.6;">
            Detayları görmek için AdsLands platformuna giriş yapın.
          </p>
        </div>
      `,
    });
  } catch { /* email hatası kritik değil */ }
}

// ── TV Kampanyaları ────────────────────────────────────────────────────────────

router.get('/campaigns', authMiddleware, async (req, res) => {
  const { brandId } = req.query;
  const cid = req.user.company_id;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tv_campaigns
       WHERE company_id = $1 ${brandId ? 'OR brand_id = $2' : ''}
       ORDER BY created_at DESC`,
      brandId ? [cid, brandId] : [cid]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', authMiddleware, async (req, res) => {
  const { name, brand_id, status = 'active' } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Kampanya adı zorunludur.' });
  try {
    const { rows: [c] } = await pool.query(
      `INSERT INTO tv_campaigns (company_id, brand_id, name, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.company_id, brand_id || null, name.trim(), status]
    );
    res.status(201).json(c);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TV Medya Planları ──────────────────────────────────────────────────────────

router.get('/plans', authMiddleware, async (req, res) => {
  const { brandId } = req.query;
  const cid = req.user.company_id;
  const filterBrand = brandId || cid;
  try {
    const { rows } = await pool.query(`
      SELECT
        p.*,
        c.name AS creator_name,
        COUNT(i.id)::int                                                  AS spot_count,
        COUNT(DISTINCT i.channel_code)::int                               AS channel_count,
        COUNT(CASE WHEN i.status = 'detected' THEN 1 END)::int            AS detected_count,
        COUNT(CASE WHEN i.status = 'missed'   THEN 1 END)::int            AS missed_count,
        COUNT(CASE WHEN i.status = 'planned'  THEN 1 END)::int            AS planned_count
      FROM tv_media_plans p
      JOIN companies c ON c.id = p.company_id
      LEFT JOIN tv_plan_items i ON i.plan_id = p.id
      WHERE p.company_id = $1 OR p.brand_id = $2
      GROUP BY p.id, c.name
      ORDER BY p.created_at DESC
    `, [cid, filterBrand]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plans/:id', authMiddleware, async (req, res) => {
  const cid = req.user.company_id;
  try {
    const { rows: [plan] } = await pool.query(`
      SELECT p.*, c.name AS creator_name
      FROM tv_media_plans p
      JOIN companies c ON c.id = p.company_id
      WHERE p.id = $1 AND (p.company_id = $2 OR p.brand_id = $2)
    `, [req.params.id, cid]);
    if (!plan) return res.status(404).json({ error: 'Plan bulunamadı.' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans', authMiddleware, async (req, res) => {
  const { campaign_id, plan_name, month, year, brand_id, status = 'draft' } = req.body;
  if (!plan_name?.trim() || !month || !year) {
    return res.status(400).json({ error: 'Plan adı, ay ve yıl zorunludur.' });
  }
  try {
    const { rows: [plan] } = await pool.query(`
      INSERT INTO tv_media_plans (campaign_id, company_id, brand_id, plan_name, month, year, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [
      campaign_id || null, req.user.company_id,
      brand_id || null, plan_name.trim(),
      month, year, status,
    ]);

    // Bildirim gönder (hata olsa da devam et)
    notifyBrand(plan.id, req.user.company_id, brand_id, plan_name.trim(), month, year)
      .catch(() => {});

    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/plans/:id', authMiddleware, async (req, res) => {
  const { plan_name, status } = req.body;
  try {
    const { rows: [plan] } = await pool.query(
      `UPDATE tv_media_plans SET
         plan_name = COALESCE($1, plan_name),
         status    = COALESCE($2, status)
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [plan_name || null, status || null, req.params.id, req.user.company_id]
    );
    if (!plan) return res.status(404).json({ error: 'Plan bulunamadı.' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/plans/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM tv_media_plans WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TV Plan Kalemleri ──────────────────────────────────────────────────────────

router.get('/plans/:id/items', authMiddleware, async (req, res) => {
  const cid = req.user.company_id;
  try {
    // erişim kontrolü
    const { rows: [plan] } = await pool.query(
      'SELECT id FROM tv_media_plans WHERE id = $1 AND (company_id = $2 OR brand_id = $2)',
      [req.params.id, cid]
    );
    if (!plan) return res.status(403).json({ error: 'Erişim yetkisi yok.' });

    const { rows } = await pool.query(
      'SELECT * FROM tv_plan_items WHERE plan_id = $1 ORDER BY broadcast_date, broadcast_time_start',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plans/:id/items', authMiddleware, async (req, res) => {
  const {
    channel_code, channel_name, broadcast_date, daypart,
    broadcast_time_start, broadcast_time_end,
    spot_duration = 30, grp = 0, spot_price = 0,
  } = req.body;

  if (!channel_code || !channel_name) {
    return res.status(400).json({ error: 'Kanal bilgisi zorunludur.' });
  }

  try {
    // sadece plan sahibi ekleyebilir
    const { rows: [plan] } = await pool.query(
      'SELECT id FROM tv_media_plans WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!plan) return res.status(403).json({ error: 'Bu plana erişim yetkiniz yok.' });

    const { rows: [item] } = await pool.query(`
      INSERT INTO tv_plan_items
        (plan_id, channel_code, channel_name, broadcast_date, daypart,
         broadcast_time_start, broadcast_time_end, spot_duration,
         grp, spot_price, total_cost, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,'planned')
      RETURNING *
    `, [
      req.params.id, channel_code, channel_name,
      broadcast_date || null, daypart || null,
      broadcast_time_start || null, broadcast_time_end || null,
      spot_duration, grp, spot_price,
    ]);

    await updatePlanTotals(req.params.id);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/plans/:id/items/:itemId', authMiddleware, async (req, res) => {
  const allowed = ['status', 'grp', 'spot_price', 'broadcast_date',
    'broadcast_time_start', 'broadcast_time_end', 'daypart', 'spot_duration'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Güncellenecek alan yok.' });

  try {
    const { rows: [plan] } = await pool.query(
      'SELECT id FROM tv_media_plans WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!plan) return res.status(403).json({ error: 'Erişim yetkisi yok.' });

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = [req.params.itemId, ...Object.values(updates)];
    const { rows: [item] } = await pool.query(
      `UPDATE tv_plan_items SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    if (!item) return res.status(404).json({ error: 'Kalem bulunamadı.' });

    await updatePlanTotals(req.params.id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/plans/:id/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const { rows: [plan] } = await pool.query(
      'SELECT id FROM tv_media_plans WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    if (!plan) return res.status(403).json({ error: 'Erişim yetkisi yok.' });

    await pool.query(
      'DELETE FROM tv_plan_items WHERE id = $1 AND plan_id = $2',
      [req.params.itemId, req.params.id]
    );
    await updatePlanTotals(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Plan Özeti ─────────────────────────────────────────────────────────────────

router.get('/plans/:id/summary', authMiddleware, async (req, res) => {
  const cid = req.user.company_id;
  try {
    const { rows: [plan] } = await pool.query(
      'SELECT * FROM tv_media_plans WHERE id = $1 AND (company_id = $2 OR brand_id = $2)',
      [req.params.id, cid]
    );
    if (!plan) return res.status(404).json({ error: 'Plan bulunamadı.' });

    const { rows: channelSummary } = await pool.query(`
      SELECT
        channel_code, channel_name,
        COUNT(*)::int                                       AS spot_count,
        COALESCE(SUM(grp), 0)::float                       AS total_grp,
        COALESCE(SUM(spot_price), 0)::float                AS total_spend,
        COUNT(CASE WHEN status='detected' THEN 1 END)::int AS detected
      FROM tv_plan_items WHERE plan_id = $1
      GROUP BY channel_code, channel_name
      ORDER BY total_spend DESC
    `, [req.params.id]);

    const { rows: statusCounts } = await pool.query(`
      SELECT status, COUNT(*)::int AS cnt
      FROM tv_plan_items WHERE plan_id = $1
      GROUP BY status
    `, [req.params.id]);

    const counts = {};
    for (const r of statusCounts) counts[r.status] = r.cnt;

    res.json({ plan, channelSummary, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── TV AI Öneri Sistemi ───────────────────────────────────────────────────────

const DOW_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

router.post('/plans/:id/ai-suggest', authMiddleware, requireActiveSubscription,
  checkAiLimit('tv_ai_suggest'), async (req, res) => {
  try {
    const planId    = req.params.id;
    const companyId = req.user.company_id;
    const isAgency  = req.user.company_type === 'agency';

    // Plan erişim kontrolü
    const { rows: [plan] } = await pool.query(
      `SELECT p.*, c.name AS company_name
       FROM tv_media_plans p
       JOIN companies c ON c.id = p.company_id
       WHERE p.id = $1 AND (p.company_id = $2 OR p.brand_id = $2)`,
      [planId, companyId]
    );
    if (!plan) return res.status(404).json({ error: 'Plan bulunamadı.' });

    const targetCompanyId = plan.brand_id || plan.company_id;

    // TV plan kalemleri
    const { rows: planItems } = await pool.query(
      'SELECT * FROM tv_plan_items WHERE plan_id = $1 ORDER BY broadcast_date, daypart',
      [planId]
    );
    if (!planItems.length) {
      return res.json({ no_data: true, reason: 'no_spots', message: 'Öneri üretmek için önce plana spot ekleyin.' });
    }

    // Online performans verisi — son 90 gün, gün-bazında
    const { rows: metrics } = await pool.query(`
      SELECT
        EXTRACT(DOW FROM am.date)::int                                  AS dow,
        COUNT(DISTINCT am.date)                                         AS data_days,
        ROUND(AVG(am.roas)::numeric, 2)                                 AS avg_roas,
        ROUND(SUM(am.conversions)::numeric / NULLIF(COUNT(DISTINCT am.date),0), 1) AS avg_daily_conversions,
        ROUND(SUM(am.spend)::numeric / NULLIF(COUNT(DISTINCT am.date),0), 0) AS avg_daily_spend,
        ROUND(SUM(am.clicks)::numeric / NULLIF(SUM(am.impressions)::numeric,0) * 100, 2) AS avg_ctr,
        i.platform
      FROM ad_metrics am
      JOIN integrations i ON i.id = am.integration_id
      WHERE i.company_id = $1
        AND am.date >= CURRENT_DATE - INTERVAL '90 days'
        AND i.is_active = true
        AND i.status != 'disconnected'
        AND i.platform IN ('google_ads', 'google_analytics', 'meta')
      GROUP BY EXTRACT(DOW FROM am.date)::int, i.platform
      ORDER BY EXTRACT(DOW FROM am.date)::int, i.platform
    `, [targetCompanyId]);

    if (!metrics.length) {
      return res.json({ no_data: true, reason: 'no_metrics', message: 'Öneri için yeterli veri yok — Google Ads, Google Analytics veya Meta entegrasyonlarınızı kontrol edin. En az 90 günlük veri gereklidir.' });
    }

    // Günlük özet (platformları topla)
    const dowSummary = {};
    for (let d = 0; d < 7; d++) {
      const dayMetrics = metrics.filter(m => m.dow === d);
      if (!dayMetrics.length) continue;
      dowSummary[d] = {
        dow: d,
        day_name: DOW_TR[d],
        avg_roas: dayMetrics.reduce((s, m) => s + parseFloat(m.avg_roas || 0), 0) / dayMetrics.length,
        avg_daily_conversions: dayMetrics.reduce((s, m) => s + parseFloat(m.avg_daily_conversions || 0), 0),
        avg_daily_spend: dayMetrics.reduce((s, m) => s + parseFloat(m.avg_daily_spend || 0), 0),
        platforms: dayMetrics.map(m => m.platform),
      };
    }

    // TV plan özeti
    const planSummary = {};
    for (const item of planItems) {
      const dow = item.broadcast_date ? new Date(item.broadcast_date).getDay() : null;
      const key = `${item.channel_code}|${item.daypart}`;
      if (!planSummary[key]) planSummary[key] = { channel: item.channel_name, daypart: item.daypart, spots: [], dow_list: [] };
      planSummary[key].spots.push(item);
      if (dow !== null) planSummary[key].dow_list.push(dow);
    }

    // Genel online ortalama (kıyaslama için)
    const allDays = Object.values(dowSummary);
    const avgConversionsAll = allDays.reduce((s, d) => s + d.avg_daily_conversions, 0) / (allDays.length || 1);
    const avgRoasAll = allDays.reduce((s, d) => s + d.avg_roas, 0) / (allDays.length || 1);

    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.adslands.com';

    // SSE stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      await queueAiRequest(async ({ waitMs, startedAt }) => {
        res.write(`data: ${JSON.stringify({ status: 'processing' })}\n\n`);

        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

        const dowSummaryText = Object.values(dowSummary).map(d =>
          `${d.day_name}: ort. ROAS ${d.avg_roas.toFixed(2)}x, ort. günlük dönüşüm ${d.avg_daily_conversions.toFixed(1)}, ort. günlük harcama ₺${d.avg_daily_spend.toFixed(0)}`
        ).join('\n');

        const planSummaryText = Object.values(planSummary).map(s =>
          `${s.channel} - ${s.daypart} kuşağı: ${s.spots.length} spot, günler: ${[...new Set(s.dow_list)].map(d => DOW_TR[d]).join(', ') || 'tarihsiz'}`
        ).join('\n');

        const prompt = `Sen bir TV medya planı danışmanısın. Aşağıda bir markanın son 90 günlük online performans verisi ve mevcut TV medya planı var.

**Online Performans (Gün Bazında Ortalama — Son 90 Gün):**
${dowSummaryText}

**Genel Ortalama:** ROAS ${avgRoasAll.toFixed(2)}x, günlük dönüşüm ${avgConversionsAll.toFixed(1)}

**Mevcut TV Medya Planı (${plan.plan_name} — ${MONTHS[(plan.month || 1) - 1]} ${plan.year}):**
${planSummaryText}

Lütfen tam olarak şu JSON formatında yanıt ver (başka hiçbir şey yazma):
{
  "suggestions": [
    {
      "id": "s1",
      "priority": "high",
      "title": "kısa başlık (max 60 karakter)",
      "description": "öneri açıklaması",
      "evidence": "dayandığı veri özeti (sayısal değerlerle)",
      "action": {
        "type": "emphasize_daypart|reduce_daypart|shift_budget|general",
        "channel_code": "trt1|kanald|showtv|atv|startv|foxtv|tv8|trt2|cnnturk|ntv|haberturk|tv360 (yoksa null)",
        "daypart": "sabah|ogle|aksam|prime|gece (yoksa null)",
        "day_of_week": 0-6 (Pazar=0, yoksa null)
      }
    }
  ],
  "overall_insight": "Genel değerlendirme (1-2 cümle)"
}

KURALLAR:
- Sadece online veriye dayalı zamanlama önerileri üret
- Fiyat, GRP veya rating tahmini yapma
- Maksimum 4 öneri üret
- En az 2 öneri mevcut planla doğrudan ilgili olsun (var olan kanal/kuşak analizi)
- Evidence'da gerçek rakamları kullan (kaçıncı günün ortalamanın kaç katı olduğu gibi)
- Tüm metinler Türkçe olsun`;

        let rawText = '';
        const stream = client.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            rawText += chunk.delta.text;
          }
        }

        const final = await stream.finalMessage();
        const { input_tokens, output_tokens } = final.usage || {};
        const processMs = Date.now() - startedAt;

        let parsed;
        try {
          const match = rawText.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match ? match[0] : rawText);
        } catch {
          parsed = { suggestions: [], overall_insight: rawText.slice(0, 200) };
        }

        res.write(`data: ${JSON.stringify({ result: parsed })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

        logAiUsage(req.aiCtx.companyId, req.aiCtx.userId, 'tv_ai_suggest', input_tokens, output_tokens, 'claude-opus-4-7', { waitMs, processMs, status: 'completed' });
      });
    } catch (err) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      }
    }
  } catch (err) {
    console.error('[tv/ai-suggest]', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ── TV AI Öneri Uygulama ──────────────────────────────────────────────────────

router.post('/plans/:id/ai-apply', authMiddleware, async (req, res) => {
  try {
    const planId    = req.params.id;
    const companyId = req.user.company_id;
    const { suggestion_id, action } = req.body;

    const { rows: [plan] } = await pool.query(
      'SELECT * FROM tv_media_plans WHERE id = $1 AND company_id = $2',
      [planId, companyId]
    );
    if (!plan) return res.status(403).json({ error: 'Plan bulunamadı veya yetkiniz yok.' });

    if (action?.type === 'emphasize_daypart' && action.channel_code && action.daypart) {
      // Plana AI kaynaklı yeni bir spot yer tutucu ekle
      const ch = action.channel_code;
      const channelNames = {
        trt1: 'TRT 1', kanald: 'Kanal D', showtv: 'Show TV', atv: 'ATV',
        startv: 'Star TV', foxtv: 'FOX TV', tv8: 'TV8', trt2: 'TRT 2',
        cnnturk: 'CNN Türk', ntv: 'NTV', haberturk: 'Habertürk', tv360: 'TV360',
      };
      const { rows: [item] } = await pool.query(
        `INSERT INTO tv_plan_items
           (plan_id, channel_code, channel_name, daypart, status, ai_suggestion_id)
         VALUES ($1, $2, $3, $4, 'planned', $5)
         RETURNING *`,
        [planId, ch, channelNames[ch] || ch, action.daypart, suggestion_id]
      );
      await updatePlanTotals(planId);
      return res.json({ applied: true, new_item: item });
    }

    // Diğer öneri tipleri için sadece onay döndür (UI'da uygulandı işaretlenir)
    res.json({ applied: true });
  } catch (err) {
    console.error('[tv/ai-apply]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
