/**
 * Intelligent framing, portrait keep-in-frame, soft collision.
 */
import type { CameraSnapshot, ViewportFormat } from '../types';
import { isPortraitFormat } from '../utils/characterQuality';
import type { CameraConstraintId, CompositionGuideId, FramingModeId } from './types';

export type { FramingModeId };

const FLOOR_Y = 0.55;
const BODY_RADIUS = 2.2;

export function applyFramingConstraints(
  snapshot: CameraSnapshot,
  opts: {
    constraints: CameraConstraintId[];
    framing?: FramingModeId;
    minDistance: number;
    maxDistance: number;
    viewportFormat?: ViewportFormat;
    /** Approximate character focus / chest. */
    subject?: [number, number, number];
    subjectHeight?: number;
  }
): CameraSnapshot {
  let snap = { ...snapshot, position: [...snapshot.position] as [number, number, number], target: [...snapshot.target] as [number, number, number] };
  const subject = opts.subject ?? snap.target;
  const height = opts.subjectHeight ?? 16;
  const minD = Math.max(2.5, opts.minDistance);
  const maxD = Math.max(minD + 1, opts.maxDistance);

  // Soft body collision — push out of character volume
  if (
    opts.constraints.includes('avoid_collision') ||
    opts.constraints.includes('avoid_penetration')
  ) {
    const dx = snap.position[0] - subject[0];
    const dy = snap.position[1] - subject[1];
    const dz = snap.position[2] - subject[2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist < BODY_RADIUS && dist > 1e-5) {
      const s = BODY_RADIUS / dist;
      snap.position = [subject[0] + dx * s, subject[1] + dy * s, subject[2] + dz * s];
    }
  }

  // Ground
  if (opts.constraints.includes('avoid_ground') || opts.constraints.includes('avoid_penetration')) {
    if (snap.position[1] < FLOOR_Y) {
      snap.position = [snap.position[0], FLOOR_Y, snap.position[2]];
    }
  }

  // Distance clamp
  {
    const dx = snap.position[0] - subject[0];
    const dy = snap.position[1] - subject[1];
    const dz = snap.position[2] - subject[2];
    let dist = Math.hypot(dx, dy, dz);
    if (dist < 1e-5) dist = minD;
    if (dist < minD || dist > maxD) {
      const targetDist = Math.max(minD, Math.min(maxD, dist));
      const s = targetDist / dist;
      snap.position = [subject[0] + dx * s, subject[1] + dy * s, subject[2] + dz * s];
    }
  }

  const framing = opts.framing ?? 'none';
  const keepFace =
    framing === 'keep_face' ||
    framing === 'keep_eyes' ||
    opts.constraints.includes('keep_face') ||
    opts.constraints.includes('keep_eyes');
  const keepFull =
    framing === 'keep_full_body' ||
    framing === 'keep_character' ||
    opts.constraints.includes('keep_character');

  if (keepFace) {
    const faceY = subject[1] + height * 0.42;
    snap.target = [subject[0], faceY, subject[2]];
    // nudge closer for face
    const dx = snap.position[0] - snap.target[0];
    const dy = snap.position[1] - snap.target[1];
    const dz = snap.position[2] - snap.target[2];
    const dist = Math.hypot(dx, dy, dz);
    const want = framing === 'keep_eyes' ? Math.max(minD, 5.5) : Math.max(minD, 7);
    if (dist > want * 1.35 || dist < want * 0.7) {
      const s = want / Math.max(dist, 1e-5);
      snap.position = [snap.target[0] + dx * s, snap.target[1] + dy * s, snap.target[2] + dz * s];
    }
    if (framing === 'keep_eyes') snap.fov = Math.min(snap.fov, 32);
  } else if (keepFull || framing === 'auto_reframe' || framing === 'dynamic') {
    snap.target = [subject[0], subject[1] + height * 0.12, subject[2]];
    const dx = snap.position[0] - snap.target[0];
    const dy = snap.position[1] - snap.target[1];
    const dz = snap.position[2] - snap.target[2];
    const dist = Math.hypot(dx, dy, dz);
    const want = Math.max(minD, height * 1.05);
    if (dist < want) {
      const s = want / Math.max(dist, 1e-5);
      snap.position = [snap.target[0] + dx * s, snap.target[1] + dy * s, snap.target[2] + dz * s];
    }
    snap.fov = Math.max(snap.fov, 38);
  }

  // Portrait 9:16 — keep head & feet in frame via distance + FOV
  if (opts.viewportFormat && isPortraitFormat(opts.viewportFormat)) {
    snap = applyPortraitKeepInFrame(snap, subject, height);
  }

  if (opts.constraints.includes('lock_horizon') || opts.constraints.includes('auto_level')) {
    snap.rotation = [snap.rotation[0], snap.rotation[1], 0];
  }

  return snap;
}

/** Portrait mode: pull back + widen FOV so character fits vertically. */
export function applyPortraitKeepInFrame(
  snapshot: CameraSnapshot,
  subject: [number, number, number],
  subjectHeight = 16
): CameraSnapshot {
  const target: [number, number, number] = [
    subject[0],
    subject[1] + subjectHeight * 0.15,
    subject[2],
  ];
  const dx = snapshot.position[0] - target[0];
  const dy = snapshot.position[1] - target[1];
  const dz = snapshot.position[2] - target[2];
  let dist = Math.hypot(dx, dy, dz);
  const minPortraitDist = Math.max(14, subjectHeight * 1.15);
  if (dist < minPortraitDist) {
    const s = minPortraitDist / Math.max(dist, 1e-5);
    return {
      ...snapshot,
      position: [target[0] + dx * s, target[1] + dy * s + 0.4, target[2] + dz * s],
      target,
      fov: Math.max(snapshot.fov, 40),
    };
  }
  // Prevent head clipping — slightly raise look target & ensure height
  const posY = Math.max(snapshot.position[1], target[1] + 0.5);
  return {
    ...snapshot,
    position: [snapshot.position[0], posY, snapshot.position[2]],
    target,
    fov: Math.max(snapshot.fov, 38),
  };
}

export function recommendCompositionPlacement(
  guide: CompositionGuideId,
  subject: [number, number, number]
): { targetOffset: [number, number, number]; note: string } {
  switch (guide) {
    case 'thirds':
      return {
        targetOffset: [0.6, subject[1] * 0.02, 0],
        note: 'Place subject on right third — classic cinematic.',
      };
    case 'golden':
      return {
        targetOffset: [0.45, subject[1] * 0.03, 0],
        note: 'Offset toward golden section.',
      };
    case 'portrait':
    case 'social':
      return {
        targetOffset: [0, subject[1] * 0.08, 0],
        note: 'Center vertically with headroom for 9:16 / social.',
      };
    case 'center':
      return { targetOffset: [0, 0, 0], note: 'Centered heroic framing.' };
    default:
      return { targetOffset: [0, 0, 0], note: 'Free composition.' };
  }
}
