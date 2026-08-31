import type { AppState, ViewportFormat } from '../types';
import { MMD_FPS } from '../utils/playhead';
import { getPreviewExportSize } from '../video/mmdVideoRecorder';
import { COMPOSER_PRESETS } from '../sceneComposer/presets';
import { DEFAULT_SCENE_COMPOSER } from '../sceneComposer/defaults';
import type { SceneComposerEffectLevels } from '../sceneComposer/types';
import { getBuiltinStyle, builtinStyleKey } from '../stylePacks/builtins';
import type { InstalledStylePack } from '../stylePacks/types';
import type { ExportFormatId, ProjectAnalysisContext } from './types';
import { cleanDisplayName } from './rng';
import { labelPreset } from './locale';
import type { SmartMetadataLocale } from './types';

export interface CollectContextInput {
  appState: AppState;
  viewportFormat: ViewportFormat;
  exportDurationSec: number;
  exportMode: ExportFormatId;
  activeStyleId?: string;
  installedStylePacks?: InstalledStylePack[];
  locale?: SmartMetadataLocale;
}

function resolveVisualStyleName(
  activeStyleId: string | undefined,
  installed: InstalledStylePack[]
): string | undefined {
  if (!activeStyleId) return undefined;
  if (activeStyleId.startsWith('pack:')) {
    const id = activeStyleId.slice(5);
    return installed.find((p) => p.manifest.id === id)?.manifest.name ?? id;
  }
  const builtinId = activeStyleId.replace(/^builtin:/, '');
  return getBuiltinStyle(builtinId)?.name ?? builtinId;
}

function resolveShaderPackName(
  activeStyleId: string | undefined,
  installed: InstalledStylePack[]
): string | undefined {
  if (!activeStyleId?.startsWith('pack:')) return undefined;
  const id = activeStyleId.slice(5);
  const pack = installed.find((p) => p.manifest.id === id);
  if (!pack?.manifest.mmdShader) return pack?.manifest.name;
  return pack.manifest.name;
}

function inferTimeOfDay(appState: AppState): string | undefined {
  const { sceneComposer, visualFx } = appState;
  const sky = sceneComposer.skyPreset;
  const elev = sceneComposer.lights.sunElevation;
  if (sky === 'night' || elev < 8) return 'night';
  if (sky === 'sunset' || (elev >= 8 && elev <= 25)) return 'golden_hour';
  if (sky === 'fantasy' || sky === 'cyber') return sky;
  return elev > 40 ? 'day' : 'golden_hour';
}

function inferComposerPresetLabel(appState: AppState): string | undefined {
  const match = COMPOSER_PRESETS.find((p) => {
    const style = p.composer?.visualStyle;
    return style === appState.sceneComposer.visualStyle;
  });
  return match?.label;
}

function resolveEffectLevels(appState: AppState): SceneComposerEffectLevels {
  return {
    ...DEFAULT_SCENE_COMPOSER.effectLevels,
    ...appState.sceneComposer.effectLevels,
  };
}

function collectActiveEffects(appState: AppState): string[] {
  const fx = appState.visualFx;
  const levels = resolveEffectLevels(appState);
  const out: string[] = [];

  if (fx.bloomEnabled || levels.bloom !== 'off') out.push('Bloom');
  if (levels.glow !== 'off') out.push('Glow');
  if (fx.dofEnabled || levels.dof !== 'off') out.push('DOF');
  if (fx.ssaoEnabled || levels.ao !== 'off') out.push('SSAO');
  if (fx.godRaysEnabled) out.push('God Rays');
  if (fx.particlesEnabled && fx.particlePreset !== 'none') {
    out.push(`Particles (${fx.particlePreset})`);
  }
  if (fx.vignetteEnabled) out.push('Vignette');
  if (fx.smaaEnabled) out.push('SMAA');
  if (appState.rtxModeEnabled) out.push('RTX');
  if (appState.sceneComposer.fogEnabled) out.push('Fog');
  if (fx.chromaticAberration > 0.01) out.push('Chromatic Aberration');

  return out;
}

function collectMoodTags(ctx: Partial<ProjectAnalysisContext>): string[] {
  const tags: string[] = [];
  const push = (v?: string) => {
    if (v && !tags.includes(v)) tags.push(v);
  };

  push(ctx.visualStyle?.toLowerCase());
  push(ctx.lightingPreset?.toLowerCase());
  push(ctx.weather?.toLowerCase());
  push(ctx.timeOfDay?.toLowerCase());
  push(ctx.environment?.toLowerCase());

  if (ctx.motionName) {
    if (/dance|踊/i.test(ctx.motionName)) push('dance');
    if (/idle|待/i.test(ctx.motionName)) push('idle');
  }
  if (ctx.characterName) push('anime');

  return tags.filter(Boolean);
}

function formatEffectLevel(level: string | undefined): string {
  if (!level || level === 'off') return 'Off';
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** Analyze live project state — skips unavailable fields. */
export function collectProjectContext(input: CollectContextInput): ProjectAnalysisContext {
  const {
    appState,
    viewportFormat,
    exportDurationSec,
    exportMode,
    activeStyleId,
    installedStylePacks = [],
    locale = 'en',
  } = input;

  const characters = appState.models.filter(
    (m) => m.visible && (m.assetKind === 'character' || !m.assetKind)
  );
  const stageModel = appState.models.find((m) => m.visible && m.assetKind === 'stage');
  const primary = characters[0] ?? appState.models.find((m) => m.visible) ?? appState.models[0];

  const characterName = primary ? cleanDisplayName(primary.name) : undefined;
  const motionRaw =
    primary?.vmdFileNames?.[primary.activeVmdIndex ?? 0] ??
    primary?.vmdFileNames?.[0] ??
    (primary?.activeTemplateId ? primary.activeTemplateId : undefined);
  const motionName = motionRaw ? cleanDisplayName(String(motionRaw)) : undefined;
  const stageName = stageModel ? cleanDisplayName(stageModel.name) : undefined;

  const { visualFx, sceneComposer, sceneBackground, sceneHdr, cameraStudio } = appState;
  const effectLevels = resolveEffectLevels(appState);
  const envParts: string[] = [];
  if (sceneHdr.fileName) envParts.push(cleanDisplayName(sceneHdr.fileName));
  if (visualFx.scenePreset) {
    envParts.push(labelPreset(locale, 'scene', visualFx.scenePreset));
  }
  const composerLabel = inferComposerPresetLabel(appState);
  if (composerLabel) envParts.push(composerLabel);

  let background: string | undefined;
  if (sceneBackground.imageUrl) background = 'Custom image';
  else if (sceneComposer.bgMode === 'transparent') background = 'Transparent';
  else if (sceneComposer.bgMode === 'solid_black') background = 'Solid black';
  else if (sceneComposer.bgMode === 'solid_white') background = 'Solid white';
  else if (sceneComposer.bgMode === 'custom') background = 'Custom color';

  const cameraPreset = cameraStudio.orbitPreset.replace(/_/g, ' ');
  const visualStyle =
    resolveVisualStyleName(activeStyleId, installedStylePacks) ??
    sceneComposer.visualStyle.replace(/_/g, ' ');
  const shaderPack = resolveShaderPackName(activeStyleId, installedStylePacks);
  const lut =
    visualFx.customLutUrl && visualFx.customLutEnabled !== false && visualFx.customLutName
      ? visualFx.customLutName.replace(/\.(cube|3dl)$/i, '')
      : visualFx.colorGrade.replace(/_/g, ' ');
  const lightingPreset = labelPreset(locale, 'light', visualFx.lightPreset);
  const weather =
    visualFx.weatherPreset && visualFx.weatherPreset !== 'clear'
      ? labelPreset(locale, 'weather', visualFx.weatherPreset)
      : undefined;
  const timeOfDay = inferTimeOfDay(appState);
  const timeLabel = timeOfDay ? labelPreset(locale, 'time', timeOfDay) : undefined;

  const activeEffects = collectActiveEffects(appState);
  const bloom =
    visualFx.bloomEnabled || effectLevels.bloom !== 'off'
      ? formatEffectLevel(effectLevels.bloom === 'off' ? 'medium' : effectLevels.bloom)
      : undefined;
  const glow =
    effectLevels.glow && effectLevels.glow !== 'off'
      ? formatEffectLevel(effectLevels.glow)
      : undefined;
  const fog = sceneComposer.fogEnabled
    ? `On (${sceneComposer.fogDensity.toFixed(2)})`
    : undefined;
  const dof =
    visualFx.dofEnabled || effectLevels.dof !== 'off'
      ? formatEffectLevel(effectLevels.dof === 'off' ? 'medium' : effectLevels.dof)
      : undefined;

  const { width, height } = getPreviewExportSize(viewportFormat);

  const partial: Partial<ProjectAnalysisContext> = {
    characterName,
    motionName,
    stageName,
    environment: envParts.length ? envParts.join(' · ') : undefined,
    background,
    cameraPreset,
    visualStyle,
    shaderPack,
    lut,
    lightingPreset,
    weather,
    timeOfDay: timeLabel,
    activeEffects,
    bloom,
    glow,
    fog,
    dof,
    fps: MMD_FPS,
    aspectRatio: viewportFormat,
    resolution: `${width}×${height}`,
    durationSec: exportDurationSec,
    exportMode,
  };

  return {
    ...partial,
    moodTags: collectMoodTags(partial),
    activeEffects,
    fps: MMD_FPS,
    aspectRatio: viewportFormat,
    resolution: `${width}×${height}`,
    durationSec: exportDurationSec,
    exportMode,
  } as ProjectAnalysisContext;
}

/** Resolve active style id from visual styles hook state. */
export function readActiveStyleId(
  activeStyleId?: string,
  visualStyles?: { activeStyleId: string; installed: InstalledStylePack[] }
): { activeStyleId: string; installed: InstalledStylePack[] } {
  return {
    activeStyleId: visualStyles?.activeStyleId ?? activeStyleId ?? builtinStyleKey('default'),
    installed: visualStyles?.installed ?? [],
  };
}
