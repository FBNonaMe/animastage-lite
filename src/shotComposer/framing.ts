/** Auto framing + composition warnings from character placement. */
import { orbitCameraSnapshot } from '../templates/animationTemplates';
import { adjustFramingForViewport } from '../camera/viewportFraming';
import type { CameraSnapshot, ViewportFormat } from '../types';
import { getShotPreset } from './presets';
import type { CompositionWarning, FramingFocus, ShotPresetId } from './types';

export interface FrameCharacterInput {
  feet: [number, number, number];
  height: number;
  yawOffsetDeg?: number;
  aspect: ViewportFormat;
  shotPreset: ShotPresetId;
  framingFocus?: FramingFocus;
}

export function characterFocusPoint(
  feet: [number, number, number],
  height: number,
  frac: number
): [number, number, number] {
  return [feet[0], feet[1] + height * frac, feet[2]];
}

export function buildShotCameraSnapshot(input: FrameCharacterInput): CameraSnapshot {
  const preset = getShotPreset(input.shotPreset);
  let aimFrac = preset.aimHeightFrac;
  const focus = input.framingFocus ?? preset.framing;
  if (focus === 'face') aimFrac = 0.9;
  else if (focus === 'upper_body') aimFrac = 0.68;
  else if (focus === 'full_body') aimFrac = Math.min(aimFrac, 0.5);

  const target = characterFocusPoint(input.feet, input.height, aimFrac);
  let distance = Math.max(6, input.height * preset.distanceMul);
  let fov = preset.fov;

  // Portrait / Shorts: pull back + keep head/foot room.
  const adjusted = adjustFramingForViewport(distance, fov, input.aspect);
  distance = adjusted.distance;
  fov = adjusted.fov;

  if (input.aspect === '9:16' || input.aspect === '4:5') {
    distance *= 1.08;
    // Aim slightly lower so feet stay in safe area.
    target[1] = feetAimAdjust(input.feet[1], input.height, aimFrac, input.aspect);
  } else if (input.aspect === '16:9' || input.aspect === '21:9') {
    distance *= 1.05;
  }

  const yaw = preset.yawDeg + (input.yawOffsetDeg ?? 0);
  return orbitCameraSnapshot(distance, yaw, preset.pitchDeg, fov, target);
}

function feetAimAdjust(
  feetY: number,
  height: number,
  aimFrac: number,
  aspect: ViewportFormat
): number {
  const base = feetY + height * aimFrac;
  if (aspect === '9:16') return base - height * 0.04;
  if (aspect === '4:5') return base - height * 0.02;
  return base;
}

export function analyzeComposition(
  input: FrameCharacterInput,
  camera: CameraSnapshot
): CompositionWarning[] {
  const warnings: CompositionWarning[] = [];
  const height = input.height;
  const dist = Math.hypot(
    camera.position[0] - input.feet[0],
    camera.position[2] - input.feet[2]
  );
  const fill = height / Math.max(1, dist * Math.tan(((camera.fov ?? 40) * Math.PI) / 360) * 2);

  if (fill < 0.22) {
    warnings.push({
      id: 'too_small',
      message: 'Character too small in frame — move camera closer or use a tighter preset.',
      severity: 'warn',
    });
  }
  if (fill > 0.92) {
    warnings.push({
      id: 'too_large',
      message: 'Character too large — head or feet may clip. Pull back or widen FOV.',
      severity: 'warn',
    });
  }
  if (input.aspect === '9:16' && fill > 0.85) {
    warnings.push({
      id: 'head_close',
      message: 'Head room tight for Shorts — leave margin above the head.',
      severity: 'info',
    });
  }
  const camH = camera.position[1] - input.feet[1];
  if (camH < height * 0.15 && input.shotPreset !== 'low_angle') {
    warnings.push({
      id: 'feet_risk',
      message: 'Camera very low — feet may leave the safe frame.',
      severity: 'info',
    });
  }
  return warnings;
}

/** Reframe existing target/distance for a new aspect without changing shot intent. */
export function reframeForAspect(
  feet: [number, number, number],
  height: number,
  shotPreset: ShotPresetId,
  aspect: ViewportFormat,
  yawOffsetDeg = 0
): CameraSnapshot {
  return buildShotCameraSnapshot({
    feet,
    height,
    shotPreset,
    aspect,
    yawOffsetDeg,
  });
}
