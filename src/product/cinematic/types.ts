import type { AppState, CameraEasingId, CameraKeyframe, VisualFxSettings, ViewportFormat } from '../../types';
import type { QualityMode } from '../scene/types';
import type { SceneComposerState } from '../../sceneComposer/types';

/** Procedural cinematic camera modes — operator-style, not static orbit. */
export type CinematicCameraMode =
  | 'orbit'
  | 'hero'
  | 'dance'
  | 'showcase'
  | 'drone'
  | 'close_up'
  | 'tracking'
  | 'over_shoulder'
  | 'face'
  | 'dynamic';

export type CinematicLightingPresetId =
  | 'anime_soft'
  | 'studio'
  | 'golden_hour'
  | 'sunset'
  | 'night'
  | 'cyberpunk'
  | 'fantasy'
  | 'concert'
  | 'moonlight'
  | 'indoor'
  | 'outdoor';

export type EffectQualityLevel = 'off' | 'low' | 'medium' | 'high' | 'auto';

export type CinematicExportProfileId =
  | 'shorts_1080'
  | 'shorts_4k'
  | 'landscape_1080'
  | 'landscape_4k'
  | 'balanced'
  | 'fast';

export type CameraEasingId = import('../../types').CameraEasingId;

export interface CinematicEngineState {
  enabled: boolean;
  cameraMode: CinematicCameraMode;
  lightingPreset: CinematicLightingPresetId;
  handheld: boolean;
  collisionAvoidance: boolean;
  adaptiveEffects: boolean;
  effectQuality: EffectQualityLevel;
  compositionEnabled: boolean;
  /** Last visual quality score 0–1 from analyzer. */
  lastVisualScore: number | null;
}

export const DEFAULT_CINEMATIC_ENGINE: CinematicEngineState = {
  enabled: false,
  cameraMode: 'showcase',
  lightingPreset: 'anime_soft',
  handheld: false,
  collisionAvoidance: true,
  adaptiveEffects: true,
  effectQuality: 'auto',
  compositionEnabled: true,
  lastVisualScore: null,
};

export interface CinematicPathInput {
  mode: CinematicCameraMode;
  maxFrames: number;
  modelCount: number;
  viewportFormat: ViewportFormat;
  motionIntensity?: number;
  stageTarget?: [number, number, number];
}

export interface CinematicLookPatch {
  visualFx: Partial<VisualFxSettings>;
  sceneComposer?: Partial<SceneComposerState>;
  rtxModeEnabled?: boolean;
  characterQuality?: AppState['characterQuality'];
}

export interface VisualQualityReport {
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  lighting: number;
  composition: number;
  camera: number;
  visibility: number;
  contrast: number;
  exposure: number;
  depth: number;
  suggestions: string[];
}

export interface CinematicExportProfile {
  id: CinematicExportProfileId;
  label: string;
  viewportFormat: ViewportFormat;
  width: number;
  height: number;
  fps: 30 | 60;
  bitrateMbps: number;
  qualityMode: QualityMode;
  fxBudget: EffectQualityLevel;
}

export interface ReferenceCameraAnalysis {
  /** Normalized 0–1 motion energy curve samples. */
  motionCurve: number[];
  avgFov: number;
  mood: 'bright' | 'dark' | 'warm' | 'cool' | 'neutral';
  palette: [number, number, number][];
  suggestedMode: CinematicCameraMode;
}

export type CinematicKeyframe = CameraKeyframe & {
  target?: [number, number, number];
  easing?: CameraEasingId;
};
