import type { CharacterQuality, VisualFxSettings } from '../types';
import { DEFAULT_VISUAL_FX } from '../visualFx/visualFxPresets';
import { getBuiltinStyle } from './builtins';
import {
  applyGalleryConfig,
  resolveGalleryStyleId,
  packToGalleryResult,
} from './gallery/applyGallery';
import { loadGalleryExtras } from './gallery/galleryStorage';
import { userStyleKey } from './gallery/types';
import type { InstalledStylePack, StylePackAppliedConfig, StyleSource } from './types';
import type { GalleryApplyResult } from './gallery/types';
import type { SceneComposerState } from '../sceneComposer/types';

export interface StyleApplyResult {
  visualFx: VisualFxSettings;
  characterQuality?: CharacterQuality;
  gallery?: GalleryApplyResult;
}

export function buildVisualFxFromConfig(config: StylePackAppliedConfig): VisualFxSettings {
  return { ...DEFAULT_VISUAL_FX, ...config.fx };
}

export function resolveStyleSource(
  styleId: string,
  installed: InstalledStylePack[]
): StyleSource | null {
  if (styleId.startsWith('gallery:')) {
    const preset = resolveGalleryStyleId(styleId);
    if (!preset) return null;
    return {
      kind: 'gallery',
      preset,
    };
  }
  if (styleId.startsWith('user:')) {
    const id = styleId.slice('user:'.length);
    const user = loadGalleryExtras().userPresets.find((p) => p.id === id);
    if (!user) return null;
    return { kind: 'user', preset: user };
  }
  if (styleId.startsWith('builtin:')) {
    const id = styleId.slice('builtin:'.length);
    const style = getBuiltinStyle(id);
    return style ? { kind: 'builtin', style } : null;
  }
  if (styleId.startsWith('pack:')) {
    const id = styleId.slice('pack:'.length);
    const pack = installed.find((p) => p.manifest.id === id);
    return pack ? { kind: 'pack', pack } : null;
  }
  return null;
}

export function applyStyleSource(
  source: StyleSource,
  currentComposer?: SceneComposerState
): StyleApplyResult {
  if (source.kind === 'gallery') {
    const gallery = applyGalleryConfig(
      `gallery:${source.preset.id}`,
      source.preset.config,
      currentComposer
    );
    return {
      visualFx: gallery.visualFx,
      characterQuality: gallery.characterQuality,
      gallery,
    };
  }
  if (source.kind === 'user') {
    const gallery = applyGalleryConfig(userStyleKey(source.preset.id), source.preset.config, currentComposer);
    return {
      visualFx: gallery.visualFx,
      characterQuality: gallery.characterQuality,
      gallery,
    };
  }
  const config = source.kind === 'builtin' ? source.style.config : source.pack.config;
  if (source.kind === 'pack') {
    const gallery = packToGalleryResult(`pack:${source.pack.manifest.id}`, source.pack, currentComposer);
    return {
      visualFx: gallery.visualFx,
      characterQuality: gallery.characterQuality,
      gallery,
    };
  }
  return {
    visualFx: buildVisualFxFromConfig(config),
    characterQuality: config.characterQuality,
  };
}

export function applyStyleById(
  styleId: string,
  installed: InstalledStylePack[],
  currentComposer?: SceneComposerState
): StyleApplyResult | null {
  const source = resolveStyleSource(styleId, installed);
  if (!source) return null;
  return applyStyleSource(source, currentComposer);
}
