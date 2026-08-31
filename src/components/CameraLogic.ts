import * as THREE from 'three';
import type { CameraKeyframe, CameraSnapshot, ViewportFormat } from '../types';
import { frameToTime, seekAnimationMixer } from '../utils/animationSync';
import { CAMERA_DAMP_FACTOR } from '../utils/cameraFollow';
import { orbitCameraSnapshot } from '../templates/animationTemplates';
import { evaluateCinematicCameraAtFrame } from '../referenceCamera/cinematicInterp';
import {
  applyFramingConstraints,
  type FramingModeId,
} from '../referenceCamera/framing';
import type { CameraConstraintId } from '../referenceCamera/types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const STAGE_FLOOR_Y = 0.6;
const MIN_SHOWCASE_DISTANCE = 14;
const MIN_CAMERA_HEIGHT = STAGE_FLOOR_Y + 1.4;
const MIN_ORBIT_PITCH_DEG = 4;

function createCameraKeyframeId(): string {
  return `cam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTuple3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    lerpScalar(a[0], b[0], t),
    lerpScalar(a[1], b[1], t),
    lerpScalar(a[2], b[2], t),
  ];
}

export function createEmptyCameraKeyframes(): CameraKeyframe[] {
  return [];
}

export function countCameraKeyframes(keyframes: CameraKeyframe[]): number {
  return keyframes.length;
}

export function addCameraKeyframe(
  keyframes: CameraKeyframe[],
  frame: number,
  snapshot: CameraSnapshot
): CameraKeyframe[] {
  const safe = sanitizeCameraSnapshot(snapshot);
  const next = keyframes.filter((kf) => kf.frame !== frame);
  next.push({
    id: createCameraKeyframeId(),
    frame,
    position: [...safe.position],
    rotation: [...safe.rotation],
    fov: safe.fov,
    target: [...safe.target],
  });
  return next.sort((a, b) => a.frame - b.frame);
}

/** Prevent worm-eye / floor clips — keeps full-body framing. */
export function sanitizeCameraSnapshot(
  snapshot: CameraSnapshot,
  opts?: { minDistance?: number; floorY?: number }
): CameraSnapshot {
  const floorY = opts?.floorY ?? STAGE_FLOOR_Y;
  const minDistance = opts?.minDistance ?? MIN_SHOWCASE_DISTANCE;

  let target: [number, number, number] = [...snapshot.target];
  let position: [number, number, number] = [...snapshot.position];
  const fov = snapshot.fov;

  let dx = position[0] - target[0];
  let dy = position[1] - target[1];
  let dz = position[2] - target[2];
  let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < minDistance && dist > 1e-6) {
    const scale = minDistance / dist;
    position = [target[0] + dx * scale, target[1] + dy * scale, target[2] + dz * scale];
    dx *= scale;
    dy *= scale;
    dz *= scale;
    dist = minDistance;
  }

  if (position[1] < MIN_CAMERA_HEIGHT) {
    const yawDeg = Math.atan2(dx, dz) * RAD2DEG;
    const pitchDeg = Math.max(
      MIN_ORBIT_PITCH_DEG,
      Math.asin(Math.max(-1, Math.min(1, dy / Math.max(dist, minDistance)))) * RAD2DEG
    );
    const safeDist = Math.max(dist, minDistance);
    const rebuilt = orbitCameraSnapshot(safeDist, yawDeg, pitchDeg, fov, target);
    return rebuilt;
  }

  if (position[1] < floorY + 0.5) {
    const yawDeg = Math.atan2(dx, dz) * RAD2DEG;
    const safeDist = Math.max(dist, minDistance);
    return orbitCameraSnapshot(safeDist, yawDeg, MIN_ORBIT_PITCH_DEG, fov, target);
  }

  return { position, rotation: [...snapshot.rotation], fov, target };
}

function targetFromRotation(
  position: [number, number, number],
  rotation: [number, number, number]
): [number, number, number] {
  const euler = new THREE.Euler(
    rotation[0] * DEG2RAD,
    rotation[1] * DEG2RAD,
    rotation[2] * DEG2RAD,
    'YXZ'
  );
  const dir = new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();
  const lookDist = 18;
  return [
    position[0] + dir.x * lookDist,
    position[1] + dir.y * lookDist,
    position[2] + dir.z * lookDist,
  ];
}

export function sanitizeCameraKeyframes(keyframes: CameraKeyframe[]): CameraKeyframe[] {
  return keyframes.map((kf) => {
    const snap = sanitizeCameraSnapshot({
      position: kf.position,
      rotation: kf.rotation,
      fov: kf.fov,
      target: kf.target ?? [0, 10, 0],
    });
    return {
      ...kf,
      position: snap.position,
      rotation: snap.rotation,
      fov: snap.fov,
      target: snap.target,
    };
  });
}

export function deleteCameraKeyframe(keyframes: CameraKeyframe[], frame: number): CameraKeyframe[] {
  return keyframes.filter((kf) => kf.frame !== frame);
}

function cameraKeyframeKey(frame: number): string {
  return String(frame);
}

/** Stack camera keys — incoming wins on the same frame. */
export function mergeCameraKeyframes(
  existing: CameraKeyframe[],
  incoming: CameraKeyframe[]
): CameraKeyframe[] {
  const map = new Map<string, CameraKeyframe>();
  for (const kf of existing) {
    map.set(cameraKeyframeKey(kf.frame), kf);
  }
  for (const kf of incoming) {
    map.set(cameraKeyframeKey(kf.frame), {
      ...kf,
      id: createCameraKeyframeId(),
    });
  }
  return Array.from(map.values()).sort((a, b) => a.frame - b.frame);
}

export function captureCameraSnapshot(
  camera: THREE.PerspectiveCamera,
  orbitTarget?: THREE.Vector3
): CameraSnapshot {
  const target = orbitTarget ?? new THREE.Vector3(0, 10, 0);
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    rotation: [
      camera.rotation.x * RAD2DEG,
      camera.rotation.y * RAD2DEG,
      camera.rotation.z * RAD2DEG,
    ],
    fov: camera.fov,
    target: [target.x, target.y, target.z],
  };
}

function resolveKeyframeTarget(
  kf: CameraKeyframe,
  fallback: [number, number, number]
): [number, number, number] {
  if (kf.target) return [...kf.target];
  return targetFromRotation(kf.position, kf.rotation);
}

function snapshotFromKeyframe(kf: CameraKeyframe, fallback: CameraSnapshot): CameraSnapshot {
  return sanitizeCameraSnapshot({
    position: [...kf.position],
    rotation: [...kf.rotation],
    fov: kf.fov,
    target: resolveKeyframeTarget(kf, fallback.target),
  });
}

export function evaluateCameraAtFrame(
  keyframes: CameraKeyframe[],
  frame: number,
  fallback: CameraSnapshot,
  opts?: {
    constraints?: CameraConstraintId[];
    framing?: FramingModeId;
    minDistance?: number;
    maxDistance?: number;
    viewportFormat?: ViewportFormat;
    subject?: [number, number, number];
    subjectHeight?: number;
  }
): CameraSnapshot {
  const raw = evaluateCinematicCameraAtFrame(keyframes, frame, fallback);
  const sanitized = sanitizeCameraSnapshot(raw, {
    minDistance: opts?.minDistance,
  });
  if (!opts) return sanitized;
  return applyFramingConstraints(sanitized, {
    constraints: opts.constraints ?? ['avoid_ground', 'avoid_collision'],
    framing: opts.framing ?? 'none',
    minDistance: opts.minDistance ?? 4,
    maxDistance: opts.maxDistance ?? 80,
    viewportFormat: opts.viewportFormat,
    subject: opts.subject ?? sanitized.target,
    subjectHeight: opts.subjectHeight,
  });
}

/**
 * Smooth camera transition — never snap with `.copy()` in the render loop.
 */
export function applyCameraSnapshotDamped(
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot,
  goalPosition: THREE.Vector3,
  lookTarget: THREE.Vector3,
  alpha = CAMERA_DAMP_FACTOR
): void {
  if (
    !Number.isFinite(snapshot.position[0]) ||
    !Number.isFinite(snapshot.position[1]) ||
    !Number.isFinite(snapshot.position[2])
  ) {
    return;
  }

  goalPosition.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
  lookTarget.set(snapshot.target[0], snapshot.target[1], snapshot.target[2]);

  camera.position.lerp(goalPosition, alpha);
  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    THREE.MathUtils.clamp(snapshot.fov, 10, 120),
    alpha
  );
  camera.updateProjectionMatrix();

  if (lookTarget.lengthSq() > 1e-8 && Number.isFinite(lookTarget.x)) {
    camera.lookAt(lookTarget);
    return;
  }

  const rotGoal = new THREE.Euler(
    snapshot.rotation[0] * DEG2RAD,
    snapshot.rotation[1] * DEG2RAD,
    snapshot.rotation[2] * DEG2RAD
  );
  camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, rotGoal.x, alpha);
  camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, rotGoal.y, alpha);
  camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, rotGoal.z, alpha);
}

export function applyCameraSnapshot(
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot
): void {
  if (
    !Number.isFinite(snapshot.position[0]) ||
    !Number.isFinite(snapshot.position[1]) ||
    !Number.isFinite(snapshot.position[2])
  ) {
    return;
  }

  camera.position.set(snapshot.position[0], snapshot.position[1], snapshot.position[2]);
  camera.fov = THREE.MathUtils.clamp(snapshot.fov, 10, 120);
  camera.updateProjectionMatrix();

  const target = new THREE.Vector3(
    snapshot.target[0],
    snapshot.target[1],
    snapshot.target[2]
  );
  if (target.lengthSq() > 1e-8 && Number.isFinite(target.x)) {
    camera.lookAt(target);
    return;
  }

  camera.rotation.set(
    snapshot.rotation[0] * DEG2RAD,
    snapshot.rotation[1] * DEG2RAD,
    snapshot.rotation[2] * DEG2RAD
  );
}

export function isCameraPoseValid(camera: THREE.PerspectiveCamera): boolean {
  return (
    Number.isFinite(camera.position.x) &&
    Number.isFinite(camera.position.y) &&
    Number.isFinite(camera.position.z) &&
    camera.position.length() < 5000
  );
}

export function applyDefaultStageCamera(camera: THREE.PerspectiveCamera): void {
  applyCameraSnapshot(camera, {
    position: [0, 14, 28],
    rotation: [0, 0, 0],
    fov: 45,
    target: [0, 10, 0],
  });
}

export function syncMmdCameraMixerToFrame(
  mixer: THREE.AnimationMixer | undefined,
  frame: number,
  fps: number,
  camera: THREE.PerspectiveCamera,
  cameraTarget: THREE.Object3D
): void {
  const time = frameToTime(frame, fps);
  seekAnimationMixer(mixer, time);
  if (mixer) {
    mixer.update(0);
  }
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.up.applyQuaternion(camera.quaternion);
  camera.lookAt(cameraTarget.position);
}

export function syncOrbitFromCamera(
  camera: THREE.PerspectiveCamera,
  orbitTarget: THREE.Vector3,
  fallbackTarget: THREE.Vector3 = new THREE.Vector3(0, 10, 0)
): void {
  if (!Number.isFinite(camera.position.x)) return;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  if (direction.lengthSq() < 1e-8) {
    orbitTarget.copy(fallbackTarget);
    return;
  }

  const distance = Math.max(5, camera.position.distanceTo(fallbackTarget));
  orbitTarget.copy(camera.position).add(direction.multiplyScalar(distance));

  if (
    !Number.isFinite(orbitTarget.x) ||
    !Number.isFinite(orbitTarget.y) ||
    !Number.isFinite(orbitTarget.z)
  ) {
    orbitTarget.copy(fallbackTarget);
  }
}
