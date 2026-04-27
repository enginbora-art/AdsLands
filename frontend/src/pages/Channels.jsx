import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getChannelData } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector,
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
const AD_PLATFORMS = ['google_ads', 'meta', 'tiktok', 'linkedin', 'adform'];

const BENCHMARKS = {
  'E-ticaret':        { google_roas: 3.5, meta_roas: 3.0, ctr: 2.5 },
  'Perakende':        { google_roas: 3.0, meta_roas: 2.5, ctr: 2.0 },
  'Finans & Sigorta': { google_roas: 2.0, meta_roas: 1.8, ctr: 1.5 },
  'Otomotiv':         { google_roas: 2.5, meta_roas: 2.0, ctr: 1.8 },
  'Gıda & İçecek':   { google_roas: 3.0, meta_roas: 3.5, ctr: 3.0 },
  'Turizm & Seyahat': { google_roas: 4.0, meta_roas: 3.0, ctr: 2.2 },
  'Teknoloji & SaaS': { google_roas: 3.0, meta_roas: 2.5, ctr: 2.8 },
  'Sağlık & Güzellik':{ google_roas: 2.5, meta_roas: 2.8, ctr: 2.0 },
  'Eğitim':           { google_roas: 2.0, meta_roas: 2.5, ctr: 2.5 },
  'Gayrimenkul':      { google_roas: 2.0, meta_roas: 1.5, ctr: 1.2 },
  'Medya & Eğlence':  { google_roas: 2.5, meta_roas: 3.0, ctr: 3.5 },
  'Diğer':            { google_roas: 2.5, meta_roas: 2.5, ctr: 2.0 },
};

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────
const fmtN = (n, d = 0) => Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtTL = (n) => `₺${fmtN(n)}`;
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
  const clicks = parseInt(i.total_clicks) || 0;
  return imp > 0 ? (clicks / imp * 100) : 0;
}

function calcCpa(i) {
  const conv = parseInt(i.total_conversions) || 0;
  const spend = parseFloat(i.total_spend) || 0;
  return conv > 0 ? spend / conv : null;
}

function calcEfficiency(i, bm) {
  const roas = parseFloat(i.avg_roas) || 0;
  const ctr = calcCtr(i);
  const bmRoas = bm?.roas || 2.5;
  const bmCtr = bm?.ctr || 2.0;
  const roasComp = Math.min((roas / bmRoas) * 60, 120);
  const ctrComp = Math.min((ctr / bmCtr) * 40, 80);
  return Math.min(100, Math.max(0, Math.round(roasComp + ctrComp)));
}

function pctChange(cur, prev) {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

function buildChartData(dailyMetrics, anomalyDates, platforms) {
  const byDate = {};
  dailyMetrics.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = { date: m.date, isAnomaly: anomalyDates.includes(m.date) };
    byDate[m.date][`${m.platform}_spend`] = parseFloat(m.spend) || 0;
    byDate[m.date][`${m.platform}_roas`] = parseFloat(m.roas) || 0;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function exportCsv(integrations, sector) {
  const headers = ['Platform', 'Harcama', 'ROAS', 'CTR (%)', 'CPA (₺)', 'Dönüşüm', 'Verimlilik'];
  const rows = integrations.map(i => {
    const bm = getBenchmark(sector, i.platform);
    return [
      PLATFORM_LABELS[i.platform] || i.platform,
      i.total_spend.toFixed(2),
      i.avg_roas.toFixed(2),
      calcCtr(i).toFixed(2),
      calcCpa(i)?.toFixed(2) || '-',
      i.total_conversions,
      calcEfficiency(i, bm),
    ];
  });
  const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanal-analizi-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Bileşenler ────────────────────────────────────────────────────────────────
function ChangeArrow({ pct, reverse = false }) {
  if (pct === null) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
  const isGood = reverse ? pct < 0 : pct > 0;
  const color = isGood ? '#10B981' : '#EF4444';
  const arrow = pct > 0 ? '▲' : '▼';
  return (
    <span style={{ color, fontSize: 11, fontWeight: 700 }}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function BenchmarkTag({ label, actual, benchmark, unit = 'x', reverse = false }) {
  if (!benchmark) return null;
  const isGood = reverse ? actual <= benchmark : actual >= benchmark;
  const color = isGood ? '#10B981' : '#F59E0B';
  const icon = isGood ? '✓ İyi' : '⚠ Düşük';
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600 }}>
      {label}: {typeof actual === 'number' ? actual.toFixed(2) : actual}{unit} — Sektör ort: {benchmark}{unit} {icon}
    </span>
  );
}

function SectionCard({ title, subtitle, children, noData, onNavigate }) {
  return (
    <div style={{ position: 'relative', marginBottom: 24 }}>
      <div className="card" style={{ filter: noData ? 'blur(4px)' : 'none', pointerEvents: noData ? 'none' : 'auto', userSelect: noData ? 'none' : 'auto' }}>
        <div className="card-header">
          <div>
            <div className="card-title">{title}</div>
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
        </div>
        <div className="card-body">{children}</div>
      </div>
      {noData && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(11,18,25,0.75)', borderRadius: 12, zIndex: 5 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🔗</div>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>Bu analiz için entegrasyon bağlayın</div>
          <button onClick={onNavigate}
            style={{ padding: '8px 18px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Entegrasyonlara Git
          </button>
        </div>
      )}
    </div>
  );
}

function CustomDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.isAnomaly) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#EF4444" stroke="#fff" strokeWidth={1.5} />;
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function Channels({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const needsBrand = isAgency && !selectedBrand;

  const [days, setDays] = useState(30);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiRef = useRef(null);

  const brandId = isAgency ? selectedBrand?.id : undefined;

  const load = useCallback(() => {
    if (needsBrand) return;
    setLoading(true);
    setData(null);
    getChannelData(days, platformFilter, brandId)
      .then(setData)
      .catch(() => setData({ sector: null, integrations: [], prevIntegrations: [], dailyMetrics: [], anomalyDates: [] }))
      .finally(() => setLoading(false));
  }, [days, platformFilter, brandId, needsBrand]);

  useEffect(() => { load(); }, [load]);

  // ── "Önce marka seç" ekranı ───────────────────────────────────────────────
  if (needsBrand) {
    return (
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
  }

  const title = isAgency ? `${selectedBrand?.company_name} — Kanal Analizi` : 'Kanal Analizi';
  const hasData = (data?.integrations?.length ?? 0) > 0;
  const adIntegrations = (data?.integrations || []).filter(i => AD_PLATFORMS.includes(i.platform));
  const sector = data?.sector || 'Diğer';

  // Toplam metrikler
  const totalSpend = adIntegrations.reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const totalConv = adIntegrations.reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const totalClicks = adIntegrations.reduce((s, i) => s + parseInt(i.total_clicks || 0), 0);
  const totalImpressions = adIntegrations.reduce((s, i) => s + parseInt(i.total_impressions || 0), 0);
  const roasVals = adIntegrations.filter(i => parseFloat(i.avg_roas) > 0);
  const avgRoas = roasVals.length ? roasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / roasVals.length : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
  const avgCpa = totalConv > 0 ? totalSpend / totalConv : null;

  // Önceki dönem
  const prev = data?.prevIntegrations || [];
  const prevSpend = prev.reduce((s, i) => s + parseFloat(i.total_spend), 0);
  const prevConv = prev.reduce((s, i) => s + parseInt(i.total_conversions || 0), 0);
  const prevRoasVals = prev.filter(i => parseFloat(i.avg_roas) > 0);
  const prevRoas = prevRoasVals.length ? prevRoasVals.reduce((s, i) => s + parseFloat(i.avg_roas), 0) / prevRoasVals.length : 0;

  // Benchmark özeti
  const sectorBm = BENCHMARKS[sector] || BENCHMARKS['Diğer'];
  const bmRoasAvg = (sectorBm.google_roas + sectorBm.meta_roas) / 2;

  // Verimlilik skorları
  const scored = adIntegrations.map(i => ({
    ...i,
    ctr: calcCtr(i),
    cpa: calcCpa(i),
    bm: getBenchmark(sector, i.platform),
    efficiency: calcEfficiency(i, getBenchmark(sector, i.platform)),
  }));
  const bestChannel = scored.length ? scored.reduce((a, b) => a.efficiency > b.efficiency ? a : b) : null;
  const worstChannel = scored.length ? scored.reduce((a, b) => a.efficiency < b.efficiency ? a : b) : null;

  // Grafik verisi
  const activePlatforms = [...new Set((data?.dailyMetrics || []).map(m => m.platform))];
  const chartData = buildChartData(data?.dailyMetrics || [], data?.anomalyDates || [], activePlatforms);

  // Pasta grafik verisi
  const pieData = adIntegrations.filter(i => parseFloat(i.total_spend) > 0).map(i => ({
    name: PLATFORM_LABELS[i.platform] || i.platform,
    value: parseFloat(i.total_spend),
    color: PLATFORM_COLORS[i.platform] || '#888',
    platform: i.platform,
  }));

  // Optimizasyon önerisi
  const getOptimSuggestion = () => {
    if (!bestChannel) return null;
    const bm = getBenchmark(sector, bestChannel.platform);
    if (bestChannel.efficiency >= 80) {
      const bestPct = Math.round(parseFloat(bestChannel.total_spend) / totalSpend * 100);
      return `${PLATFORM_LABELS[bestChannel.platform]} en verimli kanalınız (Skor: ${bestChannel.efficiency}/100). Mevcut bütçenin %${bestPct}'ini bu kanala yönlendiriyorsunuz — oranı artırmayı değerlendirin.`;
    }
    return `${PLATFORM_LABELS[worstChannel.platform]} ROAS'ı (${Number(worstChannel.avg_roas).toFixed(1)}x) sektör ortalamasının (${getBenchmark(sector, worstChannel.platform).roas}x) altında. Hedefleme ve kreatif optimizasyonu önerilir.`;
  };

  // AI analiz fonksiyonu
  const runAi = async () => {
    setAiLoading(true);
    setAiText('');
    setAiError('');
    setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    const metrics = scored.map(i => ({
      platform: PLATFORM_LABELS[i.platform] || i.platform,
      spend: i.total_spend,
      roas: Number(i.avg_roas).toFixed(2),
      cpa: i.cpa ? i.cpa.toFixed(0) : null,
      ctr: i.ctr.toFixed(2),
      conversions: i.total_conversions,
      days,
    }));
    const benchmarks = adIntegrations.map(i => {
      const bm = getBenchmark(sector, i.platform);
      return { platform: PLATFORM_LABELS[i.platform] || i.platform, roas: bm.roas, ctr: bm.ctr };
    });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/channels/ai-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ metrics, sector, benchmarks, days }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI analiz başarısız.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') { setAiLoading(false); return; }
          try {
            const { text, error } = JSON.parse(payload);
            if (error) throw new Error(error);
            if (text) setAiText(prev => prev + text);
          } catch (e) {
            if (e.message !== 'JSON parse error') throw e;
          }
        }
      }
    } catch (err) {
      setAiError(err.message || 'AI analiz başarısız.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiReport = () => {
    const blob = new Blob([aiText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-kanal-analizi-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Tarih filtresi */}
          <div style={s.filterGroup}>
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{ ...s.filterBtn, background: days === d ? 'var(--teal)' : 'transparent', color: days === d ? '#0B1219' : 'var(--text2)' }}>
                {d} gün
              </button>
            ))}
          </div>
          {/* Platform filtresi */}
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} style={s.select}>
            <option value="all">Tüm Kanallar</option>
            {AD_PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
          {/* Export */}
          {hasData && (
            <button onClick={() => exportCsv(adIntegrations, sector)} style={s.exportBtn}>
              ↓ CSV
            </button>
          )}
        </div>
      </div>

      <div className="content">
        {loading && <div className="loading">Yükleniyor...</div>}

        {/* ── BÖLÜM 1: Genel Performans Özeti ─────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          {!loading && !hasData && (
            <div style={{ background: 'rgba(0,191,166,0.06)', border: '1px solid rgba(0,191,166,0.15)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Henüz veri yok</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
                {sector !== 'Diğer' ? `Sektör: ${sector} · ` : ''}Reklam hesabı bağlandıktan sonra analiz burada görünecek.
              </div>
              <button onClick={() => onNav?.('integrations')}
                style={{ padding: '8px 20px', background: 'var(--teal)', border: 'none', borderRadius: 8, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Entegrasyonlara Git
              </button>
            </div>
          )}

          {hasData && (
            <>
              <div className="metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 16 }}>
                {[
                  { label: 'Toplam Harcama', value: fmtTL(totalSpend), change: pctChange(totalSpend, prevSpend), reverse: false },
                  { label: 'Ort. ROAS', value: `${avgRoas.toFixed(2)}x`, change: pctChange(avgRoas, prevRoas), reverse: false },
                  { label: 'Toplam Dönüşüm', value: fmtN(totalConv), change: pctChange(totalConv, prevConv), reverse: false },
                  { label: 'Ort. CPA', value: avgCpa ? fmtTL(avgCpa) : '—', change: null, reverse: true },
                  { label: 'Ort. CTR', value: fmtPct(avgCtr), change: null, reverse: false },
                ].map(m => (
                  <div key={m.label} className="metric-card">
                    <div className="metric-label">{m.label}</div>
                    <div className="metric-value" style={{ fontSize: 20 }}>{m.value}</div>
                    <div className="metric-sub"><ChangeArrow pct={m.change} reverse={m.reverse} /></div>
                  </div>
                ))}
              </div>

              {/* Benchmark karşılaştırma bandı */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 18px', display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 0 }}>
                <BenchmarkTag label="ROAS" actual={avgRoas} benchmark={bmRoasAvg} unit="x" />
                <BenchmarkTag label="CTR" actual={avgCtr} benchmark={sectorBm.ctr} unit="%" />
                {avgCpa && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Sektör: {sector}</span>}
              </div>
            </>
          )}
        </div>

        {/* ── BÖLÜM 2: Kanal Karşılaştırma Tablosu ────────────────────────── */}
        <SectionCard title="Kanal Karşılaştırma" subtitle={`Son ${days} gün`} noData={!hasData} onNavigate={() => onNav?.('integrations')}>
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Harcama</th>
                <th>ROAS</th>
                <th>CPA</th>
                <th>CTR</th>
                <th>Dönüşüm</th>
                <th>Verimlilik</th>
              </tr>
            </thead>
            <tbody>
              {scored.sort((a, b) => b.efficiency - a.efficiency).map(i => {
                const isBest = i.id === bestChannel?.id;
                const isWorst = scored.length > 1 && i.id === worstChannel?.id;
                const effColor = i.efficiency >= 70 ? '#10B981' : i.efficiency >= 45 ? '#F59E0B' : '#EF4444';
                return (
                  <tr key={i.id} style={{ background: isBest ? 'rgba(16,185,129,0.04)' : isWorst ? 'rgba(245,158,11,0.04)' : 'transparent' }}>
                    <td>
                      <span style={{ color: PLATFORM_COLORS[i.platform], fontWeight: 700 }}>
                        {PLATFORM_LABELS[i.platform] || i.platform}
                      </span>
                      {isBest && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10B981', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>EN VERİMLİ</span>}
                      {isWorst && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>GELİŞTİR</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{fmtTL(i.total_spend)}</td>
                    <td style={{ color: parseFloat(i.avg_roas) >= i.bm.roas ? '#10B981' : '#F59E0B', fontWeight: 600 }}>{Number(i.avg_roas).toFixed(2)}x</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{i.cpa ? fmtTL(i.cpa) : '—'}</td>
                    <td>{fmtPct(i.ctr)}</td>
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
        </SectionCard>

        {/* ── BÖLÜM 3: Trend Grafikleri ─────────────────────────────────────── */}
        <SectionCard title="Harcama Trendi" subtitle={`Son ${days} gün · Kırmızı noktalar: anomali`} noData={!hasData} onNavigate={() => onNav?.('integrations')}>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => `₺${fmtN(v)}`} />
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [fmtTL(v), name.replace('_spend', '').replace(/_/g, ' ')]}
                  labelFormatter={l => l}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => PLATFORM_LABELS[v.replace('_spend', '')] || v} />
                {activePlatforms.filter(p => AD_PLATFORMS.includes(p)).map(p => (
                  <Line key={p} type="monotone" dataKey={`${p}_spend`}
                    stroke={PLATFORM_COLORS[p] || '#888'} strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="ROAS Trendi" subtitle={`Son ${days} gün`} noData={!hasData} onNavigate={() => onNav?.('integrations')}>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} tickFormatter={v => `${v.toFixed(1)}x`} />
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v, name) => [`${Number(v).toFixed(2)}x`, name.replace('_roas', '').replace(/_/g, ' ')]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => PLATFORM_LABELS[v.replace('_roas', '')] || v} />
                {activePlatforms.filter(p => AD_PLATFORMS.includes(p)).map(p => (
                  <Line key={p} type="monotone" dataKey={`${p}_roas`}
                    stroke={PLATFORM_COLORS[p] || '#888'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeDasharray="4 2" />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* ── BÖLÜM 4: Bütçe Verimliliği ──────────────────────────────────── */}
        <SectionCard title="Bütçe Verimliliği" subtitle="Kanal bazında harcama dağılımı" noData={!hasData} onNavigate={() => onNav?.('integrations')}>
          {pieData.length > 0 && (
            <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <ResponsiveContainer width={220} height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1f2e', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                    formatter={v => fmtTL(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
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
                </div>
                {bestChannel && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#10B981', marginBottom: 4 }}>
                      En verimli kanalınız: {PLATFORM_LABELS[bestChannel.platform]} (Verimlilik: {bestChannel.efficiency}/100)
                    </div>
                    {getOptimSuggestion() && (
                      <div style={{ color: 'var(--text2)', lineHeight: 1.5 }}>{getOptimSuggestion()}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── BÖLÜM 5: AI Kanal Analizi ─────────────────────────────────────── */}
        <div ref={aiRef}>
          <SectionCard title="AI Kanal Analizi" subtitle="Claude ile derinlemesine analiz" noData={!hasData} onNavigate={() => onNav?.('integrations')}>
            {!aiText && !aiLoading && !aiError && (
              <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
                  Son {days} günün performansı sektör benchmarklarıyla karşılaştırılarak analiz edilecek.
                </div>
                <button onClick={runAi}
                  style={{ padding: '10px 28px', background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  ✦ AI Analiz Et
                </button>
              </div>
            )}

            {aiLoading && !aiText && (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: 13 }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: 8 }}>↻</span>
                Analiz hazırlanıyor...
              </div>
            )}

            {aiError && (
              <div style={{ background: 'rgba(255,107,90,0.1)', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 8, padding: '10px 14px', color: 'var(--coral)', fontSize: 13, marginBottom: 16 }}>
                ⚠ {aiError}
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
                    <button onClick={saveAiReport}
                      style={{ padding: '7px 16px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                      ↓ Raporu Kaydet
                    </button>
                    <button onClick={() => { setAiText(''); setAiError(''); }}
                      style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}>
                      Yeni Analiz
                    </button>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── BÖLÜM 6: Kanal Sinerjisi ──────────────────────────────────────── */}
        <SectionCard title="Kanal Sinerjisi" subtitle="Attribution özeti" noData={!hasData} onNavigate={() => onNav?.('integrations')}>
          {(() => {
            const upper = scored.filter(i => ['tiktok', 'adform', 'linkedin'].includes(i.platform));
            const lower = scored.filter(i => ['google_ads', 'meta'].includes(i.platform));
            if (!upper.length && !lower.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Yeterli kanal verisi yok.</div>;
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
                  )) : <div style={{ fontSize: 12, color: 'var(--text3)' }}>Üst huni kanalı bağlanmadı.</div>}
                </div>
                <div style={s.synergyBox}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Alt Huni — Dönüşüm</div>
                  {lower.length ? lower.map(i => (
                    <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[i.platform] }} />
                      <span style={{ fontSize: 13 }}>{PLATFORM_LABELS[i.platform]}</span>
                      <span style={{ fontSize: 11, color: '#10B981', marginLeft: 'auto', fontWeight: 600 }}>{fmtN(i.total_conversions)} dön.</span>
                    </div>
                  )) : <div style={{ fontSize: 12, color: 'var(--text3)' }}>Alt huni kanalı bağlanmadı.</div>}
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
  filterBtn: { border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  select: { padding: '6px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer' },
  exportBtn: { padding: '6px 12px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  synergyBox: { background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 10, padding: '14px 16px' },
};
