/** Build a read-only Asset Registry snapshot from live AppState + built-in catalogs. */
import type { AppState } from '../types';
import { SCENE_MOOD_PRESETS } from '../sceneStudio/presets';
import { BUILTIN_SCENE_FX } from '../sceneStudio/library';
import { CINEMATIC_LIGHTING_PRESETS } from '../sceneStudio/lighting';
import { SHOT_PRESETS } from '../shotComposer/presets';
import { PHYSICS_PRESETS } from '../physics/physicsPresets';
import type { AiDirectorAssetMeta } from './types';

export interface AiDirectorRegistry {
  generatedAt: number;
  assets: AiDirectorAssetMeta[];
  selectedCharacterId: string | null;
  selectedObjectId: string | null;
  hasCharacter: boolean;
  hasEnvironment: boolean;
}

function tagsFromName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .split(/[\s_-]+/)
    .filter((t) => t.length > 1);
}

export function buildAiDirectorRegistry(appState: AppState): AiDirectorRegistry {
  const assets: AiDirectorAssetMeta[] = [];

  for (const model of appState.models) {
    const kind = model.assetKind ?? 'character';
    const category =
      kind === 'stage' ? 'environment' : kind === 'prop' ? 'environment' : 'character';
    assets.push({
      id: model.id,
      name: model.name,
      type: category,
      category,
      tags: [...tagsFromName(model.name), kind, model.modelFormat ?? 'mmd'],
      compatibleFormats: [model.modelFormat ?? 'mmd'],
      recommendedUse: kind === 'stage' ? 'environment' : 'character',
      modelId: model.id,
    });
  }

  for (const mood of SCENE_MOOD_PRESETS) {
    assets.push({
      id: mood.id,
      name: mood.name,
      type: 'mood',
      category: 'scene_preset',
      tags: [...tagsFromName(mood.name), mood.weather.weather, 'mood', 'preset'],
      recommendedUse: mood.description,
      presets: [mood.id],
    });
  }

  for (const fx of BUILTIN_SCENE_FX) {
    assets.push({
      id: fx.id,
      name: fx.name,
      type: 'fx',
      category: fx.category === 'weather' ? 'weather' : 'fx',
      tags: [...fx.tags, fx.category, fx.mount],
      recommendedUse: fx.description,
    });
  }

  for (const light of CINEMATIC_LIGHTING_PRESETS) {
    assets.push({
      id: light.id,
      name: light.name,
      type: 'lighting',
      category: 'lighting',
      tags: [...tagsFromName(light.name), 'lighting', 'cinematic'],
      recommendedUse: light.description,
    });
  }

  for (const shot of SHOT_PRESETS) {
    assets.push({
      id: shot.id,
      name: shot.label,
      type: 'camera',
      category: 'camera',
      tags: [...tagsFromName(shot.label), shot.framing, 'shot'],
      recommendedUse: `${shot.framing} · fov ${shot.fov}`,
    });
  }

  for (const physics of PHYSICS_PRESETS) {
    assets.push({
      id: physics.id,
      name: physics.label,
      type: 'physics',
      category: 'physics',
      tags: [...tagsFromName(physics.label), 'physics'],
      recommendedUse: physics.hint,
    });
  }

  const aspects = ['9:16', '16:9', '1:1', '4:5', '21:9'] as const;
  for (const aspect of aspects) {
    assets.push({
      id: `aspect.${aspect}`,
      name: aspect,
      type: 'render',
      category: 'render',
      tags: ['aspect', aspect, aspect.includes('9:16') ? 'vertical' : 'horizontal'],
      recommendedUse: 'viewport aspect ratio',
    });
  }

  const library = appState.animationLibrary;
  if (library?.assets) {
    for (const clip of library.assets) {
      assets.push({
        id: clip.id,
        name: clip.name,
        type: 'animation',
        category: 'animation',
        tags: [...tagsFromName(clip.name), ...(clip.tags ?? []), clip.format, 'animation'],
        recommendedUse: 'animation library clip',
      });
    }
  }

  const characters = appState.models.filter((m) => (m.assetKind ?? 'character') === 'character');
  const stages = appState.models.filter((m) => m.assetKind === 'stage');
  const selected = appState.selectedObjectId;
  const selectedCharacter =
    characters.find((m) => m.id === selected)?.id ?? characters[characters.length - 1]?.id ?? null;

  return {
    generatedAt: Date.now(),
    assets,
    selectedCharacterId: selectedCharacter,
    selectedObjectId: selected,
    hasCharacter: characters.length > 0,
    hasEnvironment: stages.length > 0,
  };
}

export function registryCatalogText(registry: AiDirectorRegistry): string {
  const byCat = new Map<string, AiDirectorAssetMeta[]>();
  for (const asset of registry.assets) {
    const list = byCat.get(asset.category) ?? [];
    list.push(asset);
    byCat.set(asset.category, list);
  }
  const lines: string[] = [];
  for (const [category, list] of byCat) {
    lines.push(`## ${category}`);
    for (const asset of list.slice(0, 40)) {
      lines.push(`- id=${asset.id} | name=${asset.name} | tags=${asset.tags.slice(0, 8).join(',')}`);
    }
  }
  return lines.join('\n');
}
