const pool = require('../db');

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getSettings() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache;
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    _cache = Object.fromEntries(rows.map(r => [r.key, r.value]));
    _cacheTime = now;
  } catch (err) {
    console.error('[appSettings] cache refresh failed:', err.message);
    if (!_cache) _cache = {};
  }
  return _cache;
}

async function getSetting(key, defaultValue) {
  const settings = await getSettings();
  const raw = settings[key];
  if (raw === undefined || raw === null) return defaultValue;
  const num = Number(raw);
  return isNaN(num) ? raw : num;
}

function invalidateCache() {
  _cache = null;
}

module.exports = { getSettings, getSetting, invalidateCache };
