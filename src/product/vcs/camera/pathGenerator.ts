import { generateCinematicCameraPath } from '../../cinematic/camera/pathGenerator';
import { applyCompositionOffset } from '../../cinematic/camera/collision';
import { constrainToSafeVolume, resolveFocusPoint } from './safeVolume';
import { getDirectorRules, resolveCinematicMode } from './directorModes';
import type { VcsKeyframe, VcsPathInput } from '../types';
import { orbitCameraSnapshot } from '../../../templates/animationTemplates';
import { getStageTargetTuple } from '../../../scene/cameraFraming';
import { computeSmartCameraDistance, computeSmartFov } from '../../cinematic/camera/smartFraming';

/** Generate procedural camera path using director rules + character profile. */
export function generateVcsCameraPath(input: VcsPathInput): VcsKeyframe[] {
  const rules = getDirectorRules(input.mode);
  const cinematicMode = resolveCinematicMode(input.mode);
  const motionIntensity = input.motionSpeed ?? rules.motionIntensity;

  const profile = input.profile;
  const stageTarget = profile
    ? resolveFocusPoint(profile, rules.focusTarget, input.stageTarget ?? getStageTargetTuple())
    : (input.stageTarget ?? getStageTargetTuple());

  let keyframes = generateCinematicCameraPath({
    mode: cinematicMode,
    maxFrames: input.maxFrames,
    modelCount: input.modelCount,
    viewportFormat: input.viewportFormat,
    motionIntensity,
    stageTarget,
  });

  if (rules.preferPortraitFraming && input.viewportFormat === '9:16') {
    keyframes = keyframes.map((kf) => {
      const snap = {
        position: kf.position,
        rotation: kf.rotation,
        fov: kf.fov * rules.fovBias,
        target: kf.target ?? stageTarget,
      };
      const composed = applyCompositionOffset(snap, '9:16');
      return { ...kf, ...composed, target: composed.target };
    });
  }

  if (profile) {
    const minDist = profile.safeCameraRadius;
    keyframes = keyframes.map((kf) => {
      const snap = {
        position: kf.position,
        rotation: kf.rotation,
        fov: kf.fov,
        target: kf.target ?? stageTarget,
      };
      const distMul = computeSmartCameraDistance({
        modelCount: input.modelCount,
        motionIntensity,
        viewportFormat: input.viewportFormat,
        mode: rules.distanceMode,
        accessoriesScale: 1 + profile.accessoryRadius * 0.1,
      });
      const baseFov = computeSmartFov(distMul, rules.distanceMode, input.viewportFormat);
      const adjusted = orbitCameraSnapshot(
        distMul,
        Math.atan2(snap.position[0] - stageTarget[0], snap.position[2] - stageTarget[2]) *
          (180 / Math.PI),
        Math.asin(
          Math.max(-1, Math.min(1, (snap.position[1] - stageTarget[1]) / Math.max(distMul, 1)))
        ) *
          (180 / Math.PI),
        baseFov * rules.fovBias,
        stageTarget
      );
      const safe = constrainToSafeVolume(adjusted, profile);
      return {
        ...kf,
        position: safe.snapshot.position,
        rotation: safe.snapshot.rotation,
        fov: safe.snapshot.fov,
        target: safe.snapshot.target,
      };
    });
    void minDist;
  }

  return keyframes;
}
