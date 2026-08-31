/** Character facing helpers after placement. */
import type { CharacterOrientMode } from './types';

export function resolveCharacterYawDeg(
  mode: CharacterOrientMode,
  opts: {
    currentYaw: number;
    cameraPosition: [number, number, number];
    characterFeet: [number, number, number];
    target?: [number, number, number] | null;
    keepUpright?: boolean;
  }
): { rotationX: number; rotationY: number; rotationZ: number } {
  const upright = opts.keepUpright !== false;
  const rx = upright ? 0 : 0;
  const rz = upright ? 0 : 0;

  switch (mode) {
    case 'face_camera': {
      const dx = opts.cameraPosition[0] - opts.characterFeet[0];
      const dz = opts.cameraPosition[2] - opts.characterFeet[2];
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      return { rotationX: rx, rotationY: yaw, rotationZ: rz };
    }
    case 'face_forward':
      return { rotationX: rx, rotationY: 0, rotationZ: rz };
    case 'face_target': {
      const t = opts.target ?? [0, opts.characterFeet[1], 0];
      const dx = t[0] - opts.characterFeet[0];
      const dz = t[2] - opts.characterFeet[2];
      const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
      return { rotationX: rx, rotationY: yaw, rotationZ: rz };
    }
    case 'keep_upright':
      return { rotationX: 0, rotationY: opts.currentYaw, rotationZ: 0 };
    case 'manual':
    default:
      return { rotationX: rx, rotationY: opts.currentYaw, rotationZ: rz };
  }
}
