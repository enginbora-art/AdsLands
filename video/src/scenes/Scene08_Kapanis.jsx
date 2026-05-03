import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';

export default function Scene08_Kapanis() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AdsLands — spring scale from center
  const logoSpring = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 18, stiffness: 120 } });
  const logoScale  = interpolate(logoSpring, [0, 1], [0.45, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoOp     = interpolate(logoSpring, [0, 0.4], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const taglineOp = interpolate(frame, [60, 100], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineY  = interpolate(frame, [60, 100], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const dividerW  = interpolate(frame, [100, 140], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const urlOp = interpolate(frame, [140, 180], [0, 1],  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const urlY  = interpolate(frame, [140, 180], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Ambient glow pulse
  const glowScale = 1 + 0.04 * Math.sin(frame * 0.08);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: `radial-gradient(ellipse at center, ${C.teal}20 0%, ${C.bg} 65%)`,
      fontFamily: font,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 600, height: 400,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${C.teal}16 0%, transparent 70%)`,
        transform: `scale(${glowScale})`,
        pointerEvents: 'none',
      }} />

      {/* AdsLands */}
      <div style={{ opacity: logoOp, transform: `scale(${logoScale})`, marginBottom: 12, textAlign: 'center' }}>
        <h1 style={{
          fontSize: 80, fontWeight: 800, color: C.white, margin: 0, letterSpacing: -2,
          textShadow: `0 0 50px ${C.teal}55`,
        }}>
          AdsLands
        </h1>
      </div>

      {/* Tagline */}
      <div style={{ opacity: taglineOp, transform: `translateY(${taglineY}px)`, marginBottom: 32, textAlign: 'center' }}>
        <p style={{
          fontSize: 20, fontWeight: 400, color: C.muted,
          margin: 0, lineHeight: 1.6, maxWidth: 580,
        }}>
          Verileriniz konuşuyor — AI dinliyor, siz karar veriyorsunuz.
        </p>
      </div>

      {/* Divider */}
      <div style={{
        height: 2, marginBottom: 28,
        background: `linear-gradient(90deg, transparent, ${C.teal}, transparent)`,
        width: `${dividerW * 0.6}px`, // pixel cinsinden, max ~360px
        borderRadius: 2,
      }} />

      {/* URL */}
      <div style={{ opacity: urlOp, transform: `translateY(${urlY}px)` }}>
        <span style={{
          fontSize: 18, fontWeight: 700, color: C.teal,
          letterSpacing: 1.5,
        }}>
          adslands.com
        </span>
      </div>
    </div>
  );
}
