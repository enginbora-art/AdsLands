const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const { platformAdmin } = require('../middleware/auth');
const { getSetting, invalidateCache } = require('../config/appSettings');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://adslands.com';

async function sendSetupEmail(email, companyName, companyType, setupToken) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const typeLabel = companyType === 'agency' ? 'Ajans' : 'Marka';
  const setupLink = `${FRONTEND_URL}/setup/${setupToken}`;

  await resend.emails.send({
    from: `AdsLands <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'AdsLands hesabınız oluşturuldu — şifrenizi belirleyin',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
        <div style="margin-bottom:28px;">
          <span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
        </div>
        <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Hesabınız hazır</h2>
        <p style="color:#94A8B3;line-height:1.6;margin:0 0 8px;">
          <strong style="color:#F0F5F3;">${companyName}</strong> adına
          AdsLands platformunda bir <strong style="color:#F0F5F3;">${typeLabel}</strong> hesabı oluşturuldu.
        </p>
        <p style="color:#94A8B3;line-height:1.6;margin:0 0 28px;">
          Aşağıdaki butona tıklayarak şifrenizi belirleyin ve platforma giriş yapın.
        </p>
        <a href="${setupLink}"
          style="display:inline-block;padding:13px 28px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Şifremi Belirle
        </a>
        <p style="margin-top:32px;font-size:12px;color:#5A7080;line-height:1.5;">
          Bu bağlantı size özeldir, başkalarıyla paylaşmayın.<br/>
          Hesap açmadıysanız bu e-postayı dikkate almayınız.
        </p>
      </div>
    `,
  });
}

// GET /api/admin/companies — tüm şirketleri listele (gruplu: ajanslar + bağımsız markalar)
router.get('/companies', platformAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.type, c.sector, c.created_at, c.trial_ends_at,
             COUNT(DISTINCT u.id) AS user_count,
             (SELECT u2.email FROM users u2
              WHERE u2.company_id = c.id AND u2.is_company_admin = true AND u2.is_active = true
              ORDER BY u2.created_at LIMIT 1) AS admin_email,
             s.plan,
             s.status        AS sub_status,
             s.interval      AS sub_interval,
             s.cancel_at_period_end,
             s.current_period_start,
             s.current_period_end,
             s.amount        AS monthly_amount,
             CASE
               WHEN s.id IS NOT NULL AND s.status = 'active' AND NOT s.cancel_at_period_end
                 THEN 'active'
               WHEN s.id IS NOT NULL AND s.status = 'active' AND s.cancel_at_period_end
                 THEN 'cancelling'
               WHEN s.id IS NOT NULL AND s.status = 'cancelled'
                 THEN 'cancelled'
               WHEN c.trial_ends_at IS NOT NULL AND c.trial_ends_at > NOW()
                 THEN 'trial'
               ELSE 'inactive'
             END AS plan_status,
             CASE
               WHEN s.id IS NOT NULL AND s.current_period_start IS NOT NULL
                 THEN FLOOR(EXTRACT(EPOCH FROM (NOW() - s.current_period_start)) / 2592000)::int
               WHEN c.trial_ends_at IS NOT NULL AND c.trial_ends_at > NOW()
                 THEN 0
               ELSE FLOOR(EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 2592000)::int
             END AS months_active
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      LEFT JOIN LATERAL (
        SELECT * FROM subscriptions
        WHERE company_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) s ON true
      WHERE c.type != 'admin'
      GROUP BY c.id, s.id, s.plan, s.status, s.interval, s.cancel_at_period_end,
               s.current_period_start, s.current_period_end, s.amount
      ORDER BY c.created_at DESC
    `);

    // Ajans-marka ilişkilerini çek
    const { rows: connections } = await pool.query(`
      SELECT agency_company_id, brand_company_id
      FROM connections
      WHERE status = 'accepted'
    `);

    const companyMap = Object.fromEntries(rows.map(r => [r.id, r]));
    const brandToAgency = {};
    connections.forEach(({ agency_company_id, brand_company_id }) => {
      brandToAgency[brand_company_id] = agency_company_id;
    });

    const agencies = rows
      .filter(c => c.type === 'agency')
      .map(agency => ({
        ...agency,
        brands: connections
          .filter(cn => cn.agency_company_id === agency.id)
          .map(cn => companyMap[cn.brand_company_id])
          .filter(Boolean),
      }));

    const connectedBrandIds = new Set(Object.keys(brandToAgency));
    const independent_brands = rows.filter(
      c => c.type === 'brand' && !connectedBrandIds.has(c.id)
    );

    res.json({ agencies, independent_brands });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/admin/companies — şirket oluştur + admin kullanıcı gönder
router.post('/companies', platformAdmin, async (req, res) => {
  const { name, type, admin_email, sector } = req.body;
  if (!name?.trim() || !type || !admin_email?.trim()) {
    return res.status(400).json({ error: 'Şirket adı, tipi ve admin e-postası zorunludur.' });
  }
  if (!['agency', 'brand'].includes(type)) {
    return res.status(400).json({ error: 'Şirket tipi agency veya brand olmalıdır.' });
  }

  try {
    const { rows: [emailExists] } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [admin_email]
    );
    if (emailExists) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    }

    const finalSector = sector || (type === 'agency' ? 'Ajans' : null);
    const trialDays = await getSetting('trial_duration_days', 30);
    const { rows: [company] } = await pool.query(
      `INSERT INTO companies (name, type, sector, trial_ends_at)
       VALUES ($1, $2, $3, NOW() + make_interval(days => $4)) RETURNING *`,
      [name.trim(), type, finalSector, trialDays]
    );

    const setupToken = uuidv4();
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, is_company_admin, is_active, setup_token)
       VALUES ($1, $2, '', true, false, $3)
       RETURNING id, email, is_company_admin, is_active, created_at`,
      [company.id, admin_email, setupToken]
    );

    await sendSetupEmail(admin_email, company.name, company.type, setupToken);

    res.status(201).json({ company, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/admin/companies/:id — şirket detayı + kullanıcılar
router.get('/companies/:id', platformAdmin, async (req, res) => {
  try {
    const { rows: [company] } = await pool.query(
      'SELECT * FROM companies WHERE id = $1', [req.params.id]
    );
    if (!company) return res.status(404).json({ error: 'Şirket bulunamadı.' });

    const { rows: users } = await pool.query(
      `SELECT u.id, u.email, u.is_company_admin, u.is_active, u.created_at,
              r.name AS role_name
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.company_id = $1
       ORDER BY u.created_at`,
      [company.id]
    );

    res.json({ company, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/admin/companies/:id — sektör güncelle
router.patch('/companies/:id', platformAdmin, async (req, res) => {
  const { sector } = req.body;
  try {
    const { rows: [company] } = await pool.query(
      `UPDATE companies SET sector = $1 WHERE id = $2 AND type != 'admin' RETURNING id, name, sector`,
      [sector || null, req.params.id]
    );
    if (!company) return res.status(404).json({ error: 'Şirket bulunamadı.' });
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/admin/users/:id/toggle — kullanıcı aktif/pasif yap
router.patch('/users/:id/toggle', platformAdmin, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query(
      `UPDATE users SET is_active = NOT is_active
       WHERE id = $1 AND is_platform_admin = false
       RETURNING id, email, is_active`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/admin/ai-queue — canlı queue durumu
router.get('/ai-queue', platformAdmin, async (req, res) => {
  try {
    const { getQueueStatus, getActiveRequests } = require('../services/aiQueue');
    const status     = getQueueStatus();
    const activeReqs = getActiveRequests();

    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(*)::int                         AS total_requests,
        COALESCE(AVG(wait_ms), 0)::int        AS avg_wait_time_ms,
        COALESCE(AVG(process_ms), 0)::int     AS avg_process_time_ms,
        COUNT(CASE WHEN status = 'failed' THEN 1 END)::int AS errors
      FROM ai_usage_logs
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `);

    const now = Date.now();
    res.json({
      queue: {
        waiting:     status.size,
        processing:  status.pending,
        concurrency: status.concurrency,
      },
      last_1h: {
        total_requests:      stats?.total_requests      || 0,
        avg_wait_time_ms:    stats?.avg_wait_time_ms    || 0,
        avg_process_time_ms: stats?.avg_process_time_ms || 0,
        errors:              stats?.errors              || 0,
      },
      active_requests: activeReqs.map(r => ({
        company_name:    r.companyName || 'Bilinmiyor',
        feature:         r.feature,
        started_at:      new Date(r.startedAt).toISOString(),
        elapsed_seconds: Math.floor((now - r.startedAt) / 1000),
        wait_ms:         r.waitMs || 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/admin/ai-queue/clear — bekleyen tüm istekleri iptal et
router.post('/ai-queue/clear', platformAdmin, (req, res) => {
  try {
    const { clearQueue } = require('../services/aiQueue');
    const count = clearQueue();
    res.json({ cleared: count, message: `${count} istek iptal edildi.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/admin/ai-queue/concurrency — concurrency'yi güncelle
router.post('/ai-queue/concurrency', platformAdmin, (req, res) => {
  try {
    const { concurrency } = req.body;
    if (!concurrency || concurrency < 1 || concurrency > 20) {
      return res.status(400).json({ error: 'Geçersiz değer (1–20 arası).' });
    }
    const { setConcurrency } = require('../services/aiQueue');
    setConcurrency(parseInt(concurrency));
    res.json({ concurrency: parseInt(concurrency), message: `Kapasite ${concurrency} olarak güncellendi.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/admin/ai-usage?month=2026-05
router.get('/ai-usage', platformAdmin, async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-').map(Number);
    if (!year || !mon) return res.status(400).json({ error: 'Geçersiz ay formatı. YYYY-MM bekleniyor.' });

    const dateParams = [year, mon];

    const { rows: [summary] } = await pool.query(`
      SELECT
        COUNT(*)::int                  AS total_requests,
        COALESCE(SUM(cost_usd),0)::float AS total_cost_usd,
        COALESCE(SUM(cost_try),0)::float AS total_cost_try,
        COALESCE(SUM(input_tokens),0)::bigint  AS total_input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint AS total_output_tokens
      FROM ai_usage_logs
      WHERE EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
    `, dateParams);

    const { rows: byFeature } = await pool.query(`
      SELECT feature,
        COUNT(*)::int                  AS requests,
        COALESCE(SUM(cost_usd),0)::float AS cost_usd,
        COALESCE(SUM(cost_try),0)::float AS cost_try,
        COALESCE(SUM(input_tokens),0)::bigint  AS input_tokens,
        COALESCE(SUM(output_tokens),0)::bigint AS output_tokens
      FROM ai_usage_logs
      WHERE EXTRACT(YEAR  FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
      GROUP BY feature
      ORDER BY cost_usd DESC
    `, dateParams);

    const { rows: byCompany } = await pool.query(`
      SELECT
        c.id, c.name AS company_name, c.type AS company_type,
        COUNT(al.id)::int               AS requests,
        COALESCE(SUM(al.cost_usd),0)::float AS cost_usd,
        COALESCE(SUM(al.cost_try),0)::float AS cost_try
      FROM ai_usage_logs al
      JOIN companies c ON c.id = al.company_id
      WHERE EXTRACT(YEAR  FROM al.created_at) = $1
        AND EXTRACT(MONTH FROM al.created_at) = $2
      GROUP BY c.id, c.name, c.type
      ORDER BY cost_usd DESC
    `, dateParams);

    res.json({ ...summary, by_feature: byFeature, by_company: byCompany });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── GET /api/admin/plan-prices ────────────────────────────────────────────────
router.get('/plan-prices', platformAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT pp.*, u.email AS updated_by_email
       FROM plan_prices pp
       LEFT JOIN users u ON u.id = pp.updated_by
       ORDER BY pp.plan_key`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/plan-prices/:plan_key ──────────────────────────────────────
router.put('/plan-prices/:plan_key', platformAdmin, async (req, res) => {
  try {
    const { plan_key } = req.params;
    const { monthly_price, yearly_price, yearly_discount_pct, is_active } = req.body;

    if (monthly_price !== undefined && (isNaN(monthly_price) || Number(monthly_price) < 0)) {
      return res.status(400).json({ error: 'Geçersiz aylık fiyat.' });
    }
    if (yearly_price !== undefined && (isNaN(yearly_price) || Number(yearly_price) < 0)) {
      return res.status(400).json({ error: 'Geçersiz yıllık fiyat.' });
    }
    if (yearly_discount_pct !== undefined && (isNaN(yearly_discount_pct) || Number(yearly_discount_pct) < 0 || Number(yearly_discount_pct) > 100)) {
      return res.status(400).json({ error: 'İndirim oranı 0-100 arasında olmalıdır.' });
    }

    const sets = [];
    const params = [];
    let idx = 1;

    if (monthly_price !== undefined)       { sets.push(`monthly_price = $${idx++}`);       params.push(Number(monthly_price)); }
    if (yearly_price !== undefined)        { sets.push(`yearly_price = $${idx++}`);        params.push(Number(yearly_price)); }
    if (yearly_discount_pct !== undefined) { sets.push(`yearly_discount_pct = $${idx++}`); params.push(Number(yearly_discount_pct)); }
    if (is_active !== undefined)           { sets.push(`is_active = $${idx++}`);           params.push(Boolean(is_active)); }

    if (!sets.length) return res.status(400).json({ error: 'Güncellenecek alan bulunamadı.' });

    sets.push(`updated_at = NOW()`, `updated_by = $${idx++}`);
    params.push(req.user.user_id);
    params.push(plan_key);

    const { rows: [updated] } = await pool.query(
      `UPDATE plan_prices SET ${sets.join(', ')} WHERE plan_key = $${idx} RETURNING *`,
      params
    );

    if (!updated) return res.status(404).json({ error: 'Plan bulunamadı.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/app-settings ───────────────────────────────────────────────
router.get('/app-settings', platformAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, u.email AS updated_by_email
       FROM app_settings s
       LEFT JOIN users u ON u.id = s.updated_by
       ORDER BY s.key`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/app-settings/:key ──────────────────────────────────────────
router.put('/app-settings/:key', platformAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined || value === null || String(value).trim() === '') {
      return res.status(400).json({ error: 'value zorunludur.' });
    }
    const { rows: [updated] } = await pool.query(
      `UPDATE app_settings
       SET value = $1, updated_at = NOW(), updated_by = $2
       WHERE key = $3
       RETURNING *`,
      [String(value).trim(), req.user.user_id, key]
    );
    if (!updated) return res.status(404).json({ error: 'Ayar bulunamadı.' });
    invalidateCache();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/benchmarks ─────────────────────────────────────────────────
router.get('/benchmarks', platformAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, u.email AS updated_by_email
       FROM sector_benchmarks b
       LEFT JOIN users u ON u.id = b.updated_by
       ORDER BY b.sector, b.metric`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/benchmarks/:id ─────────────────────────────────────────────
router.put('/benchmarks/:id', platformAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;
    if (value === undefined || isNaN(Number(value)) || Number(value) < 0) {
      return res.status(400).json({ error: 'Geçerli bir sayısal değer girin.' });
    }
    const { rows: [updated] } = await pool.query(
      `UPDATE sector_benchmarks
       SET value = $1, updated_at = NOW(), updated_by = $2
       WHERE id = $3
       RETURNING *`,
      [Number(value), req.user.user_id, id]
    );
    if (!updated) return res.status(404).json({ error: 'Benchmark bulunamadı.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.sendSetupEmail = sendSetupEmail;
