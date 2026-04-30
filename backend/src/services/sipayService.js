const axios  = require('axios');
const crypto = require('crypto');

const BASE_URL     = process.env.SIPAY_BASE_URL;
const APP_ID       = process.env.SIPAY_APP_ID;
const APP_SECRET   = process.env.SIPAY_APP_SECRET;
const MERCHANT_KEY = process.env.SIPAY_MERCHANT_KEY;
const MERCHANT_ID  = process.env.SIPAY_MERCHANT_ID;

// ── In-memory token cache ─────────────────────────────────────────────────────
let _cachedToken  = null;
let _tokenExpires = 0; // ms epoch

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpires) return _cachedToken;

  const res = await axios.post(`${BASE_URL}/api/token`, {
    app_id:     APP_ID,
    app_secret: APP_SECRET,
  }, { headers: { 'Content-Type': 'application/json' } });

  const token = res.data?.data?.token;
  if (!token) throw new Error('Sipay token alınamadı: ' + JSON.stringify(res.data));

  _cachedToken  = token;
  _tokenExpires = Date.now() + 110 * 60 * 1000; // 110 dakika
  return token;
}

// ── Hash hesaplama ────────────────────────────────────────────────────────────
// SHA-256 raw bytes → base64 (PHP: base64_encode(hash('sha256', $str, true)))
// Sipay separator: |
function sha256b64(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('base64');
}

// ── POS al ───────────────────────────────────────────────────────────────────
async function getPos(amount, currencyCode = 'TRY') {
  const token      = await getToken();
  const fmtAmount  = Number(amount).toFixed(2);
  const hashKey    = sha256b64(MERCHANT_KEY, fmtAmount, currencyCode, APP_SECRET);

  const params = new URLSearchParams();
  params.append('merchant_key',   MERCHANT_KEY);
  params.append('amount',         fmtAmount);
  params.append('currency_code',  currencyCode);
  params.append('hash_key',       hashKey);
  params.append('is_2d',          '0');

  let res;
  try {
    res = await axios.post(`${BASE_URL}/api/getpos`, params, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (axiosErr) {
    console.error('[Sipay] getpos AXIOS ERROR status:', axiosErr.response?.status);
    console.error('[Sipay] getpos AXIOS ERROR body:', JSON.stringify(axiosErr.response?.data, null, 2));
    throw new Error(axiosErr.response?.data?.status_description || axiosErr.message);
  }

  console.log('[Sipay] getpos RESPONSE:', JSON.stringify(res.data, null, 2));
  if (res.data?.status_code !== 100) {
    throw new Error(res.data?.status_description || 'POS alınamadı.');
  }
  return res.data.data.pos_id;
}

// ── 3D Ödeme başlat ──────────────────────────────────────────────────────────
async function initiate3DPayment({ invoiceId, amount, currencyCode = 'TRY',
  ccHolderName, ccNo, expiryMonth, expiryYear, cvv,
  name, surname, billEmail, billPhone, returnUrl, cancelUrl, description, items }) {

  const token      = await getToken();
  const posId      = await getPos(amount, currencyCode);
  const cleanCard  = String(ccNo).replace(/\s/g, '');
  const fmtAmount  = Number(amount).toFixed(2);
  // Hash: merchant_key|invoice_id|total|currency_code|app_secret
  const hashKey    = sha256b64(MERCHANT_KEY, invoiceId, fmtAmount, currencyCode, APP_SECRET);

  const payload = {
    cc_holder_name:      ccHolderName,
    credit_card:         cleanCard,
    expiry_month:        String(expiryMonth).padStart(2, '0'),
    expiry_year:         String(expiryYear).slice(-2),
    cvv:                 String(cvv),
    currency_code:       currencyCode,
    installments_number: 1,
    invoice_id:          invoiceId,
    invoice_description: description || 'AdsLands Abonelik',
    total:               fmtAmount,
    merchant_key:        MERCHANT_KEY,
    items:               items || [{ name: description || 'Abonelik', price: fmtAmount, quantity: 1, description: 'AdsLands' }],
    name,
    surname,
    bill_email:          billEmail || '',
    bill_phone:          billPhone || '',
    pos_id:              posId,
    hash_key:            hashKey,
    return_url:          returnUrl,
    cancel_url:          cancelUrl,
    response_method:     'POST',
  };

  const maskedCard = cleanCard.slice(0, 6) + '******' + cleanCard.slice(-4);
  console.log('[Sipay] pay3d REQUEST:', JSON.stringify({
    ...payload,
    credit_card: maskedCard,
    cvv: '***',
  }, null, 2));

  const params = new URLSearchParams();
  Object.entries(payload).forEach(([k, v]) => {
    params.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  });

  let res;
  try {
    res = await axios.post(`${BASE_URL}/api/pay3d`, params, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (axiosErr) {
    console.error('[Sipay] pay3d AXIOS ERROR status:', axiosErr.response?.status);
    console.error('[Sipay] pay3d AXIOS ERROR body:', JSON.stringify(axiosErr.response?.data, null, 2));
    throw new Error(axiosErr.response?.data?.status_description || axiosErr.message);
  }

  console.log('[Sipay] pay3d RESPONSE:', JSON.stringify(res.data, null, 2));
  if (res.data?.status_code !== 100) {
    throw new Error(res.data?.status_description || '3D ödeme başlatılamadı.');
  }
  return res.data.data; // HTML form string
}

// ── Callback hash doğrulama ───────────────────────────────────────────────────
function verifyHash(body) {
  const { invoice_id, order_id, amount, status, hash_key } = body;
  if (!hash_key) return false;
  const expected = sha256b64(MERCHANT_KEY, invoice_id, order_id || '', amount || '', String(status));
  return expected === hash_key;
}

// ── Kart kaydet ───────────────────────────────────────────────────────────────
async function saveCard({ invoiceId, ccNo, expiryMonth, expiryYear, cvv, ccHolderName, returnUrl }) {
  const token = await getToken();
  const res = await axios.post(`${BASE_URL}/api/cardregistration`, {
    invoice_id:    invoiceId,
    cc_no:         ccNo,
    expiry_month:  String(expiryMonth).padStart(2, '0'),
    expiry_year:   String(expiryYear).slice(-2),
    cvv:           String(cvv),
    cc_holder_name: ccHolderName,
    return_url:    returnUrl,
    merchant_key:  MERCHANT_KEY,
  }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });

  return res.data;
}

// ── Kayıtlı kartla ödeme ─────────────────────────────────────────────────────
async function chargeWithSavedCard({ invoiceId, cardToken, amount, currencyCode = 'TRY', description }) {
  const token = await getToken();
  const res = await axios.post(`${BASE_URL}/api/paywithtoken`, {
    invoice_id:          invoiceId,
    card_token:          cardToken,
    total:               Number(amount).toFixed(2),
    currency_code:       currencyCode,
    invoice_description: description || 'AdsLands Abonelik',
    merchant_key:        MERCHANT_KEY,
    installments_number: 1,
  }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });

  return res.data;
}

// ── Recurring plan sorgula ────────────────────────────────────────────────────
async function getRecurringPlan(recurringId) {
  const token = await getToken();
  const res = await axios.post(`${BASE_URL}/api/recurring/search`,
    { recurring_id: recurringId },
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

// ── Recurring iptal ───────────────────────────────────────────────────────────
async function cancelRecurring(recurringId) {
  const token = await getToken();
  const res = await axios.post(`${BASE_URL}/api/recurring/update`,
    { recurring_id: recurringId, status: 'cancelled' },
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

// ── İade ─────────────────────────────────────────────────────────────────────
async function refund(invoiceId, amount) {
  const token = await getToken();
  const res = await axios.post(`${BASE_URL}/api/refund`,
    { invoice_id: invoiceId, amount: Number(amount).toFixed(2) },
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return res.data;
}

module.exports = { getToken, initiate3DPayment, verifyHash, saveCard, chargeWithSavedCard, getRecurringPlan, cancelRecurring, refund };
