import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CameraFramingMode, CameraMode, ViewportFormat } from '../types';
import { getStageTargetVector } from '../scene/cameraFraming';
import {
  PORTRAIT_DISTANCE_MUL,
  PORTRAIT_FOV_MUL,
} from '../camera/viewportFraming';

/** Full-body portrait defaults — far enough that ~18-unit MMD characters fit with margin. */
const PORTRAIT_TARGET = new THREE.Vector3(0, 9.5, 0);
const PORTRAIT_CAMERA_POS = new THREE.Vector3(0, 11.5, 36);
const PORTRAIT_FOV = 38;
const DUO_PORTRAIT_FOV = 42;

interface PortraitCameraFramingProps {
  format: ViewportFormat;
  cameraMode: CameraMode;
  cameraFraming?: CameraFramingMode;
  modelOffset?: { x: number; y: number; z: number };
  /** When true, StageAutoFollow owns framing — only sync canvas aspect here. */
  autoFocusEnabled?: boolean;
  directPlacement?: boolean;
}

/** Syncs perspective aspect to canvas size and pulls camera back for vertical portrait. */
export default function PortraitCameraFraming({
  format,
  cameraMode,
  cameraFraming = 'single',
  modelOffset = { x: 0, y: 0, z: 0 },
  autoFocusEnabled = false,
  directPlacement = false,
}: PortraitCameraFramingProps) {
  const { camera, size, controls } = useThree();
  const appliedPortraitRef = useRef(false);
  const prevFormatRef = useRef<ViewportFormat>(format);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;

    const nextAspect = size.width / Math.max(size.height, 1);
    if (Math.abs(cam.aspect - nextAspect) > 1e-4) {
      cam.aspect = nextAspect;
      cam.updateProjectionMatrix();
    }
  });

  // When switching into 9:16, always pull existing free-camera framing farther
  // so the character does not suddenly fill the tall frame.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;

    const prev = prevFormatRef.current;
    prevFormatRef.current = format;

    if (format === '9:16' && prev !== '9:16' && cameraMode === 'free') {
      const orbit = controls as { target?: THREE.Vector3; update?: () => void } | null;
      const target = orbit?.target?.clone() ?? PORTRAIT_TARGET.clone();
      const offset = cam.position.clone().sub(target);
      const dist = offset.length();
      if (dist > 0.01) {
        const nextDist = Math.max(28, dist * PORTRAIT_DISTANCE_MUL);
        offset.multiplyScalar(nextDist / dist);
        cam.position.copy(target).add(offset);
      } else {
        cam.position.set(target.x, target.y + 2, target.z + 36);
      }
      cam.fov = Math.min(48, Math.max(34, cam.fov * PORTRAIT_FOV_MUL));
      cam.lookAt(target);
      cam.updateProjectionMatrix();
      if (orbit?.target) {
        orbit.target.copy(target);
        orbit.update?.();
      }
      appliedPortraitRef.current = true;
      return;
    }

    if (format !== '9:16') {
      appliedPortraitRef.current = false;
    }
  }, [camera, controls, format, cameraMode]);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;

    if (format !== '9:16') {
      appliedPortraitRef.current = false;
      return;
    }

    // Auto-follow / continuous direct placement: format switch already pulled back above.
    if (autoFocusEnabled || directPlacement) {
      return;
    }

    if (cameraMode !== 'free' || appliedPortraitRef.current) return;

    const stageCenter =
      cameraFraming === 'duo'
        ? getStageTargetVector(new THREE.Vector3())
        : PORTRAIT_TARGET.clone().add(
            new THREE.Vector3(modelOffset.x, modelOffset.y, modelOffset.z)
          );

    const position = PORTRAIT_CAMERA_POS.clone();
    if (cameraFraming === 'duo') {
      position.x = stageCenter.x;
      position.z = stageCenter.z + 44;
      position.y = stageCenter.y + 2.2;
    } else {
      position.add(new THREE.Vector3(modelOffset.x, modelOffset.y * 0.5, modelOffset.z));
    }

    cam.position.copy(position);
    cam.fov = cameraFraming === 'duo' ? DUO_PORTRAIT_FOV : PORTRAIT_FOV;
    cam.lookAt(stageCenter);
    cam.updateProjectionMatrix();

    const orbit = controls as { target?: THREE.Vector3; update?: () => void } | null;
    if (orbit?.target) {
      orbit.target.copy(stageCenter);
      orbit.update?.();
    }

    appliedPortraitRef.current = true;
  }, [
    camera,
    controls,
    format,
    cameraMode,
    cameraFraming,
    modelOffset.x,
    modelOffset.y,
    modelOffset.z,
    autoFocusEnabled,
    directPlacement,
  ]);

  useEffect(() => {
    if (format === '16:9') {
      appliedPortraitRef.current = false;
    }
  }, [format, modelOffset.x, modelOffset.y, modelOffset.z]);

  return null;
}
