import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

const LINES = [
  { text: 'Google Ads performansı hedefin üzerinde. ROAS 3.2x ile güçlü getiri sağlanıyor.', icon: '📈' },
  { text: 'Meta Ads CPA optimizasyonu öneriliyor. Hedef kitleyi daraltarak verimlilik artırılabilir.', icon: '🎯' },
  { text: 'TikTok bütçe artışı değerlendirilebilir. Düşük CPM ile yüksek erişim potansiyeli mevcut.', icon: '🚀' },
];

const CPF = 1.6; // karakter / kare

function tw(text, frame, startFrame) {
  return text.slice(0, Math.floor(Math.max(0, frame - startFrame) * CPF));
}

export default function Scene05_KanalAnalizi() {
  const frame = useCurrentFrame();

  const fadeOut = interpolate(frame, [345, 360], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const chipOp    = interpolate(frame, [25, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const chipPulse = 1 + 0.03 * Math.sin(frame * 0.14);

  // 3 satır 80 kare arayla başlıyor
  const starts = [70, 150, 230];
  const texts  = starts.map((s, i) => tw(LINES[i].text, frame, s));

  const blink = Math.floor(frame / 7) % 2 === 0;

  // Hangi satır aktif yazılıyor?
  const activeLine = texts.reduce((active, t, i) => (t.length < LINES[i].text.length ? i : active), -1);

  const boxOp = interpolate(frame, [60, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* Sol panel */}
      <div style={{
        width: 540, flexShrink: 0,
        padding: '52px 36px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ Claude AI
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            Yapay Zeka<br />Kanal Analizi
          </h2>
        </div>

        {/* AI chip badge */}
        <div style={{ opacity: chipOp, transform: `scale(${chipPulse})`, marginBottom: 20, width: 'fit-content' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: `linear-gradient(135deg, ${C.purple}22, ${C.teal}22)`,
            border: `1px solid ${C.purple}55`,
            borderRadius: 12, padding: '8px 16px',
          }}>
            <svg width={18} height={18} viewBox="0 0 20 20" fill="none">
              <rect x={3} y={3} width={14} height={14} rx={3} stroke={C.purple} strokeWidth={1.5} />
              <rect x={7} y={7} width={6} height={6} rx={1} fill={C.purple} />
              <line x1={10} y1={0} x2={10} y2={3} stroke={C.purple} strokeWidth={1.5} />
              <line x1={10} y1={17} x2={10} y2={20} stroke={C.purple} strokeWidth={1.5} />
              <line x1={0} y1={10} x2={3} y2={10} stroke={C.purple} strokeWidth={1.5} />
              <line x1={17} y1={10} x2={20} y2={10} stroke={C.purple} strokeWidth={1.5} />
            </svg>
            <span style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 0.5 }}>Yapay Zeka Destekli</span>
          </div>
        </div>

        {/* Typewriter kutusu */}
        <div style={{
          flex: 1,
          opacity: boxOp,
          background: C.bg2,
          borderRadius: 14,
          border: `1px solid ${C.purple}33`,
          padding: '16px 20px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            fontSize: 10, color: C.purple, fontWeight: 700, letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal, opacity: blink ? 1 : 0.3 }} />
            Analiz Yapılıyor
          </div>

          {/* Satırlar */}
          {LINES.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 14, minHeight: 20 }}>
              <span style={{ fontSize: 13, flexShrink: 0, opacity: texts[i].length > 0 ? 1 : 0 }}>{l.icon}</span>
              <p style={{
                fontSize: 12, color: C.teal, margin: 0,
                lineHeight: 1.6,
                fontFamily: 'monospace',
              }}>
                {texts[i]}
                {activeLine === i && blink && (
                  <span style={{ color: C.teal, fontWeight: 300 }}>|</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Sağ panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel file="screenshots/kanal-analizi.png" style={{ width: '100%' }} />
      </div>
    </div>
  );
}
