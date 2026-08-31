/** Shot & camera presets for Shot Composer 1.0. */
import type { ViewportFormat } from '../types';
import type { ShotCameraPresetId, ShotPresetId } from './types';

export interface ShotPresetDef {
  id: ShotPresetId;
  label: string;
  /** Orbit yaw degrees around character. */
  yawDeg: number;
  /** Orbit pitch degrees (positive = look down from above slightly). */
  pitchDeg: number;
  /** Distance multiplier vs character height. */
  distanceMul: number;
  /** Aim height as fraction of character height (0=feet, 1=head). */
  aimHeightFrac: number;
  fov: number;
  framing: 'full_body' | 'upper_body' | 'face';
  /** Preferred aspect when Create Shot picks defaults. */
  preferredAspect?: ViewportFormat;
}

export const SHOT_PRESETS: ShotPresetDef[] = [
  {
    id: 'full_body',
    label: 'Full Body',
    yawDeg: 12,
    pitchDeg: 4,
    distanceMul: 2.35,
    aimHeightFrac: 0.48,
    fov: 40,
    framing: 'full_body',
  },
  {
    id: 'medium',
    label: 'Medium Shot',
    yawDeg: 8,
    pitchDeg: 3,
    distanceMul: 1.55,
    aimHeightFrac: 0.62,
    fov: 38,
    framing: 'upper_body',
  },
  {
    id: 'close_up',
    label: 'Close Up',
    yawDeg: 4,
    pitchDeg: 2,
    distanceMul: 0.85,
    aimHeightFrac: 0.88,
    fov: 34,
    framing: 'face',
  },
  {
    id: 'portrait',
    label: 'Portrait',
    yawDeg: 6,
    pitchDeg: 3,
    distanceMul: 1.2,
    aimHeightFrac: 0.72,
    fov: 36,
    framing: 'upper_body',
    preferredAspect: '9:16',
  },
  {
    id: 'hero',
    label: 'Hero Shot',
    yawDeg: 18,
    pitchDeg: -6,
    distanceMul: 1.9,
    aimHeightFrac: 0.55,
    fov: 38,
    framing: 'full_body',
  },
  {
    id: 'wide',
    label: 'Wide Shot',
    yawDeg: 22,
    pitchDeg: 8,
    distanceMul: 3.4,
    aimHeightFrac: 0.42,
    fov: 46,
    framing: 'full_body',
    preferredAspect: '16:9',
  },
  {
    id: 'low_angle',
    label: 'Low Angle',
    yawDeg: 10,
    pitchDeg: -14,
    distanceMul: 2.1,
    aimHeightFrac: 0.58,
    fov: 42,
    framing: 'full_body',
  },
  {
    id: 'high_angle',
    label: 'High Angle',
    yawDeg: 14,
    pitchDeg: 22,
    distanceMul: 2.5,
    aimHeightFrac: 0.4,
    fov: 42,
    framing: 'full_body',
  },
  {
    id: 'side',
    label: 'Side Shot',
    yawDeg: 90,
    pitchDeg: 3,
    distanceMul: 2.1,
    aimHeightFrac: 0.5,
    fov: 40,
    framing: 'full_body',
  },
  {
    id: 'back',
    label: 'Back Shot',
    yawDeg: 180,
    pitchDeg: 4,
    distanceMul: 2.2,
    aimHeightFrac: 0.5,
    fov: 40,
    framing: 'full_body',
  },
  {
    id: 'showcase',
    label: 'Character Showcase',
    yawDeg: 28,
    pitchDeg: 5,
    distanceMul: 2.6,
    aimHeightFrac: 0.5,
    fov: 42,
    framing: 'full_body',
  },
  {
    id: 'dance',
    label: 'Dance',
    yawDeg: 0,
    pitchDeg: 2,
    distanceMul: 2.8,
    aimHeightFrac: 0.45,
    fov: 44,
    framing: 'full_body',
  },
  {
    id: 'anime_intro',
    label: 'Anime Intro',
    yawDeg: 35,
    pitchDeg: 6,
    distanceMul: 2.0,
    aimHeightFrac: 0.65,
    fov: 36,
    framing: 'upper_body',
  },
  {
    id: 'shorts',
    label: 'Shorts',
    yawDeg: 0,
    pitchDeg: 3,
    distanceMul: 2.55,
    aimHeightFrac: 0.48,
    fov: 38,
    framing: 'full_body',
    preferredAspect: '9:16',
  },
];

export function getShotPreset(id: ShotPresetId): ShotPresetDef {
  return SHOT_PRESETS.find((p) => p.id === id) ?? SHOT_PRESETS[0]!;
}

export interface ShotCameraPresetDef {
  id: ShotCameraPresetId;
  label: string;
  shotPreset: ShotPresetId;
  aspect: ViewportFormat;
}

export const SHOT_CAMERA_PRESETS: ShotCameraPresetDef[] = [
  { id: 'cinematic', label: 'Cinematic', shotPreset: 'wide', aspect: '16:9' },
  { id: 'anime', label: 'Anime', shotPreset: 'anime_intro', aspect: '16:9' },
  { id: 'portrait', label: 'Portrait', shotPreset: 'portrait', aspect: '9:16' },
  { id: 'dance', label: 'Dance', shotPreset: 'dance', aspect: '16:9' },
  { id: 'shorts', label: 'Shorts', shotPreset: 'shorts', aspect: '9:16' },
  { id: 'hero', label: 'Hero', shotPreset: 'hero', aspect: '16:9' },
  { id: 'dramatic', label: 'Dramatic', shotPreset: 'low_angle', aspect: '21:9' },
  { id: 'wide', label: 'Wide', shotPreset: 'wide', aspect: '16:9' },
  { id: 'close', label: 'Close', shotPreset: 'close_up', aspect: '9:16' },
];

export function getShotCameraPreset(id: ShotCameraPresetId): ShotCameraPresetDef {
  return SHOT_CAMERA_PRESETS.find((p) => p.id === id) ?? SHOT_CAMERA_PRESETS[4]!;
}

export const SHOT_ASPECTS: { id: ViewportFormat; label: string }[] = [
  { id: '9:16', label: '9:16 Shorts' },
  { id: '16:9', label: '16:9 Cinema' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '21:9', label: '21:9' },
];
