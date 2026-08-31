import type { AppState, ViewportFormat, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import { DEFAULT_CINEMATIC_RENDER } from './defaults';
import { resolveAsrpFrame, mergeVisualFxFromFrame } from '../asrp/v2/resolveFrame';

export interface ExportQualitySnapshot {
  /** Partial state to restore after export. */
  restore: Partial<AppState>;
  /** Patch applied for offline / live export. */
  patch: Partial<AppState>;
  applied: boolean;
}

/**
 * Auto quality bump for video export — uses ASRP V2 resolve (lighter than Cinema max).
 */
export function prepareCinematicExportQuality(
  appState: AppState,
  viewportFormat: ViewportFormat = '16:9'
): ExportQualitySnapshot {
  const cr = appState.cinematicRender ?? DEFAULT_CINEMATIC_RENDER;
  if (!cr.autoExportQuality) {
    return { restore: {}, patch: {}, applied: false };
  }

  const frame = resolveAsrpFrame(appState, viewportFormat, {
    exporting: true,
    cinema: false,
  });
  const fxMerged = mergeVisualFxFromFrame(appState.visualFx, {
    ...frame,
    visualFxOverrides: {
      ...frame.visualFxOverrides,
      bloomEnabled: true,
      ssaoEnabled: true,
      ssaoHalfRes: false,
      smaaEnabled: true,
      postFxStackEnabled: true,
    },
  });

  const restore: Partial<AppState> = {
    visualFx: { ...appState.visualFx },
    sceneComposer: {
      ...appState.sceneComposer,
      lights: { ...appState.sceneComposer.lights },
      effectLevels: { ...appState.sceneComposer.effectLevels },
    },
    characterQuality: appState.characterQuality,
    rtxModeEnabled: appState.rtxModeEnabled,
    rtxSettings: { ...appState.rtxSettings },
    reflectionSystem: appState.reflectionSystem
      ? { ...appState.reflectionSystem }
      : undefined,
    asrp: appState.asrp ? { ...appState.asrp } : undefined,
    cinematicRender: appState.cinematicRender
      ? { ...appState.cinematicRender }
      : undefined,
    cinemaRender: appState.cinemaRender ? { ...appState.cinemaRender } : undefined,
  };

  const fx: VisualFxSettings = {
    ...fxMerged,
    bloomIntensity: Math.min(
      0.36,
      Math.max(appState.visualFx.bloomIntensity ?? 0.28, 0.3)
    ),
    floorReflection: Math.max(appState.visualFx.floorReflection ?? 0.7, 0.82),
    environmentIntensity: Math.min(
      0.95,
      Math.max(appState.visualFx.environmentIntensity ?? 0.7, 0.8)
    ),
    particleIntensity: Math.min(
      1.2,
      (appState.visualFx.particleIntensity ?? 0.5) * 1.35
    ),
    godRaysEnabled: false,
  };

  if (
    appState.visualFx.particlesEnabled ||
    appState.visualFx.weatherPreset === 'rain' ||
    appState.visualFx.weatherPreset === 'snow' ||
    appState.visualFx.weatherPreset === 'storm'
  ) {
    fx.particlesEnabled = true;
  }

  const composer: SceneComposerState = {
    ...appState.sceneComposer,
    // Export must never force Fog on.
    fogEnabled: appState.sceneComposer.fogEnabled,
    fogDensity: appState.sceneComposer.fogDensity,
    fogColor: appState.sceneComposer.fogColor,
    lights: {
      ...appState.sceneComposer.lights,
      sunShadows: true,
      sunIntensity: Math.max(appState.sceneComposer.lights.sunIntensity, 1),
      hemisphereIntensity: Math.max(appState.sceneComposer.lights.hemisphereIntensity, 1.05),
    },
    effectLevels: {
      ...appState.sceneComposer.effectLevels,
      ao: bumpLevel(
        appState.sceneComposer.effectLevels.ao === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.ao
      ),
      reflection: bumpLevel(
        appState.sceneComposer.effectLevels.reflection === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.reflection
      ),
      bloom: bumpLevel(
        appState.sceneComposer.effectLevels.bloom === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.bloom
      ),
      rim: bumpLevel(
        appState.sceneComposer.effectLevels.rim === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.rim
      ),
    },
    envBrightness: Math.max(appState.sceneComposer.envBrightness, 0.8),
  };

  const characterQuality =
    appState.characterQuality === 'standard' ? 'hd' : appState.characterQuality;

  const patch: Partial<AppState> = {
    visualFx: fx,
    sceneComposer: composer,
    characterQuality,
    rtxModeEnabled: true,
    rtxSettings: {
      ...appState.rtxSettings,
      aoQuality:
        appState.rtxSettings.aoQuality === 'performance' ||
        appState.rtxSettings.aoQuality === 'low'
          ? 'high'
          : appState.rtxSettings.aoQuality === 'medium'
            ? 'high'
            : appState.rtxSettings.aoQuality,
      halfResAo: false,
      aoIntensity: Math.max(appState.rtxSettings.aoIntensity, 2.6),
      rtxBloomStrength: Math.max(appState.rtxSettings.rtxBloomStrength, 0.16),
    },
    reflectionSystem: {
      ...(appState.reflectionSystem ?? {
        enabled: true,
        boxProjection: true,
        contactHardening: true,
        resolution: 'auto' as const,
        refreshRate: 2.5,
        intensity: 1,
        roughnessInfluence: 1,
        boxVolume: null,
        characterReflections: true,
        environmentReflections: true,
        exportBoost: true,
      }),
      ...frame.reflectionOverrides,
      enabled: true,
      boxProjection: true,
      exportBoost: true,
    },
    asrp: {
      ...(appState.asrp ?? {
        enabled: true,
        pipeline: 'asrp' as const,
        depthStrength: 1,
        silhouetteWidth: 1,
        quality: 'auto' as const,
        samples: 'auto' as const,
        distanceFade: 1,
        heightScale: 1,
        normalBlend: 1,
        parallaxScale: 1,
        shadowInfluence: 0.65,
        reflectionInfluence: 1,
        autoHeightApprox: true,
        animePreserve: true,
        exportBoost: true,
      }),
      ...frame.asrpOverrides,
      enabled: true,
      exportBoost: true,
    },
  };

  return { restore, patch, applied: true };
}

function bumpLevel(
  level: SceneComposerState['effectLevels'][keyof SceneComposerState['effectLevels']]
): SceneComposerState['effectLevels'][keyof SceneComposerState['effectLevels']] {
  if (level === 'off') return 'low';
  if (level === 'low') return 'medium';
  if (level === 'medium') return 'high';
  return level;
}
