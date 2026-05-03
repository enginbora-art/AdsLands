import { Composition } from 'remotion';
import { AdsLandsPromo } from './AdsLandsPromo';

export const Root = () => (
  <Composition
    id="AdsLandsPromo"
    component={AdsLandsPromo}
    durationInFrames={3105}
    fps={30}
    width={1440}
    height={900}
  />
);
