import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { C, font } from '../colors';

const METRICS = [
  { label: 'ROAS',       value: '3.2x',  color: '#22C55E', icon: '📈' },
  { label: 'CPA',        value: '₺42',   color: C.teal,    icon: '🎯' },
  { label: 'CTR',        value: '2.8%',  color: '#818CF8', icon: '👆' },
  { label: 'Impression', value: '1.2M',  color: '#F59E0B', icon: '👁' },
  { label: 'Conversion', value: '4.1%',  color: '#EC4899', icon: '✅' },
];

export default function Scene03_Butce() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [585, 600], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const metricSprings = METRICS.map((_, i) =>
    spring({ frame: Math.max(0, frame - 40 - i * 22), fps, config: { damping: 16, stiffness: 200 } })
  );

  // Üst screenshot (butce.png) — hemen başlıyor
  const scale1  = interpolate(frame, [0, 20], [1.05, 1.0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entry1  = interpolate(frame, [0, 14], [0, 1],       { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Alt screenshot (kanal-analizi.png) — 90 kare gecikmeli
  const scale2  = interpolate(frame, [90, 110], [1.05, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entry2  = interpolate(frame, [90, 104], [0, 1],      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* Sol panel */}
      <div style={{
        width: 480, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Anlık Takip
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            KPI & Bütçe<br />Yönetimi
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {METRICS.map((m, i) => {
            const sp = metricSprings[i];
            const op = interpolate(sp, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const tx = interpolate(sp, [0, 1], [-16, 0],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={m.label} style={{
                opacity: op, transform: `translateX(${tx}px)`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: m.color + '14', border: `1px solid ${m.color}33`,
                borderRadius: 10, padding: '10px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                  <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 16, color: m.color, fontWeight: 700 }}>{m.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sağ panel — üst+alt bölünmüş */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', padding: '40px 60px 40px 20px' }}>
        <div style={{
          flex: 1, opacity: entry1,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}>
          {/* Üst %55 — butce.png */}
          <div style={{ flex: '0 0 55%', overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale1})`, transformOrigin: 'center top' }}>
              <Img src={staticFile('screenshots/butce.png')} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          {/* Teal divider */}
          <div style={{ height: 1, background: C.teal, opacity: 0.6, flexShrink: 0 }} />

          {/* Alt %45 — kanal-analizi.png */}
          <div style={{ flex: '0 0 45%', overflow: 'hidden', opacity: entry2 }}>
            <div style={{ transform: `scale(${scale2})`, transformOrigin: 'center top' }}>
              <Img src={staticFile('screenshots/kanal-analizi.png')} style={{ width: '100%', display: 'block' }} />
            </div>
          </div>

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #0F1117 0%, rgba(15,17,23,0.15) 40%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* Top teal accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${C.teal}99, transparent)`,
          }} />
        </div>
      </div>
    </div>
  );
}
