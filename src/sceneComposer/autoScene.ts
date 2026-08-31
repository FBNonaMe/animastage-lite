import type { AppState } from '../types';
import { analyzeSceneProfile } from '../smartStudio/analyzeScene';
import { getCharacterProfile } from '../cis';
import type { AutoSceneResult, ComposerPresetId } from './types';
import { applyComposerPreset } from './apply';
import { DEFAULT_SCENE_COMPOSER } from './defaults';

export function buildAutoScene(state: AppState): AutoSceneResult {
  const profile = analyzeSceneProfile(state);
  const cis = getCharacterProfile(
    state.models.find((m) => m.id === state.selectedObjectId) ?? state.models[0]
  );

  const report: string[] = [];
  let presetId: ComposerPresetId = 'studio';

  if (state.models.some((m) => m.assetKind === 'stage')) {
    presetId = 'anime_street';
    report.push('Imported stage detected — street/concert lighting');
  } else if (profile.hasAnimation) {
    presetId = profile.stageSize === 'duo' ? 'concert' : 'studio';
    report.push('Motion detected — stage-friendly lighting');
  }

  if (profile.gpuTier === 'low' || profile.gpuTier === 'mid') {
    presetId = profile.hasAnimation ? 'studio' : 'indoor';
    report.push('GPU-aware — lighter effects');
  }

  if (cis?.capabilities.some((c) => c.id === 'hair_physics' && c.supported)) {
    report.push('Hair physics — balanced rim light');
  }

  if (profile.formatHint === 'mixamo' || profile.formatHint === 'vrm') {
    presetId = 'cyberpunk';
    report.push('Non-MMD rig — cyber preset');
  }

  const tri = cis?.mesh.triangleCount ?? 0;
  if (tri > 400_000) {
    presetId = 'studio';
    report.push('Heavy mesh — minimal post-FX');
  }

  const hour = new Date().getHours();
  if (hour >= 18 || hour < 6) {
    if (presetId === 'studio') presetId = 'moonlight';
    report.push('Evening hours — moonlight tint');
  }

  const { visualFx, composer, sceneBackground } = applyComposerPreset(
    presetId,
    state.visualFx,
    state.sceneComposer ?? DEFAULT_SCENE_COMPOSER
  );

  if (profile.gpuTier === 'low') {
    visualFx.bloomEnabled = false;
    visualFx.ssaoEnabled = false;
    visualFx.particlesEnabled = false;
    report.push('Mobile tier — bloom/SSAO/particles reduced');
  }

  return {
    presetId,
    visualFx,
    composer,
    sceneBackground,
    report,
  };
}
