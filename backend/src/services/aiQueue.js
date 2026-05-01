let _queue = null;
let _initPromise = null;
const activeRequests  = new Map(); // id → { id, companyId, companyName, feature, enqueuedAt, startedAt, waitMs }
const waitingRequests = new Map(); // id → { ..., _reject }
let _idCounter = 0;
let _lastCriticalNotifAt = 0;
const CRITICAL_THRESHOLD  = 10;
const CRITICAL_COOLDOWN   = 10 * 60 * 1000; // 10 minutes

function ensureInit() {
  if (!_initPromise) {
    _initPromise = import('p-queue').then(({ default: PQueue }) => {
      _queue = new PQueue({ concurrency: 5 });
    });
  }
  return _initPromise;
}
ensureInit().catch(err => console.error('[aiQueue] init failed:', err.message));

async function sendCriticalNotif(size) {
  const now = Date.now();
  if (now - _lastCriticalNotifAt < CRITICAL_COOLDOWN) return;
  _lastCriticalNotifAt = now;
  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: `AdsLands <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: process.env.ADMIN_EMAIL || 'enginborasahin@gmail.com',
      subject: `⚠️ AI Queue Kritik: ${size} istek bekliyor`,
      html: `<div style="font-family:sans-serif;max-width:480px;padding:24px">
        <p>AI Queue kritik seviyede: <strong>${size}</strong> istek bekliyor.</p>
        <p>AdsLands Admin Paneli'nden durumu kontrol edin.</p>
      </div>`,
    });
    console.log(`[aiQueue] critical notification sent (size=${size})`);
  } catch (err) {
    console.error('[aiQueue] notification failed:', err.message);
  }
}

// fn receives { waitMs, startedAt } — meta is stored for active request tracking
const queueAiRequest = async (fn, meta = {}) => {
  await ensureInit();
  const id = ++_idCounter;
  const enqueuedAt = Date.now();

  return new Promise((resolve, reject) => {
    let cleared = false;

    const cancelReject = (err) => {
      if (cleared) return;
      cleared = true;
      waitingRequests.delete(id);
      reject(err);
    };

    waitingRequests.set(id, { id, ...meta, enqueuedAt, _reject: cancelReject });

    // Check critical threshold after adding
    if (waitingRequests.size > CRITICAL_THRESHOLD) {
      sendCriticalNotif(waitingRequests.size).catch(() => {});
    }

    _queue.add(async () => {
      if (cleared) return;
      waitingRequests.delete(id);

      const startedAt = Date.now();
      const waitMs = startedAt - enqueuedAt;
      activeRequests.set(id, { id, ...meta, enqueuedAt, startedAt, waitMs });

      try {
        const result = await fn({ waitMs, startedAt });
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        activeRequests.delete(id);
      }
    });
  });
};

// Cancel all waiting requests — returns count cleared
const clearQueue = () => {
  if (!_queue) return 0;
  _queue.clear();
  const entries = [...waitingRequests.values()];
  const err = Object.assign(
    new Error('Sistem yoğunluğu nedeniyle isteğiniz iptal edildi, lütfen tekrar deneyin.'),
    { code: 'QUEUE_CLEARED' }
  );
  entries.forEach(w => w._reject(err));
  const count = entries.length;
  waitingRequests.clear();
  return count;
};

const setConcurrency = (n) => {
  if (_queue) _queue.concurrency = n;
};

const getQueueStatus = () => ({
  size:        _queue ? _queue.size        : 0,
  pending:     _queue ? _queue.pending     : 0,
  concurrency: _queue ? _queue.concurrency : 5,
});

const getActiveRequests = () => [...activeRequests.values()];

module.exports = { queueAiRequest, getQueueStatus, getActiveRequests, clearQueue, setConcurrency };
