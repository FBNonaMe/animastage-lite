import type { SceneEffectKeyframe, SceneEffectWindow, SceneFxInstance } from '../sceneStudio/types';
import { defaultEffectWindow, normalizeEffectWindow } from './effectTimeline';

export function patchFxStack(
  stack: SceneFxInstance[],
  instanceId: string,
  patch: Partial<SceneFxInstance>
): SceneFxInstance[] {
  return stack.map((fx) => (fx.id === instanceId ? { ...fx, ...patch } : fx));
}

export function removeFxInstance(stack: SceneFxInstance[], instanceId: string): SceneFxInstance[] {
  return stack.filter((fx) => fx.id !== instanceId);
}

export function moveEffectWindow(
  fx: SceneFxInstance,
  deltaFrames: number,
  maxFrames: number
): SceneFxInstance {
  const window = normalizeEffectWindow(fx.window ?? defaultEffectWindow(maxFrames), maxFrames);
  const span = window.endFrame - window.startFrame;
  let startFrame = window.startFrame + deltaFrames;
  startFrame = Math.max(0, Math.min(startFrame, maxFrames - span));
  return {
    ...fx,
    window: {
      ...window,
      startFrame,
      endFrame: startFrame + span,
    },
  };
}

export function resizeEffectWindow(
  fx: SceneFxInstance,
  edge: 'start' | 'end',
  frame: number,
  maxFrames: number
): SceneFxInstance {
  const window = normalizeEffectWindow(fx.window ?? defaultEffectWindow(maxFrames), maxFrames);
  const clamped = Math.max(0, Math.min(maxFrames, Math.floor(frame)));
  if (edge === 'start') {
    const endFrame = Math.max(clamped + 1, window.endFrame);
    return { ...fx, window: { ...window, startFrame: Math.min(clamped, endFrame - 1), endFrame } };
  }
  const startFrame = Math.min(window.startFrame, clamped - 1);
  return { ...fx, window: { ...window, startFrame, endFrame: Math.max(startFrame + 1, clamped) } };
}

export function ensureEffectWindow(
  fx: SceneFxInstance,
  maxFrames: number
): SceneFxInstance {
  if (fx.window) return fx;
  return { ...fx, window: defaultEffectWindow(maxFrames) };
}

export function upsertEffectKeyframe(
  fx: SceneFxInstance,
  frame: number,
  parameterId: string,
  value: number
): SceneFxInstance {
  const keyframes = [...(fx.keyframes ?? [])];
  const idx = keyframes.findIndex((k) => k.frame === frame && k.parameterId === parameterId);
  const next: SceneEffectKeyframe = {
    frame: Math.max(0, Math.floor(frame)),
    parameterId,
    value,
  };
  if (idx >= 0) keyframes[idx] = next;
  else keyframes.push(next);
  keyframes.sort((a, b) => a.frame - b.frame || a.parameterId.localeCompare(b.parameterId));
  return { ...fx, keyframes };
}

export function removeEffectKeyframe(
  fx: SceneFxInstance,
  frame: number,
  parameterId: string
): SceneFxInstance {
  return {
    ...fx,
    keyframes: (fx.keyframes ?? []).filter(
      (k) => !(k.frame === frame && k.parameterId === parameterId)
    ),
  };
}

export function setEffectWindow(
  fx: SceneFxInstance,
  window: Partial<SceneEffectWindow>,
  maxFrames: number
): SceneFxInstance {
  return {
    ...fx,
    window: normalizeEffectWindow({ ...(fx.window ?? {}), ...window }, maxFrames),
  };
}
