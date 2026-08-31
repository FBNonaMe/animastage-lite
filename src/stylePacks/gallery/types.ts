import type { CharacterQuality } from '../../types';
import type {
  ComposerVisualStyleId,
  MaterialOverrideId,
  SceneComposerState,
} from '../../sceneComposer/types';
import type { StylePackAppliedConfig, StylePackFxConfig } from '../types';

export type GalleryCategoryId =
  | 'classic_mmd'
  | 'anime'
  | 'game_inspired'
  | 'cinematic'
  | 'neon'
  | 'fantasy'
  | 'natural'
  | 'photography'
  | 'stylized'
  | 'creator'
  | 'favorites'
  | 'downloaded';

export type AutoLuminousLevel = 'off' | 'low' | 'medium' | 'high' | 'auto';

export type StylePerfTier = 'lite' | 'standard' | 'heavy';

/** Extended config applied by the gallery engine (non-destructive FX + composer bridge). */
export interface GalleryStyleConfig extends StylePackAppliedConfig {
  composerPatch?: Partial<SceneComposerState>;
  visualStyle?: ComposerVisualStyleId;
  materialOverride?: MaterialOverrideId;
  autoLuminous?: AutoLuminousLevel;
  description?: string;
  tags?: string[];
  perfTier?: StylePerfTier;
}

export interface GalleryPresetDef {
  id: string;
  name: string;
  category: GalleryCategoryId;
  description: string;
  swatch: string;
  config: GalleryStyleConfig;
  tags?: string[];
  perfTier?: StylePerfTier;
}

export interface GalleryApplyResult {
  styleId: string;
  visualFx: import('../../types').VisualFxSettings;
  characterQuality?: CharacterQuality;
  composerPatch?: Partial<SceneComposerState>;
  visualStyle?: ComposerVisualStyleId;
  materialOverride?: MaterialOverrideId;
  autoLuminous?: AutoLuminousLevel;
}

export interface UserVisualPreset {
  id: string;
  name: string;
  savedAt: number;
  styleId?: string;
  config: GalleryStyleConfig;
}

export interface StyleGalleryExtras {
  favorites: string[];
  userPresets: UserVisualPreset[];
}

export interface VisualPresetFile {
  format: 'visualpreset';
  version: 1;
  name: string;
  savedAt: number;
  styleId?: string;
  config: GalleryStyleConfig;
}

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategoryId, string> = {
  classic_mmd: 'Classic MMD',
  anime: 'Anime',
  game_inspired: 'Game Inspired',
  cinematic: 'Cinematic',
  neon: 'Neon',
  fantasy: 'Fantasy',
  natural: 'Natural',
  photography: 'Photography',
  stylized: 'Stylized',
  creator: 'Creator Presets',
  favorites: 'Favorites',
  downloaded: 'Downloaded',
};

export const GALLERY_STYLE_PREFIX = 'gallery:';
export const USER_STYLE_PREFIX = 'user:';

export function galleryStyleKey(id: string): string {
  return `${GALLERY_STYLE_PREFIX}${id}`;
}

export function userStyleKey(id: string): string {
  return `${USER_STYLE_PREFIX}${id}`;
}

export function slugPresetId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
