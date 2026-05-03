import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getChannelData, getAiUsageToday, getAiQueueStatus, getCampaigns, getCampaign } from '../api';
import { useSubscription } from '../context/SubscriptionContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import SubscriptionGateModal from '../components/SubscriptionGateModal';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
  BarChart, Bar, LabelList,
} from 'recharts';

// ── Sabitler ──────────────────────────────────────────────────────────────────
const PLATFORM_LABELS = {
  google_ads: 'Google Ads', google_analytics: 'Google Analytics',
  meta: 'Meta Ads', tiktok: 'TikTok Ads', linkedin: 'LinkedIn Ads',
  adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};
const PLATFORM_COLORS = {
  google_ads: '#4285F4', google_analytics: '#E37400',
  meta: '#1877F2', tiktok: '#FF0050', linkedin: '#0A66C2',
  adform: '#FF6B35', appsflyer: '#00B2FF', adjust: '#9CA3AF',
};
const PLATFORM_ICONS = {
  google_ads: 'G', google_analytics: 'GA', meta: 'M',
  tiktok: 'T', linkedin: 'in', adform: 'AF', appsflyer: 'AF', adjust: 'AJ',
};

const SPEND_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform'];
const ALL_PLATFORMS   = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform', 'appsflyer', 'adjust', 'google_analytics'];

const SPEND_PLATFORMS_LIST = [
  { key: 'google_ads', label: 'Google Ads',  icon: 'G',  color: '#4285F4' },
  { key: 'meta',       label: 'Meta Ads',     icon: 'M',  color: '#1877F2' },
  { key: 'tiktok',     label: 'TikTok Ads',   icon: 'T',  color: '#FF0050' },
  { key: 'linkedin',   label: 'LinkedIn Ads', icon: 'in', color: '#0A66C2' },
  { key: 'adform',     label: 'Adform',       icon: 'AF', color: '#FF6B35' },
];
const ALL_PLATFORMS_LIST = [
  { key: 'google_ads',       label: 'Google Ads',       icon: 'G',  color: '#4285F4' },
  { key: 'meta',             label: 'Meta Ads',          icon: 'M',  color: '#1877F2' },
  { key: 'tiktok',           label: 'TikTok Ads',        icon: 'T',  color: '#FF0050' },
  { key: 'linkedin',         label: 'LinkedIn Ads',      icon: 'in', color: '#0A66C2' },
  { key: 'adform',           label: 'Adform',            icon: 'AF', color: '#FF6B35' },
  { key: 'appsflyer',        label: 'AppsFlyer',         icon: 'AF', color: '#00B2FF' },
  { key: 'adjust',           label: 'Adjust',            icon: 'AJ', color: '#9CA3AF' },
  { key: 'google_analytics', label: 'Google Analytics',  icon: 'GA', color: '#E37400' },
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

const BAR_METRICS = [
  { key: 'spend',       label: 'Harcama',  yFmt: v => `₺${Number(v/1000).toFixed(0)}k` },
  { key: 'roas',        label: 'ROAS',     yFmt: v => `${v}x` },
  { key: 'cpa',         label: 'CPA',      yFmt: v => `₺${Math.round(v)}` },
  { key: 'ctr',         label: 'CTR',      yFmt: v => `%${v}` },
  { key: 'conversions', label: 'Dönüşüm',  yFmt: v => String(v) },
];

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
function getSparklineData(platform, dailyMetrics) {
  return [...dailyMetrics]
    .filter(m => m.platform === platform)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map(m => ({ v: parseFloat(m.spend) || 0 }));
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
function parseAiSections(text) {
  if (!text || text.length < 50) return null;
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^(\d+)\.\s+(.+)/);
    if (m) {
      if (current) sections.push(current);
      current = { num: parseInt(m[1]), title: m[2].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections.length >= 3 ? sections : null;
}
function trafficLight(actual, target, lowerIsBetter = false) {
  if (target == null || actual == null || actual === 0) return null;
  const pct = lowerIsBetter ? (target / actual) * 100 : (actual / target) * 100;
  if (pct >= 100) return { icon: '🟢', color: '#10B981', pct: Math.round(pct) };
  if (pct >= 80)  return { icon: '🟡', color: '#F59E0B', pct: Math.round(pct) };
  return { icon: '🔴', color: '#EF4444', pct: Math.round(pct) };
}

// ── UI Bileşenleri ────────────────────────────────────────────────────────────
function SkeletonBar({ height = 12, width = '100%', style = {} }) {
  return <div style={{ height, width, borderRadius: 6, background: 'var(--bg2)', animation: 'shimmer 1.5s ease-in-out infinite', ...style }} />;
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
              <span style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.color + '20', color: p.color, borderRadius: 5, fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{p.icon}</span>
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

function KpiMetricBadge({ label, actual, target, fmt, lowerIsBetter = false }) {
  if (!actual && actual !== 0) return null;
  const fmtted = fmt ? fmt(actual) : actual;
  if (target == null) {
    return (
      <span style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg)', borderRadius: 4, color: 'var(--text3)', border: '1px solid var(--border2)', whiteSpace: 'nowrap' }}>
        {label}: {fmtted}
      </span>
    );
  }
  const ok = lowerIsBetter ? actual <= target : actual >= target;
  const tFmt = fmt ? fmt(target) : target;
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 4, color: ok ? '#10B981' : '#EF4444', border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}: {fmtted} / H:{tFmt} {ok ? '✅' : '🔴'}
    </span>
  );
}

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

function SectionCard({ title, subtitle, children, action }) {
  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
        {action}
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

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 28 }} />;
  return (
    <div style={{ width: 60, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlatformSpendCard({ integration, prevIntegration, sparklineData, kpi, totalSpend }) {
  const p     = integration.platform;
  const color = PLATFORM_COLORS[p] || '#888';
  const label = PLATFORM_LABELS[p] || p;
  const spend = parseFloat(integration.total_spend) || 0;
  const roas  = parseFloat(integration.avg_roas) || 0;
  const ctr   = calcCtr(integration);
  const cpa   = calcCpa(integration);
  const change = pctChange(spend, parseFloat(prevIntegration?.total_spend) || 0);
  const share  = totalSpend > 0 ? Math.round(spend / totalSpend * 100) : 0;
  return (
    <div style={{ background: 'var(--bg2)', border: `1px solid ${color}25`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, background: color + '20', color, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
            {PLATFORM_ICONS[p] || p[0].toUpperCase()}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 10, color: '#10B981' }}>● Bağlı</div>
          </div>
        </div>
        <Sparkline data={sparklineData} color={color} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text1)', marginBottom: 3 }}>{fmtTL(spend)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChangeArrow pct={change} />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>önceki döneme göre</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Toplam harcamanın</span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>{share}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${share}%`, height: '100%', background: color, borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {roas > 0 && <KpiMetricBadge label="ROAS" actual={roas} target={kpi?.kpi_roas} fmt={v => `${v.toFixed(1)}x`} />}
        {cpa   && <KpiMetricBadge label="CPA"  actual={cpa}  target={kpi?.kpi_cpa}  fmt={v => `₺${Math.round(v)}`} lowerIsBetter />}
        {ctr > 0 && <KpiMetricBadge label="CTR"  actual={ctr}  target={kpi?.kpi_ctr}  fmt={v => `%${v.toFixed(1)}`} />}
      </div>
    </div>
  );
}

const AI_SECTION_CONFIGS = [
  { icon: '📊', color: '#0EA5E9', bg: 'rgba(14,165,233,0.07)',  border: 'rgba(14,165,233,0.2)' },
  { icon: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.2)' },
  { icon: '⚠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.2)'  },
  { icon: '🎯', color: '#8B5CF6', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.2)' },
  { icon: '💰', color: '#10B981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.15)' },
];

function AiParsedView({ text }) {
  const sections = useMemo(() => parseAiSections(text), [text]);
  if (!sections) {
    return (
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 18px', fontSize: 13, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sections.map((sec, i) => {
        const cfg = AI_SECTION_CONFIGS[i] || AI_SECTION_CONFIGS[0];
        const lines = sec.body.trim().split('\n').filter(l => l.trim());
        const isLast = i === sections.length - 1;
        return (
          <div key={i} style={{ background: isLast ? 'rgba(139,92,246,0.07)' : cfg.bg, border: `1px solid ${isLast ? 'rgba(139,92,246,0.25)' : cfg.border}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontWeight: 700, color: isLast ? '#a78bfa' : cfg.color, fontSize: 13, marginBottom: 8 }}>
              {cfg.icon} {sec.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {lines.map((line, j) => (
                <div key={j} style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text1)' }}>{line}</div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SynergyInfo({ connectedPlatforms, onConnect }) {
  const adCount = connectedPlatforms.filter(p => SPEND_PLATFORMS.includes(p)).length;
  return (
    <div>
      <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        {adCount === 0 ? 'Kanal sinerjisi analizi için en az 2 platform bağlayın.' : 'Kanal sinerjisi analizi için en az 1 platform daha bağlayın.'}
        {' '}Örneğin <strong style={{ color: '#1877F2' }}>Meta Ads</strong> (farkındalık) + <strong style={{ color: '#4285F4' }}>Google Ads</strong> (dönüşüm).
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        <div style={sg.funnelBox}>
          <div style={sg.stageLabel}>Farkındalık</div>
          {[
            { key: 'meta', label: 'Meta Ads', color: '#1877F2' },
            { key: 'tiktok', label: 'TikTok Ads', color: '#FF0050' },
            { key: 'linkedin', label: 'LinkedIn Ads', color: '#0A66C2' },
            { key: 'adform', label: 'Adform', color: '#FF6B35' },
          ].map(pl => {
            const conn = connectedPlatforms.includes(pl.key);
            return (
              <div key={pl.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, opacity: conn ? 1 : 0.35 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: conn ? pl.color : 'var(--border2)' }} />
                <span style={{ fontSize: 12 }}>{pl.label}</span>
                {conn && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓</span>}
              </div>
            );
          })}
        </div>
        <div style={sg.arrow}><div style={sg.arrowLine} /><div style={sg.arrowLabel}>Yönlendirme</div><div style={sg.arrowHead}>›</div></div>
        <div style={{ ...sg.funnelBox, background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.2)' }}>
          <div style={sg.stageLabel}>Değerlendirme</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Yeniden pazarlama,<br/>lookalike kitleler</div>
        </div>
        <div style={sg.arrow}><div style={sg.arrowLine} /><div style={sg.arrowLabel}>Dönüştürme</div><div style={sg.arrowHead}>›</div></div>
        <div style={sg.funnelBox}>
          <div style={sg.stageLabel}>Dönüşüm</div>
          {[
            { key: 'google_ads', label: 'Google Ads', color: '#4285F4' },
            { key: 'appsflyer', label: 'AppsFlyer', color: '#00B2FF' },
            { key: 'adjust', label: 'Adjust', color: '#9CA3AF' },
          ].map(pl => {
            const conn = connectedPlatforms.includes(pl.key);
            return (
              <div key={pl.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, opacity: conn ? 1 : 0.35 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: conn ? pl.color : 'var(--border2)' }} />
                <span style={{ fontSize: 12 }}>{pl.label}</span>
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

function SynergyFunnelFull({ allAdIntegrations, connectedKeys }) {
  const allPlatforms = [
    { key: 'meta', label: 'Meta Ads', color: '#1877F2', stage: 'top' },
    { key: 'tiktok', label: 'TikTok Ads', color: '#FF0050', stage: 'top' },
    { key: 'linkedin', label: 'LinkedIn Ads', color: '#0A66C2', stage: 'top' },
    { key: 'adform', label: 'Adform', color: '#FF6B35', stage: 'top' },
    { key: 'google_ads', label: 'Google Ads', color: '#4285F4', stage: 'bottom' },
    { key: 'appsflyer', label: 'AppsFlyer', color: '#00B2FF', stage: 'bottom' },
    { key: 'adjust', label: 'Adjust', color: '#9CA3AF', stage: 'bottom' },
  ];

  const imp  = allAdIntegrations.reduce((s, i) => s + (parseInt(i.total_impressions) || 0), 0);
  const clk  = allAdIntegrations.reduce((s, i) => s + (parseInt(i.total_clicks) || 0), 0);
  const conv = allAdIntegrations.reduce((s, i) => s + (parseInt(i.total_conversions) || 0), 0);
  const ctrRate  = imp  > 0 ? (clk  / imp  * 100) : 0;
  const convRate = clk  > 0 ? (conv / clk  * 100) : 0;

  const stage = (title, metric, unit, platforms, stageKey, color) => (
    <div style={{ ...sg.funnelBox, borderColor: `${color}30`, background: `${color}06`, minWidth: 170 }}>
      <div style={{ ...sg.stageLabel, color }}>{title}</div>
      {metric > 0 && (
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color, marginBottom: 8 }}>
          {fmtN(metric)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>{unit}</span>
        </div>
      )}
      {platforms.map(pl => {
        const conn = connectedKeys.includes(pl.key);
        return (
          <div key={pl.key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, opacity: conn ? 1 : 0.3 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: conn ? pl.color : 'var(--border2)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: conn ? 'var(--text1)' : 'var(--text3)' }}>{pl.label}</span>
            {conn && <span style={{ fontSize: 9, color: '#10B981', fontWeight: 700, marginLeft: 'auto' }}>✓</span>}
          </div>
        );
      })}
    </div>
  );

  const arr = (rate, label) => (
    <div style={sg.arrow}>
      <div style={sg.arrowLine} />
      <div style={{ fontSize: 10, color: rate > 0 ? '#0EA5E9' : 'var(--text3)', fontWeight: rate > 0 ? 700 : 400, whiteSpace: 'nowrap', textAlign: 'center' }}>
        {label}
        {rate > 0 && <div style={{ fontSize: 11, color: '#0EA5E9' }}>%{rate.toFixed(1)}</div>}
      </div>
      <div style={sg.arrowHead}>›</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 8, gap: 0 }}>
      {stage('Farkındalık', imp, 'imp.', allPlatforms.filter(p => p.stage === 'top'), 'top', '#0EA5E9')}
      {arr(ctrRate, 'Yönlendirme')}
      <div style={{ ...sg.funnelBox, borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.06)', minWidth: 170 }}>
        <div style={{ ...sg.stageLabel, color: '#8B5CF6' }}>Değerlendirme</div>
        {clk > 0 && (
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: '#8B5CF6', marginBottom: 8 }}>
            {fmtN(clk)} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>tık</span>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>Yeniden pazarlama,<br/>lookalike kitleler</div>
      </div>
      {arr(convRate, 'Dönüştürme')}
      {stage('Dönüşüm', conv, 'dön.', allPlatforms.filter(p => p.stage === 'bottom'), 'bottom', '#10B981')}
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Channels({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const { isActive } = useSubscription();
  const isAgency   = user?.company_type === 'agency';
  const needsBrand = isAgency && !selectedBrand;

  const [gateModal, setGateModal] = useState(false);

  const [days, setDays]             = useState(30);
  const [platFilter, setPlatFilter] = useState('all');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [barMetric, setBarMetric]   = useState('spend');

  const [aiText, setAiText]         = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiError, setAiError]       = useState('');
  const aiRef = useRef(null);

  const [kpiPanelOpen, setKpiPanelOpen] = useState(false);
  const [kpiText, setKpiText]           = useState('');
  const [kpiLoading, setKpiLoading]     = useState(false);
  const [kpiError, setKpiError]         = useState('');
  const kpiRef = useRef(null);

  const [aiUsage, setAiUsage]         = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [aiStatus, setAiStatus]       = useState('idle');
  const [kpiStatus, setKpiStatus]     = useState('idle');
  const [queueInfo, setQueueInfo]     = useState({ size: 0, pending: 0 });

  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState(null);
  const [campaignsList, setCampaignsList]                   = useState([]);
  const [campaignDetail, setCampaignDetail]                 = useState(null);

  const brandName  = selectedBrand?.company_name || selectedBrand?.name;
  const brandId    = isAgency ? selectedBrand?.id : undefined;
  const kpiBrandId = isAgency ? selectedBrand?.id : user?.company_id;

  const load = useCallback(() => {
    if (needsBrand) { setLoading(false); return; }
    setLoading(true);
    getChannelData(days, platFilter, brandId)
      .then(setData)
      .catch(() => setData({ sector: null, integrations: [], prevIntegrations: [], dailyMetrics: [], anomalyDates: [] }))
      .finally(() => setLoading(false));
  }, [days, platFilter, brandId, needsBrand]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getAiUsageToday().then(setAiUsage).catch(() => {}); }, []);

  useEffect(() => {
    if (needsBrand) return;
    const params = isAgency && selectedBrand ? { brand_id: selectedBrand.id, status: 'active' } : { status: 'active' };
    getCampaigns(params).then(setCampaignsList).catch(() => setCampaignsList([]));
  }, [needsBrand, isAgency, selectedBrand?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCampaignFilter) { setCampaignDetail(null); return; }
    getCampaign(selectedCampaignFilter).then(setCampaignDetail).catch(() => setCampaignDetail(null));
  }, [selectedCampaignFilter]);
  useEffect(() => {
    if (!aiLoading && !kpiLoading) return;
    const id = setInterval(() => { getAiQueueStatus().then(setQueueInfo).catch(() => {}); }, 3000);
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
  const allIntegrations  = data?.integrations || [];
  const gaIntegration    = allIntegrations.find(i => i.platform === 'google_analytics');
  const adIntegrations   = allIntegrations.filter(i => SPEND_PLATFORMS.includes(i.platform));
  const allAdIntegrations = allIntegrations.filter(i => ALL_PLATFORMS.includes(i.platform));
  const connectedKeys    = allIntegrations.map(i => i.platform);
  const hasAnyData       = allAdIntegrations.length > 0;

  // Campaign filter — when a campaign is selected, narrow down to its channels
  const campaignPlatforms = campaignDetail?.channels?.map(c => c.platform) ?? null;
  const visibleAd = campaignPlatforms
    ? adIntegrations.filter(i => campaignPlatforms.includes(i.platform))
    : adIntegrations;

  const hasAdData = visibleAd.some(i => parseFloat(i.total_spend) > 0 || parseInt(i.total_impressions) > 0);
  const sector           = data?.sector || 'Diğer';

  const gaData = gaIntegration ? {
    sessions:    parseInt(gaIntegration.total_impressions) || 0,
    users:       parseInt(gaIntegration.total_clicks)      || 0,
    conversions: parseInt(gaIntegration.total_conversions) || 0,
    convRate:    parseInt(gaIntegration.total_impressions) > 0
      ? (parseInt(gaIntegration.total_conversions) / parseInt(gaIntegration.total_impressions) * 100) : 0,
  } : null;

  const totalSpend  = visibleAd.reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const totalConv   = visibleAd.reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const totalClicks = visibleAd.reduce((s, i) => s + parseInt(i.total_clicks || 0), 0);
  const totalImp    = visibleAd.reduce((s, i) => s + parseInt(i.total_impressions || 0), 0);
  const roasVals    = visibleAd.filter(i => parseFloat(i.avg_roas) > 0);
  const avgRoas     = roasVals.length ? roasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasVals.length : 0;
  const avgCtr      = totalImp > 0 ? (totalClicks / totalImp * 100) : 0;
  const avgCpa      = totalConv > 0 ? totalSpend / totalConv : null;

  const prev       = data?.prevIntegrations || [];
  const prevMap    = Object.fromEntries(prev.map(p => [p.id, p]));
  const prevSpend  = prev.filter(i => SPEND_PLATFORMS.includes(i.platform)).reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const prevConv   = prev.filter(i => SPEND_PLATFORMS.includes(i.platform)).reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const prevRoasV  = prev.filter(i => SPEND_PLATFORMS.includes(i.platform) && parseFloat(i.avg_roas) > 0);
  const prevRoas   = prevRoasV.length ? prevRoasV.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / prevRoasV.length : 0;

  const sectorBm  = BENCHMARKS[sector] || BENCHMARKS['Diğer'];
  const bmRoasAvg = (sectorBm.google_roas + sectorBm.meta_roas) / 2;

  const scored = visibleAd.map(i => ({
    ...i,
    ctr: calcCtr(i), cpa: calcCpa(i),
    bm: getBenchmark(sector, i.platform),
    efficiency: calcEfficiency(i, getBenchmark(sector, i.platform)),
  }));
  const bestChannel  = scored.length ? scored.reduce((a, b) => a.efficiency > b.efficiency ? a : b) : null;
  const worstChannel = scored.length > 1 ? scored.reduce((a, b) => a.efficiency < b.efficiency ? a : b) : null;

  const kpiTargets    = data?.kpi_targets || {};
  const hasKpiTargets = Object.keys(kpiTargets).length > 0;

  const activePlatforms = [...new Set((data?.dailyMetrics || []).map(m => m.platform))];
  const chartData       = buildChartData(data?.dailyMetrics || [], data?.anomalyDates || []);
  const dailyMetrics    = data?.dailyMetrics || [];

  const pieData = visibleAd
    .filter(i => parseFloat(i.total_spend) > 0)
    .map(i => ({ name: PLATFORM_LABELS[i.platform]||i.platform, value: parseFloat(i.total_spend), color: PLATFORM_COLORS[i.platform]||'#888', platform: i.platform }));

  const adPlatformCount = connectedKeys.filter(p => SPEND_PLATFORMS.includes(p)).length;

  // Bar chart data
  const barData = scored.map(i => ({
    name: (PLATFORM_LABELS[i.platform] || i.platform).replace(' Ads', ''),
    platform: i.platform,
    value: barMetric === 'roas'        ? parseFloat(i.avg_roas) || 0
         : barMetric === 'cpa'         ? (i.cpa || 0)
         : barMetric === 'ctr'         ? i.ctr
         : barMetric === 'spend'       ? parseFloat(i.total_spend) || 0
         : parseInt(i.total_conversions) || 0,
  }));
  const activeBmCfg = BAR_METRICS.find(m => m.key === barMetric);
  const barKpiRef = (() => {
    if (!hasKpiTargets) return null;
    const vals = scored.map(i => {
      const kpi = kpiTargets[i.platform];
      if (!kpi) return null;
      return barMetric === 'roas' ? kpi.kpi_roas : barMetric === 'cpa' ? kpi.kpi_cpa : barMetric === 'ctr' ? kpi.kpi_ctr : null;
    }).filter(v => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();
  const barLabelFmt = v => {
    if (!v && v !== 0) return '';
    if (barMetric === 'spend') return fmtTL(v);
    if (barMetric === 'roas') return `${Number(v).toFixed(1)}x`;
    if (barMetric === 'cpa') return fmtTL(v);
    if (barMetric === 'ctr') return `%${Number(v).toFixed(1)}`;
    return fmtN(v);
  };

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
    if (!aiMetrics.length) { setAiError('Analiz için yeterli veri yok. Entegrasyon bağlandıktan sonra tekrar deneyin.'); return; }
    const benchmarks = adIntegrations.map(i => {
      const bm = getBenchmark(sector, i.platform);
      return { platform: PLATFORM_LABELS[i.platform]||i.platform, roas: bm.roas, ctr: bm.ctr };
    });
    setAiStatus('queued'); setAiLoading(true); setAiText(''); setAiError('');
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/channels/ai-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ metrics: aiMetrics, sector, benchmarks, days }),
      });
      if (res.status === 403) { setLimitReached('subscription'); setAiError('Bu özellik için aktif abonelik gereklidir.'); return; }
      if (res.status === 429) { const e = await res.json().catch(() => ({})); setLimitReached(true); setAiError(e.error || 'Günlük AI kullanım limitinize ulaştınız.'); return; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'AI analiz başarısız.'); }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { setAiLoading(false); setAiStatus('idle'); getAiUsageToday().then(setAiUsage).catch(() => {}); return; }
          try {
            const { text, error, queueStatus, size } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (queueStatus === 'queued') { setAiStatus('queued'); setQueueInfo(q => ({ ...q, size: size ?? q.size })); }
            if (queueStatus === 'processing') setAiStatus('processing');
            if (text) setAiText(p => p + text);
          } catch {}
        }
      }
    } catch (err) { setAiError(err.message || 'AI analiz başarısız.'); }
    finally { setAiLoading(false); setAiStatus('idle'); }
  };

  const runKpiAnalysis = async () => {
    setKpiPanelOpen(true); setKpiStatus('queued'); setKpiText(''); setKpiError(''); setKpiLoading(true);
    setTimeout(() => kpiRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/budgets/kpi-analysis/${kpiBrandId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.status === 403) { setLimitReached('subscription'); setKpiError('Bu özellik için aktif abonelik gereklidir.'); return; }
      if (res.status === 429) { const e = await res.json().catch(() => ({})); setLimitReached(true); setKpiError(e.error || 'Günlük AI kullanım limitinize ulaştınız.'); return; }
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'KPI analiz başarısız.'); }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { setKpiLoading(false); setKpiStatus('idle'); getAiUsageToday().then(setAiUsage).catch(() => {}); return; }
          try {
            const { text, error, queueStatus, size } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (queueStatus === 'queued') { setKpiStatus('queued'); setQueueInfo(q => ({ ...q, size: size ?? q.size })); }
            if (queueStatus === 'processing') setKpiStatus('processing');
            if (text) setKpiText(p => p + text);
          } catch {}
        }
      }
    } catch (err) { setKpiError(err.message || 'KPI analiz başarısız.'); }
    finally { setKpiLoading(false); setKpiStatus('idle'); }
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
      {gateModal && <SubscriptionGateModal onClose={() => setGateModal(false)} onNav={onNav} />}
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {campaignsList.length > 0 && (
            <select
              value={selectedCampaignFilter || ''}
              onChange={e => setSelectedCampaignFilter(e.target.value || null)}
              style={{ ...s.select, fontWeight: selectedCampaignFilter ? 600 : 400, borderColor: selectedCampaignFilter ? 'var(--teal)' : 'var(--border2)', color: selectedCampaignFilter ? 'var(--teal)' : 'var(--text2)' }}
            >
              <option value="">Tüm Kampanyalar</option>
              {campaignsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
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
          {hasAdData && <button onClick={() => { if (!isActive) { setGateModal(true); return; } exportCsv(visibleAd, sector); }} style={s.exportBtn}>↓ CSV</button>}
          {kpiBrandId && (
            <button onClick={() => { if (!isActive) { setGateModal(true); return; } runKpiAnalysis(); }} disabled={kpiLoading}
              style={{ ...s.exportBtn, background: kpiPanelOpen ? 'rgba(139,92,246,0.15)' : 'transparent', borderColor: '#8b5cf6', color: '#a78bfa' }}>
              🎯 KPI Analizi
            </button>
          )}
          {aiUsage && (aiUsage.has_access === false
            ? (!user?.is_managed_by_agency && <button onClick={() => onNav?.('pricing')} style={{ padding: '5px 12px', background: 'var(--teal)', border: 'none', borderRadius: 6, color: '#0B1219', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Abonelik Başlat</button>)
            : <span style={{ fontSize: 11, color: aiUsage.total >= aiUsage.limit ? 'var(--coral)' : 'var(--text3)', whiteSpace: 'nowrap' }}>Bugün: {aiUsage.total}/{aiUsage.limit} AI</span>
          )}
        </div>
      </div>

      <div className="content">
        {/* Limit banner */}
        {limitReached && (
          <div style={{ marginBottom: 16, background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--coral)' }}>
              {limitReached === 'subscription'
                ? '⚠ Bu özellik için aktif abonelik gereklidir. Hemen başlamak için tıklayın →'
                : '⚠ Günlük AI kullanım limitinize ulaştınız. Planınızı yükseltmek için tıklayın →'}
            </span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {!user?.is_managed_by_agency && (
                <button onClick={() => onNav?.('pricing')} style={{ padding: '5px 14px', background: 'var(--coral)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {limitReached === 'subscription' ? 'Abonelik Başlat' : 'Planı Yükselt'}
                </button>
              )}
              <button onClick={() => setLimitReached(false)} style={{ padding: '5px 8px', background: 'transparent', border: '1px solid rgba(255,107,90,0.4)', borderRadius: 6, color: 'var(--coral)', fontSize: 12, cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        )}

        <SubscriptionBanner onNav={onNav} />

        {/* ── BÖLÜM 1: Reklam Harcaması Özeti ───────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[1,2,3].map(i => <div key={i} className="card" style={{ padding: 16 }}><SkeletonBar height={120} /></div>)}
          </div>
        ) : adIntegrations.length === 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>Reklam Harcaması Özeti</div>
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          </div>
        ) : (
          <>
            {hasAdData && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Toplam: <strong style={{ color: 'var(--text1)', fontFamily: 'var(--mono)' }}>{fmtTL(totalSpend)}</strong></span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Ort. ROAS: <strong style={{ color: avgRoas >= bmRoasAvg ? '#10B981' : '#F59E0B' }}>{avgRoas.toFixed(2)}x</strong></span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>Dönüşüm: <strong>{fmtN(totalConv)}</strong></span>
                    {avgCpa && <span style={{ fontSize: 12, color: 'var(--text2)' }}>Ort. CPA: <strong>{fmtTL(avgCpa)}</strong></span>}
                    <BenchmarkTag label="ROAS" actual={avgRoas} benchmark={bmRoasAvg} unit="x" />
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <ChangeArrow pct={pctChange(totalSpend, prevSpend)} />
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>harcama · önceki dönem</span>
                  </div>
                </div>
                {campaignDetail && (() => {
                  const campTotal = parseFloat(campaignDetail.total_budget) || 0;
                  const pct = campTotal > 0 ? Math.min(100, (totalSpend / campTotal) * 100) : 0;
                  return (
                    <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>Kampanya Bütçesi</span>
                        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>
                          {fmtTL(totalSpend)} / {fmtTL(campTotal)} harcandı
                          <span style={{ marginLeft: 6, color: pct >= 80 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>%{pct.toFixed(0)}</span>
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#F59E0B' : '#0d9488', borderRadius: 3, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: campaignDetail ? 8 : 24 }}>
              {visibleAd.map(integration => (
                <PlatformSpendCard
                  key={integration.id}
                  integration={integration}
                  prevIntegration={prevMap[integration.id]}
                  sparklineData={getSparklineData(integration.platform, dailyMetrics)}
                  kpi={kpiTargets[integration.platform]}
                  totalSpend={totalSpend}
                />
              ))}
            </div>
            {campaignDetail && visibleAd.length > 0 && totalSpend > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 24, padding: '6px 0', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Bu kampanyada:</span>
                {visibleAd.filter(i => parseFloat(i.total_spend) > 0).map(i => {
                  const pct = totalSpend > 0 ? Math.round(parseFloat(i.total_spend) / totalSpend * 100) : 0;
                  return (
                    <span key={i.platform} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border2)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: PLATFORM_COLORS[i.platform] || '#888', flexShrink: 0 }} />
                      {PLATFORM_LABELS[i.platform] || i.platform} <strong>%{pct}</strong>
                    </span>
                  );
                })}
              </div>
            )}
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

        {/* ── BÖLÜM 2: Kanal Karşılaştırma (Bar Chart) ───────────────────── */}
        <SectionCard
          title="Kanal Karşılaştırma"
          subtitle={`Son ${days} gün · metrik seç`}
          action={
            <div style={s.filterGroup}>
              {BAR_METRICS.map(m => (
                <button key={m.key} onClick={() => setBarMetric(m.key)}
                  style={{ ...s.filterBtn, fontSize: 11, padding: '5px 10px', background: barMetric === m.key ? 'var(--teal)' : 'transparent', color: barMetric === m.key ? '#0B1219' : 'var(--text3)' }}>
                  {m.label}
                </button>
              ))}
            </div>
          }
        >
          {loading ? <SkeletonBar height={200} /> : !barData.length ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={activeBmCfg?.yFmt || (v => v)} width={55} />
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [barLabelFmt(v), BAR_METRICS.find(m => m.key === barMetric)?.label]}
                />
                {barKpiRef != null && (
                  <ReferenceLine y={barKpiRef} stroke="#a78bfa" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `H: ${barLabelFmt(barKpiRef)}`, position: 'insideTopRight', fontSize: 10, fill: '#a78bfa' }} />
                )}
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={64}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={PLATFORM_COLORS[entry.platform] || '#888'} fillOpacity={0.85} />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={barLabelFmt}
                    style={{ fontSize: 10, fill: 'var(--text2)', fontFamily: 'var(--mono)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── BÖLÜM 3: Trend Grafikleri (yan yana) ────────────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
            <div className="card"><div className="card-body"><SkeletonBar height={200} /></div></div>
            <div className="card"><div className="card-body"><SkeletonBar height={200} /></div></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
            {/* Harcama Trendi */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Harcama Trendi</div>
                <div className="card-subtitle">Son {days} gün · kırmızı nokta: anomali</div>
              </div>
              <div className="card-body">
                {chartData.length === 0 ? (
                  <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={v => `₺${fmtN(v)}`} width={60} />
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [fmtTL(v), PLATFORM_LABELS[name.replace('_spend','')] || name]}
                        labelFormatter={l => l} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => PLATFORM_LABELS[v.replace('_spend','')] || v} />
                      {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p)).map(p => (
                        <Line key={p} type="monotone" dataKey={`${p}_spend`} stroke={PLATFORM_COLORS[p]||'#888'} strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ROAS Trendi */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">ROAS Trendi</div>
                <div className="card-subtitle">Son {days} gün{hasKpiTargets ? ' · kesikli: KPI hedefi' : ''}</div>
              </div>
              <div className="card-body">
                {chartData.length === 0 ? (
                  <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} tickFormatter={v => `${v.toFixed(1)}x`} width={42} />
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [`${Number(v).toFixed(2)}x`, PLATFORM_LABELS[name.replace('_roas','')] || name]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => PLATFORM_LABELS[v.replace('_roas','')] || v} />
                      {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p)).map(p => (
                        <Line key={p} type="monotone" dataKey={`${p}_roas`} stroke={PLATFORM_COLORS[p]||'#888'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      ))}
                      {activePlatforms.filter(p => SPEND_PLATFORMS.includes(p) && kpiTargets[p]?.kpi_roas != null).map(p => (
                        <ReferenceLine key={`kpi-${p}`} y={kpiTargets[p].kpi_roas}
                          stroke={PLATFORM_COLORS[p]||'#888'} strokeDasharray="6 3" strokeOpacity={0.55} strokeWidth={1.5}
                          label={{ value: `↑ H:${kpiTargets[p].kpi_roas}x`, position: 'insideTopRight', fontSize: 9, fill: PLATFORM_COLORS[p]||'#888' }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BÖLÜM 4: Bütçe Verimliliği ─────────────────────────────────── */}
        <SectionCard title="Bütçe Verimliliği" subtitle="Harcama dağılımı ve KPI performansı">
          {loading ? <SkeletonBar height={200} /> : pieData.length === 0 ? (
            <InlineEmptyState connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 32, alignItems: 'start', flexWrap: 'wrap' }}>
              {/* Donut chart */}
              <div>
                <div style={{ position: 'relative', width: 200, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={2}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} formatter={v => fmtTL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Toplam</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmtTL(totalSpend)}</div>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {pieData.map(d => {
                    const pct = totalSpend > 0 ? Math.round(d.value / totalSpend * 100) : 0;
                    return (
                      <div key={d.platform} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, flex: 1 }}>{d.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{fmtTL(d.value)}</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', minWidth: 30, textAlign: 'right' }}>%{pct}</span>
                      </div>
                    );
                  })}
                  {gaData && gaData.conversions > 0 && (
                    <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: '#E37400', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, color: 'var(--text3)' }}>GA4 Dönüşüm</span>
                      <span style={{ fontSize: 12, color: '#E37400', fontWeight: 600 }}>{fmtN(gaData.conversions)} dön.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* KPI Performance Table */}
              <div style={{ minWidth: 0 }}>
                {bestChannel && optimSuggestion && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: '#10B981', marginBottom: 4 }}>En verimli: {PLATFORM_LABELS[bestChannel.platform]} ({bestChannel.efficiency}/100)</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>{optimSuggestion}</div>
                  </div>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  KPI Performans {hasKpiTargets ? '— Bu Ay Hedeflerine Göre' : '— Gerçekleşen'}
                </div>
                <table className="cmp-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>ROAS</th>
                      <th>CPA</th>
                      <th>CTR</th>
                      {hasKpiTargets && <th>Durum</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {scored.sort((a, b) => b.efficiency - a.efficiency).map(i => {
                      const kpi = kpiTargets[i.platform];
                      const tls = [
                        trafficLight(parseFloat(i.avg_roas), kpi?.kpi_roas),
                        trafficLight(i.cpa, kpi?.kpi_cpa, true),
                        trafficLight(i.ctr, kpi?.kpi_ctr),
                      ].filter(Boolean);
                      const avgPct = tls.length ? Math.round(tls.reduce((s, t) => s + t.pct, 0) / tls.length) : null;
                      const overallTl = avgPct != null ? (avgPct >= 100 ? { icon: '🟢', color: '#10B981' } : avgPct >= 80 ? { icon: '🟡', color: '#F59E0B' } : { icon: '🔴', color: '#EF4444' }) : null;
                      return (
                        <tr key={i.id}>
                          <td style={{ color: PLATFORM_COLORS[i.platform], fontWeight: 700 }}>{PLATFORM_LABELS[i.platform]}</td>
                          <td>
                            {kpi?.kpi_roas != null ? (
                              <KpiCell actual={parseFloat(i.avg_roas)} target={kpi.kpi_roas} fmt={v => `${v.toFixed(1)}x`} />
                            ) : <span style={{ color: '#A78BFA', textShadow: '0 0 20px rgba(167,139,250,0.5)' }}>{Number(i.avg_roas).toFixed(2)}x</span>}
                          </td>
                          <td>
                            {kpi?.kpi_cpa != null ? (
                              <KpiCell actual={i.cpa} target={kpi.kpi_cpa} fmt={v => fmtTL(v)} lowerIsBetter />
                            ) : <span style={{ color: 'var(--text2)' }}>{i.cpa ? fmtTL(i.cpa) : '—'}</span>}
                          </td>
                          <td>
                            {kpi?.kpi_ctr != null ? (
                              <KpiCell actual={i.ctr} target={kpi.kpi_ctr} fmt={v => fmtPct(v)} />
                            ) : <span style={{ color: 'var(--text2)' }}>{fmtPct(i.ctr)}</span>}
                          </td>
                          {hasKpiTargets && (
                            <td>
                              {overallTl ? (
                                <span style={{ fontSize: 12, fontWeight: 700, color: overallTl.color }}>
                                  {overallTl.icon} %{avgPct}
                                </span>
                              ) : <span style={{ color: 'var(--text3)', fontSize: 12 }}>—</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                    <button onClick={() => { if (!isActive) { setGateModal(true); return; } runAi(); }} style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      ✦ AI Analiz Et
                    </button>
                  </div>
                )}
                {aiLoading && !aiText && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                    {aiStatus === 'queued' ? (
                      <>⏳ Sırada bekleniyor...{queueInfo.size > 0 && <span style={{ marginLeft: 4 }}>({queueInfo.size} istek önünüzde)</span>}</>
                    ) : (
                      <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>↻</span>Analiz yapılıyor...</>
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
                    {aiLoading ? (
                      <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '16px 18px', fontSize: 13, lineHeight: 1.8, color: 'var(--text1)', whiteSpace: 'pre-wrap', minHeight: 80 }}>
                        {aiText}
                        <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--teal)', marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s step-end infinite' }} />
                      </div>
                    ) : (
                      <AiParsedView text={aiText} />
                    )}
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

        {/* ── BÖLÜM 5b: KPI Analizi Paneli ────────────────────────────────── */}
        {kpiPanelOpen && (
          <div ref={kpiRef}>
            <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">🎯 KPI Analizi</div>
                  <div className="card-subtitle">Bütçe hedefleri ile gerçek performans karşılaştırması</div>
                </div>
                <button onClick={() => setKpiPanelOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div className="card-body">
                {kpiLoading && !kpiText && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                    {kpiStatus === 'queued' ? (
                      <>⏳ Sırada bekleniyor...{queueInfo.size > 0 && <span style={{ marginLeft: 4 }}>({queueInfo.size} istek önünüzde)</span>}</>
                    ) : (
                      <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>↻</span>KPI analizi yapılıyor...</>
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
        <SectionCard title="Kanal Sinerjisi" subtitle="Platform funnel analizi — farkındalıktan dönüşüme">
          {loading ? <SkeletonBar height={120} /> : adPlatformCount < 2 ? (
            <SynergyInfo connectedPlatforms={connectedKeys} onConnect={goToIntegrations} />
          ) : (
            <SynergyFunnelFull allAdIntegrations={allAdIntegrations} connectedKeys={connectedKeys} />
          )}
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
};

const sg = {
  funnelBox: { background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px', minWidth: 160 },
  stageLabel:{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 },
  arrow:     { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px', gap: 4 },
  arrowLine: { width: 40, height: 2, background: 'var(--border2)' },
  arrowLabel:{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' },
  arrowHead: { fontSize: 20, color: 'var(--text3)', lineHeight: 1 },
};
