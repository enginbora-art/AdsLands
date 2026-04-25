const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { sendSetupEmail } = require('./admin');
const { ALL_PERMISSIONS } = require('../constants');

function companyAdminOnly(req, res, next) {
  if (!req.user.is_company_admin && !req.user.is_platform_admin) {
    return res.status(403).json({ error: 'Şirket yöneticisi yetkisi gerekiyor.' });
  }
  next();
}

// ── Roller ────────────────────────────────────────────────────────────────────

// GET /api/company/roles
router.get('/roles', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, COUNT(u.id) AS user_count
       FROM roles r LEFT JOIN users u ON u.role_id = r.id
       WHERE r.company_id = $1
       GROUP BY r.id ORDER BY r.created_at`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/company/roles
router.post('/roles', authMiddleware, companyAdminOnly, async (req, res) => {
  const { name, permissions } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Rol adı zorunludur.' });

  const safePerms = (permissions || []).filter(p => ALL_PERMISSIONS.includes(p));

  try {
    const { rows: [role] } = await pool.query(
      'INSERT INTO roles (company_id, name, permissions) VALUES ($1, $2, $3) RETURNING *',
      [req.user.company_id, name.trim(), JSON.stringify(safePerms)]
    );
    res.status(201).json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PUT /api/company/roles/:id
router.put('/roles/:id', authMiddleware, companyAdminOnly, async (req, res) => {
  const { name, permissions } = req.body;
  const safePerms = (permissions || []).filter(p => ALL_PERMISSIONS.includes(p));

  try {
    const { rows: [role] } = await pool.query(
      `UPDATE roles SET name = COALESCE($1, name), permissions = $2
       WHERE id = $3 AND company_id = $4 RETURNING *`,
      [name?.trim() || null, JSON.stringify(safePerms), req.params.id, req.user.company_id]
    );
    if (!role) return res.status(404).json({ error: 'Rol bulunamadı.' });
    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// DELETE /api/company/roles/:id
router.delete('/roles/:id', authMiddleware, companyAdminOnly, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET role_id = NULL WHERE role_id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    await pool.query(
      'DELETE FROM roles WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.company_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// ── Kullanıcılar ──────────────────────────────────────────────────────────────

// GET /api/company/users
router.get('/users', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.is_company_admin, u.is_active, u.created_at,
              r.id AS role_id, r.name AS role_name, r.permissions
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.company_id = $1
       ORDER BY u.created_at`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/company/users/invite — şirkete kullanıcı davet et
router.post('/users/invite', authMiddleware, companyAdminOnly, async (req, res) => {
  const { email, role_id } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'E-posta zorunludur.' });

  try {
    const { rows: [exists] } = await pool.query(
      'SELECT id FROM users WHERE email = $1', [email]
    );
    if (exists) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });

    const { rows: [pending] } = await pool.query(
      `SELECT id FROM invitations
       WHERE sender_company_id = $1 AND receiver_email = $2
         AND type = 'user_invite' AND status = 'pending'`,
      [req.user.company_id, email]
    );
    if (pending) return res.status(409).json({ error: 'Bu adrese zaten bekleyen bir davet var.' });

    const token = uuidv4();
    await pool.query(
      `INSERT INTO invitations (sender_company_id, sender_user_id, receiver_email, type, token)
       VALUES ($1, $2, $3, 'user_invite', $4)`,
      [req.user.company_id, req.user.user_id, email, token]
    );

    const { rows: [company] } = await pool.query(
      'SELECT name, type FROM companies WHERE id = $1', [req.user.company_id]
    );
    await sendSetupEmail(email, company.name, company.type, token);

    // Rol ata (opsiyonel)
    if (role_id) {
      // Rol bilgisi invitation kabul edilince kullanılmak üzere invitations.meta'ya kaydedilebilir
      // Şimdilik sadece davet gönderildi
    }

    res.json({ message: 'Davet gönderildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/company/users/:id/toggle — aktif/pasif yap
router.patch('/users/:id/toggle', authMiddleware, companyAdminOnly, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query(
      `UPDATE users SET is_active = NOT is_active
       WHERE id = $1 AND company_id = $2 AND is_platform_admin = false
       RETURNING id, email, is_active`,
      [req.params.id, req.user.company_id]
    );
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// PATCH /api/company/users/:id/role — rol ata
router.patch('/users/:id/role', authMiddleware, companyAdminOnly, async (req, res) => {
  const { role_id } = req.body;
  try {
    const { rows: [user] } = await pool.query(
      `UPDATE users SET role_id = $1
       WHERE id = $2 AND company_id = $3
       RETURNING id, email, role_id`,
      [role_id || null, req.params.id, req.user.company_id]
    );
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/company/permissions — mevcut permission listesi
router.get('/permissions', authMiddleware, (req, res) => {
  res.json(ALL_PERMISSIONS);
});

module.exports = router;
