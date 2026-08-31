import { BUILTIN_SCENE_FX, getSceneFxDefinition } from '../sceneStudio/library';
import type { SceneFxCategory, SceneFxDefinition } from '../sceneStudio/types';

export type SceneEffectRegistryEntry = SceneFxDefinition & {
  author: string;
  thumbnail: string;
  marketplace?: boolean;
  qualityHint: 'low' | 'medium' | 'high';
};

const REGISTRY_META: Record<
  string,
  Pick<SceneEffectRegistryEntry, 'author' | 'thumbnail' | 'marketplace' | 'qualityHint'>
> = {
  'weather.rain': { author: 'AnimaStage', thumbnail: '🌧', qualityHint: 'high' },
  'weather.snow': { author: 'AnimaStage', thumbnail: '❄', qualityHint: 'medium' },
  'weather.ash': { author: 'AnimaStage', thumbnail: '🌫', qualityHint: 'medium' },
  'weather.mist': { author: 'AnimaStage', thumbnail: '🌁', qualityHint: 'medium' },
  'environment.stars': { author: 'AnimaStage', thumbnail: '✨', qualityHint: 'low' },
  'environment.fireworks': { author: 'AnimaStage', thumbnail: '🎆', qualityHint: 'high' },
  'character.aura': { author: 'AnimaStage', thumbnail: '💫', qualityHint: 'medium' },
  'character.magic_circle': { author: 'AnimaStage', thumbnail: '🔮', qualityHint: 'medium' },
  'character.hand_trail': { author: 'AnimaStage', thumbnail: '🎀', qualityHint: 'high' },
  'audio.pulse': { author: 'AnimaStage', thumbnail: '🎵', qualityHint: 'low' },
  'character.divine_light': { author: 'AnimaStage', thumbnail: '🌟', qualityHint: 'medium' },
  'character.spectral_trail': { author: 'AnimaStage', thumbnail: '👻', qualityHint: 'high' },
  'magic.hex_field': { author: 'AnimaStage', thumbnail: '⬡', qualityHint: 'medium' },
  'anime.speed_lines': { author: 'AnimaStage', thumbnail: '💨', qualityHint: 'low' },
  'cinematic.lens_flare': { author: 'AnimaStage', thumbnail: '☀', qualityHint: 'low' },
  'particles.spark_burst': { author: 'AnimaStage', thumbnail: '✴', qualityHint: 'medium' },
  'energy.charge': { author: 'AnimaStage', thumbnail: '⚡', qualityHint: 'medium' },
  'particles.confetti': { author: 'AnimaStage', thumbnail: '🎊', qualityHint: 'medium' },
  'magic.rune_ring': { author: 'AnimaStage', thumbnail: '᚛', qualityHint: 'medium' },
  'character.eye_glow': { author: 'AnimaStage', thumbnail: '👁', qualityHint: 'low' },
  'cinematic.vignette_pulse': { author: 'AnimaStage', thumbnail: '◐', qualityHint: 'low' },
  'environment.god_rays': { author: 'AnimaStage', thumbnail: '🌅', qualityHint: 'high' },
  'anime.impact_flash': { author: 'AnimaStage', thumbnail: '💥', qualityHint: 'low' },
};

function enrich(def: SceneFxDefinition): SceneEffectRegistryEntry {
  const meta = REGISTRY_META[def.id] ?? {
    author: 'AnimaStage',
    thumbnail: '✦',
    qualityHint: 'medium' as const,
  };
  return { ...def, ...meta };
}

export const SCENE_EFFECT_REGISTRY: SceneEffectRegistryEntry[] = BUILTIN_SCENE_FX.map(enrich);

export function getRegistryEntry(effectId: string): SceneEffectRegistryEntry | undefined {
  const def = getSceneFxDefinition(effectId);
  return def ? enrich(def) : undefined;
}

export function searchSceneEffects(
  query: string,
  options?: {
    category?: SceneFxCategory | 'all';
    likedIds?: string[];
    likedOnly?: boolean;
  }
): SceneEffectRegistryEntry[] {
  const q = query.trim().toLowerCase();
  const liked = new Set(options?.likedIds ?? []);
  return SCENE_EFFECT_REGISTRY.filter((entry) => {
    if (options?.likedOnly && !liked.has(entry.id)) return false;
    if (options?.category && options.category !== 'all' && entry.category !== options.category) {
      return false;
    }
    if (!q) return true;
    return (
      entry.id.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      entry.tags.some((t) => t.includes(q))
    );
  });
}

export function toggleLikedEffectIds(ids: string[], effectId: string): string[] {
  const set = new Set(ids);
  if (set.has(effectId)) set.delete(effectId);
  else set.add(effectId);
  return [...set];
}
