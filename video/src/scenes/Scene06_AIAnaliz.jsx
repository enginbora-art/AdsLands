import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { C, font } from '../colors';
import { ScreenshotPanel } from '../components/ScreenshotPanel';

const LINES = [
  { text: 'Google Ads performansı hedefin üzerinde. ROAS 3.2x ile güçlü getiri sağlanıyor.', icon: '📈' },
  { text: 'Meta Ads CPA optimizasyonu öneriliyor. Hedef kitleyi daraltarak verimlilik artırılabilir.', icon: '🎯' },
  { text: 'TikTok bütçe artışı değerlendirilebilir. Düşük CPM ile yüksek erişim potansiyeli mevcut.', icon: '🚀' },
];

function typewriter(text, frame, startFrame, cpm = 1.8) {
  const chars = Math.floor(Math.max(0, frame - startFrame) * cpm);
  return text.slice(0, chars);
}

export default function Scene06_AIAnaliz() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeOut = interpolate(frame, [405, 420], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const titleY  = interpolate(frame, [5, 30], [16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const cpm = 1.8;
  const l1s = 40;
  const l2s = l1s + Math.ceil(LINES[0].text.length / cpm) + 6;
  const l3s = l2s + Math.ceil(LINES[1].text.length / cpm) + 6;

  const texts = [
    typewriter(LINES[0].text, frame, l1s, cpm),
    typewriter(LINES[1].text, frame, l2s, cpm),
    typewriter(LINES[2].text, frame, l3s, cpm),
  ];

  const blink = Math.floor(frame / 7) % 2 === 0;
  const activeLine = texts[2].length < LINES[2].text.length ? 2
    : texts[1].length < LINES[1].text.length ? 1 : 0;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: C.bg, fontFamily: font,
      opacity: fadeOut,
      display: 'flex', gap: 0,
    }}>
      {/* ── Sol panel ─────────────────────────────────────── */}
      <div style={{
        width: 580, flexShrink: 0,
        padding: '52px 40px 52px 72px',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Başlık */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: C.purple, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            ✦ Claude AI
          </div>
          <h2 style={{ fontSize: 38, fontWeight: 700, color: C.white, margin: 0, letterSpacing: -1 }}>
            AI Kanal Analizi
          </h2>
        </div>

        {/* Typewriter kutusu */}
        <div style={{
          flex: 1,
          background: C.bg2,
          borderRadius: 14,
          border: `1px solid ${C.purple}33`,
          padding: '20px 22px',
        }}>
          <div style={{
            fontSize: 10, color: C.purple, fontWeight: 700, letterSpacing: 1,
            textTransform: 'uppercase', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal, opacity: blink ? 1 : 0.3 }} />
            Analiz Yapılıyor
          </div>

          {LINES.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{l.icon}</span>
              <p style={{
                fontSize: 13, color: C.white, margin: 0,
                lineHeight: 1.55, fontFamily: 'monospace',
              }}>
                {texts[i]}
                {activeLine === i && texts[i].length < l.text.length && blink && (
                  <span style={{ color: C.teal }}>|</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sağ panel (screenshot) ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '40px 60px 40px 20px' }}>
        <ScreenshotPanel
          file="screenshots/ai-analiz.png"
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
}
