import { useThree } from '@react-three/fiber';
import type { RayMmdLensSettings } from '../../standaloneEffects/types';
import { RayMmdLensEffect } from './RayMmdLensEffect';

interface RayMmdLensPassProps {
  settings: RayMmdLensSettings;
}

export default function RayMmdLensPass({ settings }: RayMmdLensPassProps) {
  const { width, height } = useThree((s) => s.size);
  return <RayMmdLensEffect {...settings} width={width} height={height} />;
}
