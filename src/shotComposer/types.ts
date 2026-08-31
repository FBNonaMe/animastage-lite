/**
 * Smart Scene Placement & Shot Composer 1.0 — types.
 * Environment analysis / placement / framing without touching fog/lights/sky/FX.
 */
import type { CameraSnapshot, ViewportFormat } from '../types';

export type ShotComposerMode = 'idle' | 'place_character' | 'place_camera' | 'create_shot';

export type CharacterScaleMode = 'real_world' | 'mmd' | 'custom' | 'auto';

export type CharacterOrientMode =
  | 'face_camera'
  | 'face_forward'
  | 'face_target'
  | 'manual'
  | 'keep_upright';

export type ShotPresetId =
  | 'full_body'
  | 'medium'
  | 'close_up'
  | 'portrait'
  | 'hero'
  | 'wide'
  | 'low_angle'
  | 'high_angle'
  | 'side'
  | 'back'
  | 'showcase'
  | 'dance'
  | 'anime_intro'
  | 'shorts';

export type ShotCameraPresetId =
  | 'cinematic'
  | 'anime'
  | 'portrait'
  | 'dance'
  | 'shorts'
  | 'hero'
  | 'dramatic'
  | 'wide'
  | 'close';

export type CompositionGuideId =
  | 'thirds'
  | 'center'
  | 'golden'
  | 'headroom'
  | 'safe'
  | 'safe_v'
  | 'safe_h';

export type ShotTransitionEase =
  | 'smooth'
  | 'ease_in'
  | 'ease_out'
  | 'ease_in_out'
  | 'cubic'
  | 'quintic'
  | 'bezier'
  | 'linear';

export type EnvSurfaceRole = 'raycast' | 'collision' | 'background' | 'decoration';

export type FramingFocus = 'full_body' | 'upper_body' | 'face' | 'custom';

export interface EnvAnalysisCache {
  stageModelId: string;
  analyzedAt: number;
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  worldScale: number;
  sceneHeight: number;
  floorY: number;
  walkableSampleCount: number;
  meshCount: number;
}

export interface PlacementHit {
  position: [number, number, number];
  normal: [number, number, number];
  distance: number;
  walkable: boolean;
}

export interface ShotAnchor {
  id: string;
  name: string;
  createdAt: number;
  characterId: string | null;
  characterPosition: [number, number, number];
  characterRotationY: number;
  characterScale: number;
  camera: CameraSnapshot;
  target: [number, number, number];
  aspect: ViewportFormat;
  shotPreset: ShotPresetId;
  cameraPreset: ShotCameraPresetId;
  environmentAnchor?: [number, number, number];
}

export interface CompositionWarning {
  id: string;
  message: string;
  severity: 'info' | 'warn';
}

export interface ShotComposerState {
  version: 1;
  mode: ShotComposerMode;
  aspect: ViewportFormat;
  shotPreset: ShotPresetId;
  cameraPreset: ShotCameraPresetId;
  scaleMode: CharacterScaleMode;
  customHeight: number;
  orientMode: CharacterOrientMode;
  framingFocus: FramingFocus;
  guides: CompositionGuideId[];
  savedShots: ShotAnchor[];
  activeShotId: string | null;
  envAnalysis: EnvAnalysisCache | null;
  ghostHit: PlacementHit | null;
  lastWarnings: CompositionWarning[];
  transitionEase: ShotTransitionEase;
  transitionMs: number;
  /** Manual floor Y override (null = use analysis). */
  floorYOverride: number | null;
  keepUpright: boolean;
}

export const DEFAULT_SHOT_COMPOSER: ShotComposerState = {
  version: 1,
  mode: 'idle',
  aspect: '9:16',
  shotPreset: 'full_body',
  cameraPreset: 'shorts',
  scaleMode: 'mmd',
  customHeight: 1.6,
  orientMode: 'face_camera',
  framingFocus: 'full_body',
  guides: ['thirds', 'safe'],
  savedShots: [],
  activeShotId: null,
  envAnalysis: null,
  ghostHit: null,
  lastWarnings: [],
  transitionEase: 'ease_in_out',
  transitionMs: 600,
  floorYOverride: null,
  keepUpright: true,
};
