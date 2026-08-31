import { mulberry32, pickRandom } from '../../smartMetadata/rng';
import type { GalleryPresetDef } from './types';
import { GALLERY_PRESETS } from './catalog';
import { FX_TEMPLATES } from './fxTemplates';
import type { GalleryStyleConfig } from './types';
import type { StylePackFxConfig } from '../types';

const SKY = ['blue', 'sunset', 'night', 'cloudy', 'fantasy', 'cyber'] as const;
const GRADES = ['neutral', 'anime', 'cinematic', 'warm', 'cold', 'vaporwave', 'noir'] as const;
const LIGHTS = ['natural', 'anime', 'rim', 'neon', 'concert', 'spotlight'] as const;
const SCENES = ['studio', 'sunset', 'outdoor', 'cyber', 'stage', 'nightclub'] as const;

function blendFx(a: StylePackFxConfig, b: StylePackFxConfig): StylePackFxConfig {
  const out: StylePackFxConfig = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const key = k as keyof StylePackFxConfig;
    if (typeof v === 'number' && typeof out[key] === 'number') {
      (out as Record<string, number>)[key] = ((out[key] as number) + v) / 2;
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

/** Randomly combine lighting, bloom, grade, scene — unique one-click looks. */
export function generateRandomGalleryConfig(seed = Date.now()): GalleryStyleConfig {
  const rng = mulberry32(seed);
  const baseA = pickRandom(GALLERY_PRESETS, rng);
  const baseB = pickRandom(GALLERY_PRESETS, rng);
  const tplKeys = Object.keys(FX_TEMPLATES);
  const tpl = FX_TEMPLATES[pickRandom(tplKeys, rng)] ?? {};

  const fx = blendFx(
    blendFx(baseA.config.fx, baseB.config.fx),
    tpl
  );

  fx.colorGrade = pickRandom([...GRADES], rng);
  fx.lightPreset = pickRandom([...LIGHTS], rng);
  fx.scenePreset = pickRandom([...SCENES], rng);
  fx.bloomEnabled = rng() > 0.25;
  fx.bloomIntensity = 0.15 + rng() * 0.45;

  return {
    fx,
    characterQuality: rng() > 0.7 ? 'hd' : 'standard',
    visualStyle: pickRandom(['anime', 'soft_anime', 'fantasy', 'cyberpunk', 'realistic', 'studio'] as const, rng),
    autoLuminous: pickRandom(['off', 'low', 'medium', 'high', 'auto'] as const, rng),
    composerPatch: {
      skyPreset: pickRandom([...SKY], rng),
      saturation: 0.85 + rng() * 0.35,
      contrast: 0.9 + rng() * 0.25,
      exposure: 0.82 + rng() * 0.28,
    },
    description: `Random blend — ${baseA.name} × ${baseB.name}`,
    perfTier: rng() > 0.75 ? 'heavy' : 'standard',
  };
}

export function randomGalleryPreset(seed = Date.now()): GalleryPresetDef {
  const config = generateRandomGalleryConfig(seed);
  return {
    id: `random-${seed}`,
    name: 'Random Style',
    category: 'creator',
    description: config.description ?? 'Randomly generated look.',
    swatch: 'from-fuchsia-500 via-violet-600 to-cyan-600',
    config,
    perfTier: config.perfTier,
  };
}
