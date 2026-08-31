import type { AppState } from '../types';
import {
  PHOTO_ATMOSPHERES,
  PHOTO_CAMERAS,
  PHOTO_COMPOSITIONS,
  PHOTO_DOF,
  PHOTO_GRADES,
  PHOTO_LIGHTING,
  PHOTO_WEATHER,
} from './catalogs';
import { PHOTO_EXPRESSIONS } from './expressions';
import { PHOTO_POSES } from './poses';
import type { PhotoLookPatches } from './types';

const pick = <T,>(rows: readonly T[], random = Math.random): T =>
  rows[Math.floor(random() * rows.length)]!;

/** One Director variation. Caller applies patches, renders, then asks for the next. */
export function generateDirectorLook(random = Math.random): PhotoLookPatches {
  const pose = pick(PHOTO_POSES, random);
  const expression = pick(PHOTO_EXPRESSIONS, random);
  const light = pick(PHOTO_LIGHTING, random);
  const atmosphere = pick(PHOTO_ATMOSPHERES, random);
  const camera = pick(PHOTO_CAMERAS, random);
  const composition = pick(PHOTO_COMPOSITIONS, random);
  const dof = pick(PHOTO_DOF.filter((x) => x.id !== 'off'), random);
  const grade = pick(PHOTO_GRADES, random);
  const weather = pick(PHOTO_WEATHER, random);
  return {
    pose,
    morphs: expression.morphs,
    visualFx: {
      ...light.visualFx,
      ...atmosphere.visualFx,
      ...dof.visualFx,
      ...grade.visualFx,
      ...weather.visualFx,
    },
    dynamicSky: { ...light.dynamicSky, ...weather.dynamicSky },
    sceneComposer: light.composer,
    cameraStudio: { ...camera.cameraStudio, ...composition.cameraStudio },
    message: `${pose.name} · ${light.label} · ${camera.label} · ${grade.label}`,
  };
}

export function buildPhotoAiSuggestions(state: AppState): string[] {
  const out: string[] = [];
  const fx = state.visualFx;
  const sky = state.dynamicSky;
  if (!state.models.length) return ['Load a character to begin Photo Studio.'];
  if (!state.cameraStudio.autoFocus) out.push('Enable Auto Focus for cleaner portrait framing.');
  if (state.cameraStudio.focusTarget !== 'face') out.push('Use Portrait Lens and focus on the face.');
  if (!fx.dofEnabled) out.push('Enable Portrait DOF to separate the character from the background.');
  if (!fx.bloomEnabled || fx.bloomIntensity < 0.35) out.push('Increase Bloom slightly for an anime highlight rolloff.');
  if (fx.lightPreset === 'natural') out.push('Try Rim Light for stronger character separation.');
  if (!fx.particlesEnabled) out.push('Add Petals or subtle Dust to create depth.');
  if (!sky?.enabled) out.push('Enable Dynamic Sky and try Golden Hour.');
  if (sky?.enabled && sky.timeHours > 10 && sky.timeHours < 16) {
    out.push('Move time toward Golden Hour for softer cinematic shadows.');
  }
  if (!fx.vignetteEnabled) out.push('Add a subtle Vignette to guide attention.');
  if (out.length < 3) out.push('Use Rule of Thirds or Negative Space for a stronger composition.');
  return out.slice(0, 6);
}
