import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

const ALERTS = [
  { platform: 'Google Ads', msg: 'Günlük bütçe %142 aşıldı',           color: '#EF4444', time: '14:23' },
  { platform: 'Meta',       msg: 'CPA hedef değerinin 2.3x üzerinde',   color: '#F59E0B', time: '15:07' },
];

export default function Scene04_Anomali() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [375, 390], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const pulse  = 1 + 0.05 * Math.sin(frame * 0.18);
  const warnOp = interpolate(frame, [20, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const blink  = Math.floor(frame / 8) % 2 === 0;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      <div style={{
        width: 500, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Anomali Tespiti
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Siz Fark Etmeden<br />Sistem Uyarır
          </h2>
        </div>

        {/* Warning icon */}
        <div style={{ opacity: warnOp, transform: `scale(${pulse})`, marginBottom: 24, width: 'fit-content' }}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <polygon points="26,4 48,46 4,46" fill="#EF444420" stroke="#EF4444" strokeWidth={1.5} strokeLinejoin="round" />
            <line x1={26} y1={20} x2={26} y2={32} stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={26} cy={38} r={2} fill="#EF4444" />
          </svg>
        </div>

        {/* Alert kutuları */}
        {ALERTS.map((a, i) => {
          const sp = spring({ frame: Math.max(0, frame - 65 - i * 30), fps, config: { damping: 14, stiffness: 200 } });
          const op = interpolate(sp, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const ty = interpolate(sp, [0, 1], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{
              opacity: op, transform: `translateY(${ty}px)`,
              marginBottom: 10,
              background: a.color + '14', border: `1px solid ${a.color}44`,
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: a.color, marginTop: 4, flexShrink: 0,
                opacity: blink ? 1 : 0.3,
              }} />
              <div>
                <div style={{ fontSize: 10, color: a.color, fontWeight: 700, marginBottom: 3 }}>
                  {a.platform} · {a.time}
                </div>
                <div style={{ fontSize: 13, color: C.white, fontWeight: 600 }}>{a.msg}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel file="screenshots/anomali.png" style={{ width: '100%' }} />
      </div>
    </div>
  );
}
