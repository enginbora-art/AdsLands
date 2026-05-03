import { Img, staticFile, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../colors';

// Tek screenshot — scale zoom-out + gradient overlay
export function ScreenshotPanel({ file, startFrame = 0, style = {} }) {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);

  const scale = interpolate(f, [0, 20], [1.05, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const opacity = interpolate(f, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      border: `1px solid rgba(255,255,255,0.07)`,
      opacity,
      flexShrink: 0,
      ...style,
    }}>
      {/* Screenshot */}
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center top' }}>
        <Img src={staticFile(file)} style={{ width: '100%', display: 'block' }} />
      </div>

      {/* Alt gradient — başlık vs. okunabilsin */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, #0F1117 0%, rgba(15,17,23,0.2) 38%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Üst kenara teal çizgi */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${C.teal}99, transparent)`,
      }} />
    </div>
  );
}

// İki screenshot arasında crossfade
// file1 → 0..transitionStart: sadece file1
// transitionStart..transitionStart+dur: crossfade
// transitionStart+dur..: sadece file2
export function ScreenshotCrossfade({ file1, file2, transitionStart, transitionDuration = 20, style = {} }) {
  const frame = useCurrentFrame();

  const scaleIn = interpolate(frame, [0, 20], [1.05, 1.0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const entryOp = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const img2Opacity = interpolate(
    frame,
    [transitionStart, transitionStart + transitionDuration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
      border: `1px solid rgba(255,255,255,0.07)`,
      opacity: entryOp,
      flexShrink: 0,
      ...style,
    }}>
      {/* img1 — normal akışta, dış div'in yüksekliğini belirler */}
      <div style={{ transform: `scale(${scaleIn})`, transformOrigin: 'center top' }}>
        <Img src={staticFile(file1)} style={{ width: '100%', display: 'block' }} />
      </div>

      {/* img2 — img1'in üzerine absolute overlay, crossfade ile geliyor */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: img2Opacity,
      }}>
        <Img src={staticFile(file2)} style={{ width: '100%', display: 'block' }} />
      </div>

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, #0F1117 0%, rgba(15,17,23,0.2) 38%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${C.teal}99, transparent)`,
      }} />
    </div>
  );
}
