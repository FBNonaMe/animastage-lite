/** Standalone Effects Platform catalog (`effects-catalog.json`). */
export interface StandaloneEffectCatalogEntry {
  id: string;
  version?: string;
  name: string;
  author: string;
  category: string;
  status: string;
  runtimeCompatible: boolean;
  bundled?: boolean;
  adaptedEntry?: string;
  originalEntry?: string;
  rendererSupport?: string[];
  license?: {
    type: string;
    redistributionAllowed?: boolean;
    commercialUseAllowed?: boolean;
    modificationAllowed?: boolean;
  };
}

export interface StandaloneEffectsCatalog {
  schema: string;
  generatedAt: string;
  effects: StandaloneEffectCatalogEntry[];
}

export interface RayMmdColorGradeSettings {
  enabled: boolean;
  amount: number;
  /** 0=None, 1=Reinhard, 2=Hable4, 3=Hable8, 4=Hejl, 5=ACES, 6=Naughty Dog */
  operator: number;
  exposure: number;
  temperature: number;
  saturation: number;
  contrast: number;
  gamma: number;
  gain: number;
  offset: number;
  vignette: number;
}

export interface RayMmdBloomSettings {
  enabled: boolean;
  amount: number;
  threshold: number;
  radius: number;
  /** 1=Linear HDR, 2=Clamped, 3=Luminance, 4=Luminance HDR */
  mode: number;
  tint: string;
}

/** Ray-MMD PostProcessSSR.fxsub — simplified screen-space cone trace (MIT). */
export interface RayMmdSsrSettings {
  enabled: boolean;
  amount: number;
  threshold: number;
  rangeScale: number;
  fadeStart: number;
  maxDistance: number;
}

/** Ray-MMD ColorGrading.fxsub ColorVignette — dedicated pass (MIT). */
export interface RayMmdVignetteSettings {
  enabled: boolean;
  amount: number;
  /** Mix 0..1 */
  mix: number;
  inner: number;
  outer: number;
}

/** Ray-MMD PostProcessHDR.fxsub ColorDispersion mode 1 — radial RGB shift (MIT). */
export interface RayMmdLensSettings {
  enabled: boolean;
  /** Chromatic dispersion strength */
  dispersion: number;
  /** Inner radius for radial falloff */
  radius: number;
  mix: number;
}

export interface AnimeNprSettings {
  /** User accepted GPL-3.0 terms for Star Rail NPR port. */
  acknowledged: boolean;
  preset: string;
  strength: number;
}
