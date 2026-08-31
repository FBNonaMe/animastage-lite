import type { CameraSnapshot } from '../types';

/** Signature Environment Pack — AnimaStage original fictional metropolis. */
export type AshfallDistrictId =
  | 'central_plaza'
  | 'residential'
  | 'business'
  | 'metro'
  | 'industrial'
  | 'old_town'
  | 'collapsed_highway'
  | 'bridge'
  | 'rooftops'
  | 'park'
  | 'river'
  | 'tunnel';

export type AshfallVariantId =
  | 'clean'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'night'
  | 'golden_hour'
  | 'storm'
  | 'cyber'
  | 'fantasy';

export type AshfallQualityId = 'lite' | 'standard' | 'high';

export type AshfallCameraSpotId =
  | 'city_entrance'
  | 'main_street'
  | 'bridge'
  | 'collapsed_highway'
  | 'central_plaza'
  | 'rooftop'
  | 'alley'
  | 'metro_entrance'
  | 'industrial_yard'
  | 'river_side'
  | 'park'
  | 'observation_deck';

export type AshfallPhotoSpotId =
  | 'portrait'
  | 'full_body'
  | 'group'
  | 'wallpaper'
  | 'poster'
  | 'hero'
  | 'anime_intro'
  | 'shorts_vertical';

export type AshfallStudioPresetId =
  | 'anime_intro'
  | 'battle'
  | 'music_video'
  | 'cinematic'
  | 'photo'
  | 'wallpaper'
  | 'poster'
  | 'youtube_thumb';

export interface AshfallDistrictDef {
  id: AshfallDistrictId;
  label: string;
  description: string;
  /** Center of district in city local space (MMD-friendly units). */
  center: [number, number, number];
  /** Approx footprint half-extents. */
  extent: [number, number];
  connectsTo: AshfallDistrictId[];
}

export interface AshfallLandmarkDef {
  id: string;
  label: string;
  districtId: AshfallDistrictId;
  position: [number, number, number];
  note: string;
}

export interface AshfallCameraSpotDef {
  id: AshfallCameraSpotId;
  label: string;
  districtId: AshfallDistrictId;
  snapshot: CameraSnapshot;
  description: string;
}

export interface AshfallPhotoSpotDef {
  id: AshfallPhotoSpotId;
  label: string;
  description: string;
  snapshot: CameraSnapshot;
  /** Suggested character root placement. */
  characterPosition: [number, number, number];
}

export interface AshfallCityState {
  enabled: boolean;
  variantId: AshfallVariantId;
  quality: AshfallQualityId;
  ambientFx: boolean;
  windStrength: number;
  showLandmarks: boolean;
  activeCameraSpotId: AshfallCameraSpotId | null;
  activePhotoSpotId: AshfallPhotoSpotId | null;
}
