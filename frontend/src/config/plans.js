// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND PLAN CONFIG — keep in sync with backend/src/config/plans.js
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = {
  // ── Agency ──────────────────────────────────────────────────────────────────
  agency_basic: {
    key: 'agency_basic', label: 'Ajans Basic', type: 'agency', rank: 1,
    monthly_price: 20000, yearly_price: 16000, desc: '0-5 marka', color: '#0d9488',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları'],
  },
  agency_pro: {
    key: 'agency_pro', label: 'Ajans Pro', type: 'agency', rank: 2,
    monthly_price: 45000, yearly_price: 36000, desc: '5-10 marka', color: '#3b82f6', popular: true,
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark'],
  },
  agency_enterprise: {
    key: 'agency_enterprise', label: 'Ajans Enterprise', type: 'agency', rank: 3,
    monthly_price: 70000, yearly_price: 56000, desc: '10+ marka', color: '#8b5cf6',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark', 'TV Medya Planı ve İzleme'],
  },

  // ── Brand ────────────────────────────────────────────────────────────────────
  brand_basic: {
    key: 'brand_basic', label: 'Marka Basic', type: 'brand', rank: 1,
    monthly_price: 20000, yearly_price: 16000, desc: 'Marka hesabı', color: '#0d9488',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları'],
  },
  brand_pro: {
    key: 'brand_pro', label: 'Marka Pro', type: 'brand', rank: 2,
    monthly_price: 1500, yearly_price: 1200, desc: 'Kendi reklamınızı yönetin', color: '#3b82f6', popular: true,
    features: ['Tüm entegrasyonlar', 'AI Raporlar', 'TV Medya Planı', 'Ajans bağlantısı', 'Email destek'],
  },
  brand_enterprise: {
    key: 'brand_enterprise', label: 'Marka Enterprise', type: 'brand', rank: 3,
    monthly_price: 45000, yearly_price: 36000, desc: 'Marka hesabı', color: '#8b5cf6',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark'],
  },
};

// Flat label map — includes legacy aliases for JWT tokens still in circulation
export const PLAN_LABELS = {
  ...Object.fromEntries(Object.values(PLANS).map(p => [p.key, p.label])),
  trial:        'Deneme',
  none:         'Ücretsiz',
  // Legacy (old plan names — remove after all tokens expire)
  starter:      'Ajans Basic',
  growth:       'Ajans Pro',
  scale:        'Ajans Enterprise',
  brand_direct: 'Marka Pro',
};

// Rank map — includes legacy aliases for feature-gate comparisons
export const PLAN_RANK = {
  agency_basic: 1, agency_pro: 2, agency_enterprise: 3,
  brand_basic: 1, brand_pro: 2, brand_enterprise: 3,
  // Legacy aliases
  starter: 1, growth: 2, scale: 3, brand_direct: 2,
};

// Min plan required per sidebar item (by rank comparison)
export const ITEM_MIN_PLAN = {
  anomalies: 'agency_pro',        // rank 2
  benchmark: 'agency_pro',        // rank 2
  tvplan:    'agency_enterprise',  // rank 3
};

// Helpers
export const PLANS_BY_TYPE = (type) => Object.values(PLANS).filter(p => p.type === type);

// Admin panel filter options
export const PLAN_FILTER_OPTIONS = [
  { key: 'all',                label: 'Tümü' },
  { key: 'agency_basic',       label: 'Ajans Basic' },
  { key: 'agency_pro',         label: 'Ajans Pro' },
  { key: 'agency_enterprise',  label: 'Ajans Enterprise' },
  { key: 'brand_basic',        label: 'Marka Basic' },
  { key: 'brand_pro',          label: 'Marka Pro' },
  { key: 'brand_enterprise',   label: 'Marka Enterprise' },
  { key: 'trial',              label: 'Trial' },
  { key: 'pasif',              label: 'Pasif' },
];
