import { useCurrentFrame, interpolate } from 'remotion';
import { C, font } from '../colors';

export default function Scene01_Hook() {
  const frame = useCurrentFrame();

  const fadeOut = interpolate(frame, [135, 150], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const line1Op = interpolate(frame, [5, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line1Y  = interpolate(frame, [5, 35], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const accentW = interpolate(frame, [40, 80], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const line2Op = interpolate(frame, [70, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const line2Y  = interpolate(frame, [70, 110], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 120px', boxSizing: 'border-box',
    }}>
      <div style={{ opacity: line1Op, transform: `translateY(${line1Y}px)`, marginBottom: 8, textAlign: 'center' }}>
        <h1 style={{ fontSize: 64, fontWeight: 800, color: C.white, margin: 0, letterSpacing: -1.5 }}>
          Veriler orada.
        </h1>
        <div style={{
          height: 3, marginTop: 12,
          background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`,
          width: `${accentW}%`, marginLeft: 'auto', marginRight: 'auto',
          borderRadius: 2,
        }} />
      </div>

      <div style={{ opacity: line2Op, transform: `translateY(${line2Y}px)`, marginTop: 28, textAlign: 'center' }}>
        <p style={{ fontSize: 30, fontWeight: 400, color: C.muted, margin: 0, lineHeight: 1.5 }}>
          Soru şu: onları gerçekten görüyor musunuz?
        </p>
      </div>
    </div>
  );
}
