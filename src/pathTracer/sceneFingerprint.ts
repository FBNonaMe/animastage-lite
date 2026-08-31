import type { AppState } from '../types';
import type { PathTracerSceneData } from './types';

/** Cheap bake fingerprint — animation / pose changes use motionKey. */
export function bakedSceneSignature(scene: PathTracerSceneData): string {
  return [
    scene.triangles.length,
    scene.materials.length,
    scene.textures.length,
    scene.lights.length,
    scene.floorY ?? 0,
  ].join(':');
}

/** Detects visible model motion / timeline frame for path-tracer rebake. */
export function pathTracerMotionKey(appState: AppState): string {
  const frame = appState.currentFrame;
  const playing = appState.isPlaying ? 1 : 0;
  const models = appState.models
    .filter((m) => m.visible)
    .map((m) => {
      const px = m.positionX ?? 0;
      const py = m.positionY ?? 0;
      const pz = m.positionZ ?? 0;
      const rx = m.rotationX ?? 0;
      const ry = m.rotationY ?? 0;
      const rz = m.rotationZ ?? 0;
      const morphs = m.morphs
        ? `${m.morphs.eyes.toFixed(2)}|${m.morphs.mouth.toFixed(2)}|${m.morphs.brow.toFixed(2)}`
        : '';
      return `${m.id}:${px.toFixed(2)},${py.toFixed(2)},${pz.toFixed(2)}:${rx.toFixed(2)},${ry.toFixed(2)},${rz.toFixed(2)}:${m.activeTemplateId ?? ''}:${morphs}`;
    })
    .join(';');
  return `${playing}:${frame}:${models}`;
}
