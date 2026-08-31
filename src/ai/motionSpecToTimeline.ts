/**
 * Convert MotionSpec → AnimaStage timeline keyframes (MMD_FPS).
 * Maps VRM-style humanoid Euler tracks onto the studio's simplified bone/morph lanes.
 */
import type { TimelineKeyframe, TimelineTrackId } from '../types';
import { MMD_FPS } from '../utils/playhead';
import type { MotionRotKey, MotionSpec, MotionSpecBone } from './motionSpec';

function createKeyframeId(): string {
  return `ms_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function secToFrame(t: number, maxFrames: number): number {
  return Math.min(maxFrames, Math.max(0, Math.round(t * MMD_FPS)));
}

function pushKey(
  out: TimelineKeyframe[],
  frame: number,
  track: TimelineTrackId,
  value: number,
  morph: boolean
): void {
  out.push({
    id: createKeyframeId(),
    frame,
    track,
    value: morph
      ? Math.min(1, Math.max(0, value))
      : Math.min(120, Math.max(-120, value)),
    interpolation: 'bezier',
    easeIn: 0.4,
    easeOut: 0.4,
  });
}

/** Pick one Euler axis from a bone track into a timeline lane. */
function emitAxisTrack(
  out: TimelineKeyframe[],
  keys: MotionRotKey[] | undefined,
  axis: 0 | 1 | 2,
  track: TimelineTrackId,
  maxFrames: number,
  /** Optional remap: VRM T-pose upperArm Z rest (±70) → timeline offset around 0. */
  remap?: (deg: number) => number
): void {
  if (!keys?.length) return;
  for (const k of keys) {
    const raw = k.r[axis];
    const value = remap ? remap(raw) : raw;
    pushKey(out, secToFrame(k.t, maxFrames), track, value, false);
  }
}

/**
 * VRM T-pose: arms out to the side (L Z=-70 / R Z=+70 when lowered).
 * Timeline bone_*_arm_z is an offset from rest — subtract rest pose.
 */
function armZToTimeline(side: 'left' | 'right', deg: number): number {
  const rest = side === 'left' ? -70 : 70;
  return deg - rest;
}

function mergeBonePrefer(
  a: MotionRotKey[] | undefined,
  b: MotionRotKey[] | undefined
): MotionRotKey[] | undefined {
  if (a?.length && b?.length) {
    // Prefer the denser track; otherwise blend by taking a and filling gaps from b.
    return a.length >= b.length ? a : b;
  }
  return a?.length ? a : b;
}

export function motionSpecToTimelineKeyframes(
  spec: MotionSpec,
  maxFrames: number
): TimelineKeyframe[] {
  const out: TimelineKeyframe[] = [];
  const tracks = spec.tracks;

  const spineY = mergeBonePrefer(tracks.spine, tracks.chest);
  const spineZ = mergeBonePrefer(tracks.chest, tracks.spine);

  emitAxisTrack(out, tracks.head, 1, 'bone_head_y', maxFrames);
  emitAxisTrack(out, mergeBonePrefer(tracks.neck, tracks.head), 0, 'bone_neck_x', maxFrames);
  emitAxisTrack(out, spineY, 1, 'bone_spine_y', maxFrames);
  emitAxisTrack(out, spineZ, 2, 'bone_spine_z', maxFrames);
  emitAxisTrack(out, tracks.hips, 1, 'bone_waist_y', maxFrames);

  emitAxisTrack(out, tracks.leftUpperArm, 0, 'bone_l_arm_x', maxFrames);
  emitAxisTrack(
    out,
    tracks.leftUpperArm,
    2,
    'bone_l_arm_z',
    maxFrames,
    (d) => armZToTimeline('left', d)
  );
  emitAxisTrack(out, tracks.rightUpperArm, 0, 'bone_r_arm_x', maxFrames);
  emitAxisTrack(
    out,
    tracks.rightUpperArm,
    2,
    'bone_r_arm_z',
    maxFrames,
    (d) => armZToTimeline('right', d)
  );

  // Soft influence from lower arm bend onto arm Z for wave readability.
  const enrichLower = (side: 'left' | 'right', track: TimelineTrackId) => {
    const bone = `${side}LowerArm` as MotionSpecBone;
    const keys = tracks[bone];
    if (!keys?.length) return;
    for (const k of keys) {
      const bend = side === 'left' ? -k.r[2] : k.r[2];
      if (Math.abs(bend) < 25) continue;
      pushKey(
        out,
        secToFrame(k.t, maxFrames),
        track,
        clampSoft(bend * 0.15),
        false
      );
    }
  };
  enrichLower('left', 'bone_l_arm_z');
  enrichLower('right', 'bone_r_arm_z');

  const exprs = spec.expressions ?? {};
  for (const [name, keys] of Object.entries(exprs)) {
    if (!keys?.length) continue;
    let track: TimelineTrackId | null = null;
    if (name === 'blink') track = 'morph_eyes';
    else if (name === 'happy' || name === 'aa' || name === 'relaxed') track = 'morph_mouth';
    else if (name === 'sad' || name === 'angry' || name === 'surprised') track = 'morph_brow';
    if (!track) continue;
    for (const k of keys) {
      pushKey(out, secToFrame(k.t, maxFrames), track, k.w, true);
    }
  }

  // Deduplicate same frame+track keeping last value.
  const map = new Map<string, TimelineKeyframe>();
  for (const k of out) {
    map.set(`${k.track}:${k.frame}`, k);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.frame - b.frame || a.track.localeCompare(b.track)
  );
}

function clampSoft(n: number): number {
  return Math.min(45, Math.max(-45, n));
}

/** Suggested timeline length for a motion spec. */
export function motionSpecSuggestedMaxFrames(spec: MotionSpec): number {
  return Math.max(30, Math.ceil(spec.duration * MMD_FPS) + 1);
}
