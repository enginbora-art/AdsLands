const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const auth = require('../middleware/auth');
const { ALL_PERMISSIONS } = require('../constants');

async function buildToken(userId) {
  const { rows: [user] } = await pool.query(
    `SELECT u.*, c.name AS company_name, c.type AS company_type,
            r.permissions AS role_permissions
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const permissions = (user.is_company_admin || user.is_platform_admin)
    ? ALL_PERMISSIONS
    : (user.role_permissions || []);

  const { rows: [conn] } = await pool.query(
    `SELECT 1 FROM connections WHERE brand_company_id = $1 LIMIT 1`,
    [user.company_id]
  );
  const is_managed_by_agency = !!conn;

  return jwt.sign(
    {
      user_id: user.id,
      company_id: user.company_id,
      company_name: user.company_name,
      company_type: user.company_type,
      full_name: user.full_name || null,
      is_company_admin: user.is_company_admin,
      is_platform_admin: user.is_platform_admin,
      is_managed_by_agency,
      permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// GET /api/auth/me — mevcut kullanıcı bilgilerini tazele
router.get('/me', auth, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.company_id, u.is_company_admin, u.is_platform_admin,
              c.name AS company_name, c.type AS company_type, c.trial_ends_at,
              r.permissions AS role_permissions,
              EXISTS(
                SELECT 1 FROM connections WHERE brand_company_id = u.company_id
              ) AS is_managed_by_agency,
              (SELECT s.plan FROM subscriptions s
               WHERE s.company_id = u.company_id AND s.status = 'active'
               ORDER BY s.created_at DESC LIMIT 1) AS subscription_plan,
              (SELECT s.cancel_at_period_end FROM subscriptions s
               WHERE s.company_id = u.company_id AND s.status = 'active'
               ORDER BY s.created_at DESC LIMIT 1) AS subscription_cancelling
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.user_id]
    );
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const permissions = (user.is_company_admin || user.is_platform_admin)
      ? ALL_PERMISSIONS
      : (user.role_permissions || []);

    const onTrial = user.trial_ends_at && new Date(user.trial_ends_at) > new Date();

    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name || null,
      company_id: user.company_id,
      company_name: user.company_name,
      company_type: user.company_type,
      is_company_admin: user.is_company_admin,
      is_platform_admin: user.is_platform_admin,
      is_managed_by_agency: user.is_managed_by_agency,
      subscription_plan: user.subscription_plan || null,
      subscription_cancelling: user.subscription_cancelling || false,
      on_trial: onTrial,
      permissions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  }

  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.*, c.name AS company_name, c.type AS company_type
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      console.warn('[Auth] Başarısız giriş denemesi:', { email, ip: req.ip, ua: req.headers['user-agent']?.slice(0, 80) });
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız aktif değil. E-postanızdaki bağlantıya tıklayın.' });
    }

    const token = await buildToken(user.id);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name || null,
        company_id: user.company_id,
        company_name: user.company_name,
        company_type: user.company_type,
        is_company_admin: user.is_company_admin,
        is_platform_admin: user.is_platform_admin,
        is_managed_by_agency: payload.is_managed_by_agency,
        permissions: payload.permissions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/auth/setup/:token — token bilgisini getir
router.get('/setup/:token', async (req, res) => {
  try {
    // Kullanıcı setup token'ı (72 saat içinde geçerli)
    const { rows: [userRow] } = await pool.query(
      `SELECT u.email, c.name AS company_name, c.type AS company_type
       FROM users u LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.setup_token = $1
         AND u.created_at >= NOW() - INTERVAL '72 hours'`,
      [req.params.token]
    );
    if (userRow) return res.json(userRow);

    // Davet (user_invite veya agency/brand invite) token'ı
    const { rows: [invRow] } = await pool.query(
      `SELECT i.receiver_email AS email, c.name AS company_name, c.type AS company_type
       FROM invitations i
       JOIN companies c ON c.id = i.sender_company_id
       WHERE i.token = $1 AND i.status = 'pending'`,
      [req.params.token]
    );
    if (invRow) return res.json({ ...invRow, role: 'brand' });

    return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/setup — şifre belirle ve hesabı aktifleştir
router.post('/setup', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token ve şifre zorunludur.' });
  }
  if (password.length < 8 || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı ve en az 1 rakam içermelidir.' });
  }

  const { full_name, company_name: bodyCompanyName } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 12);

    // Platform admin / şirket admin setup akışı (users.setup_token, 72 saat geçerli)
    const { rows: [found] } = await pool.query(
      `SELECT * FROM users WHERE setup_token = $1
         AND created_at >= NOW() - INTERVAL '72 hours'`,
      [token]
    );
    if (found) {
      const { rows: [updated] } = await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, is_active = true, setup_token = NULL WHERE id = $3 RETURNING id',
        [password_hash, full_name?.trim() || null, found.id]
      );
      const jwtToken = await buildToken(updated.id);
      return res.json({ token: jwtToken });
    }

    // Ajans→Marka veya Marka→Ajans davetinden yeni kullanıcı kurulumu
    const { rows: [inv] } = await pool.query(
      "SELECT * FROM invitations WHERE token = $1 AND status = 'pending'",
      [token]
    );
    if (inv && inv.type === 'user_invite') {
      // Mevcut şirketin kullanıcı davetini kabul et
      const { rows: [exists] } = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [inv.receiver_email]
      );
      if (exists) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });

      const { rows: [newUser] } = await pool.query(
        `INSERT INTO users (company_id, email, password_hash, full_name, is_company_admin, is_active)
         VALUES ($1, $2, $3, $4, false, true) RETURNING id`,
        [inv.sender_company_id, inv.receiver_email, password_hash, full_name?.trim() || null]
      );
      await pool.query(
        "UPDATE invitations SET status = 'accepted' WHERE id = $1",
        [inv.id]
      );
      const jwtToken = await buildToken(newUser.id);
      return res.json({ token: jwtToken });
    }

    if (inv && (inv.type === 'agency_to_brand' || inv.type === 'brand_to_agency')) {
      // Yeni şirket kurulumu (ajans/marka davetinden)
      const { rows: [exists] } = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [inv.receiver_email]
      );
      if (exists) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });

      // Yeni şirket oluştur
      const companyType = inv.type === 'agency_to_brand' ? 'brand' : 'agency';
      const companyName = bodyCompanyName || inv.receiver_email.split('@')[0];
      const { rows: [newCompany] } = await pool.query(
        'INSERT INTO companies (name, type) VALUES ($1, $2) RETURNING id',
        [companyName, companyType]
      );

      // Yeni kullanıcı (şirket admini)
      const { rows: [newUser] } = await pool.query(
        `INSERT INTO users (company_id, email, password_hash, full_name, is_company_admin, is_active)
         VALUES ($1, $2, $3, $4, true, true) RETURNING id`,
        [newCompany.id, inv.receiver_email, password_hash, full_name?.trim() || null]
      );

      // Bağlantı kur
      const agencyId = inv.type === 'agency_to_brand' ? inv.sender_company_id : newCompany.id;
      const brandId = inv.type === 'agency_to_brand' ? newCompany.id : inv.sender_company_id;
      await pool.query(
        'INSERT INTO connections (agency_company_id, brand_company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [agencyId, brandId]
      );

      await pool.query(
        "UPDATE invitations SET status = 'accepted', receiver_company_id = $1 WHERE id = $2",
        [newCompany.id, inv.id]
      );

      const jwtToken = await buildToken(newUser.id);
      return res.json({ token: jwtToken });
    }

    return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta zorunludur.' });

  // Her durumda aynı mesajı dön — kullanıcı enumeration önlemi
  const SUCCESS_MSG = 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.';

  try {
    const { rows: [user] } = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    if (!user) return res.json({ message: SUCCESS_MSG });

    const { v4: uuidv4 } = require('uuid');
    const { Resend } = require('resend');

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 saat

    // Önceki süresi dolmamış token'ları iptal et
    await pool.query(
      `UPDATE password_reset_tokens SET used = true
       WHERE user_id = $1 AND used = false AND expires_at > NOW()`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: email,
      subject: 'AdsLands - Şifre Sıfırlama',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
          <div style="margin-bottom:28px;"><span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span></div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Şifre Sıfırlama</h2>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 24px;">
            Şifrenizi sıfırlamak için aşağıdaki linke tıklayın.<br/>
            <span style="color:#5A7080;font-size:13px;">Bu link 1 saat geçerlidir.</span>
          </p>
          <a href="${resetLink}" style="display:inline-block;padding:13px 28px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Şifremi Sıfırla
          </a>
          <p style="margin-top:32px;font-size:12px;color:#5A7080;">Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `,
    });

    res.json({ message: SUCCESS_MSG });
  } catch (err) {
    console.error('[Auth] forgot-password hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token ve yeni şifre zorunludur.' });
  }
  if (newPassword.length < 8 || !/\d/.test(newPassword)) {
    return res.status(400).json({ error: 'Şifre en az 8 karakter olmalı ve en az 1 rakam içermelidir.' });
  }

  try {
    const { rows: [prt] } = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );
    if (!prt) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link.' });
    }

    const password_hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [password_hash, prt.user_id]
    );
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [prt.id]
    );

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    console.error('[Auth] reset-password hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
module.exports.buildToken = buildToken;
