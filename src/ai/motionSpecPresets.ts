/**
 * Offline MotionSpec presets — work without an API key.
 * Matched prompts always use these (even if Gemini is configured).
 */
import type { MotionSpec } from './motionSpec';
import { finalizeMotionSpec } from './motionSpec';

type SpecDraft = Omit<MotionSpec, 'hips' | 'expressions'> &
  Partial<Pick<MotionSpec, 'hips' | 'expressions'>>;

function spec(draft: SpecDraft): MotionSpec {
  return finalizeMotionSpec({
    hips: draft.hips ?? [],
    expressions: draft.expressions ?? {},
    ...draft,
  });
}

const ARM_L = { rest: [0, 0, -70] as [number, number, number] };
const ARM_R = { rest: [0, 0, 70] as [number, number, number] };

function armsRest(duration: number) {
  return {
    leftUpperArm: [
      { t: 0, r: ARM_L.rest },
      { t: duration, r: ARM_L.rest },
    ],
    rightUpperArm: [
      { t: 0, r: ARM_R.rest },
      { t: duration, r: ARM_R.rest },
    ],
  };
}

export interface OfflineMotionPresetInfo {
  id: string;
  label: string;
  /** Example prompt that matches this preset */
  prompt: string;
}

/** Catalog for UI quick-picks. */
export const OFFLINE_MOTION_PRESETS: OfflineMotionPresetInfo[] = [
  { id: 'wave', label: 'Wave', prompt: 'wave hello' },
  { id: 'bow', label: 'Bow', prompt: 'bow politely' },
  { id: 'nod', label: 'Nod', prompt: 'nod yes' },
  { id: 'shake', label: 'Shake no', prompt: 'shake head no' },
  { id: 'clap', label: 'Clap', prompt: 'clap hands' },
  { id: 'cheer', label: 'Cheer', prompt: 'cheer yes' },
  { id: 'victory', label: 'Victory', prompt: 'victory pose' },
  { id: 'point', label: 'Point', prompt: 'point forward' },
  { id: 'beckon', label: 'Come here', prompt: 'come here' },
  { id: 'think', label: 'Think', prompt: 'thinking' },
  { id: 'shrug', label: 'Shrug', prompt: 'shrug' },
  { id: 'stretch', label: 'Stretch', prompt: 'stretch' },
  { id: 'look', label: 'Look around', prompt: 'look around' },
  { id: 'idle', label: 'Idle', prompt: 'idle sway' },
  { id: 'dance', label: 'Dance', prompt: 'happy dance' },
  { id: 'jump', label: 'Jump', prompt: 'small jump' },
  { id: 'laugh', label: 'Laugh', prompt: 'laugh' },
  { id: 'sad', label: 'Sad', prompt: 'sad' },
  { id: 'surprise', label: 'Surprise', prompt: 'surprise' },
  { id: 'salute', label: 'Salute', prompt: 'salute' },
];

const PRESETS: Record<string, () => MotionSpec> = {
  wave: () =>
    spec({
      name: 'wave',
      duration: 2.6,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 2.6, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.35, r: [0, 0, -50] },
          { t: 2.2, r: [0, 0, -50] },
          { t: 2.6, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.35, r: [0, 0, -45] },
          { t: 0.7, r: [0, 0, -55] },
          { t: 1.05, r: [0, 0, -40] },
          { t: 1.4, r: [0, 0, -55] },
          { t: 1.75, r: [0, 0, -40] },
          { t: 2.2, r: [0, 0, -48] },
          { t: 2.6, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [0, -8, 0] },
          { t: 2.0, r: [0, -8, 0] },
          { t: 2.6, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0, w: 0 },
          { t: 0.3, w: 0.75 },
          { t: 2.3, w: 0.75 },
          { t: 2.6, w: 0 },
        ],
        blink: [
          { t: 1.1, w: 0 },
          { t: 1.2, w: 1 },
          { t: 1.3, w: 0 },
        ],
      },
    }),

  bow: () =>
    spec({
      name: 'bow',
      duration: 2.4,
      loop: false,
      tracks: {
        ...armsRest(2.4),
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [22, 0, 0] },
          { t: 1.6, r: [22, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        chest: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [12, 0, 0] },
          { t: 1.6, r: [12, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [18, 0, 0] },
          { t: 1.6, r: [18, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [10, 0, 0] },
          { t: 1.6, r: [10, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        relaxed: [
          { t: 0.5, w: 0.4 },
          { t: 1.6, w: 0.4 },
          { t: 2.4, w: 0 },
        ],
      },
    }),

  nod: () =>
    spec({
      name: 'nod',
      duration: 1.8,
      loop: true,
      tracks: {
        ...armsRest(1.8),
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.35, r: [22, 0, 0] },
          { t: 0.7, r: [0, 0, 0] },
          { t: 1.05, r: [18, 0, 0] },
          { t: 1.4, r: [0, 0, 0] },
          { t: 1.8, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.35, r: [12, 0, 0] },
          { t: 0.7, r: [0, 0, 0] },
          { t: 1.05, r: [10, 0, 0] },
          { t: 1.4, r: [0, 0, 0] },
          { t: 1.8, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0.2, w: 0.35 },
          { t: 1.5, w: 0.35 },
          { t: 1.8, w: 0 },
        ],
      },
    }),

  shake: () =>
    spec({
      name: 'shake_no',
      duration: 1.6,
      loop: true,
      tracks: {
        ...armsRest(1.6),
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [0, 22, 0] },
          { t: 0.55, r: [0, -22, 0] },
          { t: 0.85, r: [0, 18, 0] },
          { t: 1.15, r: [0, -14, 0] },
          { t: 1.6, r: [0, 0, 0] },
        ],
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [0, 10, 0] },
          { t: 0.55, r: [0, -10, 0] },
          { t: 1.6, r: [0, 0, 0] },
        ],
      },
      expressions: {
        sad: [
          { t: 0.2, w: 0.25 },
          { t: 1.3, w: 0.25 },
          { t: 1.6, w: 0 },
        ],
      },
    }),

  clap: () =>
    spec({
      name: 'clap',
      duration: 2.2,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.25, r: [-25, 15, -35] },
          { t: 0.45, r: [-35, 25, -20] },
          { t: 0.65, r: [-25, 15, -35] },
          { t: 0.85, r: [-35, 25, -20] },
          { t: 1.05, r: [-25, 15, -35] },
          { t: 1.25, r: [-35, 25, -20] },
          { t: 1.8, r: [-25, 15, -35] },
          { t: 2.2, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.25, r: [-25, -15, 35] },
          { t: 0.45, r: [-35, -25, 20] },
          { t: 0.65, r: [-25, -15, 35] },
          { t: 0.85, r: [-35, -25, 20] },
          { t: 1.05, r: [-25, -15, 35] },
          { t: 1.25, r: [-35, -25, 20] },
          { t: 1.8, r: [-25, -15, 35] },
          { t: 2.2, r: ARM_R.rest },
        ],
        leftLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [0, 0, -50] },
          { t: 0.45, r: [0, 0, -70] },
          { t: 2.2, r: [0, 0, 0] },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [0, 0, 50] },
          { t: 0.45, r: [0, 0, 70] },
          { t: 2.2, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [5, 0, 0] },
          { t: 2.2, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0.2, w: 0.7 },
          { t: 2.0, w: 0.7 },
          { t: 2.2, w: 0 },
        ],
      },
    }),

  cheer: () =>
    spec({
      name: 'cheer',
      duration: 2.4,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.35, r: [-40, -10, 25] },
          { t: 0.7, r: [-55, -5, 40] },
          { t: 1.1, r: [-40, -10, 25] },
          { t: 1.5, r: [-55, -5, 40] },
          { t: 2.0, r: [-40, -10, 25] },
          { t: 2.4, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.35, r: [-40, 10, -25] },
          { t: 0.7, r: [-55, 5, -40] },
          { t: 1.1, r: [-40, 10, -25] },
          { t: 1.5, r: [-55, 5, -40] },
          { t: 2.0, r: [-40, 10, -25] },
          { t: 2.4, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [-8, 0, 0] },
          { t: 1.2, r: [-4, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [-12, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
      },
      hips: [
        { t: 0, p: [0, 0, 0] },
        { t: 0.5, p: [0, 0.06, 0] },
        { t: 1.0, p: [0, 0, 0] },
        { t: 1.5, p: [0, 0.05, 0] },
        { t: 2.4, p: [0, 0, 0] },
      ],
      expressions: {
        happy: [
          { t: 0.2, w: 0.9 },
          { t: 2.1, w: 0.9 },
          { t: 2.4, w: 0 },
        ],
        aa: [
          { t: 0.4, w: 0.4 },
          { t: 1.8, w: 0.4 },
          { t: 2.4, w: 0 },
        ],
      },
    }),

  victory: () =>
    spec({
      name: 'victory',
      duration: 2.8,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.5, r: [-30, 0, -20] },
          { t: 2.2, r: [-30, 0, -20] },
          { t: 2.8, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.45, r: [-70, 15, -35] },
          { t: 2.2, r: [-70, 15, -35] },
          { t: 2.8, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.45, r: [0, 0, 35] },
          { t: 2.2, r: [0, 0, 35] },
          { t: 2.8, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [-6, 8, 0] },
          { t: 2.2, r: [-6, 8, 0] },
          { t: 2.8, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [-8, 10, 0] },
          { t: 2.2, r: [-8, 10, 0] },
          { t: 2.8, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0.3, w: 0.85 },
          { t: 2.4, w: 0.85 },
          { t: 2.8, w: 0 },
        ],
      },
    }),

  point: () =>
    spec({
      name: 'point',
      duration: 2.2,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 2.2, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.4, r: [-45, -25, 10] },
          { t: 1.7, r: [-45, -25, 10] },
          { t: 2.2, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [0, 0, 15] },
          { t: 1.7, r: [0, 0, 15] },
          { t: 2.2, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [0, -12, 0] },
          { t: 1.7, r: [0, -12, 0] },
          { t: 2.2, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [0, -6, 0] },
          { t: 1.7, r: [0, -6, 0] },
          { t: 2.2, r: [0, 0, 0] },
        ],
      },
      expressions: {
        surprised: [
          { t: 0.3, w: 0.3 },
          { t: 1.6, w: 0.3 },
          { t: 2.2, w: 0 },
        ],
      },
    }),

  beckon: () =>
    spec({
      name: 'beckon',
      duration: 2.4,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 2.4, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.3, r: [-20, -10, -35] },
          { t: 2.0, r: [-20, -10, -35] },
          { t: 2.4, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.3, r: [0, 0, -40] },
          { t: 0.65, r: [0, 0, -70] },
          { t: 1.0, r: [0, 0, -40] },
          { t: 1.35, r: [0, 0, -70] },
          { t: 1.7, r: [0, 0, -40] },
          { t: 2.0, r: [0, 0, -55] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [4, -8, 0] },
          { t: 2.0, r: [4, -8, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0.2, w: 0.45 },
          { t: 2.1, w: 0.45 },
          { t: 2.4, w: 0 },
        ],
      },
    }),

  think: () =>
    spec({
      name: 'think',
      duration: 3.2,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 3.2, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.5, r: [-55, 35, -15] },
          { t: 2.6, r: [-55, 35, -15] },
          { t: 3.2, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.5, r: [0, 0, 75] },
          { t: 2.6, r: [0, 0, 75] },
          { t: 3.2, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.6, r: [8, 12, 0] },
          { t: 1.4, r: [10, 8, 0] },
          { t: 2.2, r: [6, 14, 0] },
          { t: 3.2, r: [0, 0, 0] },
        ],
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.6, r: [6, 6, 0] },
          { t: 2.6, r: [6, 6, 0] },
          { t: 3.2, r: [0, 0, 0] },
        ],
      },
      expressions: {
        relaxed: [
          { t: 0.4, w: 0.35 },
          { t: 2.8, w: 0.35 },
          { t: 3.2, w: 0 },
        ],
        blink: [
          { t: 1.5, w: 0 },
          { t: 1.6, w: 1 },
          { t: 1.75, w: 0 },
        ],
      },
    }),

  shrug: () =>
    spec({
      name: 'shrug',
      duration: 2.0,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.35, r: [15, -25, -40] },
          { t: 1.3, r: [15, -25, -40] },
          { t: 2.0, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.35, r: [15, 25, 40] },
          { t: 1.3, r: [15, 25, 40] },
          { t: 2.0, r: ARM_R.rest },
        ],
        leftShoulder: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.35, r: [0, 0, -18] },
          { t: 1.3, r: [0, 0, -18] },
          { t: 2.0, r: [0, 0, 0] },
        ],
        rightShoulder: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.35, r: [0, 0, 18] },
          { t: 1.3, r: [0, 0, 18] },
          { t: 2.0, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [0, 0, 8] },
          { t: 1.2, r: [0, 0, -6] },
          { t: 2.0, r: [0, 0, 0] },
        ],
      },
      expressions: {
        surprised: [
          { t: 0.3, w: 0.35 },
          { t: 1.4, w: 0.35 },
          { t: 2.0, w: 0 },
        ],
      },
    }),

  stretch: () =>
    spec({
      name: 'stretch',
      duration: 3.0,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.6, r: [-70, 0, 20] },
          { t: 2.0, r: [-70, 0, 20] },
          { t: 3.0, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.6, r: [-70, 0, -20] },
          { t: 2.0, r: [-70, 0, -20] },
          { t: 3.0, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [-12, 0, 0] },
          { t: 2.0, r: [-12, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
        chest: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [-8, 0, 0] },
          { t: 2.0, r: [-8, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [-15, 0, 0] },
          { t: 2.0, r: [-15, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
      },
      hips: [
        { t: 0, p: [0, 0, 0] },
        { t: 0.7, p: [0, 0.04, 0] },
        { t: 2.0, p: [0, 0.04, 0] },
        { t: 3.0, p: [0, 0, 0] },
      ],
      expressions: {
        aa: [
          { t: 0.6, w: 0.5 },
          { t: 2.0, w: 0.5 },
          { t: 3.0, w: 0 },
        ],
      },
    }),

  look: () =>
    spec({
      name: 'look_around',
      duration: 3.4,
      loop: true,
      tracks: {
        ...armsRest(3.4),
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.6, r: [0, 30, 0] },
          { t: 1.2, r: [0, 30, 0] },
          { t: 1.9, r: [0, -30, 0] },
          { t: 2.6, r: [0, -30, 0] },
          { t: 3.4, r: [0, 0, 0] },
        ],
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.6, r: [0, 12, 0] },
          { t: 1.9, r: [0, -12, 0] },
          { t: 3.4, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [0, 6, 0] },
          { t: 2.0, r: [0, -6, 0] },
          { t: 3.4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        blink: [
          { t: 1.3, w: 0 },
          { t: 1.4, w: 1 },
          { t: 1.5, w: 0 },
          { t: 2.7, w: 0 },
          { t: 2.8, w: 1 },
          { t: 2.9, w: 0 },
        ],
      },
    }),

  idle: () =>
    spec({
      name: 'idle_sway',
      duration: 4.0,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: [0, 0, -68] },
          { t: 2, r: [2, -4, -66] },
          { t: 4, r: [0, 0, -68] },
        ],
        rightUpperArm: [
          { t: 0, r: [0, 0, 68] },
          { t: 2, r: [2, 4, 66] },
          { t: 4, r: [0, 0, 68] },
        ],
        hips: [
          { t: 0, r: [0, 0, 0] },
          { t: 1, r: [0, 4, 2] },
          { t: 2, r: [0, 0, 0] },
          { t: 3, r: [0, -4, -2] },
          { t: 4, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 1, r: [2, 3, 2] },
          { t: 2, r: [0, 0, 0] },
          { t: 3, r: [2, -3, -2] },
          { t: 4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 1.2, r: [2, 5, 0] },
          { t: 2.5, r: [0, -4, 0] },
          { t: 4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        blink: [
          { t: 1.0, w: 0 },
          { t: 1.1, w: 1 },
          { t: 1.2, w: 0 },
          { t: 3.0, w: 0 },
          { t: 3.1, w: 1 },
          { t: 3.2, w: 0 },
        ],
        relaxed: [
          { t: 0, w: 0.2 },
          { t: 4, w: 0.2 },
        ],
      },
    }),

  dance: () =>
    spec({
      name: 'sway_dance',
      duration: 4,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: [0, 0, -55] },
          { t: 1, r: [10, -20, -40] },
          { t: 2, r: [0, 0, -55] },
          { t: 3, r: [10, 15, -45] },
          { t: 4, r: [0, 0, -55] },
        ],
        rightUpperArm: [
          { t: 0, r: [0, 0, 55] },
          { t: 1, r: [10, 20, 40] },
          { t: 2, r: [0, 0, 55] },
          { t: 3, r: [10, -15, 45] },
          { t: 4, r: [0, 0, 55] },
        ],
        hips: [
          { t: 0, r: [0, 0, 0] },
          { t: 1, r: [0, 12, 0] },
          { t: 2, r: [0, 0, 0] },
          { t: 3, r: [0, -12, 0] },
          { t: 4, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 1, r: [0, 8, 6] },
          { t: 2, r: [0, 0, 0] },
          { t: 3, r: [0, -8, -6] },
          { t: 4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 1, r: [0, 10, 0] },
          { t: 2, r: [0, 0, 0] },
          { t: 3, r: [0, -10, 0] },
          { t: 4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0, w: 0.6 },
          { t: 4, w: 0.6 },
        ],
        blink: [
          { t: 1.8, w: 0 },
          { t: 1.9, w: 1 },
          { t: 2.0, w: 0 },
        ],
      },
    }),

  jump: () =>
    spec({
      name: 'jump',
      duration: 1.8,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.25, r: [15, 0, -50] },
          { t: 0.55, r: [-30, 0, -40] },
          { t: 1.0, r: [10, 0, -55] },
          { t: 1.8, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.25, r: [15, 0, 50] },
          { t: 0.55, r: [-30, 0, 40] },
          { t: 1.0, r: [10, 0, 55] },
          { t: 1.8, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [10, 0, 0] },
          { t: 0.55, r: [-8, 0, 0] },
          { t: 1.0, r: [6, 0, 0] },
          { t: 1.8, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.55, r: [-10, 0, 0] },
          { t: 1.0, r: [8, 0, 0] },
          { t: 1.8, r: [0, 0, 0] },
        ],
      },
      hips: [
        { t: 0, p: [0, 0, 0] },
        { t: 0.25, p: [0, -0.08, 0] },
        { t: 0.55, p: [0, 0.22, 0] },
        { t: 0.9, p: [0, 0, 0] },
        { t: 1.1, p: [0, -0.04, 0] },
        { t: 1.8, p: [0, 0, 0] },
      ],
      expressions: {
        surprised: [
          { t: 0.4, w: 0.5 },
          { t: 0.9, w: 0.5 },
          { t: 1.8, w: 0 },
        ],
      },
    }),

  laugh: () =>
    spec({
      name: 'laugh',
      duration: 2.6,
      loop: true,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.4, r: [-15, 20, -45] },
          { t: 2.2, r: [-15, 20, -45] },
          { t: 2.6, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.4, r: [-15, -20, 45] },
          { t: 2.2, r: [-15, -20, 45] },
          { t: 2.6, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.3, r: [8, 0, 0] },
          { t: 0.55, r: [2, 0, 0] },
          { t: 0.8, r: [10, 0, 0] },
          { t: 1.05, r: [2, 0, 0] },
          { t: 1.3, r: [10, 0, 0] },
          { t: 1.55, r: [2, 0, 0] },
          { t: 2.6, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.3, r: [12, 0, 0] },
          { t: 0.55, r: [4, 0, 0] },
          { t: 0.8, r: [14, 0, 0] },
          { t: 1.05, r: [4, 0, 0] },
          { t: 1.3, r: [14, 0, 0] },
          { t: 2.6, r: [0, 0, 0] },
        ],
      },
      expressions: {
        happy: [
          { t: 0.2, w: 0.95 },
          { t: 2.3, w: 0.95 },
          { t: 2.6, w: 0 },
        ],
        aa: [
          { t: 0.3, w: 0.55 },
          { t: 2.2, w: 0.55 },
          { t: 2.6, w: 0 },
        ],
      },
    }),

  sad: () =>
    spec({
      name: 'sad',
      duration: 3.0,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.6, r: [8, 10, -78] },
          { t: 2.4, r: [8, 10, -78] },
          { t: 3.0, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.6, r: [8, -10, 78] },
          { t: 2.4, r: [8, -10, 78] },
          { t: 3.0, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [14, 0, 0] },
          { t: 2.4, r: [14, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
        neck: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [16, 0, 0] },
          { t: 2.4, r: [16, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.7, r: [18, 0, 0] },
          { t: 2.4, r: [18, 0, 0] },
          { t: 3.0, r: [0, 0, 0] },
        ],
      },
      expressions: {
        sad: [
          { t: 0.4, w: 0.8 },
          { t: 2.5, w: 0.8 },
          { t: 3.0, w: 0 },
        ],
      },
    }),

  surprise: () =>
    spec({
      name: 'surprise',
      duration: 2.0,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 0.25, r: [-25, -20, -25] },
          { t: 1.4, r: [-25, -20, -25] },
          { t: 2.0, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.25, r: [-25, 20, 25] },
          { t: 1.4, r: [-25, 20, 25] },
          { t: 2.0, r: ARM_R.rest },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [-10, 0, 0] },
          { t: 1.4, r: [-6, 0, 0] },
          { t: 2.0, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.25, r: [-18, 0, 0] },
          { t: 1.4, r: [-10, 0, 0] },
          { t: 2.0, r: [0, 0, 0] },
        ],
      },
      hips: [
        { t: 0, p: [0, 0, 0] },
        { t: 0.25, p: [0, 0.03, -0.04] },
        { t: 1.4, p: [0, 0.02, -0.02] },
        { t: 2.0, p: [0, 0, 0] },
      ],
      expressions: {
        surprised: [
          { t: 0.15, w: 1 },
          { t: 1.5, w: 0.7 },
          { t: 2.0, w: 0 },
        ],
        aa: [
          { t: 0.2, w: 0.6 },
          { t: 1.4, w: 0.4 },
          { t: 2.0, w: 0 },
        ],
      },
    }),

  salute: () =>
    spec({
      name: 'salute',
      duration: 2.4,
      loop: false,
      tracks: {
        leftUpperArm: [
          { t: 0, r: ARM_L.rest },
          { t: 2.4, r: ARM_L.rest },
        ],
        rightUpperArm: [
          { t: 0, r: ARM_R.rest },
          { t: 0.4, r: [-70, 40, -10] },
          { t: 1.8, r: [-70, 40, -10] },
          { t: 2.4, r: ARM_R.rest },
        ],
        rightLowerArm: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [0, 0, 85] },
          { t: 1.8, r: [0, 0, 85] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        spine: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [4, 0, 0] },
          { t: 1.8, r: [4, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
        head: [
          { t: 0, r: [0, 0, 0] },
          { t: 0.4, r: [6, 0, 0] },
          { t: 1.8, r: [6, 0, 0] },
          { t: 2.4, r: [0, 0, 0] },
        ],
      },
      expressions: {
        relaxed: [
          { t: 0.3, w: 0.3 },
          { t: 1.8, w: 0.3 },
          { t: 2.4, w: 0 },
        ],
      },
    }),
};

const MATCHERS: Array<{ id: keyof typeof PRESETS; re: RegExp }> = [
  { id: 'wave', re: /wave|мах|привет|hello|hand\s*wave|手を振/ },
  { id: 'bow', re: /bow|поклон|お辞儀|nod\s*bow/ },
  { id: 'shake', re: /shake|нет|no+|отказ|首を横/ },
  { id: 'nod', re: /nod|кив|да\b|yes|うなず/ },
  { id: 'clap', re: /clap|аплод|хлоп|拍手/ },
  { id: 'cheer', re: /cheer|ура|万歳|hurray|я?ху+/ },
  { id: 'victory', re: /victory|побед|win\b|triumph/ },
  { id: 'point', re: /point|указ|指さ/ },
  { id: 'beckon', re: /beckon|come\s*here|иди\s*сюда|подош|手招/ },
  { id: 'think', re: /think|дум|размыш|考え/ },
  { id: 'shrug', re: /shrug|пожать|плеч|shrug/ },
  { id: 'stretch', re: /stretch|потян|伸び/ },
  { id: 'look', re: /look\s*around|огляд|осмотр|見回/ },
  { id: 'idle', re: /idle|ожид|стоя|sway\b|дыха/ },
  { id: 'dance', re: /dance|танц|踊/ },
  { id: 'jump', re: /jump|прыж|跳/ },
  { id: 'laugh', re: /laugh|смех|хаха|笑/ },
  { id: 'sad', re: /sad|груст|печал|泣/ },
  { id: 'surprise', re: /surpris|удив|шоки|驚/ },
  { id: 'salute', re: /salute|салют|отдать\s*честь|敬礼/ },
];

export function localMotionSpecFromPrompt(prompt: string): MotionSpec | null {
  const p = prompt.trim().toLowerCase();
  if (!p) return null;

  // Exact id / label / catalog prompt
  for (const info of OFFLINE_MOTION_PRESETS) {
    if (p === info.id || p === info.label.toLowerCase() || p === info.prompt.toLowerCase()) {
      return PRESETS[info.id]!();
    }
  }

  for (const { id, re } of MATCHERS) {
    if (re.test(p)) return PRESETS[id]!();
  }
  return null;
}

export function listOfflineMotionPresetIds(): string[] {
  return OFFLINE_MOTION_PRESETS.map((p) => p.id);
}
