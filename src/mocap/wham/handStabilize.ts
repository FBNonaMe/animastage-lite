/**
 * Hand / arm stabilization — highest priority for dance mocap.
 */
import type { WhamPoseSequence } from './types';
import { WHAM_HAND_JOINTS } from './types';
import { applyTemporalConsistency, clampAngularVelocity } from './temporalSmooth';

export function stabilizeHands(
  sequence: WhamPoseSequence,
  passes: number
): WhamPoseSequence {
  let next = sequence;
  for (let p = 0; p < Math.max(1, passes); p++) {
    next = applyTemporalConsistency(next, 0.22 + p * 0.04);
    // Wrist / elbow snap kill
    next = clampAngularVelocity(next, 280 - p * 30, WHAM_HAND_JOINTS);
    next = softenElbowContinuity(next);
  }
  return next;
}

/** Keep elbow bend continuous vs shoulder→wrist chain. */
function softenElbowContinuity(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  for (const f of frames) {
    for (const side of ['left', 'right'] as const) {
      const upper = f.joints[`${side}UpperArm`];
      const lower = f.joints[`${side}LowerArm`];
      const hand = f.joints[`${side}Hand`];
      if (!upper || !lower) continue;

      // Prevent broken elbows: Z bend stays in natural range
      const z = Math.max(-5, Math.min(125, lower.rotation[2]));
      // Dampen wrist vs forearm mismatch
      let handRot = hand?.rotation;
      if (handRot) {
        handRot = [
          handRot[0] * 0.75 + upper.rotation[0] * 0.1,
          handRot[1] * 0.7,
          handRot[2] * 0.55 + z * 0.15,
        ];
      }
      f.joints[`${side}LowerArm`] = {
        ...lower,
        rotation: [lower.rotation[0] * 0.5, lower.rotation[1] * 0.5, z],
      };
      if (hand && handRot) {
        f.joints[`${side}Hand`] = { ...hand, rotation: handRot };
      }
    }
  }

  return { ...sequence, frames };
}
