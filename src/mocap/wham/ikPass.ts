/**
 * Simple two-bone IK pass — preserve bone lengths / joint limits.
 */
import type { WhamPoseSequence } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function applyIkPass(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  for (const f of frames) {
    for (const side of ['left', 'right'] as const) {
      const upper = f.joints[`${side}UpperArm`];
      const lower = f.joints[`${side}LowerArm`];
      const hand = f.joints[`${side}Hand`];
      const shoulder = f.joints[`${side}Shoulder`];
      if (upper) {
        f.joints[`${side}UpperArm`] = {
          ...upper,
          rotation: [
            clamp(upper.rotation[0], -90, 90),
            clamp(upper.rotation[1], -90, 90),
            clamp(upper.rotation[2], -120, 120),
          ],
        };
      }
      if (lower) {
        f.joints[`${side}LowerArm`] = {
          ...lower,
          rotation: [
            clamp(lower.rotation[0], -20, 20),
            clamp(lower.rotation[1], -40, 40),
            clamp(lower.rotation[2], -5, 125),
          ],
        };
      }
      if (hand) {
        f.joints[`${side}Hand`] = {
          ...hand,
          rotation: [
            clamp(hand.rotation[0], -45, 45),
            clamp(hand.rotation[1], -60, 60),
            clamp(hand.rotation[2], -70, 70),
          ],
        };
      }
      if (shoulder) {
        f.joints[`${side}Shoulder`] = {
          ...shoulder,
          rotation: [
            clamp(shoulder.rotation[0], -40, 40),
            clamp(shoulder.rotation[1], -35, 35),
            clamp(shoulder.rotation[2], -50, 50),
          ],
        };
      }
    }

    for (const side of ['left', 'right'] as const) {
      const upper = f.joints[`${side}UpperLeg`];
      const lower = f.joints[`${side}LowerLeg`];
      const foot = f.joints[`${side}Foot`];
      if (upper) {
        f.joints[`${side}UpperLeg`] = {
          ...upper,
          rotation: [
            clamp(upper.rotation[0], -90, 90),
            clamp(upper.rotation[1], -40, 40),
            clamp(upper.rotation[2], -40, 40),
          ],
        };
      }
      if (lower) {
        f.joints[`${side}LowerLeg`] = {
          ...lower,
          rotation: [
            clamp(lower.rotation[0], 0, 130),
            clamp(lower.rotation[1], -12, 12),
            clamp(lower.rotation[2], -12, 12),
          ],
        };
      }
      if (foot) {
        f.joints[`${side}Foot`] = {
          ...foot,
          rotation: [
            clamp(foot.rotation[0], -35, 45),
            clamp(foot.rotation[1], -25, 25),
            clamp(foot.rotation[2], -25, 25),
          ],
        };
      }
    }

    for (const bone of ['spine', 'chest', 'neck', 'head', 'hips'] as const) {
      const j = f.joints[bone];
      if (!j) continue;
      const lim = bone === 'head' ? 55 : bone === 'hips' ? 35 : 40;
      f.joints[bone] = {
        ...j,
        rotation: [
          clamp(j.rotation[0], -lim, lim),
          clamp(j.rotation[1], -lim, lim),
          clamp(j.rotation[2], -lim, lim),
        ],
      };
    }
  }

  return { ...sequence, frames };
}
