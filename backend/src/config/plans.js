// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH — plan metadata, prices, AI limits
// Keep in sync with frontend/src/config/plans.js
// ─────────────────────────────────────────────────────────────────────────────

const PLANS = {
  // ── Agency plans ─────────────────────────────────────────────────────────────
  agency_basic: {
    key:           'agency_basic',
    label:         'Ajans Basic',
    type:          'agency',
    rank:          1,
    monthly_price: 20000,
    yearly_price:  16000,
    desc:          '0-5 marka',
    color:         '#0d9488',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları'],
    ai_limits: { channel_analysis: 20, ai_report: 5, tv_plan_suggestion: 5, kpi_analysis: 20, plan_import: 5 },
  },
  agency_pro: {
    key:           'agency_pro',
    label:         'Ajans Pro',
    type:          'agency',
    rank:          2,
    monthly_price: 45000,
    yearly_price:  36000,
    desc:          '5-10 marka',
    color:         '#3b82f6',
    popular:       true,
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark'],
    ai_limits: { channel_analysis: 80, ai_report: 20, tv_plan_suggestion: 20, kpi_analysis: 80, plan_import: 15 },
  },
  agency_enterprise: {
    key:           'agency_enterprise',
    label:         'Ajans Enterprise',
    type:          'agency',
    rank:          3,
    monthly_price: 70000,
    yearly_price:  56000,
    desc:          '10+ marka',
    color:         '#8b5cf6',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark', 'TV Medya Planı ve İzleme'],
    ai_limits: { channel_analysis: 500, ai_report: 100, tv_plan_suggestion: 100, kpi_analysis: 500, plan_import: 50 },
  },

  // ── Brand plans ───────────────────────────────────────────────────────────────
  brand_basic: {
    key:           'brand_basic',
    label:         'Marka Basic',
    type:          'brand',
    rank:          1,
    monthly_price: 20000,
    yearly_price:  16000,
    desc:          'Marka hesabı',
    color:         '#0d9488',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları'],
    ai_limits: { channel_analysis: 20, ai_report: 5, tv_plan_suggestion: 5, kpi_analysis: 20, plan_import: 5 },
  },
  brand_pro: {
    key:           'brand_pro',
    label:         'Marka Pro',
    type:          'brand',
    rank:          2,
    monthly_price: 1500,
    yearly_price:  1200,
    desc:          'Kendi reklamınızı yönetin',
    color:         '#3b82f6',
    popular:       true,
    features: ['Tüm entegrasyonlar', 'AI Raporlar', 'TV Medya Planı', 'Ajans bağlantısı', 'Email destek'],
    ai_limits: { channel_analysis: 40, ai_report: 10, tv_plan_suggestion: 10, kpi_analysis: 40, plan_import: 10 },
  },
  brand_enterprise: {
    key:           'brand_enterprise',
    label:         'Marka Enterprise',
    type:          'brand',
    rank:          3,
    monthly_price: 45000,
    yearly_price:  36000,
    desc:          'Marka hesabı',
    color:         '#8b5cf6',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark'],
    ai_limits: { channel_analysis: 500, ai_report: 100, tv_plan_suggestion: 100, kpi_analysis: 500, plan_import: 50 },
  },
};

// Plans not on the pricing page (no payment flow)
const SPECIAL_PLANS = {
  trial: {
    label:      'Deneme',
    ai_limits:  { channel_analysis: 10, ai_report: 3, tv_plan_suggestion: 3, kpi_analysis: 10, plan_import: 3 },
  },
  none: {
    label:      'Ücretsiz',
    ai_limits:  { channel_analysis: 10, ai_report: 3, tv_plan_suggestion: 3, kpi_analysis: 10, plan_import: 3 },
  },
};

// Flat label map (all plans including specials)
const PLAN_LABELS = {
  ...Object.fromEntries(Object.values(PLANS).map(p => [p.key, p.label])),
  trial: 'Deneme',
  none:  'Ücretsiz',
};

// Get AI monthly limit for a (plan, feature) pair
function getAiLimit(plan, feature) {
  const p = PLANS[plan] || SPECIAL_PLANS[plan] || SPECIAL_PLANS.none;
  return p.ai_limits[feature] ?? (SPECIAL_PLANS.none.ai_limits[feature] ?? 3);
}

// Get payment amount for a plan+interval
function getAmount(plan, interval) {
  const p = PLANS[plan];
  if (!p) throw new Error('Geçersiz plan.');
  return interval === 'yearly' ? p.yearly_price : p.monthly_price;
}

module.exports = { PLANS, SPECIAL_PLANS, PLAN_LABELS, getAmount, getAiLimit };
