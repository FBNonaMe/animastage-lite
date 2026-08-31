/**
 * WHAM Motion Pipeline — shared types for Video → Motion Keys.
 * World-grounded, temporally consistent reconstruction contract.
 */

import type { TimelineKeyframe } from '../../types';
import type { MotionSpec } from '../../ai/motionSpec';

export type WhamQualityMode = 'fast' | 'balanced' | 'high' | 'cinema';

export type WhamBackendSource = 'wham-server' | 'wham-local';

export type WhamJointId =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftShoulder'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightShoulder'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot';

export const WHAM_JOINT_IDS: WhamJointId[] = [
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
];

/** Priority joints for confidence-aware blending (hands first). */
export const WHAM_HAND_JOINTS: WhamJointId[] = [
  'leftHand',
  'rightHand',
  'leftLowerArm',
  'rightLowerArm',
  'leftUpperArm',
  'rightUpperArm',
  'leftShoulder',
  'rightShoulder',
];

export const WHAM_LEG_JOINTS: WhamJointId[] = [
  'leftUpperLeg',
  'rightUpperLeg',
  'leftLowerLeg',
  'rightLowerLeg',
  'leftFoot',
  'rightFoot',
];

export interface WhamVec3 {
  x: number;
  y: number;
  z: number;
}

export interface WhamJointState {
  /** Euler degrees relative to rest / T-pose */
  rotation: [number, number, number];
  /** Optional world / local position (meters-ish normalized) */
  position?: [number, number, number];
  /** 0..1 reconstruction confidence */
  confidence: number;
}

export interface WhamRootState {
  position: [number, number, number];
  rotation: [number, number, number];
  velocity: [number, number, number];
  acceleration: [number, number, number];
}

export interface WhamFrame {
  time: number;
  frame: number;
  root: WhamRootState;
  joints: Partial<Record<WhamJointId, WhamJointState>>;
}

export interface WhamPoseSequence {
  frames: WhamFrame[];
  duration: number;
  sampleFps: number;
  width: number;
  height: number;
  aspect: '9:16' | '16:9' | '1:1' | 'other';
  source: WhamBackendSource;
}

export type WhamPipelinePhase =
  | 'idle'
  | 'ingest'
  | 'analyze'
  | 'reconstruct'
  | 'stabilize_hands'
  | 'stabilize_legs'
  | 'root_motion'
  | 'refine'
  | 'ik'
  | 'curves'
  | 'keys'
  | 'retarget'
  | 'done'
  | 'error';

export interface WhamProgress {
  phase: WhamPipelinePhase;
  progress: number;
  message: string;
}

export type WhamPostToolId =
  | 'smooth'
  | 'reduce_jitter'
  | 'clean_hands'
  | 'clean_feet'
  | 'fix_root'
  | 'improve_dance'
  | 'optimize_keys'
  | 'recalc_curves';

export interface WhamPipelineOptions {
  quality?: WhamQualityMode;
  /** Prefer remote WHAM server when available */
  preferServer?: boolean;
  /** Server base URL override (else VITE_WHAM_URL / localStorage) */
  serverUrl?: string;
  /** Apply post tools after reconstruction */
  postTools?: WhamPostToolId[];
  maxFrames?: number;
}

export interface WhamPipelineResult {
  sequence: WhamPoseSequence;
  motionSpec: MotionSpec;
  keyframes: TimelineKeyframe[];
  jointConfidence: Partial<Record<WhamJointId, number>>;
  source: WhamBackendSource;
  quality: WhamQualityMode;
  meta: {
    duration: number;
    sampleFps: number;
    aspect: WhamPoseSequence['aspect'];
    keyCount: number;
    frameCount: number;
  };
}

export const WHAM_VIDEO_ACCEPT =
  'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm';

export const WHAM_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'] as const;
