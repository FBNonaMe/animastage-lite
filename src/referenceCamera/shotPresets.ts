import type { CameraKeyframe, CameraSnapshot } from '../types';

function id(): string {
  return `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface ShotPresetDef {
  id: string;
  label: string;
  description: string;
  /** Relative to focus point. */
  offset: [number, number, number];
  fov: number;
  easing: CameraKeyframe['easing'];
}

export const CAMERA_SHOT_PRESETS: ShotPresetDef[] = [
  { id: 'extreme_closeup', label: 'Extreme Close-Up', description: 'Eyes / face detail', offset: [0, 1.55, 2.2], fov: 28, easing: 'cinematic' },
  { id: 'closeup', label: 'Close-Up', description: 'Face framing', offset: [0.2, 1.45, 3.4], fov: 32, easing: 'easeInOut' },
  { id: 'medium', label: 'Medium Shot', description: 'Waist-up', offset: [0.4, 1.15, 6.5], fov: 38, easing: 'easeInOut' },
  { id: 'full_body', label: 'Full Body', description: 'Head to toe', offset: [0, 1.1, 14], fov: 42, easing: 'cinematic' },
  { id: 'hero', label: 'Hero Shot', description: 'Low dramatic hero', offset: [0.3, 0.55, 8], fov: 36, easing: 'easeOut' },
  { id: 'orbit', label: 'Orbit', description: 'Side orbit start', offset: [10, 1.4, 10], fov: 40, easing: 'catmull' },
  { id: 'tracking', label: 'Tracking Shot', description: 'Follow from side', offset: [5.5, 1.2, 4], fov: 40, easing: 'cinematic' },
  { id: 'side', label: 'Side Shot', description: 'Profile', offset: [9, 1.3, 0.5], fov: 40, easing: 'easeInOut' },
  { id: 'front', label: 'Front Shot', description: 'Straight on', offset: [0, 1.3, 12], fov: 40, easing: 'easeInOut' },
  { id: 'back', label: 'Back Shot', description: 'Over-shoulder / rear', offset: [0.4, 1.4, -10], fov: 40, easing: 'easeInOut' },
  { id: 'top', label: 'Top View', description: 'High overhead', offset: [0, 18, 0.5], fov: 48, easing: 'easeIn' },
  { id: 'low_angle', label: 'Low Angle', description: 'Looking up', offset: [0.2, 0.4, 7], fov: 38, easing: 'easeOut' },
  { id: 'high_angle', label: 'High Angle', description: 'Looking down', offset: [0, 8, 8], fov: 44, easing: 'easeIn' },
  { id: 'dutch', label: 'Dutch Angle', description: 'Tilted dramatic', offset: [3, 1.3, 8], fov: 38, easing: 'bezier' },
  { id: 'crane', label: 'Crane Shot', description: 'Rising crane start', offset: [2, 2.5, 14], fov: 42, easing: 'cinematic' },
  { id: 'dolly', label: 'Dolly Shot', description: 'Push-in start', offset: [0, 1.3, 16], fov: 40, easing: 'easeInOut' },
];

export function getShotPreset(id: string): ShotPresetDef {
  return CAMERA_SHOT_PRESETS.find((p) => p.id === id) ?? CAMERA_SHOT_PRESETS[3];
}

/** Build a keyframe from a shot preset relative to a focus point. */
export function shotPresetToKeyframe(
  presetId: string,
  frame: number,
  focus: [number, number, number] = [0, 10, 0]
): CameraKeyframe {
  const p = getShotPreset(presetId);
  const position: [number, number, number] = [
    focus[0] + p.offset[0],
    focus[1] + p.offset[1],
    focus[2] + p.offset[2],
  ];
  const dutch = presetId === 'dutch' ? 12 : 0;
  return {
    id: id(),
    frame,
    position,
    rotation: [0, 0, dutch],
    fov: p.fov,
    target: [...focus],
    easing: p.easing,
    roll: dutch,
    focusDistance: Math.hypot(p.offset[0], p.offset[1], p.offset[2]),
    dofStrength: presetId.includes('close') ? 0.45 : 0.15,
    followTarget: presetId.includes('close') ? 'face' : 'body',
    speed: 1,
  };
}

export function snapshotFromKeyframe(kf: CameraKeyframe): CameraSnapshot {
  return {
    position: [...kf.position],
    rotation: [...kf.rotation],
    fov: kf.fov,
    target: kf.target ? [...kf.target] : [0, 10, 0],
  };
}
