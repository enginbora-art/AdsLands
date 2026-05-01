const PLANS = {
  starter: {
    monthly: 20000,
    yearly:  16000,
    label:   'Basic',
    desc:    '0-5 marka',
    type:    'agency',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları'],
  },
  growth: {
    monthly: 45000,
    yearly:  36000,
    label:   'Pro',
    desc:    '5-10 marka',
    type:    'agency',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark'],
  },
  scale: {
    monthly: 70000,
    yearly:  56000,
    label:   'Enterprise',
    desc:    '10+ marka',
    type:    'agency',
    features: ['Tüm entegrasyonlar', 'Bütçe planlama', 'Kanal analizi', 'AI raporları', 'Anomali uyarıları', 'Benchmark', 'TV Medya Planı ve İzleme'],
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
