const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://adslands.com';

async function createNotification(client, { user_id, company_id, type, title, message, meta }) {
  await client.query(
    `INSERT INTO notifications (user_id, company_id, type, title, message, meta)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user_id, company_id, type, title, message, JSON.stringify(meta || {})]
  );
}

async function notifyCompanyAdmins(client, companyId, notif) {
  const { rows: admins } = await client.query(
    'SELECT id FROM users WHERE company_id = $1 AND is_company_admin = true AND is_active = true',
    [companyId]
  );
  for (const admin of admins) {
    await createNotification(client, { ...notif, user_id: admin.id, company_id: companyId });
  }
}

// GET /api/invitations — gelen davetler (receiver_company_id = benim şirketim)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, c.name AS sender_company_name, c.type AS sender_company_type
       FROM invitations i
       JOIN companies c ON c.id = i.sender_company_id
       WHERE i.receiver_company_id = $1 AND i.status = 'pending'
         AND i.type IN ('agency_to_brand', 'brand_to_agency')
       ORDER BY i.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/invitations/sent — gönderilen davetler
router.get('/sent', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, c.name AS receiver_company_name
       FROM invitations i
       LEFT JOIN companies c ON c.id = i.receiver_company_id
       WHERE i.sender_company_id = $1 AND i.type IN ('agency_to_brand', 'brand_to_agency')
       ORDER BY i.created_at DESC`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/invitations/companies — bağlanılabilecek şirketler
router.get('/companies', authMiddleware, async (req, res) => {
  const targetType = req.user.company_type === 'agency' ? 'brand' : 'agency';
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.name, c.type, c.created_at
       FROM companies c
       WHERE c.type = $1
         AND c.id NOT IN (
           SELECT agency_company_id FROM connections WHERE brand_company_id = $2
           UNION
           SELECT brand_company_id FROM connections WHERE agency_company_id = $2
         )
         AND c.id NOT IN (
           SELECT receiver_company_id FROM invitations
           WHERE sender_company_id = $2 AND status = 'pending'
             AND receiver_company_id IS NOT NULL
         )
       ORDER BY c.name`,
      [targetType, req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/invitations/connections — kabul edilmiş bağlantılar
router.get('/connections', authMiddleware, async (req, res) => {
  try {
    let rows;
    if (req.user.company_type === 'agency') {
      ({ rows } = await pool.query(
        `SELECT c.brand_company_id AS partner_id, co.name AS partner_name, c.created_at
         FROM connections c JOIN companies co ON co.id = c.brand_company_id
         WHERE c.agency_company_id = $1 ORDER BY co.name`,
        [req.user.company_id]
      ));
    } else {
      ({ rows } = await pool.query(
        `SELECT c.agency_company_id AS partner_id, co.name AS partner_name, c.created_at
         FROM connections c JOIN companies co ON co.id = c.agency_company_id
         WHERE c.brand_company_id = $1 ORDER BY co.name`,
        [req.user.company_id]
      ));
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/invitations/send — davet gönder
router.post('/send', authMiddleware, async (req, res) => {
  const { receiver_company_id, receiver_email, company_name } = req.body;

  if (!receiver_company_id && !receiver_email) {
    return res.status(400).json({ error: 'Alıcı şirket veya e-posta zorunludur.' });
  }

  const myType = req.user.company_type;
  if (!['agency', 'brand'].includes(myType)) {
    return res.status(403).json({ error: 'Sadece ajans ve marka hesapları davet gönderebilir.' });
  }
  const invType = myType === 'agency' ? 'agency_to_brand' : 'brand_to_agency';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (receiver_company_id) {
      const { rows: [alreadyConn] } = await client.query(
        `SELECT id FROM connections
         WHERE (agency_company_id = $1 AND brand_company_id = $2)
            OR (agency_company_id = $2 AND brand_company_id = $1)`,
        [req.user.company_id, receiver_company_id]
      );
      if (alreadyConn) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Bu şirketle zaten bağlantınız var.' });
      }

      const { rows: [pending] } = await client.query(
        `SELECT id FROM invitations
         WHERE sender_company_id = $1 AND receiver_company_id = $2 AND status = 'pending'`,
        [req.user.company_id, receiver_company_id]
      );
      if (pending) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Bu şirkete zaten bekleyen bir davetiniz var.' });
      }

      const { rows: [inv] } = await client.query(
        `INSERT INTO invitations (sender_company_id, sender_user_id, receiver_email, receiver_company_id, type)
         VALUES ($1, $2, '', $3, $4) RETURNING id`,
        [req.user.company_id, req.user.user_id, receiver_company_id, invType]
      );

      const { rows: [senderCompany] } = await client.query(
        'SELECT name FROM companies WHERE id = $1', [req.user.company_id]
      );
      await notifyCompanyAdmins(client, receiver_company_id, {
        type: 'invitation',
        title: 'Yeni bağlantı isteği',
        message: `${senderCompany.name} bağlantı isteği gönderdi.`,
        meta: { invitation_id: inv.id },
      });

      await client.query('COMMIT');
      return res.json({ message: 'Bağlantı isteği gönderildi.' });
    }

    // Kayıtsız e-postaya davet (setup linki ile)
    if (!receiver_email?.trim() || !company_name?.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'E-posta ve şirket adı zorunludur.' });
    }

    const { rows: [emailExists] } = await client.query(
      'SELECT id FROM users WHERE email = $1', [receiver_email]
    );
    if (emailExists) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı. Şirket listesinden seçin.' });
    }

    const { rows: [alreadyPending] } = await client.query(
      `SELECT id FROM invitations
       WHERE sender_company_id = $1 AND receiver_email = $2 AND status = 'pending'`,
      [req.user.company_id, receiver_email]
    );
    if (alreadyPending) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Bu adrese zaten bekleyen bir davetiniz var.' });
    }

    const token = uuidv4();
    await client.query(
      `INSERT INTO invitations (sender_company_id, sender_user_id, receiver_email, type, token)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.company_id, req.user.user_id, receiver_email, invType, token]
    );

    const { rows: [senderCompany] } = await client.query(
      'SELECT name FROM companies WHERE id = $1', [req.user.company_id]
    );
    const setupLink = `${FRONTEND_URL}/setup/${token}?company_name=${encodeURIComponent(company_name.trim())}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: receiver_email,
      subject: `${senderCompany.name} sizi AdsLands'e davet etti`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0B1219;color:#F0F5F3;padding:40px;border-radius:12px;">
          <div style="margin-bottom:28px;"><span style="font-size:20px;font-weight:700;">Ads<span style="color:#00BFA6;">Lands</span></span></div>
          <h2 style="font-size:22px;font-weight:700;margin:0 0 12px;">Platforma davet edildiniz</h2>
          <p style="color:#94A8B3;line-height:1.6;margin:0 0 24px;">
            <strong style="color:#F0F5F3;">${senderCompany.name}</strong> şirketi,
            <strong style="color:#F0F5F3;">${company_name.trim()}</strong> adına sizi davet etti.
          </p>
          <a href="${setupLink}" style="display:inline-block;padding:13px 28px;background:#00BFA6;color:#0B1219;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Hesabımı Oluştur
          </a>
          <p style="margin-top:32px;font-size:12px;color:#5A7080;">Bu link size özeldir, başkalarıyla paylaşmayın.</p>
        </div>
      `,
    });

    await client.query('COMMIT');
    res.json({ message: 'Davet e-postası gönderildi.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});

// POST /api/invitations/:id/accept
router.post('/:id/accept', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [inv] } = await client.query(
      `SELECT i.*, c.name AS sender_name
       FROM invitations i JOIN companies c ON c.id = i.sender_company_id
       WHERE i.id = $1 AND i.receiver_company_id = $2 AND i.status = 'pending'`,
      [req.params.id, req.user.company_id]
    );
    if (!inv) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Davet bulunamadı.' });
    }

    const agencyId = inv.type === 'agency_to_brand' ? inv.sender_company_id : inv.receiver_company_id;
    const brandId  = inv.type === 'agency_to_brand' ? inv.receiver_company_id : inv.sender_company_id;

    await client.query(
      'INSERT INTO connections (agency_company_id, brand_company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [agencyId, brandId]
    );
    await client.query(
      "UPDATE invitations SET status = 'accepted' WHERE id = $1",
      [inv.id]
    );

    const { rows: [myCompany] } = await client.query(
      'SELECT name FROM companies WHERE id = $1', [req.user.company_id]
    );
    await notifyCompanyAdmins(client, inv.sender_company_id, {
      type: 'invitation_accepted',
      title: 'Bağlantı isteği kabul edildi',
      message: `${myCompany.name} bağlantı isteğinizi kabul etti.`,
      meta: { invitation_id: inv.id },
    });

    await client.query('COMMIT');
    res.json({ message: 'Bağlantı isteği kabul edildi.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  } finally {
    client.release();
  }
});

// POST /api/invitations/:id/reject
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { rows: [inv] } = await pool.query(
      `UPDATE invitations SET status = 'rejected'
       WHERE id = $1 AND receiver_company_id = $2 AND status = 'pending'
       RETURNING id`,
      [req.params.id, req.user.company_id]
    );
    if (!inv) return res.status(404).json({ error: 'Davet bulunamadı.' });
    res.json({ message: 'Davet reddedildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
