import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getIntegrations, getReports, deleteReport as apiDeleteReport } from '../api';

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads', adform: 'Adform', appsflyer: 'AppsFlyer', adjust: 'Adjust',
};

const REPORT_TYPES = [
  {
    id: 'agency',
    icon: '⚙',
    title: 'Ajans Teknik Raporu',
    desc: 'Tüm metrikler, teknik detaylar, optimizasyon odaklı derinlikli analiz',
    color: '#1D9E75',
    badge: 'PPT',
  },
  {
    id: 'brand',
    icon: '📋',
    title: 'Marka Sunum Raporu',
    desc: 'Yönetici özeti öne çıkar, sade dil, görsel ağırlıklı marka sunumu',
    color: '#3B82F6',
    badge: 'PPT',
  },
  {
    id: 'pdf',
    icon: '⚡',
    title: 'Hızlı PDF Özeti',
    desc: 'Kompakt tek sayfa özet, hızlı okuma için tasarlanmış içerik',
    color: '#8B5CF6',
    badge: 'PDF',
  },
];

const ALL_SLIDES = [
  { id: 'cover',           label: 'Kapak Slaytı',      icon: '🎨', required: true },
  { id: 'executive',       label: 'Yönetici Özeti',     icon: '📊', required: true },
  { id: 'channels',        label: 'Kanal Performansı',  icon: '📡' },
  { id: 'trends',          label: 'Trend Grafiği',      icon: '📈' },
  { id: 'benchmark',       label: 'Sektör Benchmark',   icon: '🏆' },
  { id: 'recommendations', label: 'AI Önerileri',       icon: '🤖' },
  { id: 'conclusion',      label: 'Sonuç & Adımlar',    icon: '✅' },
];

const PDF_SLIDES = ['cover', 'executive', 'recommendations'];

const ANIM_STEPS = [
  { icon: '🤖', text: 'AI analiz yapıyor...',       color: '#1D9E75' },
  { icon: '📊', text: 'Grafikler oluşturuluyor...', color: '#3B82F6' },
  { icon: '📑', text: 'Slaytlar hazırlanıyor...',   color: '#8B5CF6' },
  { icon: '✅', text: 'Rapor hazır!',                color: '#10B981' },
];

const ANIM_CSS = `
@keyframes growBar { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes aiPulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
@keyframes typingDot { 0%,80%,100% { transform:scale(0); } 40% { transform:scale(1); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes stepIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
@keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(29,158,117,0.4); } 70% { box-shadow:0 0 0 8px rgba(29,158,117,0); } }
`;

// ── Shared helpers ─────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: `typingDot 1.4s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

// ── Hero mini-dashboard ────────────────────────────────────────────────────────

function HeroDashboard() {
  const bars = [52, 68, 75, 60, 88, 72, 95];
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 20, width: 280, backdropFilter: 'blur(10px)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '0.5px' }}>KAMPANYA PERFORMANSI</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ l: 'ROAS', v: '4.2x', up: true }, { l: 'CTR', v: '2.8%', up: true }, { l: 'CPA', v: '₺42', up: false }].map(m => (
          <div key={m.l} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{m.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{m.v}</div>
            <div style={{ fontSize: 9, color: m.up ? '#1D9E75' : '#FF6B5A' }}>{m.up ? '↑' : '↓'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 56, marginBottom: 12 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '2px 2px 0 0', background: 'linear-gradient(to top, #1D9E75, #7C3AED)', animation: `growBar 0.5s ease-out ${i * 0.08}s both` }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {['G Ads', 'Meta', 'TikTok', 'LinkedIn'].map(p => (
          <span key={p} style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,0.08)', borderRadius: 4, color: 'rgba(255,255,255,0.6)' }}>{p}</span>
        ))}
      </div>
    </div>
  );
}

// ── Hero Section ───────────────────────────────────────────────────────────────

function HeroSection({ onStartWizard }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #0d1522 0%, #130926 55%, #091c2e 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '64px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,0.07) 0%, transparent 70%)', top: -150, right: 80, pointerEvents: 'none' }} />
      <div style={{ flex: 1, maxWidth: 520, position: 'relative' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 20, padding: '4px 14px', marginBottom: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#1D9E75', animation: 'aiPulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, color: '#1D9E75', fontWeight: 600, letterSpacing: '0.5px' }}>Claude AI ile Güçlendirildi</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px', color: '#fff' }}>
          Görsel PPT Raporlar<br />
          <span style={{ background: 'linear-gradient(90deg, #1D9E75, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Yapay Zeka ile Hazır
          </span>
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: '0 0 32px' }}>
          Claude AI ile kampanya verilerinizi analiz edin. Görsel PowerPoint sunumları ve PDF raporlar saniyeler içinde hazır.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onStartWizard} style={{ padding: '13px 28px', background: 'linear-gradient(135deg, #1D9E75, #0d8a63)', border: 'none', borderRadius: 10, color: '#0B1219', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font)', animation: 'pulse 2.5s infinite' }}>
            📊 Rapor Oluştur
          </button>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 28 }}>
          {[['7 Slayt', 'Görsel rapor'], ['AI Analiz', 'Claude opus'], ['PPTX & PDF', 'İndir']].map(([t, d]) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{t}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}><HeroDashboard /></div>
    </div>
  );
}

// ── Wizard Step Indicator ──────────────────────────────────────────────────────

function StepIndicator({ current }) {
  const steps = ['Rapor Tipi', 'Dönem', 'İçerik', 'Oluştur'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#1D9E75' : active ? 'linear-gradient(135deg, #1D9E75, #7C3AED)' : 'var(--bg3)',
                border: active || done ? 'none' : '1px solid var(--border2)',
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
              <div style={{ flex: 1, height: 1, background: done ? '#1D9E75' : 'var(--border2)', margin: '0 8px', marginBottom: 22 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Report Type ────────────────────────────────────────────────────────

function Step1Type({ value, onChange, onNext }) {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--text1)' }}>Rapor tipini seçin</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>AI ile görsel PowerPoint sunumu oluşturun</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
        {REPORT_TYPES.map(rt => {
          const active = value === rt.id;
          return (
            <div key={rt.id} onClick={() => onChange(rt.id)} style={{
              padding: '20px 18px', borderRadius: 12, cursor: 'pointer',
              background: active ? `${rt.color}12` : 'var(--bg)',
              border: active ? `2px solid ${rt.color}70` : '1px solid var(--border2)',
              transition: 'all 0.15s', position: 'relative',
            }}>
              <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: active ? rt.color : 'rgba(255,255,255,0.08)', color: active ? '#0B1219' : 'var(--text3)' }}>
                {rt.badge}
              </div>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{rt.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: active ? rt.color : 'var(--text1)', marginBottom: 8, lineHeight: 1.3 }}>{rt.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>{rt.desc}</div>
            </div>
          );
        })}
      </div>
      <WizardNav onNext={onNext} nextDisabled={!value} />
    </div>
  );
}

// ── Step 2: Period ─────────────────────────────────────────────────────────────

function Step2Period({ value, onChange, onPrev, onNext }) {
  const opts = [{ v: 7, l: '7 Gün' }, { v: 14, l: '14 Gün' }, { v: 30, l: '30 Gün' }, { v: 60, l: '60 Gün' }, { v: 90, l: '90 Gün' }];
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--text1)' }}>Analiz dönemi seçin</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>Seçilen döneme ait kampanya verileri rapora dahil edilir</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            padding: '14px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: value === o.v ? 'linear-gradient(135deg, #1D9E75, #0d8a63)' : 'var(--bg3)',
            color: value === o.v ? '#0B1219' : 'var(--text2)',
            fontWeight: value === o.v ? 700 : 400, fontSize: 14, fontFamily: 'var(--font)', transition: 'all 0.15s',
          }}>
            {o.l}
          </button>
        ))}
      </div>
      <WizardNav onPrev={onPrev} onNext={onNext} />
    </div>
  );
}

// ── Step 3: Content Selection ─────────────────────────────────────────────────

function Step3Content({ selected, onChange, onPrev, onNext, reportType }) {
  const defaultSlides = reportType === 'pdf' ? PDF_SLIDES : ALL_SLIDES.map(s => s.id);

  useEffect(() => {
    if (selected.length === 0) onChange(defaultSlides);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    if (ALL_SLIDES.find(s => s.id === id)?.required) return;
    onChange(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--text1)' }}>Rapora dahil edilecek içeriği seçin</div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>İşaretli slaytlar rapora dahil edilir</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 32 }}>
        {ALL_SLIDES.map(slide => {
          const checked = selected.includes(slide.id);
          return (
            <div key={slide.id} onClick={() => toggle(slide.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 10, cursor: slide.required ? 'default' : 'pointer',
              background: checked ? 'rgba(29,158,117,0.08)' : 'var(--bg)',
              border: checked ? '1px solid rgba(29,158,117,0.3)' : '1px solid var(--border2)',
              transition: 'all 0.15s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: checked ? '#1D9E75' : 'transparent',
                border: checked ? 'none' : '1.5px solid var(--border2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <span style={{ color: '#0B1219', fontSize: 11, fontWeight: 900 }}>✓</span>}
              </div>
              <span style={{ fontSize: 16 }}>{slide.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: checked ? 700 : 400, color: checked ? 'var(--teal)' : 'var(--text2)' }}>
                  {slide.label}
                  {slide.required && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>(zorunlu)</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <WizardNav onPrev={onPrev} onNext={onNext} nextDisabled={selected.length === 0} />
    </div>
  );
}

// ── Step 4: Generate ───────────────────────────────────────────────────────────

function Step4Generate({ onGenerate, generating, animStep, result, error, brandName }) {
  const apiUrl = import.meta.env.VITE_API_URL;
  const done = animStep === 3 && result;

  const handleDownloadPPTX = () => {
    const a = document.createElement('a');
    a.href = `${apiUrl}/reports/download/${result.fileId}`;
    a.download = `${brandName || 'rapor'}-adslands.pptx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPDF = () => {
    // Open print-friendly report page
    const win = window.open('', '_blank');
    const m = result.metrics || {};
    win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${brandName} — Rapor</title>
<style>
  body { font-family: Arial, sans-serif; background: #fff; color: #111; max-width: 800px; margin: 0 auto; padding: 40px 32px; }
  h1 { font-size: 28px; border-bottom: 3px solid #1D9E75; padding-bottom: 12px; margin-bottom: 8px; }
  .sub { font-size: 14px; color: #666; margin-bottom: 32px; }
  .metrics { display: flex; gap: 16px; margin-bottom: 32px; }
  .metric { flex: 1; border: 2px solid #1D9E75; border-radius: 8px; padding: 16px; text-align: center; }
  .metric-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .metric-value { font-size: 22px; font-weight: 700; color: #111; }
  .section { margin-bottom: 28px; }
  .section h2 { font-size: 16px; color: #1D9E75; border-left: 4px solid #1D9E75; padding-left: 10px; }
  p { font-size: 13px; line-height: 1.7; color: #333; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
  @media print { body { padding: 20px; } button { display: none; } }
</style>
</head><body>
<h1>${brandName || 'Marka'}</h1>
<div class="sub">Performans Raporu · ${result.period || ''} · AdsLands AI</div>
<div class="metrics">
  <div class="metric"><div class="metric-label">ROAS</div><div class="metric-value">${m.roas || '—'}</div></div>
  <div class="metric"><div class="metric-label">Harcama</div><div class="metric-value">${m.spend || '—'}</div></div>
  <div class="metric"><div class="metric-label">Dönüşüm</div><div class="metric-value">${m.conv || '—'}</div></div>
  <div class="metric"><div class="metric-label">CPA</div><div class="metric-value">${m.cpa || '—'}</div></div>
</div>
<div class="section"><h2>Rapor Özeti</h2><p>Bu rapor ${result.period || ''} dönemini kapsamaktadır. Görsel slayt raporu için PPT dosyasını indirin.</p></div>
<button onclick="window.print()" style="padding:12px 28px;background:#1D9E75;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:24px;">🖨 Yazdır / PDF Kaydet</button>
<div class="footer">AdsLands AI Raporu · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
</body></html>`);
    win.document.close();
  };

  return (
    <div>
      {!generating && !result && !error && (
        <div style={{ textAlign: 'center', padding: '20px 0 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 }}>Raporu oluşturmaya hazır</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 32 }}>AI analizini başlatmak için aşağıdaki butona tıklayın</div>
          <button onClick={onGenerate} style={{
            padding: '14px 40px', background: 'linear-gradient(135deg, #1D9E75, #7C3AED)',
            border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font)',
          }}>
            ✨ Raporu Oluştur
          </button>
        </div>
      )}

      {(generating || result || error) && (
        <div style={{ padding: '8px 0' }}>
          {/* Progress steps */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
            {ANIM_STEPS.map((step, i) => {
              const isDone = done || (animStep > i && !(animStep === i && i === 3));
              const isCurrent = animStep === i && generating;
              const isPending = animStep < i && !done;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 0',
                  borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  animation: animStep >= i ? `stepIn 0.3s ease both` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? 'rgba(16,185,129,0.15)' : isCurrent ? `${step.color}18` : 'rgba(255,255,255,0.04)',
                    border: isDone ? '1px solid rgba(16,185,129,0.4)' : isCurrent ? `1px solid ${step.color}60` : '1px solid rgba(255,255,255,0.08)',
                    fontSize: 16,
                  }}>
                    {isDone ? '✓' : step.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isCurrent ? 700 : 400,
                      color: isDone ? 'var(--text2)' : isCurrent ? step.color : isPending ? 'var(--text3)' : 'var(--text2)',
                    }}>
                      {step.text}
                    </div>
                  </div>
                  {isCurrent && !done && (
                    <div style={{ flexShrink: 0 }}>
                      <TypingDots />
                    </div>
                  )}
                  {isDone && (
                    <div style={{ fontSize: 12, color: '#10B981', flexShrink: 0 }}>✓</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#EF4444' }}>
              ❌ {error}
            </div>
          )}

          {/* Download buttons */}
          {done && !error && (
            <div style={{ animation: 'slideUp 0.4s ease both' }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#10B981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✅</span>
                <span>Raporunuz hazır! Aşağıdan indirebilirsiniz.</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleDownloadPPTX} style={{
                  flex: 1, padding: '14px 0', background: 'linear-gradient(135deg, #1D9E75, #0d8a63)',
                  border: 'none', borderRadius: 10, color: '#0B1219', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  📊 PPT İndir
                </button>
                <button onClick={handleDownloadPDF} style={{
                  flex: 1, padding: '14px 0', background: 'transparent',
                  border: '1px solid rgba(139,92,246,0.5)', borderRadius: 10, color: '#8B5CF6', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  📄 PDF İndir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wizard Nav ─────────────────────────────────────────────────────────────────

function WizardNav({ onPrev, onNext, nextDisabled = false, nextLabel = 'İlerle →' }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {onPrev && (
        <button onClick={onPrev} style={{ padding: '11px 20px', background: 'transparent', border: '1px solid var(--border2)', borderRadius: 9, color: 'var(--text3)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          ← Geri
        </button>
      )}
      <button onClick={onNext} disabled={nextDisabled} style={{
        padding: '11px 28px', background: nextDisabled ? 'var(--bg3)' : '#1D9E75',
        border: 'none', borderRadius: 9, color: nextDisabled ? 'var(--text3)' : '#0B1219',
        fontSize: 13, fontWeight: 700, cursor: nextDisabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
      }}>
        {nextLabel}
      </button>
    </div>
  );
}

// ── Saved Reports ──────────────────────────────────────────────────────────────

function SavedReports({ reports, loading, onDelete }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Oluşturulan Raporlar</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{loading ? 'Yükleniyor...' : `${reports.length} kayıt`}</div>
        </div>
      </div>

      {!loading && reports.length === 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border2)', borderRadius: 14, padding: '52px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📂</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Henüz rapor oluşturmadınız</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Yukarıdaki wizard'ı kullanarak ilk raporunuzu hazırlayın.</div>
        </div>
      )}

      {!loading && reports.length > 0 && (
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
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(29,158,117,0.12)', color: 'var(--teal)' }}>
                      {r.report_type === 'agency' ? 'Ajans' : r.report_type === 'brand' ? 'Marka' : r.report_type === 'pdf' ? 'PDF' : r.report_type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button onClick={() => onDelete(r.id)} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid rgba(255,107,90,0.3)', borderRadius: 6, color: 'var(--coral)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                      Sil
                    </button>
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

// ── Auto Reports ───────────────────────────────────────────────────────────────

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
          { key: 'weekly',  label: 'Haftalık Rapor',    desc: 'Her Pazartesi sabahı önceki haftanın analizi', value: autoWeekly,  set: setAutoWeekly },
          { key: 'monthly', label: 'Aylık Rapor',       desc: "Her ayın 1'inde önceki ayın kapsamlı analizi",  value: autoMonthly, set: setAutoMonthly },
          { key: 'email',   label: 'E-posta Bildirimi', desc: 'Raporlar e-posta adresinize iletilsin',         value: autoEmail,   set: setAutoEmail },
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
        <div style={{ marginTop: 16, background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--teal)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>✉️</span>
          <span>Her Pazartesi sabahı raporunuz e-postanıza gelecek. <span style={{ opacity: 0.7 }}>(Yakında aktif olacak)</span></span>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AiReport({ onNav }) {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const brandId   = isAgency ? selectedBrand?.id : null;
  const brandName = isAgency
    ? (selectedBrand?.name || selectedBrand?.company_name)
    : user?.company_name;

  const wizardRef = useRef(null);

  const [integrations, setIntegrations] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [wizardStep, setWizardStep]   = useState(1);
  const [reportType, setReportType]   = useState('');
  const [days, setDays]               = useState(30);
  const [selectedSlides, setSelectedSlides] = useState([]);

  // Generation state
  const [generating, setGenerating]   = useState(false);
  const [animStep, setAnimStep]       = useState(0);
  const [result, setResult]           = useState(null);
  const [genError, setGenError]       = useState('');

  // Auto reports
  const [autoWeekly, setAutoWeekly]   = useState(false);
  const [autoMonthly, setAutoMonthly] = useState(false);
  const [autoEmail, setAutoEmail]     = useState(false);

  useEffect(() => {
    setIntegrations([]);
    setSavedReports([]);
    setLoading(true);
    Promise.allSettled([getIntegrations(brandId), getReports(brandId)]).then(([intRes, repRes]) => {
      if (intRes.status === 'fulfilled') {
        setIntegrations((intRes.value || []).filter(i => i.is_active && i.platform !== 'google_analytics'));
      }
      if (repRes.status === 'fulfilled') setSavedReports(repRes.value || []);
    }).finally(() => setLoading(false));
  }, [brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToWizard = () => {
    setWizardStep(1);
    setResult(null);
    setGenError('');
    setGenerating(false);
    setAnimStep(0);
    setSelectedSlides([]);
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const generateReport = async () => {
    setGenerating(true);
    setResult(null);
    setGenError('');
    setAnimStep(0);

    const t0 = Date.now();

    // Advance animation steps
    setTimeout(() => setAnimStep(1), 2000);
    setTimeout(() => setAnimStep(2), 4000);

    const token = localStorage.getItem('token');
    const platforms = integrations.map(i => i.platform);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/reports/generate-pptx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          days,
          platforms: platforms.length ? platforms : null,
          report_type: reportType,
          slides: selectedSlides,
          brand_id: brandId,
        }),
      });

      const data = await response.json();
      if (response.status === 429) throw new Error((data.error || 'Günlük AI kullanım limitinize ulaştınız.') + ' Planınızı yükseltmek için Abonelik sayfasını ziyaret edin.');
      if (!response.ok) throw new Error(data.error || 'Rapor oluşturulamadı');

      // Ensure at least 6 seconds has passed for animation
      const elapsed = Date.now() - t0;
      if (elapsed < 6000) await new Promise(r => setTimeout(r, 6000 - elapsed));

      setAnimStep(3);
      setResult(data);

      // Save report reference to DB
      try {
        const saveResp = await fetch(`${import.meta.env.VITE_API_URL}/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: `${data.brandName || brandName || 'Rapor'} — ${data.period} — ${new Date().toLocaleDateString('tr-TR')}`,
            content: `fileId:${data.fileId}`,
            report_type: reportType,
            brand_id: brandId,
          }),
        });
        if (saveResp.ok) {
          const saved = await saveResp.json();
          setSavedReports(p => [saved, ...p]);
        }
      } catch { /* saving is non-critical */ }

    } catch (err) {
      setGenError(err.message);
      setAnimStep(0);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (id) => {
    try { await apiDeleteReport(id); setSavedReports(p => p.filter(r => r.id !== id)); } catch {}
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

      <div className="content" style={{ padding: 0 }}>

        {/* 1. HERO */}
        <HeroSection onStartWizard={scrollToWizard} />

        {/* 2. WIZARD */}
        <div ref={wizardRef} style={{ padding: '56px 40px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Görsel Rapor Oluşturucu</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>PPT / PDF Rapor Oluştur</div>
              <div style={{ fontSize: 14, color: 'var(--text3)' }}>4 adımda AI destekli görsel rapor hazırlayın</div>
            </div>

            <StepIndicator current={wizardStep} />

            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 16, padding: '32px 36px' }}>
              {wizardStep === 1 && (
                <Step1Type
                  value={reportType}
                  onChange={setReportType}
                  onNext={() => setWizardStep(2)}
                />
              )}
              {wizardStep === 2 && (
                <Step2Period
                  value={days}
                  onChange={setDays}
                  onPrev={() => setWizardStep(1)}
                  onNext={() => setWizardStep(3)}
                />
              )}
              {wizardStep === 3 && (
                <Step3Content
                  selected={selectedSlides}
                  onChange={setSelectedSlides}
                  onPrev={() => setWizardStep(2)}
                  onNext={() => setWizardStep(4)}
                  reportType={reportType}
                />
              )}
              {wizardStep === 4 && (
                <div>
                  <Step4Generate
                    onGenerate={generateReport}
                    generating={generating}
                    animStep={animStep}
                    result={result}
                    error={genError}
                    brandName={brandName}
                  />
                  {!generating && (
                    <div style={{ marginTop: 20 }}>
                      <WizardNav
                        onPrev={() => {
                          setWizardStep(3);
                          setResult(null);
                          setGenError('');
                          setGenerating(false);
                          setAnimStep(0);
                        }}
                        onNext={result ? scrollToWizard : undefined}
                        nextLabel={result ? '+ Yeni Rapor' : undefined}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Integration warning */}
            {integrations.length === 0 && !loading && (
              <div style={{ marginTop: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#F59E0B' }}>⚠️ Bağlı reklam hesabı bulunamadı — AI genel öneriler sunacak</div>
                <button onClick={() => onNav?.('integrations')} style={{ flexShrink: 0, padding: '6px 14px', background: 'transparent', border: '1px solid #F59E0B', borderRadius: 6, color: '#F59E0B', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                  Entegrasyonlara Git →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3. SAVED REPORTS */}
        <div style={{ padding: '56px 40px', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <SavedReports reports={savedReports} loading={loading} onDelete={handleDeleteReport} />
          </div>
        </div>

        {/* 4. AUTO REPORTS */}
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
