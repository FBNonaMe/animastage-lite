import * as THREE from 'three';
import type { CameraFramingMode, CameraSnapshot, ViewportFormat } from '../../types';
import { getStageTargetVector } from '../../scene/cameraFraming';
import {
  computeDuoFovBoost,
  getRegisteredCharacterCount,
} from '../../scene/characterHeadRegistry';
import { adjustFramingForViewport } from '../../camera/viewportFraming';

/** Camera offset from focus point (+Z behind subject, MMD stage convention). */
export function buildFollowCameraSnapshotFromFocus(
  focus: THREE.Vector3,
  framing: CameraFramingMode,
  viewportFormat: ViewportFormat = '16:9'
): CameraSnapshot {
  const duo = framing === 'duo' && getRegisteredCharacterCount() >= 2;
  const baseDistance = duo ? 40 : 30;
  const lift = duo ? 2.2 : 1.4;
  const baseFov = duo ? 48 : 42;
  const { distance, fov: adjustedFov } = adjustFramingForViewport(
    baseDistance,
    computeDuoFovBoost(baseFov, framing),
    viewportFormat
  );

  // Aim slightly below face so full body + feet have margin in tall frames.
  const aimY = viewportFormat === '9:16' ? focus.y - 1.6 : focus.y;

  return {
    position: [focus.x, aimY + lift, focus.z + distance],
    rotation: [0, 0, 0],
    fov: adjustedFov,
    target: [focus.x, aimY, focus.z],
  };
}

/**
 * Product-layer framing for Shorts — static snapshot; does not touch VMD or keyframe eval.
 */
export function buildShortCameraSnapshot(
  framing: CameraFramingMode,
  viewportFormat: ViewportFormat = '9:16'
): CameraSnapshot {
  const target = getStageTargetVector(new THREE.Vector3());
  return buildFollowCameraSnapshotFromFocus(target, framing, viewportFormat);
}
