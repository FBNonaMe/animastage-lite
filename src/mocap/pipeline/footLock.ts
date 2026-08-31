/**
 * Configurable foot lock — contact detect → lock → smooth release.
 */
import type { WhamPoseSequence } from '../wham/types';
import type { FootLockSettings } from '../engine/types';
import { DEFAULT_FOOT_LOCK } from '../engine/types';

export function applyFootLock(
  sequence: WhamPoseSequence,
  settings: Partial<FootLockSettings> = {}
): WhamPoseSequence {
  const cfg = { ...DEFAULT_FOOT_LOCK, ...settings };
  if (!cfg.enabled || sequence.frames.length < 3) return sequence;

  const frames = sequence.frames.map((f) => ({
    ...f,
    joints: { ...f.joints },
    root: {
      ...f.root,
      position: [...f.root.position] as [number, number, number],
    },
  }));

  type LockState = {
    locked: boolean;
    pos: [number, number, number] | null;
  };
  const left: LockState = { locked: false, pos: null };
  const right: LockState = { locked: false, pos: null };

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]!;
    const cur = frames[i]!;
    const dt = Math.max(1e-3, cur.time - prev.time);

    for (const side of [
      { id: 'leftFoot' as const, state: left },
      { id: 'rightFoot' as const, state: right },
    ]) {
      const cj = cur.joints[side.id];
      const pj = prev.joints[side.id];
      if (!cj?.position || !pj?.position) continue;

      const speed =
        Math.hypot(
          cj.position[0]! - pj.position[0]!,
          cj.position[1]! - pj.position[1]!,
          cj.position[2]! - pj.position[2]!
        ) / dt;

      const contacting = speed < cfg.contactThreshold && cj.confidence > 0.35;

      if (contacting) {
        if (!side.state.locked) {
          side.state.locked = true;
          side.state.pos = [...cj.position] as [number, number, number];
        }
        if (side.state.pos) {
          const s = cfg.strength;
          cur.joints[side.id] = {
            ...cj,
            position: [
              cj.position[0]! * (1 - s) + side.state.pos[0]! * s,
              cj.position[1]! * (1 - s) + side.state.pos[1]! * s,
              cj.position[2]! * (1 - s) + side.state.pos[2]! * s,
            ],
            // Soften foot rotation while locked
            rotation: [
              cj.rotation[0]! * (1 - s * 0.4) + (pj.rotation[0] ?? 0) * (s * 0.4),
              cj.rotation[1]! * (1 - s * 0.4) + (pj.rotation[1] ?? 0) * (s * 0.4),
              cj.rotation[2]! * (1 - s * 0.4) + (pj.rotation[2] ?? 0) * (s * 0.4),
            ],
          };
        }
      } else if (side.state.locked && side.state.pos) {
        // Smooth release
        const rel = Math.min(1, cfg.releaseSpeed);
        cur.joints[side.id] = {
          ...cj,
          position: [
            side.state.pos[0]! * (1 - rel) + cj.position[0]! * rel,
            side.state.pos[1]! * (1 - rel) + cj.position[1]! * rel,
            side.state.pos[2]! * (1 - rel) + cj.position[2]! * rel,
          ],
        };
        if (speed > cfg.contactThreshold * 2.5) {
          side.state.locked = false;
          side.state.pos = null;
        } else {
          side.state.pos = cur.joints[side.id]?.position
            ? ([...cur.joints[side.id]!.position!] as [number, number, number])
            : side.state.pos;
        }
      }
    }
  }

  return { ...sequence, frames };
}

/** Extract per-frame foot contact flags for debug / tracks. */
export function extractFootContacts(
  sequence: WhamPoseSequence,
  threshold = 0.04
): Array<{ frame: number; left: boolean; right: boolean }> {
  const out: Array<{ frame: number; left: boolean; right: boolean }> = [];
  for (let i = 1; i < sequence.frames.length; i++) {
    const prev = sequence.frames[i - 1]!;
    const cur = sequence.frames[i]!;
    const dt = Math.max(1e-3, cur.time - prev.time);
    const footContact = (id: 'leftFoot' | 'rightFoot') => {
      const c = cur.joints[id]?.position;
      const p = prev.joints[id]?.position;
      if (!c || !p) return false;
      const speed =
        Math.hypot(c[0]! - p[0]!, c[1]! - p[1]!, c[2]! - p[2]!) / dt;
      return speed < threshold;
    };
    out.push({
      frame: cur.frame,
      left: footContact('leftFoot'),
      right: footContact('rightFoot'),
    });
  }
  return out;
}
