// JointLimitSolver.js — ported from MMD_modoki-main/src/editor/smart-pose/quaternion-limits.ts
// Quaternion-safe joint limits: no Euler round-trips, no gimbal artifacts.
//   clampQuaternionAngle  — cap the total rotation angle
//   decomposeSwingTwist   — split a rotation into swing + twist about an axis
//   clampSwingTwist       — clamp swing and twist independently
//   solveLimitedLookAtDelta — look-at delta clamped by yaw/pitch cones,
//                             stable even for targets straight behind
// The old file was a stub returning { affected: [] }.

import * as THREE from "../vendor/three/build/three.module.js";

const EPSILON = 1e-8;

function shortestQuaternion(value) {
  const result = value.clone().normalize();
  if (result.w < 0) {
    result.set(-result.x, -result.y, -result.z, -result.w);
  }
  return result;
}

export function clampQuaternionAngle(value, maxAngleRad) {
  const normalized = shortestQuaternion(value);
  const limit = Math.max(0, Number.isFinite(maxAngleRad) ? maxAngleRad : 0);
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, normalized.w)));
  if (angle <= limit || angle < EPSILON) return normalized;
  return new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(), normalized, limit / angle,
  ).normalize();
}

export function decomposeSwingTwist(value, twistAxis) {
  const axis = twistAxis.lengthSq() > EPSILON
    ? twistAxis.clone().normalize()
    : new THREE.Vector3(0, 1, 0);
  const vector = new THREE.Vector3(value.x, value.y, value.z);
  const projection = axis.clone().multiplyScalar(vector.dot(axis));
  let twist = new THREE.Quaternion(projection.x, projection.y, projection.z, value.w);
  if (twist.lengthSq() < EPSILON) twist = new THREE.Quaternion();
  else twist.normalize();
  // q = swing * twist (twist about the axis applied first)
  const swing = value.clone().multiply(twist.clone().invert()).normalize();
  return { swing, twist };
}

export function clampSwingTwist(value, twistAxis, maxSwingRad, maxTwistRad) {
  const { swing, twist } = decomposeSwingTwist(shortestQuaternion(value), twistAxis);
  return clampQuaternionAngle(swing, maxSwingRad)
    .multiply(clampQuaternionAngle(twist, maxTwistRad))
    .normalize();
}

export function solveLimitedLookAtDelta(currentForward, currentUp, targetDirection, yawLimitRad, pitchLimitRad) {
  if (currentForward.lengthSq() < EPSILON || targetDirection.lengthSq() < EPSILON) {
    return new THREE.Quaternion();
  }
  const forward = currentForward.clone().normalize();
  let up = currentUp.clone().sub(forward.clone().multiplyScalar(currentUp.dot(forward)));
  if (up.lengthSq() < EPSILON) {
    up = Math.abs(forward.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  }
  up.normalize();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const direction = targetDirection.clone().normalize();
  const localX = direction.dot(right);
  const localY = direction.dot(up);
  const localZ = direction.dot(forward);
  const yaw = Math.max(-Math.abs(yawLimitRad), Math.min(Math.abs(yawLimitRad), Math.atan2(localX, localZ)));
  const pitch = Math.max(
    -Math.abs(pitchLimitRad),
    Math.min(Math.abs(pitchLimitRad), Math.atan2(localY, Math.hypot(localX, localZ))),
  );
  const horizontal = Math.cos(pitch);
  const limitedDirection = forward.clone().multiplyScalar(Math.cos(yaw) * horizontal)
    .add(right.clone().multiplyScalar(Math.sin(yaw) * horizontal))
    .add(up.clone().multiplyScalar(Math.sin(pitch)))
    .normalize();
  return new THREE.Quaternion().setFromUnitVectors(forward, limitedDirection).normalize();
}

/** Preset-aware wrapper kept API-compatible with the old stub. */
export class JointLimitSolver {
  constructor() {
    this.presetName = "MMD Default";
    this.overrides = new Map(); // boneName -> { twistAxis, maxSwingRad, maxTwistRad }
  }

  setPreset(name) {
    this.presetName = name || "MMD Default";
  }

  setOverride(boneName, limits) {
    if (!boneName) return;
    if (!limits) this.overrides.delete(boneName);
    else this.overrides.set(boneName, limits);
  }

  limitsFor(boneName) {
    return this.overrides.get(boneName) || null;
  }

  /** Clamp a bone's local quaternion in place; returns affected bone names. */
  apply(bone) {
    if (!bone?.quaternion) return { affected: [] };
    const limits = this.limitsFor(bone.name);
    if (!limits) return { affected: [] };
    const axis = limits.twistAxis || new THREE.Vector3(0, 1, 0);
    const clamped = clampSwingTwist(
      bone.quaternion,
      axis,
      Number.isFinite(limits.maxSwingRad) ? limits.maxSwingRad : Math.PI,
      Number.isFinite(limits.maxTwistRad) ? limits.maxTwistRad : Math.PI,
    );
    bone.quaternion.copy(clamped);
    return { affected: [bone.name].filter(Boolean) };
  }
}
