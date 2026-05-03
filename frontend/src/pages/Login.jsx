import { useState, useEffect, useRef } from 'react';
import { login } from '../api';
import { useAuth } from '../context/AuthContext';
import ForgotPassword from './ForgotPassword';

// ─── Platform & animasyon sabitleri ───────────────────────────────────────────

const PLATFORMS = [
  { id: 'GA',  label: 'Google Analytics', color: '#F97316', x: 0.15, y: 0.20 },
  { id: 'G',   label: 'Google Ads',       color: '#4ADE80', x: 0.12, y: 0.45 },
  { id: 'M',   label: 'Meta Ads',         color: '#60A5FA', x: 0.18, y: 0.70 },
  { id: 'T',   label: 'TikTok',           color: '#E879F9', x: 0.55, y: 0.12 },
  { id: 'in',  label: 'LinkedIn',         color: '#38BDF8', x: 0.60, y: 0.85 },
  { id: 'AF',  label: 'AppsFlyer',        color: '#86EFAC', x: 0.75, y: 0.25 },
  { id: 'ADJ', label: 'Adjust',           color: '#FCA5A5', x: 0.80, y: 0.65 },
  { id: 'ADF', label: 'Adform',           color: '#A78BFA', x: 0.45, y: 0.92 },
];

const CENTER = { x: 0.50, y: 0.50 };

// Deterministic kontrol noktası offsetleri (platform başına)
const CP_OFFSETS = [
  [ 0.12, -0.08], [-0.10,  0.15], [ 0.08,  0.10], [-0.14, -0.12],
  [ 0.10, -0.10], [-0.08,  0.12], [ 0.06, -0.14], [-0.12,  0.06],
];

// Paket hızları (platform başına 3 paket)
const PKT_SPEEDS = [
  [0.0040, 0.0060, 0.0030],
  [0.0050, 0.0030, 0.0070],
  [0.0040, 0.0055, 0.0033],
  [0.0060, 0.0040, 0.0050],
  [0.0033, 0.0070, 0.0042],
  [0.0050, 0.0042, 0.0060],
  [0.0044, 0.0062, 0.0031],
  [0.0070, 0.0033, 0.0051],
];

// Quadratic bezier noktası
function qBez(t, x0, y0, cpx, cpy, x1, y1) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cpx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cpy + t * t * y1,
  };
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export default function Login() {
  const { saveAuth }   = useAuth();
  const [form, setForm]         = useState({ email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  // ─── Canvas animasyonu ──────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Curve data + paket state
    const curves = PLATFORMS.map((p, i) => {
      const [ox, oy] = CP_OFFSETS[i];
      return {
        p,
        cpx: p.x + (CENTER.x - p.x) * 0.4 + ox,
        cpy: p.y + (CENTER.y - p.y) * 0.4 + oy,
        pkts: PKT_SPEEDS[i].map((speed, j) => ({
          t: (j * 0.33 + i * 0.12) % 1,
          speed,
        })),
      };
    });

    let W = 0, H = 0, frame = 0;

    const resize = () => {
      const par = canvas.parentElement;
      W = par.offsetWidth;
      H = par.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = () => {
      if (!W || !H) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);

      const cx = CENTER.x * W;
      const cy = CENTER.y * H;

      // Bezier çizgileri
      curves.forEach(({ p, cpx, cpy }) => {
        ctx.beginPath();
        ctx.moveTo(p.x * W, p.y * H);
        ctx.quadraticCurveTo(cpx * W, cpy * H, cx, cy);
        ctx.strokeStyle = p.color + '3D';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Merkez glow
      const glowR = 55 + 8 * Math.sin(frame * 0.022);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, 'rgba(0,201,167,0.22)');
      grd.addColorStop(1, 'rgba(0,201,167,0)');
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      // Merkez düğüm (AdsLands "A")
      const cGrd = ctx.createLinearGradient(cx - 26, cy - 26, cx + 26, cy + 26);
      cGrd.addColorStop(0, '#00C9A7'); cGrd.addColorStop(1, '#0891B2');
      ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fillStyle = cGrd; ctx.fill();
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('A', cx, cy);

      // Platform düğümleri + akan paketler
      curves.forEach(({ p, cpx, cpy, pkts }, pi) => {
        const px = p.x * W;
        const py = p.y * H;

        // Platform glow (pulse)
        const pulseR = 28 * (1 + 0.1 * Math.sin(frame * 0.022 + pi * 0.9));
        const pgrd = ctx.createRadialGradient(px, py, 0, px, py, pulseR);
        pgrd.addColorStop(0, p.color + '55'); pgrd.addColorStop(1, p.color + '00');
        ctx.beginPath(); ctx.arc(px, py, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = pgrd; ctx.fill();

        // Platform dairesi
        ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2);
        ctx.fillStyle = p.color + 'E6'; ctx.fill();

        // Platform ID
        ctx.font = 'bold 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.id, px, py);

        // Akan paketler
        pkts.forEach(pkt => {
          pkt.t = (pkt.t + pkt.speed) % 1;
          const pos = qBez(pkt.t, px, py, cpx * W, cpy * H, cx, cy);
          const fade = pkt.t > 0.82 ? (1 - pkt.t) / 0.18 : 0.9;
          ctx.globalAlpha = fade;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = p.color; ctx.fill();
          ctx.globalAlpha = 1;
        });
      });

      frame++;
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(form);
      saveAuth(token, user);
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .lw, .lw * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important; }

        .linput {
          width: 100%; height: 52px; box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px; padding: 0 16px 0 44px;
          color: white; font-size: 14px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .linput::placeholder { color: rgba(255,255,255,0.3); }
        .linput:focus {
          border-color: rgba(0,201,167,0.5);
          box-shadow: 0 0 0 3px rgba(0,201,167,0.1);
        }

        .lbtn {
          width: 100%; height: 52px; border: none; border-radius: 12px;
          background: linear-gradient(135deg, #00C9A7 0%, #0891B2 100%);
          color: white; font-weight: 700; font-size: 15px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          cursor: pointer; transition: box-shadow 0.2s, transform 0.2s;
        }
        .lbtn:hover:not(:disabled) {
          box-shadow: 0 8px 30px rgba(0,201,167,0.35);
          transform: translateY(-1px);
        }
        .lbtn:active:not(:disabled) { transform: translateY(0); }
        .lbtn:disabled { opacity: 0.7; cursor: not-allowed; }

        .lforgot { color: #00C9A7; font-size: 13px; cursor: pointer; font-weight: 500; }
        .lforgot:hover { text-decoration: underline; }

        @media (max-width: 768px) {
          .lleft  { display: none !important; }
          .lright { flex: 1 !important; }
        }
      `}</style>

      <div className="lw" style={{
        minHeight: '100vh', display: 'flex',
        background: 'radial-gradient(ellipse at 20% 50%, #0D1B2A 0%, #0A0F1E 60%, #060810 100%)',
      }}>

        {/* ── Sol yarı — canvas animasyonu ────────────────────────────── */}
        <div className="lleft" style={{ flex: '0 0 62%', position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />

          {/* Platform etiketleri */}
          {PLATFORMS.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: `${p.x * 100}%`,
              top:  `${p.y * 100}%`,
              transform: 'translate(-50%, 24px)',
              fontSize: 10, color: p.color, fontWeight: 600,
              whiteSpace: 'nowrap', pointerEvents: 'none',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}>
              {p.label}
            </div>
          ))}

        </div>

        {/* ── Sağ yarı — form ─────────────────────────────────────────── */}
        <div className="lright" style={{
          flex: '0 0 38%', display: 'flex',
          alignItems: 'center', justifyContent: 'flex-start',
          minHeight: '100vh', padding: '40px 40px 40px 32px',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,201,167,0.12)',
            borderRadius: 24, padding: '52px 48px',
            width: '100%', maxWidth: 420, boxSizing: 'border-box',
            boxShadow: '0 0 0 1px rgba(0,201,167,0.08), 0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(0,201,167,0.04)',
          }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="url(#llg)" strokeWidth="2"/>
                <circle cx="14" cy="14" r="4" fill="url(#llg)"/>
                <defs>
                  <linearGradient id="llg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00C9A7"/>
                    <stop offset="1" stopColor="#0891B2"/>
                  </linearGradient>
                </defs>
              </svg>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'white' }}>
                Ads<span style={{ color: '#00C9A7' }}>Lands</span>
              </span>
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>
              Tekrar hoş geldiniz
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 32px 0' }}>
              Tüm reklam verileriniz, tek akıllı platformda.
            </p>

            <form onSubmit={handleSubmit}>

              {/* E-posta */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <svg
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#00C9A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <polyline points="2,4 12,13 22,4"/>
                </svg>
                <input
                  className="linput"
                  type="email"
                  placeholder="ornek@sirket.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              {/* Şifre */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <svg
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#00C9A7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <input
                  className="linput"
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              {/* Şifremi Unuttum */}
              <div style={{ textAlign: 'right', marginBottom: 24 }}>
                <span className="lforgot" onClick={() => setShowForgot(true)}>
                  Şifremi Unuttum
                </span>
              </div>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, color: '#F87171', marginBottom: 16,
                }}>
                  {error}
                </div>
              )}

              <button type="submit" className="lbtn" disabled={loading}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

          </div>
        </div>

      </div>
    </>
  );
}
