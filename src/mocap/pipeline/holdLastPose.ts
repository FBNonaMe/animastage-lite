/**
 * Hold last valid pose when a body part disappears mid-sequence.
 * Never resets lost landmarks to default T-pose.
 */
import type { WhamJointId, WhamPoseSequence } from '../wham/types';
import { WHAM_JOINT_IDS } from '../wham/types';

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0]! + (b[0]! - a[0]!) * t,
    a[1]! + (b[1]! - a[1]!) * t,
    a[2]! + (b[2]! - a[2]!) * t,
  ];
}

/**
 * Forward fill missing / ultra-low confidence joints from last reliable sample,
 * then blend when detection returns.
 */
export function applyHoldLastPose(
  sequence: WhamPoseSequence,
  minConfidence = 0.22
): WhamPoseSequence {
  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  const lastGood: Partial<
    Record<
      WhamJointId,
      {
        rotation: [number, number, number];
        position?: [number, number, number];
        confidence: number;
        frame: number;
      }
    >
  > = {};

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]!;
    for (const id of WHAM_JOINT_IDS) {
      const j = f.joints[id];
      const good = j && j.confidence >= minConfidence;
      if (good && j) {
        lastGood[id] = {
          rotation: [...j.rotation] as [number, number, number],
          position: j.position
            ? ([...j.position] as [number, number, number])
            : undefined,
          confidence: j.confidence,
          frame: i,
        };
        continue;
      }
      const held = lastGood[id];
      if (!held) continue;
      // Looking ahead for reappearance to interpolate
      let nextIdx = -1;
      let nextRot: [number, number, number] | null = null;
      let nextPos: [number, number, number] | undefined;
      for (let k = i + 1; k < Math.min(frames.length, i + 12); k++) {
        const nj = frames[k]!.joints[id];
        if (nj && nj.confidence >= minConfidence) {
          nextIdx = k;
          nextRot = [...nj.rotation] as [number, number, number];
          nextPos = nj.position
            ? ([...nj.position] as [number, number, number])
            : undefined;
          break;
        }
      }
      if (nextIdx > i && nextRot) {
        const t = (i - held.frame) / Math.max(1, nextIdx - held.frame);
        f.joints[id] = {
          rotation: lerp3(held.rotation, nextRot, t),
          position:
            held.position && nextPos
              ? lerp3(held.position, nextPos, t)
              : held.position,
          confidence: held.confidence * (1 - t * 0.15),
        };
      } else {
        f.joints[id] = {
          rotation: [...held.rotation] as [number, number, number],
          position: held.position
            ? ([...held.position] as [number, number, number])
            : undefined,
          confidence: held.confidence * 0.92,
        };
      }
    }
  }

  return { ...sequence, frames };
}
