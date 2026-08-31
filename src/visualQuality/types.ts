/**
 * Visual Quality 2.0 — unified quality budgets.
 * Resolves shadows / AO / fog / particles / post from one profile.
 */

export type VqQualityPreset =
  | 'preview'
  | 'fast'
  | 'balanced'
  | 'high'
  | 'ultra'
  | 'cinematic'
  | 'photo';

export type VqFogQuality = 'off' | 'low' | 'medium' | 'high' | 'ultra' | 'cinematic';

export interface VqBudget {
  preset: VqQualityPreset;
  /** When true, A/B compare uses legacy path (pre-VQ2 clamps). */
  legacyCompare: boolean;
  dprScale: number;
  shadowMapSize: number;
  softShadows: boolean;
  contactShadows: boolean;
  contactShadowResolution: number;
  /** Cascaded shadow maps — desktop high+ only. */
  csm: boolean;
  csmCascades: number;
  ao: boolean;
  aoHalfRes: boolean;
  bloom: boolean;
  bloomIntensityCap: number;
  dof: boolean;
  smaa: boolean;
  reflections: boolean;
  godRays: boolean;
  fogQuality: VqFogQuality;
  fogNoise: boolean;
  heightFog: boolean;
  particleScale: number;
  weatherLayers: 1 | 2 | 3;
  wetness: boolean;
  exposureClamp: number;
}

export interface VqResolveContext {
  mobile: boolean;
  portraitLite: boolean;
  /** Cinema / offline / photo capture — unlock max quality. */
  captureBoost: boolean;
  /** User prefers photo still quality. */
  photoMode: boolean;
  renderTier: 'lite' | 'pro';
  /** Base shadow size before VQ ladder. */
  baseShadowMapSize: number;
  /** Force legacy compare path. */
  legacyCompare?: boolean;
  preferredPreset?: VqQualityPreset | null;
}
