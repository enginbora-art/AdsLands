const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const pool     = require('../db');
const auth     = require('../middleware/auth');
const sipay    = require('../services/sipayService');
const { PLANS, getAmount } = require('../config/plans');
const { createInvoice } = require('../services/invoiceService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:3001';

// ── POST /api/payments/initiate ───────────────────────────────────────────────
router.post('/initiate', auth, async (req, res) => {
  let orderId = null;
  try {
    console.log('[Payment] Frontend isteği:', { ...req.body, cc_no: req.body.cc_no ? `${req.body.cc_no} (uzunluk:${req.body.cc_no.length})` : 'YOK', cvv: '***' });

    const { plan, interval = 'monthly', cc_holder_name, cc_no, expiry_month, expiry_year, cvv } = req.body;

    if (!plan || !PLANS[plan]) return res.status(400).json({ error: 'Geçersiz plan.' });
    if (!cc_no || !expiry_month || !expiry_year || !cvv || !cc_holder_name) {
      return res.status(400).json({ error: 'Kart bilgileri eksik.' });
    }

    const { company_type, company_id, user_id, email } = req.user;

    const planCfg = PLANS[plan];
    if (planCfg.type === 'agency' && company_type !== 'agency') {
      return res.status(403).json({ error: 'Bu plan ajans hesapları içindir.' });
    }
    if (planCfg.type === 'brand' && company_type !== 'brand') {
      return res.status(403).json({ error: 'Bu plan marka hesapları içindir.' });
    }

    const amount = getAmount(plan, interval);
    orderId = uuidv4();

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

    const result = await sipay.initiate3DPayment({
      invoiceId:    orderId,
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
      description:           `AdsLands ${planCfg.label} — ${interval === 'yearly' ? 'Yıllık' : 'Aylık'}`,
      recurringFrequencyType: interval === 'yearly' ? 'Y' : 'M',
    });

    res.json({ html: result.html, orderId });
  } catch (err) {
    console.error('[Payment] HATA:', err.message, err.stack);
    if (orderId) {
      try {
        await pool.query(
          `UPDATE payment_transactions SET status = 'failed', error_message = $1 WHERE order_id = $2`,
          [err.message, orderId]
        );
      } catch (_) {}
    }
    res.status(500).json({ error: err.message || 'Ödeme başlatılamadı.' });
  }
});

// ── POST /api/payments/callback — Sipay 3D return (public) ───────────────────
router.post('/callback', express.urlencoded({ extended: true }), async (req, res) => {
  const callbackData = Object.keys(req.body).length > 0 ? req.body : req.query;
  console.log('[Payment] callback:', {
    invoice_id: callbackData.invoice_id,
    status: callbackData.status,
    sipay_status: callbackData.sipay_status,
  });

  const invoiceId = callbackData.invoice_id;
  if (!invoiceId) {
    console.error('[Payment] callback: invoice_id yok');
    return res.redirect(`${FRONTEND_URL}/payment/result?status=failed&reason=noinvoice`);
  }

  // Sipay checkstatus API ile doğrula
  let verifiedStatus;
  try {
    const checkResponse = await sipay.checkStatus(invoiceId);
    console.log('[Payment] checkstatus:', checkResponse.data.status_code, checkResponse.data.transaction_status);

    const isVerified =
      checkResponse.data.status_code === 100 &&
      checkResponse.data.transaction_status === 'Completed';

    if (!isVerified) {
      console.log('[Payment] checkstatus doğrulama başarısız:', checkResponse.data);
      return res.redirect(`${FRONTEND_URL}/payment/result?status=failed&reason=checkstatus`);
    }
    verifiedStatus = 'success';
  } catch (err) {
    console.error('[Payment] checkstatus hatası, callback status\'e güveniliyor:', err.message);
    verifiedStatus = (String(callbackData.sipay_status) === '1' || String(callbackData.status) === '1') ? 'success' : 'failed';
  }

  const status   = verifiedStatus;
  const sipayErr = callbackData.error || callbackData.status_description || null;

  // Transaction güncelle
  const { rows: [tx] } = await pool.query(
    `UPDATE payment_transactions
     SET status = $1, sipay_invoice_id = $2, error_message = $3
     WHERE order_id = $4
     RETURNING id, company_id, plan, interval, amount`,
    [status, callbackData.sipay_invoice_id || invoiceId, status === 'failed' ? sipayErr : null, invoiceId]
  );

  if (!tx) return res.redirect(`${FRONTEND_URL}/payment/result?status=failed&reason=notfound`);

  if (status === 'success') {
    const now       = new Date();
    const periodEnd = new Date(now);
    if (tx.interval === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Önceki aktif aboneliği kapat, yeni oluştur
    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = false, updated_at = NOW()
       WHERE company_id = $1 AND status IN ('active','cancelled') AND cancel_at_period_end = false`,
      [tx.company_id]
    );

    const recurringId = callbackData.sipay_recurring_id || callbackData.recurring_id || null;
    await pool.query(
      `INSERT INTO subscriptions (company_id, plan, interval, amount, currency, status, sipay_recurring_id, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, 'TRY', 'active', $5, $6, $7)`,
      [tx.company_id, tx.plan, tx.interval, tx.amount, recurringId, now, periodEnd]
    );

    // Fatura oluştur
    try {
      const { rows: [company] } = await pool.query('SELECT name FROM companies WHERE id = $1', [tx.company_id]);
      await createInvoice({
        companyId:   tx.company_id,
        companyName: company?.name,
        transactionId: tx.id,
        planKey:     tx.plan,
        amount:      tx.amount,
        periodStart: now,
        periodEnd,
      });
    } catch (e) {
      console.error('[Invoice] Fatura oluşturulamadı:', e.message);
    }

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
      `SELECT s.*, c.trial_ends_at
       FROM subscriptions s
       JOIN companies c ON c.id = s.company_id
       WHERE s.company_id = $1
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.company_id]
    );
    if (sub) return res.json(sub);

    // Abonelik yok — sadece trial bilgisi döndür
    const { rows: [comp] } = await pool.query(
      `SELECT trial_ends_at FROM companies WHERE id = $1`,
      [req.user.company_id]
    );
    res.json(comp ? { trial_ends_at: comp.trial_ends_at } : null);
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
      `UPDATE subscriptions SET cancel_at_period_end = true, updated_at = NOW() WHERE id = $1`,
      [sub.id]
    );
    res.json({ ok: true, cancel_at_period_end: true, current_period_end: sub.current_period_end });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payments/history ─────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
  try {
    const { month, page = '1', limit: limitParam = '5' } = req.query;
    const limit  = Math.min(Math.max(parseInt(limitParam) || 5, 1), 50);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    let where, countParams, dataParams;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      where       = `company_id = $1 AND TO_CHAR(created_at AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') = $2`;
      countParams = [req.user.company_id, month];
      dataParams  = [req.user.company_id, month, limit, offset];
    } else {
      where       = `company_id = $1 AND created_at >= NOW() - INTERVAL '3 months'`;
      countParams = [req.user.company_id];
      dataParams  = [req.user.company_id, limit, offset];
    }

    const offsetIdx = dataParams.length - 1; // $3 or $4 index for OFFSET
    const limitIdx  = dataParams.length - 2;

    const [{ rows: [{ count }] }, { rows }] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM payment_transactions WHERE ${where}`, countParams),
      pool.query(
        `SELECT id, order_id, sipay_invoice_id, amount, currency, status, plan, interval, error_message, created_at
         FROM payment_transactions
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx + 1} OFFSET $${offsetIdx + 1}`,
        dataParams
      ),
    ]);

    res.json({ transactions: rows, total: parseInt(count), page: parseInt(page), limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payments/invoice/:transactionId — query token destekler (PDF download) ──
router.get('/invoice/:transactionId', (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
}, async (req, res) => {
  try {
    const { transactionId } = req.params;

    // Önce mevcut faturayı ara
    let { rows: [inv] } = await pool.query(
      `SELECT i.* FROM invoices i
       JOIN payment_transactions pt ON pt.id = i.transaction_id
       WHERE i.transaction_id = $1 AND pt.company_id = $2`,
      [transactionId, req.user.company_id]
    );

    // Yoksa veya PDF dosyası eksikse anında oluştur
    if (!inv || !inv.pdf_path || !fs.existsSync(inv.pdf_path)) {
      const { rows: [tx] } = await pool.query(
        `SELECT pt.*, c.name AS company_name
         FROM payment_transactions pt
         JOIN companies c ON c.id = pt.company_id
         WHERE pt.id = $1 AND pt.company_id = $2 AND pt.status = 'success'`,
        [transactionId, req.user.company_id]
      );
      if (!tx) return res.status(404).json({ error: 'Başarılı ödeme işlemi bulunamadı.' });

      // Dönem bilgisini abonelikten almayı dene
      const { rows: [sub] } = await pool.query(
        `SELECT current_period_start, current_period_end
         FROM subscriptions
         WHERE company_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [req.user.company_id]
      );

      inv = await createInvoice({
        companyId:    tx.company_id,
        companyName:  tx.company_name,
        transactionId: tx.id,
        planKey:      tx.plan,
        amount:       tx.amount,
        periodStart:  sub?.current_period_start || tx.created_at,
        periodEnd:    sub?.current_period_end   || null,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoice_number}.pdf"`);
    fs.createReadStream(inv.pdf_path).pipe(res);
  } catch (err) {
    console.error('[Invoice] GET hatası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
