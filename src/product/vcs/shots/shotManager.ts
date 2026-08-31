import type { CameraKeyframe } from '../../../types';
import type { VcsShot, VcsVirtualCamera } from '../types';

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createVirtualCamera(name: string, keyframes: CameraKeyframe[] = []): VcsVirtualCamera {
  return {
    id: uid('vcam'),
    name,
    keyframes,
    defaultFov: keyframes[0]?.fov ?? 42,
    focusTarget: 'face',
    active: false,
  };
}

export function duplicateVirtualCamera(cam: VcsVirtualCamera): VcsVirtualCamera {
  return {
    ...cam,
    id: uid('vcam'),
    name: `${cam.name} Copy`,
    keyframes: cam.keyframes.map((kf) => ({ ...kf, id: uid('vkf') })),
    active: false,
  };
}

export function createShot(
  name: string,
  cameraId: string,
  startFrame: number,
  endFrame: number,
  keyframes: CameraKeyframe[]
): VcsShot {
  return {
    id: uid('vshot'),
    name,
    cameraId,
    startFrame,
    endFrame,
    keyframes,
    transition: 'ease',
    transitionFrames: 15,
    dofEnabled: false,
  };
}

export function reorderShots(shots: VcsShot[], fromIndex: number, toIndex: number): VcsShot[] {
  const next = [...shots];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return shots;
  next.splice(toIndex, 0, item);
  return next;
}

export function shotsToTimelineKeyframes(shots: VcsShot[]): CameraKeyframe[] {
  const merged: CameraKeyframe[] = [];
  for (const shot of shots) {
    for (const kf of shot.keyframes) {
      merged.push({
        ...kf,
        frame: shot.startFrame + kf.frame,
      });
    }
  }
  return merged.sort((a, b) => a.frame - b.frame);
}
