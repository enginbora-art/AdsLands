import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

export default function Scene04_Benchmark() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [345, 360], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 32], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Metrik sayaçları
  const roasVal = interpolate(frame, [60, 200], [0, 32], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const metricsOp = interpolate(frame, [55, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // "Sektör ortalamasının %32 üzerinde" etiketi
  const labelSpring = spring({ frame: Math.max(0, frame - 130), fps, config: { damping: 14, stiffness: 160 } });
  const labelOp = interpolate(labelSpring, [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const labelY  = interpolate(labelSpring, [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const METRICS = [
    { label: 'ROAS', val: '4.8x', sub: 'Sektör: 3.2x', color: C.teal, delay: 70 },
    { label: 'CTR',  val: '%3.8', sub: 'Sektör: %2.5', color: C.purple, delay: 95 },
    { label: 'CPA',  val: '₺128', sub: 'Sektör: ₺185', color: C.amber, delay: 120 },
  ];

  const metricSprings = METRICS.map((m) =>
    spring({ frame: Math.max(0, frame - m.delay), fps, config: { damping: 16, stiffness: 160 } })
  );

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* ── Sol panel ─────────────────────────────────────── */}
      <div style={{
        width: 520, flexShrink: 0,
        padding: '52px 40px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 40 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Sektör Karşılaştırması
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Benchmark<br />Analizi
          </h2>
        </div>

        {/* Üstünlük etiketi */}
        <div style={{ opacity: labelOp, transform: `translateY(${labelY}px)`, marginBottom: 40 }}>
          <div style={{
            background: `${C.teal}18`,
            border: `1px solid ${C.teal}44`,
            borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, marginBottom: 4 }}>
              Sektör ortalamasının
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, color: C.white, letterSpacing: -2 }}>
              %{Math.round(roasVal)}
            </div>
            <div style={{ fontSize: 13, color: C.muted }}>üzerinde performans</div>
          </div>
        </div>

        {/* Metrik kartları */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {METRICS.map((m, i) => {
            const op = interpolate(metricSprings[i], [0, 0.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const tx = interpolate(metricSprings[i], [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div key={m.label} style={{
                opacity: op, transform: `translateX(${tx}px)`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: C.bg2, borderRadius: 10, padding: '10px 16px',
                borderLeft: `3px solid ${m.color}`,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 2 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{m.sub}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.val}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sağ panel (screenshot) ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel
          file="screenshots/benchmark.png"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
