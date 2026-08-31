/**
 * Legacy smart presets — thin wrappers over the Template Library.
 */
import type { CameraKeyframe } from '../types';
import { BUILTIN_CAMERA_TEMPLATES } from './templates/builtinCatalog';
import { applyCameraTemplate } from './templates/adaptTemplate';

const LEGACY_ALIAS: Record<string, string> = {
  anime_orbit: 'slow_orbit',
  hero_shot: 'hero_entrance',
  idol_performance: 'dance_performance',
  dance_camera: 'dance_performance',
  tracking: 'side_tracking',
  follow: 'walking_follow',
  side: 'side_tracking',
  front: 'front_tracking',
  back: 'back_tracking',
  crane: 'crane_shot',
  drone: 'drone_shot',
  arc: 'arc_shot',
  close_up: 'close_up',
  full_body: 'full_body_shot',
  medium_shot: 'medium_shot',
  combat_camera: 'combat_camera',
  character_showcase: 'character_showcase',
  music_video: 'music_video',
  stage_performance: 'stage_performance',
};

export interface SmartPresetDef {
  id: string;
  label: string;
  description: string;
}

export const SMART_CAMERA_PRESETS: SmartPresetDef[] = BUILTIN_CAMERA_TEMPLATES.map((t) => ({
  id: t.id,
  label: t.label,
  description: t.description,
}));

export function generateSmartCameraPath(
  presetId: string,
  durationFrames: number,
  focus: [number, number, number] = [0, 10, 0]
): CameraKeyframe[] {
  const id = LEGACY_ALIAS[presetId] ?? presetId;
  const tpl = BUILTIN_CAMERA_TEMPLATES.find((t) => t.id === id) ?? BUILTIN_CAMERA_TEMPLATES[0];
  return applyCameraTemplate(tpl, {
    focus,
    characterHeight: Math.max(12, focus[1] * 1.55),
    durationFrames,
    viewportFormat: '16:9',
  }).keyframes;
}
