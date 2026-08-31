/**
 * Confidence gate — contribute motion by landmark confidence bands.
 */
import type { WhamJointId, WhamPoseSequence } from '../wham/types';
import { WHAM_JOINT_IDS } from '../wham/types';
import type { ConfidenceGateSettings } from '../engine/types';
import { DEFAULT_CONFIDENCE_GATE } from '../engine/types';

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
 * Low confidence → hold previous joint.
 * Medium → heavy blend toward previous.
 * High → keep sample.
 */
export function applyConfidenceGate(
  sequence: WhamPoseSequence,
  settings: Partial<ConfidenceGateSettings> = {}
): WhamPoseSequence {
  const gate = { ...DEFAULT_CONFIDENCE_GATE, ...settings };
  if (sequence.frames.length < 2) return sequence;

  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
  }));

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    for (const id of WHAM_JOINT_IDS) {
      const cj = cur.joints[id as WhamJointId];
      const pj = prev.joints[id as WhamJointId];
      if (!cj) {
        if (pj) {
          cur.joints[id] = {
            rotation: [...pj.rotation] as [number, number, number],
            position: pj.position
              ? ([...pj.position] as [number, number, number])
              : undefined,
            confidence: pj.confidence * 0.9,
          };
        }
        continue;
      }
      if (!pj) continue;
      if (cj.confidence < gate.low) {
        cur.joints[id] = {
          rotation: [...pj.rotation] as [number, number, number],
          position: pj.position
            ? ([...pj.position] as [number, number, number])
            : cj.position,
          confidence: Math.max(cj.confidence, pj.confidence * 0.85),
        };
      } else if (cj.confidence < gate.medium) {
        const t = 0.22;
        cur.joints[id] = {
          rotation: lerp3(pj.rotation, cj.rotation, t),
          position:
            pj.position && cj.position
              ? lerp3(pj.position, cj.position, t)
              : cj.position ?? pj.position,
          confidence: cj.confidence,
        };
      }
    }
  }

  return { ...sequence, frames };
}
