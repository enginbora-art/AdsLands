const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /api/invitations/send
router.post('/send', authMiddleware, async (req, res) => {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { receiver_email } = req.body;

  if (!receiver_email) {
    return res.status(400).json({ error: 'Alıcı e-posta adresi zorunludur.' });
  }

  try {
    const token = uuidv4();
    const inviteLink = `${process.env.FRONTEND_URL || 'https://adslands.com'}/invite/${token}`;

    await pool.query(
      'INSERT INTO invitations (sender_id, receiver_email, token) VALUES ($1, $2, $3)',
      [req.user.id, receiver_email, token]
    );

    const senderResult = await pool.query(
      'SELECT company_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    const sender = senderResult.rows[0];
    const inviterType = sender.role === 'brand' ? 'Marka' : 'Ajans';

    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: receiver_email,
      subject: 'Sizi AdsLands platformuna davet ediyoruz',
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
          <div style="margin-bottom:28px;">
            <span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span>
          </div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Platforma davet edildiniz</h2>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 24px;">
            ${inviterType} hesabı <strong style="color:#F0F5F3;">${sender.company_name}</strong>,
            sizi AdsLands reklam yönetim platformuna davet etti.
          </p>
          <a href="${inviteLink}"
            style="display:inline-block;padding:13px 28px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Daveti Kabul Et
          </a>
          <p style="margin-top:32px;font-size:12px;color:#5A7080;line-height:1.5;">
            Bu link size özel oluşturulmuştur, başkalarıyla paylaşmayın.<br/>
            Daveti beklemiyorsanız bu e-postayı dikkate almayınız.
          </p>
        </div>
      `,
    });

    res.json({ message: 'Davet e-postası gönderildi.', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Davet gönderilemedi.' });
  }
});

// GET /api/invitations/:token
router.get('/:token', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.company_name AS sender_company, u.role AS sender_role
       FROM invitations i JOIN users u ON i.sender_id = u.id
       WHERE i.token = $1`,
      [req.params.token]
    );

    const invitation = result.rows[0];
    if (!invitation) return res.status(404).json({ error: 'Davet bulunamadı.' });
    if (invitation.status === 'accepted') return res.status(410).json({ error: 'Bu davet linki daha önce kullanılmış.' });

    res.json({
      receiver_email: invitation.receiver_email,
      sender_company: invitation.sender_company,
      sender_role: invitation.sender_role,
      status: invitation.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/invitations/accept
router.post('/accept', async (req, res) => {
  const { token, password, company_name, role } = req.body;

  if (!token || !password || !company_name || !role) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  try {
    const invResult = await pool.query('SELECT * FROM invitations WHERE token = $1', [token]);
    const invitation = invResult.rows[0];

    if (!invitation) return res.status(404).json({ error: 'Davet bulunamadı.' });
    if (invitation.status === 'accepted') return res.status(410).json({ error: 'Bu davet daha önce kullanılmış.' });

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [invitation.receiver_email]);
    if (exists.rows.length > 0) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });

    const password_hash = await bcrypt.hash(password, 12);

    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role, company_name) VALUES ($1, $2, $3, $4) RETURNING id, email, role, company_name',
      [invitation.receiver_email, password_hash, role, company_name]
    );

    await pool.query("UPDATE invitations SET status = 'accepted' WHERE token = $1", [token]);

    const newUser = userResult.rows[0];
    const jwtToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token: jwtToken, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hesap oluşturulamadı.' });
  }
});

module.exports = router;
