import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotCrossfade } from '../components/ScreenshotPanel';

const SLICES = [
  { label: 'Google Ads', pct: 0.50, color: '#4285F4', amount: '₺75.000' },
  { label: 'Meta Ads',   pct: 0.30, color: '#1877F2', amount: '₺45.000' },
  { label: 'TikTok',     pct: 0.20, color: '#FF0050', amount: '₺30.000' },
];

function polarToCart(cx, cy, r, deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutPath(cx, cy, r, ir, s, e) {
  const p1 = polarToCart(cx, cy, r, s);
  const p2 = polarToCart(cx, cy, r, e);
  const p3 = polarToCart(cx, cy, ir, e);
  const p4 = polarToCart(cx, cy, ir, s);
  const lg = e - s > 180 ? 1 : 0;
  return `M${p1.x} ${p1.y} A${r} ${r} 0 ${lg} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${ir} ${ir} 0 ${lg} 0 ${p4.x} ${p4.y}Z`;
}

export default function Scene05_Butce() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [375, 390], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const donutP  = interpolate(frame, [35, 180], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const totalVal = Math.round(interpolate(frame, [50, 200], [0, 150000], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const totalOp  = interpolate(frame, [45, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const legendOp = interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const alertSpring = spring({ frame: Math.max(0, frame - 148), fps, config: { damping: 16, stiffness: 120 } });
  const alertX  = interpolate(alertSpring, [0, 1], [300, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const alertOp = interpolate(alertSpring, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const CX = 110, CY = 110, R = 90, IR = 52;
  let startDeg = 0;
  const paths = SLICES.map((s) => {
    const full = s.pct * 360;
    const anim = full * donutP;
    const d = donutPath(CX, CY, R, IR, startDeg, startDeg + anim);
    startDeg += full;
    return d;
  });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* ── Sol panel ─────────────────────────────────────── */}
      <div style={{
        width: 540, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Bütçe Yönetimi
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Bütçe Planlama
          </h2>
        </div>

        {/* Donut + legend */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', marginBottom: 24 }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg width={220} height={220} viewBox="0 0 220 220">
              <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.bg2} strokeWidth={R - IR} />
              {paths.map((d, i) => (
                <path key={i} d={d} fill={SLICES[i].color}
                  style={{ filter: `drop-shadow(0 0 6px ${SLICES[i].color}55)` }} />
              ))}
            </svg>
            <div style={{
              position: 'absolute', top: CY, left: CX,
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', opacity: totalOp,
            }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>TOPLAM</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>
                ₺{totalVal.toLocaleString('tr-TR')}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ opacity: legendOp }}>
            {SLICES.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>{s.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anomali bildirimi */}
        <div style={{
          opacity: alertOp, transform: `translateX(${alertX}px)`,
          background: 'rgba(239,159,39,0.12)',
          border: '1px solid rgba(239,159,39,0.4)',
          borderRadius: 12, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 3 }}>Anomali Tespit Edildi</div>
              <div style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>Google Ads harcaması %180 arttı</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>₺2.400 → ₺6.720</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sağ panel (screenshot crossfade) ──────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotCrossfade
          file1="screenshots/butce.png"
          file2="screenshots/anomali.png"
          transitionStart={180}
          transitionDuration={22}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
