import type { AppState, ViewportFormat } from '../../types';
import type { SavedProjectV1 } from '../../flow/types';
import { inferQualityMode, fxTierFromQualityMode } from './qualityMode';
import type { AnimaStageScene, AnimaStageCameraBlock, CameraPresetId } from './types';

function cameraPresetFromState(appState: AppState, modelCount: number): CameraPresetId {
  if (appState.cameraMode === 'mmd' && appState.hasCameraVmd) return 'follow';
  if (modelCount >= 2) return 'duo';
  if (appState.cameraStudio.orbitPreset === 'face_portrait') return 'close-up';
  return 'orbit';
}

/** Read-only snapshot from engine state — no engine mutation. */
export function serializeScene(
  appState: AppState,
  viewportFormat: ViewportFormat,
  options?: {
    name?: string;
    sourceDemoId?: string | null;
    cameraPreset?: CameraPresetId;
  }
): AnimaStageScene {
  const quality = inferQualityMode(appState);
  const modelCount = appState.models.length;
  const preset = options?.cameraPreset ?? cameraPresetFromState(appState, modelCount);
  const framing: 'single' | 'duo' = modelCount >= 2 ? 'duo' : 'single';

  const camera: AnimaStageCameraBlock = {
    preset,
    mode: appState.cameraMode,
    framing,
    keyframes: appState.cameraKeyframes,
    cameraVmdFileName: appState.cameraVmdFileName,
  };

  return {
    format: 'animastage',
    version: 2,
    name: options?.name ?? `Project ${new Date().toLocaleDateString()}`,
    savedAt: Date.now(),
    sourceDemoId: options?.sourceDemoId ?? null,
    models: appState.models.map((m) => ({
      id: m.id,
      name: m.name,
      modelFileName: m.modelFileName,
      position: [m.positionX, m.positionY, m.positionZ],
      rotation: [0, 0, 0],
      scale: 1,
      keyframes: m.keyframes,
      morphs: { ...m.morphs },
      bones: JSON.parse(JSON.stringify(m.bones)) as AppState['models'][0]['bones'],
      activeTemplateId: m.activeTemplateId ?? null,
    })),
    motions: appState.models.map((m, modelIndex) => ({
      modelId: m.id,
      modelIndex,
      vmd: m.vmdFileNames[m.activeVmdIndex] ?? m.vmdFileNames[0] ?? '',
      vmdFileNames: [...m.vmdFileNames],
      activeVmdIndex: m.activeVmdIndex,
      timeOffset: 0,
    })),
    camera,
    fx: {
      quality: fxTierFromQualityMode(quality),
      bloom: appState.visualFx.bloomEnabled,
      dof: appState.visualFx.dofEnabled,
      visualFx: { ...appState.visualFx },
      rtxModeEnabled: appState.rtxModeEnabled,
    },
    settings: {
      aspect: viewportFormat,
      quality,
      physicsMode: appState.physicsMode,
      characterQuality: appState.characterQuality,
      maxFrames: appState.maxFrames,
      currentFrame: appState.currentFrame,
      mmdLite: { ...appState.mmdLite },
    },
    studio: {
      sceneStudio: appState.sceneStudio
        ? (JSON.parse(JSON.stringify(appState.sceneStudio)) as AppState['sceneStudio'])
        : undefined,
      sceneDirector: appState.sceneDirector
        ? ({
            ...JSON.parse(JSON.stringify(appState.sceneDirector)),
            music: {
              ...(appState.sceneDirector.music ?? {}),
              blobUrl: null,
            },
          } as AppState['sceneDirector'])
        : undefined,
      sceneComposer: JSON.parse(
        JSON.stringify(appState.sceneComposer)
      ) as AppState['sceneComposer'],
      dynamicSky: appState.dynamicSky ? { ...appState.dynamicSky } : undefined,
      sceneBackground: { ...appState.sceneBackground },
      sceneHdr: { ...appState.sceneHdr },
    },
    ...(appState.exportMetadata ? { exportMetadata: appState.exportMetadata } : {}),
  };
}

export function migrateV1ToV2(v1: SavedProjectV1): AnimaStageScene {
  return {
    format: 'animastage',
    version: 2,
    name: v1.name,
    savedAt: v1.savedAt,
    sourceDemoId: null,
    models: v1.models.map((m, i) => ({
      id: `migrated_${i}`,
      name: m.name,
      position: [m.positionX, m.positionY, m.positionZ],
      rotation: [0, 0, 0],
      scale: 1,
      keyframes: m.keyframes,
      morphs: m.morphs,
      bones: m.bones,
      activeTemplateId: m.activeTemplateId,
    })),
    motions: v1.models.map((_m, modelIndex) => ({
      modelId: `migrated_${modelIndex}`,
      modelIndex,
      vmd: '',
      vmdFileNames: [],
      activeVmdIndex: 0,
      timeOffset: 0,
    })),
    camera: {
      preset: v1.models.length >= 2 ? 'duo' : 'orbit',
      mode: v1.cameraMode,
      framing: v1.models.length >= 2 ? 'duo' : 'single',
      keyframes: v1.cameraKeyframes,
      cameraVmdFileName: null,
    },
    fx: {
      quality: 'medium',
      bloom: v1.visualFx.bloomEnabled,
      dof: v1.visualFx.dofEnabled,
      visualFx: { ...v1.visualFx },
      rtxModeEnabled: false,
    },
    settings: {
      aspect: v1.viewportFormat,
      quality: 'balanced',
      physicsMode: v1.physicsMode,
      characterQuality: v1.characterQuality,
      maxFrames: v1.maxFrames,
      currentFrame: v1.currentFrame,
      mmdLite: { ...v1.mmdLite },
    },
  };
}
