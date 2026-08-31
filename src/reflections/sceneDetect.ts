import type { AppState, ScenePresetId } from '../types';
import {
  defaultBoxForScene,
  sceneKindFromPreset,
  type ReflectionBoxVolume,
  type ReflectionSceneKind,
} from './types';

const STAGE_NAME =
  /stage|scene|city|street|environment|room|platform|set\b|concert|arena|map\b|warehouse|studio|hall|indoor|outdoor/i;

/**
 * Detect indoor / outdoor / studio / concert / HDR from scene + assets.
 */
export function detectReflectionSceneKind(appState: AppState): ReflectionSceneKind {
  if (appState.sceneHdr?.blobUrl) return 'hdr';

  const preset = appState.visualFx.scenePreset as ScenePresetId | undefined;
  let kind = sceneKindFromPreset(preset);

  const hasStage = appState.models.some((m) => STAGE_NAME.test(m.name || ''));
  if (hasStage && kind === 'studio') {
    const n = appState.models.map((m) => m.name).join(' ').toLowerCase();
    if (/concert|stage|arena|club/.test(n)) kind = 'concert';
    else if (/outdoor|park|street|city|beach/.test(n)) kind = 'outdoor';
    else kind = 'indoor';
  }

  const sky = appState.sceneComposer?.skyPreset;
  if (sky === 'night' && kind === 'outdoor') kind = 'concert';
  if (sky === 'blue' && preset === 'outdoor') kind = 'outdoor';

  return kind;
}

export function resolveReflectionBox(
  appState: AppState,
  manual: ReflectionBoxVolume | null | undefined
): { kind: ReflectionSceneKind; box: ReflectionBoxVolume } {
  const kind = detectReflectionSceneKind(appState);
  if (manual) return { kind, box: manual };
  return { kind, box: defaultBoxForScene(kind) };
}

export function boxToMinMax(box: ReflectionBoxVolume): {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
} {
  const half = [box.size[0] / 2, box.size[1] / 2, box.size[2] / 2] as const;
  return {
    center: box.center,
    min: [
      box.center[0] - half[0],
      box.center[1] - half[1],
      box.center[2] - half[2],
    ],
    max: [
      box.center[0] + half[0],
      box.center[1] + half[1],
      box.center[2] + half[2],
    ],
  };
}
