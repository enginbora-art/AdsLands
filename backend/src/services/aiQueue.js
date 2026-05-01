let _queue = null;
let _initPromise = null;

function ensureInit() {
  if (!_initPromise) {
    _initPromise = import('p-queue').then(({ default: PQueue }) => {
      _queue = new PQueue({ concurrency: 5 });
    });
  }
  return _initPromise;
}

// Eagerly initialize so the queue is ready before first request
ensureInit().catch(err => console.error('[aiQueue] init failed:', err.message));

const queueAiRequest = async (fn) => {
  await ensureInit();
  return _queue.add(fn);
};

const getQueueStatus = () => ({
  size:    _queue ? _queue.size    : 0,
  pending: _queue ? _queue.pending : 0,
});

module.exports = { queueAiRequest, getQueueStatus };
