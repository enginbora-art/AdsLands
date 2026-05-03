import { useState, useEffect, useRef } from 'react';
import { login } from '../api';
import { useAuth } from '../context/AuthContext';
import ForgotPassword from './ForgotPassword';

// ─── Nebula node sabitleri ────────────────────────────────────────────────────
// ps = pulse speed (rad/frame), po = pulse phase offset

const NODES = [
  // Dış halka — r 10-14, köşelere yayılmış (~0.40-0.46 mesafe)
  { x: 0.84, y: 0.26, r: 12, color: '#60A5FA', ps: 0.048, po: 0.0,  cpOff: [ 0.05,  0.12] },
  { x: 0.16, y: 0.22, r: 14, color: '#F97316', ps: 0.036, po: 1.2,  cpOff: [-0.10, -0.08] },
  { x: 0.13, y: 0.72, r: 11, color: '#E879F9', ps: 0.052, po: 2.4,  cpOff: [-0.12,  0.06] },
  { x: 0.79, y: 0.85, r: 13, color: '#4ADE80', ps: 0.040, po: 0.8,  cpOff: [ 0.08, -0.10] },
  // Orta halka — r 6-8, kenar ortalara (~0.28-0.34 mesafe)
  { x: 0.80, y: 0.45, r: 7,  color: '#38BDF8', ps: 0.058, po: 1.5,  cpOff: [ 0.04, -0.12] },
  { x: 0.58, y: 0.19, r: 8,  color: '#A78BFA', ps: 0.044, po: 0.3,  cpOff: [-0.08,  0.06] },
  { x: 0.24, y: 0.38, r: 6,  color: '#86EFAC', ps: 0.062, po: 2.0,  cpOff: [ 0.10,  0.08] },
  { x: 0.32, y: 0.75, r: 7,  color: '#FCA5A5', ps: 0.038, po: 3.1,  cpOff: [-0.06, -0.10] },
  { x: 0.60, y: 0.76, r: 8,  color: '#F59E0B', ps: 0.046, po: 1.8,  cpOff: [ 0.10,  0.06] },
  // İç halka — r 3-4, merkeze yakın (~0.12-0.16 mesafe)
  { x: 0.64, y: 0.45, r: 4,  color: '#00C9A7', ps: 0.064, po: 0.5,  cpOff: [ 0.04, -0.08] },
  { x: 0.49, y: 0.37, r: 3,  color: '#F97316', ps: 0.070, po: 2.2,  cpOff: [-0.06,  0.04] },
  { x: 0.34, y: 0.49, r: 4,  color: '#E879F9', ps: 0.056, po: 1.0,  cpOff: [-0.04, -0.06] },
  { x: 0.46, y: 0.64, r: 3,  color: '#60A5FA', ps: 0.060, po: 2.8,  cpOff: [ 0.06,  0.04] },
  { x: 0.60, y: 0.56, r: 4,  color: '#4ADE80', ps: 0.066, po: 0.2,  cpOff: [ 0.04,  0.06] },
];

const CENTER = { x: 0.50, y: 0.50 };

// Paket hızları (node başına 2 paket)
const PKT_SPEEDS = [
  [0.0040, 0.0060], [0.0050, 0.0035], [0.0045, 0.0065], [0.0055, 0.0040],
  [0.0048, 0.0032], [0.0062, 0.0042], [0.0038, 0.0058], [0.0052, 0.0068],
  [0.0044, 0.0030], [0.0070, 0.0050], [0.0055, 0.0038], [0.0042, 0.0064],
  [0.0060, 0.0044], [0.0035, 0.0055],
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
    const curves = NODES.map((n, i) => {
      const [ox, oy] = n.cpOff;
      return {
        n,
        cpx: n.x + (CENTER.x - n.x) * 0.4 + ox,
        cpy: n.y + (CENTER.y - n.y) * 0.4 + oy,
        pkts: PKT_SPEEDS[i].map((speed, j) => ({
          t: (j * 0.5 + i * 0.07) % 1,
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
      curves.forEach(({ n, cpx, cpy }) => {
        ctx.beginPath();
        ctx.moveTo(n.x * W, n.y * H);
        ctx.quadraticCurveTo(cpx * W, cpy * H, cx, cy);
        ctx.strokeStyle = n.color + '3D';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Merkez glow (güçlü)
      const glowR = 70 + 12 * Math.sin(frame * 0.022);
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, 'rgba(0,201,167,0.35)');
      grd.addColorStop(0.4, 'rgba(0,201,167,0.12)');
      grd.addColorStop(1, 'rgba(0,201,167,0)');
      ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd; ctx.fill();

      // Merkez düğüm — 30px, "A"
      const cGrd = ctx.createLinearGradient(cx - 30, cy - 30, cx + 30, cy + 30);
      cGrd.addColorStop(0, '#00C9A7'); cGrd.addColorStop(1, '#0891B2');
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fillStyle = cGrd; ctx.fill();
      ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('A', cx, cy);

      // Node düğümleri + akan paketler
      curves.forEach(({ n, cpx, cpy, pkts }) => {
        const px = n.x * W;
        const py = n.y * H;

        // Pulse scale: 1.0 → 1.15 → 1.0
        const scale = 1.0 + 0.075 * (1 + Math.sin(frame * n.ps + n.po));
        const actualR = n.r * scale;

        // Node glow
        const glowNode = actualR * 2.8;
        const pgrd = ctx.createRadialGradient(px, py, 0, px, py, glowNode);
        pgrd.addColorStop(0, n.color + '55'); pgrd.addColorStop(1, n.color + '00');
        ctx.beginPath(); ctx.arc(px, py, glowNode, 0, Math.PI * 2);
        ctx.fillStyle = pgrd; ctx.fill();

        // Node dairesi (metin yok)
        ctx.beginPath(); ctx.arc(px, py, actualR, 0, Math.PI * 2);
        ctx.fillStyle = n.color + 'E6'; ctx.fill();

        // Akan paketler
        pkts.forEach(pkt => {
          pkt.t = (pkt.t + pkt.speed) % 1;
          const pos = qBez(pkt.t, px, py, cpx * W, cpy * H, cx, cy);
          const fade = pkt.t > 0.82 ? (1 - pkt.t) / 0.18 : 0.9;
          ctx.globalAlpha = fade;
          ctx.beginPath(); ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = n.color; ctx.fill();
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
      window.location.replace(user.is_platform_admin ? '/admin' : '/dashboard');
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
          box-shadow: 0 0 20px rgba(0,201,167,0.35), 0 0 40px rgba(0,201,167,0.15);
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
