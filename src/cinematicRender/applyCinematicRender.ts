import type { AppState, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import type { RtxSettings } from '../utils/rtxSettings';
import { DEFAULT_CINEMATIC_RENDER, colorTempToHex } from './defaults';
import { getCinematicQualityPreset } from './qualityPresets';
import { getCinematicSunTime } from './sunSystem';
import { getCinematicRenderStyle } from './renderStyles';
import { getCinematicWeatherPatch } from './weatherEnhance';
import type {
  CinematicComposerPatch,
  CinematicQualityPresetId,
  CinematicRenderLookPatch,
  CinematicRenderState,
  CinematicRenderStyleId,
  CinematicSunTimeId,
} from './types';
import type { WeatherPresetId } from '../types';
import { aliasLegacyStyleId, applyAsrpVisualStyle } from '../asrp/v2';

export function mergeLookPatch(
  into: CinematicRenderLookPatch,
  add: CinematicRenderLookPatch
): CinematicRenderLookPatch {
  const sceneComposer: CinematicComposerPatch | undefined =
    into.sceneComposer || add.sceneComposer
      ? {
          ...into.sceneComposer,
          ...add.sceneComposer,
          lights: {
            ...into.sceneComposer?.lights,
            ...add.sceneComposer?.lights,
          },
          effectLevels: {
            ...into.sceneComposer?.effectLevels,
            ...add.sceneComposer?.effectLevels,
          },
        }
      : undefined;

  return {
    visualFx: { ...into.visualFx, ...add.visualFx },
    sceneComposer,
    rtxModeEnabled: add.rtxModeEnabled ?? into.rtxModeEnabled,
    rtxSettings: { ...into.rtxSettings, ...add.rtxSettings },
    characterQuality: add.characterQuality ?? into.characterQuality,
    qualityMode: add.qualityMode ?? into.qualityMode,
  };
}

/** Build a full look from cinematic render state (quality + sun + weather + style). */
export function buildCinematicLook(state: CinematicRenderState): CinematicRenderLookPatch {
  const quality = getCinematicQualityPreset(state.qualityPreset);
  const sun = getCinematicSunTime(state.sunTime);
  const style = getCinematicRenderStyle(state.renderStyle);
  const weather = getCinematicWeatherPatch(state.weather);

  let look: CinematicRenderLookPatch = { visualFx: {} };
  if (quality) look = mergeLookPatch(look, quality.patch);
  if (style) look = mergeLookPatch(look, style.patch);
  if (sun) {
    look = mergeLookPatch(look, sun.patch);
    const sunColor =
      Math.abs(state.sunColorTempK - sun.colorTempK) > 80
        ? colorTempToHex(state.sunColorTempK)
        : sun.sunColor;
    look = mergeLookPatch(look, {
      visualFx: {},
      sceneComposer: {
        lights: {
          sunEnabled: true,
          sunAzimuth: sun.azimuth,
          sunElevation: sun.elevation,
          sunColor,
          sunIntensity: sun.intensity * state.sunIntensity,
          sunShadows: true,
          ambientEnabled: true,
          ambientColor: sun.ambientColor,
          ambientIntensity: sun.ambientIntensity,
          hemisphereEnabled: true,
          hemisphereIntensity: state.atmosphericScattering ? 1.15 : 1,
        },
        skyPreset: sun.skyPreset,
      },
    });
  }
  look = mergeLookPatch(look, weather);

  if (state.lightShafts) {
    look = mergeLookPatch(look, {
      visualFx: {
        godRaysEnabled: true,
        godRaysDensity: Math.max(look.visualFx.godRaysDensity ?? 0.55, 0.55),
        bloomEnabled: true,
      },
    });
  } else if (state.qualityPreset === 'safe') {
    look = mergeLookPatch(look, { visualFx: { godRaysEnabled: false } });
  }

  if (state.volumetricFog) {
    look = mergeLookPatch(look, {
      sceneComposer: {
        fogEnabled: true,
        fogDensity: Math.max(look.sceneComposer?.fogDensity ?? 0.25, 0.22),
      },
    });
  }

  if (!state.softShadows) {
    look = mergeLookPatch(look, {
      sceneComposer: {
        lights: { sunShadows: state.qualityPreset !== 'safe' },
      },
    });
  }

  return look;
}

export function applyLookToAppState(
  prev: AppState,
  look: CinematicRenderLookPatch,
  cinematicRender: CinematicRenderState
): Partial<AppState> {
  const nextComposer: SceneComposerState = {
    ...prev.sceneComposer,
    ...look.sceneComposer,
    lights: {
      ...prev.sceneComposer.lights,
      ...look.sceneComposer?.lights,
    },
    effectLevels: {
      ...prev.sceneComposer.effectLevels,
      ...look.sceneComposer?.effectLevels,
    },
  };

  const nextRtx: RtxSettings = {
    ...prev.rtxSettings,
    ...look.rtxSettings,
  };

  return {
    cinematicRender,
    visualFx: { ...prev.visualFx, ...look.visualFx } as VisualFxSettings,
    sceneComposer: nextComposer,
    rtxModeEnabled: look.rtxModeEnabled ?? prev.rtxModeEnabled,
    rtxSettings: nextRtx,
    characterQuality: look.characterQuality ?? prev.characterQuality,
  };
}

export function applyCinematicQuality(
  prev: AppState,
  id: CinematicQualityPresetId
): Partial<AppState> {
  const preset = getCinematicQualityPreset(id);
  if (!preset) return {};
  const nextState: CinematicRenderState = {
    ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
    qualityPreset: id,
    enabled: true,
    ...preset.statePatch,
  };
  const look = buildCinematicLook(nextState);
  return applyLookToAppState(prev, look, nextState);
}

export function applyCinematicSunTime(
  prev: AppState,
  id: CinematicSunTimeId
): Partial<AppState> {
  const sun = getCinematicSunTime(id);
  if (!sun) return {};
  const nextState: CinematicRenderState = {
    ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
    sunTime: id,
    sunColorTempK: sun.colorTempK,
    sunIntensity: 1,
    enabled: true,
  };
  const look = buildCinematicLook(nextState);
  return applyLookToAppState(prev, look, nextState);
}

export function applyCinematicWeather(
  prev: AppState,
  id: WeatherPresetId
): Partial<AppState> {
  const nextState: CinematicRenderState = {
    ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
    weather: id,
    enabled: true,
  };
  const look = buildCinematicLook(nextState);
  return applyLookToAppState(prev, look, nextState);
}

export function applyCinematicRenderStyle(
  prev: AppState,
  id: CinematicRenderStyleId
): Partial<AppState> {
  const nextState: CinematicRenderState = {
    ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
    renderStyle: id,
    enabled: true,
  };
  const look = buildCinematicLook(nextState);
  const base = applyLookToAppState(prev, look, nextState);
  // Alias into ASRP V2 Visual Styles (SSOT for shading/fog/bloom budgets).
  const asrpStyle = applyAsrpVisualStyle(
    { ...prev, ...base } as AppState,
    aliasLegacyStyleId(id)
  );
  return {
    ...base,
    ...asrpStyle,
    visualFx: { ...base.visualFx, ...asrpStyle.visualFx },
    sceneComposer: {
      ...base.sceneComposer!,
      ...asrpStyle.sceneComposer,
      lights: {
        ...base.sceneComposer?.lights,
        ...asrpStyle.sceneComposer?.lights,
      },
      effectLevels: {
        ...base.sceneComposer?.effectLevels,
        ...asrpStyle.sceneComposer?.effectLevels,
      },
    },
    cinematicRender: {
      ...(base.cinematicRender as CinematicRenderState),
      renderStyle: id,
    },
  };
}

export function patchCinematicRenderState(
  prev: AppState,
  patch: Partial<CinematicRenderState>,
  rebuild = true
): Partial<AppState> {
  const nextState: CinematicRenderState = {
    ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
    ...patch,
  };
  if (!rebuild) return { cinematicRender: nextState };
  const look = buildCinematicLook(nextState);
  return applyLookToAppState(prev, look, nextState);
}

export function reapplyCinematicRender(prev: AppState): Partial<AppState> {
  const state = prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER;
  if (!state.enabled) return { cinematicRender: state };
  return applyLookToAppState(prev, buildCinematicLook(state), state);
}
