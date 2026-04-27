import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getIntegrations, getReports, saveReport as apiSaveReport, deleteReport as apiDeleteReport } from '../api';

// ── Constants ──────────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { id: 'performance', icon: '📊', title: 'Performans Raporu',       cta: 'Rapor Oluştur', color: '#00BFA6', desc: 'Son dönemin tüm kanallar özeti, trend analizi ve iyileştirme önerileri' },
  { id: 'budget',      icon: '💰', title: 'Bütçe Optimizasyonu',     cta: 'Analiz Et',     color: '#A78BFA', desc: 'Bütçenizi en verimli kanallara nasıl dağıtmalısınız?' },
  { id: 'benchmark',   icon: '🏆', title: 'Rakip & Benchmark',       cta: 'Karşılaştır',   color: '#F59E0B', desc: 'Sektör ortalamasıyla karşılaştırma, nerede öne nerede geride olduğunuz' },
  { id: 'period',      icon: '📅', title: 'Dönem Karşılaştırması',   cta: 'Karşılaştır',   color: '#3B82F6', desc: 'Bu ay vs geçen ay, Q1 vs Q2 detaylı karşılaştırma raporu' },
  { id: 'channel',     icon: '🎯', title: 'Kanal Etkinlik Analizi',  cta: 'Analiz Et',     color: '#EC4899', desc: 'Hangi kanal size en çok değer katıyor? ROI bazlı kanal sıralaması' },
  { id: 'forecast',    icon: '🔮', title: 'Öngörü Raporu',           cta: 'Öngörü Al',     color: '#14B8A6', desc: 'Mevcut trende göre önümüzdeki dönemde ne beklemeniz gerekir?' },
];

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};

const MOCK_REPORT = `## Yönetici Özeti
Google Ads kanalınız sektör ortalamasının **%23 üzerinde** ROAS üretiyor ve kampanya verimliliği son 30 günde istikrarlı seyrediyor. Meta Ads'de CPA son 2 haftada %18 artış gösterdi — bu acil müdahale gerektiren bir sinyal. TikTok, düşük bütçeyle yüksek erişim sağlıyor.

## Detaylı Analiz

**Google Ads:** ROAS 4.8x ile en güçlü kanal. Remarketing kampanyaları ₺42 CPA ile dönüşüm hedefinin %15 altında. Search impression share %68 — büyüme potansiyeli var.

**Meta Ads:** Reach kampanyaları iyi çalışıyor ancak conversion campaign CPA'sı ₺127'ye yükseldi. Creative fatigue belirtileri gözlemleniyor, kreatif yenileme gerekli.

**TikTok Ads:** CTR %4.2 ile benchmark üzerinde. ₺18K harcamayla 2.1x ROAS — düşük bütçe için iyi performans.

## Öneriler
1. **Meta creativelarını yenileyin** — mevcut görseller 3+ haftadır yayında, CTR düşüşü başladı
2. **Google Search bütçesini %20 artırın** — ROAS güçlü, kapasite var
3. **TikTok A/B testi başlatın** — 2 farklı hedefleme stratejisini karşılaştırın

## Sonuç
Genel skor güçlü. Meta'daki CPA artışı dışında performans tatmin edici. Önümüzdeki 2 haftada Meta optimizasyonuna odaklanın.`;

const ANIM_CSS = `
@keyframes growBar {
  from { transform: scaleY(0); transform-origin: bottom; }
  to   { transform: scaleY(1); transform-origin: bottom; }
}
@keyframes slideUpCard {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes aiPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes typingDot {
  0%, 80%, 100% { transform: scale(0); }
  40%            { transform: scale(1); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.report-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
}
.report-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
`;

// ── Hero mini-dashboard ────────────────────────────────────────────────────────

function HeroDashboard() {
  const bars = [52, 68, 75, 60, 88, 72, 95];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 16, padding: 20, width: 280, backdropFilter: 'blur(10px)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.5px' }}>
        KAMPANYA PERFORMANSI
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ l: 'ROAS', v: '4.2x', up: true }, { l: 'CTR', v: '2.8%', up: true }, { l: 'CPA', v: '₺42', up: false }].map(m => (
          <div key={m.l} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{m.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{m.v}</div>
            <div style={{ fontSize: 9, color: m.up ? '#00BFA6' : '#FF6B5A' }}>{m.up ? '↑' : '↓'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56, marginBottom: 12 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0',
            background: `linear-gradient(to top, #00BFA6, #7C3AED)`,
            animation: `growBar 0.5s ease-out ${i * 0.08}s both`,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['G Ads', 'Meta', 'TikTok', 'LinkedIn'].map(p => (
          <span key={p} style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.6)' }}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Hero section ───────────────────────────────────────────────────────────────

function HeroSection({ onQuickAnalysis, onCustomReport }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1522 0%, #130926 55%, #091c2e 100%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '64px 40px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 40, overflow: 'hidden', position: 'relative',
    }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,191,166,0.07) 0%, transparent 70%)', top: -150, right: 80, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)', bottom: -60, left: 200, pointerEvents: 'none' }} />
      <div style={{ flex: 1, maxWidth: 520, position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,191,166,0.1)', border: '1px solid rgba(0,191,166,0.25)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00BFA6', animation: 'aiPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, color: '#00BFA6', fontWeight: 600, letterSpacing: '0.5px' }}>Claude AI ile Güçlendirildi</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px', color: '#fff' }}>
          Yapay Zeka Destekli<br />
          <span style={{ background: 'linear-gradient(90deg, #00BFA6, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Reklam Analitiği
          </span>
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 32px' }}>
          Claude AI ile kampanyalarınızı derinlemesine analiz edin, rakiplerinizin önüne geçin. Saniyeler içinde profesyonel raporlar alın.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onQuickAnalysis} style={{ padding: '13px 28px', background: 'linear-gradient(135deg, #00BFA6, #0097a7)', border: 'none', borderRadius: 10, color: '#0B1219', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            ⚡ Hızlı Analiz Yap
          </button>
          <button onClick={onCustomReport} style={{ padding: '13px 28px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Özel Rapor Oluştur
          </button>
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <HeroDashboard />
      </div>
    </div>
  );
}

// ── Report type card ───────────────────────────────────────────────────────────

function ReportTypeCard({ type, onSelect, index }) {
  return (
    <div className="report-card" onClick={onSelect} style={{
      background: 'var(--bg2)', border: '1px solid var(--border2)',
      borderRadius: 14, padding: 24, cursor: 'pointer',
      animation: `slideUpCard 0.5s ease-out ${index * 0.08}s both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{type.icon}</span>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: type.color, marginTop: 4 }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--text1)' }}>{type.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 18 }}>{type.desc}</div>
      <button style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${type.color}40`, borderRadius: 7, color: type.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', width: '100%', transition: 'background 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = `${type.color}18`; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        {type.cta} →
      </button>
    </div>
  );
}

// ── Live demo section ──────────────────────────────────────────────────────────

function MockReportDemo({ onNav }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 400); return () => clearTimeout(t); }, []);

  return (
    <div style={{ padding: '56px 40px', background: 'linear-gradient(180deg, var(--bg) 0%, rgba(0,191,166,0.03) 100%)', borderTop: '1px solid var(--border)' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Nasıl Çalışır?</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>AI'ın Nasıl Çalıştığını Görün</div>
        <div style={{ fontSize: 14, color: 'var(--text3)' }}>Gerçek reklam verilerinizle bu kalitede analiz alın</div>
      </div>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16,
          overflow: 'hidden', opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease',
        }}>
          <div style={{ background: 'rgba(0,191,166,0.08)', borderBottom: '1px solid var(--border2)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>AI Analiz Raporu — Örnek Çıktı</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Bu bir örnek çıktıdır — gerçek verinizle çok daha detaylı olur</div>
            </div>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <RenderMarkdown text={MOCK_REPORT} />
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>
            Kendi verilerinizle analiz almak için reklam hesabınızı bağlayın
          </div>
          <button onClick={() => onNav?.('integrations')} style={{ padding: '11px 28px', background: 'var(--teal)', border: 'none', borderRadius: 9, color: '#0B1219', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Entegrasyonlara Git →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

function RenderMarkdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { elements.push(<div key={key++} style={{ height: 10 }} />); continue; }
    if (line.startsWith('# '))  { elements.push(<h1 key={key++} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text1)', margin: '20px 0 8px', borderBottom: '2px solid var(--teal)', paddingBottom: 8 }}>{renderInline(line.slice(2))}</h1>); continue; }
    if (line.startsWith('## ')) { elements.push(<h2 key={key++} style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', margin: '16px 0 6px' }}>{renderInline(line.slice(3))}</h2>); continue; }
    if (line.startsWith('### ')){ elements.push(<h3 key={key++} style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', margin: '12px 0 4px' }}>{renderInline(line.slice(4))}</h3>); continue; }
    const listMatch = line.match(/^(\d+)\.\s+(.+)/) || line.match(/^[•\-]\s+(.+)/);
    if (listMatch) {
      const content = listMatch[2] || listMatch[1];
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 4 }}>
          <span style={{ color: 'var(--teal)', fontWeight: 700, flexShrink: 0 }}>{line.match(/^\d+\./) ? line.match(/^(\d+)\./)[1] + '.' : '•'}</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }
    elements.push(<p key={key++} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8, margin: '0 0 6px' }}>{renderInline(line)}</p>);
  }
  return <>{elements}</>;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: 'var(--text1)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      : p
  );
}

// ── Wizard components ──────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = ['Tarih Aralığı', 'Kanallar', 'Rapor Tipi', 'Hedef Kitle'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 8 }}>
      {steps.map((s, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--teal)' : active ? 'linear-gradient(135deg, #00BFA6, #7C3AED)' : 'var(--bg3)',
                border: active ? 'none' : done ? 'none' : '1px solid var(--border2)',
                color: done || active ? '#0B1219' : 'var(--text3)',
                fontSize: 13, fontWeight: 700,
              }}>
                {done ? '✓' : num}
              </div>
              <div style={{ fontSize: 10, color: active ? 'var(--teal)' : done ? 'var(--text2)' : 'var(--text3)', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>
                {s}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? 'var(--teal)' : 'var(--border2)', margin: '0 8px', marginBottom: 22 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepDateRange({ value, onChange, onNext }) {
  const options = [{ v: 7, l: '7 Gün' }, { v: 14, l: '14 Gün' }, { v: 30, l: '30 Gün' }, { v: 60, l: '60 Gün' }, { v: 90, l: '90 Gün' }];
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text1)' }}>Analiz dönemi seçin</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        {options.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '12px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: value === o.v ? 'linear-gradient(135deg, #00BFA6, #0097a7)' : 'var(--bg3)',
            color: value === o.v ? '#0B1219' : 'var(--text2)',
            fontWeight: value === o.v ? 700 : 400, fontSize: 14, fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}>
            {o.l}
          </button>
        ))}
      </div>
      <WizardNav onNext={onNext} />
    </div>
  );
}

function StepChannels({ platforms, selected, onChange, onPrev, onNext, onNav }) {
  const toggle = (id) => onChange(prev =>
    prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
  );
  const allSelected = platforms.length > 0 && selected.length === platforms.length;
  const toggleAll = () => onChange(allSelected ? [] : platforms.map(p => p.platform));

  if (platforms.length === 0) {
    return (
      <div>
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F59E0B', marginBottom: 6 }}>⚠️ Bağlı reklam hesabı bulunamadı</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>AI genel pazarlama önerileri sunabilir. Gerçek verinizle analiz için entegrasyon bağlayın.</div>
          <button onClick={() => onNav?.('integrations')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #F59E0B', borderRadius: 7, color: '#F59E0B', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            Entegrasyonlara Git →
          </button>
        </div>
        <WizardNav onPrev={onPrev} onNext={onNext} nextLabel="Verisiz Devam Et →" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Kanalları seçin</div>
        <button onClick={toggleAll} style={{ fontSize: 12, color: 'var(--teal)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
          {allSelected ? 'Tümünü kaldır' : 'Tümünü seç'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 28 }}>
        {platforms.map(p => {
          const checked = selected.includes(p.platform);
          return (
            <div key={p.id} onClick={() => toggle(p.platform)} style={{
              padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: checked ? 'rgba(0,191,166,0.1)' : 'var(--bg3)',
              border: checked ? '1px solid rgba(0,191,166,0.4)' : '1px solid var(--border2)',
              display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: checked ? 'none' : '1.5px solid var(--border2)', background: checked ? 'var(--teal)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {checked && <span style={{ color: '#0B1219', fontSize: 10, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: checked ? 700 : 400, color: checked ? 'var(--teal)' : 'var(--text2)' }}>
                {PLATFORM_LABELS[p.platform] || p.platform}
              </span>
            </div>
          );
        })}
      </div>
      {selected.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Kanal seçilmezse tüm kanallar dahil edilir.</div>
      )}
      <WizardNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

function StepReportType({ value, onChange, onPrev, onNext }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text1)' }}>Rapor tipi seçin</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
        {REPORT_TYPES.map(rt => {
          const active = value === rt.id;
          return (
            <div key={rt.id} onClick={() => onChange(rt.id)} style={{
              padding: '16px', borderRadius: 10, cursor: 'pointer',
              background: active ? `${rt.color}14` : 'var(--bg3)',
              border: active ? `1.5px solid ${rt.color}60` : '1px solid var(--border2)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{rt.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: active ? rt.color : 'var(--text2)', lineHeight: 1.3 }}>{rt.title}</div>
            </div>
          );
        })}
      </div>
      <WizardNav onPrev={onPrev} onNext={onNext} nextDisabled={!value} />
    </div>
  );
}

function StepAudience({ value, onChange, onPrev, onGenerate, generating, reportType }) {
  const opts = [
    { v: 'brand',  icon: '📋', title: 'Markaya Sunum',  desc: 'Yönetici özeti öne çıkar, stratejik öneriler, sade dil' },
    { v: 'agency', icon: '🔧', title: 'Ajans İçi Rapor', desc: 'Teknik detaylar, tüm metrikler, optimizasyon odaklı' },
  ];
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text1)' }}>Hedef kitleyi belirleyin</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {opts.map(o => {
          const active = value === o.v;
          return (
            <div key={o.v} onClick={() => onChange(o.v)} style={{
              padding: '20px', borderRadius: 12, cursor: 'pointer',
              background: active ? 'rgba(0,191,166,0.08)' : 'var(--bg3)',
              border: active ? '1.5px solid rgba(0,191,166,0.4)' : '1px solid var(--border2)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{o.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--teal)' : 'var(--text1)', marginBottom: 6 }}>{o.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>{o.desc}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onPrev} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          ← Geri
        </button>
        <button onClick={onGenerate} disabled={generating} style={{
          flex: 1, padding: '11px 0', borderRadius: 9, border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
          background: generating ? 'rgba(0,191,166,0.3)' : 'linear-gradient(135deg, #00BFA6, #7C3AED)',
          color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {generating ? (
            <>
              <TypingDots />
              AI Analiz Yapıyor...
            </>
          ) : '✨ Raporu Oluştur'}
        </button>
      </div>
    </div>
  );
}

function WizardNav({ onPrev, onNext, nextDisabled = false, nextLabel = 'İlerle →' }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {onPrev && (
        <button onClick={onPrev} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          ← Geri
        </button>
      )}
      <button onClick={onNext} disabled={nextDisabled} style={{ padding: '11px 28px', background: nextDisabled ? 'var(--bg3)' : 'var(--teal)', border: 'none', borderRadius: 9, color: nextDisabled ? 'var(--text3)' : '#0B1219', fontSize: 13, fontWeight: 700, cursor: nextDisabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)' }}>
        {nextLabel}
      </button>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ── Generated report ───────────────────────────────────────────────────────────

function GeneratedReport({ title, text, generating, saveState, onSave, onPrint }) {
  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)' }}>🤖 AI Raporu</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{title}</div>
        </div>
        {!generating && text && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onPrint} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              📄 PDF İndir
            </button>
            <button onClick={onSave} disabled={saveState !== 'idle'} style={{ padding: '8px 16px', background: saveState === 'saved' ? 'rgba(52,211,153,0.15)' : 'var(--teal)', border: saveState === 'saved' ? '1px solid rgba(52,211,153,0.4)' : 'none', borderRadius: 8, color: saveState === 'saved' ? 'var(--success)' : '#0B1219', fontSize: 12, fontWeight: 700, cursor: saveState === 'idle' ? 'pointer' : 'default', fontFamily: 'var(--font)' }}>
              {saveState === 'saved' ? '✓ Kaydedildi' : saveState === 'saving' ? 'Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        )}
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 14, padding: '28px 32px', minHeight: 200 }}>
        {generating && !text && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text3)', padding: '20px 0' }}>
            <TypingDots />
            <span style={{ fontSize: 13 }}>AI raporunuzu hazırlıyor...</span>
          </div>
        )}
        <RenderMarkdown text={text} />
        {generating && text && (
          <span style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--teal)', animation: 'aiPulse 0.8s ease-in-out infinite', verticalAlign: 'middle', marginLeft: 2 }} />
        )}
      </div>
    </div>
  );
}

// ── Saved reports ──────────────────────────────────────────────────────────────

const REPORT_TYPE_LABEL = { performance: 'Performans', budget: 'Bütçe', benchmark: 'Benchmark', period: 'Dönem', channel: 'Kanal', forecast: 'Öngörü', custom: 'Özel' };

function SavedReports({ reports, loading, onDelete, onPrint }) {
  if (loading) return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Kaydedilen Raporlar</div>
      <div style={{ color: 'var(--text3)', fontSize: 13 }}>Yükleniyor...</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Kaydedilen Raporlar</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{reports.length} rapor</div>
        </div>
      </div>
      {reports.length === 0 ? (
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Henüz rapor oluşturmadınız</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Yukarıdaki rapor oluşturucuyu kullanarak ilk raporunuzu hazırlayın.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                {['Rapor Adı', 'Tip', 'Tarih', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text1)', maxWidth: 360 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(0,191,166,0.12)', color: 'var(--teal)' }}>
                      {REPORT_TYPE_LABEL[r.report_type] || r.report_type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {r.content && (
                        <button onClick={() => onPrint(r)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                          📄 İndir
                        </button>
                      )}
                      <button onClick={() => onDelete(r.id)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 6, color: 'var(--coral)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Auto reports panel ─────────────────────────────────────────────────────────

function AutoReports({ autoWeekly, setAutoWeekly, autoMonthly, setAutoMonthly, autoEmail, setAutoEmail }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 18 }}>⏰</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Otomatik Raporlar</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Düzenli aralıklarla otomatik analiz alın</div>
        </div>
      </div>
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 12, overflow: 'hidden' }}>
        {[
          { key: 'weekly',  label: 'Haftalık Rapor',  desc: 'Her Pazartesi sabahı önceki haftanın analizi', value: autoWeekly,  set: setAutoWeekly },
          { key: 'monthly', label: 'Aylık Rapor',     desc: 'Her ayın 1\'inde önceki ayın kapsamlı analizi', value: autoMonthly, set: setAutoMonthly },
          { key: 'email',   label: 'E-posta Bildirimi', desc: 'Raporlar e-posta adresinize iletilsin',       value: autoEmail,   set: setAutoEmail },
        ].map((item, i) => (
          <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: i < 2 ? '1px solid var(--border2)' : 'none' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.desc}</div>
            </div>
            <button className={`toggle${item.value ? ' on' : ''}`} onClick={() => item.set(v => !v)} />
          </div>
        ))}
      </div>
      {(autoWeekly || autoEmail) && (
        <div style={{ marginTop: 16, background: 'rgba(0,191,166,0.08)', border: '1px solid rgba(0,191,166,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--teal)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>✉️</span>
          <span>Her Pazartesi sabahı raporunuz e-postanıza gelecek. <span style={{ opacity: 0.7 }}>(Yakında aktif olacak)</span></span>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AiReport({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const brandId   = isAgency ? selectedBrand?.id : null;
  const brandName = isAgency ? (selectedBrand?.name || selectedBrand?.company_name) : user?.company_name;

  const wizardRef = useRef(null);
  const outputRef = useRef(null);

  const [integrations, setIntegrations] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Wizard
  const [wizardStep, setWizardStep]         = useState(1);
  const [days, setDays]                     = useState(30);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [reportType, setReportType]         = useState('');
  const [audience, setAudience]             = useState('brand');

  // Generation
  const [generating, setGenerating]   = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [saveState, setSaveState]     = useState('idle');

  // Auto reports
  const [autoWeekly, setAutoWeekly]   = useState(false);
  const [autoMonthly, setAutoMonthly] = useState(false);
  const [autoEmail, setAutoEmail]     = useState(false);

  useEffect(() => {
    setIntegrations([]);
    setSavedReports([]);
    setLoading(true);
    Promise.allSettled([
      getIntegrations(brandId),
      getReports(brandId),
    ]).then(([intRes, repRes]) => {
      if (intRes.status === 'fulfilled') {
        setIntegrations((intRes.value || []).filter(i => i.is_active && i.platform !== 'google_analytics'));
      }
      if (repRes.status === 'fulfilled') setSavedReports(repRes.value || []);
    }).finally(() => setLoading(false));
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToWizard = (type = '') => {
    if (type) setReportType(type);
    setWizardStep(1);
    setGeneratedText('');
    setSaveState('idle');
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const generateReport = async () => {
    const typeLabel = REPORT_TYPES.find(r => r.id === reportType)?.title || 'Rapor';
    const title = `${typeLabel} — ${brandName || user?.company_name || 'Hesap'} — ${new Date().toLocaleDateString('tr-TR')}`;
    setReportTitle(title);
    setGeneratedText('');
    setGenerating(true);
    setSaveState('idle');
    setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days, platforms: selectedPlatforms.length ? selectedPlatforms : null, report_type: reportType, audience, brand_id: brandId }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.error || 'Hata'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        done = d;
        if (value) {
          for (const line of decoder.decode(value).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { done = true; break; }
            try { const { text, error } = JSON.parse(data); if (error) throw new Error(error); if (text) setGeneratedText(p => p + text); } catch {}
          }
        }
      }
    } catch (err) {
      setGeneratedText(`**Hata:** ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveReport = async () => {
    if (!generatedText || saveState !== 'idle') return;
    setSaveState('saving');
    try {
      const saved = await apiSaveReport({ title: reportTitle, content: generatedText, report_type: reportType, brand_id: brandId });
      setSavedReports(p => [{ ...saved, content: generatedText }, ...p]);
      setSaveState('saved');
    } catch { setSaveState('idle'); }
  };

  const handleDeleteReport = async (id) => {
    try { await apiDeleteReport(id); setSavedReports(p => p.filter(r => r.id !== id)); } catch {}
  };

  const printReport = (r) => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.title}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;line-height:1.7;padding:0 24px;color:#111}h1{font-size:22px;border-bottom:2px solid #00BFA6;padding-bottom:10px}h2{font-size:16px;color:#333;margin-top:20px}pre{white-space:pre-wrap;font-family:Arial}</style></head><body><h1>${r.title}</h1><pre>${r.content || ''}</pre><p style="color:#aaa;font-size:12px;margin-top:32px">AdsLands AI Raporu — ${new Date().toLocaleDateString('tr-TR')}</p></body></html>`);
    win.document.close();
    win.onload = () => win.print();
  };

  return (
    <div className="fade-in">
      <style>{ANIM_CSS}</style>
      <div className="topbar">
        <div className="topbar-title">
          AI Raporları
          {isAgency && brandName && (
            <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400, marginLeft: 8 }}>— {brandName}</span>
          )}
        </div>
      </div>

      {/* Content with no side padding (hero goes full width) */}
      <div className="content" style={{ padding: 0 }}>

        {/* 1. HERO */}
        <HeroSection
          onQuickAnalysis={() => scrollToWizard('performance')}
          onCustomReport={() => scrollToWizard()}
        />

        {/* 2. RAPOR TİPLERİ */}
        <div style={{ padding: '56px 40px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Analiz Kataloğu</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Hangi Analizi İstiyorsunuz?</div>
            <div style={{ fontSize: 14, color: 'var(--text3)' }}>İhtiyacınıza göre bir rapor tipi seçin veya özel rapor oluşturun</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 900, margin: '0 auto' }}>
            {REPORT_TYPES.map((rt, i) => (
              <ReportTypeCard key={rt.id} type={rt} onSelect={() => scrollToWizard(rt.id)} index={i} />
            ))}
          </div>
        </div>

        {/* 3. CANLI DEMO */}
        <MockReportDemo onNav={onNav} />

        {/* 4. ÖZEL RAPOR OLUŞTURUCU (Wizard) */}
        <div ref={wizardRef} style={{ padding: '56px 40px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 740, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Özel Rapor</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Özel Rapor Oluştur</div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>Parametreleri belirleyin, AI sizin için kişiselleştirilmiş analiz hazırlasın</div>
            </div>
            <StepIndicator current={wizardStep} />
            <div style={{ marginTop: 36, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 14, padding: '28px 32px' }}>
              {wizardStep === 1 && <StepDateRange value={days} onChange={setDays} onNext={() => setWizardStep(2)} />}
              {wizardStep === 2 && <StepChannels platforms={integrations} selected={selectedPlatforms} onChange={setSelectedPlatforms} onPrev={() => setWizardStep(1)} onNext={() => setWizardStep(3)} onNav={onNav} />}
              {wizardStep === 3 && <StepReportType value={reportType} onChange={setReportType} onPrev={() => setWizardStep(2)} onNext={() => setWizardStep(4)} />}
              {wizardStep === 4 && <StepAudience value={audience} onChange={setAudience} onPrev={() => setWizardStep(3)} onGenerate={generateReport} generating={generating} reportType={reportType} />}
            </div>
          </div>
        </div>

        {/* 5. OLUŞTURULAN RAPOR */}
        {(generatedText || generating) && (
          <div ref={outputRef} style={{ padding: '56px 40px', borderTop: '1px solid var(--border)' }}>
            <div style={{ maxWidth: 740, margin: '0 auto' }}>
              <GeneratedReport
                title={reportTitle}
                text={generatedText}
                generating={generating}
                saveState={saveState}
                onSave={handleSaveReport}
                onPrint={() => printReport({ title: reportTitle, content: generatedText })}
              />
            </div>
          </div>
        )}

        {/* 6. KAYDEDİLEN RAPORLAR */}
        <div style={{ padding: '56px 40px', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <SavedReports
              reports={savedReports}
              loading={loading}
              onDelete={handleDeleteReport}
              onPrint={printReport}
            />
          </div>
        </div>

        {/* 7. OTOMATİK RAPORLAR */}
        <div style={{ padding: '48px 40px 72px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <AutoReports
              autoWeekly={autoWeekly} setAutoWeekly={setAutoWeekly}
              autoMonthly={autoMonthly} setAutoMonthly={setAutoMonthly}
              autoEmail={autoEmail} setAutoEmail={setAutoEmail}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
