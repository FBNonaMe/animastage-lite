import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  applyAtmosphereFog,
  resolveAtmosphereFogDensity,
  type AtmosphereFogParams,
} from './fogMath';
import { reportVqRuntime } from '../visualQuality/store';
import type { VqFogQuality } from '../visualQuality/types';

export interface AtmosphereFogBridgeProps {
  enabled: boolean;
  density: number;
  color: string;
  quality: VqFogQuality;
  heightFog: boolean;
  baseHeight?: number;
  heightFalloff?: number;
}

/**
 * Single fog owner for Visual Quality 2.0.
 * Replaces competing ComposerFog / SceneFog / ASRP fog when active.
 */
export default function AtmosphereFogBridge({
  enabled,
  density,
  color,
  quality,
  heightFog,
  baseHeight = 0,
  heightFalloff = 18,
}: AtmosphereFogBridgeProps) {
  const { scene, camera } = useThree();
  const paramsRef = useRef<AtmosphereFogParams>({
    enabled,
    density,
    color,
    quality,
    heightFog,
    baseHeight,
    heightFalloff,
  });

  paramsRef.current = {
    enabled,
    density,
    color,
    quality,
    heightFog,
    baseHeight,
    heightFalloff,
  };

  useEffect(() => {
    const owner = applyAtmosphereFog(scene, paramsRef.current);
    reportVqRuntime({ fogOwner: owner });
    return () => {
      scene.fog = null;
      reportVqRuntime({ fogOwner: 'none' });
    };
  }, [scene, enabled, color, quality, heightFog]);

  useFrame(() => {
    const p = paramsRef.current;
    if (!p.enabled || p.quality === 'off' || !scene.fog) return;

    let d = resolveAtmosphereFogDensity(p.density, p.quality);
    if (p.heightFog) {
      // Camera near ground → denser; high above → thinner.
      const h = camera.position.y;
      const base = p.baseHeight ?? 0;
      const fall = Math.max(1, p.heightFalloff ?? 18);
      const heightMul = 1.35 - Math.min(1.1, Math.max(0, (h - base) / fall));
      d *= Math.max(0.35, heightMul);
    }

    if (scene.fog instanceof Object && 'density' in scene.fog) {
      (scene.fog as { density: number }).density = d;
    }
  });

  return null;
}
