'use strict';

const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

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

// ── TV Erken Erişim ────────────────────────────────────────────────────────────

router.post('/early-access', async (req, res) => {
  const { full_name, email } = req.body;
  if (!full_name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Ad soyad ve e-posta zorunludur.' });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) {
    return res.status(400).json({ error: 'Geçersiz e-posta adresi.' });
  }
  try {
    await pool.query(
      `INSERT INTO tv_early_access (full_name, email)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [full_name.trim(), email.trim().toLowerCase()]
    );
    res.json({ ok: true, message: 'Listeye eklendiniz!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
