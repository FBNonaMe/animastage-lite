/**
 * Outlier detection — reject impossible frame-to-frame jumps.
 */
import type { WhamJointId, WhamPoseSequence } from '../wham/types';
import { WHAM_JOINT_IDS } from '../wham/types';

function angDelta(a: number, b: number): number {
  let d = b - a;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

function rotJump(
  a: [number, number, number],
  b: [number, number, number]
): number {
  return Math.max(angDelta(a[0]!, b[0]!), angDelta(a[1]!, b[1]!), angDelta(a[2]!, b[2]!));
}

export interface OutlierFilterStats {
  correctedJoints: number;
  correctedRoot: number;
}

/**
 * If a joint rotates > maxDegPerSec or teleports, blend from neighbors.
 */
export function applyOutlierFilter(
  sequence: WhamPoseSequence,
  maxDegPerSec = 420
): { sequence: WhamPoseSequence; stats: OutlierFilterStats } {
  const stats: OutlierFilterStats = { correctedJoints: 0, correctedRoot: 0 };
  if (sequence.frames.length < 3) return { sequence, stats };

  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
    root: {
      ...f.root,
      position: [...f.root.position] as [number, number, number],
      rotation: [...f.root.rotation] as [number, number, number],
    },
  }));

  for (let i = 1; i < frames.length - 1; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const next = frames[i + 1]!;
    const dt = Math.max(1e-3, cur.time - prev.time);

    const rootJump = Math.hypot(
      cur.root.position[0]! - prev.root.position[0]!,
      cur.root.position[1]! - prev.root.position[1]!,
      cur.root.position[2]! - prev.root.position[2]!
    );
    if (rootJump / dt > 2.5) {
      cur.root.position = [
        (prev.root.position[0]! + next.root.position[0]!) * 0.5,
        (prev.root.position[1]! + next.root.position[1]!) * 0.5,
        (prev.root.position[2]! + next.root.position[2]!) * 0.5,
      ];
      stats.correctedRoot += 1;
    }

    for (const id of WHAM_JOINT_IDS) {
      const pj = prev.joints[id as WhamJointId];
      const cj = cur.joints[id as WhamJointId];
      const nj = next.joints[id as WhamJointId];
      if (!pj || !cj || !nj) continue;
      const jump = rotJump(pj.rotation, cj.rotation) / dt;
      if (jump > maxDegPerSec) {
        cur.joints[id] = {
          ...cj,
          rotation: [
            (pj.rotation[0]! + nj.rotation[0]!) * 0.5,
            (pj.rotation[1]! + nj.rotation[1]!) * 0.5,
            (pj.rotation[2]! + nj.rotation[2]!) * 0.5,
          ],
          confidence: Math.min(cj.confidence, 0.55),
        };
        stats.correctedJoints += 1;
      }
    }
  }

  return { sequence: { ...sequence, frames }, stats };
}
