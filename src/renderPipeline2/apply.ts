/**
 * Bridge Render Pipeline 2.0 → live AppState (visualFx / ASRP / sky / composer).
 * Keeps live preview without restarting the renderer.
 */
import type { AppState, CharacterQuality, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import type { AsrpSettings } from '../asrp/types';
import type { ReflectionSystemSettings } from '../reflections/types';
import type { CinemaRenderSettings } from '../cinematicRender/cinemaMode';
import type { RenderPipeline2State, AoModeId, GiQualityPreset } from './types';
import { scalePipelineForDevice } from './quality';
import { detectRenderBackend } from './backend';

export interface RenderPipeline2ApplyResult {
  visualFx: Partial<VisualFxSettings>;
  asrp: Partial<AsrpSettings>;
  sceneComposer: Partial<SceneComposerState> & {
    lights?: Partial<SceneComposerState['lights']>;
  };
  rtxModeEnabled?: boolean;
  characterQuality?: CharacterQuality;
  dynamicSky?: Partial<NonNullable<AppState['dynamicSky']>>;
  cinemaRender?: Partial<CinemaRenderSettings>;
  cinematicRender?: {
    contactShadows?: boolean;
    softShadows?: boolean;
  };
  reflectionSystem?: Partial<ReflectionSystemSettings>;
  /** Runtime flags for ScenePostProcessing / Environment. */
  runtime: {
    backend: 'webgl' | 'webgpu';
    aoMode: AoModeId;
    giQuality: GiQualityPreset;
    contactShadowOpacity: number;
    contactShadowScale: number;
    contactShadowBlur: number;
    contactShadowFar: number;
    contactShadowsEnabled: boolean;
    bloomStyle: RenderPipeline2State['bloom']['style'];
    toneMapper: RenderPipeline2State['color']['toneMapper'];
    materialLook: RenderPipeline2State['materials']['look'];
    giIntensity: number;
    colorBleeding: number;
  };
}

function aoSamplesToN8Quality(
  samples: number
): 'performance' | 'low' | 'medium' | 'high' | 'ultra' {
  if (samples <= 6) return 'low';
  if (samples <= 10) return 'medium';
  if (samples <= 14) return 'high';
  return 'ultra';
}

function giToEnvBoost(gi: RenderPipeline2State['gi']): number {
  if (gi.mode === 'off') return 0.7;
  const q = { low: 0.85, medium: 1, high: 1.15, ultra: 1.3 }[gi.quality];
  return (0.55 + gi.intensity * 0.7 + gi.skyBounce * 0.25) * q;
}

export function applyRenderPipeline2(state: RenderPipeline2State): RenderPipeline2ApplyResult {
  const rp = scalePipelineForDevice(state);
  const backend = detectRenderBackend(rp.performance.backend);

  const aoOn = rp.ao.mode !== 'off';
  const giBoost = giToEnvBoost(rp.gi);
  const sunMul = rp.lights.sunIntensity * (0.7 + rp.gi.sunBounce * 0.5);

  const visualFx: Partial<VisualFxSettings> = {
    bloomEnabled: rp.bloom.enabled,
    bloomIntensity: rp.bloom.intensity,
    bloomThreshold: rp.bloom.threshold,
    bloomRadius: rp.bloom.radius,
    ssaoEnabled: aoOn,
    ssaoIntensity: rp.ao.intensity,
    ssaoRadius: rp.ao.radius,
    ssaoHalfRes: rp.ao.halfRes,
    smaaEnabled: rp.performance.temporalUpscale || rp.gi.temporalAccumulation,
    dofEnabled: rp.camera.dof,
    dofBokehScale: rp.camera.bokehScale,
    chromaticAberration: rp.camera.chromaticAberration,
    vignetteEnabled: rp.camera.vignette > 0.02,
    vignetteIntensity: rp.camera.vignette,
    colorGrade: rp.color.gradeAlias,
    toneExposure: rp.color.exposure,
    environmentIntensity: Math.min(1.6, giBoost),
    floorReflection:
      rp.reflections.mode === 'off' ? 0.35 : 0.55 + rp.reflections.intensity * 0.45,
    aoIntensity: rp.ao.intensity,
    godRaysEnabled: rp.volumetrics.godRays,
    godRaysDensity: rp.volumetrics.godRaysIntensity,
    postFxStackEnabled: true,
    materialDetailing: rp.materials.look !== 'toon',
    materialSmoothing: rp.materials.skinSoftness,
    renderMode:
      rp.materials.look === 'toon'
        ? 'mmd_fidelity'
        : rp.materials.look === 'anime'
          ? 'asrp'
          : 'pbr_cinematic',
  };

  if (rp.activePreset === 'rain') {
    visualFx.weatherPreset = 'rain';
    visualFx.wetness = 0.65;
  }

  const asrp: Partial<AsrpSettings> = {
    enabled: true,
    pipeline: 'asrp',
    exportBoost: true,
    animePreserve: rp.materials.look === 'anime' || rp.materials.look === 'toon',
    depthStrength: 0.8 + rp.ao.intensity * 0.25,
    shadowInfluence: 0.5 + rp.contactShadows.opacity * 0.4,
    reflectionInfluence: rp.reflections.intensity,
    quality:
      rp.gi.quality === 'ultra'
        ? 'ultra'
        : rp.gi.quality === 'high'
          ? 'ultra'
          : rp.gi.quality === 'low'
            ? 'simplified'
            : 'balanced',
  };

  const sceneComposer: RenderPipeline2ApplyResult['sceneComposer'] = {
    fogEnabled: rp.volumetrics.fogEnabled,
    fogDensity: Math.max(rp.volumetrics.distanceFog, rp.volumetrics.heightFog) * 0.08,
    exposure: rp.color.exposure,
    brightness: 1 + rp.color.temperature * 0.05,
    contrast: 1 + rp.color.contrast,
    saturation: 1 + (rp.color.toneMapper === 'anime' ? 0.08 : 0),
    lights: {
      sunIntensity: sunMul,
      hemisphereIntensity: rp.lights.skyIntensity * (0.6 + rp.gi.skyBounce * 0.5),
      ambientIntensity: rp.lights.ambientIntensity * (0.5 + rp.gi.indirectBounce * 0.4),
      sunShadows: true,
    } as Partial<SceneComposerState['lights']>,
  };

  let characterQuality: CharacterQuality | undefined;
  if (rp.gi.quality === 'ultra') characterQuality = 'uhd4k';
  else if (rp.gi.quality === 'high') characterQuality = 'hd';

  return {
    visualFx,
    asrp,
    sceneComposer,
    rtxModeEnabled: rp.gi.quality === 'high' || rp.gi.quality === 'ultra' || aoOn,
    characterQuality,
    dynamicSky: { enabled: true },
    cinemaRender: {
      softShadows: true,
    },
    cinematicRender: {
      contactShadows: rp.contactShadows.enabled,
      softShadows: true,
    },
    reflectionSystem: {
      enabled: rp.reflections.mode !== 'off',
      boxProjection: rp.reflections.mode === 'box' || rp.reflections.mode === 'hybrid',
      intensity: rp.reflections.intensity,
      characterReflections: true,
      environmentReflections: true,
      exportBoost: true,
    },
    runtime: {
      backend,
      aoMode: rp.ao.mode,
      giQuality: rp.gi.quality,
      contactShadowOpacity: rp.contactShadows.opacity,
      contactShadowScale: rp.contactShadows.scale,
      contactShadowBlur: rp.contactShadows.blur,
      contactShadowFar: rp.contactShadows.far,
      contactShadowsEnabled: rp.contactShadows.enabled,
      bloomStyle: rp.bloom.style,
      toneMapper: rp.color.toneMapper,
      materialLook: rp.materials.look,
      giIntensity: rp.gi.intensity,
      colorBleeding: rp.gi.colorBleeding,
    },
  };
}

/** N8AO tuning derived from AO mode profiles. */
export function resolveAoPassParams(rp: RenderPipeline2State): {
  enabled: boolean;
  aoRadius: number;
  intensity: number;
  quality: 'performance' | 'low' | 'medium' | 'high' | 'ultra';
  halfRes: boolean;
  distanceFalloff: number;
} {
  const mode = rp.ao.mode;
  if (mode === 'off') {
    return {
      enabled: false,
      aoRadius: 4,
      intensity: 0,
      quality: 'low',
      halfRes: true,
      distanceFalloff: 0.9,
    };
  }

  const baseRadius = Math.max(2, rp.ao.radius * 18);
  const profile = {
    ssao: { radiusMul: 1, intensityMul: 1, falloff: 0.9 },
    hbao: { radiusMul: 1.15, intensityMul: 1.15, falloff: 0.75 },
    gtao: { radiusMul: 0.9, intensityMul: 1.25, falloff: 0.7 },
    ssdo: { radiusMul: 1.35, intensityMul: 1.05, falloff: 0.85 },
    hybrid: { radiusMul: 1.1, intensityMul: 1.2, falloff: 0.78 },
    contact: { radiusMul: 0.55, intensityMul: 1.4, falloff: 0.55 },
  }[mode];

  return {
    enabled: true,
    aoRadius: baseRadius * profile.radiusMul,
    intensity: rp.ao.intensity * profile.intensityMul * Math.max(0.6, rp.ao.power),
    quality: aoSamplesToN8Quality(rp.ao.samples),
    halfRes: rp.ao.halfRes,
    distanceFalloff: profile.falloff,
  };
}

export function mergeRenderPipeline2(
  base: RenderPipeline2State,
  patch: Partial<RenderPipeline2State>
): RenderPipeline2State {
  return {
    ...base,
    ...patch,
    version: 2,
    activePreset: patch.activePreset ?? 'custom',
    gi: { ...base.gi, ...patch.gi },
    ao: { ...base.ao, ...patch.ao },
    contactShadows: { ...base.contactShadows, ...patch.contactShadows },
    reflections: { ...base.reflections, ...patch.reflections },
    volumetrics: { ...base.volumetrics, ...patch.volumetrics },
    bloom: { ...base.bloom, ...patch.bloom },
    color: { ...base.color, ...patch.color },
    materials: { ...base.materials, ...patch.materials },
    lights: { ...base.lights, ...patch.lights },
    camera: { ...base.camera, ...patch.camera },
    performance: { ...base.performance, ...patch.performance },
  };
}
