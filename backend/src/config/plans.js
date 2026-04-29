const PLANS = {
  starter: {
    monthly: 1000,
    yearly:  800,
    label:   'Ajans Starter',
    desc:    '0-10 marka',
    type:    'agency',
    features: ['10 marka', 'Tüm entegrasyonlar', 'AI Raporlar', 'Email destek'],
  },
  growth: {
    monthly: 1500,
    yearly:  1200,
    label:   'Ajans Growth',
    desc:    '11-20 marka',
    type:    'agency',
    features: ['20 marka', 'Tüm entegrasyonlar', 'AI Raporlar', 'Öncelikli destek', 'TV Medya Planı'],
  },
  scale: {
    monthly: 2000,
    yearly:  1600,
    label:   'Ajans Scale',
    desc:    '21+ marka',
    type:    'agency',
    features: ['Sınırsız marka', 'Tüm entegrasyonlar', 'AI Raporlar', '7/24 destek', 'TV Medya Planı', 'Özel entegrasyon'],
  },
  brand_direct: {
    monthly: 1500,
    yearly:  1200,
    label:   'Marka Direkt',
    desc:    'Kendi reklamınızı yönetin',
    type:    'brand',
    features: ['Tüm entegrasyonlar', 'AI Raporlar', 'TV Medya Planı', 'Ajans bağlantısı', 'Email destek'],
  },
};

function getAmount(plan, interval) {
  const p = PLANS[plan];
  if (!p) throw new Error('Geçersiz plan.');
  return interval === 'yearly' ? p.yearly : p.monthly;
}

module.exports = { PLANS, getAmount };
