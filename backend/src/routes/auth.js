const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

router.post('/register', async (req, res) => {
  const { email, password, role, company_name } = req.body;

  if (!email || !password || !role || !company_name) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }
  if (!['brand', 'agency'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz kullanıcı tipi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
  }

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role, company_name) VALUES ($1, $2, $3, $4) RETURNING id, email, role, company_name, is_active, created_at',
      [email, password_hash, role, company_name]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.', detail: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Hesabınız henüz aktif değil. Lütfen e-postanızdaki bağlantıya tıklayın.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, company_name: user.company_name, is_active: user.is_active, created_at: user.created_at },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.', detail: err.message });
  }
});

// GET /api/auth/setup/:token — token bilgisini getir
router.get('/setup/:token', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT email, company_name, role FROM users WHERE setup_token = $1',
      [req.params.token]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' });
    res.json(user);
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
    const found = await pool.query('SELECT * FROM users WHERE setup_token = $1', [token]);
    const user = found.rows[0];
    if (!user) return res.status(404).json({ error: 'Geçersiz veya süresi dolmuş bağlantı.' });

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, is_active = true, setup_token = NULL WHERE id = $2 RETURNING id, email, role, company_name, is_active',
      [password_hash, user.id]
    );

    const updated = result.rows[0];
    const jwtToken = jwt.sign(
      { id: updated.id, email: updated.email, role: updated.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: jwtToken, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
