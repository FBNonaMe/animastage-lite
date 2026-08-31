/**
 * Anatomical joint limits — prevent impossible elbow / knee / neck / wrist bends.
 */
import type { WhamJointId, WhamPoseSequence } from '../wham/types';

type Limit = { min: [number, number, number]; max: [number, number, number] };

const LIMITS: Partial<Record<WhamJointId, Limit>> = {
  leftLowerArm: { min: [0, -25, -25], max: [145, 25, 25] },
  rightLowerArm: { min: [0, -25, -25], max: [145, 25, 25] },
  leftLowerLeg: { min: [0, -15, -15], max: [140, 15, 15] },
  rightLowerLeg: { min: [0, -15, -15], max: [140, 15, 15] },
  neck: { min: [-35, -55, -35], max: [45, 55, 35] },
  head: { min: [-40, -70, -40], max: [50, 70, 40] },
  leftHand: { min: [-50, -60, -70], max: [50, 60, 70] },
  rightHand: { min: [-50, -60, -70], max: [50, 60, 70] },
  leftShoulder: { min: [-40, -50, -50], max: [40, 90, 50] },
  rightShoulder: { min: [-40, -50, -50], max: [40, 90, 50] },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function applyAnatomicalLimits(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => {
    const joints = { ...f.joints };
    for (const id of Object.keys(LIMITS) as WhamJointId[]) {
      const j = joints[id];
      const lim = LIMITS[id];
      if (!j || !lim) continue;
      joints[id] = {
        ...j,
        rotation: [
          clamp(j.rotation[0]!, lim.min[0]!, lim.max[0]!),
          clamp(j.rotation[1]!, lim.min[1]!, lim.max[1]!),
          clamp(j.rotation[2]!, lim.min[2]!, lim.max[2]!),
        ],
      };
    }
    return { ...f, joints };
  });
  return { ...sequence, frames };
}
