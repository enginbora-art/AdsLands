const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/brands — ajanslar tüm marka şirketlerini görebilir
router.get('/brands', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, created_at FROM companies WHERE type = 'brand' ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/agencies — markalar tüm ajans şirketlerini görebilir
router.get('/agencies', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, created_at FROM companies WHERE type = 'agency' ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/users/me — update full_name
router.patch('/users/me', authMiddleware, async (req, res) => {
  const { full_name } = req.body;
  if (!full_name?.trim()) return res.status(400).json({ error: 'Ad Soyad zorunludur.' });
  try {
    await pool.query(
      'UPDATE users SET full_name = $1 WHERE id = $2',
      [full_name.trim(), req.user.user_id]
    );
    const { buildToken } = require('./auth');
    const newJwt = await buildToken(req.user.user_id);
    res.json({ token: newJwt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/users/me/notification-prefs
router.get('/users/me/notification-prefs', authMiddleware, async (req, res) => {
  try {
    const { rows: [row] } = await pool.query(
      'SELECT notification_prefs FROM users WHERE id = $1',
      [req.user.user_id]
    );
    res.json(row?.notification_prefs || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/users/me/notification-prefs
router.patch('/users/me/notification-prefs', authMiddleware, async (req, res) => {
  const prefs = req.body;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return res.status(400).json({ error: 'Geçersiz tercihler.' });
  }
  try {
    await pool.query(
      'UPDATE users SET notification_prefs = $1 WHERE id = $2',
      [JSON.stringify(prefs), req.user.user_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/companies/:id — update sector (own company or agency's connected brand)
router.patch('/companies/:id', authMiddleware, async (req, res) => {
  const { sector } = req.body;
  const targetId = req.params.id;

  try {
    if (targetId === req.user.company_id) {
      if (!req.user.is_company_admin && !req.user.is_platform_admin) {
        return res.status(403).json({ error: 'Şirket yöneticisi yetkisi gerekiyor.' });
      }
    } else {
      if (!req.user.is_company_admin) {
        return res.status(403).json({ error: 'Şirket yöneticisi yetkisi gerekiyor.' });
      }
      const { rows: [conn] } = await pool.query(
        'SELECT 1 FROM connections WHERE agency_company_id = $1 AND brand_company_id = $2',
        [req.user.company_id, targetId]
      );
      if (!conn) return res.status(403).json({ error: 'Bu şirkete erişim izniniz yok.' });
    }

    const { rows: [company] } = await pool.query(
      `UPDATE companies SET sector = $1 WHERE id = $2 AND type != 'admin' RETURNING id, name, sector`,
      [sector || null, targetId]
    );
    if (!company) return res.status(404).json({ error: 'Şirket bulunamadı.' });
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
