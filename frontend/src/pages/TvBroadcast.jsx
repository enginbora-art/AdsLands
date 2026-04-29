import { useState } from 'react';
import { tvEarlyAccess } from '../api';

// ── Animasyon CSS ──────────────────────────────────────────────────────────────

const CSS = `
@keyframes bcastPulse {
  0%   { transform: scale(1);   opacity: 0.7; }
  100% { transform: scale(2.8); opacity: 0; }
}
@keyframes liveBlink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
@keyframes tvFadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scanLine {
  0%   { top: 0; }
  100% { top: 100%; }
}
@keyframes waveExpand {
  0%   { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(2.2); opacity: 0; }
}
.bc-card:hover {
  border-color: rgba(29,158,117,0.5) !important;
  transform: translateY(-3px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.3);
}
.bc-card { transition: border-color 0.15s, transform 0.2s, box-shadow 0.2s; }
.bc-feat:hover { background: rgba(29,158,117,0.08) !important; }
.bc-feat { transition: background 0.15s; }
`;

// ── TV Ekranı SVG Mockup ───────────────────────────────────────────────────────

function TvMockup() {
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none' }}>
      {/* Broadcast dalgaları */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 0 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 200, height: 200, borderRadius: '50%',
            border: '1px solid rgba(29,158,117,0.3)',
            animation: `waveExpand 3s ease-out ${i * 0.9}s infinite`,
          }} />
        ))}
      </div>

      {/* TV gövde */}
      <svg width="320" height="230" viewBox="0 0 320 230" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.5))' }}>
        {/* Arka ışık */}
        <defs>
          <radialGradient id="tvGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1D9E75" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="screenGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#0F2820" stopOpacity="1" />
            <stop offset="100%" stopColor="#0a1810" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="bezelGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2535" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
          <clipPath id="screenClip">
            <rect x="22" y="18" width="276" height="172" rx="4" />
          </clipPath>
        </defs>

        {/* Glow halo */}
        <ellipse cx="160" cy="110" rx="140" ry="90" fill="url(#tvGlow)" />

        {/* TV çerçeve */}
        <rect x="8" y="8" width="304" height="196" rx="12" fill="url(#bezelGrad)" />
        <rect x="8" y="8" width="304" height="196" rx="12" fill="none" stroke="#2D3748" strokeWidth="1" />

        {/* Ekran */}
        <rect x="22" y="18" width="276" height="172" rx="4" fill="url(#screenGlow)" />

        {/* Tarama çizgisi animasyonu */}
        <rect x="22" y="18" width="276" height="2" rx="1" fill="rgba(29,158,117,0.15)" clipPath="url(#screenClip)">
          <animateTransform attributeName="transform" type="translate" values="0,0;0,172" dur="4s" repeatCount="indefinite" />
        </rect>

        {/* Ekran içeriği — kanal listesi */}
        <g clipPath="url(#screenClip)">
          {[
            { y: 40, name: 'Kanal D', color: '#E30613', prog: 65 },
            { y: 68, name: 'Show TV', color: '#FF6B00', prog: 80 },
            { y: 96, name: 'ATV',     color: '#00843D', prog: 45 },
            { y: 124, name: 'FOX TV', color: '#003087', prog: 92 },
          ].map(ch => (
            <g key={ch.name}>
              <rect x="30" y={ch.y - 10} width="260" height="22" rx="3" fill={`${ch.color}10`} />
              <circle cx="46" cy={ch.y + 1} r="5" fill={ch.color} />
              <text x="60" y={ch.y + 5} fill="rgba(255,255,255,0.85)" fontSize="11" fontFamily="Arial" fontWeight="600">{ch.name}</text>
              <rect x="140" y={ch.y - 3} width="130" height="6" rx="3" fill="rgba(255,255,255,0.06)" />
              <rect x="140" y={ch.y - 3} width={Math.round(130 * ch.prog / 100)} height="6" rx="3" fill={ch.color} opacity="0.7" />
            </g>
          ))}

          {/* Canlı tespit bildirimi */}
          <rect x="30" y="154" width="260" height="24" rx="4" fill="rgba(16,185,129,0.15)" />
          <rect x="30" y="154" width="260" height="24" rx="4" fill="none" stroke="rgba(16,185,129,0.4)" strokeWidth="1" />
          <circle cx="44" cy="166" r="4" fill="#10B981">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text x="54" y="170" fill="#10B981" fontSize="10" fontFamily="Arial" fontWeight="700">Kanal D — Reklam tespit edildi! %94 güven</text>
        </g>

        {/* CANLI badge */}
        <rect x="250" y="26" width="46" height="18" rx="4" fill="#EF4444" />
        <text x="273" y="39" textAnchor="middle" fill="white" fontSize="10" fontFamily="Arial" fontWeight="700" style={{ animation: 'liveBlink 1.5s ease-in-out infinite' }}>
          ● CANLI
        </text>
      </svg>

      {/* TV ayağı */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 48, height: 16, background: '#1A2030', borderRadius: '0 0 4px 4px' }} />
        <div style={{ width: 80, height: 6, background: '#1A2030', borderRadius: 3, marginTop: 0 }} />
      </div>
    </div>
  );
}

// ── Nasıl Çalışır Adımı ────────────────────────────────────────────────────────

function HowStep({ num, icon, title, desc, delay }) {
  return (
    <div className="bc-card" style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '28px 24px', textAlign: 'center',
      animation: `tvFadeUp 0.5s ease ${delay}s both`,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
        {icon}
      </div>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1D9E75', color: '#0B1219', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{num}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#fff' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

// ── Özellik Kartı ──────────────────────────────────────────────────────────────

function FeatureItem({ icon, title, desc }) {
  return (
    <div className="bc-feat" style={{ display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(29,158,117,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

// ── Erken Erişim Formu ─────────────────────────────────────────────────────────

function EarlyAccessForm() {
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) return;
    setStatus('loading');
    try {
      const res = await tvEarlyAccess(form);
      setStatus('success');
      setMsg(res.message || 'Listeye eklendiniz!');
    } catch (err) {
      setStatus('error');
      setMsg(err.response?.data?.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  const inSt = {
    width: '100%', padding: '12px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14,
    fontFamily: 'var(--font)', boxSizing: 'border-box', outline: 'none',
  };

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>Listeye Eklendiniz!</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          TV Ad Verification beta'ya geçtiğimizde sizi ilk haberdar edeceğiz.<br />Teşekkürler!
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 12 }}>
        <input style={inSt} placeholder="Ad Soyad" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
      </div>
      <div style={{ marginBottom: 16 }}>
        <input style={inSt} type="email" placeholder="E-posta adresi" value={form.email} onChange={e => set('email', e.target.value)} required />
      </div>
      {status === 'error' && <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>{msg}</div>}
      <button type="submit" disabled={status === 'loading'} style={{
        width: '100%', padding: '13px', background: status === 'loading' ? 'rgba(29,158,117,0.4)' : 'linear-gradient(135deg, #1D9E75, #0d8a63)',
        border: 'none', borderRadius: 9, color: '#0B1219', fontWeight: 700, fontSize: 15,
        cursor: status === 'loading' ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)',
      }}>
        {status === 'loading' ? 'Kaydediliyor...' : '🚀 Beta Listesine Katıl'}
      </button>
    </form>
  );
}

// ── Ana Bileşen ────────────────────────────────────────────────────────────────

export default function TvBroadcast() {
  return (
    <div className="fade-in">
      <style>{CSS}</style>

      <div className="topbar">
        <div className="topbar-title">TV Ad Verification</div>
        <div className="topbar-actions">
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', letterSpacing: '0.5px' }}>
            YAKINDA GELİYOR
          </span>
        </div>
      </div>

      <div className="content" style={{ padding: 0 }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #0a1612 0%, #0F1117 50%, #0d0e15 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '72px 48px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 48, overflow: 'hidden', position: 'relative',
        }}>
          {/* Arka plan ışımaları */}
          <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(29,158,117,0.05) 0%, transparent 70%)', top: -200, right: 100, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', bottom: -100, left: 100, pointerEvents: 'none' }} />

          <div style={{ flex: 1, maxWidth: 540, position: 'relative' }}>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '5px 14px', marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', animation: 'liveBlink 1.5s ease-in-out infinite', display: 'inline-block' }} />
              <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, letterSpacing: '1px' }}>7/24 CANLI İZLEME</span>
            </div>

            <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.2, margin: '0 0 18px', color: '#fff' }}>
              TV Reklam<br />
              <span style={{ background: 'linear-gradient(90deg, #1D9E75, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Doğrulama Sistemi
              </span>
            </h1>

            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, margin: '0 0 32px' }}>
              AI destekli otomatik TV reklam tespit teknolojisi. Reklamınızın yayınlandığı anı kaçırmayın — screenshot, bildirim ve tam raporlama ile.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: '📺', text: '12 Türk TV kanalını 7/24 tarar' },
                { icon: '⚡', text: 'Tespit anında anlık bildirim gönderir' },
                { icon: '📸', text: 'Yayın anının ekran görüntüsünü kaydeder' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(29,158,117,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            {/* Q3 2026 */}
            <div style={{ marginTop: 32, display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 18px' }}>
              <span style={{ fontSize: 18 }}>🗓</span>
              <div>
                <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, letterSpacing: '0.5px' }}>TAHMİNİ LANSMAN</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Q3 2026 — Yakında</div>
              </div>
            </div>
          </div>

          {/* TV Mockup */}
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            <TvMockup />
          </div>
        </div>

        {/* ── Nasıl Çalışır ──────────────────────────────────────────────── */}
        <div style={{ padding: '72px 48px', background: 'var(--bg)' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>Süreç</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Nasıl Çalışır?</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Üç adımda otomatik TV reklam doğrulama</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 860, margin: '0 auto', position: 'relative' }}>
            {/* Bağlantı okları */}
            <div style={{ position: 'absolute', top: '50px', left: '33%', width: '34%', height: 1, background: 'linear-gradient(to right, rgba(29,158,117,0.4), rgba(139,92,246,0.4))', pointerEvents: 'none' }} />

            <HowStep num="1" icon="📤" title="Reklam Videonuzu Yükleyin" desc="Yayınlanacak reklam filmini platforma yükleyin. Sistem ses parmak izi oluşturur." delay={0.1} />
            <HowStep num="2" icon="🔍" title="AI Tüm Kanalları İzler" desc="Yapay zeka 12 Türk TV kanalını gerçek zamanlı olarak 7/24 analiz eder." delay={0.2} />
            <HowStep num="3" icon="✅" title="Anında Tespit Bildirimi" desc="Reklamınız yayınlandığında screenshot ile birlikte anında bildirim alırsınız." delay={0.3} />
          </div>
        </div>

        {/* ── Özellikler ──────────────────────────────────────────────────── */}
        <div style={{ padding: '64px 48px', background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: 'var(--teal)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>Özellikler</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Neler Sunuyoruz?</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 900, margin: '0 auto' }}>
            {[
              { icon: '🎯', title: 'Otomatik Tespit', desc: 'Ses parmak izi teknolojisi ile reklamlar manuel kontrol olmadan tespit edilir.' },
              { icon: '📸', title: 'Anlık Screenshot', desc: 'Reklamın yayın anının ekran görüntüsü alınır ve raporlanır.' },
              { icon: '🔔', title: 'Anlık Bildirim', desc: 'Platform içi ve e-posta bildirimi ile tespit anında haberdar olun.' },
              { icon: '📊', title: 'Detaylı Raporlama', desc: 'Yayın geçmişi, kanal bazlı analiz ve GRP doğrulama raporları.' },
              { icon: '🔒', title: 'Gizlilik Güvencesi', desc: 'Screenshot\'lar 3 gün sonra otomatik silinir. Veriler şifreli saklanır.' },
              { icon: '📺', title: '12 Ana Kanal', desc: 'TRT1, Kanal D, Show TV, ATV, Star TV, FOX, TV8 ve daha fazlası.' },
            ].map(f => <FeatureItem key={f.title} {...f} />)}
          </div>
        </div>

        {/* ── Kanal Listesi ───────────────────────────────────────────────── */}
        <div style={{ padding: '48px 48px', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>İzlenen Kanallar</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Sistemin aktif olduğu Türk TV kanalları</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 700, margin: '0 auto' }}>
            {[
              { name: 'TRT 1', color: '#1B4FBF' }, { name: 'Kanal D', color: '#E30613' },
              { name: 'Show TV', color: '#FF6B00' }, { name: 'ATV', color: '#00843D' },
              { name: 'Star TV', color: '#B8A000' }, { name: 'FOX TV', color: '#003087' },
              { name: 'TV8', color: '#E4002B' }, { name: 'TRT 2', color: '#1B4FBF' },
              { name: 'CNN Türk', color: '#CC0000' }, { name: 'NTV', color: '#005EB8' },
              { name: 'Habertürk', color: '#FF0000' }, { name: 'TV360', color: '#6B7280' },
            ].map(ch => (
              <div key={ch.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 7, background: `${ch.color}14`, border: `1px solid ${ch.color}30`, fontSize: 12, fontWeight: 600, color: ch.color }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                {ch.name}
              </div>
            ))}
          </div>
        </div>

        {/* ── Erken Erişim ───────────────────────────────────────────────── */}
        <div style={{ padding: '72px 48px', background: 'linear-gradient(135deg, #0a1c15 0%, #0d0f1a 100%)', borderTop: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(29,158,117,0.15)', border: '1px solid rgba(29,158,117,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 20px' }}>
              🚀
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12, color: '#fff' }}>Beta'ya Katılın</div>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 32 }}>
              TV Ad Verification'ın beta sürümüne erken erişim için listeye katılın. Lansman anında ilk haberdar olan siz olun.
            </p>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 28px' }}>
              <EarlyAccessForm />
            </div>

            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              <span>🔒 Spam göndermiyoruz</span>
              <span>·</span>
              <span>📅 Q3 2026 lansman</span>
              <span>·</span>
              <span>✉️ Tek e-posta</span>
            </div>
          </div>
        </div>

        {/* ── Alt bilgi ───────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 48px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            TV Ad Verification — AdsLands Platformu
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#F59E0B' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B', animation: 'liveBlink 2s ease-in-out infinite', display: 'inline-block' }} />
            Geliştirme devam ediyor — Q3 2026
          </div>
        </div>

      </div>
    </div>
  );
}
