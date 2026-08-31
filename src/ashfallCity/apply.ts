import type { AppState, CameraSnapshot } from '../types';
import { DEFAULT_DYNAMIC_SKY } from '../dynamicSky';
import { DEFAULT_ASHFALL_CITY, ASHFALL_SPAWN_POSITION } from './defaults';
import {
  getAshfallCameraSpot,
  getAshfallPhotoSpot,
  getAshfallStudioPreset,
  getAshfallVariant,
} from './catalog';
import type {
  AshfallCameraSpotId,
  AshfallCityState,
  AshfallPhotoSpotId,
  AshfallStudioPresetId,
  AshfallVariantId,
} from './types';

export interface AshfallApplyResult {
  patch: Partial<AppState>;
  cameraSnapshot: CameraSnapshot | null;
  characterPosition: [number, number, number] | null;
  message: string;
}

function mergeAshfall(
  prev: AshfallCityState | undefined,
  patch: Partial<AshfallCityState>
): AshfallCityState {
  return { ...(prev ?? DEFAULT_ASHFALL_CITY), ...patch };
}

/** Enable Ashfall City as the active Environment Asset. */
export function applyAshfallCityEnable(
  appState: AppState,
  opts?: { variantId?: AshfallVariantId; placeCharacters?: boolean }
): AshfallApplyResult {
  const variantId = opts?.variantId ?? appState.ashfallCity?.variantId ?? 'clean';
  const variant = getAshfallVariant(variantId);
  const ashfall = mergeAshfall(appState.ashfallCity, {
    enabled: true,
    variantId,
    activeCameraSpotId: 'central_plaza',
    activePhotoSpotId: null,
  });

  const dyn = {
    ...(appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY),
    ...(variant.patches.dynamicSky ?? {}),
    enabled: true,
  };

  const models =
    opts?.placeCharacters === false
      ? appState.models
      : appState.models.map((m) =>
          m.assetKind === 'stage' || m.assetKind === 'prop'
            ? m
            : {
                ...m,
                positionX: ASHFALL_SPAWN_POSITION[0],
                positionY: ASHFALL_SPAWN_POSITION[1],
                positionZ: ASHFALL_SPAWN_POSITION[2],
              }
        );

  return {
    patch: {
      ashfallCity: ashfall,
      visualFx: { ...appState.visualFx, ...(variant.patches.visualFx ?? {}) },
      dynamicSky: dyn,
      sceneComposer: {
        ...appState.sceneComposer,
        ...(variant.patches.sceneComposer ?? {}),
        lights: {
          ...appState.sceneComposer.lights,
          ...(variant.patches.sceneComposer?.lights ?? {}),
        },
      },
      models,
    },
    cameraSnapshot: getAshfallCameraSpot('central_plaza')?.snapshot ?? null,
    characterPosition: ASHFALL_SPAWN_POSITION,
    message: variant.patches.message ?? 'Ashfall City enabled',
  };
}

export function applyAshfallCityDisable(appState: AppState): AshfallApplyResult {
  return {
    patch: {
      ashfallCity: mergeAshfall(appState.ashfallCity, {
        enabled: false,
        activeCameraSpotId: null,
        activePhotoSpotId: null,
      }),
    },
    cameraSnapshot: null,
    characterPosition: null,
    message: 'Ashfall City disabled',
  };
}

export function applyAshfallVariant(
  appState: AppState,
  variantId: AshfallVariantId
): AshfallApplyResult {
  const variant = getAshfallVariant(variantId);
  const dyn = {
    ...(appState.dynamicSky ?? DEFAULT_DYNAMIC_SKY),
    ...(variant.patches.dynamicSky ?? {}),
    enabled: true,
  };
  return {
    patch: {
      ashfallCity: mergeAshfall(appState.ashfallCity, {
        enabled: true,
        variantId,
      }),
      visualFx: { ...appState.visualFx, ...(variant.patches.visualFx ?? {}) },
      dynamicSky: dyn,
      sceneComposer: {
        ...appState.sceneComposer,
        ...(variant.patches.sceneComposer ?? {}),
        lights: {
          ...appState.sceneComposer.lights,
          ...(variant.patches.sceneComposer?.lights ?? {}),
        },
      },
    },
    cameraSnapshot: null,
    characterPosition: null,
    message: variant.patches.message ?? `Ashfall · ${variant.label}`,
  };
}

export function applyAshfallCameraSpot(
  appState: AppState,
  spotId: AshfallCameraSpotId
): AshfallApplyResult {
  const spot = getAshfallCameraSpot(spotId);
  return {
    patch: {
      ashfallCity: mergeAshfall(appState.ashfallCity, {
        enabled: true,
        activeCameraSpotId: spotId,
        activePhotoSpotId: null,
      }),
    },
    cameraSnapshot: spot?.snapshot ?? null,
    characterPosition: null,
    message: spot ? `Camera · ${spot.label}` : 'Camera spot',
  };
}

export function applyAshfallPhotoSpot(
  appState: AppState,
  spotId: AshfallPhotoSpotId
): AshfallApplyResult {
  const spot = getAshfallPhotoSpot(spotId);
  const models = spot
    ? appState.models.map((m) =>
        m.assetKind === 'stage' || m.assetKind === 'prop'
          ? m
          : m.id === appState.selectedObjectId || !appState.selectedObjectId
            ? {
                ...m,
                positionX: spot.characterPosition[0],
                positionY: spot.characterPosition[1],
                positionZ: spot.characterPosition[2],
              }
            : m
      )
    : appState.models;

  return {
    patch: {
      ashfallCity: mergeAshfall(appState.ashfallCity, {
        enabled: true,
        activePhotoSpotId: spotId,
      }),
      models,
    },
    cameraSnapshot: spot?.snapshot ?? null,
    characterPosition: spot?.characterPosition ?? null,
    message: spot ? `Photo · ${spot.label}` : 'Photo spot',
  };
}

export function applyAshfallStudioPreset(
  appState: AppState,
  presetId: AshfallStudioPresetId
): AshfallApplyResult {
  const preset = getAshfallStudioPreset(presetId);
  if (!preset) {
    return {
      patch: {},
      cameraSnapshot: null,
      characterPosition: null,
      message: 'Unknown Ashfall studio preset',
    };
  }
  let next = applyAshfallVariant(appState, preset.variantId);
  const mergedState = { ...appState, ...next.patch } as AppState;
  const cam = applyAshfallCameraSpot(mergedState, preset.cameraSpotId);
  next = {
    patch: { ...next.patch, ...cam.patch },
    cameraSnapshot: cam.cameraSnapshot,
    characterPosition: next.characterPosition,
    message: `${preset.label} · Ashfall City`,
  };
  if (preset.photoSpotId) {
    const withCam = { ...mergedState, ...next.patch } as AppState;
    const photo = applyAshfallPhotoSpot(withCam, preset.photoSpotId);
    next = {
      patch: { ...next.patch, ...photo.patch },
      cameraSnapshot: photo.cameraSnapshot ?? next.cameraSnapshot,
      characterPosition: photo.characterPosition,
      message: `${preset.label} · Ashfall City`,
    };
  }
  return next;
}
