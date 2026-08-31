import * as THREE from 'three';

export function frameToTime(frame: number, fps: number): number {
  if (fps <= 0) return 0;
  return Math.max(0, frame / fps);
}

/**
 * Seek a standalone AnimationMixer to an absolute time (seconds).
 * Do NOT call this then MMDAnimationHelper.update(0) — helper._restoreBones
 * will wipe the pose. Use scrubMmdHelperToTime for MMD helpers instead.
 */
export function seekAnimationMixer(mixer: THREE.AnimationMixer | undefined, time: number): void {
  if (!mixer) return;
  const t = Math.max(0, time);
  mixer.time = 0;
  const actions = (mixer as THREE.AnimationMixer & { _actions?: THREE.AnimationAction[] })._actions;
  if (actions) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action) continue;
      action.paused = false;
      action.enabled = true;
      action.time = 0;
    }
  }
  mixer.update(t);
}

export function seekAnimationMixers(mixers: Array<THREE.AnimationMixer | undefined>, time: number): void {
  for (const mixer of mixers) {
    seekAnimationMixer(mixer, time);
  }
}
