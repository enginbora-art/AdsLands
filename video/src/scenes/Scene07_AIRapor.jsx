import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

export default function Scene07_AIRapor() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [375, 390], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Checkmark animasyonu
  const checkSpring = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 14, stiffness: 180 } });
  const checkLen    = 60 * checkSpring;
  const checkOp     = interpolate(checkSpring, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const readyOp = interpolate(frame, [90, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const readyY  = interpolate(frame, [90, 120], [12, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const btnOp   = interpolate(frame, [130, 160], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pulse   = 1 + 0.035 * Math.sin((frame - 140) * 0.16);

  // Format ikonları
  const formatSprings = ['PPTX', 'PDF', 'Excel'].map((_, i) =>
    spring({ frame: Math.max(0, frame - 160 - i * 22), fps, config: { damping: 18, stiffness: 200 } })
  );
  const formats = [
    { label: 'PPTX', color: '#FF6B35', icon: '📊' },
    { label: 'PDF',  color: '#FF4444', icon: '📄' },
    { label: 'Excel',color: '#22C55E', icon: '📈' },
  ];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* ── Sol panel ─────────────────────────────────────── */}
      <div style={{
        width: 500, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 36 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Otomatik Raporlama
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            AI Raporları
          </h2>
        </div>

        {/* Checkmark */}
        <div style={{ opacity: checkOp, marginBottom: 20 }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={32} r={28} fill={`${C.teal}20`} stroke={C.teal} strokeWidth={1.5} />
            <polyline points="16,32 27,43 48,21" fill="none"
              stroke={C.teal} strokeWidth={3.5}
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={checkLen} strokeDashoffset={0} />
          </svg>
        </div>

        {/* Rapor bilgisi */}
        <div style={{ opacity: readyOp, transform: `translateY(${readyY}px)`, marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, marginBottom: 4 }}>RAPOR HAZIR</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>
            AdsLands_Mayis2026.pptx
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>16 slayt · AI destekli analiz</div>
        </div>

        {/* Format seçenekleri */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
          {formats.map((f, i) => {
            const op = interpolate(formatSprings[i], [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const ty = interpolate(formatSprings[i], [0, 1], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={f.label} style={{
                opacity: op, transform: `translateY(${ty}px)`,
                display: 'flex', alignItems: 'center', gap: 6,
                background: f.color + '18', border: `1px solid ${f.color}44`,
                borderRadius: 8, padding: '6px 12px',
              }}>
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <span style={{ fontSize: 11, color: C.white, fontWeight: 700 }}>{f.label}</span>
              </div>
            );
          })}
        </div>

        {/* İndir butonu */}
        <div style={{ opacity: btnOp, transform: `scale(${frame > 140 ? pulse : 1})` }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: `linear-gradient(135deg, ${C.teal}, ${C.teal2})`,
            borderRadius: 10, padding: '12px 24px',
            color: '#0B1219', fontWeight: 700, fontSize: 14,
            boxShadow: `0 0 20px ${C.teal}44`,
          }}>
            ↓ PPTX İndir
          </div>
        </div>
      </div>

      {/* ── Sağ panel (screenshot) ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel
          file="screenshots/ai-rapor.png"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
