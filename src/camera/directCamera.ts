import type { CameraSnapshot, ViewportFormat } from '../types';
import { isPortraitFormat } from '../utils/characterQuality';

/** Wide stable framing — default when user takes manual camera control. */
export const DIRECT_CAMERA_SNAPSHOT: CameraSnapshot = {
  position: [0, 14, 32],
  rotation: [0, 0, 0],
  fov: 42,
  target: [0, 11, 0],
};

export function buildDirectCameraSnapshot(
  viewportFormat: ViewportFormat = '16:9'
): CameraSnapshot {
  if (isPortraitFormat(viewportFormat)) {
    return {
      position: [0, 13, 28],
      rotation: [0, 0, 0],
      fov: 40,
      target: [0, 11.5, 0],
    };
  }
  return { ...DIRECT_CAMERA_SNAPSHOT };
}
