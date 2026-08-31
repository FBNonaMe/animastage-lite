import { getStageTargetTuple } from '../../../scene/cameraFraming';
import { orbitCameraSnapshot } from '../../../templates/animationTemplates';
import type { CameraSnapshot } from '../../../types';
import type { CinematicCameraMode, CinematicKeyframe, CinematicPathInput } from '../types';
import { applyCompositionOffset } from './collision';
import { computeSmartCameraDistance, computeSmartFov } from './smartFraming';

type PathSample = {
  t: number;
  yaw: number;
  pitch: number;
  distMul: number;
  fovMul: number;
  easing?: CinematicKeyframe['easing'];
};

function toKeyframe(
  frame: number,
  snap: CameraSnapshot,
  easing: CinematicKeyframe['easing'] = 'easeInOut'
): CinematicKeyframe {
  return {
    id: `cin_${frame}_${Math.random().toString(36).slice(2, 8)}`,
    frame,
    position: [...snap.position],
    rotation: [...snap.rotation],
    fov: snap.fov,
    target: [...snap.target],
    easing,
  };
}

function buildPath(
  input: CinematicPathInput,
  samples: PathSample[],
  mode: 'wide' | 'medium' | 'close'
): CinematicKeyframe[] {
  const target = input.stageTarget ?? getStageTargetTuple();
  const baseDist = computeSmartCameraDistance({
    modelCount: input.modelCount,
    motionIntensity: input.motionIntensity,
    viewportFormat: input.viewportFormat,
    mode,
  });
  const baseFov = computeSmartFov(baseDist, mode, input.viewportFormat);
  const portrait = input.viewportFormat === '9:16';

  return samples
    .map(({ t, yaw, pitch, distMul, fovMul, easing }) => {
      const frame = Math.max(0, Math.round(t * input.maxFrames));
      let snap = orbitCameraSnapshot(
        baseDist * distMul,
        yaw,
        pitch,
        Math.max(28, Math.min(55, baseFov * fovMul)),
        target
      );
      if (input.viewportFormat && portrait) {
        snap = applyCompositionOffset(snap, input.viewportFormat);
      }
      return toKeyframe(frame, snap, easing ?? 'easeInOut');
    })
    .sort((a, b) => a.frame - b.frame);
}

const MODE_SAMPLES: Record<CinematicCameraMode, PathSample[]> = {
  orbit: [
    { t: 0, yaw: -70, pitch: 8, distMul: 1.05, fovMul: 1, easing: 'easeIn' },
    { t: 0.2, yaw: -20, pitch: 6, distMul: 0.98, fovMul: 1.02 },
    { t: 0.45, yaw: 35, pitch: 5, distMul: 0.95, fovMul: 1.04 },
    { t: 0.7, yaw: 80, pitch: 7, distMul: 1, fovMul: 1.02 },
    { t: 1, yaw: 120, pitch: 9, distMul: 1.08, fovMul: 1, easing: 'easeOut' },
  ],
  hero: [
    { t: 0, yaw: -15, pitch: -4, distMul: 1.2, fovMul: 1.05, easing: 'easeIn' },
    { t: 0.35, yaw: 5, pitch: -2, distMul: 1.05, fovMul: 1 },
    { t: 0.65, yaw: 12, pitch: 0, distMul: 0.92, fovMul: 0.96 },
    { t: 1, yaw: 18, pitch: 2, distMul: 0.85, fovMul: 0.94, easing: 'easeOut' },
  ],
  dance: [
    { t: 0, yaw: -90, pitch: 5, distMul: 1.15, fovMul: 1.08, easing: 'easeIn' },
    { t: 0.25, yaw: -40, pitch: 4, distMul: 1, fovMul: 1.05 },
    { t: 0.5, yaw: 10, pitch: 3, distMul: 0.9, fovMul: 1.02 },
    { t: 0.75, yaw: 55, pitch: 5, distMul: 0.95, fovMul: 1.04 },
    { t: 1, yaw: 95, pitch: 6, distMul: 1.05, fovMul: 1.06, easing: 'easeOut' },
  ],
  showcase: [
    { t: 0, yaw: -110, pitch: 4, distMul: 1.18, fovMul: 1, easing: 'bezier' },
    { t: 0.3, yaw: -40, pitch: 3, distMul: 1.05, fovMul: 0.98 },
    { t: 0.55, yaw: 20, pitch: 2, distMul: 0.95, fovMul: 0.96 },
    { t: 0.8, yaw: 70, pitch: 4, distMul: 1, fovMul: 0.98 },
    { t: 1, yaw: 110, pitch: 5, distMul: 1.1, fovMul: 1, easing: 'easeOut' },
  ],
  drone: [
    { t: 0, yaw: 0, pitch: 28, distMul: 1.4, fovMul: 1.1, easing: 'easeIn' },
    { t: 0.4, yaw: 25, pitch: 22, distMul: 1.2, fovMul: 1.05 },
    { t: 0.7, yaw: 45, pitch: 16, distMul: 1.05, fovMul: 1 },
    { t: 1, yaw: 60, pitch: 12, distMul: 0.95, fovMul: 0.98, easing: 'easeOut' },
  ],
  close_up: [
    { t: 0, yaw: -8, pitch: 2, distMul: 0.72, fovMul: 0.92, easing: 'easeIn' },
    { t: 0.5, yaw: 4, pitch: 1, distMul: 0.68, fovMul: 0.9 },
    { t: 1, yaw: 10, pitch: 0, distMul: 0.65, fovMul: 0.88, easing: 'easeOut' },
  ],
  tracking: [
    { t: 0, yaw: -55, pitch: 6, distMul: 1, fovMul: 1, easing: 'easeIn' },
    { t: 0.33, yaw: -25, pitch: 5, distMul: 0.98, fovMul: 1.01 },
    { t: 0.66, yaw: 5, pitch: 4, distMul: 0.96, fovMul: 1.02 },
    { t: 1, yaw: 35, pitch: 5, distMul: 0.98, fovMul: 1.01, easing: 'easeOut' },
  ],
  over_shoulder: [
    { t: 0, yaw: -140, pitch: 4, distMul: 0.88, fovMul: 0.95, easing: 'easeIn' },
    { t: 0.5, yaw: -125, pitch: 3, distMul: 0.85, fovMul: 0.93 },
    { t: 1, yaw: -110, pitch: 2, distMul: 0.82, fovMul: 0.92, easing: 'easeOut' },
  ],
  face: [
    { t: 0, yaw: -5, pitch: 1, distMul: 0.58, fovMul: 0.86, easing: 'easeInOut' },
    { t: 0.5, yaw: 3, pitch: 0, distMul: 0.55, fovMul: 0.84 },
    { t: 1, yaw: 8, pitch: -1, distMul: 0.52, fovMul: 0.82, easing: 'easeOut' },
  ],
  dynamic: [
    { t: 0, yaw: -80, pitch: 6, distMul: 1.1, fovMul: 1.05, easing: 'easeIn' },
    { t: 0.2, yaw: -30, pitch: 2, distMul: 0.85, fovMul: 0.92 },
    { t: 0.45, yaw: 20, pitch: -2, distMul: 0.78, fovMul: 0.9 },
    { t: 0.65, yaw: 60, pitch: 8, distMul: 1.05, fovMul: 1.02 },
    { t: 0.85, yaw: 90, pitch: 12, distMul: 1.2, fovMul: 1.08 },
    { t: 1, yaw: 45, pitch: 5, distMul: 0.95, fovMul: 1, easing: 'easeOut' },
  ],
};

const MODE_FRAMING: Record<CinematicCameraMode, 'wide' | 'medium' | 'close'> = {
  orbit: 'medium',
  hero: 'medium',
  dance: 'wide',
  showcase: 'wide',
  drone: 'wide',
  close_up: 'close',
  tracking: 'medium',
  over_shoulder: 'medium',
  face: 'close',
  dynamic: 'medium',
};

export function generateCinematicCameraPath(input: CinematicPathInput): CinematicKeyframe[] {
  const samples = MODE_SAMPLES[input.mode] ?? MODE_SAMPLES.showcase;
  const framing = MODE_FRAMING[input.mode] ?? 'medium';
  return buildPath(input, samples, framing);
}

export function pickCinematicModeForMotion(
  motionIntensity: number,
  viewportFormat: CinematicPathInput['viewportFormat']
): CinematicCameraMode {
  if (viewportFormat === '9:16') {
    return motionIntensity > 0.6 ? 'dance' : 'close_up';
  }
  if (motionIntensity > 0.75) return 'dance';
  if (motionIntensity > 0.45) return 'showcase';
  return 'hero';
}
