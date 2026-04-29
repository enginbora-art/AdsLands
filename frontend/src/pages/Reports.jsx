import { useState, useEffect } from 'react';
import { useAgencyBrand, NoBrandSelected } from '../components/AgencyGuard';
import { buildReport, getReports, deleteReport } from '../api';

const PERIODS = [
  { days: 7,  label: 'Son 7 Gün' },
  { days: 14, label: 'Son 14 Gün' },
  { days: 30, label: 'Son 30 Gün' },
  { days: 60, label: 'Son 60 Gün' },
  { days: 90, label: 'Son 90 Gün' },
];

const SLIDES = [
  { key: 'slide1', label: 'Kapak Sayfası',             desc: 'Şirket adı, tarih, rapor tipi',         locked: true },
  { key: 'slide2', label: 'Yönetici Özeti',            desc: 'En kritik 3-4 bulgu ve metrik',          locked: false },
  { key: 'slide3', label: 'Kanal Tablosu',             desc: 'Platform bazında harcama ve ROAS',       locked: false },
  { key: 'slide4', label: 'Trend Grafikleri',          desc: 'Günlük harcama ve ROAS trendi',          locked: false },
  { key: 'slide5', label: 'Benchmark Karşılaştırması', desc: 'Sektör ortalamasına göre konum',         locked: false },
  { key: 'slide6', label: 'Öneriler & Aksiyon Planı', desc: 'Önceliklendirilmiş iyileştirmeler',      locked: false },
  { key: 'slide7', label: 'Sonuç',                     desc: 'Genel değerlendirme ve sonraki adımlar', locked: true },
];

const FORMATS = [
  { key: 'pptx', label: 'PowerPoint', icon: '📊', desc: '.pptx formatında indir' },
  { key: 'pdf',  label: 'PDF',        icon: '📄', desc: 'Tarayıcıda yazdır / kaydet' },
  { key: 'both', label: 'Her İkisi',  icon: '📦', desc: 'PPT + PDF birlikte al' },
];

const ANIM_STEPS = [
  'Reklam verileri toplanıyor...',
  'AI analiz yapılıyor...',
  'Slaytlar oluşturuluyor...',
  'Rapor tamamlanıyor...',
];

const ANIM_ICONS = ['🔍', '🤖', '📊', '✨'];

const TEMPLATES = [
  {
    key: 'agency',
    title: 'Ajans Teknik Raporu',
    subtitle: 'Tüm kanallar, derinlikli metrikler, optimizasyon önerileri',
    badge: 'Ajans',
    gradient: 'linear-gradient(135deg, #0d9488 0%, #0369a1 100%)',
    glowColor: 'rgba(13,148,136,0.18)',
    accentColor: '#0d9488',
    icon: '🏢',
    features: ['7 detaylı slayt', 'Teknik dil', 'Kanal kırılımı', 'Benchmark analizi'],
  },
  {
    key: 'brand',
    title: 'Marka Sunum Raporu',
    subtitle: 'Yönetici özeti öne çıkar, stratejik öneriler, görsel sunum',
    badge: 'Marka',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
    glowColor: 'rgba(124,58,237,0.18)',
    accentColor: '#7c3aed',
    icon: '✨',
    features: ['Öz ve etkili', 'Görsel odaklı', 'Stratejik bakış', 'Üst yönetim sunum'],
  },
];

function StepBar({ step }) {
  const labels = ['Dönem', 'İçerik', 'Format'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 32 }}>
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', flex: i < labels.length - 1 ? 1 : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: i < step ? 'var(--teal)' : i === step ? 'rgba(13,148,136,0.15)' : 'var(--bg2)',
              border: `2px solid ${i <= step ? 'var(--teal)' : 'var(--border2)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: i < step ? '#fff' : i === step ? 'var(--teal)' : 'var(--text3)',
              fontWeight: 700, fontSize: 14, transition: 'all .3s',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 12, marginTop: 6, textAlign: 'center',
              color: i === step ? 'var(--teal)' : 'var(--text3)',
              fontWeight: i === step ? 600 : 400,
            }}>{label}</span>
          </div>
          {i < labels.length - 1 && (
            <div style={{
              flex: 1, height: 2, marginTop: 17, marginInline: 8,
              background: i < step ? 'var(--teal)' : 'var(--border2)',
              transition: 'background .3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

function SavedReports({ reports, loading, onDelete }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 14 }}>
        Yükleniyor...
      </div>
    );
  }
  if (!reports.length) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <h2 style={{ fontFamily: 'var(--font)', color: 'var(--text1)', fontSize: 18, marginBottom: 16 }}>
        Kaydedilen Raporlar
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map(r => {
          const tmpl = TEMPLATES.find(t => t.key === r.report_type);
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', background: 'var(--bg2)',
              border: '1px solid var(--border2)', borderRadius: 12, gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: tmpl ? `${tmpl.accentColor}18` : 'var(--border2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>
                  {tmpl?.icon || '📄'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600, color: 'var(--text1)', fontSize: 14,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.title}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>
                    {tmpl?.title || r.report_type}
                    {r.format && <> · {r.format.toUpperCase()}</>}
                    {' · '}
                    {new Date(r.created_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {r.file_url && (
                  <a
                    href={`${import.meta.env.VITE_API_URL}${r.file_url}`}
                    download="adslands-raporu.pptx"
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: 'rgba(13,148,136,0.1)', color: 'var(--teal)',
                      textDecoration: 'none', border: '1px solid rgba(13,148,136,0.25)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    İndir
                  </a>
                )}
                <button
                  onClick={() => onDelete(r.id)}
                  style={{
                    padding: '7px 12px', borderRadius: 8, fontSize: 13,
                    background: 'transparent', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Reports() {
  const { isAgency, selectedBrand, needsBrand } = useAgencyBrand();

  const [template, setTemplate]       = useState(null);
  const [step, setStep]               = useState(0);
  const [period, setPeriod]           = useState(PERIODS[2]);
  const [enabledSlides, setEnabledSlides] = useState(
    Object.fromEntries(SLIDES.map(s => [s.key, true]))
  );
  const [format, setFormat]           = useState('pptx');
  const [generating, setGenerating]   = useState(false);
  const [animStep, setAnimStep]       = useState(-1);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (!needsBrand) loadSaved();
  }, [selectedBrand?.id, needsBrand]);

  if (needsBrand) return <NoBrandSelected pageName="Rapor Oluştur" />;

  async function loadSaved() {
    setLoadingReports(true);
    try {
      const rows = await getReports(selectedBrand?.id);
      setSavedReports(rows.filter(r => r.report_type === 'agency' || r.report_type === 'brand'));
    } catch {}
    setLoadingReports(false);
  }

  function toggleSlide(key) {
    if (SLIDES.find(s => s.key === key)?.locked) return;
    setEnabledSlides(p => ({ ...p, [key]: !p[key] }));
  }

  async function generate() {
    setGenerating(true);
    setAnimStep(0);
    setError(null);
    setResult(null);

    let i = 0;
    const anim = setInterval(() => {
      i++;
      if (i < ANIM_STEPS.length) setAnimStep(i);
    }, 2400);

    try {
      const data = await buildReport({
        days: period.days,
        report_type: template,
        slides: SLIDES.filter(s => enabledSlides[s.key]).map(s => s.key),
        format,
        brand_id: selectedBrand?.id,
      });
      clearInterval(anim);
      setAnimStep(ANIM_STEPS.length);
      setResult(data);
    } catch (err) {
      clearInterval(anim);
      setError(err.response?.data?.error || 'Rapor oluşturulamadı.');
    } finally {
      setGenerating(false);
    }
  }

  function openPdf() {
    if (!result) return;
    const m = result.metrics || {};
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${result.brandName || ''} Raporu</title>
<style>
body{font-family:Arial,sans-serif;padding:48px;color:#1a1a1a;max-width:900px;margin:0 auto}
h1{color:#0d9488;border-bottom:3px solid #0d9488;padding-bottom:10px;font-size:26px}
h2{color:#1e293b;margin-top:32px;font-size:16px;text-transform:uppercase;letter-spacing:.5px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center}
.kpi-val{font-size:24px;font-weight:800;color:#0d9488}
.kpi-label{font-size:12px;color:#64748b;margin-top:4px;font-weight:600}
.footer{margin-top:48px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{body{padding:24px}}
</style></head>
<body>
<h1>${result.brandName || 'Marka'} &mdash; ${result.period || ''}</h1>
<h2>Temel Metrikler</h2>
<div class="kpi-grid">
<div class="kpi"><div class="kpi-val">${m.spend||'—'}</div><div class="kpi-label">Toplam Harcama</div></div>
<div class="kpi"><div class="kpi-val">${m.roas||'—'}</div><div class="kpi-label">Ortalama ROAS</div></div>
<div class="kpi"><div class="kpi-val">${m.conv||'—'}</div><div class="kpi-label">Toplam Dönüşüm</div></div>
<div class="kpi"><div class="kpi-val">${m.cpa||'—'}</div><div class="kpi-label">Ortalama CPA</div></div>
</div>
<div class="footer">AdsLands tarafından oluşturulmuştur &bull; ${new Date().toLocaleDateString('tr-TR')}</div>
<script>setTimeout(()=>window.print(),600)</script>
</body></html>`);
    w.document.close();
  }

  function handleDelete(id) {
    deleteReport(id).then(() => loadSaved()).catch(() => {});
  }

  function reset() {
    setTemplate(null);
    setStep(0);
    setPeriod(PERIODS[2]);
    setEnabledSlides(Object.fromEntries(SLIDES.map(s => [s.key, true])));
    setFormat('pptx');
    setResult(null);
    setError(null);
    setGenerating(false);
    setAnimStep(-1);
    loadSaved();
  }

  const selectedTemplate = TEMPLATES.find(t => t.key === template);

  // ── Generation / Result view ────────────────────────────────────────────────
  if (generating || result || error) {
    return (
      <div style={{ maxWidth: 580, margin: '48px auto', padding: '0 16px' }}>
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 20, padding: '48px 40px', textAlign: 'center',
        }}>
          {generating ? (
            <>
              <div style={{ fontSize: 52, marginBottom: 16 }}>
                {animStep >= 0 && animStep < ANIM_ICONS.length ? ANIM_ICONS[animStep] : '⏳'}
              </div>
              <h2 style={{ fontFamily: 'var(--font)', color: 'var(--text1)', marginBottom: 6, fontSize: 22 }}>
                Rapor Oluşturuluyor
              </h2>
              <p style={{ color: 'var(--text3)', marginBottom: 36, fontSize: 14 }}>
                {animStep >= 0 ? ANIM_STEPS[Math.min(animStep, ANIM_STEPS.length - 1)] : 'Başlatılıyor...'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
                {ANIM_STEPS.map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 12,
                    background: i <= animStep ? 'rgba(13,148,136,0.07)' : 'transparent',
                    border: `1px solid ${i <= animStep ? 'rgba(13,148,136,0.18)' : 'transparent'}`,
                    transition: 'all .4s',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: i < animStep ? 'var(--teal)' : i === animStep ? 'rgba(13,148,136,0.18)' : 'var(--border2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: i < animStep ? '#fff' : 'var(--text3)',
                      fontSize: 12, fontWeight: 700, transition: 'all .4s',
                    }}>
                      {i < animStep ? '✓' : ''}
                    </div>
                    <span style={{
                      color: i <= animStep ? 'var(--text1)' : 'var(--text3)',
                      fontWeight: i === animStep ? 600 : 400,
                      fontSize: 14, transition: 'all .4s',
                    }}>{s}</span>
                  </div>
                ))}
              </div>
            </>
          ) : result ? (
            <>
              <div style={{ fontSize: 60, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontFamily: 'var(--font)', color: 'var(--text1)', marginBottom: 6, fontSize: 22 }}>
                Raporunuz Hazır!
              </h2>
              <p style={{ color: 'var(--text3)', marginBottom: 36, fontSize: 14 }}>
                {result.brandName} &mdash; {result.period}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(format === 'pptx' || format === 'both') && (
                  <a
                    href={`${import.meta.env.VITE_API_URL}${result.downloadUrl}`}
                    download="adslands-raporu.pptx"
                    style={{
                      display: 'block', padding: '15px 24px', borderRadius: 12,
                      background: 'var(--teal)', color: '#fff', fontWeight: 700, fontSize: 15,
                      textDecoration: 'none',
                    }}
                  >
                    📊 PowerPoint İndir (.pptx)
                  </a>
                )}
                {(format === 'pdf' || format === 'both') && (
                  <button
                    onClick={openPdf}
                    style={{
                      padding: '15px 24px', borderRadius: 12,
                      background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 15,
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    📄 PDF Olarak Kaydet
                  </button>
                )}
                <button
                  onClick={reset}
                  style={{
                    padding: '13px 24px', borderRadius: 12,
                    background: 'transparent', color: 'var(--text2)', fontWeight: 500, fontSize: 14,
                    border: '1px solid var(--border2)', cursor: 'pointer', marginTop: 4,
                  }}
                >
                  + Yeni Rapor Oluştur
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 52, marginBottom: 14 }}>⚠️</div>
              <h2 style={{ color: 'var(--text1)', marginBottom: 8, fontSize: 20 }}>Hata Oluştu</h2>
              <p style={{ color: '#ef4444', marginBottom: 28, fontSize: 14 }}>{error}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => { setError(null); setGenerating(false); }}
                  style={{
                    padding: '12px 24px', borderRadius: 12,
                    background: 'var(--teal)', color: '#fff', fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  Tekrar Dene
                </button>
                <button
                  onClick={reset}
                  style={{
                    padding: '12px 24px', borderRadius: 12,
                    background: 'transparent', color: 'var(--text2)',
                    border: '1px solid var(--border2)', cursor: 'pointer', fontSize: 14,
                  }}
                >
                  Başa Dön
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Template selection ──────────────────────────────────────────────────────
  if (!template) {
    return (
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 16px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'var(--font)', color: 'var(--text1)', fontSize: 28, margin: '0 0 10px' }}>
            Rapor Oluştur
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: 15, margin: 0 }}>
            Şablon seçin, dönem ve içerik belirleyin — saniyeler içinde profesyonel PPT veya PDF rapor alın.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 52 }}>
          {TEMPLATES.map(t => (
            <div
              key={t.key}
              onClick={() => setTemplate(t.key)}
              style={{
                background: 'var(--bg2)', border: '2px solid var(--border2)',
                borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
                transition: 'transform .22s, border-color .22s, box-shadow .22s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.borderColor = t.accentColor;
                e.currentTarget.style.boxShadow = `0 16px 48px ${t.glowColor}`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border2)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ background: t.gradient, padding: '36px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 52, marginBottom: 10 }}>{t.icon}</div>
                <span style={{
                  display: 'inline-block', padding: '4px 14px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.22)', color: '#fff',
                  fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: '.3px',
                }}>{t.badge}</span>
                <h2 style={{
                  fontFamily: 'var(--font)', color: '#fff',
                  fontSize: 21, margin: '0 0 8px',
                }}>{t.title}</h2>
                <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, margin: 0 }}>{t.subtitle}</p>
              </div>
              <div style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {t.features.map((f, i) => (
                    <span key={i} style={{
                      padding: '5px 12px', borderRadius: 12,
                      background: `${t.accentColor}14`,
                      color: t.accentColor, fontSize: 12, fontWeight: 600,
                    }}>{f}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text3)', fontSize: 13 }}>Seçmek için tıklayın</span>
                  <span style={{ color: t.accentColor, fontSize: 22, fontWeight: 800 }}>→</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <SavedReports reports={savedReports} loading={loadingReports} onDelete={handleDelete} />
      </div>
    );
  }

  // ── Wizard ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 16px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <button
          onClick={reset}
          style={{
            background: 'none', border: '1px solid var(--border2)', borderRadius: 8,
            padding: '7px 16px', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, flexShrink: 0,
          }}
        >
          ← Geri
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'var(--font)', color: 'var(--text1)',
            fontSize: 20, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {selectedTemplate?.title}
          </h1>
          {isAgency && selectedBrand && (
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>{selectedBrand.company_name} için</span>
          )}
        </div>
      </div>

      <StepBar step={step} />

      {/* Step content */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 20,
      }}>
        {step === 0 && (
          <div>
            <h3 style={{ color: 'var(--text1)', margin: '0 0 6px', fontSize: 17 }}>Analiz Dönemi</h3>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 22px' }}>
              Hangi zaman dilimini analiz etmek istiyorsunuz?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {PERIODS.map(p => (
                <button
                  key={p.days}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: '11px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    border: `2px solid ${period.days === p.days ? 'var(--teal)' : 'var(--border2)'}`,
                    background: period.days === p.days ? 'rgba(13,148,136,0.1)' : 'transparent',
                    color: period.days === p.days ? 'var(--teal)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 style={{ color: 'var(--text1)', margin: '0 0 6px', fontSize: 17 }}>Rapor İçeriği</h3>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 20px' }}>
              Rapora dahil etmek istediğiniz slaytları seçin.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SLIDES.map(s => (
                <div
                  key={s.key}
                  onClick={() => toggleSlide(s.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 16px', borderRadius: 12,
                    cursor: s.locked ? 'default' : 'pointer',
                    border: `1px solid ${enabledSlides[s.key] ? 'rgba(13,148,136,0.25)' : 'var(--border2)'}`,
                    background: enabledSlides[s.key] ? 'rgba(13,148,136,0.05)' : 'transparent',
                    transition: 'all .2s', opacity: s.locked ? 0.75 : 1,
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    border: `2px solid ${enabledSlides[s.key] ? 'var(--teal)' : 'var(--border2)'}`,
                    background: enabledSlides[s.key] ? 'var(--teal)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s',
                  }}>
                    {enabledSlides[s.key] && (
                      <span style={{ color: '#fff', fontSize: 13, lineHeight: 1 }}>✓</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text1)', fontWeight: 600, fontSize: 14 }}>{s.label}</span>
                      {s.locked && (
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 8,
                          background: 'rgba(13,148,136,0.12)', color: 'var(--teal)', fontWeight: 600,
                        }}>Zorunlu</span>
                      )}
                    </div>
                    <span style={{ color: 'var(--text3)', fontSize: 12 }}>{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={{ color: 'var(--text1)', margin: '0 0 6px', fontSize: 17 }}>Çıktı Formatı</h3>
            <p style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 22px' }}>
              Raporunuzu hangi formatta almak istiyorsunuz?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {FORMATS.map(f => (
                <div
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  style={{
                    flex: 1, padding: '22px 14px', borderRadius: 14, textAlign: 'center',
                    border: `2px solid ${format === f.key ? 'var(--teal)' : 'var(--border2)'}`,
                    background: format === f.key ? 'rgba(13,148,136,0.08)' : 'transparent',
                    cursor: 'pointer', transition: 'all .2s',
                  }}
                >
                  <div style={{ fontSize: 34, marginBottom: 10 }}>{f.icon}</div>
                  <div style={{
                    fontWeight: 700, color: format === f.key ? 'var(--teal)' : 'var(--text1)',
                    fontSize: 15, marginBottom: 6,
                  }}>{f.label}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 12 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            padding: '13px 28px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            border: '1px solid var(--border2)', background: 'transparent',
            color: step === 0 ? 'var(--text3)' : 'var(--text2)',
            cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.4 : 1,
          }}
        >
          ← Önceki
        </button>

        {step < 2 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            style={{
              padding: '13px 36px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: 'var(--teal)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            Devam →
          </button>
        ) : (
          <button
            onClick={generate}
            style={{
              padding: '13px 32px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: 'var(--teal)', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            🚀 Raporu Oluştur
          </button>
        )}
      </div>
    </div>
  );
}
