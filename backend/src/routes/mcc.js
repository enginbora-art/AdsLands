const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { getMccAuthUrl, getMccTokens, listMccCustomers } = require('../services/googleService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/mcc/connect — OAuth URL döndür (sadece ajans)
router.get('/connect', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar MCC bağlayabilir.' });
  }
  try {
    const authUrl = getMccAuthUrl(req.user.company_id);
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/mcc/callback — Google OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/integrations?error=mcc`);
  }

  let companyId;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    companyId = parsed.companyId;
  } catch {
    return res.redirect(`${FRONTEND_URL}/integrations?error=mcc`);
  }

  try {
    const tokens = await getMccTokens(code);

    // OAuth session kaydet
    const { rows: [session] } = await pool.query(
      `INSERT INTO oauth_sessions (company_id, provider, access_token, refresh_token)
       VALUES ($1, 'mcc', $2, $3) RETURNING id`,
      [companyId, tokens.access_token, tokens.refresh_token || null]
    );

    res.redirect(`${FRONTEND_URL}/integrations?mcc_session=${session.id}`);
  } catch (err) {
    console.error('MCC callback hatası:', err);
    res.redirect(`${FRONTEND_URL}/integrations?error=mcc`);
  }
});

// GET /api/mcc/accounts?session=SESSION_ID — MCC hesaplarını listele
router.get('/accounts', authMiddleware, async (req, res) => {
  const { session } = req.query;
  if (!session) return res.status(400).json({ error: 'session gerekli.' });

  try {
    const { rows: [sess] } = await pool.query(
      `SELECT * FROM oauth_sessions WHERE id = $1 AND provider = 'mcc' AND company_id = $2
       AND expires_at > NOW()`,
      [session, req.user.company_id]
    );
    if (!sess) return res.status(404).json({ error: 'Oturum bulunamadı veya süresi doldu.' });

    const tokens = {
      access_token: sess.access_token,
      refresh_token: sess.refresh_token,
      expiry_date: null,
    };
    const customers = await listMccCustomers(tokens);
    res.json({ customers, session_id: session });
  } catch (err) {
    console.error('MCC accounts hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcc/import — seçili hesapları platforma ekle
router.post('/import', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar MCC import yapabilir.' });
  }
  const { session_id, accounts } = req.body;
  if (!session_id || !Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: 'session_id ve accounts gerekli.' });
  }

  try {
    const { rows: [sess] } = await pool.query(
      `SELECT * FROM oauth_sessions WHERE id = $1 AND provider = 'mcc' AND company_id = $2
       AND expires_at > NOW()`,
      [session_id, req.user.company_id]
    );
    if (!sess) return res.status(404).json({ error: 'Oturum süresi doldu, yeniden bağlanın.' });

    const imported = [];
    const skipped = [];

    for (const acct of accounts) {
      const { id: accountId, name: accountName } = acct;
      if (!accountId) continue;

      // Bu Google Ads hesabıyla daha önce oluşturulmuş bir şirket var mı?
      const { rows: existing } = await pool.query(
        `SELECT c.id FROM companies c
         JOIN integrations i ON i.company_id = c.id
         WHERE i.platform = 'google_ads' AND i.account_id = $1 AND c.type = 'brand'`,
        [String(accountId)]
      );

      let brandCompanyId;
      if (existing.length > 0) {
        brandCompanyId = existing[0].id;
        skipped.push(accountName);
      } else {
        // Yeni marka şirketi oluştur
        const { rows: [company] } = await pool.query(
          `INSERT INTO companies (name, type) VALUES ($1, 'brand') RETURNING id`,
          [accountName]
        );
        brandCompanyId = company.id;

        // Google Ads entegrasyonunu kaydet
        await pool.query(
          `INSERT INTO integrations (company_id, platform, access_token, refresh_token, account_id, is_active)
           VALUES ($1, 'google_ads', $2, $3, $4, true)
           ON CONFLICT (company_id, platform) DO UPDATE
             SET access_token = EXCLUDED.access_token,
                 refresh_token = COALESCE(EXCLUDED.refresh_token, integrations.refresh_token),
                 account_id = EXCLUDED.account_id, is_active = true`,
          [brandCompanyId, sess.access_token, sess.refresh_token || null, String(accountId)]
        );

        imported.push(accountName);
      }

      // Ajans ↔ marka bağlantısı kur (yoksa)
      await pool.query(
        `INSERT INTO connections (agency_company_id, brand_company_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (agency_company_id, brand_company_id) DO NOTHING`,
        [req.user.company_id, brandCompanyId]
      );
    }

    // Oturumu sil
    await pool.query('DELETE FROM oauth_sessions WHERE id = $1', [session_id]);

    res.json({ imported, skipped, total: accounts.length });
  } catch (err) {
    console.error('MCC import hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
