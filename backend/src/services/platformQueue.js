let _queues = null;

function getQueues() {
  if (_queues) return _queues;
  // p-queue ESM-only — dynamic require with lazy init
  const PQueue = require('p-queue').default || require('p-queue');
  _queues = {
    google_ads:       new PQueue({ concurrency: 5, interval: 1000, intervalCap: 10 }),
    google_analytics: new PQueue({ concurrency: 5, interval: 1000, intervalCap: 10 }),
    meta:             new PQueue({ concurrency: 3, interval: 1000, intervalCap: 5  }),
    tiktok:           new PQueue({ concurrency: 5, interval: 1000, intervalCap: 10 }),
    linkedin:         new PQueue({ concurrency: 2, interval: 1000, intervalCap: 3  }),
    adform:           new PQueue({ concurrency: 3, interval: 1000, intervalCap: 8  }),
    appsflyer:        new PQueue({ concurrency: 3, interval: 1000, intervalCap: 5  }),
    adjust:           new PQueue({ concurrency: 3, interval: 1000, intervalCap: 5  }),
  };
  return _queues;
}

// Rate limit tetikleyen HTTP status'ler ve hata mesajları
function isRateLimitError(err) {
  return (
    err?.status === 429 || err?.response?.status === 429 ||
    err?.code === 429 ||
    err?.message?.toLowerCase().includes('rate limit') ||
    err?.message?.toLowerCase().includes('quota exceeded') ||
    err?.message?.toLowerCase().includes('too many requests')
  );
}

async function callWithRetry(platform, fn, maxRetries = 3) {
  const queues = getQueues();
  const queue = queues[platform] || queues.google_ads;

  return queue.add(async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (isRateLimitError(err) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.warn(`[platformQueue] [${platform}] Rate limit — ${delay}ms bekleniyor (deneme ${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        // Transient network error — kısa retry
        const isTransient = err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND';
        if (isTransient && attempt < maxRetries) {
          const delay = attempt * 500;
          console.warn(`[platformQueue] [${platform}] Ağ hatası (${err.code}), ${delay}ms sonra tekrar (${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  });
}

module.exports = { callWithRetry };
