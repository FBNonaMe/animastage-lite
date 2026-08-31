/**
 * Built-in Improved Box Projected Reflections — R3F runtime.
 * Auto probes, box volumes, roughness-aware sampling, export boost.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AppState } from '../types';
import { DEFAULT_REFLECTION_SYSTEM } from './defaults';
import { getReflectionQualityProfile } from './quality';
import { boxToMinMax, resolveReflectionBox } from './sceneDetect';
import { ReflectionProbeCache, buildProbeFingerprint } from './probeCache';
import {
  applyBoxReflectionsToObject,
  syncBoxReflectionUniforms,
} from './materialPatch';
import type { ReflectionSystemSettings } from './types';

export interface ReflectionSystemProps {
  appState: AppState;
  /** True while offline/live video capture is active. */
  exporting?: boolean;
  /** Hide character meshes from probe capture (stable env reflections). */
  skipCharactersInProbe?: boolean;
}

function markCharacterRoots(scene: THREE.Scene, skip: boolean): void {
  scene.traverse((obj) => {
    // Characters are skinned; stages/props are usually static meshes.
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
      obj.userData.bpSkipProbe = skip;
    }
    if (obj.userData?.mmdModelRoot || obj.userData?.characterRoot) {
      obj.userData.bpSkipProbe = skip;
    }
  });
}

/**
 * Mount inside the R3F Canvas — always-on reflection engine.
 */
export default function ReflectionSystem({
  appState,
  exporting = false,
  skipCharactersInProbe = true,
}: ReflectionSystemProps) {
  const { gl, scene } = useThree();
  const cacheRef = useRef(new ReflectionProbeCache());
  const lastCaptureAtRef = useRef(0);
  const bagRef = useRef({
    boxMin: new THREE.Vector3(-12, -1, -12),
    boxMax: new THREE.Vector3(12, 15, 12),
    probePos: new THREE.Vector3(0, 5, 0),
    intensity: 1,
    roughnessInfluence: 1,
    contactHardening: 1,
    enabled: 1,
  });

  const settings: ReflectionSystemSettings =
    appState.reflectionSystem ?? DEFAULT_REFLECTION_SYSTEM;

  const rtxLite = Boolean(
    appState.rtxModeEnabled ||
      appState.cinematicRender?.qualityPreset === 'rtx_lite'
  );

  const profile = useMemo(
    () =>
      getReflectionQualityProfile(settings, {
        exporting,
        rtxLite,
      }),
    [settings, exporting, rtxLite]
  );

  const { kind, box } = useMemo(
    () => resolveReflectionBox(appState, settings.boxVolume),
    [
      appState.visualFx.scenePreset,
      appState.sceneComposer?.skyPreset,
      appState.sceneHdr?.blobUrl,
      appState.models,
      settings.boxVolume,
    ]
  );

  const bounds = useMemo(() => boxToMinMax(box), [box]);

  // Apply material patches whenever models / settings change
  useEffect(() => {
    if (!settings.enabled) return;
    applyBoxReflectionsToObject(scene, {
      character: settings.characterReflections,
      environment: settings.environmentReflections,
      animeFriendly: true,
    });
  }, [
    scene,
    settings.enabled,
    settings.characterReflections,
    settings.environmentReflections,
    appState.models.length,
    appState.visualFx.renderMode,
    appState.rtxModeEnabled,
  ]);

  // Dispose on unmount
  useEffect(() => {
    const cache = cacheRef.current;
    return () => cache.dispose();
  }, []);

  useFrame((state) => {
    if (!settings.enabled) {
      bagRef.current.enabled = 0;
      syncBoxReflectionUniforms(scene, bagRef.current, 0);
      return;
    }

    const fingerprint = buildProbeFingerprint({
      scenePreset: appState.visualFx.scenePreset,
      skyPreset: appState.sceneComposer?.skyPreset,
      hdrUrl: appState.sceneHdr?.blobUrl,
      weather: appState.visualFx.weatherPreset,
      fogEnabled: appState.sceneComposer?.fogEnabled,
      fogDensity: appState.sceneComposer?.fogDensity,
      sunAzimuth: appState.sceneComposer?.lights.sunAzimuth,
      sunElevation: appState.sceneComposer?.lights.sunElevation,
      envIntensity: appState.visualFx.environmentIntensity,
      sceneKind: kind,
      resolution: profile.resolution,
    });

    cacheRef.current.ensure(gl, profile.resolution);

    const now = state.clock.elapsedTime;
    const shouldCapture = cacheRef.current.needsUpdate(
      fingerprint,
      exporting ? 0 : profile.refreshRate,
      now,
      lastCaptureAtRef.current
    );

    if (shouldCapture || (exporting && lastCaptureAtRef.current === 0)) {
      markCharacterRoots(scene, skipCharactersInProbe);
      const pos = bagRef.current.probePos.set(
        bounds.center[0],
        bounds.center[1],
        bounds.center[2]
      );
      const envMap = cacheRef.current.capture(gl, scene, pos, fingerprint);
      lastCaptureAtRef.current = now;

      if (envMap) {
        // Assign probe env to patched materials; keep scene.environment for distant IBL blend
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (!mat?.userData?.asBoxProjectedReflections) continue;
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.envMap = envMap;
              mat.needsUpdate = true;
            }
          }
        });
      }
    }

    const intensity =
      settings.intensity *
      profile.intensityScale *
      (rtxLite ? 1.12 : 1) *
      Math.max(0.35, appState.visualFx.floorReflection ?? 0.78);

    bagRef.current.boxMin.set(...bounds.min);
    bagRef.current.boxMax.set(...bounds.max);
    bagRef.current.probePos.set(...bounds.center);
    bagRef.current.intensity = intensity;
    bagRef.current.roughnessInfluence = settings.roughnessInfluence;
    bagRef.current.contactHardening =
      settings.boxProjection && profile.contactHardening ? 1 : 0;
    bagRef.current.enabled = settings.boxProjection ? 1 : 0;

    syncBoxReflectionUniforms(scene, bagRef.current, 1);
  });

  // Invisible helper volume for debug (advanced users can visualize later)
  return null;
}
