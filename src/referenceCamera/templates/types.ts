/**
 * Cinematic Camera Template Library — types.
 */
import type { CameraEasingId, CameraKeyframe, ViewportFormat } from '../../types';
import type { FramingModeId } from '../types';

export type CameraTemplateCategory =
  | 'showcase'
  | 'orbit'
  | 'hero'
  | 'performance'
  | 'social'
  | 'action'
  | 'dialogue'
  | 'tracking'
  | 'angle'
  | 'framing'
  | 'crane'
  | 'move'
  | 'user';

export type CameraTemplateMotionKind =
  | 'orbit'
  | 'orbit_fast'
  | 'orbit_360'
  | 'arc'
  | 'spiral'
  | 'crane_up'
  | 'drone'
  | 'push_in'
  | 'pull_out'
  | 'zoom_in'
  | 'zoom_out'
  | 'dolly'
  | 'pan'
  | 'track_side'
  | 'track_front'
  | 'track_back'
  | 'follow_walk'
  | 'follow_run'
  | 'static_hold'
  | 'reveal'
  | 'entrance'
  | 'dynamic_cuts'
  | 'ots'
  | 'low_hero'
  | 'high_reveal';

export interface CameraTemplateSafeDistances {
  min: number;
  max: number;
  preferred: number;
}

export interface CameraTemplateDef {
  id: string;
  label: string;
  description: string;
  category: CameraTemplateCategory;
  /** Built-in vs user-saved. */
  builtin: boolean;
  motion: CameraTemplateMotionKind;
  /** Relative duration weight 0.5–1.5 of timeline. */
  durationScale: number;
  /** Base FOV at reference height. */
  baseFov: number;
  /** FOV end (for zoom templates). */
  endFov?: number;
  /** Orbit / track radius multiplier vs character height. */
  radiusMul: number;
  /** Camera height offset as fraction of character height (−0.2…1.2). */
  heightFrac: number;
  /** Look target height fraction (0 = feet, 1 = top of head). */
  lookFrac: number;
  easing: CameraEasingId;
  framing: FramingModeId;
  followTarget: NonNullable<CameraKeyframe['followTarget']>;
  dofStrength: number;
  speed: number;
  /** Preferred aspects — others still work via adaptation. */
  preferredAspects: ViewportFormat[];
  safe: CameraTemplateSafeDistances;
  /** Tags for reference matching. */
  styleTags: string[];
  folderId?: string | null;
}

export interface CameraTemplateFolder {
  id: string;
  name: string;
}

export interface UserCameraTemplate extends CameraTemplateDef {
  builtin: false;
  /** Serialized keyframes at reference scale (height=16, focus origin). */
  bakedKeyframes: CameraKeyframe[];
  createdAt: number;
  updatedAt: number;
}

export interface TemplateAdaptContext {
  focus: [number, number, number];
  /** Approximate character height in world units. */
  characterHeight: number;
  durationFrames: number;
  viewportFormat: ViewportFormat;
  minDistance?: number;
  maxDistance?: number;
}

export interface AppliedCameraTemplate {
  templateId: string;
  keyframes: CameraKeyframe[];
  framing: FramingModeId;
  safe: CameraTemplateSafeDistances;
  notes: string;
}

export interface TemplateMatchResult {
  templateId: string;
  score: number;
  reason: string;
}

export const CAMERA_TEMPLATE_STORAGE_KEY = 'animastage.cameraTemplates.v1';
