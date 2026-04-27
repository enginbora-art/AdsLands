import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedBrand } from '../context/BrandContext';
import { getDashboardAnomalies, getAgencyBrandDetail, getAgencyDashboard, resolveAnomaly, getAnomalySettings, saveAnomalySettings } from '../api';

const ANIM_CSS = `
@keyframes anom-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
@keyframes mock-in { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:translateX(0); } }
@keyframes dot-pulse {
  0%,100% { box-shadow: 0 0 0 0 var(--dc,rgba(239,68,68,0.5)); }
  60%     { box-shadow: 0 0 0 8px transparent; }
}
@keyframes crit-blink { 0%,100%{opacity:1;} 50%{opacity:0.55;} }
@keyframes step-pop { from{opacity:0;transform:translateY(14px) scale(0.96);} to{opacity:1;transform:none;} }
.anom-in  { animation: anom-in  0.38s ease both; }
.mock-in  { animation: mock-in  0.4s ease both; }
.step-pop { animation: step-pop 0.4s ease both; }
.dot-pulse-red  { --dc:rgba(239,68,68,0.5);  animation: dot-pulse 2s infinite; }
.dot-pulse-amr  { --dc:rgba(245,158,11,0.4); animation: dot-pulse 2.4s infinite; }
.dot-pulse-grn  { --dc:rgba(0,191,166,0.4);  animation: dot-pulse 2.8s infinite; }
.crit-blink { animation: crit-blink 2.2s ease infinite; }
.anom-type-card {
  animation: anom-in 0.35s ease both;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  cursor: default;
}
.anom-type-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.filter-tab {
  padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border2);
  background: transparent; color: var(--text3); font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease; font-family: var(--font);
}
.filter-tab.active { background: var(--teal); border-color: var(--teal); color: #0B1219; }
.filter-tab:not(.active):hover { border-color: var(--teal); color: var(--teal); }
.anomaly-row { transition: background 0.15s ease; }
.anomaly-row:hover { background: rgba(255,255,255,0.03); }
.action-btn {
  padding: 5px 11px; border-radius: 6px; border: 1px solid var(--border2);
  background: transparent; color: var(--text3); font-size: 11px; font-weight: 600;
  cursor: pointer; transition: all 0.15s ease; font-family: var(--font);
}
.action-btn:hover { border-color: var(--teal); color: var(--teal); }
.action-btn.resolve:hover { border-color: var(--success,#34d399); color: var(--success,#34d399); }
.settings-slider { width: 100%; height: 4px; border-radius: 2px; accent-color: var(--teal); cursor: pointer; }
`;

const PLATFORM_LABELS = {
  google_ads: 'Google Ads', meta: 'Meta Ads', tiktok: 'TikTok Ads',
  google_analytics: 'Google Analytics', linkedin: 'LinkedIn', adform: 'Adform',
};
const PLATFORM_COLORS = {
  google_ads: '#4285F4', meta: '#1877F2', tiktok: '#69C9D0',
  google_analytics: '#E37400', linkedin: '#0A66C2', adform: '#FF6B00',
};
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

// ── Hero mock alerts ──────────────────────────────────────────────────────────
const MOCK_ALERTS = [
  { color: '#ef4444', dotClass: 'dot-pulse-red',  badge: 'KRİTİK', text: 'Google Ads harcama +%81',   delay: '0.1s' },
  { color: '#f59e0b', dotClass: 'dot-pulse-amr',  badge: 'UYARI',  text: 'Meta CPA artışı +%32',      delay: '0.25s' },
  { color: '#f59e0b', dotClass: 'dot-pulse-amr',  badge: 'UYARI',  text: 'TikTok CTR sektör altı',    delay: '0.4s' },
  { color: '#00BFA6', dotClass: 'dot-pulse-grn',  badge: 'NORMAL', text: 'ROAS hedef aralığında',      delay: '0.55s' },
];

function HeroSection() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f1520 0%, #141c2e 50%, #0f1520 100%)',
      borderRadius: 16, padding: '48px 48px', marginBottom: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-60, right:-60, width:280, height:280, borderRadius:'50%', background:'rgba(239,68,68,0.06)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-40, left:-40, width:200, height:200, borderRadius:'50%', background:'rgba(245,158,11,0.05)', pointerEvents:'none' }} />
      <div style={{ display:'flex', gap:48, alignItems:'center', flexWrap:'wrap', position:'relative' }}>
        <div style={{ flex:'0 0 auto', maxWidth:480 }}>
          <div className="anom-in" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:20, padding:'4px 12px', marginBottom:20 }}>
            <span style={{ fontSize:12 }}>🤖</span>
            <span style={{ fontSize:11, fontWeight:700, color:'#ef4444', letterSpacing:'0.6px', textTransform:'uppercase' }}>AI Destekli Anomali Tespiti</span>
          </div>
          <h1 className="anom-in" style={{ fontSize:36, fontWeight:800, lineHeight:1.2, margin:'0 0 16px', animationDelay:'0.1s' }}>
            Akıllı Anomali<br />
            <span style={{ color:'#ef4444' }}>Tespiti</span>
          </h1>
          <p className="anom-in" style={{ fontSize:15, color:'var(--text2)', lineHeight:1.7, margin:'0 0 28px', animationDelay:'0.2s' }}>
            Reklam harcamalarınızdaki anormal değişimleri otomatik tespit eder,<br />
            sizi ve ajansınızı anında bilgilendirir.
          </p>
          <div className="anom-in" style={{ display:'flex', gap:24, animationDelay:'0.3s', flexWrap:'wrap' }}>
            {[
              { val:'7/24', label:'İzleme' },
              { val:'<2s', label:'Tespit süresi' },
              { val:'%95', label:'Doğruluk' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize:24, fontWeight:800, color:'var(--teal)' }}>{s.val}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex:1, minWidth:240 }}>
          <div style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'16px 18px', display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:600, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.5px' }}>Canlı İzleme</div>
            {MOCK_ALERTS.map((a, i) => (
              <div key={i} className="mock-in" style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', animationDelay: a.delay }}>
                <div className={a.dotClass} style={{ width:8, height:8, borderRadius:'50%', background:a.color, flexShrink:0 }} />
                <div style={{ flex:1, fontSize:12, color:'var(--text2)' }}>{a.text}</div>
                <div style={{ fontSize:10, fontWeight:700, color:a.color, background:`${a.color}18`, borderRadius:4, padding:'2px 6px' }}>{a.badge}</div>
              </div>
            ))}
            <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center', marginTop:2, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>Örnek gösterim</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
const STEPS = [
  { icon:'🔍', title:'Analiz', desc:'Her gün reklam metrikleri otomatik olarak izlenir ve tarihsel verilerle karşılaştırılır.', delay:'0s' },
  { icon:'⚡', title:'Tespit',  desc:'Belirlenen eşik değerlerinin (%50 bütçe sapması vb.) aşıldığı anlık tespit edilir.', delay:'0.1s' },
  { icon:'🔔', title:'Bildir', desc:'Ajans ve marka yöneticileri platform bildirimi ile anında haberdar edilir.', delay:'0.2s' },
];

function HowItWorks() {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
      {STEPS.map((s, i) => (
        <div key={i} className="step-pop" style={{
          background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'22px 22px',
          position:'relative', animationDelay: s.delay,
        }}>
          {i < 2 && (
            <div style={{ position:'absolute', top:'50%', right:-10, transform:'translateY(-50%)', fontSize:16, color:'var(--text3)', zIndex:1 }}>→</div>
          )}
          <div style={{ fontSize:28, marginBottom:12 }}>{s.icon}</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>{s.title}</div>
          <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.6 }}>{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ── Anomaly type cards ────────────────────────────────────────────────────────
const ANOMALY_TYPES = [
  { icon:'💰', title:'Bütçe Anomalisi',  desc:'Günlük harcama son 30 günün ortalamasının %50 üzerinde seyrediyor.', badge:'KRİTİK', color:'#ef4444', delay:'0s' },
  { icon:'📈', title:'CPA Artışı',        desc:'Müşteri edinme maliyeti normalin %30 üzerinde — dönüşüm verimliliği düştü.', badge:'UYARI', color:'#f59e0b', delay:'0.08s' },
  { icon:'📉', title:'CTR Düşüşü',        desc:'Tıklama oranı sektör ortalamasının altına indi, reklam kalitesi kontrol edilmeli.', badge:'UYARI', color:'#f59e0b', delay:'0.16s' },
  { icon:'🎯', title:'ROAS Düşüşü',       desc:'Reklam getirisi geçen haftaya göre %25 azaldı — kampanya optimizasyonu gerekiyor.', badge:'KRİTİK', color:'#ef4444', delay:'0.24s' },
];

function AnomalyTypeCards() {
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Tespit Edilen Anomali Tipleri</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginBottom:24 }}>
        {ANOMALY_TYPES.map((t, i) => (
          <div key={i} className="anom-type-card" style={{
            background:'var(--bg2)', border:`1px solid ${t.color}28`, borderRadius:12, padding:'18px 20px',
            animationDelay: t.delay,
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <span style={{ fontSize:22 }}>{t.icon}</span>
              <span className={t.badge === 'KRİTİK' ? 'crit-blink' : ''} style={{
                fontSize:10, fontWeight:800, color:t.color, background:`${t.color}18`,
                borderRadius:4, padding:'3px 8px', letterSpacing:'0.4px',
              }}>{t.badge}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>{t.title}</div>
            <div style={{ fontSize:12, color:'var(--text3)', lineHeight:1.6 }}>{t.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Demo anomaly card ─────────────────────────────────────────────────────────
function DemoCard() {
  return (
    <div className="anom-in" style={{ marginBottom:24, animationDelay:'0.2s' }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Örnek Anomali Görünümü</div>
      <div style={{
        background:'var(--bg2)', border:'1px solid rgba(239,68,68,0.35)', borderRadius:14,
        padding:'22px 24px', maxWidth:520, position:'relative',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <div className="dot-pulse-red" style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444' }} />
          <span className="crit-blink" style={{ fontSize:11, fontWeight:800, color:'#ef4444', background:'rgba(239,68,68,0.12)', borderRadius:4, padding:'2px 8px' }}>KRİTİK</span>
          <span style={{ fontSize:13, fontWeight:700 }}>Google Ads</span>
        </div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Günlük harcama anomalisi</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Normal (30g ort.)</div>
            <div style={{ fontSize:18, fontWeight:700, fontFamily:'var(--mono)' }}>₺3.200<span style={{fontSize:11,color:'var(--text3)'}}>/gün</span></div>
          </div>
          <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Bugün</div>
            <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
              <span style={{ fontSize:18, fontWeight:700, color:'#ef4444', fontFamily:'var(--mono)' }}>₺5.800</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#ef4444' }}>+%81</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--text3)' }}>⏱ Tespit: 2 saat önce</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="action-btn">Detay Gör</button>
            <button className="action-btn">Not Ekle</button>
          </div>
        </div>
      </div>
      <div style={{ fontSize:11, color:'var(--text3)', marginTop:8, marginLeft:2 }}>↑ Bu bir örnek gösterimdir. Gerçek anomaliler aşağıda listelenir.</div>
    </div>
  );
}

// ── Real anomaly list ─────────────────────────────────────────────────────────
const SEVERITY_MAP = { critical: 'KRİTİK', high: 'KRİTİK', medium: 'UYARI', low: 'BİLGİ', warning: 'UYARI' };
const SEVERITY_COLOR = { KRİTİK: '#ef4444', UYARI: '#f59e0b', BİLGİ: '#60a5fa' };

function getSeverity(anomaly) {
  if (anomaly.severity) return SEVERITY_MAP[anomaly.severity] || 'UYARI';
  if (anomaly.expected_value && anomaly.actual_value) {
    const diff = Math.abs(anomaly.actual_value - anomaly.expected_value) / (anomaly.expected_value || 1);
    return diff > 0.5 ? 'KRİTİK' : 'UYARI';
  }
  return 'UYARI';
}

function NoteModal({ onClose, onSubmit }) {
  const [note, setNote] = useState('');
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <div style={{ background:'#1a1f2e', border:'1px solid var(--border2)', borderRadius:14, padding:28, width:400, maxWidth:'92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Not Ekle</div>
        <textarea
          value={note} onChange={e => setNote(e.target.value)}
          placeholder="Anomali hakkında not girin..."
          style={{ width:'100%', minHeight:100, padding:'10px 12px', background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text1)', fontSize:13, resize:'vertical', fontFamily:'var(--font)', boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:10, marginTop:14, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'8px 18px', background:'transparent', border:'1px solid var(--border2)', borderRadius:8, color:'var(--text3)', fontSize:13, cursor:'pointer', fontFamily:'var(--font)' }}>İptal</button>
          <button onClick={() => { onSubmit(note); onClose(); }} style={{ padding:'8px 18px', background:'var(--teal)', border:'none', borderRadius:8, color:'#0B1219', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--font)' }}>Kaydet</button>
        </div>
      </div>
    </div>
  );
}

function AnomalyListSection({ anomalies: initial, loading }) {
  const [anomalies, setAnomalies] = useState(initial || []);
  const [filter, setFilter] = useState('all');
  const [noteTarget, setNoteTarget] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => { setAnomalies(initial || []); }, [initial]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleResolve = async (a) => {
    try {
      await resolveAnomaly(a.id);
      setAnomalies(prev => prev.map(x => x.id === a.id ? { ...x, status: 'resolved' } : x));
      showToast('Anomali çözüldü olarak işaretlendi.');
    } catch { showToast('İşlem başarısız.'); }
  };

  const FILTERS = [
    { key:'all',      label:'Tümü',    fn: () => true },
    { key:'critical', label:'Kritik',  fn: a => getSeverity(a) === 'KRİTİK' && a.status !== 'resolved' },
    { key:'warning',  label:'Uyarı',   fn: a => getSeverity(a) === 'UYARI'  && a.status !== 'resolved' },
    { key:'resolved', label:'Çözüldü', fn: a => a.status === 'resolved' },
  ];
  const visible = anomalies.filter(FILTERS.find(f => f.key === filter).fn);

  const critCount = anomalies.filter(a => getSeverity(a) === 'KRİTİK' && a.status !== 'resolved').length;
  const warnCount = anomalies.filter(a => getSeverity(a) === 'UYARI'  && a.status !== 'resolved').length;

  return (
    <div className="anom-in" style={{ animationDelay:'0.15s', marginBottom:24 }}>
      {toast && (
        <div style={{ position:'fixed', bottom:32, right:32, background:'var(--bg2)', border:'1px solid var(--teal)', borderRadius:10, padding:'11px 18px', fontSize:13, zIndex:9999, color:'var(--teal)', fontWeight:600 }}>
          {toast}
        </div>
      )}
      {noteTarget && (
        <NoteModal onClose={() => setNoteTarget(null)} onSubmit={() => showToast('Not kaydedildi.')} />
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700 }}>Anomali Listesi</div>
          {(critCount > 0 || warnCount > 0) && (
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
              {critCount > 0 && <span style={{ color:'#ef4444', fontWeight:600 }}>{critCount} kritik</span>}
              {critCount > 0 && warnCount > 0 && <span style={{ marginLeft:6, marginRight:6 }}>·</span>}
              {warnCount > 0 && <span style={{ color:'#f59e0b', fontWeight:600 }}>{warnCount} uyarı</span>}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {FILTERS.map(f => (
            <button key={f.key} className={`filter-tab${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>Yükleniyor...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>✓</div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--teal)', marginBottom:6 }}>
              {filter === 'resolved' ? 'Henüz çözülmüş anomali yok' : 'Harika! Şu an aktif anomali yok'}
            </div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>
              {filter === 'resolved' ? 'Çözülen anomaliler burada görünecek.' : 'Reklam hesaplarınız normal seyrediyor.'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 1fr 130px 80px 120px', gap:8, padding:'10px 16px', borderBottom:'1px solid var(--border2)', fontSize:11, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
              <div />
              <div>Platform / Tip</div>
              <div>Değer</div>
              <div>Tarih</div>
              <div>Durum</div>
              <div style={{ textAlign:'right' }}>Aksiyon</div>
            </div>
            {visible.map((a, i) => {
              const sev = getSeverity(a);
              const color = SEVERITY_COLOR[sev] || '#f59e0b';
              const platColor = PLATFORM_COLORS[a.platform] || '#6B7280';
              const initials = (PLATFORM_LABELS[a.platform] || a.platform || '?')[0].toUpperCase();
              return (
                <div key={a.id || i} className="anomaly-row" style={{
                  display:'grid', gridTemplateColumns:'36px 1fr 1fr 130px 80px 120px',
                  gap:8, padding:'12px 16px', borderBottom:'1px solid var(--border2)', alignItems:'center',
                }}>
                  <div style={{ width:30, height:30, borderRadius:7, background:`${platColor}20`, color:platColor, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>{initials}</div>
                  <div>
                    {a.brandName && <div style={{ fontSize:10, color:'var(--teal)', fontWeight:700, marginBottom:2 }}>{a.brandName}</div>}
                    <div style={{ fontSize:13, fontWeight:600 }}>{PLATFORM_LABELS[a.platform] || a.platform}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{a.metric}</div>
                  </div>
                  <div style={{ fontFamily:'var(--mono)', fontSize:12 }}>
                    {a.actual_value ? (
                      <>
                        <span style={{ color:'var(--text1)' }}>₺{fmt(a.actual_value)}</span>
                        {a.expected_value && (
                          <span style={{ color:'var(--text3)' }}> / ₺{fmt(a.expected_value)} beklenen</span>
                        )}
                      </>
                    ) : '—'}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{timeAgo(a.detected_at)}</div>
                  <div>
                    <span style={{ fontSize:10, fontWeight:700, color, background:`${color}18`, borderRadius:4, padding:'2px 7px' }}>{sev}</span>
                  </div>
                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                    <button className="action-btn" onClick={() => setNoteTarget(a)}>Not</button>
                    {a.status !== 'resolved' && (
                      <button className="action-btn resolve" onClick={() => handleResolve(a)}>Çöz</button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ── Notification settings — DB-backed ────────────────────────────────────────
const DEFAULT_SETTINGS = { budget_delta: 50, cpa_delta: 30, roas_delta: 25, email_on: true, platform_on: true };

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width:36, height:20, borderRadius:10, border:'none', cursor:'pointer', background: on ? 'var(--teal)' : 'rgba(255,255,255,0.12)', position:'relative', transition:'background 0.2s ease', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left: on ? 18 : 3, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.2s ease' }} />
    </button>
  );
}

function NotificationSettings() {
  const { user } = useAuth();
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [loadState, setLoadState] = useState('loading'); // loading | idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getAnomalySettings()
      .then(data => {
        setS({
          budget_delta: data.budget_delta ?? 50,
          cpa_delta:    data.cpa_delta    ?? 30,
          roas_delta:   data.roas_delta   ?? 25,
          email_on:     data.email_on     ?? true,
          platform_on:  data.platform_on  ?? true,
        });
        setLoadState('idle');
      })
      .catch(() => setLoadState('idle')); // show defaults on error
  }, []);

  const update = (k, v) => setS(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setLoadState('saving'); setErrorMsg('');
    try {
      const saved = await saveAnomalySettings(s);
      setS({
        budget_delta: saved.budget_delta,
        cpa_delta:    saved.cpa_delta,
        roas_delta:   saved.roas_delta,
        email_on:     saved.email_on,
        platform_on:  saved.platform_on,
      });
      setLoadState('saved');
      setTimeout(() => setLoadState('idle'), 2500);
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Kayıt başarısız.');
      setLoadState('error');
      setTimeout(() => setLoadState('idle'), 3000);
    }
  };

  const THRESHOLDS = [
    { key:'budget_delta', label:'Bütçe sapması eşiği', hint:'Günlük harcama bu oranda artarsa alarm verir' },
    { key:'cpa_delta',    label:'CPA artış eşiği',     hint:'Dönüşüm maliyeti bu oranda artarsa alarm verir' },
    { key:'roas_delta',   label:'ROAS düşüş eşiği',    hint:'ROAS bu oranda düşerse alarm verir' },
  ];

  return (
    <div className="anom-in" style={{ background:'var(--bg2)', border:'1px solid var(--border2)', borderRadius:12, padding:'22px 24px', animationDelay:'0.2s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700 }}>Bildirim Ayarları</div>
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>Ayarlar veritabanına kaydedilir ve tüm cihazlarda geçerlidir</div>
        </div>
        {loadState === 'loading' && <span style={{ fontSize:11, color:'var(--text3)' }}>Yükleniyor...</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, marginBottom:24 }}>
        {THRESHOLDS.map(item => (
          <div key={item.key}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>{item.label}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--teal)', fontFamily:'var(--mono)' }}>%{s[item.key]}</span>
            </div>
            <input
              type="range" min={10} max={100} step={5} value={s[item.key]}
              onChange={e => update(item.key, Number(e.target.value))}
              className="settings-slider"
              disabled={loadState === 'loading'}
            />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
              <span style={{ fontSize:10, color:'var(--text3)' }}>%10</span>
              <span style={{ fontSize:10, color:'var(--text3)', textAlign:'center', flex:1 }}>{item.hint}</span>
              <span style={{ fontSize:10, color:'var(--text3)' }}>%100</span>
            </div>
          </div>
        ))}

        <div>
          <div style={{ fontSize:12, color:'var(--text3)', fontWeight:600, marginBottom:12 }}>Bildirim Kanalları</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontSize:14 }}>📧</span>
                <span style={{ fontSize:12, color:'var(--text2)' }}>E-posta bildirimleri</span>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginLeft:22 }}>
                → {user?.email || 'Hesap e-postanıza'}
                {' ve bağlı ajans/marka yöneticilerine'}
              </div>
            </div>
            <Toggle on={s.email_on} onChange={v => update('email_on', v)} />
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                <span style={{ fontSize:14 }}>🔔</span>
                <span style={{ fontSize:12, color:'var(--text2)' }}>Platform bildirimleri</span>
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginLeft:22 }}>
                → AdsLands bildirim merkezine yazar
              </div>
            </div>
            <Toggle on={s.platform_on} onChange={v => update('platform_on', v)} />
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button
          onClick={save}
          disabled={loadState === 'loading' || loadState === 'saving'}
          style={{
            padding:'9px 22px',
            background: loadState === 'saved' ? 'var(--teal)' : loadState === 'error' ? 'rgba(255,107,90,0.15)' : 'transparent',
            border:`1px solid ${loadState === 'saved' ? 'var(--teal)' : loadState === 'error' ? 'rgba(255,107,90,0.5)' : 'var(--border2)'}`,
            borderRadius:8,
            color: loadState === 'saved' ? '#0B1219' : loadState === 'error' ? 'var(--coral)' : 'var(--text2)',
            fontSize:13, fontWeight:700, cursor: (loadState === 'loading' || loadState === 'saving') ? 'not-allowed' : 'pointer',
            fontFamily:'var(--font)', transition:'all 0.2s ease', opacity: loadState === 'saving' ? 0.6 : 1,
          }}>
          {loadState === 'saving' ? 'Kaydediliyor...' : loadState === 'saved' ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
        {loadState === 'error' && errorMsg && (
          <span style={{ fontSize:12, color:'var(--coral)' }}>⚠ {errorMsg}</span>
        )}
        {loadState === 'saved' && (
          <span style={{ fontSize:12, color:'var(--teal)' }}>Ayarlar veritabanına kaydedildi. Yeni anomaliler bu eşikleri kullanacak.</span>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Anomalies() {
  const { user } = useAuth();
  const { selectedBrand } = useSelectedBrand();
  const isAgency = user?.company_type === 'agency';
  const [anomalies, setAnomalies] = useState(null);

  const load = useCallback(() => {
    if (isAgency && !selectedBrand) {
      getAgencyDashboard()
        .then(d => {
          const all = (d.clients || []).flatMap(c =>
            (c.anomalies || []).map(a => ({ ...a, brandName: c.brand?.name || c.brand?.company_name }))
          );
          setAnomalies(all);
        })
        .catch(() => setAnomalies([]));
    } else if (isAgency && selectedBrand) {
      getAgencyBrandDetail(selectedBrand.id)
        .then(d => setAnomalies(d.anomalies || []))
        .catch(() => setAnomalies([]));
    } else {
      getDashboardAnomalies()
        .then(setAnomalies)
        .catch(() => setAnomalies([]));
    }
  }, [isAgency, selectedBrand?.id]);

  useEffect(() => { setAnomalies(null); load(); }, [load]);

  const title = isAgency && selectedBrand
    ? `${selectedBrand.company_name || selectedBrand.name} — Anomaliler`
    : 'Anomaliler';

  const openCount = (anomalies || []).filter(a => a.status !== 'resolved').length;

  return (
    <div className="fade-in">
      <style>{ANIM_CSS}</style>
      <div className="topbar">
        <div className="topbar-title">{title}</div>
        <div className="topbar-right" style={{ display:'flex', alignItems:'center', gap:10 }}>
          {openCount > 0 && (
            <span style={{ background:'#ef4444', color:'#fff', borderRadius:10, padding:'2px 9px', fontSize:11, fontWeight:700 }}>{openCount}</span>
          )}
        </div>
      </div>
      <div className="content">
        <HeroSection />
        <HowItWorks />
        <AnomalyTypeCards />
        <DemoCard />
        <AnomalyListSection anomalies={anomalies} loading={anomalies === null} />
        <NotificationSettings />
      </div>
    </div>
  );
}
