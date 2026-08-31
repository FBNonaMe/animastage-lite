/**
 * ASRP V2 — unified frame-graph types.
 * One resolve path owns materials, shadows, reflections, post, and cinema budgets.
 */
import type { AsrpPipelineId, AsrpQualityTier } from '../types';

export type AsrpVisualStyleId =
  | 'anime_soft'
  | 'anime_bright'
  | 'anime_cinematic'
  | 'stylized'
  | 'realistic'
  | 'cyberpunk'
  | 'warm_sunset'
  | 'night'
  | 'studio'
  | 'dramatic';

export type AsrpShadowTier = 'off' | 'low' | 'medium' | 'high' | 'ultra';
export type AsrpReflectionBudget = 'off' | 'low' | 'medium' | 'high' | 'ultra';
export type AsrpPostBudget = 'minimal' | 'balanced' | 'cinematic' | 'cinema_max';
export type AsrpMaterialShadingMode = 'classic_toon' | 'hybrid' | 'pbr_detail';

export interface AsrpFrameBudgets {
  shadowTier: AsrpShadowTier;
  softShadows: boolean;
  contactShadows: boolean;
  reflectionBudget: AsrpReflectionBudget;
  reflectionResolution: number;
  reflectionRefreshRate: number;
  postBudget: AsrpPostBudget;
  ssao: boolean;
  ssaoHalfRes: boolean;
  smaa: boolean;
  bloom: boolean;
  bloomIntensity: number;
  dof: boolean;
  vignette: boolean;
  chromatic: boolean;
  colorGrade: boolean;
  /** God rays unsupported in current post stack — always false until Phase G stable pass. */
  godRays: boolean;
  /** Cinema / Ultra only — screen-space reflections (Phase G). */
  ssr: boolean;
  /** Cinema / Ultra — enhanced temporal-ish AA (SMAA + optional accumulation). */
  temporalAa: boolean;
  /** Soft volumetric fog density 0–1. */
  volumetricFog: number;
  /** Light shafts intensity 0–1 (stable approximation). */
  lightShafts: number;
  /** PCSS-like soft shadow softness boost. */
  pcssSoftness: number;
  pomEnabled: boolean;
  pomSamples: number;
  materialShading: AsrpMaterialShadingMode;
  animeShadingStrength: number;
  dprCap: number;
  multisampling: number;
  motionBlur: boolean;
  motionBlurStrength: number;
  frameAccumulation: number;
}

export interface AsrpFrameState {
  pipeline: AsrpPipelineId;
  qualityTier: AsrpQualityTier;
  styleId: AsrpVisualStyleId;
  cinema: boolean;
  exporting: boolean;
  mobile: boolean;
  portraitLite: boolean;
  budgets: AsrpFrameBudgets;
  /** Effective visualFx overrides applied on top of AppState for this frame. */
  visualFxOverrides: Partial<{
    bloomEnabled: boolean;
    bloomIntensity: number;
    ssaoEnabled: boolean;
    ssaoHalfRes: boolean;
    smaaEnabled: boolean;
    dofEnabled: boolean;
    vignetteEnabled: boolean;
    chromaticAberration: number;
    godRaysEnabled: boolean;
    postFxStackEnabled: boolean;
    colorGrade: string;
  }>;
  reflectionOverrides: Partial<{
    enabled: boolean;
    intensity: number;
    resolution: number;
    refreshRate: number;
    exportBoost: boolean;
  }>;
  asrpOverrides: Partial<{
    enabled: boolean;
    pipeline: AsrpPipelineId;
    quality: AsrpQualityTier | 'auto';
    samples: number | 'auto';
    exportBoost: boolean;
  }>;
}

export interface ResolveAsrpFrameOptions {
  cinema?: boolean;
  exporting?: boolean;
  /** Force portrait lite path (viewport 9:16 without cinema). */
  portraitLite?: boolean;
  /** Override style for one-shot apply (Auto Director). */
  styleId?: AsrpVisualStyleId;
}
