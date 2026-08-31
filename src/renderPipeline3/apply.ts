/**
 * Bridge Render Pipeline 3.0 → live AppState + derived RP2 for shared passes.
 */
import type { AppState, CharacterQuality, ParticlePresetId, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import type { AsrpSettings } from '../asrp/types';
import type { ReflectionSystemSettings } from '../reflections/types';
import type { CinemaRenderSettings } from '../cinematicRender/cinemaMode';
import type { RenderPipeline2State } from '../renderPipeline2/types';
import {
  applyRenderPipeline2,
  type RenderPipeline2ApplyResult,
} from '../renderPipeline2/apply';
import type { RenderPipeline3State } from './types';
import { scalePipeline3ForDevice } from './quality';
import { detectRenderBackend } from '../renderPipeline2/backend';

export interface RenderPipeline3ApplyResult extends RenderPipeline2ApplyResult {
  /** Keep RP2 in sync for ScenePostProcessing AO / bloom style. */
  renderPipeline2: RenderPipeline2State;
  runtime3: {
    weatherMode: RenderPipeline3State['weather']['mode'];
    particleCount: number;
    taaMode: RenderPipeline3State['taa']['mode'];
    lensFocal: RenderPipeline3State['lens']['focal'];
    waterEnabled: boolean;
    vegetationEnabled: boolean;
    probeScene: RenderPipeline3State['probes']['scene'];
    exportPasses: RenderPipeline3State['passes']['enabled'];
    graph: RenderPipeline3State['graph'];
  };
}

function toParticlePreset(
  preset: RenderPipeline3State['particles']['preset']
): ParticlePresetId {
  switch (preset) {
    case 'leaves':
      return 'petals';
    case 'smoke':
      return 'dust';
    case 'fire':
      return 'sparkles';
    case 'magic':
      return 'fireflies';
    case 'none':
    case 'snow':
    case 'sparkles':
    case 'petals':
    case 'confetti':
    case 'dust':
    case 'fireflies':
      return preset;
    default:
      return 'none';
  }
}

function toRp2(state: RenderPipeline3State): RenderPipeline2State {
  return {
    version: 2,
    enabled: state.enabled,
    activePreset:
      state.activePreset === 'snow' || state.activePreset === 'custom'
        ? 'custom'
        : state.activePreset === 'classic_mmd' ||
            state.activePreset === 'anime' ||
            state.activePreset === 'studio' ||
            state.activePreset === 'photoreal' ||
            state.activePreset === 'cinematic' ||
            state.activePreset === 'fantasy' ||
            state.activePreset === 'cyberpunk' ||
            state.activePreset === 'golden_hour' ||
            state.activePreset === 'night' ||
            state.activePreset === 'rain' ||
            state.activePreset === 'fog' ||
            state.activePreset === 'sunset'
          ? state.activePreset
          : 'custom',
    gi: state.graph.gi ? state.gi : { ...state.gi, mode: 'off' },
    ao: state.graph.ao ? state.ao : { ...state.ao, mode: 'off' },
    contactShadows: state.contactShadows,
    reflections: {
      ...state.reflections,
      intensity: state.reflections.intensity * (0.6 + state.probes.intensity * 0.4),
      probeBlending: state.probes.blending,
      autoProbes: state.probes.enabled,
    },
    volumetrics: state.volumetrics,
    bloom: state.graph.bloom ? state.bloom : { ...state.bloom, enabled: false },
    color: state.color,
    materials: {
      look: state.materials.look,
      skinEnabled: state.materials.skinEnabled,
      skinSoftness: state.materials.skinSoftness,
      skinBackLight: state.materials.skinBackLight,
      eyeWetness: state.materials.eyeWetness,
      hairAnisotropy: state.materials.hairAnisotropy,
      autoConvert: state.materials.autoConvert,
    },
    lights: {
      sunIntensity: state.lights.sunIntensity,
      skyIntensity: state.lights.skyIntensity,
      ambientIntensity: state.lights.ambientIntensity,
      temperature: state.lights.temperature,
      shadowResolution: state.lights.shadowResolution,
      volumetrics: state.lights.volumetrics,
    },
    camera: state.camera,
    performance: {
      ...state.performance,
      temporalUpscale:
        state.performance.temporalUpscale ||
        state.taa.mode === 'taa' ||
        state.taa.mode === 'txaa',
    },
  };
}

function weatherToVisualFx(weather: RenderPipeline3State['weather']): Partial<VisualFxSettings> {
  const mode = weather.mode === 'storm' ? 'storm' : weather.mode;
  if (mode === 'clear' || weather.intensity < 0.05) {
    return {
      weatherPreset: 'clear',
      precipIntensity: 0,
      wetness: weather.wetGround,
      snowGround: weather.snowAccumulation,
    };
  }
  return {
    weatherPreset: mode,
    precipIntensity: weather.intensity,
    wetness: Math.max(weather.wetGround, mode === 'rain' || mode === 'storm' ? 0.55 : 0),
    snowGround: mode === 'snow' ? Math.max(weather.snowAccumulation, 0.4) : weather.snowAccumulation,
  };
}

export function applyRenderPipeline3(state: RenderPipeline3State): RenderPipeline3ApplyResult {
  const rp = scalePipeline3ForDevice(state);
  const rp2 = toRp2(rp);
  const base = applyRenderPipeline2(rp2);
  const backend = detectRenderBackend(rp.performance.backend);

  const weatherFx = weatherToVisualFx(rp.weather);
  const particlePreset = toParticlePreset(rp.particles.preset);
  const particlesOn = rp.particles.enabled && particlePreset !== 'none';

  const visualFx: Partial<VisualFxSettings> = {
    ...base.visualFx,
    ...weatherFx,
    particlesEnabled: particlesOn,
    particlePreset: particlesOn ? particlePreset : 'none',
    particleIntensity: rp.particles.intensity,
    smaaEnabled:
      rp.taa.mode !== 'off' ||
      rp.performance.temporalUpscale ||
      rp.gi.temporalAccumulation,
    floorReflection: Math.min(
      1.4,
      (base.visualFx.floorReflection ?? 0.5) +
        (rp.water.enabled ? rp.water.reflection * 0.25 : 0) +
        rp.weather.wetGround * 0.2
    ),
    bloomEnabled: rp.graph.bloom ? rp.bloom.enabled : false,
    dofFocalLength:
      rp.lens.focal === '24mm'
        ? 24
        : rp.lens.focal === '35mm'
          ? 35
          : rp.lens.focal === '85mm'
            ? 85
            : rp.lens.focal === '135mm'
              ? 135
              : 50,
  };

  if (rp.weather.mode === 'fog' || rp.volumetrics.fogEnabled) {
    // composer fog already set in base when volumetrics on
  }

  const sceneComposer: RenderPipeline3ApplyResult['sceneComposer'] = {
    ...base.sceneComposer,
    // RP4: fog stays project-owned — weather fog mode only densifies when fog already on.
    fogEnabled: Boolean(base.sceneComposer.fogEnabled),
    fogDensity:
      base.sceneComposer.fogEnabled && rp.weather.mode === 'fog'
        ? Math.max(base.sceneComposer.fogDensity ?? 0, rp.weather.intensity * 0.1)
        : (base.sceneComposer.fogDensity ?? 0),
    lights: {
      ...base.sceneComposer.lights,
      sunIntensity:
        (base.sceneComposer.lights?.sunIntensity ?? rp.lights.sunIntensity) *
        (rp.weather.cloudCover > 0.5 ? 1 - rp.weather.cloudCover * 0.35 : 1),
      hemisphereIntensity:
        (base.sceneComposer.lights?.hemisphereIntensity ?? 1) *
        (0.85 + rp.lights.moonIntensity * 0.15),
    },
  };

  let characterQuality: CharacterQuality | undefined = base.characterQuality;
  if (rp.gi.quality === 'ultra') characterQuality = 'uhd4k';
  else if (rp.gi.quality === 'high') characterQuality = 'hd';

  return {
    ...base,
    visualFx,
    sceneComposer,
    characterQuality,
    renderPipeline2: rp2,
    dynamicSky: {
      enabled: rp.graph.sky,
      ...(base.dynamicSky ?? {}),
    },
    runtime: {
      ...base.runtime,
      backend,
    },
    runtime3: {
      weatherMode: rp.weather.mode,
      particleCount: rp.particles.count,
      taaMode: rp.taa.mode,
      lensFocal: rp.lens.focal,
      waterEnabled: rp.water.enabled,
      vegetationEnabled: rp.vegetation.enabled,
      probeScene: rp.probes.scene,
      exportPasses: rp.passes.enabled,
      graph: rp.graph,
    },
  };
}

export type { AppState };
