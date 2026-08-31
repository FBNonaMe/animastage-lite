import type { CameraSnapshot } from '../../../types';
import type { CharacterProfile, SafeVolumeResult, VcsFocusTarget } from '../types';

/** Minimum distance from camera to focus point — never inside character volume. */
export function computeMinCameraDistance(profile: CharacterProfile): number {
  return Math.max(5.5, profile.safeCameraRadius);
}

/** Clamp camera position outside collision shell + floor. */
export function constrainToSafeVolume(
  snapshot: CameraSnapshot,
  profile: CharacterProfile | null | undefined
): SafeVolumeResult {
  if (!profile) {
    return constrainFloorOnly(snapshot);
  }

  const [tx, ty, tz] = snapshot.target;
  const [px, py, pz] = snapshot.position;
  const dx = px - tx;
  const dy = py - ty;
  const dz = pz - tz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const minDist = computeMinCameraDistance(profile);

  let next = { ...snapshot };
  let clamped = false;
  let reason: string | undefined;

  if (dist < minDist && dist > 1e-6) {
    const scale = minDist / dist;
    next = {
      ...next,
      position: [tx + dx * scale, ty + dy * scale, tz + dz * scale],
    };
    clamped = true;
    reason = 'character_volume';
  }

  const floor = profile.feetPosition[1] + 0.35;
  if (next.position[1] < floor) {
    next = {
      ...next,
      position: [next.position[0], floor, next.position[2]],
    };
    clamped = true;
    reason = reason ?? 'floor';
  }

  const maxY = profile.boundingBox.max[1] + profile.hairExtent + 8;
  if (next.position[1] > maxY) {
    next = {
      ...next,
      position: [next.position[0], maxY, next.position[2]],
    };
    clamped = true;
    reason = reason ?? 'ceiling';
  }

  return { snapshot: next, clamped, reason };
}

function constrainFloorOnly(snapshot: CameraSnapshot): SafeVolumeResult {
  if (snapshot.position[1] >= 0.5) {
    return { snapshot, clamped: false };
  }
  return {
    snapshot: {
      ...snapshot,
      position: [snapshot.position[0], 0.5, snapshot.position[2]],
    },
    clamped: true,
    reason: 'floor',
  };
}

export function resolveFocusPoint(
  profile: CharacterProfile | null | undefined,
  target: VcsFocusTarget,
  fallback: [number, number, number] = [0, 10, 0]
): [number, number, number] {
  if (!profile) return fallback;
  switch (target) {
    case 'eyes':
      return [...profile.eyePosition];
    case 'face':
      return [...profile.facePosition];
    case 'head':
      return [...profile.headPosition];
    case 'chest':
      return [...profile.chestPosition];
    case 'feet':
      return [...profile.feetPosition];
    case 'com':
    default:
      return [...profile.centerOfMass];
  }
}

/** Pick focus target from motion context. */
export function resolveDynamicFocusTarget(
  isPlaying: boolean,
  motionIntensity: number,
  isIdle: boolean
): VcsFocusTarget {
  if (isIdle || motionIntensity < 0.25) return 'eyes';
  if (motionIntensity > 0.7) return 'com';
  if (isPlaying) return 'face';
  return 'head';
}
