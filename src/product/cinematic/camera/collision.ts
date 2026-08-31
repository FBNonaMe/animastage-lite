import type { CameraSnapshot, ViewportFormat } from '../../../types';
import { isPortraitFormat } from '../../../utils/characterQuality';

/** Rule-of-thirds vertical offset for portrait shorts. */
export function applyCompositionOffset(
  snapshot: CameraSnapshot,
  viewportFormat: ViewportFormat
): CameraSnapshot {
  const [tx, ty, tz] = snapshot.target;
  const headroom = isPortraitFormat(viewportFormat) ? 0.85 : 0.35;
  const leadRoom = 0.15;

  return {
    ...snapshot,
    target: [tx + leadRoom, ty + headroom, tz],
    position: [
      snapshot.position[0] + leadRoom * 0.3,
      snapshot.position[1] + headroom * 0.2,
      snapshot.position[2],
    ],
  };
}

/** Push camera back if too close; soft body + floor guard for cinematic motion. */
export function resolveCameraCollision(
  snapshot: CameraSnapshot,
  minDistance = 6,
  opts?: { floorY?: number; bodyRadius?: number }
): CameraSnapshot {
  const floorY = opts?.floorY ?? 0.55;
  const bodyRadius = opts?.bodyRadius ?? Math.min(minDistance * 0.45, 2.4);
  const [tx, ty, tz] = snapshot.target;
  let [px, py, pz] = snapshot.position;

  let dx = px - tx;
  let dy = py - ty;
  let dz = pz - tz;
  let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < bodyRadius && dist > 1e-6) {
    const scale = bodyRadius / dist;
    px = tx + dx * scale;
    py = ty + dy * scale;
    pz = tz + dz * scale;
    dx = px - tx;
    dy = py - ty;
    dz = pz - tz;
    dist = bodyRadius;
  }

  if (dist < minDistance && dist > 1e-6) {
    const scale = minDistance / dist;
    px = tx + dx * scale;
    py = ty + dy * scale;
    pz = tz + dz * scale;
  }

  if (py < floorY) py = floorY;

  return {
    ...snapshot,
    position: [px, py, pz],
  };
}

/** Floor clip guard — never go below stage. */
export function clampCameraAboveFloor(snapshot: CameraSnapshot, floorY = 0.5): CameraSnapshot {
  if (snapshot.position[1] >= floorY) return snapshot;
  return {
    ...snapshot,
    position: [snapshot.position[0], floorY, snapshot.position[2]],
  };
}
