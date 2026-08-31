/**
 * Photo Studio 2.0 — types for cinematic screenshot workspace.
 */

import type { MorphState, VisualFxSettings, CameraStudioSettings } from '../types';
import type { DynamicSkyState } from '../dynamicSky/types';
import type { SceneComposerState } from '../sceneComposer/types';
import type { PoseSnapshotV1 } from '../pose/poseTypes';

export type PhotoPoseCategory =
  | 'Cute'
  | 'Elegant'
  | 'Relaxed'
  | 'Happy'
  | 'Angry'
  | 'Sad'
  | 'Magic'
  | 'Combat'
  | 'School'
  | 'Idol'
  | 'Concert'
  | 'Fantasy'
  | 'Cyberpunk'
  | 'Selfie'
  | 'Sitting'
  | 'Jump'
  | 'Running'
  | 'Walking'
  | 'Looking Back'
  | 'Victory'
  | 'Smile'
  | 'Cry'
  | 'Thinking'
  | 'Anime Intro'
  | 'Wallpaper Pose'
  | 'Poster Pose';

export type PhotoExpressionId =
  | 'smile'
  | 'cute_smile'
  | 'open_mouth'
  | 'laugh'
  | 'cry'
  | 'surprised'
  | 'embarrassed'
  | 'sleepy'
  | 'angry'
  | 'determined'
  | 'sad'
  | 'thinking'
  | 'blink'
  | 'wink'
  | 'confident';

export type PhotoSceneId =
  | 'japanese_street'
  | 'school'
  | 'classroom'
  | 'bedroom'
  | 'shrine'
  | 'temple'
  | 'park'
  | 'forest'
  | 'cherry_blossoms'
  | 'cafe'
  | 'beach'
  | 'ocean'
  | 'night_city'
  | 'cyberpunk'
  | 'concert'
  | 'studio'
  | 'white_bg'
  | 'black_bg'
  | 'infinity_room'
  | 'fantasy_castle'
  | 'magic_forest';

export type PhotoLightingId =
  | 'anime_portrait'
  | 'golden_hour'
  | 'sunset'
  | 'soft_studio'
  | 'moonlight'
  | 'concert'
  | 'cyberpunk'
  | 'fantasy'
  | 'dream'
  | 'horror'
  | 'neon'
  | 'warm'
  | 'cold'
  | 'natural'
  | 'realistic';

export type PhotoAtmosphereId =
  | 'none'
  | 'snow'
  | 'rain'
  | 'fog'
  | 'clouds'
  | 'petals'
  | 'leaves'
  | 'fireflies'
  | 'sparkles'
  | 'dust'
  | 'magic'
  | 'butterflies'
  | 'confetti'
  | 'wind';

export type PhotoCameraPresetId =
  | 'anime_portrait'
  | 'full_body'
  | 'half_body'
  | 'close_face'
  | 'hero_shot'
  | 'low_angle'
  | 'high_angle'
  | 'dutch_angle'
  | 'side_view'
  | 'over_shoulder'
  | 'cinematic'
  | 'movie_poster'
  | 'wallpaper'
  | 'youtube_thumbnail'
  | 'discord_banner'
  | 'profile_picture'
  | 'steam_artwork';

export type PhotoCompositionId =
  | 'rule_of_thirds'
  | 'golden_ratio'
  | 'leading_lines'
  | 'balanced'
  | 'portrait_framing'
  | 'negative_space';

export type PhotoDofId =
  | 'portrait'
  | 'macro'
  | 'cinema'
  | 'anime'
  | 'movie'
  | 'strong_blur'
  | 'soft_blur'
  | 'off';

export type PhotoCinematicFxId =
  | 'bloom'
  | 'god_rays'
  | 'volumetric_fog'
  | 'lens_dirt'
  | 'lens_flare'
  | 'chromatic'
  | 'film_grain'
  | 'vignette'
  | 'glow'
  | 'screen_reflection';

export type PhotoGradeId =
  | 'anime'
  | 'soft_anime'
  | 'makoto'
  | 'ufotable'
  | 'warm_sunset'
  | 'cold_blue'
  | 'fantasy'
  | 'cyberpunk'
  | 'golden_hour'
  | 'dream'
  | 'pastel'
  | 'blockbuster'
  | 'netflix';

export type PhotoWeatherId =
  | 'sunny'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'storm'
  | 'cloudy'
  | 'wind'
  | 'golden_hour'
  | 'blue_hour';

export type PhotoSocialExportId =
  | 'wallpaper'
  | 'phone_wallpaper'
  | 'desktop_wallpaper'
  | 'discord_banner'
  | 'twitter_header'
  | 'youtube_thumbnail'
  | 'steam_artwork'
  | 'instagram'
  | 'tiktok_cover';

export type UltraRenderKind =
  | '1080p'
  | '1440p'
  | '4k'
  | '8k'
  | 'png'
  | 'png_transparent'
  | 'jpg'
  | 'webp';

export interface PhotoPoseEntry extends PoseSnapshotV1 {
  category: PhotoPoseCategory;
  tags: string[];
}

export interface PhotoExpressionDef {
  id: PhotoExpressionId;
  label: string;
  morphs: MorphState;
}

export interface PhotoSceneDef {
  id: PhotoSceneId;
  label: string;
  description: string;
  /** Maps onto existing scene / sky / fx */
  visualFx: Partial<VisualFxSettings>;
  dynamicSky?: Partial<DynamicSkyState>;
  timeHours?: number;
}

export interface PhotoLightingDef {
  id: PhotoLightingId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
  composer?: Partial<SceneComposerState> & {
    lights?: Partial<SceneComposerState['lights']>;
  };
  dynamicSky?: Partial<DynamicSkyState>;
}

export interface PhotoAtmosphereDef {
  id: PhotoAtmosphereId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
}

export interface PhotoCameraDef {
  id: PhotoCameraPresetId;
  label: string;
  description: string;
  cameraStudio: Partial<CameraStudioSettings>;
  /** Aspect hint for social crops */
  aspect?: number;
}

export interface PhotoCompositionDef {
  id: PhotoCompositionId;
  label: string;
  description: string;
  /** Horizontal offset fraction (−0.5..0.5) for subject bias */
  subjectBiasX: number;
  subjectBiasY: number;
  cameraStudio: Partial<CameraStudioSettings>;
}

export interface PhotoDofDef {
  id: PhotoDofId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
}

export interface PhotoCinematicFxDef {
  id: PhotoCinematicFxId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
}

export interface PhotoGradeDef {
  id: PhotoGradeId;
  label: string;
  visualFx: Partial<VisualFxSettings>;
}

export interface PhotoWeatherDef {
  id: PhotoWeatherId;
  label: string;
  dynamicSky: Partial<DynamicSkyState>;
  visualFx?: Partial<VisualFxSettings>;
}

export interface PhotoSocialExportDef {
  id: PhotoSocialExportId;
  label: string;
  width: number;
  height: number;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
}

/** Snapshot of a full Photo Studio look (saveable preset). */
export interface PhotoPresetV1 {
  version: 1;
  id: string;
  name: string;
  createdAt: number;
  poseId: string | null;
  expressionId: PhotoExpressionId | null;
  sceneId: PhotoSceneId | null;
  lightingId: PhotoLightingId | null;
  atmosphereId: PhotoAtmosphereId | null;
  cameraId: PhotoCameraPresetId | null;
  compositionId: PhotoCompositionId | null;
  dofId: PhotoDofId | null;
  fxIds: PhotoCinematicFxId[];
  gradeId: PhotoGradeId | null;
  weatherId: PhotoWeatherId | null;
  timeHours: number | null;
  visualFx?: Partial<VisualFxSettings>;
  dynamicSky?: Partial<DynamicSkyState>;
  cameraStudio?: Partial<CameraStudioSettings>;
  pose?: PoseSnapshotV1 | null;
}

export interface PhotoStudioSession {
  active: boolean;
  hideTimeline: boolean;
  favoritePoseIds: string[];
  query: string;
  category: PhotoPoseCategory | 'All';
  lastSuggestion: string | null;
}

export const DEFAULT_PHOTO_SESSION: PhotoStudioSession = {
  active: false,
  hideTimeline: true,
  favoritePoseIds: [],
  query: '',
  category: 'All',
  lastSuggestion: null,
};

/** Patches applied when a catalog item is selected. */
export interface PhotoLookPatches {
  visualFx?: Partial<VisualFxSettings>;
  dynamicSky?: Partial<DynamicSkyState>;
  sceneComposer?: Partial<SceneComposerState> & {
    lights?: Partial<SceneComposerState['lights']>;
  };
  cameraStudio?: Partial<CameraStudioSettings>;
  pose?: PoseSnapshotV1 | null;
  morphs?: MorphState | null;
  message?: string;
}
