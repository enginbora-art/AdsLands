const express  = require('express');
const router   = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool     = require('../db');
const auth     = require('../middleware/auth');
const sipay    = require('../services/sipayService');
const { PLANS, getAmount } = require('../config/plans');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:3001';

// ── POST /api/payments/initiate ───────────────────────────────────────────────
router.post('/initiate', auth, async (req, res) => {
  console.log('[Payment] Frontend isteği:', { ...req.body, cc_no: req.body.cc_no ? `${req.body.cc_no} (uzunluk:${req.body.cc_no.length})` : 'YOK', cvv: '***' });

  const { plan, interval = 'monthly', cc_holder_name, cc_no, expiry_month, expiry_year, cvv } = req.body;

  if (!plan || !PLANS[plan]) return res.status(400).json({ error: 'Geçersiz plan.' });
  if (!cc_no || !expiry_month || !expiry_year || !cvv || !cc_holder_name) {
    return res.status(400).json({ error: 'Kart bilgileri eksik.' });
  }

  const { company_type, company_id, user_id, email } = req.user;

  // Plan / şirket tipi uyumu
  const planCfg = PLANS[plan];
  if (planCfg.type === 'agency' && company_type !== 'agency') {
    return res.status(403).json({ error: 'Bu plan ajans hesapları içindir.' });
  }
  if (planCfg.type === 'brand' && company_type !== 'brand') {
    return res.status(403).json({ error: 'Bu plan marka hesapları içindir.' });
  }

  const amount  = getAmount(plan, interval);
  const orderId = uuidv4();

  // Pending transaction kaydet
  await pool.query(
    `INSERT INTO payment_transactions (company_id, user_id, order_id, amount, currency, status, plan, interval)
     VALUES ($1, $2, $3, $4, 'TRY', 'pending', $5, $6)`,
    [company_id, user_id, orderId, amount, plan, interval]
  );

  const returnUrl = `${BACKEND_URL}/api/payments/callback`;
  const cancelUrl = `${FRONTEND_URL}/payment/result?status=failed`;

  const nameParts = (cc_holder_name || 'Kullanıcı').split(' ');
  const firstName = nameParts[0] || 'Ad';
  const lastName  = nameParts.slice(1).join(' ') || 'Soyad';

  try {
    const html = await sipay.initiate3DPayment({
      invoiceId:   orderId,
      amount,
      ccHolderName: cc_holder_name,
      ccNo:         cc_no,
      expiryMonth:  expiry_month,
      expiryYear:   expiry_year,
      cvv,
      name:         firstName,
      surname:      lastName,
      billEmail:    email,
      billPhone:    req.user.phone || '',
      returnUrl,
      cancelUrl,
      description:  `AdsLands ${planCfg.label} — ${interval === 'yearly' ? 'Yıllık' : 'Aylık'}`,
    });

    res.json({ html, orderId });
  } catch (err) {
    await pool.query(
      `UPDATE payment_transactions SET status = 'failed', error_message = $1 WHERE order_id = $2`,
      [err.message, orderId]
    );
    res.status(502).json({ error: err.message || 'Ödeme başlatılamadı.' });
  }
});

// ── POST /api/payments/callback — Sipay 3D return (public) ───────────────────
router.post('/callback', async (req, res) => {
  const body = req.body;

  // Hash doğrulama
  if (!sipay.verifyHash(body)) {
    console.warn('Sipay callback: geçersiz hash', body);
    return res.redirect(`${FRONTEND_URL}/payment/result?status=failed&reason=hash`);
  }

  const invoiceId = body.invoice_id;
  const status    = String(body.status) === '1' ? 'success' : 'failed';
  const sipayErr  = body.error || body.status_description || null;

  // Transaction güncelle
  const { rows: [tx] } = await pool.query(
    `UPDATE payment_transactions
     SET status = $1, sipay_invoice_id = $2, error_message = $3
     WHERE order_id = $4
     RETURNING company_id, plan, interval, amount`,
    [status, body.sipay_invoice_id || invoiceId, status === 'failed' ? sipayErr : null, invoiceId]
  );

  if (!tx) return res.redirect(`${FRONTEND_URL}/payment/result?status=failed&reason=notfound`);

  if (status === 'success') {
    const now     = new Date();
    const periodEnd = new Date(now);
    if (tx.interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Önceki aktif aboneliği kapat, yeni oluştur
    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
       WHERE company_id = $1 AND status = 'active'`,
      [tx.company_id]
    );
    await pool.query(
      `INSERT INTO subscriptions (company_id, plan, interval, amount, currency, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, 'TRY', 'active', $5, $6)`,
      [tx.company_id, tx.plan, tx.interval, tx.amount, now, periodEnd]
    );

    return res.redirect(`${FRONTEND_URL}/payment/result?status=success`);
  }

  res.redirect(`${FRONTEND_URL}/payment/result?status=failed`);
});

// ── POST /api/payments/webhook — Sipay webhook (public) ──────────────────────
router.post('/webhook', async (req, res) => {
  const body = req.body;
  if (!sipay.verifyHash(body)) {
    return res.status(403).json({ error: 'Geçersiz hash.' });
  }

  const invoiceId = body.invoice_id;
  const status    = String(body.status) === '1' ? 'success' : 'failed';

  await pool.query(
    `UPDATE payment_transactions SET status = $1, sipay_invoice_id = $2 WHERE order_id = $3`,
    [status, body.sipay_invoice_id || invoiceId, invoiceId]
  );

  res.json({ ok: true });
});

// ── GET /api/payments/subscription ───────────────────────────────────────────
router.get('/subscription', auth, async (req, res) => {
  try {
    const { rows: [sub] } = await pool.query(
      `SELECT * FROM subscriptions WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [req.user.company_id]
    );
    res.json(sub || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payments/cancel ─────────────────────────────────────────────────
router.post('/cancel', auth, async (req, res) => {
  try {
    const { rows: [sub] } = await pool.query(
      `SELECT * FROM subscriptions WHERE company_id = $1 AND status = 'active'`,
      [req.user.company_id]
    );
    if (!sub) return res.status(404).json({ error: 'Aktif abonelik bulunamadı.' });

    if (sub.sipay_recurring_id) {
      try { await sipay.cancelRecurring(sub.sipay_recurring_id); } catch (e) {
        console.error('Sipay recurring cancel failed:', e.message);
      }
    }

    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [sub.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payments/history ─────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, order_id, sipay_invoice_id, amount, currency, status, plan, interval, error_message, created_at
       FROM payment_transactions
       WHERE company_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.company_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
