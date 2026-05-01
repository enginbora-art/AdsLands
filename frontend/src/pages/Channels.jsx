import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getChannelData, getAiUsageToday, getAiQueueStatus } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';

// ── Sabitler ──────────────────────────────────────────────────────────────────
const PLATFORM_LABELS = {
  google_ads: 'Google Ads', google_analytics: 'Google Analytics',
  meta: 'Meta Ads', tiktok: 'TikTok Ads', linkedin: 'LinkedIn Ads',
  adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};
const PLATFORM_COLORS = {
  google_ads: '#4285F4', google_analytics: '#E37400',
  meta: '#1877F2', tiktok: '#555555', linkedin: '#0A66C2',
  adform: '#E84B37', appsflyer: '#00B2FF', adjust: '#888888',
};

// Reklam harcaması olan platformlar (attribution araçları dahil değil)
const SPEND_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform'];

// Tüm desteklenen platformlar (AI analizi ve sinerjisi için)
const ALL_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform', 'appsflyer', 'adjust', 'google_analytics'];

// Harcama bölümleri boş state listesi — sadece 5 reklam platformu
const SPEND_PLATFORMS_LIST = [
  { key: 'google_ads', label: 'Google Ads',   icon: 'G',  color: '#4285F4' },
  { key: 'meta',       label: 'Meta Ads',      icon: 'M',  color: '#1877F2' },
  { key: 'tiktok',     label: 'TikTok Ads',    icon: 'T',  color: '#555555' },
  { key: 'linkedin',   label: 'LinkedIn Ads',  icon: 'in', color: '#0A66C2' },
  { key: 'adform',     label: 'Adform',        icon: 'AF', color: '#E84B37' },
];

// Attribution/AI bölümleri boş state listesi — tüm platformlar
const ALL_PLATFORMS_LIST = [
  { key: 'google_ads',       label: 'Google Ads',        icon: 'G',  color: '#4285F4' },
  { key: 'meta',             label: 'Meta Ads',           icon: 'M',  color: '#1877F2' },
  { key: 'tiktok',           label: 'TikTok Ads',         icon: 'T',  color: '#555555' },
  { key: 'linkedin',         label: 'LinkedIn Ads',       icon: 'in', color: '#0A66C2' },
  { key: 'adform',           label: 'Adform',             icon: 'AF', color: '#E84B37' },
  { key: 'appsflyer',        label: 'AppsFlyer',          icon: 'AF', color: '#00B2FF' },
  { key: 'adjust',           label: 'Adjust',             icon: 'AJ', color: '#888888' },
  { key: 'google_analytics', label: 'Google Analytics',   icon: 'GA', color: '#E37400' },
];

const BENCHMARKS = {
  'E-ticaret':         { google_roas: 3.5, meta_roas: 3.0, ctr: 2.5 },
  'Perakende':         { google_roas: 3.0, meta_roas: 2.5, ctr: 2.0 },
  'Finans & Sigorta':  { google_roas: 2.0, meta_roas: 1.8, ctr: 1.5 },
  'Otomotiv':          { google_roas: 2.5, meta_roas: 2.0, ctr: 1.8 },
  'Gıda & İçecek':    { google_roas: 3.0, meta_roas: 3.5, ctr: 3.0 },
  'Turizm & Seyahat':  { google_roas: 4.0, meta_roas: 3.0, ctr: 2.2 },
  'Teknoloji & SaaS':  { google_roas: 3.0, meta_roas: 2.5, ctr: 2.8 },
  'Sağlık & Güzellik': { google_roas: 2.5, meta_roas: 2.8, ctr: 2.0 },
  'Eğitim':            { google_roas: 2.0, meta_roas: 2.5, ctr: 2.5 },
  'Gayrimenkul':       { google_roas: 2.0, meta_roas: 1.5, ctr: 1.2 },
  'Medya & Eğlence':   { google_roas: 2.5, meta_roas: 3.0, ctr: 3.5 },
  'Diğer':             { google_roas: 2.5, meta_roas: 2.5, ctr: 2.0 },
};

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
const fmtN   = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTL  = (n) => `₺${fmtN(n)}`;
const fmtPct = (n) => `%${Number(n || 0).toFixed(2)}`;

function getBenchmark(sector, platform) {
  const bm = BENCHMARKS[sector] || BENCHMARKS['Diğer'];
  const roas = platform === 'google_ads' ? bm.google_roas
    : platform === 'meta' ? bm.meta_roas
    : (bm.google_roas + bm.meta_roas) / 2;
  return { roas, ctr: bm.ctr };
}
function calcCtr(i) {
  const imp = parseInt(i.total_impressions) || 0;
  return imp > 0 ? (parseInt(i.total_clicks) / imp * 100) : 0;
}
function calcCpa(i) {
  const conv = parseInt(i.total_conversions) || 0;
  return conv > 0 ? (parseFloat(i.total_spend) / conv) : null;
}
function calcEfficiency(i, bm) {
  const roas = parseFloat(i.avg_roas) || 0;
  const ctr  = calcCtr(i);
  const bmR  = bm?.roas || 2.5;
  const bmC  = bm?.ctr  || 2.0;
  return Math.min(100, Math.max(0, Math.round(
    Math.min((roas / bmR) * 60, 120) + Math.min((ctr / bmC) * 40, 80)
  )));
}
function pctChange(cur, prev) {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}
function buildChartData(dailyMetrics, anomalyDates) {
  const byDate = {};
  dailyMetrics.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = { date: m.date, isAnomaly: anomalyDates.includes(m.date) };
    byDate[m.date][`${m.platform}_spend`] = parseFloat(m.spend) || 0;
    byDate[m.date][`${m.platform}_roas`]  = parseFloat(m.roas)  || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}
function exportCsv(integrations, sector) {
  const hdrs = ['Platform', 'Harcama', 'ROAS', 'CTR (%)', 'CPA (₺)', 'Dönüşüm', 'Verimlilik'];
  const rows = integrations.map(i => {
    const bm = getBenchmark(sector, i.platform);
    return [PLATFORM_LABELS[i.platform]||i.platform, i.total_spend.toFixed(2), i.avg_roas.toFixed(2),
      calcCtr(i).toFixed(2), calcCpa(i)?.toFixed(2)||'-', i.total_conversions, calcEfficiency(i,bm)];
  });
  const csv = [hdrs,...rows].map(r=>r.join(';')).join('\n');
  const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`kanal-analizi-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── UI Bileşenleri ────────────────────────────────────────────────────────────
function SkeletonBar({ height = 12, width = '100%', style = {} }) {
  return <div style={{ height, width, borderRadius: 6, background: 'var(--bg2)', animation: 'shimmer 1.5s ease-in-out infinite', ...style }} />;
}
function SkeletonSection({ rows = 3 }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SkeletonBar height={16} width="40%" />
        {Array.from({ length: rows }).map((_, i) => <SkeletonBar key={i} height={12} width={`${85 - i * 10}%`} />)}
      </div>
    </div>
  );
}

function InlineEmptyState({ connectedPlatforms, onConnect, platformList = SPEND_PLATFORMS_LIST }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Bu bölüm için reklam verisi gerekli</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {platformList.map(p => {
          const connected = connectedPlatforms.includes(p.key);
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8, border: connected ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border2)' }}>
              <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: p.color + '20', color: p.color, borderRadius: 5, fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                {p.icon}
              </span>
              <span style={{ flex: 1, fontSize: 12 }}>{p.label}</span>
              {connected
                ? <span style={{ color: '#10B981', fontSize: 11, fontWeight: 700 }}>✓</span>
                : <button onClick={onConnect} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid var(--teal)', borderRadius: 5, color: 'var(--teal)', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Bağla →</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tablo hücresinde inline hedef badge'i: "3.2x / H:4.0 🔴"
function KpiBadge({ actual, target, unit = '', lowerIsBetter = false }) {
  if (target == null || actual == null) return null;
  const ok = lowerIsBetter ? actual <= target : actual >= target;
  return (
    <span style={{ fontSize: 10, marginLeft: 5, color: ok ? '#10B981' : '#EF4444', fontWeight: 600, whiteSpace: 'nowrap' }}>
      H:{Number(target).toFixed(unit === '₺' ? 0 : 1)}{unit} {ok ? '✅' : '🔴'}
    </span>
  );
}

// KPI özet tablosu hücresi: "3.2x ← 4.0x · %80"
function KpiCell({ actual, target, fmt, lowerIsBetter = false }) {
  if (target == null) return <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>;
  if (actual == null || actual === 0) return (
    <span style={{ color: 'var(--text3)', fontSize: 12 }}>— / H:{fmt ? fmt(target) : target}</span>
  );
  const pct = Math.round(lowerIsBetter ? (target / actual) * 100 : (actual / target) * 100);
  const color = pct >= 100 ? '#10B981' : pct >= 80 ? '#F59E0B' : '#EF4444';
  return (
    <span style={{ fontSize: 12 }}>
      <span style={{ color }}>{fmt ? fmt(actual) : actual}</span>
      <span style={{ color: 'var(--text3)', marginLeft: 4 }}>/ H:{fmt ? fmt(target) : target}</span>
      <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 700, color }}>{pct >= 100 ? '✅' : '🔴'} %{pct}</span>
    </span>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function ChangeArrow({ pct }) {
  if (pct === null) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
  const up = pct > 0;
  return <span style={{ color: up ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 700 }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%</span>;
}

function BenchmarkTag({ label, actual, benchmark, unit = 'x' }) {
  if (!benchmark || !actual) return null;
  const isGood = actual >= benchmark;
  return (
    <span style={{ fontSize: 11, color: isGood ? '#10B981' : '#F59E0B', fontWeight: 600 }}>
      {label}: {Number(actual).toFixed(2)}{unit} — Sektör: {benchmark}{unit} {isGood ? '✓ İyi' : '⚠ Düşük'}
    </span>
  );
}

function CustomDot({ cx, cy, payload }) {
  if (!payload?.isAnomaly) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#fff" strokeWidth={1.5} />;
}

// Kanal sinerjisi infografiği (< 2 platform bağlıyken)
function SynergyInfo({ connectedPlatforms, onConnect }) {
  const upperFunnelPlatforms = ['tiktok', 'linkedin', 'adform', 'meta'];
  const lowerFunnelPlatforms = ['google_ads'];
  const hasUpper = connectedPlatforms.some(p => upperFunnelPlatforms.includes(p));
  const hasLower = connectedPlatforms.some(p => lowerFunnelPlatforms.includes(p));
  const adCount  = connectedPlatforms.filter(p => SPEND_PLATFORMS.includes(p)).length;

  return (
    <div>
      <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        {adCount === 0
          ? 'Kanal sinerjisi analizi için en az 2 platform bağlayın.'
          : 'Kanal sinerjisi analizi için en az 1 platform daha bağlayın.'}
        {' '}Örneğin <strong style={{ color: '#1877F2' }}>Meta Ads</strong> (farkındalık) + <strong style={{ color: '#4285F4' }}>Google Ads</strong> (dönüşüm).
      </div>

      {/* Infografik */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {/* Üst huni */}
        <div style={sg.funnelBox}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Farkındalık</div>
          {[
            { key: 'meta',    label: 'Meta Ads',    color: '#1877F2' },
            { key: 'tiktok',  label: 'TikTok Ads',  color: '#555555' },
            { key: 'linkedin',label: 'LinkedIn Ads', color: '#0A66C2' },
            { key: 'adform',  label: 'Adform',       color: '#E84B37' },
          ].map(p => {
            const conn = connectedPlatforms.includes(p.key);
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: conn ? p.color : 'var(--border2)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: conn ? 'var(--text1)' : 'var(--text3)' }}>{p.label}</span>
                {conn && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓</span>}
              </div>
            );
          })}
        </div>

        {/* Ok */}
        <div style={sg.arrow}>
          <div style={sg.arrowLine} />
          <div style={sg.arrowLabel}>Yönlendirme</div>
          <div style={sg.arrowHead}>›</div>
        </div>

        {/* Değerlendirme */}
        <div style={{ ...sg.funnelBox, background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Değerlendirme</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Yeniden pazarlama,<br/>lookalike kitleler</div>
        </div>

        {/* Ok */}
        <div style={sg.arrow}>
          <div style={sg.arrowLine} />
          <div style={sg.arrowLabel}>Dönüştürme</div>
          <div style={sg.arrowHead}>›</div>
        </div>

        {/* Alt huni */}
        <div style={sg.funnelBox}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Dönüşüm</div>
          {[
            { key: 'google_ads', label: 'Google Ads', color: '#4285F4' },
            { key: 'appsflyer',  label: 'AppsFlyer',  color: '#00B2FF' },
            { key: 'adjust',     label: 'Adjust',      color: '#888888' },
          ].map(p => {
            const conn = connectedPlatforms.includes(p.key);
            return (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: conn ? p.color : 'var(--border2)', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: conn ? 'var(--text1)' : 'var(--text3)' }}>{p.label}</span>
                {conn && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={onConnect} style={{ marginTop: 16, padding: '7px 18px', background: 'transparent', border: '1px solid var(--teal)', borderRadius: 8, color: 'var(--teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Platform Bağla →
      </button>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Channels({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency  = user?.company_type === 'agency';
  const needsBrand = isAgency && !selectedBrand;

  const [days, setDays]         = useState(30);
  const [platFilter, setPlatFilter] = useState('all');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);

  const [aiText, setAiText]         = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState('');
  const aiRef = useRef(null);

  const [kpiPanelOpen, setKpiPanelOpen] = useState(false);
  const [kpiText, setKpiText]           = useState('');
  const [kpiLoading, setKpiLoading]     = useState(false);
  const [kpiError, setKpiError]         = useState('');
  const kpiRef = useRef(null);

  const [aiUsage, setAiUsage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);

  const [aiStatus, setAiStatus]   = useState('idle');   // 'idle' | 'queued' | 'processing'
  const [kpiStatus, setKpiStatus] = useState('idle');
  const [queueInfo, setQueueInfo] = useState({ size: 0, pending: 0 });

  const brandName   = selectedBrand?.company_name || selectedBrand?.name;
  const brandId     = isAgency ? selectedBrand?.id : undefined;
  const kpiBrandId  = isAgency ? selectedBrand?.id : user?.company_id;

  const load = useCallback(() => {
    if (needsBrand) { setLoading(false); return; }
    setLoading(true);
    getChannelData(days, platFilter, brandId)
      .then(setData)
      .catch(() => setData({ sector: null, integrations: [], prevIntegrations: [], dailyMetrics: [], anomalyDates: [] }))
      .finally(() => setLoading(false));
  }, [days, platFilter, brandId, needsBrand]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAiUsageToday().then(setAiUsage).catch(() => {});
  }, []);

  // Poll queue status while an AI request is in flight
  useEffect(() => {
    if (!aiLoading && !kpiLoading) return;
    const id = setInterval(() => {
      getAiQueueStatus().then(setQueueInfo).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [aiLoading, kpiLoading]);

  if (needsBrand) return (
    <div className="fade-in">
      <div className="topbar"><div className="topbar-title">Kanal Analizi</div></div>
      <div className="content">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Önce bir marka seçin</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Sol menüden <strong>Markalar</strong>'a giderek bir marka seçin.</div>
        </div>
      </div>
    </div>
  );

  const title = isAgency && brandName ? `${brandName} — Kanal Analizi` : 'Kanal Analizi';

  // ── Türetilmiş veri ───────────────────────────────────────────────────────
  const allIntegrations = data?.integrations || [];
  const gaIntegration   = allIntegrations.find(i => i.platform === 'google_analytics');
  // Sadece reklam harcaması olan platformlar (attribution araçları hariç)
  const adIntegrations  = allIntegrations.filter(i => SPEND_PLATFORMS.includes(i.platform));
  // Attribution + AI bölümleri için tüm entegrasyonlar
  const allAdIntegrations = allIntegrations.filter(i => ALL_PLATFORMS.includes(i.platform));
  const connectedKeys   = allIntegrations.map(i => i.platform);
  const hasAnyData      = allAdIntegrations.length > 0;
  const hasAdData       = adIntegrations.some(i => parseFloat(i.total_spend) > 0 || parseInt(i.total_impressions) > 0);
  const sector          = data?.sector || 'Diğer';

  // GA4 metrikleri (impressions=sessions, clicks=users, conversions=conversions)
  const gaData = gaIntegration ? {
    sessions:    parseInt(gaIntegration.total_impressions) || 0,
    users:       parseInt(gaIntegration.total_clicks)      || 0,
    conversions: parseInt(gaIntegration.total_conversions) || 0,
    convRate:    parseInt(gaIntegration.total_impressions) > 0
      ? (parseInt(gaIntegration.total_conversions) / parseInt(gaIntegration.total_impressions) * 100) : 0,
  } : null;

  // Reklam harcaması toplamları
  const totalSpend  = adIntegrations.reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const totalConv   = adIntegrations.reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const totalClicks = adIntegrations.reduce((s, i) => s + parseInt(i.total_clicks || 0), 0);
  const totalImp    = adIntegrations.reduce((s, i) => s + parseInt(i.total_impressions || 0), 0);
  const roasVals    = adIntegrations.filter(i => parseFloat(i.avg_roas) > 0);
  const avgRoas     = roasVals.length ? roasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasVals.length : 0;
  const avgCtr      = totalImp > 0 ? (totalClicks / totalImp * 100) : 0;
  const avgCpa      = totalConv > 0 ? totalSpend / totalConv : null;

  // Önceki dönem
  const prev       = data?.prevIntegrations || [];
  const prevSpend  = prev.filter(i => SPEND_PLATFORMS.includes(i.platform)).reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const prevConv   = prev.filter(i => SPEND_PLATFORMS.includes(i.platform)).reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const prevRoasV  = prev.filter(i => SPEND_PLATFORMS.includes(i.platform) && parseFloat(i.avg_roas) > 0);
  const prevRoas   = prevRoasV.length ? prevRoasV.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / prevRoasV.length : 0;

  const sectorBm  = BENCHMARKS[sector] || BENCHMARKS['Diğer'];
  const bmRoasAvg = (sectorBm.google_roas + sectorBm.meta_roas) / 2;

  // Verimlilik skorları (tüm AD platformları — harcama yoksa da dahil)
  const scored = adIntegrations.map(i => ({
    ...i,
    ctr: calcCtr(i), cpa: calcCpa(i),
    bm: getBenchmark(sector, i.platform),
    efficiency: calcEfficiency(i, getBenchmark(sector, i.platform)),
  }));
  const bestChannel  = scored.length ? scored.reduce((a, b) => a.efficiency > b.efficiency ? a : b) : null;
  const worstChannel = scored.length > 1 ? scored.reduce((a, b) => a.efficiency < b.efficiency ? a : b) : null;

  // KPI hedefleri (bu ay bütçe planından)
  const kpiTargets    = data?.kpi_targets || {};
  const hasKpiTargets = Object.keys(kpiTargets).length > 0;

  // Grafik verisi
  const activePlatforms = [...new Set((data?.dailyMetrics || []).map(m => m.platform))];
  const chartData       = buildChartData(data?.dailyMetrics || [], data?.anomalyDates || []);

  // Pie: sadece spend > 0 olan reklam platformları
  const pieData = adIntegrations
    .filter(i => parseFloat(i.total_spend) > 0)
    .map(i => ({ name: PLATFORM_LABELS[i.platform]||i.platform, value: parseFloat(i.total_spend), color: PLATFORM_COLORS[i.platform]||'#888', platform: i.platform }));

  // Optimizasyon önerisi
  const optimSuggestion = (() => {
    if (!bestChannel) return null;
    if (bestChannel.efficiency >= 80) {
      const pct = totalSpend > 0 ? Math.round(parseFloat(bestChannel.total_spend) / totalSpend * 100) : 0;
      return `${PLATFORM_LABELS[bestChannel.platform]} en verimli kanalınız (${bestChannel.efficiency}/100). Bütçenin %${pct}'ini bu kanala yönlendiriyorsunuz — oranı artırmayı değerlendirin.`;
    }
    if (worstChannel) {
      const bm = getBenchmark(sector, worstChannel.platform);
      return `${PLATFORM_LABELS[worstChannel.platform]} ROAS'ı (${Number(worstChannel.avg_roas).toFixed(1)}x) sektör ortalamasının (${bm.roas}x) altında. Hedefleme ve kreatif optimizasyonu önerilir.`;
    }
    return null;
  })();

  // Kanal sinerjisi — 2+ reklam platformu mu?
  const adPlatformCount = connectedKeys.filter(p => SPEND_PLATFORMS.includes(p)).length;

  // ── AI Analiz ─────────────────────────────────────────────────────────────
  const runAi = async () => {
    const aiMetrics = allAdIntegrations
      .filter(i => parseFloat(i.total_spend) > 0 || parseInt(i.total_clicks) > 0 || parseInt(i.total_conversions) > 0)
      .map(i => ({
        platform: PLATFORM_LABELS[i.platform] || i.platform,
        spend: i.total_spend, roas: Number(i.avg_roas).toFixed(2),
        cpa: calcCpa(i)?.toFixed(0) || null, ctr: calcCtr(i).toFixed(2),
        conversions: i.total_conversions, days,
      }));

    if (!aiMetrics.length) {
      setAiError('Analiz için yeterli veri yok. Entegrasyon bağlandıktan sonra tekrar deneyin.');
      return;
    }

    const benchmarks = adIntegrations.map(i => {
      const bm = getBenchmark(sector, i.platform);
      return { platform: PLATFORM_LABELS[i.platform]||i.platform, roas: bm.roas, ctr: bm.ctr };
    });

    setAiStatus('queued');
    setAiLoading(true); setAiText(''); setAiError('');
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/channels/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ metrics: aiMetrics, sector, benchmarks, days }),
      });
      if (res.status === 429) {
        const e = await res.json().catch(() => ({}));
        setLimitReached(true);
        setAiError(e.error || 'Günlük AI kullanım limitinize ulaştınız.');
        return;
      }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'AI analiz başarısız.'); }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            setAiLoading(false); setAiStatus('idle');
            getAiUsageToday().then(setAiUsage).catch(() => {});
            return;
          }
          try {
            const { text, error, queueStatus, size } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (queueStatus === 'queued') { setAiStatus('queued'); setQueueInfo(q => ({ ...q, size: size ?? q.size })); }
            if (queueStatus === 'processing') setAiStatus('processing');
            if (text) setAiText(p => p + text);
          } catch {}
        }
      }
    } catch (err) {
      setAiError(err.message || 'AI analiz başarısız.');
    } finally { setAiLoading(false); setAiStatus('idle'); }
  };

  const runKpiAnalysis = async () => {
    setKpiPanelOpen(true);
    setKpiStatus('queued');
    setKpiText(''); setKpiError(''); setKpiLoading(true);
    setTimeout(() => kpiRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/budgets/kpi-analysis/${kpiBrandId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.status === 429) {
        const e = await res.json().catch(() => ({}));
        setLimitReached(true);
        setKpiError(e.error || 'Günlük AI kullanım limitinize ulaştınız.');
        return;
      }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'KPI analiz başarısız.'); }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            setKpiLoading(false); setKpiStatus('idle');
            getAiUsageToday().then(setAiUsage).catch(() => {});
            return;
          }
          try {
            const { text, error, queueStatus, size } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (queueStatus === 'queued') { setKpiStatus('queued'); setQueueInfo(q => ({ ...q, size: size ?? q.size })); }
            if (queueStatus === 'processing') setKpiStatus('processing');
            if (text) setKpiText(p => p + text);
          } catch {}
        }
      }
    } catch (err) {
      setKpiError(err.message || 'KPI analiz başarısız.');
    } finally { setKpiLoading(false); setKpiStatus('idle'); }
  };

  const saveAiReport = () => {
    const blob = new Blob([aiText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ai-kanal-analizi-${new Date().toISOString().split('T')[0]}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const goToIntegrations = () => onNav?.('integrations');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={s.filterGroup}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{ ...s.filterBtn, background: days === d ? 'var(--teal)' : 'transparent', color: days === d ? '#0B1219' : 'var(--text2)' }}>
                {d} gün
              </button>
            ))}
          </div>
          <select value={platFilter} onChange={e => setPlatFilter(e.target.value)} style={s.select}>
            <option value="all">Tüm Kanallar</option>
            {SPEND_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
          {hasAdData && <button onClick={() => exportCsv(adIntegrations, sector)} style={s.exportBtn}>↓ CSV</button>}
          {kpiBrandId && (
            <button onClick={runKpiAnalysis} disabled={kpiLoading} style={{ ...s.exportBtn, background: kpiPanelOpen ? 'rgba(139,92,246,0.15)' : 'transparent', borderColor: '#8b5cf6', color: '#a78bfa' }}>
              🎯 KPI Analizi
            </button>
          )}
          {aiUsage && (
            <span style={{ fontSize: 11, color: aiUsage.total >= aiUsage.limit ? 'var(--coral)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
              Bugün: {aiUsage.total}/{aiUsage.limit} AI
            </span>
          )}
        </div>
      </div>

      <div className="content">

        {limitReached && (
          <div style={{ marginBottom: 16, background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--coral)' }}>⚠ Günlük AI kullanım limitinize ulaştınız. Planınızı yükseltmek için tıklayın →</span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => onNav?.('pricing')} style={{ padding: '5px 14px', background: 'var(--coral)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Planı Yükselt</button>
              <button onClick={() => setLimitReached(false)} style={{ padding: '5px 8px', background: 'transparent', border: '1px solid rgba(255,107,90,0.4)', borderRadius: 6, color: 'var(--coral)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}

        {/* ── BÖLÜM 1: Genel Performans ──────────────────────────────────── */}
        {loading ? (
          <div className="metrics" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
            {Array.from({length:5}).map((_,i) => <div key={i} className="metric-card"><SkeletonBar height={40} /></div>)}
          </div>
        ) : (
          <>
            {/* Reklam kanalları özeti */}
            {hasAdData ? (
              <>
                <div className="metrics" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 16 }}>
                  {[
                    { label: 'Toplam Harcama',  value: fmtTL(totalSpend),              change: pctChange(totalSpend, prevSpend) },
                    { label: 'Ort. ROAS',        value: `${avgRoas.toFixed(2)}x`,       change: pctChange(avgRoas, prevRoas) },
                    { label: 'Toplam Dönüşüm',  value: fmtN(totalConv),                change: pctChange(totalConv, prevConv) },
                    { label: 'Ort. CPA',         value: avgCpa ? fmtTL(avgCpa) : '—',  change: null },
                    { label: 'Ort. CTR',         value: fmtPct(avgCtr),                change: null },
                  ].map(m => (
                    <div key={m.label} className="metric-card">
                      <div className="metric-label">{m.label}</div>
                      <div className="metric-value" style={{ fontSize: 20 }}>{m.value}</div>
                      <div className="metric-sub"><ChangeArrow pct={m.change} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 18px', display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
                  <BenchmarkTag label="ROAS" actual={avgRoas} benchmark={bmRoasAvg} unit="x" />
                  <BenchmarkTag label="CTR"  actual={avgCtr}  benchmark={sectorBm.ctr} unit="%" />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sektör: {sector}</span>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>Reklam Harcaması Özeti</div>
                <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
              </div>
            )}

            {/* GA4 verileri (bağlıysa her zaman göster) */}
            {gaData && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E37400', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 20, height: 20, background: '#E3740020', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#E37400' }}>GA</span>
                  Google Analytics — Web Verileri
                </div>
                <div className="metrics">
                  {[
                    { label: 'Toplam Oturum',    value: fmtN(gaData.sessions) },
                    { label: 'Toplam Kullanıcı', value: fmtN(gaData.users) },
                    { label: 'Dönüşüm',          value: fmtN(gaData.conversions) },
                    { label: 'Dönüşüm Oranı',    value: fmtPct(gaData.convRate) },
                  ].map(m => (
                    <div key={m.label} className="metric-card" style={{ borderColor: 'rgba(227,116,0,0.2)', background: 'rgba(227,116,0,0.03)' }}>
                      <div className="metric-label">{m.label}</div>
                      <div className="metric-value" style={{ fontSize: 20, color: '#E37400' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── BÖLÜM 2: Kanal Karşılaştırma Tablosu ──────────────────────── */}
        <SectionCard title="Kanal Karşılaştırma" subtitle={`Son ${days} gün — tüm reklam platformları`}>
          {loading ? <SkeletonBar height={80} /> : !scored.length ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <table className="cmp-table">
              <thead>
                <tr><th>Platform</th><th>Harcama</th><th>ROAS</th><th>CPA</th><th>CTR</th><th>Dönüşüm</th><th>Verimlilik</th></tr>
              </thead>
              <tbody>
                {scored.sort((a,b) => b.efficiency - a.efficiency).map(i => {
                  const isBest   = i.id === bestChannel?.id;
                  const isWorst  = scored.length > 1 && i.id === worstChannel?.id;
                  const effColor = i.efficiency >= 70 ? '#10B981' : i.efficiency >= 45 ? '#F59E0B' : '#EF4444';
                  const kpi      = kpiTargets[i.platform];
                  return (
                    <tr key={i.id} style={{ background: isBest ? 'rgba(16,185,129,0.04)' : isWorst ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                      <td>
                        <span style={{ color: PLATFORM_COLORS[i.platform], fontWeight: 700 }}>{PLATFORM_LABELS[i.platform]||i.platform}</span>
                        {isBest  && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(16,185,129,0.15)',  color: '#10B981', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>EN VERİMLİ</span>}
                        {isWorst && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>GELİŞTİR</span>}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{fmtTL(i.total_spend)}</td>
                      <td>
                        <span style={{ color: parseFloat(i.avg_roas) >= i.bm.roas ? '#10B981' : '#F59E0B', fontWeight: 600 }}>{Number(i.avg_roas).toFixed(2)}x</span>
                        {kpi?.kpi_roas != null && <KpiBadge actual={parseFloat(i.avg_roas)} target={kpi.kpi_roas} unit="x" />}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)' }}>
                        {i.cpa ? fmtTL(i.cpa) : '—'}
                        {kpi?.kpi_cpa != null && i.cpa && <KpiBadge actual={i.cpa} target={kpi.kpi_cpa} unit="₺" lowerIsBetter />}
                      </td>
                      <td>
                        {fmtPct(i.ctr)}
                        {kpi?.kpi_ctr != null && <KpiBadge actual={i.ctr} target={kpi.kpi_ctr} unit="%" />}
                      </td>
                      <td>{fmtN(i.total_conversions)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${i.efficiency}%`, height: '100%', background: effColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
                          </div>
                          <span style={{ color: effColor, fontWeight: 700, fontSize: 13, minWidth: 36 }}>{i.efficiency}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* ── BÖLÜM 3: Trend Grafikleri ───────────────────────────────────── */}
        <SectionCard title="Harcama Trendi" subtitle={`Son ${days} gün · kırmızı nokta: anomali`}>
          {loading ? <SkeletonBar height={200} /> : chartData.length === 0 ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => `₺${fmtN(v)}`} />
                <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [fmtTL(v), PLATFORM_LABELS[name.replace('_spend','')] || name]}
                  labelFormatter={l => l} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => PLATFORM_LABELS[v.replace('_spend','')] || v} />
                {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p)).map(p => (
                  <Line key={p} type="monotone" dataKey={`${p}_spend`} stroke={PLATFORM_COLORS[p]||'#888'} strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="ROAS Trendi" subtitle={`Son ${days} gün`}>
          {loading ? <SkeletonBar height={180} /> : chartData.length === 0 ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => `${v.toFixed(1)}x`} />
                <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${Number(v).toFixed(2)}x`, PLATFORM_LABELS[name.replace('_roas','')] || name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => PLATFORM_LABELS[v.replace('_roas','')] || v} />
                {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p)).map(p => (
                  <Line key={p} type="monotone" dataKey={`${p}_roas`} stroke={PLATFORM_COLORS[p]||'#888'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                ))}
                {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p) && kpiTargets[p]?.kpi_roas != null).map(p => (
                  <ReferenceLine key={`kpi-roas-${p}`} y={kpiTargets[p].kpi_roas}
                    stroke={PLATFORM_COLORS[p]||'#888'} strokeDasharray="6 3" strokeOpacity={0.5} strokeWidth={1.5}
                    label={{ value: `↑ H:${kpiTargets[p].kpi_roas}x`, position: 'insideTopRight', fontSize: 9, fill: PLATFORM_COLORS[p]||'#888' }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── BÖLÜM 4: Bütçe Verimliliği ─────────────────────────────────── */}
        <SectionCard title="Bütçe Verimliliği" subtitle="Kanal bazında harcama dağılımı">
          {loading ? <SkeletonBar height={180} /> : pieData.length === 0 ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (<>
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={86} dataKey="value" nameKey="name" paddingAngle={2}>
                    {pieData.map((e,i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={v => fmtTL(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {pieData.map(d => {
                    const pct = totalSpend > 0 ? Math.round(d.value / totalSpend * 100) : 0;
                    return (
                      <div key={d.platform} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, flex: 1 }}>{d.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{fmtTL(d.value)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 32 }}>%{pct}</span>
                      </div>
                    );
                  })}
                  {/* GA4 dönüşüm verisi */}
                  {gaData && gaData.conversions > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: '#E37400', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, color: 'var(--text3)' }}>GA4 Dönüşüm</span>
                      <span style={{ fontSize: 12, color: '#E37400', fontWeight: 600 }}>{fmtN(gaData.conversions)} dön.</span>
                    </div>
                  )}
                </div>
                {bestChannel && optimSuggestion && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#10B981', marginBottom: 4 }}>En verimli: {PLATFORM_LABELS[bestChannel.platform]} ({bestChannel.efficiency}/100)</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>{optimSuggestion}</div>
                  </div>
                )}
              </div>
            </div>

            {/* KPI hedef karşılaştırma tablosu */}
            {hasKpiTargets && scored.some(i => kpiTargets[i.platform]) && (
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border2)', paddingTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Bu Ay KPI Hedef Karşılaştırması
                </div>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>ROAS</th>
                      <th>CPA</th>
                      <th>CTR</th>
                      <th>İmpresyon</th>
                      <th>Dönüşüm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scored.filter(i => kpiTargets[i.platform]).map(i => {
                      const kpi = kpiTargets[i.platform];
                      return (
                        <tr key={i.id}>
                          <td style={{ color: PLATFORM_COLORS[i.platform], fontWeight: 700 }}>{PLATFORM_LABELS[i.platform]}</td>
                          <td><KpiCell actual={parseFloat(i.avg_roas)} target={kpi.kpi_roas} fmt={v => `${v.toFixed(2)}x`} /></td>
                          <td><KpiCell actual={i.cpa} target={kpi.kpi_cpa} fmt={v => fmtTL(v)} lowerIsBetter /></td>
                          <td><KpiCell actual={i.ctr} target={kpi.kpi_ctr} fmt={v => fmtPct(v)} /></td>
                          <td><KpiCell actual={parseInt(i.total_impressions)} target={kpi.kpi_impression} fmt={v => fmtN(v)} /></td>
                          <td><KpiCell actual={parseInt(i.total_conversions)} target={kpi.kpi_conversion} fmt={v => fmtN(v)} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>)}
        </SectionCard>

        {/* ── BÖLÜM 5: AI Kanal Analizi ──────────────────────────────────── */}
        <div ref={aiRef}>
          <SectionCard title="AI Kanal Analizi" subtitle="Claude ile derinlemesine analiz">
            {loading ? <SkeletonBar height={60} /> : !hasAnyData ? (
              <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} platformList={ALL_PLATFORMS_LIST} />
            ) : (
              <>
                {!aiText && !aiLoading && !aiError && (
                  <div style={{ textAlign: 'center', padding: '20px 16px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Son {days} günün performansı sektör benchmarklarıyla karşılaştırılarak analiz edilecek.</div>
                    <button onClick={runAi} style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ✦ AI Analiz Et
                    </button>
                  </div>
                )}
                {aiLoading && !aiText && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                    {aiStatus === 'queued' ? (
                      <>
                        <span style={{ marginRight: 8 }}>⏳</span>
                        Sırada bekleniyor...
                        {queueInfo.size > 0 && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({queueInfo.size} istek önünüzde)</span>}
                      </>
                    ) : (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>↻</span>
                        🔄 Analiz yapılıyor...
                      </>
                    )}
                  </div>
                )}
                {aiError && (
                  <div style={{ background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>
                    ⚠ {aiError}
                    <button onClick={() => setAiError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                )}
                {(aiText || aiLoading) && (
                  <div>
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 18px', fontSize: 13, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap', minHeight: 80 }}>
                      {aiText}
                      {aiLoading && <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--teal)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />}
                    </div>
                    {!aiLoading && aiText && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button onClick={saveAiReport} style={{ padding: '7px 16px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>↓ Raporu Kaydet</button>
                        <button onClick={() => { setAiText(''); setAiError(''); }} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>Yeni Analiz</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>

        {/* ── BÖLÜM 5b: KPI Analizi ──────────────────────────────────────── */}
        {kpiPanelOpen && (
          <div ref={kpiRef}>
            <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">🎯 KPI Analizi</div>
                  <div className="card-subtitle">Bütçe hedefleri ile gerçek performans karşılaştırması</div>
                </div>
                <button onClick={() => setKpiPanelOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div className="card-body">
                {kpiLoading && !kpiText && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                    {kpiStatus === 'queued' ? (
                      <>
                        <span style={{ marginRight: 8 }}>⏳</span>
                        Sırada bekleniyor...
                        {queueInfo.size > 0 && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({queueInfo.size} istek önünüzde)</span>}
                      </>
                    ) : (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>↻</span>
                        🔄 KPI analizi yapılıyor...
                      </>
                    )}
                  </div>
                )}
                {kpiError && (
                  <div style={{ background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--coral)', fontSize: 13, marginBottom: 12 }}>
                    ⚠ {kpiError}
                    <button onClick={() => setKpiError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                )}
                {(kpiText || kpiLoading) && (
                  <div>
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 18px', fontSize: 13, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap', minHeight: 80 }}>
                      {kpiText}
                      {kpiLoading && <span style={{ display: 'inline-block', width: 2, height: 14, background: '#a78bfa', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />}
                    </div>
                    {!kpiLoading && kpiText && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        <button
                          onClick={() => { const blob = new Blob([kpiText],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`kpi-analizi-${new Date().toISOString().split('T')[0]}.txt`; a.click(); URL.revokeObjectURL(url); }}
                          style={{ padding: '7px 16px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                          ↓ Raporu Kaydet
                        </button>
                        <button onClick={runKpiAnalysis} style={{ padding: '7px 16px', background: 'transparent', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, color: '#a78bfa', fontSize: 12, cursor: 'pointer' }}>
                          Yenile
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BÖLÜM 6: Kanal Sinerjisi ────────────────────────────────────── */}
        <SectionCard title="Kanal Sinerjisi" subtitle="Attribution özeti">
          {loading ? <SkeletonBar height={120} /> : adPlatformCount < 2 ? (
            <SynergyInfo connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (() => {
            const upper = scored.filter(i => ['tiktok','adform','linkedin','meta'].includes(i.platform));
            const lower = scored.filter(i => ['google_ads','appsflyer','adjust'].includes(i.platform));
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={s.synergyBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Üst Huni — Farkındalık</div>
                  {upper.length ? upper.map(i => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[i.platform] }} />
                      <span style={{ fontSize: 13 }}>{PLATFORM_LABELS[i.platform]}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{fmtN(i.total_impressions)} imp.</span>
                    </div>
                  )) : <div style={{ fontSize: 12, color: 'var(--text3)' }}>Üst huni kanalı yok.</div>}
                </div>
                <div style={s.synergyBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Alt Huni — Dönüşüm</div>
                  {lower.length ? lower.map(i => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[i.platform] }} />
                      <span style={{ fontSize: 13 }}>{PLATFORM_LABELS[i.platform]}</span>
                      <span style={{ fontSize: 11, color: '#10B981', marginLeft: 'auto', fontWeight: 600 }}>{fmtN(i.total_conversions)} dön.</span>
                    </div>
                  )) : <div style={{ fontSize: 12, color: 'var(--text3)' }}>Alt huni kanalı yok.</div>}
                </div>
              </div>
            );
          })()}
        </SectionCard>

      </div>
    </div>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────
const s = {
  filterGroup: { display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden' },
  filterBtn:   { border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  select:      { padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' },
  exportBtn:   { padding: '6px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  synergyBox:  { background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px' },
};

const sg = {
  funnelBox: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px', minWidth: 160 },
  arrow:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px', gap: 4 },
  arrowLine: { width: 40, height: 2, background: 'var(--border2)' },
  arrowLabel:{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' },
  arrowHead: { fontSize: 20, color: 'var(--text3)', lineHeight: 1 },
};
