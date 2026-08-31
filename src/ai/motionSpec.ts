/**
 * Humanoid motion intermediate format (inspired by text-to-vrma).
 * LLM / presets emit this; we retarget into AnimaStage timeline tracks.
 */

export const MOTION_SPEC_BONES = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftShoulder',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightShoulder',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
] as const;

export type MotionSpecBone = (typeof MOTION_SPEC_BONES)[number];

export const MOTION_SPEC_EXPRESSIONS = [
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
  'blink',
  'aa',
] as const;

export type MotionSpecExpression = (typeof MOTION_SPEC_EXPRESSIONS)[number];

export interface MotionRotKey {
  /** Seconds from start */
  t: number;
  /** Euler degrees XYZ relative to T-pose */
  r: [number, number, number];
}

export interface MotionPosKey {
  t: number;
  /** Hips offset in meters from rest */
  p: [number, number, number];
}

export interface MotionExprKey {
  t: number;
  /** Weight 0..1 */
  w: number;
}

export interface MotionSpec {
  name: string;
  duration: number;
  loop: boolean;
  tracks: Partial<Record<MotionSpecBone, MotionRotKey[]>>;
  hips?: MotionPosKey[];
  expressions?: Partial<Record<MotionSpecExpression, MotionExprKey[]>>;
}

const BONE_SET = new Set<string>(MOTION_SPEC_BONES);
const EXPR_SET = new Set<string>(MOTION_SPEC_EXPRESSIONS);

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function asVec3(v: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(v) || v.length < 3) return fallback;
  return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
}

function sanitizeRotKeys(keys: unknown): MotionRotKey[] {
  if (!Array.isArray(keys)) return [];
  return keys
    .map((k) => {
      const row = k as { t?: unknown; r?: unknown };
      return {
        t: Math.max(0, Number(row.t) || 0),
        r: asVec3(row.r, [0, 0, 0]),
      };
    })
    .sort((a, b) => a.t - b.t);
}

/** Parse LLM JSON (object or fenced) into a MotionSpec. */
export function parseMotionSpecJson(text: string): MotionSpec {
  const trimmed = text.trim();
  const fenced = trimmed.match(/\{[\s\S]*\}/);
  const raw = JSON.parse(fenced ? fenced[0] : trimmed) as Record<string, unknown>;

  const tracks: MotionSpec['tracks'] = {};
  const rawTracks = (raw.tracks ?? {}) as Record<string, unknown>;
  for (const [bone, keys] of Object.entries(rawTracks)) {
    if (!BONE_SET.has(bone)) continue;
    const sanitized = sanitizeRotKeys(keys);
    if (sanitized.length) tracks[bone as MotionSpecBone] = sanitized;
  }

  const hips = Array.isArray(raw.hips)
    ? (raw.hips as Array<{ t?: unknown; p?: unknown }>)
        .map((k) => ({
          t: Math.max(0, Number(k.t) || 0),
          p: asVec3(k.p, [0, 0, 0]),
        }))
        .sort((a, b) => a.t - b.t)
    : [];

  const expressions: MotionSpec['expressions'] = {};
  const rawExpr = (raw.expressions ?? {}) as Record<string, unknown>;
  for (const [name, keys] of Object.entries(rawExpr)) {
    if (!EXPR_SET.has(name) || !Array.isArray(keys)) continue;
    const list = keys
      .map((k) => {
        const row = k as { t?: unknown; w?: unknown };
        return {
          t: Math.max(0, Number(row.t) || 0),
          w: clamp(Number(row.w) || 0, 0, 1),
        };
      })
      .sort((a, b) => a.t - b.t);
    if (list.length) expressions[name as MotionSpecExpression] = list;
  }

  return {
    name: String(raw.name ?? 'motion').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'motion',
    duration: clamp(Number(raw.duration) || 2.5, 1, 20),
    loop: Boolean(raw.loop),
    tracks,
    hips,
    expressions,
  };
}

/** Clamp joint angles to safe humanoid ranges (text-to-vrma style). */
export function validateAndClampMotionSpec(spec: MotionSpec): MotionSpec {
  const next: MotionSpec = {
    ...spec,
    duration: clamp(spec.duration, 1, 20),
    tracks: { ...spec.tracks },
    hips: [...(spec.hips ?? [])],
    expressions: { ...(spec.expressions ?? {}) },
  };

  const limits: Partial<Record<MotionSpecBone, [number, number, number]>> = {
    head: [45, 60, 35],
    neck: [40, 45, 30],
    spine: [30, 35, 25],
    chest: [25, 30, 20],
    leftUpperArm: [90, 90, 90],
    rightUpperArm: [90, 90, 90],
    leftLowerArm: [20, 90, 120],
    rightLowerArm: [20, 90, 120],
    leftUpperLeg: [90, 40, 40],
    rightUpperLeg: [90, 40, 40],
    leftLowerLeg: [130, 15, 15],
    rightLowerLeg: [130, 15, 15],
  };

  for (const bone of Object.keys(next.tracks) as MotionSpecBone[]) {
    const keys = next.tracks[bone];
    if (!keys) continue;
    const lim = limits[bone] ?? [90, 90, 90];
    next.tracks[bone] = keys.map((k) => ({
      t: clamp(k.t, 0, next.duration),
      r: [
        clamp(k.r[0], -lim[0], lim[0]),
        clamp(k.r[1], -lim[1], lim[1]),
        clamp(k.r[2], -lim[2], lim[2]),
      ],
    }));
  }

  // Knees: no hyperextension (X must stay >= 0 for lowerLeg bend-back convention in VRM).
  for (const bone of ['leftLowerLeg', 'rightLowerLeg'] as const) {
    const keys = next.tracks[bone];
    if (!keys) continue;
    next.tracks[bone] = keys.map((k) => ({
      ...k,
      r: [clamp(k.r[0], 0, 130), clamp(k.r[1], -10, 10), clamp(k.r[2], -10, 10)],
    }));
  }

  next.hips = (next.hips ?? []).map((k) => ({
    t: clamp(k.t, 0, next.duration),
    p: [
      clamp(k.p[0], -0.4, 0.4),
      clamp(k.p[1], -0.4, 0.45),
      clamp(k.p[2], -0.4, 0.4),
    ],
  }));

  return next;
}

function sampleAxisZ(keys: MotionRotKey[], t: number): number {
  if (!keys.length) return 0;
  if (t <= keys[0]!.t) return keys[0]!.r[2];
  const last = keys[keys.length - 1]!;
  if (t >= last.t) return last.r[2];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.r[2] + (b.r[2] - a.r[2]) * u;
    }
  }
  return last.r[2];
}

/** Heuristic wave fix from text-to-vrma — keeps hand-wave anatomically sane. */
export function applyWaveCorrection(spec: MotionSpec): MotionSpec {
  const next: MotionSpec = {
    ...spec,
    tracks: { ...spec.tracks },
  };

  for (const side of ['left', 'right'] as const) {
    const raiseSign = side === 'left' ? 1 : -1;
    const uaKey = `${side}UpperArm` as MotionSpecBone;
    const laKey = `${side}LowerArm` as MotionSpecBone;
    const ua = next.tracks[uaKey];
    const la = next.tracks[laKey];
    if (!ua?.length) continue;

    const maxRaise = Math.max(...ua.map((k) => raiseSign * k.r[2]));
    if (maxRaise < 35) continue;

    next.tracks[uaKey] = ua.map((k) => {
      const r: [number, number, number] = [...k.r];
      if (raiseSign * r[2] > 52) r[2] = raiseSign * 52;
      return { t: k.t, r };
    });

    if (!la?.length) continue;
    next.tracks[laKey] = la.map((k) => {
      const raise = raiseSign * sampleAxisZ(next.tracks[uaKey]!, k.t);
      const r: [number, number, number] = [0, k.r[1], k.r[2]];
      if (raise > 30) {
        const bend = raiseSign * k.r[2];
        const lo = Math.max(20, 88 - raise);
        const hi = 108 - raise;
        r[2] = raiseSign * clamp(bend, lo, hi);
      }
      return { t: k.t, r };
    });
  }

  return next;
}

/** Ensure arms start in a natural lowered pose if missing t=0. */
export function ensureNeutralArmRest(spec: MotionSpec): MotionSpec {
  const next: MotionSpec = {
    ...spec,
    tracks: { ...spec.tracks },
  };
  const dur = next.duration;

  const ensure = (bone: MotionSpecBone, rest: [number, number, number]) => {
    const keys = [...(next.tracks[bone] ?? [])].sort((a, b) => a.t - b.t);
    if (!keys.length) {
      next.tracks[bone] = [
        { t: 0, r: rest },
        { t: dur, r: rest },
      ];
      return;
    }
    if (keys[0]!.t > 0.05) keys.unshift({ t: 0, r: rest });
    const last = keys[keys.length - 1]!;
    if (last.t < dur - 0.05) keys.push({ t: dur, r: [...last.r] as [number, number, number] });
    next.tracks[bone] = keys;
  };

  ensure('leftUpperArm', [0, 0, -70]);
  ensure('rightUpperArm', [0, 0, 70]);
  return next;
}

export function finalizeMotionSpec(spec: MotionSpec): MotionSpec {
  return applyWaveCorrection(
    validateAndClampMotionSpec(ensureNeutralArmRest(spec))
  );
}
