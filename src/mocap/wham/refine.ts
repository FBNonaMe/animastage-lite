/**
 * AI-style motion refinement: cleanup, velocity/accel filter, noise removal.
 */
import type { WhamPoseSequence } from './types';
import { WHAM_JOINT_IDS } from './types';
import { applyTemporalConsistency } from './temporalSmooth';

export function refineMotionSequence(
  sequence: WhamPoseSequence,
  velocityFilter: number
): WhamPoseSequence {
  let next = applyTemporalConsistency(sequence, 0.2 + velocityFilter * 0.15);
  next = filterVelocityAcceleration(next, velocityFilter);
  next = removeHighFrequencyNoise(next);
  return next;
}

function filterVelocityAcceleration(
  sequence: WhamPoseSequence,
  strength: number
): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
    root: { ...f.root },
  }));
  const s = Math.min(0.95, Math.max(0, strength));

  for (let i = 2; i < frames.length; i++) {
    const a = frames[i - 2]!;
    const b = frames[i - 1]!;
    const c = frames[i]!;
    for (const id of WHAM_JOINT_IDS) {
      const ja = a.joints[id];
      const jb = b.joints[id];
      const jc = c.joints[id];
      if (!ja || !jb || !jc) continue;
      // Savitzky-Golay-ish 3-point smooth on rotation
      const rot: [number, number, number] = [
        (ja.rotation[0] + jb.rotation[0] * 2 + jc.rotation[0]) / 4,
        (ja.rotation[1] + jb.rotation[1] * 2 + jc.rotation[1]) / 4,
        (ja.rotation[2] + jb.rotation[2] * 2 + jc.rotation[2]) / 4,
      ];
      c.joints[id] = {
        ...jc,
        rotation: [
          jc.rotation[0] * (1 - s) + rot[0] * s,
          jc.rotation[1] * (1 - s) + rot[1] * s,
          jc.rotation[2] * (1 - s) + rot[2] * s,
        ],
      };
    }
  }
  return { ...sequence, frames };
}

function removeHighFrequencyNoise(sequence: WhamPoseSequence): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  for (let i = 1; i < frames.length - 1; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const next = frames[i + 1]!;
    for (const id of WHAM_JOINT_IDS) {
      const pj = prev.joints[id];
      const cj = cur.joints[id];
      const nj = next.joints[id];
      if (!pj || !cj || !nj) continue;
      // Spike detect: mid frame far from neighbors
      let spiked = false;
      const fixed: [number, number, number] = [...cj.rotation];
      for (let a = 0; a < 3; a++) {
        const mid = (pj.rotation[a]! + nj.rotation[a]!) / 2;
        if (Math.abs(cj.rotation[a]! - mid) > 18) {
          fixed[a] = mid;
          spiked = true;
        }
      }
      if (spiked) cur.joints[id] = { ...cj, rotation: fixed };
    }
  }
  return { ...sequence, frames };
}
