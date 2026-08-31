/**
 * Temporal consistency — EMA + confidence-weighted blend across the sequence.
 */
import type { WhamFrame, WhamJointId, WhamPoseSequence } from './types';
import { WHAM_JOINT_IDS } from './types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Smooth rotations / root with confidence-aware EMA. Low confidence → stronger temporal fill. */
export function applyTemporalConsistency(
  sequence: WhamPoseSequence,
  alpha: number
): WhamPoseSequence {
  if (sequence.frames.length < 3) return sequence;

  const frames = sequence.frames.map((f) => ({
    ...f,
    root: {
      ...f.root,
      position: [...f.root.position] as [number, number, number],
      rotation: [...f.root.rotation] as [number, number, number],
      velocity: [...f.root.velocity] as [number, number, number],
      acceleration: [...f.root.acceleration] as [number, number, number],
    },
    joints: { ...f.joints },
  }));

  // Forward pass
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const a = alpha;

    cur.root.position = lerp3(prev.root.position, cur.root.position, a);
    cur.root.rotation = lerp3(prev.root.rotation, cur.root.rotation, a);

    for (const id of WHAM_JOINT_IDS) {
      const pj = prev.joints[id];
      const cj = cur.joints[id];
      if (!pj && !cj) continue;
      if (!cj && pj) {
        cur.joints[id] = {
          rotation: [...pj.rotation] as [number, number, number],
          position: pj.position ? ([...pj.position] as [number, number, number]) : undefined,
          confidence: pj.confidence * 0.85,
        };
        continue;
      }
      if (!pj || !cj) continue;
      const confBlend = Math.min(1, Math.max(0.15, cj.confidence));
      const mix = a * confBlend + (1 - confBlend) * Math.min(a, 0.2);
      cur.joints[id] = {
        rotation: lerp3(pj.rotation, cj.rotation, mix),
        position:
          pj.position && cj.position
            ? lerp3(pj.position, cj.position, mix)
            : cj.position ?? pj.position,
        confidence: Math.max(pj.confidence * 0.9, cj.confidence),
      };
    }
  }

  // Backward pass (reduce lag)
  for (let i = frames.length - 2; i >= 0; i--) {
    const next = frames[i + 1]!;
    const cur = frames[i]!;
    const a = Math.min(0.55, alpha + 0.08);
    cur.root.position = lerp3(next.root.position, cur.root.position, a);
    cur.root.rotation = lerp3(next.root.rotation, cur.root.rotation, a);
    for (const id of WHAM_JOINT_IDS) {
      const nj = next.joints[id as WhamJointId];
      const cj = cur.joints[id as WhamJointId];
      if (!nj || !cj) continue;
      cur.joints[id] = {
        ...cj,
        rotation: lerp3(nj.rotation, cj.rotation, a),
        position:
          nj.position && cj.position
            ? lerp3(nj.position, cj.position, a)
            : cj.position,
      };
    }
  }

  return { ...sequence, frames };
}

/** Clamp per-frame angular velocity to kill hand/wrist snaps. */
export function clampAngularVelocity(
  sequence: WhamPoseSequence,
  maxDegPerSec: number,
  jointIds: WhamJointId[]
): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const dt = Math.max(1e-3, cur.time - prev.time);
    const maxStep = maxDegPerSec * dt;

    for (const id of jointIds) {
      const pj = prev.joints[id];
      const cj = cur.joints[id];
      if (!pj || !cj) continue;
      const nextRot = [...cj.rotation] as [number, number, number];
      for (let a = 0; a < 3; a++) {
        const d = cj.rotation[a]! - pj.rotation[a]!;
        if (Math.abs(d) > maxStep) {
          nextRot[a] = pj.rotation[a]! + Math.sign(d) * maxStep;
        }
      }
      cur.joints[id] = { ...cj, rotation: nextRot };
    }
  }

  return { ...sequence, frames };
}

export function averageJointConfidence(
  frames: WhamFrame[]
): Partial<Record<WhamJointId, number>> {
  const sum: Partial<Record<WhamJointId, number>> = {};
  const count: Partial<Record<WhamJointId, number>> = {};
  for (const f of frames) {
    for (const id of WHAM_JOINT_IDS) {
      const j = f.joints[id];
      if (!j) continue;
      sum[id] = (sum[id] ?? 0) + j.confidence;
      count[id] = (count[id] ?? 0) + 1;
    }
  }
  const out: Partial<Record<WhamJointId, number>> = {};
  for (const id of WHAM_JOINT_IDS) {
    if (count[id]) out[id] = (sum[id] ?? 0) / (count[id] ?? 1);
  }
  return out;
}
