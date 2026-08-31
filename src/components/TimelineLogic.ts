import * as THREE from 'three';
import type { TimelineBoneMap, TimelineBoneTrack } from '../utils/genericSkeletonBinding';
import { getTimelineBoneMap } from '../utils/genericSkeletonBinding';
import { evaluateSegment } from '../editor/curveMath';

export const TIMELINE_TRACK_IDS = [
  'morph_eyes',
  'morph_mouth',
  'morph_brow',
  'bone_head_y',
  'bone_neck_x',
  'bone_spine_y',
  'bone_spine_z',
  'bone_waist_y',
  'bone_l_arm_x',
  'bone_l_arm_z',
  'bone_r_arm_x',
  'bone_r_arm_z',
] as const satisfies readonly TimelineTrackId[];

export const TIMELINE_TRACK_LABELS: Record<TimelineTrackId, string> = {
  morph_eyes: 'Morph: Eyes close',
  morph_mouth: 'Morph: Mouth smile',
  morph_brow: 'Morph: Brow raise',
  bone_head_y: 'Bone: Head Rot (Y)',
  bone_neck_x: 'Bone: Neck Rot (X)',
  bone_spine_y: 'Bone: Upper Body (Y)',
  bone_spine_z: 'Bone: Upper Body Lean (Z)',
  bone_waist_y: 'Bone: Hips Sway (Y)',
  bone_l_arm_x: 'Bone: L-Shoulder (X)',
  bone_l_arm_z: 'Bone: L-Arm (Z)',
  bone_r_arm_x: 'Bone: R-Shoulder (X)',
  bone_r_arm_z: 'Bone: R-Arm (Z)',
};

export type TimelineEvaluated = Record<TimelineTrackId, number>;

export interface TimelineLiveValues {
  morphs: MorphState;
  boneHeadY: number;
  boneNeckX: number;
  boneSpineY: number;
  boneSpineZ: number;
  boneWaistY: number;
  boneArmLX: number;
  boneArmLZ: number;
  boneArmRX: number;
  boneArmRZ: number;
}

const DEG2RAD = Math.PI / 180;

type RestPoseMap = Record<string, [number, number, number]>;

const MORPH_NAME_CANDIDATES: Record<'eyes' | 'mouth' | 'brow', string[]> = {
  eyes: [
    'まばたき',
    'blink_l',
    'blink_r',
    'blink',
    'eyesblink',
    'eyes close',
    'eye_close',
    'eyes_closed',
    'eyeblink',
  ],
  mouth: [
    'あ',
    'mouth_open',
    'mouthopen',
    'mouth smile',
    'mouth_smile',
    'lips:a',
    'open',
    'a',
    'smile',
  ],
  brow: ['困る', 'sad_brow', 'sad', 'browsad', 'troubled', 'brow raise', 'brow_up', 'angry'],
};

const BONE_TRACK_BINDINGS: Record<
  Exclude<TimelineTrackId, 'morph_eyes' | 'morph_mouth' | 'morph_brow'>,
  { axis: 'x' | 'y' | 'z'; candidates: string[] }
> = {
  bone_head_y: { axis: 'y', candidates: ['頭', 'head', 'Head', 'HEAD'] },
  bone_neck_x: { axis: 'x', candidates: ['首', 'neck', 'Neck', 'NECK'] },
  bone_spine_y: { axis: 'y', candidates: ['上半身', 'upper body', 'upperbody', 'spine'] },
  bone_spine_z: { axis: 'z', candidates: ['上半身', 'upper body', 'upperbody', 'spine'] },
  bone_waist_y: { axis: 'y', candidates: ['下半身', 'lower body', 'lowerbody', 'waist', 'pelvis'] },
  bone_l_arm_x: { axis: 'x', candidates: ['左肩', 'left shoulder', 'leftshoulder'] },
  bone_l_arm_z: { axis: 'z', candidates: ['左腕', 'leftarm', 'left arm'] },
  bone_r_arm_x: { axis: 'x', candidates: ['右肩', 'right shoulder', 'rightshoulder'] },
  bone_r_arm_z: { axis: 'z', candidates: ['右腕', 'rightarm', 'right arm'] },
};

/** Store bind-pose rotations so timeline edits are applied as offsets, not absolutes. */
export function snapshotMmdRestPose(mesh: THREE.SkinnedMesh): void {
  const rest: RestPoseMap = {};
  for (const bone of mesh.skeleton.bones) {
    rest[bone.name] = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
  }
  mesh.userData.mmdRestPose = rest;
}

function createKeyframeId(): string {
  return `kf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function findBoneInList(bones: BoneState[], id: string): BoneState | undefined {
  return bones.find((b) => b.id === id);
}

export function createEmptyKeyframes(): TimelineKeyframe[] {
  return [];
}

export function countTimelineKeyframes(keyframes: TimelineKeyframe[]): number {
  return keyframes.length;
}

export function getKeyframesForTrack(
  keyframes: TimelineKeyframe[],
  track: TimelineTrackId
): TimelineKeyframe[] {
  return keyframes
    .filter((kf) => kf.track === track)
    .sort((a, b) => a.frame - b.frame);
}

export function addKeyframe(
  keyframes: TimelineKeyframe[],
  frame: number,
  track: TimelineTrackId,
  value: number
): TimelineKeyframe[] {
  const next = keyframes.filter((kf) => !(kf.track === track && kf.frame === frame));
  next.push({
    id: createKeyframeId(),
    frame,
    track,
    value,
  });
  return next.sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

export function deleteKeyframe(
  keyframes: TimelineKeyframe[],
  track: TimelineTrackId,
  frame: number
): TimelineKeyframe[] {
  return keyframes.filter((kf) => !(kf.track === track && kf.frame === frame));
}

function timelineKeyframeKey(track: TimelineTrackId, frame: number): string {
  return `${track}:${frame}`;
}

/** Stack model keys — incoming wins on the same track + frame. */
export function mergeTimelineKeyframes(
  existing: TimelineKeyframe[],
  incoming: TimelineKeyframe[]
): TimelineKeyframe[] {
  const map = new Map<string, TimelineKeyframe>();
  for (const kf of existing) {
    map.set(timelineKeyframeKey(kf.track, kf.frame), kf);
  }
  for (const kf of incoming) {
    map.set(timelineKeyframeKey(kf.track, kf.frame), {
      ...kf,
      id: createKeyframeId(),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

export function getDefaultLiveValues(
  bones: BoneState[],
  morphs?: MorphState
): TimelineLiveValues {
  const head = findBoneInList(bones, 'head');
  const neck = findBoneInList(bones, 'neck');
  const spine = findBoneInList(bones, 'spine');
  const waist = findBoneInList(bones, 'waist');
  const armL = findBoneInList(bones, 'arm_L');
  const armR = findBoneInList(bones, 'arm_R');
  const m = morphs ?? { eyes: 0, mouth: 0, brow: 0 };

  return {
    morphs: { ...m },
    boneHeadY: head?.rotationY ?? 0,
    boneNeckX: neck?.rotationX ?? 0,
    boneSpineY: spine?.rotationY ?? 0,
    boneSpineZ: spine?.rotationZ ?? 0,
    boneWaistY: waist?.rotationY ?? 0,
    boneArmLX: armL?.rotationX ?? 0,
    boneArmLZ: armL?.rotationZ ?? 0,
    boneArmRX: armR?.rotationX ?? 0,
    boneArmRZ: armR?.rotationZ ?? 0,
  };
}

export function buildDefaultsFromLive(live: TimelineLiveValues): TimelineEvaluated {
  return {
    morph_eyes: live.morphs.eyes,
    morph_mouth: live.morphs.mouth,
    morph_brow: live.morphs.brow,
    bone_head_y: live.boneHeadY,
    bone_neck_x: live.boneNeckX,
    bone_spine_y: live.boneSpineY,
    bone_spine_z: live.boneSpineZ,
    bone_waist_y: live.boneWaistY,
    bone_l_arm_x: live.boneArmLX,
    bone_l_arm_z: live.boneArmLZ,
    bone_r_arm_x: live.boneArmRX,
    bone_r_arm_z: live.boneArmRZ,
  };
}

export function lerpTrackValue(
  trackKeyframes: TimelineKeyframe[],
  frame: number,
  defaultValue: number
): number {
  if (trackKeyframes.length === 0) return defaultValue;

  const sorted = [...trackKeyframes].sort((a, b) => a.frame - b.frame);
  const exact = sorted.find((kf) => kf.frame === frame);
  if (exact) return exact.value;

  if (frame <= sorted[0].frame) return sorted[0].value;
  if (frame >= sorted[sorted.length - 1].frame) return sorted[sorted.length - 1].value;

  let prev = sorted[0];
  let next = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }

  const range = next.frame - prev.frame;
  if (range === 0) return prev.value;
  const t = (frame - prev.frame) / range;
  return evaluateSegment(prev, next, t);
}

export { evaluateTimelineWithLayers } from '../editor/animationLayers';

export function evaluateTimelineAtFrame(
  keyframes: TimelineKeyframe[],
  frame: number,
  live?: TimelineLiveValues
): TimelineEvaluated {
  const defaults = buildDefaultsFromLive(
    live ?? getDefaultLiveValues([], { eyes: 0, mouth: 0, brow: 0 })
  );
  const result = { ...defaults };

  for (const track of TIMELINE_TRACK_IDS) {
    const trackKeys = getKeyframesForTrack(keyframes, track);
    if (trackKeys.length === 0) continue;
    result[track] = lerpTrackValue(trackKeys, frame, defaults[track]);
  }

  return result;
}

export function registerAllKeyframesAtFrame(
  keyframes: TimelineKeyframe[],
  frame: number,
  morphs: MorphState,
  bones: BoneState[]
): TimelineKeyframe[] {
  const live = getDefaultLiveValues(bones, morphs);
  const values = buildDefaultsFromLive(live);

  let next = keyframes;
  for (const track of TIMELINE_TRACK_IDS) {
    next = addKeyframe(next, frame, track, values[track]);
  }
  return next;
}

export function generateWaveKeyframes(maxFrames = 120): TimelineKeyframe[] {
  const keyframes: TimelineKeyframe[] = [];
  const waveFrames = [15, 30, 45, 60, 75, 90, 105, 120].filter((f) => f <= maxFrames);

  waveFrames.forEach((frame, index) => {
    const wave = Math.sin((frame / Math.max(maxFrames, 1)) * Math.PI * 2);
    keyframes.push({
      id: createKeyframeId(),
      frame,
      track: 'morph_eyes',
      value: index % 2 === 0 ? 0 : 0.85,
    });
    keyframes.push({ id: createKeyframeId(), frame, track: 'bone_head_y', value: wave * 20 });
    keyframes.push({ id: createKeyframeId(), frame, track: 'bone_spine_y', value: wave * 10 });
    keyframes.push({ id: createKeyframeId(), frame, track: 'bone_waist_y', value: wave * 12 });
    keyframes.push({ id: createKeyframeId(), frame, track: 'bone_l_arm_z', value: wave * 35 });
    keyframes.push({ id: createKeyframeId(), frame, track: 'bone_r_arm_z', value: -wave * 35 });
  });

  return keyframes.sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

function findMorphIndex(dict: Record<string, number>, candidates: string[]): number {
  for (const candidate of candidates) {
    const found = Object.keys(dict).find(
      (name) =>
        name.toLowerCase() === candidate.toLowerCase() ||
        name.toLowerCase().includes(candidate.toLowerCase())
    );
    if (found !== undefined) return dict[found];
  }
  return -1;
}

function findBone(
  skeleton: THREE.Skeleton,
  candidates: string[],
  boneMap?: TimelineBoneMap,
  track?: TimelineBoneTrack
): THREE.Bone | null {
  if (track && boneMap?.[track]) {
    const mapped = skeleton.bones.find((b) => b.name === boneMap[track]);
    if (mapped) return mapped;
  }

  for (const candidate of candidates) {
    const exact = skeleton.bones.find(
      (b) => b.name === candidate || b.name.toLowerCase() === candidate.toLowerCase()
    );
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const partial = skeleton.bones.find((b) =>
      b.name.toLowerCase().includes(candidate.toLowerCase())
    );
    if (partial) return partial;
  }
  return null;
}

export interface ApplyTimelineOptions {
  skipMorphs?: boolean;
  skipBones?: boolean;
}

export function applyTimelineToSkinnedMesh(
  mesh: THREE.SkinnedMesh,
  evaluated: TimelineEvaluated,
  options: ApplyTimelineOptions = {}
): void {
  const { skipMorphs = false, skipBones = false } = options;

  if (!skipMorphs) {
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (dict && influences) {
      const idxEyes = findMorphIndex(dict, MORPH_NAME_CANDIDATES.eyes);
      if (idxEyes !== -1) influences[idxEyes] = evaluated.morph_eyes;

      const idxMouth = findMorphIndex(dict, MORPH_NAME_CANDIDATES.mouth);
      if (idxMouth !== -1) influences[idxMouth] = evaluated.morph_mouth;

      const idxBrow = findMorphIndex(dict, MORPH_NAME_CANDIDATES.brow);
      if (idxBrow !== -1) influences[idxBrow] = evaluated.morph_brow;
    }
  }

  if (!skipBones && mesh.skeleton) {
    const rest = (mesh.userData.mmdRestPose as RestPoseMap | undefined) ?? {};
    const boneMap = getTimelineBoneMap(mesh);
    const boneAdjustments = new Map<string, { x: number; y: number; z: number }>();

    for (const [track, binding] of Object.entries(BONE_TRACK_BINDINGS) as Array<
      [
        Exclude<TimelineTrackId, 'morph_eyes' | 'morph_mouth' | 'morph_brow'>,
        (typeof BONE_TRACK_BINDINGS)[keyof typeof BONE_TRACK_BINDINGS],
      ]
    >) {
      const bone = findBone(mesh.skeleton, binding.candidates, boneMap, track);
      if (!bone) continue;

      const entry = boneAdjustments.get(bone.name) ?? { x: 0, y: 0, z: 0 };
      entry[binding.axis] = evaluated[track];
      boneAdjustments.set(bone.name, entry);
    }

    for (const bone of mesh.skeleton.bones) {
      const adj = boneAdjustments.get(bone.name);
      if (!adj) continue;

      const base = rest[bone.name] ?? [0, 0, 0];
      bone.rotation.set(
        base[0] + adj.x * DEG2RAD,
        base[1] + adj.y * DEG2RAD,
        base[2] + adj.z * DEG2RAD
      );
    }

    mesh.skeleton.update();
  }
}
