const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
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

  return jwt.sign(
    {
      user_id: user.id,
      company_id: user.company_id,
      company_name: user.company_name,
      company_type: user.company_type,
      full_name: user.full_name || null,
      is_company_admin: user.is_company_admin,
      is_platform_admin: user.is_platform_admin,
      permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

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
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız aktif değil. E-postanızdaki bağlantıya tıklayın.' });
    }

    const token = await buildToken(user.id);
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
    // Kullanıcı setup token'ı
    const { rows: [userRow] } = await pool.query(
      `SELECT u.email, c.name AS company_name, c.type AS company_type
       FROM users u LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.setup_token = $1`,
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
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  }

  try {
    const password_hash = await bcrypt.hash(password, 12);

    // Platform admin / şirket admin setup akışı (users.setup_token)
    const { rows: [found] } = await pool.query(
      'SELECT * FROM users WHERE setup_token = $1',
      [token]
    );
    if (found) {
      const { rows: [updated] } = await pool.query(
        'UPDATE users SET password_hash = $1, is_active = true, setup_token = NULL WHERE id = $2 RETURNING id',
        [password_hash, found.id]
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
        `INSERT INTO users (company_id, email, password_hash, is_company_admin, is_active)
         VALUES ($1, $2, $3, false, true) RETURNING id`,
        [inv.sender_company_id, inv.receiver_email, password_hash]
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
      const companyName = req.body.company_name || inv.receiver_email.split('@')[0];
      const { rows: [newCompany] } = await pool.query(
        'INSERT INTO companies (name, type) VALUES ($1, $2) RETURNING id',
        [companyName, companyType]
      );

      // Yeni kullanıcı (şirket admini)
      const { rows: [newUser] } = await pool.query(
        `INSERT INTO users (company_id, email, password_hash, is_company_admin, is_active)
         VALUES ($1, $2, $3, true, true) RETURNING id`,
        [newCompany.id, inv.receiver_email, password_hash]
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

module.exports = router;
module.exports.buildToken = buildToken;
