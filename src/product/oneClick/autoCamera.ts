import { orbitCameraSnapshot } from '../../templates/animationTemplates';
import { buildShortCameraSnapshot } from '../camera/frameShortCamera';
import type { CameraSnapshot } from '../../types';
import type { MotionLibraryEntry } from './types';

export type AutoCameraKind = MotionLibraryEntry['cameraMode'];

export function snapshotForCameraMode(
  mode: AutoCameraKind,
  modelCount: number
): CameraSnapshot {
  const duo = modelCount >= 2;
  switch (mode) {
    case 'portrait':
      // Full-body with margin — previously 12–16 filled the frame too hard.
      return orbitCameraSnapshot(duo ? 34 : 28, 8, 4, 36);
    case 'showcase':
      return orbitCameraSnapshot(duo ? 36 : 30, 20, 3, 40);
    case 'dance':
      return orbitCameraSnapshot(duo ? 40 : 34, 32, 2, 42);
    case 'orbit':
    default:
      return orbitCameraSnapshot(duo ? 32 : 26, 0, 4, 40);
  }
}

export function snapshotForShortsPortrait(modelCount: number): CameraSnapshot {
  return buildShortCameraSnapshot(modelCount >= 2 ? 'duo' : 'single', '9:16');
}
