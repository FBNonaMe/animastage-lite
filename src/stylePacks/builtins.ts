import { applyLookPreset } from '../visualFx/visualFxPresets';
import { MMD_RTX_LITE_STYLES } from '../visualFx/mmdRtxLitePresets';
import type { BuiltinStyle, StylePackFxConfig } from './types';

function patchOnly(patch: StylePackFxConfig) {
  return { fx: patch };
}

function fromLook(id: 'anime' | 'portrait') {
  const full = applyLookPreset(id);
  const {
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    vignetteEnabled,
    vignetteIntensity,
    dofEnabled,
    dofFocusDistance,
    dofBokehScale,
    chromaticAberration,
    colorGrade,
    scenePreset,
    lightPreset,
    particlesEnabled,
    particlePreset,
    particleIntensity,
    environmentIntensity,
    floorReflection,
    aoIntensity,
    toneExposure,
    ssaoEnabled,
    ssaoIntensity,
    materialDetailing,
    materialSmoothing,
    weatherPreset,
  } = full;
  return patchOnly({
    bloomEnabled,
    bloomIntensity,
    bloomThreshold,
    bloomRadius,
    vignetteEnabled,
    vignetteIntensity,
    dofEnabled,
    dofFocusDistance,
    dofBokehScale,
    chromaticAberration,
    colorGrade,
    scenePreset,
    lightPreset,
    particlesEnabled,
    particlePreset,
    particleIntensity,
    environmentIntensity,
    floorReflection,
    aoIntensity,
    toneExposure,
    ssaoEnabled,
    ssaoIntensity,
    materialDetailing,
    materialSmoothing,
    weatherPreset,
  });
}

function fromRtxLite(id: 'dawn' | 'neon') {
  const preset = MMD_RTX_LITE_STYLES.find((s) => s.id === id);
  return patchOnly(preset?.patch ?? {});
}

export const BUILTIN_STYLES: BuiltinStyle[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Balanced studio lighting — clean and neutral.',
    swatch: 'from-zinc-600 to-zinc-800',
    config: { fx: { bloomEnabled: true, bloomIntensity: 0.38, bloomThreshold: 0.5 }, characterQuality: 'hd' },
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Bright colors, soft bloom, sparkles and anime outline.',
    swatch: 'from-pink-500 to-cyan-500',
    config: { ...fromLook('anime'), characterQuality: 'hd' },
  },
  {
    id: 'soft',
    name: 'Soft',
    description: 'Warm sunset glow, gentle DOF and petals.',
    swatch: 'from-amber-300 to-rose-300',
    config: { ...fromRtxLite('dawn'), characterQuality: 'hd' },
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    description: 'Dreamy portrait lighting with warm grade and petals.',
    swatch: 'from-violet-500 to-fuchsia-400',
    config: { ...fromLook('portrait'), characterQuality: 'hd' },
  },
  {
    id: 'studio',
    name: 'Studio',
    description: 'Pro photo studio — crisp light, subtle bloom.',
    swatch: 'from-slate-500 to-slate-700',
    config: {
      fx: {
        bloomEnabled: true,
        bloomIntensity: 0.28,
        bloomThreshold: 0.72,
        vignetteEnabled: false,
        dofEnabled: false,
        colorGrade: 'neutral',
        scenePreset: 'studio',
        lightPreset: 'natural',
        particlesEnabled: false,
        environmentIntensity: 0.88,
        floorReflection: 0.76,
        aoIntensity: 3.6,
        toneExposure: 1.0,
        ssaoEnabled: true,
        ssaoIntensity: 1.0,
        materialDetailing: true,
        materialSmoothing: 0.45,
      },
      characterQuality: 'hd',
    },
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Neon club lights, vaporwave colors and confetti.',
    swatch: 'from-emerald-400 to-fuchsia-600',
    config: { ...fromRtxLite('neon'), characterQuality: 'standard' },
  },
];

export function getBuiltinStyle(id: string): BuiltinStyle | undefined {
  return BUILTIN_STYLES.find((s) => s.id === id);
}

export function builtinStyleKey(id: string): string {
  return `builtin:${id}`;
}

export function packStyleKey(id: string): string {
  return `pack:${id}`;
}
