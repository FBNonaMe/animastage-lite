/**
 * Reference Camera Studio — cinematic directing tool (not a traditional camera editor).
 */
import type { CameraEasingId, CameraFocusTarget, ViewportFormat } from '../types';

export type ReferenceViewMode = 'side_by_side' | 'overlay' | 'hidden';

export type CompositionGuideId =
  | 'none'
  | 'thirds'
  | 'golden'
  | 'center'
  | 'safe'
  | 'action_safe'
  | 'title_safe'
  | 'portrait'
  | 'social';

export type FramingModeId =
  | 'none'
  | 'keep_character'
  | 'keep_face'
  | 'keep_full_body'
  | 'keep_eyes'
  | 'auto_reframe'
  | 'dynamic';

export type CameraShotPresetId =
  | 'extreme_closeup'
  | 'closeup'
  | 'medium'
  | 'full_body'
  | 'hero'
  | 'orbit'
  | 'tracking'
  | 'side'
  | 'front'
  | 'back'
  | 'top'
  | 'low_angle'
  | 'high_angle'
  | 'dutch'
  | 'crane'
  | 'dolly';

export type CameraConstraintId =
  | 'keep_character'
  | 'keep_face'
  | 'keep_eyes'
  | 'min_distance'
  | 'max_distance'
  | 'avoid_collision'
  | 'avoid_ground'
  | 'avoid_penetration'
  | 'lock_horizon'
  | 'auto_level';

export interface ReferenceVideoAsset {
  /** Object URL — revoked on clear. Never used in export encode. */
  blobUrl: string;
  fileName: string;
  durationSec: number;
  width: number;
  height: number;
}

export interface ReferenceCameraState {
  /** Studio panel open. */
  studioOpen: boolean;
  /** Reference video (guide only). */
  reference: ReferenceVideoAsset | null;
  viewMode: ReferenceViewMode;
  overlayOpacity: number;
  /** Sync reference video time to timeline playhead. */
  syncFrames: boolean;
  showPath: boolean;
  showFrustum: boolean;
  showGhosts: boolean;
  compositionGuide: CompositionGuideId;
  framingMode: FramingModeId;
  portraitKeepInFrame: boolean;
  stabilizeMotion: boolean;
  constraints: CameraConstraintId[];
  minDistance: number;
  maxDistance: number;
  /** Clipboard for copy/paste poses. */
  clipboard: import('../types').CameraSnapshot | null;
  lastAutoMatchNotes: string | null;
  compositionHint: string | null;
}

export const DEFAULT_REFERENCE_CAMERA: ReferenceCameraState = {
  studioOpen: false,
  reference: null,
  viewMode: 'overlay',
  overlayOpacity: 0.35,
  syncFrames: true,
  showPath: true,
  showFrustum: true,
  showGhosts: true,
  compositionGuide: 'thirds',
  framingMode: 'auto_reframe',
  portraitKeepInFrame: true,
  stabilizeMotion: true,
  constraints: ['avoid_ground', 'avoid_collision', 'auto_level', 'keep_character'],
  minDistance: 4,
  maxDistance: 80,
  clipboard: null,
  lastAutoMatchNotes: null,
  compositionHint: null,
};

export const CAMERA_EASING_OPTIONS: { id: CameraEasingId; label: string }[] = [
  { id: 'linear', label: 'Linear' },
  { id: 'easeIn', label: 'Ease In' },
  { id: 'easeOut', label: 'Ease Out' },
  { id: 'easeInOut', label: 'Ease In-Out' },
  { id: 'bezier', label: 'Bezier' },
  { id: 'cubic', label: 'Cubic' },
  { id: 'catmull', label: 'Catmull-Rom' },
  { id: 'hermite', label: 'Hermite' },
  { id: 'cinematic', label: 'Smooth Cinematic' },
  { id: 'custom', label: 'Custom Curve' },
];

export const FOLLOW_TARGET_OPTIONS: {
  id: NonNullable<import('../types').CameraKeyframe['followTarget']>;
  label: string;
}[] = [
  { id: 'face', label: 'Head / Face' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'body', label: 'Chest / Body' },
  { id: 'chest', label: 'Chest' },
  { id: 'full', label: 'Full Body' },
  { id: 'root', label: 'Character Root' },
  { id: 'hand', label: 'Hand' },
  { id: 'custom', label: 'Custom / Empty' },
];

export type { CameraFocusTarget, ViewportFormat };
