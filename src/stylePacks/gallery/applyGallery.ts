import type { VisualFxSettings } from '../../types';
import { DEFAULT_SCENE_COMPOSER } from '../../sceneComposer/defaults';
import { VISUAL_STYLE_PATCHES } from '../../sceneComposer/presets';
import type { SceneComposerState } from '../../sceneComposer/types';
import { buildVisualFxFromConfig } from '../applyStyle';
import type { GalleryApplyResult, GalleryPresetDef, GalleryStyleConfig } from './types';
import { galleryStyleKey } from './types';
import { getGalleryPreset } from './catalog';
import type { InstalledStylePack } from '../types';
import { visualFxToEffectLevels } from '../../sceneComposer/effectLevels';
import { getPerfRenderAdaptation } from '../../perf/controller/renderAdaptation';

function mergeComposer(
  current: SceneComposerState,
  patch?: Partial<SceneComposerState>,
  visualStyle?: GalleryStyleConfig['visualStyle'],
  materialOverride?: GalleryStyleConfig['materialOverride']
): Partial<SceneComposerState> {
  const stylePatch = visualStyle ? VISUAL_STYLE_PATCHES[visualStyle] : undefined;
  const merged: Partial<SceneComposerState> = {
    ...patch,
    ...(stylePatch?.composer ?? {}),
  };
  if (visualStyle) merged.visualStyle = visualStyle;
  if (materialOverride) merged.materialOverride = materialOverride;
  if (stylePatch?.visualFx?.toneExposure != null && merged.exposure == null) {
    merged.exposure = stylePatch.visualFx.toneExposure;
  }
  return merged;
}

/** Scale heavy effects when perf adaptation requests lower GPU load. */
export function adaptGalleryFxForPerf(fx: VisualFxSettings): VisualFxSettings {
  const adapt = getPerfRenderAdaptation();
  if (adapt.shadowMapScale >= 0.99) return fx;

  const next = { ...fx };
  if (next.bloomEnabled && adapt.shadowMapScale < 0.85) {
    next.bloomIntensity = (next.bloomIntensity ?? 0.3) * Math.max(0.55, adapt.shadowMapScale);
    if (adapt.shadowMapScale < 0.65) {
      next.godRaysEnabled = false;
      next.dofEnabled = false;
    }
  }
  if (adapt.shadowMapScale < 0.85) {
    next.ssaoIntensity = (next.ssaoIntensity ?? 1) * Math.max(0.6, adapt.shadowMapScale);
  }
  return next;
}

export function applyGalleryConfig(
  styleId: string,
  config: GalleryStyleConfig,
  currentComposer: SceneComposerState = DEFAULT_SCENE_COMPOSER
): GalleryApplyResult {
  let visualFx = buildVisualFxFromConfig(config);
  const stylePatch = config.visualStyle ? VISUAL_STYLE_PATCHES[config.visualStyle] : undefined;
  if (stylePatch?.visualFx) {
    visualFx = { ...visualFx, ...stylePatch.visualFx };
  }
  visualFx = adaptGalleryFxForPerf(visualFx);

  const composerPatch = mergeComposer(
    currentComposer,
    config.composerPatch,
    config.visualStyle,
    config.materialOverride
  );
  composerPatch.bgMode = composerPatch.bgMode ?? 'scene';
  composerPatch.effectLevels = {
    ...currentComposer.effectLevels,
    ...visualFxToEffectLevels(visualFx),
    ...(composerPatch.effectLevels ?? {}),
  };

  const characterQuality =
    config.characterQuality ??
    (visualFx.materialDetailing !== false ? ('hd' as const) : undefined);

  return {
    styleId,
    visualFx,
    characterQuality,
    composerPatch,
    visualStyle: config.visualStyle,
    materialOverride: config.materialOverride,
    autoLuminous: config.autoLuminous,
  };
}

export function applyGalleryPresetById(
  presetId: string,
  currentComposer?: SceneComposerState
): GalleryApplyResult | null {
  const preset = getGalleryPreset(presetId);
  if (!preset) return null;
  return applyGalleryConfig(galleryStyleKey(preset.id), preset.config, currentComposer);
}

export function applyGalleryPresetDef(
  preset: GalleryPresetDef,
  currentComposer?: SceneComposerState
): GalleryApplyResult {
  return applyGalleryConfig(galleryStyleKey(preset.id), preset.config, currentComposer);
}

export function resolveGalleryStyleId(styleId: string): GalleryPresetDef | null {
  if (!styleId.startsWith('gallery:')) return null;
  const id = styleId.slice('gallery:'.length);
  return getGalleryPreset(id) ?? null;
}

export function packToGalleryResult(
  styleId: string,
  pack: InstalledStylePack,
  currentComposer?: SceneComposerState
): GalleryApplyResult {
  const config: GalleryStyleConfig = {
    ...pack.config,
    description: pack.manifest.description,
  };
  return applyGalleryConfig(styleId, config, currentComposer);
}
