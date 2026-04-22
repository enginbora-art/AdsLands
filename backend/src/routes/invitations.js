const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// POST /api/invitations/send
router.post('/send', authMiddleware, async (req, res) => {
  const { receiver_email } = req.body;

  if (!receiver_email) {
    return res.status(400).json({ error: 'Alıcı e-posta adresi zorunludur.' });
  }

  try {
    const token = uuidv4();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/invite/${token}`;

    await pool.query(
      'INSERT INTO invitations (sender_id, receiver_email, token) VALUES ($1, $2, $3)',
      [req.user.id, receiver_email, token]
    );

    const senderResult = await pool.query('SELECT company_name, user_type FROM users WHERE id = $1', [req.user.id]);
    const sender = senderResult.rows[0];
    const inviterType = sender.user_type === 'brand' ? 'Marka' : 'Ajans';

    await transporter.sendMail({
      from: `"AdsLens" <${process.env.SMTP_USER}>`,
      to: receiver_email,
      subject: `${sender.company_name} sizi AdsLens'e davet etti`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:32px;border-radius:12px;">
          <h2 style="color:#00BFA6;margin-bottom:8px;">AdsLens Daveti</h2>
          <p style="color:#94A8B3;">${inviterType} hesabı <strong style="color:#F0F5F3;">${sender.company_name}</strong> sizi AdsLens platformuna davet etti.</p>
          <a href="${inviteLink}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;">Daveti Kabul Et</a>
          <p style="margin-top:24px;font-size:12px;color:#5A7080;">Bu link size özel oluşturulmuştur. Başkalarıyla paylaşmayın.</p>
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
      `SELECT i.*, u.company_name AS sender_company, u.user_type AS sender_type
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
      sender_type: invitation.sender_type,
      status: invitation.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/invitations/accept
router.post('/accept', async (req, res) => {
  const { token, password, company_name, user_type } = req.body;

  if (!token || !password || !company_name || !user_type) {
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
      'INSERT INTO users (email, password_hash, user_type, company_name) VALUES ($1, $2, $3, $4) RETURNING id, email, user_type, company_name',
      [invitation.receiver_email, password_hash, user_type, company_name]
    );

    await pool.query("UPDATE invitations SET status = 'accepted' WHERE token = $1", [token]);

    const newUser = userResult.rows[0];
    const jwtToken = jwt.sign(
      { id: newUser.id, email: newUser.email, user_type: newUser.user_type },
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
