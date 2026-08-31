/**
 * Apply an ASRP Visual Style into AppState (SSOT for look presets).
 */
import type { AppState } from '../../types';
import { DEFAULT_ASRP } from '../defaults';
import { pipelineToRenderFlags } from '../pipelineMap';
import { getAsrpVisualStyle, type AsrpVisualStyleId } from './visualStyles';
import { DEFAULT_CINEMATIC_RENDER } from '../../cinematicRender/defaults';
import type { ComposerVisualStyleId } from '../../sceneComposer/types';
import type { CinematicRenderStyleId } from '../../cinematicRender/types';

function toComposerStyle(id: AsrpVisualStyleId): ComposerVisualStyleId {
  switch (id) {
    case 'anime_soft':
      return 'soft_anime';
    case 'anime_bright':
    case 'anime_cinematic':
      return 'anime';
    case 'cyberpunk':
      return 'cyberpunk';
    case 'studio':
      return 'studio';
    case 'realistic':
      return 'realistic';
    case 'stylized':
      return 'comic';
    default:
      return 'anime';
  }
}

function toCinematicRenderStyle(id: AsrpVisualStyleId): CinematicRenderStyleId {
  switch (id) {
    case 'anime_soft':
      return 'anime';
    case 'anime_bright':
      return 'anime_ultra';
    case 'anime_cinematic':
      return 'cinematic';
    case 'realistic':
      return 'realistic_anime';
    case 'cyberpunk':
      return 'cyberpunk';
    case 'studio':
      return 'studio';
    case 'warm_sunset':
      return 'movie';
    case 'night':
      return 'cinematic';
    case 'dramatic':
      return 'netflix';
    case 'stylized':
      return 'fantasy';
    default:
      return 'anime';
  }
}

export function applyAsrpVisualStyle(
  prev: AppState,
  styleId: AsrpVisualStyleId
): Partial<AppState> {
  const style = getAsrpVisualStyle(styleId);
  const pipeline = prev.asrp?.pipeline ?? DEFAULT_ASRP.pipeline;
  const useAsrp = pipeline === 'classic' ? 'asrp' : pipeline;
  const flags = pipelineToRenderFlags(useAsrp);

  return {
    visualFx: {
      ...prev.visualFx,
      colorGrade: style.colorGrade as AppState['visualFx']['colorGrade'],
      bloomEnabled: true,
      bloomIntensity: style.bloomIntensity,
      ssaoEnabled: style.ssao,
      godRaysEnabled: false,
      materialDetailing: style.materialShading !== 'classic_toon',
      renderMode: flags.renderMode,
    },
    sceneComposer: {
      ...prev.sceneComposer,
      visualStyle: toComposerStyle(styleId),
      fogEnabled: style.fogDensity > 0.01,
      fogDensity: Math.min(1, style.fogDensity * 8),
      envBrightness: Math.max(0.55, Math.min(1.2, 0.85 + style.exposureBias)),
      effectLevels: {
        ...prev.sceneComposer.effectLevels,
        bloom: style.bloomIntensity > 0.45 ? 'high' : style.bloomIntensity > 0.32 ? 'medium' : 'low',
        ao: style.ssao ? 'medium' : 'off',
        rim: style.rimBoost > 0.9 ? 'high' : 'medium',
        reflection: style.reflectionIntensity > 1.1 ? 'high' : 'medium',
      },
    },
    cinematicRender: {
      ...(prev.cinematicRender ?? DEFAULT_CINEMATIC_RENDER),
      renderStyle: toCinematicRenderStyle(styleId),
      softShadows: style.softShadows,
      lightShafts: style.lightShafts > 0.3,
    },
    reflectionSystem: prev.reflectionSystem
      ? {
          ...prev.reflectionSystem,
          intensity: Math.max(0.5, Math.min(2, style.reflectionIntensity)),
          enabled: true,
        }
      : prev.reflectionSystem,
    asrp: {
      ...(prev.asrp ?? DEFAULT_ASRP),
      enabled: true,
      pipeline: useAsrp,
      animePreserve: style.animeShadingStrength > 0.4,
    },
    rtxModeEnabled: flags.rtxModeEnabled || prev.rtxModeEnabled,
  };
}
