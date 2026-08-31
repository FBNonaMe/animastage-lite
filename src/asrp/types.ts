/** AnimaStage Render Pipeline (ASRP) — Silhouette POM + material intelligence. */

export type AsrpPipelineId = 'classic' | 'asrp' | 'rtx_lite';

export type AsrpQualityTier = 'simplified' | 'balanced' | 'ultra' | 'export';

export type AsrpMaterialKind =
  | 'hair'
  | 'skin'
  | 'eye'
  | 'cloth'
  | 'shoe'
  | 'accessory'
  | 'ground'
  | 'wall'
  | 'wood'
  | 'stone'
  | 'metal'
  | 'plastic'
  | 'glass'
  | 'water'
  | 'fabric'
  | 'default';

export interface AsrpMaterialProfile {
  kind: AsrpMaterialKind;
  /** Parallax / height scale (UV units). */
  heightScale: number;
  /** Silhouette clip strength 0–1 (0 = interior POM only). */
  silhouetteWidth: number;
  /** Soften silhouette for anime hair/edges. */
  softSilhouette: boolean;
  /** Min / max ray-march layers (view-angle adaptive). */
  minLayers: number;
  maxLayers: number;
  normalBlend: number;
  reflectionInfluence: number;
  shadowInfluence: number;
}

export interface AsrpSettings {
  /** Master — Silhouette POM on by default. */
  enabled: boolean;
  /** Active pipeline selector (Classic / ASRP / RTX Lite). */
  pipeline: AsrpPipelineId;
  depthStrength: number;
  silhouetteWidth: number;
  quality: AsrpQualityTier | 'auto';
  samples: number | 'auto';
  distanceFade: number;
  heightScale: number;
  normalBlend: number;
  parallaxScale: number;
  shadowInfluence: number;
  reflectionInfluence: number;
  /** Generate height approx when no height/displacement map. */
  autoHeightApprox: boolean;
  /** Soft anime-friendly silhouette (prefer fade over hard discard). */
  animePreserve: boolean;
  /** Max POM quality during video export. */
  exportBoost: boolean;
}

export interface AsrpQualityProfile {
  tier: AsrpQualityTier;
  minLayers: number;
  maxLayers: number;
  refineSteps: number;
  depthScale: number;
  silhouette: boolean;
  distanceFadeStart: number;
  distanceFadeEnd: number;
}
