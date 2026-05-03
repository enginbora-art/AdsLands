import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

const PLATFORMS = [
  { name: 'Google Ads', color: '#4285F4', abbr: 'G' },
  { name: 'Meta',       color: '#1877F2', abbr: 'M' },
  { name: 'TikTok',     color: '#FF0050', abbr: 'T' },
  { name: 'LinkedIn',   color: '#0A66C2', abbr: 'in' },
  { name: 'Adform',     color: '#FF6B35', abbr: 'A' },
  { name: 'Adjust',     color: '#00C67F', abbr: 'Aj' },
  { name: 'AppsFlyer',  color: '#8B5CF6', abbr: 'AF' },
];

export default function Scene02_Dashboard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [435, 450], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const platformSprings = PLATFORMS.map((_, i) =>
    spring({ frame: Math.max(0, frame - 35 - i * 18), fps, config: { damping: 16, stiffness: 200 } })
  );

  const liveOp = interpolate(frame, [190, 220], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blink  = Math.floor(frame / 8) % 2 === 0;

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
            Tek Ekran
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Tüm Platformlar<br />Bir Arada
          </h2>
        </div>

        {/* Platform badge grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
          {PLATFORMS.map((p, i) => {
            const sp = platformSprings[i];
            const op = interpolate(sp, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const ty = interpolate(sp, [0, 1], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={p.name} style={{
                opacity: op, transform: `translateY(${ty}px)`,
                display: 'flex', alignItems: 'center', gap: 8,
                background: p.color + '1A', border: `1px solid ${p.color}44`,
                borderRadius: 10, padding: '8px 14px',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>
                  {p.abbr[0]}
                </div>
                <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>{p.name}</span>
              </div>
            );
          })}
        </div>

        {/* Gerçek zamanlı badge */}
        <div style={{ opacity: liveOp, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal, opacity: blink ? 1 : 0.4 }} />
          <span style={{ fontSize: 12, color: C.teal, fontWeight: 700 }}>Gerçek Zamanlı</span>
        </div>
      </div>

      {/* Sağ panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel file="screenshots/dashboard.png" style={{ width: '100%' }} />
      </div>
    </div>
  );
}
