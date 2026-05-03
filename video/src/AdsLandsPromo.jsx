import { Sequence, AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import Scene01_Hook         from './scenes/Scene01_Hook';
import Scene02_Dashboard    from './scenes/Scene02_Dashboard';
import Scene03_Butce        from './scenes/Scene03_Butce';
import Scene04_Anomali      from './scenes/Scene04_Anomali';
import Scene05_KanalAnalizi from './scenes/Scene05_KanalAnalizi';
import Scene06_AIRapor      from './scenes/Scene06_AIRapor';
import Scene07_Benchmark    from './scenes/Scene07_Benchmark';
import Scene08_Kapanis      from './scenes/Scene08_Kapanis';

const BG = '#0F1117';

// Sahne geçiş wrapper'ı — ilk 15 karede fade+slide-up
function SceneTransition({ children }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 15], [20, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundColor: BG,
      opacity,
      transform: `translateY(${translateY}px)`,
    }}>
      {children}
    </div>
  );
}

// Her sahne bir öncekiyle 15 kare örtüşür (crossfade geçiş).
// from değerleri voiceover zamanlamalarına göre hizalandı.
// Toplam süre: 3105 kare (103.5 sn @ 30fps)
const SCENES = [
  { Scene: Scene01_Hook,         from: 0,    duration: 150 },
  { Scene: Scene02_Dashboard,    from: 135,  duration: 450 },
  { Scene: Scene03_Butce,        from: 570,  duration: 600 },
  { Scene: Scene04_Anomali,      from: 1155, duration: 390 },
  { Scene: Scene05_KanalAnalizi, from: 1605, duration: 360 },
  { Scene: Scene06_AIRapor,      from: 1965, duration: 420 },
  { Scene: Scene07_Benchmark,    from: 2445, duration: 390 },
  { Scene: Scene08_Kapanis,      from: 2775, duration: 330 },
];

export const AdsLandsPromo = () => (
  <AbsoluteFill style={{ backgroundColor: BG }}>
    {/* Sabit arka plan katmanı — geçişlerde şeffaf flash'ı engeller */}
    <AbsoluteFill style={{ backgroundColor: BG }} />

    {SCENES.map(({ Scene, from, duration }) => (
      <Sequence key={from} from={from} durationInFrames={duration}>
        <SceneTransition>
          <Scene />
        </SceneTransition>
      </Sequence>
    ))}
  </AbsoluteFill>
);
