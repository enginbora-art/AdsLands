const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { getCompanyLimit } = require('../middleware/aiLimit');

// GET /api/ai/usage-today
router.get('/usage-today', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const { plan, limit } = await getCompanyLimit(companyId);

    const { rows } = await pool.query(
      `SELECT feature, COUNT(*)::int AS count
       FROM ai_usage_logs
       WHERE company_id = $1 AND created_at >= CURRENT_DATE
       GROUP BY feature`,
      [companyId]
    );

    const by_feature = Object.fromEntries(rows.map(r => [r.feature, r.count]));
    const total = rows.reduce((s, r) => s + r.count, 0);

    res.json({ total, limit, plan, by_feature });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
