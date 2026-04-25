const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const { platformAdmin } = require('../middleware/auth');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://adslands.com';

async function sendSetupEmail(email, companyName, companyType, setupToken) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const typeLabel = companyType === 'agency' ? 'Ajans' : 'Marka';
  const setupLink = `${FRONTEND_URL}/setup/${setupToken}`;

  await resend.emails.send({
    from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
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

// GET /api/admin/companies — tüm şirketleri listele
router.get('/companies', platformAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.name, c.type, c.created_at,
             COUNT(u.id) AS user_count
      FROM companies c
      LEFT JOIN users u ON u.company_id = c.id
      WHERE c.type != 'admin'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/admin/companies — şirket oluştur + admin kullanıcı gönder
router.post('/companies', platformAdmin, async (req, res) => {
  const { name, type, admin_email } = req.body;
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

    const { rows: [company] } = await pool.query(
      'INSERT INTO companies (name, type) VALUES ($1, $2) RETURNING *',
      [name.trim(), type]
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

module.exports = router;
module.exports.sendSetupEmail = sendSetupEmail;
