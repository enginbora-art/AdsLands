const metrics = {
  totalSpend: 127450,
  totalSpendChange: 12.3,
  roas: 3.84,
  roasChange: 0.42,
  roasIndustryAvg: 2.90,
  conversions: 1247,
  conversionsChange: 8.7,
  cpa: 102.21,
  ctr: 2.41,
  ctrChange: -0.18,
  ctrPrevWeek: 2.59,
};

const weeklySpend = [
  { day: 'Pzt', google: 14200, meta: 9800 },
  { day: 'Sal', google: 16500, meta: 11200 },
  { day: 'Çar', google: 15800, meta: 10500 },
  { day: 'Per', google: 18200, meta: 12100 },
  { day: 'Cum', google: 19500, meta: 13200 },
  { day: 'Cmt', google: 12100, meta: 8400 },
  { day: 'Paz', google: 11900, meta: 7800 },
];

const roasData = {
  google: { roas: 4.21, cpa: 89 },
  meta: { roas: 3.47, cpa: 118 },
};

const sparklines = {
  spend: [78, 82, 90, 85, 95, 100, 112, 127],
  roas: [3.1, 3.2, 3.4, 3.3, 3.5, 3.6, 3.7, 3.84],
  conversions: [950, 1020, 980, 1050, 1100, 1150, 1200, 1247],
  ctr: [2.7, 2.6, 2.5, 2.6, 2.5, 2.4, 2.5, 2.41],
};

const anomalies = [
  {
    id: 1,
    type: 'cpc_spike',
    severity: 'high',
    title: 'Anomali tespit edildi — Google Ads CPC',
    description: 'Tıklama başı maliyet son 30 günlük ortalamanın %67 üzerinde. Ortalama: ₺3.12 → Bugün: ₺5.21. Retargeting kampanyasındaki kitle daralması kaynaklı olabilir.',
    time: '2 saat önce',
    channel: 'Google Ads',
    metric: 'CPC',
    baseline: 3.12,
    current: 5.21,
    deviation: 67,
  },
  {
    id: 2,
    type: 'ctr_drop',
    severity: 'medium',
    title: 'CTR düşüşü — Meta Ads Feed',
    description: 'Meta Ads feed kampanyasında CTR geçen haftaya göre %12 geriledi.',
    time: '5 saat önce',
    channel: 'Meta Ads',
    metric: 'CTR',
    baseline: 2.8,
    current: 2.46,
    deviation: -12,
  },
];

const channels = {
  google: {
    spend: 78200,
    spendChange: 15.1,
    budgetShare: 61,
    roas: 4.21,
    cpa: 89,
    ctr: 2.8,
    impressions: 2850000,
    clicks: 79800,
    conversions: 878,
  },
  meta: {
    spend: 49250,
    spendChange: 8.2,
    budgetShare: 39,
    roas: 3.47,
    cpa: 118,
    ctr: 1.9,
    impressions: 3200000,
    clicks: 60800,
    conversions: 418,
  },
  aiRecommendation: 'Meta retargeting\'e %15 kaydır',
  estimatedRoasGain: 0.6,
};

const comparisonTable = [
  { metric: 'Harcama', google: '₺78,200', meta: '₺49,250', diff: '+₺28,950' },
  { metric: 'ROAS', google: '4.21', meta: '3.47', diff: '+0.74' },
  { metric: 'CTR', google: '%2.8', meta: '%1.9', diff: '+0.9%' },
  { metric: 'CPC', google: '₺0.98', meta: '₺0.81', diff: '+₺0.17' },
  { metric: 'CPA', google: '₺89', meta: '₺118', diff: '-₺29' },
  { metric: 'Dönüşüm', google: '878', meta: '418', diff: '+460' },
  { metric: 'İzlenim', google: '2.85M', meta: '3.20M', diff: '-350K' },
];

const aiReport = {
  period: '7 – 13 Nisan 2026',
  summary: 'Bu hafta toplam dijital reklam harcamanız ₺127,450 olarak gerçekleşti, geçen haftaya göre %12.3 artış gösterdi. Genel ROAS 3.84 seviyesinde — sektör ortalaması olan 2.90\'ın oldukça üzerinde.',
  googleInsight: 'Google Ads tarafında arama kampanyaları güçlü performansını sürdürdü. Marka aramaları %8 artarken, genel arama CPC\'si ₺3.12 ortalamayla stabil kaldı. Ancak retargeting kampanyasında CPC ₺5.21\'e yükseldi — bu son 30 günlük ortalamanın %67 üzerinde.',
  metaInsight: 'Meta Ads tarafında lookalike kitleleri beklentilerin üzerinde performans gösterdi. Dönüşüm oranı %3.2 ile son 4 haftanın en yüksek seviyesine ulaştı. Story formatı, feed\'e göre %40 daha düşük CPA sağlıyor.',
  recommendation: 'Meta retargeting kampanyasına mevcut bütçeden %15 kaydırma yapılması durumunda, tahmini genel ROAS\'ın 3.84\'ten 4.44\'e yükselmesi bekleniyor.',
  previousReports: [
    { period: '31 Mar – 6 Nis 2026', roas: 3.42, spend: 113500 },
    { period: '24 – 30 Mar 2026', roas: 3.58, spend: 108200 },
    { period: '17 – 23 Mar 2026', roas: 3.21, spend: 98750 },
  ],
  roasTrend: [3.1, 3.2, 3.21, 3.35, 3.42, 3.58, 3.72, 3.84],
};

const tvBroadcast = {
  reclaimAmount: 284500,
  reclaimMissed: 14,
  reclaimWrongSlot: 6,
  totalBroadcasts: 487,
  complianceRate: 94.2,
  complianceChange: 2.1,
  missedBroadcasts: 14,
  primeTimeShare: 38,
  primeTimeChange: 5,
  channels: [
    { name: 'Kanal D', status: 'live', currentAd: true, matchRate: 99.2, lastAdTime: '20:47:12', duration: 15, todayCount: 11, borderColor: '#EF4444' },
    { name: 'ATV', status: 'live', currentAd: false, lastAdTime: '20:23', todayCount: 8, borderColor: '#EF4444' },
    { name: 'Show TV', status: 'live', currentAd: false, lastAdTime: '18:12', todayCount: 6, borderColor: '#F59E0B' },
    { name: 'Star TV', status: 'live', currentAd: true, matchRate: 98.7, lastAdTime: '20:44:38', duration: 15, todayCount: 9, borderColor: '#A78BFA' },
    { name: 'TRT 1', status: 'live', currentAd: false, lastAdTime: '14:58', todayCount: 4, borderColor: '#34D399' },
  ],
  planVsActual: [
    { channel: 'Kanal D', color: '#EF4444', planned: 148, actual: 142, rate: 96, status: 'good' },
    { channel: 'ATV', color: '#EF4444', planned: 118, actual: 98, rate: 83, status: 'warn' },
    { channel: 'Show TV', color: '#F59E0B', planned: 91, actual: 93, rate: 102, status: 'good' },
    { channel: 'Star TV', color: '#A78BFA', planned: 90, actual: 79, rate: 88, status: 'warn' },
    { channel: 'TRT 1', color: '#34D399', planned: 75, actual: 75, rate: 100, status: 'good' },
  ],
  competitors: [
    { name: 'TechModa (siz)', initials: 'TM', color: '#F472B6', broadcasts: 487, estimatedSpend: '₺3.2M', isOwn: true },
    { name: 'ModaX', initials: 'MX', color: '#A78BFA', broadcasts: 612, estimatedSpend: '₺4.1M' },
    { name: 'FashionStyle', initials: 'FS', color: '#FFB547', broadcasts: 398, estimatedSpend: '₺2.6M' },
    { name: 'StyleTrend', initials: 'ST', color: '#60A5FA', broadcasts: 285, estimatedSpend: '₺1.9M' },
  ],
  detectionLog: [
    { id: 1, channel: 'Kanal D', channelClass: 'kanald', time: 'Bugün · 20:47:12', slot: 'prime', duration: '15 sn', match: 99.2, status: 'verified' },
    { id: 2, channel: 'Star TV', channelClass: 'star', time: 'Bugün · 20:44:38', slot: 'prime', duration: '15 sn', match: 98.7, status: 'verified' },
    { id: 3, channel: 'ATV', channelClass: 'atv', time: 'Bugün · 20:23:05', slot: 'prime', duration: '30 sn', match: 97.1, status: 'verified' },
    { id: 4, channel: 'Show TV', channelClass: 'showtv', time: 'Bugün · 18:12:44', slot: 'day', duration: '15 sn', match: 96.8, status: 'warn' },
    { id: 5, channel: 'TRT 1', channelClass: 'trt', time: 'Bugün · 14:58:19', slot: 'day', duration: '20 sn', match: 95.3, status: 'verified' },
    { id: 6, channel: 'ATV', channelClass: 'atv', time: 'Bugün · 12:30:00', slot: 'day', duration: '15 sn', match: 99.0, status: 'verified' },
  ],
};

const budget = {
  totalBudget: 150000,
  spent: 127450,
  remaining: 22550,
  burnRate: 84.9,
  forecastEndOfMonth: 148200,
  channels: [
    { name: 'Google Ads', budget: 90000, spent: 78200, color: '#60A5FA' },
    { name: 'Meta Ads', budget: 60000, spent: 49250, color: '#A78BFA' },
  ],
  campaigns: [
    { name: 'Marka Arama', channel: 'Google', budget: 25000, spent: 22100, roas: 5.2, status: 'active' },
    { name: 'Genel Arama', channel: 'Google', budget: 35000, spent: 31400, roas: 3.8, status: 'active' },
    { name: 'Retargeting', channel: 'Google', budget: 20000, spent: 17800, roas: 4.1, status: 'warning' },
    { name: 'Lookalike', channel: 'Meta', budget: 30000, spent: 26500, roas: 3.9, status: 'active' },
    { name: 'Story Ads', channel: 'Meta', budget: 20000, spent: 15200, roas: 3.2, status: 'active' },
    { name: 'Feed Retargeting', channel: 'Meta', budget: 10000, spent: 7550, roas: 2.8, status: 'active' },
  ],
};

const benchmark = {
  industry: 'Moda & Tekstil',
  period: 'Nisan 2026',
  metrics: [
    { name: 'ROAS', yours: 3.84, industryAvg: 2.90, topQuartile: 4.50, unit: 'x' },
    { name: 'CTR', yours: 2.41, industryAvg: 1.85, topQuartile: 3.10, unit: '%' },
    { name: 'CPA', yours: 102, industryAvg: 145, topQuartile: 78, unit: '₺', lowerIsBetter: true },
    { name: 'CPC', yours: 0.91, industryAvg: 1.20, topQuartile: 0.65, unit: '₺', lowerIsBetter: true },
    { name: 'Dönüşüm Oranı', yours: 3.2, industryAvg: 2.4, topQuartile: 4.1, unit: '%' },
  ],
};

const reports = [
  { id: 1, name: 'Haftalık Performans — 7-13 Nisan', type: 'weekly', createdAt: '2026-04-14', status: 'ready' },
  { id: 2, name: 'TV Yayın Doğrulama — Mart 2026', type: 'tv', createdAt: '2026-04-01', status: 'ready' },
  { id: 3, name: 'Rakip Analizi — Q1 2026', type: 'competitor', createdAt: '2026-04-01', status: 'ready' },
  { id: 4, name: 'Bütçe Optimizasyon Raporu', type: 'budget', createdAt: '2026-03-28', status: 'ready' },
];

const agency = {
  workspace: { name: 'TechModa A.Ş.', role: 'Marka yöneticisi', initials: 'TM' },
  team: [
    { id: 1, name: 'Ayşe Demir', role: 'Hesap Müdürü', email: 'ayse@techmoda.com', initials: 'AD', color: '#00BFA6', status: 'active' },
    { id: 2, name: 'Mehmet Yılmaz', role: 'Medya Uzmanı', email: 'mehmet@techmoda.com', initials: 'MY', color: '#60A5FA', status: 'active' },
    { id: 3, name: 'Zeynep Kaya', role: 'Analitik', email: 'zeynep@techmoda.com', initials: 'ZK', color: '#A78BFA', status: 'active' },
  ],
  integrations: [
    { name: 'Google Ads', icon: 'G', color: '#60A5FA', status: 'connected', lastSync: '5 dk önce' },
    { name: 'Meta Ads', icon: 'M', color: '#A78BFA', status: 'connected', lastSync: '12 dk önce' },
    { name: 'TikTok Ads', icon: 'T', color: '#FF6B5A', status: 'disconnected', lastSync: null },
    { name: 'Google Analytics', icon: 'GA', color: '#FFB547', status: 'connected', lastSync: '1 saat önce' },
  ],
};

const settings = {
  profile: { name: 'Engin Borasahin', email: 'enginborasahin@gmail.com', company: 'TechModa A.Ş.', role: 'Marka yöneticisi' },
  notifications: {
    anomalyAlerts: true,
    weeklyReport: true,
    tvDetection: true,
    budgetWarnings: true,
    emailDigest: false,
  },
  currency: 'TRY',
  language: 'tr',
  timezone: 'Europe/Istanbul',
};

module.exports = { metrics, weeklySpend, roasData, sparklines, anomalies, channels, comparisonTable, aiReport, tvBroadcast, budget, benchmark, reports, agency, settings };
