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

module.exports = router;
