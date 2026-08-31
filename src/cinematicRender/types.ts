import type {
  CharacterQuality,
  VisualFxSettings,
  WeatherPresetId,
} from '../types';
import type { QualityMode } from '../product/scene/types';
import type {
  SceneComposerEffectLevels,
  SceneComposerLights,
  SceneComposerState,
} from '../sceneComposer/types';
import type { RtxSettings } from '../utils/rtxSettings';

/** Viewport / export quality ladders for the Cinematic Rendering System. */
export type CinematicQualityPresetId =
  | 'safe'
  | 'balanced'
  | 'cinematic'
  | 'ultra'
  | 'rtx_lite';

/** Physically inspired sun / time-of-day looks. */
export type CinematicSunTimeId =
  | 'sunrise'
  | 'noon'
  | 'sunset'
  | 'golden_hour'
  | 'blue_hour'
  | 'moonlight';

/** One-click cinematic looks (maps onto visualFx + sceneComposer). */
export type CinematicRenderStyleId =
  | 'classic_mmd'
  | 'anime'
  | 'anime_ultra'
  | 'realistic_anime'
  | 'movie'
  | 'studio'
  | 'netflix'
  | 'cinematic'
  | 'concert'
  | 'cyberpunk'
  | 'fantasy'
  | 'dream'
  | 'photoreal_anime';

export interface CinematicRenderState {
  /** Master enable — when false, export auto-bump still respects autoExportQuality. */
  enabled: boolean;
  qualityPreset: CinematicQualityPresetId;
  sunTime: CinematicSunTimeId;
  weather: WeatherPresetId;
  renderStyle: CinematicRenderStyleId;
  /** Sun intensity multiplier (1 = preset default). */
  sunIntensity: number;
  /** Color temperature Kelvin (approx) — mapped to sun tint. */
  sunColorTempK: number;
  /** Soft / contact / cascade-style shadow package via existing WebGL path. */
  softShadows: boolean;
  contactShadows: boolean;
  atmosphericScattering: boolean;
  lightShafts: boolean;
  volumetricFog: boolean;
  /** Raise shadows / AA / particles / post when exporting video. */
  autoExportQuality: boolean;
}

export type CinematicComposerPatch = Partial<
  Omit<SceneComposerState, 'lights' | 'effectLevels'>
> & {
  lights?: Partial<SceneComposerLights>;
  effectLevels?: Partial<SceneComposerEffectLevels>;
};

export interface CinematicRenderLookPatch {
  visualFx: Partial<VisualFxSettings>;
  sceneComposer?: CinematicComposerPatch;
  rtxModeEnabled?: boolean;
  rtxSettings?: Partial<RtxSettings>;
  characterQuality?: CharacterQuality;
  qualityMode?: QualityMode;
}

export interface CinematicQualityPresetDef {
  id: CinematicQualityPresetId;
  label: string;
  description: string;
  patch: CinematicRenderLookPatch;
  statePatch?: Partial<CinematicRenderState>;
}

export interface CinematicSunTimeDef {
  id: CinematicSunTimeId;
  label: string;
  azimuth: number;
  elevation: number;
  sunColor: string;
  colorTempK: number;
  intensity: number;
  skyPreset: SceneComposerState['skyPreset'];
  ambientColor: string;
  ambientIntensity: number;
  patch: CinematicRenderLookPatch;
}

export interface CinematicRenderStyleDef {
  id: CinematicRenderStyleId;
  label: string;
  description: string;
  patch: CinematicRenderLookPatch;
}
