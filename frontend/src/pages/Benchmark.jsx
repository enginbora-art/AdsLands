import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getBrandDashboard, getAgencyBrandDetail, getSettings, benchmarkAnalyze } from '../api';

const ANIM_CSS = `
@keyframes bm-in { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
@keyframes bar-grow { from{width:0;} to{width:var(--w);} }
@keyframes score-spin { from{stroke-dasharray:0 188.5;} to{stroke-dasharray:var(--sl) 188.5;} }
@keyframes ai-cursor { 0%,100%{opacity:1;} 50%{opacity:0;} }
@keyframes ai-dot { 0%,80%,100%{opacity:0;transform:scale(0.6);} 40%{opacity:1;transform:scale(1);} }
.bm-in { animation: bm-in 0.38s ease both; }
.bm-card {
  animation: bm-in 0.35s ease both;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.bm-card:hover { transform:translateY(-3px); box-shadow:0 10px 28px rgba(0,0,0,0.28); }
.platform-tab {
  padding:8px 18px; border-radius:8px; border:1px solid var(--border2);
  background:transparent; color:var(--text3); font-size:12px; font-weight:600;
  cursor:pointer; transition:all 0.15s ease; font-family:var(--font);
}
.platform-tab.active { background:var(--teal); border-color:var(--teal); color:#0B1219; }
.platform-tab:not(.active):hover { border-color:var(--teal); color:var(--teal); }
.ai-cursor { display:inline-block; width:2px; height:15px; background:var(--teal); border-radius:1px; margin-left:3px; vertical-align:text-bottom; animation:ai-cursor 0.9s ease infinite; }
.ai-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--teal); animation:ai-dot 1.2s ease infinite; }
.ai-dot:nth-child(2){animation-delay:0.2s;}
.ai-dot:nth-child(3){animation-delay:0.4s;}
.bm-bar-fill { animation:bar-grow 0.8s ease both; }
.score-arc { animation:score-spin 1.2s ease both; }
`;

const SECTOR_BENCHMARKS = {
  'E-Ticaret':   { roas:2.9,  cpa:85,  ctr:2.5, convRate:2.8 },
  'Finans':      { roas:2.1,  cpa:220, ctr:1.8, convRate:1.5 },
  'Perakende':   { roas:3.2,  cpa:65,  ctr:2.8, convRate:3.1 },
  'Teknoloji':   { roas:2.5,  cpa:150, ctr:1.9, convRate:2.1 },
  'Sağlık':      { roas:2.3,  cpa:130, ctr:2.0, convRate:2.0 },
  'Turizm':      { roas:2.7,  cpa:95,  ctr:2.3, convRate:2.4 },
  'Eğitim':      { roas:2.0,  cpa:110, ctr:2.2, convRate:1.8 },
  'Otomotiv':    { roas:1.8,  cpa:180, ctr:1.5, convRate:1.2 },
  'Gayrimenkul': { roas:1.9,  cpa:250, ctr:1.4, convRate:1.0 },
};
const DEFAULT_BENCH = { roas:2.5, cpa:120, ctr:2.2, convRate:2.5 };

const PLATFORM_BENCHMARKS = {
  google_ads: { roas:3.5, cpa:90,  ctr:2.8, convRate:3.5 },
  meta:       { roas:2.8, cpa:95,  ctr:1.5, convRate:2.2 },
  tiktok:     { roas:2.2, cpa:75,  ctr:1.0, convRate:1.8 },
};
const PLATFORM_LABELS = { google_ads:'Google Ads', meta:'Meta Ads', tiktok:'TikTok Ads', google_analytics:'Google Analytics', linkedin:'LinkedIn', adform:'Adform' };
const PLATFORM_COLORS = { google_ads:'#4285F4', meta:'#1877F2', tiktok:'#69C9D0', google_analytics:'#E37400', linkedin:'#0A66C2', adform:'#FF6B00' };

const EXAMPLE_METRICS = { roas:3.84, cpa:102, ctr:2.1, convRate:3.2 };

const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const fmtPct = (n) => n != null ? `%${Number(n).toFixed(1)}` : '—';

function computeScore(metrics, bench) {
  const scores = [];
  if (metrics.roas != null && bench.roas > 0) scores.push(Math.min(100, (metrics.roas / bench.roas) * 100));
  if (metrics.cpa  != null && metrics.cpa > 0 && bench.cpa > 0) scores.push(Math.min(100, (bench.cpa / metrics.cpa) * 100));
  if (metrics.ctr  != null && bench.ctr > 0) scores.push(Math.min(100, (metrics.ctr / bench.ctr) * 100));
  if (metrics.convRate != null && bench.convRate > 0) scores.push(Math.min(100, (metrics.convRate / bench.convRate) * 100));
  if (!scores.length) return 50;
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

function diffLabel(yours, bench, higherBetter = true) {
  if (yours == null || bench == null || bench === 0) return null;
  const diff = ((yours - bench) / bench) * 100;
  const better = higherBetter ? diff >= 0 : diff <= 0;
  const sign = diff > 0 ? '+' : '';
  return { text: `${sign}%${Math.abs(diff).toFixed(0)}`, better };
}

// ── Inline markdown renderer ──────────────────────────────────────────────────
function RenderMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  const flushList = () => { if (listItems.length) { elements.push(<ul key={`ul-${elements.length}`} style={{margin:'6px 0 10px 16px',padding:0}}>{listItems}</ul>); listItems = []; } };
  const inline = (s, i) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, j) => p.startsWith('**') ? <strong key={j}>{p.slice(2,-2)}</strong> : p);
  };
  lines.forEach((line, i) => {
    if (line.startsWith('### ')) { flushList(); elements.push(<h3 key={i} style={{fontSize:13,fontWeight:700,margin:'14px 0 6px',color:'var(--text1)'}}>{line.slice(4)}</h3>); }
    else if (line.startsWith('## ')) { flushList(); elements.push(<h2 key={i} style={{fontSize:15,fontWeight:700,margin:'18px 0 8px',color:'var(--teal)'}}>{line.slice(3)}</h2>); }
    else if (line.startsWith('# ')) { flushList(); elements.push(<h1 key={i} style={{fontSize:18,fontWeight:800,margin:'20px 0 10px'}}>{line.slice(2)}</h1>); }
    else if (line.match(/^[-*] /)) { listItems.push(<li key={i} style={{fontSize:13,color:'var(--text2)',marginBottom:4,lineHeight:1.6}}>{inline(line.slice(2))}</li>); }
    else if (line.match(/^\d+\. /)) { listItems.push(<li key={i} style={{fontSize:13,color:'var(--text2)',marginBottom:4,lineHeight:1.6}}>{inline(line.replace(/^\d+\. /,''))}</li>); }
    else { flushList(); if (line.trim()) elements.push(<p key={i} style={{fontSize:13,color:'var(--text2)',lineHeight:1.7,margin:'4px 0'}}>{inline(line)}</p>); }
  });
  flushList();
  return <>{elements}</>;
}

// ── Gauge SVG ─────────────────────────────────────────────────────────────────
function Gauge({ score }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(score), 100); return () => clearTimeout(t); }, [score]);
  const r = 60, circumference = Math.PI * r;
  const dash = (animated / 100) * circumference;
  const color = score < 40 ? '#ef4444' : score < 70 ? '#f59e0b' : '#00BFA6';
  const rank = score >= 80 ? 'üst %20' : score >= 60 ? 'üst %40' : score >= 40 ? 'orta %50' : 'alt %60';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
      <svg viewBox="0 0 140 82" width="180" height="104" style={{ overflow:'visible' }}>
        <path d="M 10 72 A 60 60 0 0 1 130 72" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 10 72 A 60 60 0 0 1 130 72" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition:'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
        <text x="70" y="60" textAnchor="middle" fill="white" fontSize="26" fontWeight="800">{score}</text>
        <text x="70" y="75" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10">/ 100</text>
      </svg>
      <div style={{ fontSize:12, color, fontWeight:700 }}>Sektörün {rank}inde</div>
    </div>
  );
}

// ── Comparison bar ────────────────────────────────────────────────────────────
function CompBar({ label, yours, yourLabel, bench, benchLabel, higherBetter = true, color = 'var(--teal)', isExample = false }) {
  const maxVal = Math.max(yours ?? 0, bench ?? 0, 0.001) * 1.25;
  const yourPct = ((yours ?? 0) / maxVal) * 100;
  const benchPct = ((bench ?? 0) / maxVal) * 100;
  const diff = diffLabel(yours, bench, higherBetter);
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
        {diff && (
          <span style={{ fontSize:12, fontWeight:700, color: diff.better ? 'var(--teal)' : '#f59e0b', background: diff.better ? 'rgba(0,191,166,0.1)' : 'rgba(245,158,11,0.1)', borderRadius:5, padding:'2px 8px' }}>
            {diff.text} {diff.better ? '✓' : '⚠'}
          </span>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, opacity: isExample ? 0.55 : 1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--text3)', minWidth:55 }}>Sizin</span>
          <div style={{ flex:1, height:8, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden', position:'relative' }}>
            <div className="bm-bar-fill" style={{ '--w':`${yourPct}%`, height:'100%', background:color, borderRadius:4, animationDelay:'0.2s' }} />
          </div>
          <span style={{ fontSize:12, fontWeight:700, fontFamily:'var(--mono)', minWidth:60, textAlign:'right' }}>{yourLabel}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, color:'var(--text3)', minWidth:55 }}>Sektör</span>
          <div style={{ flex:1, height:8, background:'rgba(255,255,255,0.06)', borderRadius:4, overflow:'hidden', position:'relative' }}>
            <div className="bm-bar-fill" style={{ '--w':`${benchPct}%`, height:'100%', background:'rgba(255,255,255,0.2)', borderRadius:4, animationDelay:'0.4s' }} />
          </div>
          <span style={{ fontSize:12, color:'var(--text3)', fontFamily:'var(--mono)', minWidth:60, textAlign:'right' }}>{benchLabel}</span>
        </div>
      </div>
    </div>
  );
}

// ── Hero section ──────────────────────────────────────────────────────────────
function HeroSection({ sector, onNavSettings }) {
  return (
    <div style={{
      background:'linear-gradient(135deg, #0f1520 0%, #121d30 50%, #0f1520 100%)',
      borderRadius:16, padding:'48px 48px', marginBottom:24, position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'absolute', top:-80, right:-80, width:340, height:340, borderRadius:'50%', background:'rgba(0,191,166,0.06)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(96,165,250,0.05)', pointerEvents:'none' }} />
      <div style={{ display:'flex', gap:48, alignItems:'center', flexWrap:'wrap', position:'relative' }}>
        <div style={{ flex:'0 0 auto', maxWidth:500 }}>
          <div className="bm-in" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,191,166,0.1)', border:'1px solid rgba(0,191,166,0.25)', borderRadius:20, padding:'4px 12px', marginBottom:20 }}>
            <span style={{ fontSize:12 }}>📊</span>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--teal)', letterSpacing:'0.6px', textTransform:'uppercase' }}>Sektör Karşılaştırması</span>
          </div>
          <h1 className="bm-in" style={{ fontSize:36, fontWeight:800, lineHeight:1.2, margin:'0 0 16px', animationDelay:'0.1s' }}>
            Sektör Benchmark<br />
            <span style={{ color:'var(--teal)' }}>Analizi</span>
          </h1>
          <p className="bm-in" style={{ fontSize:15, color:'var(--text2)', lineHeight:1.7, margin:'0 0 24px', animationDelay:'0.2s' }}>
            Reklamlarınızın sektör ortalamasına göre nerede durduğunu görün, rekabette öne geçin.
          </p>
          {!sector ? (
            <div className="bm-in" style={{ display:'inline-flex', alignItems:'center', gap:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'10px 16px', animationDelay:'0.3s' }}>
              <span style={{ fontSize:13, color:'#f59e0b' }}>⚠ Benchmark için sektörünüzü belirleyin</span>
              {onNavSettings && (
                <button onClick={() => onNavSettings('settings')} style={{ padding:'5px 12px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.4)', borderRadius:6, color:'#f59e0b', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>
                  Ayarlara Git →
                </button>
              )}
            </div>
          ) : (
            <div className="bm-in" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(0,191,166,0.08)', border:'1px solid rgba(0,191,166,0.25)', borderRadius:10, padding:'8px 14px', animationDelay:'0.3s' }}>
              <span style={{ fontSize:14 }}>🏷️</span>
              <span style={{ fontSize:13, fontWeight:600 }}>Sektör: <strong style={{ color:'var(--teal)' }}>{sector}</strong></span>
            </div>
          )}
        </div>
        <div className="bm-in" style={{ flex:1, minWidth:200, display:'flex', flexDirection:'column', gap:12, animationDelay:'0.25s' }}>
          {[
            { label:'Benchmark Metrikleri', val:'4', note:'ROAS, CPA, CTR, Conv. Rate' },
            { label:'Platform Bazlı Analiz', val:'3+', note:'Google, Meta, TikTok' },
            { label:'AI Destekli Öneriler', val:'∞', note:'Kişiselleştirilmiş tavsiyeler' },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:22, fontWeight:800, color:'var(--teal)', minWidth:36 }}>{s.val}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:600 }}>{s.label}</div>
                <div style={{ fontSize:11, color:'var(--text3)' }}>{s.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Metrics table row ─────────────────────────────────────────────────────────
function MetricsTable({ metrics, bench, isExample }) {
  const rows = [
    { key:'roas', label:'ROAS', yours: metrics.roas, bench: bench.roas, yourFmt: metrics.roas != null ? `${metrics.roas.toFixed(2)}x` : '—', benchFmt:`${bench.roas}x`, higher:true },
    { key:'cpa',  label:'CPA',  yours: metrics.cpa,  bench: bench.cpa,  yourFmt: metrics.cpa  != null ? `₺${fmt(metrics.cpa.toFixed(0))}`  : '—', benchFmt:`₺${bench.cpa}`, higher:false },
    { key:'ctr',  label:'CTR',  yours: metrics.ctr,  bench: bench.ctr,  yourFmt: metrics.ctr  != null ? fmtPct(metrics.ctr)  : '—', benchFmt:fmtPct(bench.ctr), higher:true },
    { key:'conv', label:'Conv. Rate', yours: metrics.convRate, bench: bench.convRate, yourFmt: metrics.convRate != null ? fmtPct(metrics.convRate) : '—', benchFmt:fmtPct(bench.convRate), higher:true },
  ];
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, overflow:'hidden', opacity: isExample ? 0.7 : 1 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'10px 18px', borderBottom:'1px solid var(--border2)', fontSize:11, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
        <div>Metrik</div><div>Sizin</div><div>Sektör Ort.</div><div>Fark</div>
      </div>
      {rows.map((r, i) => {
        const d = diffLabel(r.yours, r.bench, r.higher);
        return (
          <div key={r.key} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', padding:'12px 18px', borderBottom: i < rows.length-1 ? '1px solid var(--border2)' : 'none', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{r.label}</div>
            <div style={{ fontSize:14, fontWeight:700, fontFamily:'var(--mono)', color:r.yours != null ? 'var(--text1)' : 'var(--text3)' }}>{r.yourFmt}</div>
            <div style={{ fontSize:13, color:'var(--text3)', fontFamily:'var(--mono)' }}>{r.benchFmt}</div>
            <div>
              {d ? (
                <span style={{ fontSize:12, fontWeight:700, color: d.better ? 'var(--teal)' : '#f59e0b', background: d.better ? 'rgba(0,191,166,0.1)' : 'rgba(245,158,11,0.1)', borderRadius:5, padding:'2px 7px' }}>
                  {d.text} {d.better ? '✓' : '⚠'}
                </span>
              ) : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
            </div>
          </div>
        );
      })}
      {isExample && <div style={{ textAlign:'center', padding:'8px', fontSize:11, color:'var(--text3)', background:'rgba(255,255,255,0.02)' }}>Örnek değerler — entegrasyon bağlandığında gerçek veriniz görünür</div>}
    </div>
  );
}

// ── AI analysis section ───────────────────────────────────────────────────────
function AiAnalysisSection({ metrics, sector }) {
  const [state, setState] = useState('idle'); // idle | loading | streaming | done | error
  const [output, setOutput] = useState('');
  const readerRef = useRef(null);

  const start = async () => {
    setState('loading'); setOutput('');
    try {
      const res = await benchmarkAnalyze(metrics, sector);
      if (!res.ok) { setState('error'); setOutput('API hatası. Lütfen tekrar deneyin.'); return; }
      setState('streaming');
      const reader = res.body.getReader();
      readerRef.current = reader;
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() || '';
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (json === '[DONE]') { setState('done'); return; }
          try {
            const { text, error } = JSON.parse(json);
            if (error) { setState('error'); setOutput(error); return; }
            if (text) setOutput(prev => prev + text);
          } catch {}
        }
      }
      setState('done');
    } catch (err) { setState('error'); setOutput(err.message); }
  };

  return (
    <div className="bm-in" style={{ background:'var(--bg2)', border:'1px solid rgba(0,191,166,0.25)', borderRadius:14, padding:'24px 26px', animationDelay:'0.3s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: state === 'idle' ? 0 : 16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>🤖 AI ile Derin Analiz</div>
          <div style={{ fontSize:12, color:'var(--text3)' }}>Rakiplerinize göre nerede güçlü, nerede geliştirilmeli?</div>
        </div>
        <button
          onClick={start}
          disabled={state === 'loading' || state === 'streaming'}
          style={{
            padding:'10px 22px', background: state === 'done' ? 'transparent' : 'var(--teal)',
            border: state === 'done' ? '1px solid var(--teal)' : 'none',
            borderRadius:9, color: state === 'done' ? 'var(--teal)' : '#0B1219',
            fontSize:13, fontWeight:700, cursor: (state === 'loading' || state === 'streaming') ? 'not-allowed' : 'pointer',
            fontFamily:'var(--font)', opacity: (state === 'loading' || state === 'streaming') ? 0.6 : 1,
            display:'flex', alignItems:'center', gap:8, transition:'all 0.2s ease',
          }}>
          {state === 'loading' && <><span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" /></>}
          {state === 'loading'   ? 'Analiz Başlatılıyor...'
          : state === 'streaming' ? 'Analiz Yazılıyor...'
          : state === 'done'      ? '↺ Yenile'
          : '✦ Analiz Başlat'}
        </button>
      </div>

      {(state === 'streaming' || state === 'done') && output && (
        <div style={{ borderTop:'1px solid rgba(0,191,166,0.15)', paddingTop:18, marginTop:4 }}>
          <RenderMarkdown text={output} />
          {state === 'streaming' && <span className="ai-cursor" />}
        </div>
      )}
      {state === 'error' && output && (
        <div style={{ marginTop:12, fontSize:13, color:'var(--coral)', background:'rgba(255,107,90,0.1)', border:'1px solid rgba(255,107,90,0.2)', borderRadius:8, padding:'10px 14px' }}>⚠ {output}</div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Benchmark({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const [data, setData] = useState(null);
  const [sector, setSector] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overall');

  const brandId = isAgency ? selectedBrand?.id : undefined;

  const load = useCallback(() => {
    if (isAgency && !selectedBrand) { setLoading(false); return; }
    setLoading(true);
    const dataReq = isAgency ? getAgencyBrandDetail(brandId) : getBrandDashboard();
    const settingsReq = getSettings(brandId).catch(() => null);
    Promise.all([dataReq.catch(() => null), settingsReq])
      .then(([d, settings]) => { setData(d); setSector(settings?.sector || null); })
      .finally(() => setLoading(false));
  }, [isAgency, brandId]);

  useEffect(() => { setData(null); setSector(null); setLoading(true); load(); }, [load]);

  if (isAgency && !selectedBrand) {
    return (
      <div className="fade-in">
        <style>{ANIM_CSS}</style>
        <div className="topbar"><div className="topbar-title">Benchmark</div></div>
        <div className="content">
          <HeroSection sector={null} onNavSettings={onNav} />
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👈</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Önce bir müşteri seçin</div>
            <div style={{ fontSize:13, color:'var(--text3)' }}>Sol menüden <strong>Müşteri Yönetimi</strong>'ne giderek bir marka seçin.</div>
          </div>
        </div>
      </div>
    );
  }

  const title = isAgency && selectedBrand ? `${selectedBrand.company_name || selectedBrand.name} — Benchmark` : 'Benchmark';

  if (loading) return (
    <div className="fade-in">
      <style>{ANIM_CSS}</style>
      <div className="topbar"><div className="topbar-title">{title}</div></div>
      <div className="loading">Yükleniyor...</div>
    </div>
  );

  // Compute metrics from dashboard data
  const integrations = data?.integrations || [];
  const summary = data?.summary || {};
  const totalImpressions = integrations.reduce((s, i) => s + parseInt(i.total_impressions || 0), 0);
  const hasData = integrations.length > 0 && Number(summary.total_spend) > 0;

  const computedMetrics = hasData ? {
    roas:     summary.avg_roas > 0 ? Number(summary.avg_roas) : null,
    cpa:      summary.total_conversions > 0 ? Number(summary.total_spend) / Number(summary.total_conversions) : null,
    ctr:      totalImpressions > 0 ? (Number(summary.total_clicks) / totalImpressions) * 100 : null,
    convRate: summary.total_clicks > 0 ? (Number(summary.total_conversions) / Number(summary.total_clicks)) * 100 : null,
    spend:    Number(summary.total_spend),
  } : EXAMPLE_METRICS;

  const isExample = !hasData;
  const bench = SECTOR_BENCHMARKS[sector] || DEFAULT_BENCH;
  const score = computeScore(computedMetrics, bench);

  const TABS = [
    { key:'overall', label:'Genel' },
    ...integrations.filter(i => PLATFORM_BENCHMARKS[i.platform]).map(i => ({ key:i.platform, label: PLATFORM_LABELS[i.platform] || i.platform })),
  ];

  const tabMetrics = activeTab === 'overall' ? computedMetrics : (() => {
    const integ = integrations.find(i => i.platform === activeTab);
    if (!integ) return EXAMPLE_METRICS;
    const spend = Number(integ.total_spend);
    const conv  = Number(integ.total_conversions);
    const clicks = Number(integ.total_clicks);
    const impr  = Number(integ.total_impressions || 0);
    return {
      roas:     Number(integ.avg_roas) > 0 ? Number(integ.avg_roas) : null,
      cpa:      conv  > 0 ? spend / conv   : null,
      ctr:      impr  > 0 ? (clicks / impr) * 100 : null,
      convRate: clicks > 0 ? (conv / clicks) * 100  : null,
    };
  })();
  const tabBench = activeTab === 'overall' ? bench : (PLATFORM_BENCHMARKS[activeTab] || bench);

  return (
    <div className="fade-in">
      <style>{ANIM_CSS}</style>
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        {sector && <div className="topbar-right"><span style={{ fontSize:12, color:'var(--text3)', background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, padding:'4px 10px' }}>📌 {sector}</span></div>}
      </div>
      <div className="content">
        <HeroSection sector={sector} onNavSettings={onNav} />

        {isExample && (
          <div style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'11px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'center' }}>
            <span>⚠️</span>
            <span style={{ fontSize:13, color:'#f59e0b' }}>Reklam hesabı bağlanmadığı için aşağıda örnek veriler gösteriliyor. Entegrasyonlar sayfasından hesabınızı bağlayın.</span>
            {onNav && <button onClick={() => onNav('integrations')} style={{ marginLeft:'auto', padding:'5px 12px', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)', borderRadius:6, color:'#f59e0b', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)', whiteSpace:'nowrap' }}>Entegrasyona Git →</button>}
          </div>
        )}

        {/* Score + comparison bars */}
        <div className="bm-in" style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:20, marginBottom:20, animationDelay:'0.05s' }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'22px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
            <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8, textAlign:'center', fontWeight:600 }}>PERFORMANS SKORU</div>
            <Gauge score={score} />
            {sector && <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', marginTop:6 }}>{sector} sektörüne göre</div>}
          </div>

          <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'22px 26px' }}>
            <CompBar label="ROAS (Reklam Getirisi)"
              yours={computedMetrics.roas} yourLabel={computedMetrics.roas != null ? `${computedMetrics.roas.toFixed(2)}x` : '—'}
              bench={bench.roas} benchLabel={`${bench.roas}x`} higherBetter color="#4285F4" isExample={isExample} />
            <CompBar label="CPA (Dönüşüm Maliyeti)"
              yours={computedMetrics.cpa} yourLabel={computedMetrics.cpa != null ? `₺${Number(computedMetrics.cpa).toFixed(0)}` : '—'}
              bench={bench.cpa} benchLabel={`₺${bench.cpa}`} higherBetter={false} color="#A78BFA" isExample={isExample} />
          </div>
        </div>

        <div className="bm-in" style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'22px 26px', marginBottom:20, animationDelay:'0.1s' }}>
          <CompBar label="CTR (Tıklama Oranı)"
            yours={computedMetrics.ctr} yourLabel={computedMetrics.ctr != null ? fmtPct(computedMetrics.ctr) : '—'}
            bench={bench.ctr} benchLabel={fmtPct(bench.ctr)} higherBetter color="var(--teal)" isExample={isExample} />
          <CompBar label="Dönüşüm Oranı"
            yours={computedMetrics.convRate} yourLabel={computedMetrics.convRate != null ? fmtPct(computedMetrics.convRate) : '—'}
            bench={bench.convRate} benchLabel={fmtPct(bench.convRate)} higherBetter color="#F59E0B" isExample={isExample} />
        </div>

        {/* Platform tabs + metrics table */}
        <div className="bm-in" style={{ marginBottom:20, animationDelay:'0.15s' }}>
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
            {TABS.map(t => (
              <button key={t.key} className={`platform-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:0 }}>
            {activeTab !== 'overall' && (
              <div style={{ background:'rgba(255,255,255,0.02)', border:'1px solid var(--border2)', borderRadius:'12px 12px 0 0', borderBottom:'none', padding:'11px 18px', fontSize:12, color:'var(--text3)' }}>
                <strong style={{ color: PLATFORM_COLORS[activeTab] || 'var(--teal)' }}>{PLATFORM_LABELS[activeTab]}</strong> sektör ortalamasına göre
              </div>
            )}
            <MetricsTable metrics={tabMetrics} bench={tabBench} isExample={isExample} />
          </div>
        </div>

        {/* AI analysis */}
        <AiAnalysisSection metrics={computedMetrics} sector={sector || 'Genel'} />
      </div>
    </div>
  );
}
