/**
 * Atmosphere Fog 2.0 — distance + height fog with a single scene.fog owner.
 * Uses FogExp2 for distance falloff; height is approximated via density remap
 * and optional ground-mist particles (Scene FX mist).
 */
import * as THREE from 'three';
import type { VqFogQuality } from '../visualQuality/types';

export interface AtmosphereFogParams {
  enabled: boolean;
  color: string;
  /** 0–1 composer/mood density. */
  density: number;
  quality: VqFogQuality;
  heightFog: boolean;
  /** World Y where fog is densest. */
  baseHeight?: number;
  /** Height falloff distance. */
  heightFalloff?: number;
}

export function resolveAtmosphereFogDensity(
  density: number,
  quality: VqFogQuality
): number {
  const base = Math.max(0, Math.min(1, density));
  switch (quality) {
    case 'off':
      return 0;
    case 'low':
      return 0.008 + base * 0.012;
    case 'medium':
      return 0.012 + base * 0.022;
    case 'high':
      return 0.016 + base * 0.03;
    case 'ultra':
    case 'cinematic':
      return 0.02 + base * 0.038;
    default:
      return 0.012 + base * 0.02;
  }
}

/**
 * Apply or clear scene fog. Returns owner label for debug HUD.
 */
export function applyAtmosphereFog(
  scene: THREE.Scene,
  params: AtmosphereFogParams
): string {
  if (!params.enabled || params.quality === 'off') {
    scene.fog = null;
    return 'none';
  }

  const d = resolveAtmosphereFogDensity(params.density, params.quality);
  // Height fog: denser when camera is near baseHeight — handled by AtmosphereFogBridge
  // via dynamic density; here we set FogExp2 as the base distance fog.
  const fog = new THREE.FogExp2(params.color, d);
  scene.fog = fog;
  return params.heightFog ? 'atmosphere+height' : 'atmosphere';
}

export function clearAtmosphereFog(scene: THREE.Scene): void {
  scene.fog = null;
}
