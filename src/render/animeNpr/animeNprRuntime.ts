import type * as THREE from 'three';
import type { AnimeNprSettings } from '../../standaloneEffects/types';
import { DEFAULT_ANIME_NPR_SETTINGS } from '../../standaloneEffects/presets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnimeNprController = any;

let controller: AnimeNprController | null = null;
let loadPromise: Promise<AnimeNprController> | null = null;
const registeredMeshes = new WeakSet<THREE.Object3D>();

export function getAnimeNprController(): AnimeNprController | null {
  return controller;
}

export async function ensureAnimeNprController(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): Promise<AnimeNprController> {
  if (controller) return controller;
  if (!loadPromise) {
    loadPromise = import('@standalone/anime-npr/AnimeNprController.js').then(({ AnimeNprController }) => {
      controller = new AnimeNprController({ scene, renderer });
      return controller;
    });
  }
  return loadPromise;
}

export function applyAnimeNprSettings(settings: AnimeNprSettings = DEFAULT_ANIME_NPR_SETTINGS): void {
  if (!controller) return;
  controller.setEnabled(true);
  controller.applyPreset(settings.preset || 'starrail');
  if (settings.strength != null) {
    controller.uniforms.uNprStrength.value = settings.strength;
  }
}

export function setAnimeNprEnabled(
  active: boolean,
  settings?: AnimeNprSettings
): void {
  if (!controller) return;
  if (!active) {
    controller.setEnabled(false);
    return;
  }
  applyAnimeNprSettings(settings);
}

export function registerAnimeNprModel(root: THREE.Object3D): void {
  if (!controller || registeredMeshes.has(root)) return;
  registeredMeshes.add(root);
  controller.registerModel(root);
}

export function unregisterAnimeNprModel(root: THREE.Object3D): void {
  if (!controller || !registeredMeshes.has(root)) return;
  registeredMeshes.delete(root);
  controller.unregisterModel(root);
}

export function disposeAnimeNprController(): void {
  controller?.dispose();
  controller = null;
  loadPromise = null;
}
