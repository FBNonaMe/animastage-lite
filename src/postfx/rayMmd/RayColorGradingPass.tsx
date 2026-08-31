import { useThree } from '@react-three/fiber';
import type { RayMmdColorGradeSettings } from '../../standaloneEffects/types';
import { RayColorGradingEffect } from './RayColorGradingEffect';

interface RayColorGradingPassProps {
  settings: RayMmdColorGradeSettings;
}

/** Ray-MMD adapted color grading in the Lite post stack. */
export default function RayColorGradingPass({ settings }: RayColorGradingPassProps) {
  const { width, height } = useThree((s) => s.size);
  return <RayColorGradingEffect {...settings} width={width} height={height} />;
}
