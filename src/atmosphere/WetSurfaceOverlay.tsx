/**
 * Temporary wet / snow-ground look for floor & stage materials.
 * Snapshots original props and restores on cleanup — never mutates PMX assets permanently.
 */
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface WetSurfaceOverlayProps {
  wetness: number;
  snowGround: number;
  enabled: boolean;
}

interface MatSnapshot {
  roughness?: number;
  metalness?: number;
  color?: THREE.Color;
  envMapIntensity?: number;
}

function isFloorLike(obj: THREE.Object3D): boolean {
  const n = (obj.name || '').toLowerCase();
  return (
    n.includes('floor') ||
    n.includes('ground') ||
    n.includes('stage') ||
    n.includes('plane') ||
    n.includes('terrain')
  );
}

export default function WetSurfaceOverlay({
  wetness,
  snowGround,
  enabled,
}: WetSurfaceOverlayProps) {
  const { scene } = useThree();
  const snaps = useRef<Map<THREE.Material, MatSnapshot>>(new Map());

  useEffect(() => {
    if (!enabled || (wetness <= 0.01 && snowGround <= 0.01)) {
      // Restore any previous
      snaps.current.forEach((snap, mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (snap.roughness != null && 'roughness' in m) m.roughness = snap.roughness;
        if (snap.metalness != null && 'metalness' in m) m.metalness = snap.metalness;
        if (snap.color && m.color) m.color.copy(snap.color);
        if (snap.envMapIntensity != null && 'envMapIntensity' in m) {
          m.envMapIntensity = snap.envMapIntensity;
        }
        m.needsUpdate = true;
      });
      snaps.current.clear();
      return;
    }

    const w = Math.max(0, Math.min(1, wetness));
    const s = Math.max(0, Math.min(1, snowGround));

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (!isFloorLike(obj) && obj.receiveShadow !== true) return;
      // Skip skinned characters
      if (obj instanceof THREE.SkinnedMesh) return;

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat || !(mat instanceof THREE.MeshStandardMaterial)) continue;
        if (!snaps.current.has(mat)) {
          snaps.current.set(mat, {
            roughness: mat.roughness,
            metalness: mat.metalness,
            color: mat.color.clone(),
            envMapIntensity: mat.envMapIntensity,
          });
        }
        const snap = snaps.current.get(mat)!;
        mat.roughness = Math.max(0.05, (snap.roughness ?? 0.7) * (1 - w * 0.65));
        mat.metalness = Math.min(1, (snap.metalness ?? 0) + w * 0.12);
        if (typeof mat.envMapIntensity === 'number') {
          mat.envMapIntensity = (snap.envMapIntensity ?? 1) * (1 + w * 0.45);
        }
        if (s > 0.01 && snap.color) {
          mat.color.copy(snap.color).lerp(new THREE.Color('#eef4ff'), s * 0.55);
        }
        mat.needsUpdate = true;
      }
    });

    return () => {
      snaps.current.forEach((snap, mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (snap.roughness != null && 'roughness' in m) m.roughness = snap.roughness;
        if (snap.metalness != null && 'metalness' in m) m.metalness = snap.metalness;
        if (snap.color && m.color) m.color.copy(snap.color);
        if (snap.envMapIntensity != null && 'envMapIntensity' in m) {
          m.envMapIntensity = snap.envMapIntensity;
        }
        m.needsUpdate = true;
      });
      snaps.current.clear();
    };
  }, [scene, enabled, wetness, snowGround]);

  return null;
}
