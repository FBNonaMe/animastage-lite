import { useThree } from '@react-three/fiber';
import type { RayMmdVignetteSettings } from '../../standaloneEffects/types';
import { RayMmdVignetteEffect } from './RayMmdVignetteEffect';

interface RayMmdVignettePassProps {
  settings: RayMmdVignetteSettings;
}

export default function RayMmdVignettePass({ settings }: RayMmdVignettePassProps) {
  const { width, height } = useThree((s) => s.size);
  return <RayMmdVignetteEffect {...settings} width={width} height={height} />;
}
