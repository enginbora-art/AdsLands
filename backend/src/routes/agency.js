const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://adslands.com';

// POST /api/agency/invite-brand
router.post('/invite-brand', authMiddleware, async (req, res) => {
  if (req.user.role !== 'agency') {
    return res.status(403).json({ error: 'Sadece ajans hesapları kullanabilir.' });
  }

  const { email, company_name } = req.body;
  if (!email || !company_name?.trim()) {
    return res.status(400).json({ error: 'E-posta ve şirket adı zorunludur.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı.' });
    }

    const alreadyInvited = await pool.query(
      "SELECT id FROM agency_brand_invitations WHERE agency_id = $1 AND receiver_email = $2 AND status = 'pending'",
      [req.user.id, email]
    );
    if (alreadyInvited.rows.length > 0) {
      return res.status(409).json({ error: 'Bu adrese zaten bekleyen bir davet var.' });
    }

    const token = uuidv4();
    const setupLink = `${FRONTEND_URL}/setup/${token}`;

    await pool.query(
      'INSERT INTO agency_brand_invitations (agency_id, receiver_email, company_name, setup_token) VALUES ($1, $2, $3, $4)',
      [req.user.id, email, company_name.trim(), token]
    );

    const agencyResult = await pool.query('SELECT company_name FROM users WHERE id = $1', [req.user.id]);
    const agencyName = agencyResult.rows[0]?.company_name || 'Ajans';

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `${agencyName} sizi AdsLands'e davet etti`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
          <div style="margin-bottom:28px;">
            <span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Platforma davet edildiniz</h2>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 8px;">
            <strong style="color:#F0F5F3;">${agencyName}</strong> ajansı,
            <strong style="color:#F0F5F3;">${company_name.trim()}</strong> şirketi adına sizi
            AdsLands reklam yönetim platformuna davet etti.
          </p>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 24px;">
            Hesabınızı oluşturmak ve ajansla çalışmaya başlamak için aşağıdaki butona tıklayın.
          </p>
          <a href="${setupLink}"
            style="display:inline-block;padding:13px 28px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Hesabımı Oluştur
          </a>
          <p style="margin-top:32px;font-size:12px;color:#5A7080;line-height:1.5;">
            Bu link size özel oluşturulmuştur, başkalarıyla paylaşmayın.<br/>
            Daveti beklemiyorsanız bu e-postayı dikkate almayınız.
          </p>
        </div>
      `,
    });

    res.json({ message: 'Davet gönderildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Davet gönderilemedi.' });
  }
});

module.exports = router;
