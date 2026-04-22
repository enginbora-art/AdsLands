const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// Ajanslar markaları görebilir
router.get('/brands', authMiddleware, async (req, res) => {
  if (!['admin', 'agency'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Bu sayfaya erişim yetkiniz yok.' });
  }
  try {
    const result = await pool.query(
      "SELECT id, company_name, email, created_at FROM users WHERE role = 'brand' AND is_active = true ORDER BY company_name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// Markalar ajansları görebilir
router.get('/agencies', authMiddleware, async (req, res) => {
  if (!['admin', 'brand'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Bu sayfaya erişim yetkiniz yok.' });
  }
  try {
    const result = await pool.query(
      "SELECT id, company_name, email, created_at FROM users WHERE role = 'agency' AND is_active = true ORDER BY company_name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
