const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { fetchTodayMetrics } = require('../services/metricsFetcher');

// In-memory per-company refresh cooldown (10 minutes)
const refreshCooldowns = new Map();
const COOLDOWN_MS = 10 * 60 * 1000;

// GET /api/metrics/last-updated
router.get('/last-updated', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { rows: [row] } = await pool.query(
      `SELECT MAX(COALESCE(am.updated_at, am.created_at)) AS last_updated
       FROM ad_metrics am
       JOIN integrations i ON i.id = am.integration_id
       WHERE i.company_id = $1`,
      [companyId]
    );
    res.json({ last_updated: row?.last_updated || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/metrics/refresh — manual trigger, 10-min cooldown per company
router.post('/refresh', authMiddleware, async (req, res) => {
  const companyId = req.user.company_id;
  const lastRefresh = refreshCooldowns.get(companyId);
  if (lastRefresh && Date.now() - lastRefresh < COOLDOWN_MS) {
    const waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastRefresh)) / 1000);
    return res.status(429).json({ error: `${waitSec} saniye sonra tekrar deneyin.` });
  }
  refreshCooldowns.set(companyId, Date.now());

  // Fire and forget — don't block the response
  fetchTodayMetrics(companyId).catch(err =>
    console.error('Manuel refresh hatası:', err.message)
  );

  res.json({ ok: true, message: 'Güncelleme başlatıldı.' });
});

module.exports = router;
