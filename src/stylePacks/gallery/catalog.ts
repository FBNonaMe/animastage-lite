import type { GalleryPresetDef, GalleryCategoryId, AutoLuminousLevel } from './types';
import { slugPresetId } from './types';
import { FX_TEMPLATES } from './fxTemplates';
import type { GalleryStyleConfig } from './types';
import type { CharacterQuality } from '../../types';
import type { ComposerVisualStyleId, MaterialOverrideId } from '../../sceneComposer/types';

const SWATCHES = [
  'from-violet-600 to-indigo-900',
  'from-pink-500 to-rose-700',
  'from-cyan-500 to-blue-800',
  'from-amber-400 to-orange-700',
  'from-emerald-500 to-teal-900',
  'from-fuchsia-500 to-purple-900',
  'from-slate-500 to-zinc-900',
  'from-sky-400 to-indigo-700',
];

function def(
  category: GalleryCategoryId,
  name: string,
  fxKey: string,
  swatchIdx: number,
  opts?: {
    description?: string;
    characterQuality?: CharacterQuality;
    visualStyle?: ComposerVisualStyleId;
    materialOverride?: MaterialOverrideId;
    autoLuminous?: AutoLuminousLevel;
    perfTier?: GalleryPresetDef['perfTier'];
  }
): GalleryPresetDef {
  const id = slugPresetId(name);
  const config: GalleryStyleConfig = {
    fx: FX_TEMPLATES[fxKey] ?? {},
    characterQuality: opts?.characterQuality,
    visualStyle: opts?.visualStyle,
    materialOverride: opts?.materialOverride,
    autoLuminous: opts?.autoLuminous,
    description: opts?.description,
    perfTier: opts?.perfTier,
  };
  if (opts?.visualStyle || opts?.materialOverride) {
    config.composerPatch = {
      visualStyle: opts.visualStyle,
      materialOverride: opts.materialOverride,
    };
  }
  return {
    id,
    name,
    category,
    description: opts?.description ?? `${name} — one-click visual preset for AnimaStage Lite.`,
    swatch: SWATCHES[swatchIdx % SWATCHES.length]!,
    config,
    perfTier: opts?.perfTier ?? 'standard',
  };
}

export const GALLERY_PRESETS: GalleryPresetDef[] = [
  // Classic MMD
  def('classic_mmd', 'Default', 'neutral', 6, { visualStyle: 'default' }),
  def('classic_mmd', 'Classic MMD', 'classicMmd', 6),
  def('classic_mmd', 'MikuMikuShader', 'mikuMiku', 2, { visualStyle: 'anime' }),
  def('classic_mmd', 'Adult Shader', 'adultShader', 4, { visualStyle: 'realistic' }),
  def('classic_mmd', 'NCHL Shader', 'nchl', 6),
  def('classic_mmd', 'ikPolish', 'ikPolish', 3),
  def('classic_mmd', 'AutoLuminous', 'autoLuminous', 1, { autoLuminous: 'high' }),
  def('classic_mmd', 'Excellent Shadow', 'excellentShadow', 6),
  def('classic_mmd', 'Diffusion', 'diffusion', 3, { perfTier: 'heavy' }),
  def('classic_mmd', 'HgSAO', 'hgsao', 6),
  def('classic_mmd', 'PowerDOF', 'powerDof', 4, { perfTier: 'heavy' }),
  def('classic_mmd', 'WorkingFloor', 'workingFloor', 6),
  def('classic_mmd', 'ObjectLuminous', 'objectLuminous', 1, { autoLuminous: 'medium' }),
  def('classic_mmd', 'Anime Toon', 'animeToon', 2, { visualStyle: 'anime', materialOverride: 'flat' }),
  def('classic_mmd', 'Soft Toon', 'softToon', 3, { visualStyle: 'soft_anime', materialOverride: 'soft_toon' }),

  // Anime
  def('anime', 'Anime Soft', 'animeSoft', 3, { visualStyle: 'soft_anime' }),
  def('anime', 'Anime Bright', 'animeBright', 2, { visualStyle: 'anime' }),
  def('anime', 'Anime Flat', 'animeFlat', 2, { materialOverride: 'flat' }),
  def('anime', 'Anime Cel', 'animeCel', 2, { materialOverride: 'outline' }),
  def('anime', 'Anime Studio', 'animeStudio', 6, { visualStyle: 'studio' }),
  def('anime', 'Anime Idol', 'animeIdol', 1, { visualStyle: 'anime' }),
  def('anime', 'Anime Stage', 'animeStage', 4),
  def('anime', 'Anime Night', 'animeNight', 7),
  def('anime', 'Anime Bloom', 'animeBloom', 1),
  def('anime', 'Anime Pastel', 'animePastel', 3, { visualStyle: 'soft_anime' }),

  // Game Inspired
  def('game_inspired', 'Genshin Style', 'genshin', 4, { visualStyle: 'anime', characterQuality: 'hd' }),
  def('game_inspired', 'Honkai Style', 'honkai', 5, { visualStyle: 'fantasy', characterQuality: 'hd' }),
  def('game_inspired', 'Zenless Style', 'zenless', 5, { visualStyle: 'cyberpunk' }),
  def('game_inspired', 'Blue Archive Style', 'blueArchive', 2, { visualStyle: 'anime' }),
  def('game_inspired', 'Wuthering Waves Style', 'wuthering', 4, { characterQuality: 'hd' }),
  def('game_inspired', 'Arknights Style', 'arknights', 6),
  def('game_inspired', 'Azur Lane Style', 'azurLane', 2),
  def('game_inspired', 'NIKKE Style', 'nikke', 7, { visualStyle: 'cyberpunk' }),
  def('game_inspired', 'Punishing Gray Raven Style', 'pgr', 6),

  // Cinematic
  def('cinematic', 'Hollywood', 'hollywood', 4, { visualStyle: 'realistic', perfTier: 'heavy' }),
  def('cinematic', 'Blockbuster', 'blockbuster', 4, { perfTier: 'heavy' }),
  def('cinematic', 'Movie', 'movie', 6, { perfTier: 'heavy' }),
  def('cinematic', 'Netflix', 'netflix', 6),
  def('cinematic', 'Drama', 'drama', 6),
  def('cinematic', 'Warm Film', 'warmFilm', 3),
  def('cinematic', 'Cold Film', 'coldFilm', 7),
  def('cinematic', 'Vintage', 'vintage', 3),
  def('cinematic', 'Dream', 'dream', 1, { visualStyle: 'fantasy' }),
  def('cinematic', 'Documentary', 'documentary', 6, { visualStyle: 'realistic' }),

  // Neon
  def('neon', 'Cyberpunk', 'cyberpunk', 5, { visualStyle: 'cyberpunk' }),
  def('neon', 'Tokyo Night', 'tokyoNight', 7),
  def('neon', 'RGB', 'rgb', 5),
  def('neon', 'Purple Neon', 'purpleNeon', 5),
  def('neon', 'Blue Neon', 'blueNeon', 7),
  def('neon', 'Synthwave', 'synthwave', 5),
  def('neon', 'Vaporwave', 'vaporwave', 5),
  def('neon', 'Tron', 'tron', 7),
  def('neon', 'Blade Runner', 'bladeRunner', 6),

  // Fantasy
  def('fantasy', 'Magic', 'magic', 1, { visualStyle: 'fantasy' }),
  def('fantasy', 'Crystal', 'crystal', 7),
  def('fantasy', 'Moon', 'moon', 7),
  def('fantasy', 'Aurora', 'aurora', 4),
  def('fantasy', 'Fairy', 'fairy', 1),
  def('fantasy', 'Divine', 'divine', 3),
  def('fantasy', 'Mystic', 'mystic', 5),
  def('fantasy', 'Spirit', 'spirit', 2),
  def('fantasy', 'Fantasy World', 'fantasyWorld', 4, { visualStyle: 'fantasy' }),

  // Natural
  def('natural', 'Morning', 'morning', 3),
  def('natural', 'Golden Hour', 'goldenHour', 3),
  def('natural', 'Noon', 'noon', 4),
  def('natural', 'Sunset', 'sunset', 3),
  def('natural', 'Blue Hour', 'blueHour', 7),
  def('natural', 'Night', 'night', 7),
  def('natural', 'Rain', 'rain', 7),
  def('natural', 'Fog', 'fog', 6),
  def('natural', 'Snow', 'snow', 7),
  def('natural', 'Cloudy', 'cloudy', 6),

  // Photography
  def('photography', 'Studio Portrait', 'studioPortrait', 6, { visualStyle: 'studio' }),
  def('photography', 'Beauty', 'beauty', 3),
  def('photography', 'Fashion', 'fashion', 6),
  def('photography', 'Softbox', 'softbox', 6),
  def('photography', 'HDR', 'hdr', 4, { characterQuality: 'hd' }),
  def('photography', 'Product', 'product', 6),
  def('photography', 'White Studio', 'whiteStudio', 6),
  def('photography', 'Black Studio', 'blackStudio', 6),

  // Stylized
  def('stylized', 'Sketch', 'sketch', 6, { visualStyle: 'sketch', materialOverride: 'stylized' }),
  def('stylized', 'Comic', 'comic', 2, { visualStyle: 'comic', materialOverride: 'outline' }),
  def('stylized', 'Manga', 'manga', 6, { materialOverride: 'flat' }),
  def('stylized', 'Watercolor', 'watercolor', 3),
  def('stylized', 'Oil Painting', 'oilPainting', 3),
  def('stylized', 'Pixel Art', 'pixelArt', 2),
  def('stylized', 'Ink', 'ink', 6),
  def('stylized', 'Pastel', 'pastelStylized', 3),
  def('stylized', 'Chalk', 'chalk', 6),
];

const byId = new Map(GALLERY_PRESETS.map((p) => [p.id, p]));

export function getGalleryPreset(id: string): GalleryPresetDef | undefined {
  return byId.get(id);
}

export function listGalleryPresets(category?: GalleryCategoryId): GalleryPresetDef[] {
  if (!category || category === 'favorites' || category === 'downloaded' || category === 'creator') {
    return GALLERY_PRESETS;
  }
  return GALLERY_PRESETS.filter((p) => p.category === category);
}

export function galleryPresetCount(): number {
  return GALLERY_PRESETS.length;
}
