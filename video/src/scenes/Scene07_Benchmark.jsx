import { useCurrentFrame, interpolate } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

const BENCHMARKS = [
  { label: 'ROAS', yours: 3.2, avg: 2.4, unit: 'x',  color: '#22C55E', higherBetter: true  },
  { label: 'CPA',  yours: 42,  avg: 58,  unit: '₺',  color: C.teal,    higherBetter: false },
  { label: 'CTR',  yours: 2.8, avg: 1.9, unit: '%',  color: '#818CF8', higherBetter: true  },
];

export default function Scene07_Benchmark() {
  const frame = useCurrentFrame();

  const fadeOut = interpolate(frame, [375, 390], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const barProg  = interpolate(frame, [40, 130], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const labelOp  = interpolate(frame, [130, 160], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      <div style={{
        width: 480, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Sektör Karşılaştırması
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Benchmark<br />Analizi
          </h2>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, opacity: titleOp }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: C.teal }} />
            <span style={{ fontSize: 11, color: C.muted }}>Sizin değeriniz</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#ffffff33' }} />
            <span style={{ fontSize: 11, color: C.muted }}>Sektör ortalaması</span>
          </div>
        </div>

        {/* Bar charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {BENCHMARKS.map((b) => {
            const maxVal   = Math.max(b.yours, b.avg) * 1.25;
            const yoursPct = (b.yours / maxVal) * barProg * 100;
            const avgPct   = (b.avg   / maxVal) * barProg * 100;
            const winning  = b.higherBetter ? b.yours > b.avg : b.yours < b.avg;
            const valLabel = b.unit === '₺' ? `₺${b.yours}` : `${b.yours}${b.unit}`;
            const avgLabel = b.unit === '₺' ? `₺${b.avg}`   : `${b.avg}${b.unit}`;
            return (
              <div key={b.label}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{b.label}</div>
                {/* Yours */}
                <div style={{ marginBottom: 5 }}>
                  <div style={{ height: 10, background: '#ffffff15', borderRadius: 5, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${yoursPct}%`, background: b.color, borderRadius: 5 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: labelOp }}>
                    <span style={{ fontSize: 12, color: b.color, fontWeight: 700 }}>
                      {valLabel}{winning ? ' ✓' : ''}
                    </span>
                  </div>
                </div>
                {/* Average */}
                <div>
                  <div style={{ height: 10, background: '#ffffff15', borderRadius: 5, overflow: 'hidden', marginBottom: 3 }}>
                    <div style={{ height: '100%', width: `${avgPct}%`, background: '#ffffff30', borderRadius: 5 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: labelOp }}>
                    <span style={{ fontSize: 11, color: C.muted }}>{avgLabel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel file="screenshots/benchmark.png" style={{ width: '100%' }} />
      </div>
    </div>
  );
}
