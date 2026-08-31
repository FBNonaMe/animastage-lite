import type { PoseLibraryEntry } from './poseTypes';

const D = (x: number, y: number, z: number) => ({ x, y, z });

/** Smart Pose IK-inspired snapshots (Lite simplified rig). */
export const SMART_POSE_PRESETS: PoseLibraryEntry[] = [
  {
    version: 1,
    id: 'smart_neutral',
    name: 'Smart Neutral',
    thumbnail: '🎯',
    morphs: { eyes: 0, mouth: 0.1, brow: 0 },
    bones: {
      head: D(0, 0, 0),
      neck: D(0, 0, 0),
      spine: D(0, 0, 0),
      waist: D(0, 0, 0),
      arm_L: D(0, 0, -14),
      arm_R: D(0, 0, 14),
    },
  },
  {
    version: 1,
    id: 'smart_action',
    name: 'Action Ready',
    thumbnail: '⚡',
    morphs: { eyes: 0.08, mouth: 0.22, brow: 0.05 },
    bones: {
      head: D(-6, 12, 0),
      neck: D(0, 8, 0),
      spine: D(0, 14, -6),
      waist: D(0, -10, 4),
      arm_L: D(-28, 0, -58),
      arm_R: D(18, 0, 62),
    },
  },
  {
    version: 1,
    id: 'smart_point',
    name: 'Point',
    thumbnail: '👉',
    morphs: { eyes: 0.12, mouth: 0.18, brow: 0 },
    bones: {
      head: D(-2, 14, 0),
      neck: D(0, 8, 0),
      spine: D(0, 6, 0),
      waist: D(0, 4, 0),
      arm_L: D(0, 0, -16),
      arm_R: D(-12, 22, 78),
    },
  },
  {
    version: 1,
    id: 'smart_look_back',
    name: 'Look Back',
    thumbnail: '👀',
    morphs: { eyes: 0.25, mouth: 0.12, brow: 0.08 },
    bones: {
      head: D(4, -28, 12),
      neck: D(0, -18, 8),
      spine: D(0, -8, 6),
      waist: D(0, 6, -4),
      arm_L: D(0, 0, -22),
      arm_R: D(0, 0, 18),
    },
  },
  {
    version: 1,
    id: 'smart_sit',
    name: 'Sit',
    thumbnail: '🪑',
    morphs: { eyes: 0.05, mouth: 0.08, brow: 0 },
    bones: {
      head: D(-2, 6, 0),
      neck: D(0, 4, 0),
      spine: D(8, 0, 0),
      waist: D(12, 0, 0),
      arm_L: D(0, 0, -24),
      arm_R: D(0, 0, 24),
    },
  },
  {
    version: 1,
    id: 'smart_wave_hi',
    name: 'Wave Hi',
    thumbnail: '🖐️',
    morphs: { eyes: 0.2, mouth: 0.48, brow: 0 },
    bones: {
      head: D(-3, 8, 0),
      neck: D(0, 5, 0),
      spine: D(0, 4, 0),
      waist: D(0, 2, 0),
      arm_L: D(0, 0, -12),
      arm_R: D(-42, 18, 88),
    },
  },
];
