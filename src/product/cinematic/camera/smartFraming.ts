import { getStageTargetTuple } from '../../../scene/cameraFraming';
import { orbitCameraSnapshot } from '../../../templates/animationTemplates';
import type { CameraSnapshot, ViewportFormat } from '../../../types';

/** Estimate character height from model count (MMD default ~15–17 units). */
export function estimateCharacterHeight(modelCount: number): number {
  if (modelCount >= 2) return 17.5;
  return 16;
}

export function estimateCharacterWidth(modelCount: number): number {
  if (modelCount >= 2) return 14;
  return 5.5;
}

export interface SmartDistanceInput {
  modelCount: number;
  motionIntensity?: number;
  accessoriesScale?: number;
  viewportFormat: ViewportFormat;
  mode: 'wide' | 'medium' | 'close';
}

/** Cinematic distance — never clips into character. */
export function computeSmartCameraDistance(input: SmartDistanceInput): number {
  const height = estimateCharacterHeight(input.modelCount);
  const width = estimateCharacterWidth(input.modelCount);
  const motion = input.motionIntensity ?? 0.5;
  const acc = input.accessoriesScale ?? 1;

  const base = Math.max(height * 1.45, width * 2.3) * acc;

  const modeMul =
    input.mode === 'close' ? 0.78 : input.mode === 'wide' ? 1.4 : 1.08;
  const motionMul = 1 + motion * 0.25;
  // Portrait needs MORE distance — tall frame + same FOV crops sides and feels huge.
  const portraitMul = input.viewportFormat === '9:16' ? 1.42 : 1;

  return Math.max(10, base * modeMul * motionMul * portraitMul);
}

export function computeSmartFov(
  distance: number,
  mode: 'wide' | 'medium' | 'close',
  viewportFormat: ViewportFormat
): number {
  const portrait = viewportFormat === '9:16';
  const base = mode === 'close' ? 36 : mode === 'wide' ? 44 : 40;
  const distFactor = Math.min(4, distance / 14) * 1.35;
  const fov = base + distFactor;
  return portrait ? Math.min(42, fov) : Math.min(50, fov);
}

export function snapshotWithSmartDistance(
  yawDeg: number,
  pitchDeg: number,
  input: SmartDistanceInput,
  target?: [number, number, number]
): CameraSnapshot {
  const distance = computeSmartCameraDistance(input);
  const fov = computeSmartFov(distance, input.mode, input.viewportFormat);
  return orbitCameraSnapshot(distance, yawDeg, pitchDeg, fov, target ?? getStageTargetTuple());
}
