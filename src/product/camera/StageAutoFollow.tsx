import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { CameraFramingMode, CameraMode, ViewportFormat } from '../../types';
import {
  applyCameraSnapshot,
  applyCameraSnapshotDamped,
  isCameraPoseValid,
} from '../../components/CameraLogic';
import { resolveHeadTargetForCamera } from '../../scene/characterHeadRegistry';
import { buildFollowCameraSnapshotFromFocus, buildShortCameraSnapshot } from './frameShortCamera';
import { isRecordingCapture } from '../../video/recordingCapture';

const FOLLOW_ALPHA_PLAYBACK = 0.22;

interface StageAutoFollowProps {
  enabled: boolean;
  cameraMode: CameraMode;
  framing: CameraFramingMode;
  followModelId: string | null;
  viewportFormat?: ViewportFormat;
}

/**
 * Smooth stage framing in free mode (1 or 2 characters).
 * During MP4 capture the live framing is frozen — re-snapping every export
 * frame was wiping the user's orbit / MY CAM composition.
 */
export default function StageAutoFollow({
  enabled,
  cameraMode,
  framing,
  followModelId,
  viewportFormat = '16:9',
}: StageAutoFollowProps) {
  const { camera, controls } = useThree();
  const goalPosition = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());
  const fallback = useRef(new THREE.Vector3(0, 10, 0));
  const focusScratch = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!enabled || cameraMode !== 'free') return;
    // Keep the pre-export camera — don't auto-reframe while encoding.
    if (isRecordingCapture()) return;

    const cam = camera as THREE.PerspectiveCamera;
    if (!(cam instanceof THREE.PerspectiveCamera)) return;

    const focus = focusScratch.current;
    const hasTarget = resolveHeadTargetForCamera(
      followModelId,
      framing,
      fallback.current,
      focus
    );

    const snapshot = hasTarget
      ? buildFollowCameraSnapshotFromFocus(focus, framing, viewportFormat)
      : buildShortCameraSnapshot(framing, viewportFormat);

    const alpha = FOLLOW_ALPHA_PLAYBACK;

    if (alpha >= 1) {
      applyCameraSnapshot(cam, snapshot);
      goalPosition.current.set(
        snapshot.position[0],
        snapshot.position[1],
        snapshot.position[2]
      );
      goalTarget.current.set(snapshot.target[0], snapshot.target[1], snapshot.target[2]);
    } else {
      applyCameraSnapshotDamped(
        cam,
        snapshot,
        goalPosition.current,
        goalTarget.current,
        alpha
      );
    }

    const orbit = controls as OrbitControlsImpl | null;
    if (orbit?.target) {
      orbit.target.lerp(goalTarget.current, alpha);
      orbit.update();
    }

    if (!isCameraPoseValid(cam)) {
      const safe = buildShortCameraSnapshot(framing, viewportFormat);
      applyCameraSnapshot(cam, safe);
      goalPosition.current.set(safe.position[0], safe.position[1], safe.position[2]);
      goalTarget.current.set(safe.target[0], safe.target[1], safe.target[2]);
    }
  });

  return null;
}
