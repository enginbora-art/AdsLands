const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { getMetaBmAuthUrl, exchangeMetaToken, listAdAccounts } = require('../services/metaService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// GET /api/metabm/connect — Facebook OAuth URL döndür
router.get('/connect', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar Meta BM bağlayabilir.' });
  }
  if (!process.env.FACEBOOK_APP_ID) {
    return res.status(503).json({ error: 'Facebook App ID yapılandırılmamış.' });
  }
  try {
    const authUrl = getMetaBmAuthUrl(req.user.company_id);
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/metabm/callback — Facebook OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/integrations?error=metabm`);
  }

  let companyId;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    companyId = parsed.companyId;
  } catch {
    return res.redirect(`${FRONTEND_URL}/integrations?error=metabm`);
  }

  try {
    const accessToken = await exchangeMetaToken(code);

    const { rows: [session] } = await pool.query(
      `INSERT INTO oauth_sessions (company_id, provider, access_token)
       VALUES ($1, 'metabm', $2) RETURNING id`,
      [companyId, accessToken]
    );

    res.redirect(`${FRONTEND_URL}/integrations?metabm_session=${session.id}`);
  } catch (err) {
    console.error('Meta BM callback hatası:', err);
    res.redirect(`${FRONTEND_URL}/integrations?error=metabm`);
  }
});

// GET /api/metabm/accounts?session=SESSION_ID — Ad account listesi
router.get('/accounts', authMiddleware, async (req, res) => {
  const { session } = req.query;
  if (!session) return res.status(400).json({ error: 'session gerekli.' });

  try {
    const { rows: [sess] } = await pool.query(
      `SELECT * FROM oauth_sessions WHERE id = $1 AND provider = 'metabm' AND company_id = $2
       AND expires_at > NOW()`,
      [session, req.user.company_id]
    );
    if (!sess) return res.status(404).json({ error: 'Oturum bulunamadı veya süresi doldu.' });

    const accounts = await listAdAccounts(sess.access_token);
    res.json({ accounts, session_id: session });
  } catch (err) {
    console.error('Meta BM accounts hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/metabm/import — seçili ad account'ları platforma ekle
router.post('/import', authMiddleware, async (req, res) => {
  if (req.user.company_type !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajanslar Meta BM import yapabilir.' });
  }
  const { session_id, accounts } = req.body;
  if (!session_id || !Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ error: 'session_id ve accounts gerekli.' });
  }

  try {
    const { rows: [sess] } = await pool.query(
      `SELECT * FROM oauth_sessions WHERE id = $1 AND provider = 'metabm' AND company_id = $2
       AND expires_at > NOW()`,
      [session_id, req.user.company_id]
    );
    if (!sess) return res.status(404).json({ error: 'Oturum süresi doldu, yeniden bağlanın.' });

    const imported = [];
    const skipped = [];

    for (const acct of accounts) {
      const { id: accountId, name: accountName } = acct;
      if (!accountId) continue;

      // Daha önce bu Meta ad account'u için marka var mı?
      const { rows: existing } = await pool.query(
        `SELECT c.id FROM companies c
         JOIN integrations i ON i.company_id = c.id
         WHERE i.platform = 'meta' AND i.account_id = $1 AND c.type = 'brand'`,
        [String(accountId)]
      );

      let brandCompanyId;
      if (existing.length > 0) {
        brandCompanyId = existing[0].id;
        skipped.push(accountName);
      } else {
        const { rows: [company] } = await pool.query(
          `INSERT INTO companies (name, type) VALUES ($1, 'brand') RETURNING id`,
          [accountName]
        );
        brandCompanyId = company.id;

        await pool.query(
          `INSERT INTO integrations (company_id, platform, access_token, account_id, is_active)
           VALUES ($1, 'meta', $2, $3, true)
           ON CONFLICT (company_id, platform) DO UPDATE
             SET access_token = EXCLUDED.access_token,
                 account_id = EXCLUDED.account_id, is_active = true`,
          [brandCompanyId, sess.access_token, String(accountId)]
        );

        imported.push(accountName);
      }

      // Ajans ↔ marka bağlantısı
      await pool.query(
        `INSERT INTO connections (agency_company_id, brand_company_id, status)
         VALUES ($1, $2, 'accepted')
         ON CONFLICT (agency_company_id, brand_company_id) DO NOTHING`,
        [req.user.company_id, brandCompanyId]
      );
    }

    await pool.query('DELETE FROM oauth_sessions WHERE id = $1', [session_id]);

    res.json({ imported, skipped, total: accounts.length });
  } catch (err) {
    console.error('Meta BM import hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
