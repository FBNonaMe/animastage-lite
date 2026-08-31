import type {
  RayMmdColorGradeSettings,
  RayMmdBloomSettings,
  RayMmdSsrSettings,
  RayMmdVignetteSettings,
  RayMmdLensSettings,
} from './types';

export const RAY_MMD_COLOR_GRADE_NEUTRAL: RayMmdColorGradeSettings = {
  enabled: false,
  amount: 0,
  operator: 0,
  exposure: 0,
  temperature: 6500,
  saturation: 1,
  contrast: 1,
  gamma: 1,
  gain: 1,
  offset: 0,
  vignette: 0,
};

export const RAY_MMD_TONE_OPERATORS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Reinhard' },
  { value: 2, label: 'Hable · white 4' },
  { value: 3, label: 'Hable · white 8' },
  { value: 4, label: 'Hejl 2015' },
  { value: 5, label: 'ACES' },
  { value: 6, label: 'Naughty Dog' },
] as const;

export const RAY_MMD_GRADE_PRESETS: Record<
  string,
  { label: string; hint: string; settings: RayMmdColorGradeSettings }
> = {
  aces: {
    label: 'ACES film',
    hint: 'Ray-MMD ACES tone map · mild exposure',
    settings: {
      enabled: true,
      amount: 1,
      operator: 5,
      exposure: 0.12,
      temperature: 6500,
      saturation: 1.05,
      contrast: 1.02,
      gamma: 1,
      gain: 1,
      offset: 0,
      vignette: 0.18,
    },
  },
  reinhard: {
    label: 'Reinhard soft',
    hint: 'Gentle highlight roll-off',
    settings: {
      enabled: true,
      amount: 1,
      operator: 1,
      exposure: 0,
      temperature: 6200,
      saturation: 1,
      contrast: 1,
      gamma: 1,
      gain: 1,
      offset: 0,
      vignette: 0.12,
    },
  },
  night: {
    label: 'Cool night',
    hint: 'Blue temperature + vignette',
    settings: {
      enabled: true,
      amount: 0.92,
      operator: 5,
      exposure: -0.08,
      temperature: 8200,
      saturation: 0.92,
      contrast: 1.08,
      gamma: 1.05,
      gain: 1,
      offset: 0,
      vignette: 0.35,
    },
  },
};

export const RAY_MMD_BLOOM_NEUTRAL = {
  enabled: false,
  amount: 0,
  threshold: 1,
  radius: 2.2,
  mode: 4,
  tint: '#ffffff',
} as const;

export const RAY_MMD_BLOOM_PRESETS: Record<
  string,
  { label: string; hint: string; settings: RayMmdBloomSettings }
> = {
  hdr: {
    label: 'HDR glow',
    hint: 'Ray-MMD five-level bloom · luminance HDR',
    settings: {
      enabled: true,
      amount: 0.65,
      threshold: 1,
      radius: 2.2,
      mode: 4,
      tint: '#ffffff',
    },
  },
  soft: {
    label: 'Soft bloom',
    hint: 'Lower threshold · wider radius',
    settings: {
      enabled: true,
      amount: 0.45,
      threshold: 0.72,
      radius: 3.1,
      mode: 3,
      tint: '#fff8f0',
    },
  },
  neon: {
    label: 'Neon punch',
    hint: 'Strong HDR extract · cyan tint',
    settings: {
      enabled: true,
      amount: 1.1,
      threshold: 0.85,
      radius: 2.6,
      mode: 4,
      tint: '#a8f0ff',
    },
  },
};

export const RAY_MMD_SSR_NEUTRAL: RayMmdSsrSettings = {
  enabled: false,
  amount: 0,
  threshold: 1,
  rangeScale: 0.75,
  fadeStart: 0.8,
  maxDistance: 48,
};

export const RAY_MMD_SSR_PRESETS: Record<
  string,
  { label: string; hint: string; settings: RayMmdSsrSettings }
> = {
  floor: {
    label: 'Floor SSR',
    hint: 'Ray-MMD cone trace · floor bounce',
    settings: {
      enabled: true,
      amount: 0.55,
      threshold: 1,
      rangeScale: 0.75,
      fadeStart: 0.82,
      maxDistance: 42,
    },
  },
  glossy: {
    label: 'Glossy',
    hint: 'Stronger SSR · shorter range',
    settings: {
      enabled: true,
      amount: 0.78,
      threshold: 0.85,
      rangeScale: 0.62,
      fadeStart: 0.75,
      maxDistance: 32,
    },
  },
};

export const RAY_MMD_VIGNETTE_NEUTRAL: RayMmdVignetteSettings = {
  enabled: false,
  amount: 0,
  mix: 1,
  inner: 0.72,
  outer: 1.28,
};

export const RAY_MMD_VIGNETTE_PRESETS: Record<
  string,
  { label: string; hint: string; settings: RayMmdVignetteSettings }
> = {
  cinematic: {
    label: 'Cinematic',
    hint: 'Ray-MMD ColorVignette · soft edge',
    settings: {
      enabled: true,
      amount: 0.42,
      mix: 1,
      inner: 0.68,
      outer: 1.22,
    },
  },
  heavy: {
    label: 'Heavy frame',
    hint: 'Strong vignette · music video',
    settings: {
      enabled: true,
      amount: 0.85,
      mix: 1,
      inner: 0.55,
      outer: 1.05,
    },
  },
};

export const RAY_MMD_LENS_NEUTRAL: RayMmdLensSettings = {
  enabled: false,
  dispersion: 0,
  radius: 0.35,
  mix: 1,
};

export const RAY_MMD_LENS_PRESETS: Record<
  string,
  { label: string; hint: string; settings: RayMmdLensSettings }
> = {
  subtle: {
    label: 'Subtle lens',
    hint: 'Ray-MMD radial RGB dispersion',
    settings: {
      enabled: true,
      dispersion: 0.18,
      radius: 0.42,
      mix: 0.85,
    },
  },
  anamorphic: {
    label: 'Anamorphic',
    hint: 'Strong edge chromatic aberration',
    settings: {
      enabled: true,
      dispersion: 0.38,
      radius: 0.28,
      mix: 1,
    },
  },
};

export const DEFAULT_ANIME_NPR_SETTINGS = {
  acknowledged: false,
  preset: 'starrail',
  strength: 1,
} as const;
