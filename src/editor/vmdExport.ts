/**
 * Export timeline keyframes + optional loaded VMD merge to .vmd binary.
 * Format: Vocaloid Motion Data 0002 (MMD standard).
 */
import type { TimelineKeyframe, TimelineTrackId } from '../types';
import {
  TIMELINE_TRACK_IDS,
  evaluateTimelineAtFrame,
  getDefaultLiveValues,
  type TimelineLiveValues,
} from '../components/TimelineLogic';
import type { BoneState, MorphState } from '../types';
import { MMD_FPS } from '../utils/playhead';
import {
  encodeVmdBoneInterpolation,
  linearVmdInterpolation,
} from './vmdInterpolation';

const BONE_EXPORT: Record<
  Exclude<TimelineTrackId, 'morph_eyes' | 'morph_mouth' | 'morph_brow'>,
  { boneName: string; axis: 'x' | 'y' | 'z' }
> = {
  bone_head_y: { boneName: '頭', axis: 'y' },
  bone_neck_x: { boneName: '首', axis: 'x' },
  bone_spine_y: { boneName: '上半身', axis: 'y' },
  bone_spine_z: { boneName: '上半身', axis: 'z' },
  bone_waist_y: { boneName: '下半身', axis: 'y' },
  bone_l_arm_x: { boneName: '左肩', axis: 'x' },
  bone_l_arm_z: { boneName: '左腕', axis: 'z' },
  bone_r_arm_x: { boneName: '右肩', axis: 'x' },
  bone_r_arm_z: { boneName: '右腕', axis: 'z' },
};

const MORPH_EXPORT: Record<'morph_eyes' | 'morph_mouth' | 'morph_brow', string> = {
  morph_eyes: 'まばたき',
  morph_mouth: 'あ',
  morph_brow: '困る',
};

function encodeSjis(str: string, byteLen: number): Uint8Array {
  const out = new Uint8Array(byteLen);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str.slice(0, byteLen));
  out.fill(0);
  out.set(bytes.subarray(0, byteLen));
  return out;
}

function writeMotion(
  view: DataView,
  offset: number,
  boneName: string,
  frameNum: number,
  position: [number, number, number],
  rotation: [number, number, number, number],
  interpolation?: Uint8Array
): number {
  const nameBytes = encodeSjis(boneName, 15);
  new Uint8Array(view.buffer, offset, 15).set(nameBytes);
  offset += 15;
  view.setUint32(offset, frameNum, true);
  offset += 4;
  view.setFloat32(offset, position[0], true);
  view.setFloat32(offset + 4, position[1], true);
  view.setFloat32(offset + 8, position[2], true);
  offset += 12;
  view.setFloat32(offset, rotation[0], true);
  view.setFloat32(offset + 4, rotation[1], true);
  view.setFloat32(offset + 8, rotation[2], true);
  view.setFloat32(offset + 12, rotation[3], true);
  offset += 16;
  const curve = interpolation ?? linearVmdInterpolation();
  new Uint8Array(view.buffer, offset, 64).set(curve);
  return offset + 64;
}

function writeMorph(view: DataView, offset: number, morphName: string, frameNum: number, weight: number): number {
  const nameBytes = encodeSjis(morphName, 15);
  new Uint8Array(view.buffer, offset, 15).set(nameBytes);
  offset += 15;
  view.setUint32(offset, frameNum, true);
  offset += 4;
  view.setFloat32(offset, weight, true);
  return offset + 4;
}

function eulerToQuat(x: number, y: number, z: number): [number, number, number, number] {
  const cx = Math.cos(x / 2);
  const sx = Math.sin(x / 2);
  const cy = Math.cos(y / 2);
  const sy = Math.sin(y / 2);
  const cz = Math.cos(z / 2);
  const sz = Math.sin(z / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

export interface VmdExportInput {
  keyframes: TimelineKeyframe[];
  maxFrames: number;
  bones: BoneState[];
  morphs: MorphState;
  clipName?: string;
  /** Write MMD-native bezier interpolation bytes from timeline curve handles. */
  nativeBezier?: boolean;
}

function boneInterpolationAtFrame(
  keyframes: TimelineKeyframe[],
  frame: number,
  nativeBezier: boolean
): Uint8Array {
  if (!nativeBezier) return linearVmdInterpolation();
  const atFrame = keyframes.filter((k) => k.frame === frame);
  const bezier = atFrame.find((k) => k.interpolation === 'bezier');
  if (!bezier) return linearVmdInterpolation();
  return encodeVmdBoneInterpolation(
    'bezier',
    bezier.easeOut ?? 0.33,
    bezier.easeIn ?? 0.33
  );
}

function resolveExportFrames(keyframes: TimelineKeyframe[], maxFrames: number, nativeBezier: boolean): number[] {
  const unique = new Set<number>();
  for (const kf of keyframes) unique.add(kf.frame);
  if (nativeBezier && unique.size > 0) {
    return Array.from(unique).sort((a, b) => a - b);
  }
  if (unique.size === 0) {
    for (let f = 0; f <= Math.min(maxFrames, 1); f++) unique.add(f);
  } else {
    const min = Math.min(...unique);
    const max = Math.max(...unique);
    for (let f = min; f <= max; f++) unique.add(f);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

export function buildVmdFromTimeline(input: VmdExportInput): ArrayBuffer {
  const {
    keyframes,
    maxFrames,
    bones,
    morphs,
    clipName = 'AnimaStage Lite',
    nativeBezier = false,
  } = input;
  const live = getDefaultLiveValues(bones, morphs);
  const frames = resolveExportFrames(keyframes, maxFrames, nativeBezier);

  const motions: Array<{
    boneName: string;
    frameNum: number;
    position: [number, number, number];
    rotation: [number, number, number, number];
    interpolation: Uint8Array;
  }> = [];

  const morphsOut: Array<{ morphName: string; frameNum: number; weight: number }> = [];

  for (const frame of frames) {
    const evaluated = evaluateTimelineAtFrame(keyframes, frame, live);
    const boneRot: Record<string, { x: number; y: number; z: number }> = {};

    for (const [track, binding] of Object.entries(BONE_EXPORT) as Array<
      [keyof typeof BONE_EXPORT, (typeof BONE_EXPORT)[keyof typeof BONE_EXPORT]]
    >) {
      const deg = evaluated[track as TimelineTrackId];
      const entry = boneRot[binding.boneName] ?? { x: 0, y: 0, z: 0 };
      entry[binding.axis] = (deg * Math.PI) / 180;
      boneRot[binding.boneName] = entry;
    }

    for (const [name, rot] of Object.entries(boneRot)) {
      const q = eulerToQuat(rot.x, rot.y, rot.z);
      motions.push({
        boneName: name,
        frameNum: frame,
        position: [0, 0, 0],
        rotation: q,
        interpolation: boneInterpolationAtFrame(keyframes, frame, nativeBezier),
      });
    }

    for (const track of ['morph_eyes', 'morph_mouth', 'morph_brow'] as const) {
      const trackKeys = keyframes.filter((k) => k.track === track);
      if (trackKeys.length === 0 && frame !== frames[0]) continue;
      morphsOut.push({
        morphName: MORPH_EXPORT[track],
        frameNum: frame,
        weight: evaluated[track],
      });
    }
  }

  const headerSize = 30 + 20;
  const motionSize = 15 + 4 + 12 + 16 + 64;
  const morphSize = 15 + 4 + 4;
  const total =
    headerSize + 4 + motions.length * motionSize + 4 + morphsOut.length * morphSize + 4;

  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  let o = 0;

  const magic = 'Vocaloid Motion Data 0002';
  for (let i = 0; i < 30; i++) {
    view.setUint8(o + i, i < magic.length ? magic.charCodeAt(i) : 0);
  }
  o += 30;
  const nameBytes = encodeSjis(clipName, 20);
  new Uint8Array(buffer, o, 20).set(nameBytes);
  o += 20;

  view.setUint32(o, motions.length, true);
  o += 4;
  for (const m of motions) {
    o = writeMotion(view, o, m.boneName, m.frameNum, m.position, m.rotation, m.interpolation);
  }

  view.setUint32(o, morphsOut.length, true);
  o += 4;
  for (const m of morphsOut) {
    o = writeMorph(view, o, m.morphName, m.frameNum, m.weight);
  }

  view.setUint32(o, 0, true);
  return buffer;
}

export function downloadVmd(buffer: ArrayBuffer, fileName = 'animastage-export.vmd'): void {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.vmd') ? fileName : `${fileName}.vmd`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function frameToVmdFrame(frame: number): number {
  return Math.round(frame);
}

export { MMD_FPS };
