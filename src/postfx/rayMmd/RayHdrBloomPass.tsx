import { useThree } from '@react-three/fiber';
import type { RayMmdBloomSettings } from '../../standaloneEffects/types';
import { RayHdrBloomEffect } from './RayHdrBloomEffect';

interface RayHdrBloomPassProps {
  settings: RayMmdBloomSettings;
}

export default function RayHdrBloomPass({ settings }: RayHdrBloomPassProps) {
  const { width, height } = useThree((s) => s.size);
  return <RayHdrBloomEffect {...settings} width={width} height={height} />;
}
