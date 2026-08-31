import type { SceneBackgroundSettings, VisualFxSettings } from '../types';
import { DEFAULT_VISUAL_FX } from '../visualFx/visualFxPresets';
import { applyMmdWeatherPreset } from '../visualFx/mmdWeatherPresets';
import type { SceneComposerState } from './types';
import { DEFAULT_SCENE_COMPOSER } from './defaults';
import { effectLevelsToVisualFx } from './effectLevels';
import {
  COMPOSER_PRESETS,
  getComposerPreset,
  VISUAL_STYLE_PATCHES,
  type ComposerPresetDef,
} from './presets';
import type { ComposerPresetId, ComposerVisualStyleId, MaterialOverrideId } from './types';

export function composerStateToVisualFxPatch(
  composer: SceneComposerState,
  base: VisualFxSettings
): Partial<VisualFxSettings> {
  const fxFromEffects = effectLevelsToVisualFx(composer.effectLevels, base);

  const gradeSat = composer.saturation;
  const colorGrade = base.colorGrade;
  const realistic = composer.visualStyle === 'realistic';

  return {
    ...fxFromEffects,
    toneExposure: composer.exposure * composer.brightness,
    environmentIntensity: realistic
      ? Math.max(composer.envBrightness, 0.72)
      : composer.envBrightness,
    precipIntensity: composer.windStrength > 0.5 ? 0.2 : base.precipIntensity,
    particleIntensity: Math.min(1, 0.4 + composer.windStrength * 0.4),
    materialSmoothing:
      realistic
        ? 0.58
        : composer.materialOverride === 'soft_toon'
          ? 0.72
          : composer.materialOverride === 'flat'
            ? 0.2
            : composer.materialOverride === 'outline'
              ? 0.32
              : composer.materialOverride === 'stylized'
                ? 0.48
                : composer.materialOverride === 'studio'
                  ? 0.52
                  : fxFromEffects.materialSmoothing,
    materialDetailing: realistic || composer.materialOverride !== 'flat',
    ssaoEnabled: realistic ? fxFromEffects.ssaoEnabled !== false : fxFromEffects.ssaoEnabled,
    colorGrade,
  };
}

export function applyComposerPreset(
  presetId: ComposerPresetId,
  currentFx: VisualFxSettings,
  currentComposer: SceneComposerState = DEFAULT_SCENE_COMPOSER
): { visualFx: VisualFxSettings; composer: SceneComposerState; sceneBackground?: Partial<SceneBackgroundSettings> } {
  const preset = getComposerPreset(presetId);
  let visualFx = { ...currentFx, ...preset.visualFx };

  if (preset.visualFx.weatherPreset && preset.visualFx.weatherPreset !== 'clear') {
    visualFx = { ...visualFx, ...applyMmdWeatherPreset(preset.visualFx.weatherPreset) };
  }

  const composer: SceneComposerState = {
    ...currentComposer,
    ...(preset.composer ?? {}),
    lights: {
      ...currentComposer.lights,
      ...(preset.composer?.lights ?? {}),
    },
    effectLevels: {
      ...currentComposer.effectLevels,
      ...(preset.composer?.effectLevels ?? {}),
    },
  };

  if (preset.composer && 'sunAzimuth' in preset.composer) {
    composer.lights.sunAzimuth = (preset.composer as { sunAzimuth?: number }).sunAzimuth ?? composer.lights.sunAzimuth;
  }
  if (preset.composer && 'sunElevation' in preset.composer) {
    composer.lights.sunElevation = (preset.composer as { sunElevation?: number }).sunElevation ?? composer.lights.sunElevation;
  }
  if (preset.composer && 'sunColor' in preset.composer) {
    composer.lights.sunColor = (preset.composer as { sunColor?: string }).sunColor ?? composer.lights.sunColor;
  }

  visualFx = { ...visualFx, ...composerStateToVisualFxPatch(composer, visualFx) };

  let sceneBackground: Partial<SceneBackgroundSettings> | undefined;
  if (composer.bgMode === 'transparent') {
    sceneBackground = { imageUrl: null, opacity: 0 };
  } else if (composer.bgMode === 'solid_white' || composer.bgMode === 'solid_black') {
    sceneBackground = { imageUrl: null, opacity: 1 };
  }

  return { visualFx, composer, sceneBackground };
}

export function applyVisualStyle(
  styleId: ComposerVisualStyleId,
  currentFx: VisualFxSettings,
  currentComposer: SceneComposerState
): { visualFx: VisualFxSettings; composer: SceneComposerState } {
  const style = VISUAL_STYLE_PATCHES[styleId];
  const composer = {
    ...currentComposer,
    visualStyle: styleId,
    ...(style.composer ?? {}),
  };
  const visualFx = {
    ...currentFx,
    ...style.visualFx,
    ...composerStateToVisualFxPatch(composer, { ...currentFx, ...style.visualFx }),
  };
  return { visualFx, composer };
}

export function applyMaterialOverride(
  override: MaterialOverrideId,
  composer: SceneComposerState
): SceneComposerState {
  return { ...composer, materialOverride: override };
}

export function listComposerPresets(): ComposerPresetDef[] {
  return COMPOSER_PRESETS;
}

export function buildDefaultComposerBundle(name: string) {
  return {
    version: 1 as const,
    name,
    visualFx: { ...DEFAULT_VISUAL_FX },
    sceneComposer: { ...DEFAULT_SCENE_COMPOSER },
  };
}
