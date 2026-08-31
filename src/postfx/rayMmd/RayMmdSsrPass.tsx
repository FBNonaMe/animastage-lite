import { useThree } from '@react-three/fiber';
import type { RayMmdSsrSettings } from '../../standaloneEffects/types';
import { RayMmdSsrEffect } from './RayMmdSsrEffect';

interface RayMmdSsrPassProps {
  settings: RayMmdSsrSettings;
}

export default function RayMmdSsrPass({ settings }: RayMmdSsrPassProps) {
  const { width, height } = useThree((s) => s.size);
  return <RayMmdSsrEffect {...settings} width={width} height={height} />;
}
