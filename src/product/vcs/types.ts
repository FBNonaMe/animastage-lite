import type { CameraEasingId, CameraKeyframe, CameraSnapshot, ViewportFormat } from '../../types';
import type { PmxBoneInfo } from '../../types';
import type { CinematicLightingPresetId } from '../cinematic/types';

/** Professional virtual camera director modes — rules-based, not template animations. */
export type VcsDirectorMode =
  | 'character_showcase'
  | 'dance_performance'
  | 'concert'
  | 'portrait'
  | 'cinematic'
  | 'hero_shot'
  | 'orbit'
  | 'drone'
  | 'tracking'
  | 'action'
  | 'close_up'
  | 'wide_shot'
  | 'random_professional';

export type VcsFocusTarget = 'face' | 'eyes' | 'head' | 'chest' | 'com' | 'feet';

export type VcsShotTransition = 'cut' | 'ease' | 'bezier';

export interface CharacterProfile {
  modelId: string;
  /** Axis-aligned bounds in world units (estimated). */
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  skeletonHeight: number;
  centerOfMass: [number, number, number];
  headPosition: [number, number, number];
  facePosition: [number, number, number];
  eyePosition: [number, number, number];
  chestPosition: [number, number, number];
  feetPosition: [number, number, number];
  hairExtent: number;
  accessoryRadius: number;
  collisionRadius: number;
  safeCameraRadius: number;
  physicsBodyCount: number;
  analyzedAt: number;
}

export interface VcsVirtualCamera {
  id: string;
  name: string;
  keyframes: CameraKeyframe[];
  defaultFov: number;
  focusTarget: VcsFocusTarget;
  active: boolean;
}

export interface VcsShot {
  id: string;
  name: string;
  cameraId: string;
  startFrame: number;
  endFrame: number;
  keyframes: CameraKeyframe[];
  lightingPreset?: CinematicLightingPresetId;
  styleId?: string | null;
  transition: VcsShotTransition;
  transitionFrames: number;
  dofEnabled?: boolean;
  focusDistance?: number;
  exposure?: number;
  shake?: number;
}

export interface VcsDirectorVariation {
  id: string;
  label: string;
  mode: VcsDirectorMode;
  score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  keyframes: CameraKeyframe[];
  notes: string[];
}

export interface VcsState {
  enabled: boolean;
  directorMode: VcsDirectorMode;
  characterProfiles: Record<string, CharacterProfile>;
  cameras: VcsVirtualCamera[];
  shots: VcsShot[];
  activeShotId: string | null;
  activeCameraId: string | null;
  variations: VcsDirectorVariation[];
  selectedVariationId: string | null;
  variationCount: 5 | 10 | 20 | 50;
  safeCamera: boolean;
  handheld: boolean;
  composition: boolean;
  manualDirector: boolean;
  lightingPreset: CinematicLightingPresetId;
  lastDirectorScore: number | null;
  showSafeVolumeGizmo: boolean;
  /** Dynamic focus priority for operator. */
  focusTarget: VcsFocusTarget;
  handheldIntensity: number;
  smartZoom: boolean;
  referenceVideoName: string | null;
  referenceAnalysis: string | null;
  renderQuality: 'auto' | 'low' | 'medium' | 'high';
  adaptivePerformance: boolean;
}

export const DEFAULT_VCS_STATE: VcsState = {
  enabled: false,
  directorMode: 'character_showcase',
  characterProfiles: {},
  cameras: [],
  shots: [],
  activeShotId: null,
  activeCameraId: null,
  variations: [],
  selectedVariationId: null,
  variationCount: 10,
  safeCamera: true,
  handheld: false,
  composition: true,
  manualDirector: false,
  lightingPreset: 'anime_soft',
  lastDirectorScore: null,
  showSafeVolumeGizmo: false,
  focusTarget: 'face',
  handheldIntensity: 0.35,
  smartZoom: true,
  referenceVideoName: null,
  referenceAnalysis: null,
  renderQuality: 'auto',
  adaptivePerformance: true,
};

export interface VcsDirectorRules {
  mode: VcsDirectorMode;
  label: string;
  description: string;
  focusTarget: VcsFocusTarget;
  distanceMode: 'wide' | 'medium' | 'close';
  motionIntensity: number;
  fovBias: number;
  preferPortraitFraming: boolean;
}

export interface VcsPathInput {
  mode: VcsDirectorMode;
  maxFrames: number;
  modelCount: number;
  viewportFormat: ViewportFormat;
  profile?: CharacterProfile | null;
  motionSpeed?: number;
  stageTarget?: [number, number, number];
}

export type VcsKeyframe = CameraKeyframe & {
  target?: [number, number, number];
  easing?: CameraEasingId;
};

export interface SafeVolumeResult {
  snapshot: CameraSnapshot;
  clamped: boolean;
  reason?: string;
}
