const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const { adminOnly } = require('../middleware/auth');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://adslands-frontend.onrender.com';

async function sendSetupEmail({ email, company_name, role, setup_token }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const roleLabel = role === 'brand' ? 'Marka' : 'Ajans';
  const setupLink = `${FRONTEND_URL}/setup/${setup_token}`;

  await resend.emails.send({
    from: 'AdsLands <onboarding@resend.dev>',
    to: email,
    subject: 'AdsLands hesabınız oluşturuldu — şifrenizi belirleyin',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
        <div style="margin-bottom:28px;">
          <span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
        </div>
        <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Hesabınız hazır</h2>
        <p style="color:#94A8B3;line-height:1.6;margin:0 0 8px;">
          <strong style="color:#F0F5F3;">${company_name}</strong> adına
          AdsLands platformunda bir <strong style="color:#F0F5F3;">${roleLabel}</strong> hesabı oluşturuldu.
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

async function createUser({ email, company_name, role }) {
  const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (exists.rows.length > 0) throw Object.assign(new Error('Bu e-posta zaten kayıtlı.'), { status: 409 });

  const setup_token = uuidv4();
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, role, company_name, is_active, setup_token)
     VALUES ($1, '', $2, $3, false, $4)
     RETURNING id, email, company_name, is_active, created_at`,
    [email, role, company_name, setup_token]
  );
  await sendSetupEmail({ email, company_name, role, setup_token });
  return result.rows[0];
}

router.get('/brands', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, company_name, is_active, created_at FROM users WHERE role = 'brand' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

router.post('/brands', adminOnly, async (req, res) => {
  const { email, company_name } = req.body;
  if (!email || !company_name) {
    return res.status(400).json({ error: 'E-posta ve şirket adı zorunludur.' });
  }
  try {
    const user = await createUser({ email, company_name, role: 'brand' });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

router.get('/agencies', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, company_name, is_active, created_at FROM users WHERE role = 'agency' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

router.post('/agencies', adminOnly, async (req, res) => {
  const { email, company_name } = req.body;
  if (!email || !company_name) {
    return res.status(400).json({ error: 'E-posta ve şirket adı zorunludur.' });
  }
  try {
    const user = await createUser({ email, company_name, role: 'agency' });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Sunucu hatası.' });
  }
});

router.patch('/users/:id/toggle-active', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE users SET is_active = NOT is_active WHERE id = $1 AND role != 'admin' RETURNING id, email, company_name, role, is_active",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
