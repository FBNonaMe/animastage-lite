import { orbitCameraSnapshot } from '../templates/animationTemplates';
import { DEFAULT_VISUAL_FX } from '../visualFx/visualFxPresets';
import type { AppState, CameraKeyframe, VisualFxSettings } from '../types';
import { expressionToMorphs, pickSmartExpression } from './expressions';
import { fpsTargetForTier, qualityLabelForTier } from './qualityEngine';
import type {
  SceneProfile,
  SmartBackgroundId,
  SmartCameraPreset,
  SmartPhotoPreset,
  SmartStudioMode,
  SmartStudioPatch,
  SmartStudioReport,
  SmartVideoPath,
  SmartVideoPreset,
} from './types';

function pickBackground(profile: SceneProfile): SmartBackgroundId {
  if (profile.formatHint === 'mixamo' || profile.formatHint === 'vrm') return 'cyberpunk';
  if (profile.stageSize === 'duo' || profile.stageSize === 'group') return 'studio';
  if (profile.characterHeightHint === 'tall') return 'temple';
  const pool: SmartBackgroundId[] = ['studio', 'sunset', 'night', 'white_studio'];
  return pool[profile.modelCount % pool.length]!;
}

function backgroundToScenePreset(bg: SmartBackgroundId): VisualFxSettings['scenePreset'] {
  switch (bg) {
    case 'temple':
      return 'outdoor';
    case 'cyberpunk':
      return 'cyber';
    case 'night':
      return 'nightclub';
    case 'sunset':
      return 'sunset';
    case 'white_studio':
    case 'transparent':
    case 'studio':
    default:
      return 'studio';
  }
}

function backgroundToLightPreset(bg: SmartBackgroundId): VisualFxSettings['lightPreset'] {
  switch (bg) {
    case 'night':
    case 'cyberpunk':
      return 'neon';
    case 'sunset':
      return 'concert';
    case 'temple':
      return 'natural';
    default:
      return 'rim';
  }
}

function pickCameraPreset(mode: SmartStudioMode, profile: SceneProfile): SmartCameraPreset {
  if (mode === 'photo') return profile.stageSize === 'solo' ? 'portrait' : 'full_body';
  if (mode === 'video') return profile.hasAnimation ? 'dynamic' : 'orbit';
  if (profile.stageSize !== 'solo') return 'full_body';
  return profile.hasAnimation ? 'hero' : 'orbit';
}

function cameraPresetToSnapshot(
  preset: SmartCameraPreset,
  profile: SceneProfile
): ReturnType<typeof orbitCameraSnapshot> {
  const tall = profile.characterHeightHint === 'tall';
  const short = profile.characterHeightHint === 'short';
  const duo = profile.stageSize !== 'solo';

  switch (preset) {
    case 'close_face':
      return orbitCameraSnapshot(duo ? 14 : 10, 8, 6, 38);
    case 'portrait':
    case 'anime':
      return orbitCameraSnapshot(duo ? 18 : 14, 12, 4, 40);
    case 'half_body':
      return orbitCameraSnapshot(duo ? 22 : 18, 18, 2, 42);
    case 'hero':
      return orbitCameraSnapshot(duo ? 28 : 22, 25, 8, 44);
    case 'full_body':
      return orbitCameraSnapshot(duo ? 36 : 28, 0, 2, 46);
    case 'dynamic':
      return orbitCameraSnapshot(duo ? 30 : 24, 35, 5, 44);
    case 'orbit':
    default:
      return orbitCameraSnapshot(duo ? 32 : 24, tall ? 20 : short ? 10 : 15, 3, 44);
  }
}

function fxForTier(
  mode: SmartStudioMode,
  profile: SceneProfile,
  bg: SmartBackgroundId
): VisualFxSettings {
  const tier = profile.gpuTier;
  const heavy = tier === 'ultra' || tier === 'high';
  const light = tier === 'performance' || tier === 'balanced';

  const base: VisualFxSettings = {
    ...DEFAULT_VISUAL_FX,
    scenePreset: backgroundToScenePreset(bg),
    lightPreset: backgroundToLightPreset(bg),
    postFxStackEnabled: true,
    smaaEnabled: true,
    environmentIntensity: bg === 'night' ? 0.55 : 0.85,
    floorReflection: light ? 0.4 : 0.72,
  };

  if (mode === 'photo') {
    return {
      ...base,
      bloomEnabled: true,
      bloomIntensity: heavy ? 0.5 : 0.35,
      dofEnabled: !light,
      dofFocusDistance: 0.018,
      dofBokehScale: heavy ? 2.8 : 2.0,
      vignetteEnabled: true,
      vignetteIntensity: 0.35,
      ssaoEnabled: heavy,
      ssaoIntensity: 1.1,
      colorGrade: 'cinematic',
      toneExposure: 1.05,
    };
  }

  if (mode === 'video') {
    return {
      ...base,
      bloomEnabled: !light,
      bloomIntensity: 0.32,
      dofEnabled: false,
      vignetteEnabled: true,
      vignetteIntensity: 0.22,
      ssaoEnabled: false,
      colorGrade: 'cinematic',
      toneExposure: 1,
    };
  }

  // showcase
  return {
    ...base,
    bloomEnabled: true,
    bloomIntensity: light ? 0.28 : 0.4,
    dofEnabled: false,
    vignetteEnabled: true,
    vignetteIntensity: 0.28,
    ssaoEnabled: heavy,
    ssaoHalfRes: true,
    colorGrade: 'anime',
    toneExposure: 1.02,
  };
}

function qualityForMode(
  mode: SmartStudioMode,
  profile: SceneProfile
): AppState['characterQuality'] {
  if (mode === 'photo') {
    return profile.gpuTier === 'ultra' ? 'uhd4k' : 'hd';
  }
  if (mode === 'video') {
    return profile.gpuTier === 'performance' ? 'standard' : 'hd';
  }
  return profile.gpuTier === 'performance' ? 'standard' : 'hd';
}

function buildOrbitKeyframes(path: SmartVideoPath, maxFrames: number): CameraKeyframe[] {
  const frames = Math.max(60, maxFrames);
  const keys: CameraKeyframe[] = [];
  const steps = 8;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const frame = Math.round(t * (frames - 1));
    let yaw = 0;
    let pitch = 3;
    let distance = 24;
    let fov = 44;

    switch (path) {
      case 'face_reveal':
        distance = 28 - t * 14;
        yaw = 40 - t * 35;
        pitch = 8 - t * 4;
        fov = 42;
        break;
      case 'vertical_lift':
        distance = 22;
        yaw = 10;
        pitch = -5 + t * 18;
        break;
      case 'slow_dolly':
        distance = 30 - t * 10;
        yaw = 5;
        break;
      case 'circle_shot':
      case 'orbit_360':
      case 'hero_orbit':
        yaw = t * 360;
        distance = path === 'orbit_360' ? 26 : 24;
        break;
      case 'shoulder':
        distance = 12;
        yaw = -25 + t * 10;
        pitch = 4;
        fov = 38;
        break;
      case 'side_tracking':
        yaw = 70;
        distance = 20;
        pitch = 2;
        break;
      case 'anime_intro':
        distance = 32 - t * 16;
        yaw = -30 + t * 40;
        pitch = 12 - t * 8;
        fov = 40;
        break;
      case 'game_trailer':
        yaw = t * 180;
        distance = 28 - Math.sin(t * Math.PI) * 6;
        pitch = 6;
        break;
      default:
        yaw = t * 180;
        break;
    }

    const snap = orbitCameraSnapshot(distance, yaw, pitch, fov);
    keys.push({
      id: `smart_cam_${path}_${frame}`,
      frame,
      position: snap.position,
      rotation: snap.rotation,
      fov: snap.fov,
    });
  }

  return keys;
}

function pickVideoPath(profile: SceneProfile): SmartVideoPath {
  if (!profile.hasAnimation) return 'hero_orbit';
  if (profile.stageSize !== 'solo') return 'orbit_360';
  return 'anime_intro';
}

function videoPresetToFormat(preset: SmartVideoPreset): '16:9' | '9:16' {
  if (
    preset === 'tiktok' ||
    preset === 'youtube_shorts' ||
    preset === 'instagram_reels' ||
    preset === 'portrait'
  ) {
    return '9:16';
  }
  return '16:9';
}

export function buildSmartStudioPatch(
  mode: SmartStudioMode,
  profile: SceneProfile,
  options: {
    cameraPreset?: SmartCameraPreset;
    photoPreset?: SmartPhotoPreset;
    videoPreset?: SmartVideoPreset;
    videoPath?: SmartVideoPath;
    background?: SmartBackgroundId;
    expression?: import('./types').SmartExpressionId;
    expressionSeed?: number;
    maxFrames?: number;
  } = {}
): { patch: SmartStudioPatch; report: SmartStudioReport } {
  const background = options.background ?? pickBackground(profile);
  const cameraPreset = options.cameraPreset ?? pickCameraPreset(mode, profile);
  const expression =
    options.expression ?? pickSmartExpression(options.expressionSeed ?? Date.now());
  const morphs = expressionToMorphs(expression);
  const visualFx = fxForTier(mode, profile, background);
  const characterQuality = qualityForMode(mode, profile);
  const cameraSnapshot = cameraPresetToSnapshot(cameraPreset, profile);

  const modelMorphs: Record<string, AppState['models'][number]['morphs']> = {};
  if (profile.selectedModelId) {
    modelMorphs[profile.selectedModelId] = morphs;
  }

  const videoPath = options.videoPath ?? pickVideoPath(profile);
  const videoPreset = options.videoPreset ?? (mode === 'video' ? 'youtube_shorts' : 'landscape');
  const photoPreset = options.photoPreset ?? 'portrait';
  const maxFrames = options.maxFrames ?? 180;

  let patch: SmartStudioPatch = {
    visualFx,
    characterQuality,
    physicsMode: mode === 'photo' ? 'off' : 'playtime',
    cameraMode: profile.hasCameraVmd && mode === 'video' ? 'mmd' : 'free',
    cameraStudio: {
      autoFocus: true,
      focusTarget:
        cameraPreset === 'close_face' || cameraPreset === 'portrait' ? 'face' : 'body',
      modestAngle: true,
      orbitPreset: mode === 'showcase' ? 'face_portrait' : 'manual',
      liveOrbit: mode === 'showcase',
      orbitSpeed: 0.35,
      manualCameraLock: false,
      backgroundBlur: mode === 'photo' ? 0.4 : 0,
    },
    isPlaying: mode !== 'photo',
    currentFrame: 0,
    rtxModeEnabled: mode === 'photo' && profile.gpuTier === 'ultra',
    modelMorphs,
    applyIdleTemplate: !profile.hasAnimation,
    cameraSnapshot,
    productCameraMode:
      profile.stageSize !== 'solo'
        ? 'duo'
        : mode === 'photo'
          ? 'closeUp'
          : mode === 'showcase'
            ? 'orbit'
            : 'follow',
  };

  if (mode === 'video') {
    patch = {
      ...patch,
      cameraKeyframes: buildOrbitKeyframes(videoPath, maxFrames),
      videoPath,
      videoPreset,
      viewportFormat: videoPresetToFormat(videoPreset),
      isPlaying: true,
    };
  }

  if (mode === 'photo') {
    patch = {
      ...patch,
      photoPreset,
      isPlaying: false,
    };
  }

  const fps = fpsTargetForTier(profile.gpuTier);
  const report: SmartStudioReport = {
    readyAt: Date.now(),
    mode,
    cameraPreset,
    background,
    expression,
    qualityLabel: qualityLabelForTier(profile.gpuTier),
    fpsTarget: fps,
    lines: [
      { label: 'Camera', value: 'Optimized', status: 'ok' },
      { label: 'Lighting', value: 'Optimized', status: 'ok' },
      {
        label: 'Physics',
        value: mode === 'photo' ? 'Frozen' : profile.hasPhysics ? 'Stable' : 'Idle',
        status: 'ok',
      },
      { label: 'Rendering', value: qualityLabelForTier(profile.gpuTier), status: 'ok' },
      { label: 'Composition', value: 'Excellent', status: 'ok' },
      { label: 'Performance', value: `${fps} FPS`, status: 'ok' },
    ],
  };

  return { patch, report };
}
