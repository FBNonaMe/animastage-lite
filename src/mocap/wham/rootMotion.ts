/**
 * Root motion recovery — translation, rotation, velocity, acceleration.
 */
import type { WhamPoseSequence } from './types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function recoverRootMotion(
  sequence: WhamPoseSequence,
  velocityFilter: number
): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    root: {
      position: [...f.root.position] as [number, number, number],
      rotation: [...f.root.rotation] as [number, number, number],
      velocity: [...f.root.velocity] as [number, number, number],
      acceleration: [...f.root.acceleration] as [number, number, number],
    },
    joints: { ...f.joints },
  }));

  if (frames.length < 2) return { ...sequence, frames };

  // Prefer hips joint position when present
  for (const f of frames) {
    const hips = f.joints.hips?.position;
    if (hips) {
      f.root.position = [
        lerp(f.root.position[0], hips[0], 0.65),
        lerp(f.root.position[1], hips[1], 0.65),
        lerp(f.root.position[2], hips[2], 0.65),
      ];
    }
  }

  // Smooth root path
  const a = Math.min(0.85, Math.max(0.15, 1 - velocityFilter));
  for (let i = 1; i < frames.length; i++) {
    const p = frames[i - 1]!.root.position;
    const c = frames[i]!.root.position;
    frames[i]!.root.position = [
      lerp(p[0], c[0], a),
      lerp(p[1], c[1], a),
      lerp(p[2], c[2], a),
    ];
    frames[i]!.root.rotation = [
      lerp(frames[i - 1]!.root.rotation[0], frames[i]!.root.rotation[0], a),
      lerp(frames[i - 1]!.root.rotation[1], frames[i]!.root.rotation[1], a),
      lerp(frames[i - 1]!.root.rotation[2], frames[i]!.root.rotation[2], a),
    ];
  }

  for (let i = 0; i < frames.length; i++) {
    const prev = frames[Math.max(0, i - 1)]!;
    const next = frames[Math.min(frames.length - 1, i + 1)]!;
    const cur = frames[i]!;
    const dt = Math.max(1e-3, next.time - prev.time);
    const v: [number, number, number] = [
      (next.root.position[0] - prev.root.position[0]) / dt,
      (next.root.position[1] - prev.root.position[1]) / dt,
      (next.root.position[2] - prev.root.position[2]) / dt,
    ];
    // Low-pass velocity
    const vf = velocityFilter;
    cur.root.velocity = [
      lerp(cur.root.velocity[0], v[0], 1 - vf * 0.5),
      lerp(cur.root.velocity[1], v[1], 1 - vf * 0.5),
      lerp(cur.root.velocity[2], v[2], 1 - vf * 0.5),
    ];
    if (i > 0) {
      const pdt = Math.max(1e-3, cur.time - prev.time);
      cur.root.acceleration = [
        (cur.root.velocity[0] - prev.root.velocity[0]) / pdt,
        (cur.root.velocity[1] - prev.root.velocity[1]) / pdt,
        (cur.root.velocity[2] - prev.root.velocity[2]) / pdt,
      ];
    }
  }

  // Sync hips joint with root
  for (const f of frames) {
    const hips = f.joints.hips;
    if (hips) {
      f.joints.hips = {
        ...hips,
        position: [...f.root.position] as [number, number, number],
        rotation: [
          hips.rotation[0],
          lerp(hips.rotation[1], f.root.rotation[1], 0.5),
          hips.rotation[2],
        ],
      };
    }
  }

  return { ...sequence, frames };
}
