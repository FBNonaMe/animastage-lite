/**
 * Leg / foot stabilization — walking, dancing, reduce slide & shake.
 */
import type { WhamPoseSequence } from './types';
import { WHAM_LEG_JOINTS } from './types';
import { applyTemporalConsistency, clampAngularVelocity } from './temporalSmooth';

export function stabilizeLegs(
  sequence: WhamPoseSequence,
  passes: number
): WhamPoseSequence {
  let next = sequence;
  for (let p = 0; p < Math.max(1, passes); p++) {
    next = applyTemporalConsistency(next, 0.2 + p * 0.03);
    next = clampAngularVelocity(next, 220 - p * 25, WHAM_LEG_JOINTS);
    next = enforceFootContact(next);
    next = preventKneeHyperextension(next);
  }
  return next;
}

function preventKneeHyperextension(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));
  for (const f of frames) {
    for (const bone of ['leftLowerLeg', 'rightLowerLeg'] as const) {
      const j = f.joints[bone];
      if (!j) continue;
      f.joints[bone] = {
        ...j,
        rotation: [
          Math.max(0, Math.min(130, j.rotation[0])),
          Math.max(-12, Math.min(12, j.rotation[1])),
          Math.max(-12, Math.min(12, j.rotation[2])),
        ],
      };
    }
  }
  return { ...sequence, frames };
}

/**
 * Soft ground plane: when foot velocity is low, lock Y height (anti-float / anti-penetrate).
 */
function enforceFootContact(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
    root: {
      ...f.root,
      position: [...f.root.position] as [number, number, number],
    },
  }));

  // Estimate ground as median lowest foot Y
  const footYs: number[] = [];
  for (const f of frames) {
    for (const id of ['leftFoot', 'rightFoot'] as const) {
      const p = f.joints[id]?.position;
      if (p) footYs.push(p[1]);
    }
  }
  footYs.sort((a, b) => a - b);
  const ground = footYs.length
    ? footYs[Math.floor(footYs.length * 0.15)]!
    : 0;

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const dt = Math.max(1e-3, cur.time - prev.time);

    for (const id of ['leftFoot', 'rightFoot'] as const) {
      const cj = cur.joints[id];
      const pj = prev.joints[id];
      if (!cj?.position || !pj?.position) continue;
      const speed =
        Math.hypot(
          cj.position[0] - pj.position[0],
          cj.position[1] - pj.position[1],
          cj.position[2] - pj.position[2]
        ) / dt;

      // Planted foot: damp horizontal slide + pin near ground
      if (speed < 0.35) {
        const pos: [number, number, number] = [
          pj.position[0] * 0.75 + cj.position[0] * 0.25,
          Math.max(ground, cj.position[1] * 0.4 + ground * 0.6),
          pj.position[2] * 0.75 + cj.position[2] * 0.25,
        ];
        cur.joints[id] = { ...cj, position: pos };
      } else {
        // Airborne: prevent ground penetration
        const y = Math.max(ground, cj.position[1]);
        cur.joints[id] = {
          ...cj,
          position: [cj.position[0], y, cj.position[2]],
        };
      }
    }
  }

  return { ...sequence, frames };
}
