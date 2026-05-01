// Platform-specific field mappings for when real APIs are connected.
// Mock services already return normalized shape; these mappings apply to raw API responses.
const FIELD_MAP = {
  google_ads: {
    spend:       raw => raw.cost_micros != null ? raw.cost_micros / 1_000_000 : raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.conversions,
    roas:        raw => raw.roas,
  },
  meta: {
    spend:       raw => raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.conversions,
    roas:        raw => raw.roas,
  },
  tiktok: {
    spend:       raw => raw.stat_cost  ?? raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.conversions,
    roas:        raw => raw.roas,
  },
  linkedin: {
    spend:       raw => raw.costInUsd  ?? raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.conversions,
    roas:        raw => raw.roas,
  },
  adform: {
    spend:       raw => raw.cost       ?? raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.conversions,
    roas:        raw => raw.roas,
  },
  appsflyer: {
    spend:       raw => raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.installs   ?? raw.conversions,
    roas:        raw => raw.roas,
  },
  adjust: {
    spend:       raw => raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.installs   ?? raw.conversions,
    roas:        raw => raw.roas,
  },
  google_analytics: {
    spend:       raw => raw.spend,
    impressions: raw => raw.impressions,
    clicks:      raw => raw.clicks,
    conversions: raw => raw.goal_completions ?? raw.conversions,
    roas:        raw => raw.roas,
  },
};

function validateAndNormalize(platform, rawData) {
  if (!rawData || typeof rawData !== 'object') {
    throw new Error(`[${platform}] Geçersiz ham veri: ${JSON.stringify(rawData)}`);
  }
  if (!rawData.date) {
    throw new Error(`[${platform}] date alanı eksik`);
  }

  const map = FIELD_MAP[platform];
  const extract = map
    ? field => map[field](rawData)
    : field => rawData[field];

  const normalized = {
    date:        rawData.date,
    spend:       extract('spend')       ?? 0,
    impressions: extract('impressions') ?? 0,
    clicks:      extract('clicks')      ?? 0,
    conversions: extract('conversions') ?? 0,
    roas:        extract('roas')        ?? 0,
  };

  // Coerce to numbers so downstream math never gets NaN
  for (const field of ['spend', 'impressions', 'clicks', 'conversions', 'roas']) {
    normalized[field] = parseFloat(normalized[field]) || 0;
  }

  if (normalized.spend < 0)       throw new Error(`[${platform}] Negatif spend: ${normalized.spend}`);
  if (normalized.impressions < 0) throw new Error(`[${platform}] Negatif impressions: ${normalized.impressions}`);
  if (normalized.clicks < 0)      throw new Error(`[${platform}] Negatif clicks: ${normalized.clicks}`);
  if (normalized.roas < 0)        throw new Error(`[${platform}] Negatif roas: ${normalized.roas}`);

  if (normalized.clicks > normalized.impressions && normalized.impressions > 0) {
    console.warn(`[Normalizer] [${platform}] clicks (${normalized.clicks}) > impressions (${normalized.impressions}), impressions'a eşitleniyor`);
    normalized.clicks = normalized.impressions;
  }

  return normalized;
}

module.exports = { validateAndNormalize };
