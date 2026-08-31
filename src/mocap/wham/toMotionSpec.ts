/**
 * WHAM pose sequence → MotionSpec (humanoid intermediate).
 */
import type { MotionPosKey, MotionRotKey, MotionSpec, MotionSpecBone } from '../../ai/motionSpec';
import { MOTION_SPEC_BONES } from '../../ai/motionSpec';
import type { WhamJointId, WhamPoseSequence } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function sequenceToMotionSpec(
  sequence: WhamPoseSequence,
  name = 'wham_motion'
): MotionSpec {
  const tracks: MotionSpec['tracks'] = {};
  const hips: MotionPosKey[] = [];

  for (const bone of MOTION_SPEC_BONES) {
    const keys: MotionRotKey[] = [];
    for (const f of sequence.frames) {
      const j = f.joints[bone as WhamJointId];
      if (!j) continue;
      if (j.confidence < 0.22 && keys.length) continue;
      keys.push({ t: f.time, r: [...j.rotation] as [number, number, number] });
    }
    if (keys.length) tracks[bone as MotionSpecBone] = keys;
  }

  for (const f of sequence.frames) {
    hips.push({
      t: f.time,
      p: [...f.root.position] as [number, number, number],
    });
  }

  return {
    name,
    duration: Math.max(sequence.duration, 0.1),
    loop: false,
    tracks,
    hips,
    expressions: {},
  };
}

const JOINT_LIMITS: Partial<Record<MotionSpecBone, [number, number, number]>> = {
  head: [45, 60, 35],
  neck: [40, 45, 30],
  spine: [30, 35, 25],
  chest: [25, 30, 20],
  leftUpperArm: [90, 90, 90],
  rightUpperArm: [90, 90, 90],
  leftLowerArm: [20, 90, 120],
  rightLowerArm: [20, 90, 120],
  leftUpperLeg: [90, 40, 40],
  rightUpperLeg: [90, 40, 40],
  leftLowerLeg: [130, 15, 15],
  rightLowerLeg: [130, 15, 15],
};

/**
 * Joint-limit finalize for video mocap — supports long clips (up to 10 min).
 */
export function finalizeWhamMotionSpec(spec: MotionSpec): MotionSpec {
  const duration = clamp(spec.duration, 0.1, 600);
  const tracks: MotionSpec['tracks'] = {};

  for (const bone of Object.keys(spec.tracks) as MotionSpecBone[]) {
    const keys = spec.tracks[bone];
    if (!keys?.length) continue;
    const lim = JOINT_LIMITS[bone] ?? [90, 90, 90];
    let next = keys.map((k) => ({
      t: clamp(k.t, 0, duration),
      r: [
        clamp(k.r[0], -lim[0], lim[0]),
        clamp(k.r[1], -lim[1], lim[1]),
        clamp(k.r[2], -lim[2], lim[2]),
      ] as [number, number, number],
    }));
    if (bone === 'leftLowerLeg' || bone === 'rightLowerLeg') {
      next = next.map((k) => ({
        ...k,
        r: [
          clamp(k.r[0], 0, 130),
          clamp(k.r[1], -10, 10),
          clamp(k.r[2], -10, 10),
        ] as [number, number, number],
      }));
    }
    tracks[bone] = next;
  }

  const hips = (spec.hips ?? []).map((k) => ({
    t: clamp(k.t, 0, duration),
    p: [
      clamp(k.p[0], -2.5, 2.5),
      clamp(k.p[1], -0.5, 1.2),
      clamp(k.p[2], -2.5, 2.5),
    ] as [number, number, number],
  }));

  return {
    name: spec.name,
    duration,
    loop: false,
    tracks,
    hips,
    expressions: spec.expressions ?? {},
  };
}
