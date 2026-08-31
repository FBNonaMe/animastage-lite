import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { AppState } from '../../types';
import { DEFAULT_ANIME_NPR_SETTINGS } from '../../standaloneEffects/presets';
import { isAnimeNprActive } from '../../utils/animeNprMode';
import {
  applyAnimeNprSettings,
  disposeAnimeNprController,
  ensureAnimeNprController,
  getAnimeNprController,
  setAnimeNprEnabled,
} from './animeNprRuntime';

interface AnimeNprBridgeProps {
  appState: AppState;
}

function findSunLight(scene: THREE.Scene): THREE.DirectionalLight | null {
  let found: THREE.DirectionalLight | null = null;
  scene.traverse((obj) => {
    if (found) return;
    if ((obj as THREE.DirectionalLight).isDirectionalLight) {
      found = obj as THREE.DirectionalLight;
    }
  });
  return found;
}

/** GPL Star Rail NPR — loads bundled controller when render mode + acknowledgment are active. */
export default function AnimeNprBridge({ appState }: AnimeNprBridgeProps) {
  const { scene, gl, camera } = useThree();
  const npr = appState.visualFx.animeNpr ?? DEFAULT_ANIME_NPR_SETTINGS;
  const active = isAnimeNprActive(appState.visualFx.renderMode, npr);

  useEffect(() => {
    if (!active) {
      setAnimeNprEnabled(false);
      return;
    }
    let cancelled = false;
    void ensureAnimeNprController(scene, gl).then(() => {
      if (cancelled) return;
      applyAnimeNprSettings(npr);
    });
    return () => {
      cancelled = true;
      setAnimeNprEnabled(false);
    };
  }, [active, scene, gl, npr.preset, npr.strength, npr.acknowledged]);

  useEffect(() => () => disposeAnimeNprController(), []);

  useFrame(() => {
    const ctrl = getAnimeNprController();
    if (!ctrl || !active) return;
    const sun = findSunLight(scene);
    ctrl.updateLight({
      lightObj: sun,
      ambientIntensity: 0.42,
      wetness: appState.visualFx.wetness ?? 0,
      snow: appState.visualFx.snowGround ?? 0,
    });
    scene.traverse((obj) => {
      if (!(obj as THREE.SkinnedMesh).isSkinnedMesh) return;
      const mesh = obj as THREE.SkinnedMesh;
      const head = mesh.skeleton?.bones.find((b) => /頭|head/i.test(b.name));
      if (head) ctrl.updateHeadBoneForMesh(mesh, head, camera);
    });
  });

  return null;
}
