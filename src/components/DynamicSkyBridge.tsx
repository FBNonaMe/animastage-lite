/**
 * Bridge: renders DynamicSkyRig + advances playSpeed.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  DynamicSkyRig,
  resolveDynamicSkyLook,
  type DynamicSkyState,
} from '../dynamicSky';

export interface DynamicSkyBridgeProps {
  dynamicSky: DynamicSkyState;
  onTickTime?: (nextHours: number) => void;
}

export default function DynamicSkyBridge({ dynamicSky, onTickTime }: DynamicSkyBridgeProps) {
  const look = useMemo(() => resolveDynamicSkyLook(dynamicSky), [dynamicSky]);
  const accum = useRef(0);
  const emitAccum = useRef(0);

  useFrame((_, dt) => {
    if (!dynamicSky.enabled || !dynamicSky.playSpeed || !onTickTime) return;
    accum.current += dt * dynamicSky.playSpeed;
    emitAccum.current += dt;
    if (emitAccum.current < 0.08) return;
    emitAccum.current = 0;
    if (accum.current < 0.01) return;
    const step = accum.current;
    accum.current = 0;
    let next = dynamicSky.timeHours + step;
    while (next >= 24) next -= 24;
    while (next < 0) next += 24;
    onTickTime(next);
  });

  if (!dynamicSky.enabled) return null;

  return (
    <DynamicSkyRig
      look={look}
      quality={dynamicSky.quality}
      showDome={dynamicSky.showSkyDome}
      showSun={dynamicSky.showSunDisk}
      showMoon={dynamicSky.showMoon}
      showClouds={dynamicSky.showClouds}
      animateClouds={dynamicSky.animateClouds}
    />
  );
}
