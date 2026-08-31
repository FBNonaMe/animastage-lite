import type { SceneEffectKeyframe, SceneEffectWindow, SceneFxInstance } from '../sceneStudio/types';
import { bezierLerp } from '../editor/clipOperations';

export function defaultEffectWindow(maxFrames: number): SceneEffectWindow {
  return {
    startFrame: 0,
    endFrame: Math.max(0, maxFrames),
    blendIn: 8,
    blendOut: 8,
  };
}

export function normalizeEffectWindow(
  window: Partial<SceneEffectWindow> | null | undefined,
  maxFrames: number
): SceneEffectWindow {
  const fallback = defaultEffectWindow(maxFrames);
  const startFrame = Math.max(0, Math.floor(window?.startFrame ?? fallback.startFrame));
  const endFrame = Math.max(
    startFrame,
    Math.floor(window?.endFrame ?? fallback.endFrame ?? maxFrames)
  );
  return {
    startFrame,
    endFrame,
    blendIn: Math.max(0, Math.floor(window?.blendIn ?? fallback.blendIn ?? 0)),
    blendOut: Math.max(0, Math.floor(window?.blendOut ?? fallback.blendOut ?? 0)),
  };
}

/** Returns 0 outside the window, ramps during blend in/out, 1 in the hold region. */
export function effectWindowWeight(
  frame: number,
  window: SceneEffectWindow | null | undefined
): number {
  if (!window) return 1;
  const { startFrame, endFrame, blendIn = 0, blendOut = 0 } = window;
  if (frame < startFrame || frame > endFrame) return 0;
  const span = Math.max(1, endFrame - startFrame);
  const bi = Math.min(blendIn, span * 0.5);
  const bo = Math.min(blendOut, span * 0.5);
  if (bi > 0 && frame < startFrame + bi) {
    return (frame - startFrame) / bi;
  }
  if (bo > 0 && frame > endFrame - bo) {
    return (endFrame - frame) / bo;
  }
  return 1;
}

export function isEffectActiveAtFrame(
  fx: SceneFxInstance,
  frame: number,
  maxFrames: number
): boolean {
  if (!fx.enabled || fx.runtimeError) return false;
  const window = fx.window ? normalizeEffectWindow(fx.window, maxFrames) : null;
  if (!window) return true;
  return effectWindowWeight(frame, window) > 0.001;
}

export function evaluateEffectIntensity(
  fx: SceneFxInstance,
  frame: number,
  maxFrames: number
): number {
  const window = fx.window ? normalizeEffectWindow(fx.window, maxFrames) : null;
  const weight = effectWindowWeight(frame, window);
  let intensity = fx.intensity * weight;

  const keyframes = fx.keyframes ?? [];
  if (keyframes.length) {
    const paramKeyframes = keyframes.filter((k) => k.parameterId === 'intensity');
    if (paramKeyframes.length) {
      intensity *= sampleKeyframes(paramKeyframes, frame);
    }
  }
  return Math.max(0, intensity);
}

function sampleKeyframes(keyframes: SceneEffectKeyframe[], frame: number): number {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame);
  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
      if (a.interpolation === 'bezier' || b.interpolation === 'bezier') {
        return bezierLerp(a.value, b.value, t, a.easeOut ?? 0.33, b.easeIn ?? 0.33);
      }
      return a.value + (b.value - a.value) * t;
    }
  }
  return sorted[sorted.length - 1].value;
}
