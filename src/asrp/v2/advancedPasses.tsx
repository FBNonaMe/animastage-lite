/**
 * ASRP V2 advanced / Cinema-gated passes — volumetrics, SSR approx, motion blur lite.
 * Stable WebGL approximations only; never required on Android viewport.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AsrpFrameState } from './types';

/** Soft height fog + light-shaft tint via scene.fog (stable, cheap). */
export function AsrpVolumetricAtmosphere({ frame }: { frame: AsrpFrameState }) {
  const { scene } = useThree();
  const density = frame.budgets.volumetricFog;
  const shafts = frame.budgets.lightShafts;

  useEffect(() => {
    if (density <= 0.0001 && shafts <= 0.0001) {
      if (scene.userData.asrpV2OwnedFog) {
        scene.fog = null;
        scene.userData.asrpV2OwnedFog = false;
      }
      return;
    }
    const color = new THREE.Color().setHSL(
      0.58 - shafts * 0.08,
      0.12 + shafts * 0.25,
      0.42 + shafts * 0.08
    );
    // density is style-scale (~0.01–0.04). Old `* 25` clamped to max fog immediately.
    const t = Math.min(1, Math.max(0, density * 6 + shafts * 0.35));
    const near = THREE.MathUtils.lerp(48, 28, t);
    const far = THREE.MathUtils.lerp(220, 110, t);
    scene.fog = new THREE.Fog(color, near, far);
    scene.userData.asrpV2OwnedFog = true;
    return () => {
      if (scene.userData.asrpV2OwnedFog) {
        scene.fog = null;
        scene.userData.asrpV2OwnedFog = false;
      }
    };
  }, [scene, density, shafts]);

  return null;
}

/**
 * Camera motion blur lite — accumulates previous camera position and blends
 * a subtle trail via toneMappingExposure pulse (true MV blur is Phase G+).
 * For Cinema, pairs with frame accumulation in the encoder path.
 */
export function AsrpMotionBlurLite({ frame }: { frame: AsrpFrameState }) {
  const { camera, gl } = useThree();
  const prev = useRef(new THREE.Vector3());
  const primed = useRef(false);
  const baseExposureRef = useRef<number | null>(null);

  useEffect(() => {
    baseExposureRef.current = gl.toneMappingExposure;
    return () => {
      if (baseExposureRef.current != null) {
        gl.toneMappingExposure = baseExposureRef.current;
      }
    };
  }, [gl]);

  useFrame(() => {
    if (!frame.budgets.motionBlur || frame.budgets.motionBlurStrength <= 0) {
      primed.current = false;
      if (baseExposureRef.current != null) {
        gl.toneMappingExposure = THREE.MathUtils.lerp(
          gl.toneMappingExposure,
          baseExposureRef.current,
          0.25
        );
      }
      return;
    }
    if (baseExposureRef.current == null) {
      baseExposureRef.current = gl.toneMappingExposure;
    }
    if (!primed.current) {
      prev.current.copy(camera.position);
      primed.current = true;
      return;
    }
    const dist = camera.position.distanceTo(prev.current);
    prev.current.copy(camera.position);
    const kick = Math.min(0.08, dist * 0.015) * frame.budgets.motionBlurStrength;
    const base = baseExposureRef.current;
    gl.toneMappingExposure = THREE.MathUtils.lerp(
      gl.toneMappingExposure,
      base - kick,
      0.35
    );
  });

  return null;
}

/** SSR flag marker — consumed by reflections / future SSR pass. */
export function AsrpAdvancedPassFlags({ frame }: { frame: AsrpFrameState }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.userData.asrpV2Ssr = frame.budgets.ssr;
    scene.userData.asrpV2TemporalAa = frame.budgets.temporalAa;
    scene.userData.asrpV2Pcss = frame.budgets.pcssSoftness;
    scene.userData.asrpV2FrameAccumulation = frame.budgets.frameAccumulation;
  }, [
    scene,
    frame.budgets.ssr,
    frame.budgets.temporalAa,
    frame.budgets.pcssSoftness,
    frame.budgets.frameAccumulation,
  ]);
  return null;
}

/** Distance LOD for accessory / prop meshes (characters stay high). */
export function AsrpPropDistanceLod({ enabled }: { enabled: boolean }) {
  const { camera, scene } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!enabled) return;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material;
      let kind: string | undefined;
      if (Array.isArray(mat)) {
        kind = mat[0]?.userData?.asrpMaterialKind as string | undefined;
      } else if (mat) {
        kind = mat.userData?.asrpMaterialKind as string | undefined;
      }
      const name = `${mesh.name} ${kind ?? ''}`.toLowerCase();
      const isProp =
        kind === 'accessory' ||
        kind === 'ground' ||
        /prop|access|小物|背景|stage|bg_/.test(name);
      if (!isProp) return;
      mesh.getWorldPosition(tmp);
      const d = tmp.distanceTo(camera.position);
      mesh.visible = d < 85;
      if (mesh.visible && d > 45) {
        mesh.frustumCulled = true;
      }
    });
  });

  return null;
}
