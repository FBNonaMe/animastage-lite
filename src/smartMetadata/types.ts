import type { ViewportFormat } from '../types';

/** Supported export modes — extensible for GIF / image sequence later. */
export type ExportFormatId = 'mp4_hq' | 'live' | 'gif' | 'image_sequence' | string;

export type SmartMetadataLocale = 'en' | 'ja' | 'ru' | 'es' | 'fr' | 'de' | 'pt';

export type SocialPlatformId =
  | 'youtube'
  | 'youtube_shorts'
  | 'tiktok'
  | 'instagram_reels'
  | 'x';

/** Analyzed project snapshot used for generation. */
export interface ProjectAnalysisContext {
  characterName?: string;
  motionName?: string;
  stageName?: string;
  environment?: string;
  background?: string;
  cameraPreset?: string;
  visualStyle?: string;
  shaderPack?: string;
  lut?: string;
  lightingPreset?: string;
  weather?: string;
  timeOfDay?: string;
  activeEffects: string[];
  bloom?: string;
  glow?: string;
  fog?: string;
  dof?: string;
  fps: number;
  aspectRatio: ViewportFormat;
  resolution: string;
  durationSec: number;
  exportMode: ExportFormatId;
  moodTags: string[];
}

/** Persisted + generated metadata bundle. */
export interface SmartVideoMetadata {
  locale: SmartMetadataLocale;
  platform: SocialPlatformId;
  exportMode: ExportFormatId;
  titles: string[];
  selectedTitleIndex: number;
  description: string;
  hashtags: string[];
  keywords: string[];
  /** Platform-optimized title (derived from selection + platform rules). */
  displayTitle: string;
  /** Platform-optimized description. */
  displayDescription: string;
  /** Platform-optimized hashtag line. */
  displayHashtags: string;
  generatedAt: number;
  generationSeed: number;
}

export interface GenerateSmartMetadataOptions {
  locale?: SmartMetadataLocale;
  platform?: SocialPlatformId;
  exportMode?: ExportFormatId;
  seed?: number;
  selectedTitleIndex?: number;
}
