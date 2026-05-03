import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotCrossfade } from '../components/ScreenshotPanel';

const BARS = [
  { label: 'Google Ads', color: '#4285F4', spend: 28400, pct: 0.78 },
  { label: 'Meta Ads',   color: '#1877F2', spend: 12600, pct: 0.52 },
  { label: 'TikTok',     color: '#FF0050', spend: 5300,  pct: 0.30 },
];

const KPIS = [
  { label: 'ROAS',  value: '3.2x',  target: 'H: 4.0x', ok: true },
  { label: 'CPA',   value: '₺128',  target: 'H: ₺150',  ok: true },
  { label: 'CTR',   value: '%3.8',  target: 'H: %2.5',  ok: true },
];

export default function Scene03_KanalAnalizi() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [375, 390], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const barProgress = BARS.map((_, i) =>
    spring({ frame: Math.max(0, frame - 40 - i * 25), fps, config: { damping: 18, stiffness: 140 } })
  );

  const kpiProgress = KPIS.map((_, i) =>
    spring({ frame: Math.max(0, frame - 140 - i * 30), fps, config: { damping: 20, stiffness: 180 } })
  );

  const MAX_H = 200;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* ── Sol panel ─────────────────────────────────────── */}
      <div style={{
        width: 560, flexShrink: 0,
        padding: '52px 40px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 36 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Kanal Performansı
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Kanal Analizi
          </h2>
        </div>

        {/* Bar Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 32 }}>
          {BARS.map((b, i) => {
            const h = b.pct * MAX_H * barProgress[i];
            const lOp = interpolate(barProgress[i], [0.3, 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ opacity: lOp, fontSize: 13, fontWeight: 700, color: C.white }}>
                  ₺{b.spend.toLocaleString('tr-TR')}
                </div>
                <div style={{
                  width: 72, height: Math.max(h, 0),
                  background: `linear-gradient(180deg, ${b.color}, ${b.color}88)`,
                  borderRadius: '6px 6px 0 0',
                  boxShadow: `0 0 16px ${b.color}44`,
                }} />
                <div style={{ opacity: lOp, fontSize: 11, color: C.muted, fontWeight: 600, textAlign: 'center', width: 72 }}>
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* KPI Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
            KPI Hedefleri
          </div>
          {KPIS.map((k, i) => {
            const op = interpolate(kpiProgress[i], [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const tx = interpolate(kpiProgress[i], [0, 1], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={k.label} style={{
                opacity: op, transform: `translateX(${tx}px)`,
                background: C.bg2, border: `1px solid ${C.teal}33`, borderRadius: 10,
                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 2 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.white }}>{k.value}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{k.target}</div>
                  <div style={{ fontSize: 16 }}>{k.ok ? '✅' : '❌'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sağ panel (screenshot crossfade) ──────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotCrossfade
          file1="screenshots/kanal-analizi.png"
          file2="screenshots/ai-analiz.png"
          transitionStart={195}
          transitionDuration={25}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
