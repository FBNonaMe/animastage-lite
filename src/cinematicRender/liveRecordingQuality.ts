/**
 * Live MediaRecorder performance profile — opposite of offline Cinema / MP4 HQ bump.
 * Keeps look readable while protecting realtime FPS (esp. 9:16 + Render Pipeline 2/3).
 */
import type { AppState, ViewportFormat, VisualFxSettings } from '../types';
import type { SceneComposerState } from '../sceneComposer/types';
import type {
  RenderPipeline2State,
  GiQualityPreset,
  GiSettings,
  AoSettings,
  ContactShadowSettings,
  ReflectionSettings,
  VolumetricSettings,
  BloomSettings,
  CameraRenderSettings,
  LightMixerSettings,
  PerformanceSettings,
} from '../renderPipeline2/types';
import type { RenderPipeline3State } from '../renderPipeline3/types';
import type { RtxAoQuality, RtxSettings } from '../utils/rtxSettings';
import { isPortraitFormat } from '../utils/characterQuality';
import type { ExportQualitySnapshot } from './exportQuality';

function stepDownGi(q: GiQualityPreset): GiQualityPreset {
  if (q === 'ultra') return 'medium';
  if (q === 'high') return 'medium';
  if (q === 'medium') return 'low';
  return 'low';
}

function liveGi(gi: GiSettings, portrait: boolean): GiSettings {
  return {
    ...gi,
    quality: stepDownGi(gi.quality),
    halfResolution: true,
    intensity: Math.min(gi.intensity, portrait ? 0.4 : 0.5),
    denoiser: portrait ? false : gi.denoiser,
  };
}

function liveAo(ao: AoSettings, portrait: boolean): AoSettings {
  return {
    ...ao,
    samples: Math.min(ao.samples, portrait ? 4 : 8),
    halfRes: true,
    temporal: true,
    intensity: Math.min(ao.intensity, portrait ? 0.75 : 0.9),
  };
}

function liveContactShadows(
  cs: ContactShadowSettings,
  portrait: boolean
): ContactShadowSettings {
  return {
    ...cs,
    enabled: portrait ? false : cs.enabled,
    blur: Math.min(cs.blur, 1.4),
    opacity: Math.min(cs.opacity, 0.4),
  };
}

function liveReflections(r: ReflectionSettings, portrait: boolean): ReflectionSettings {
  return {
    ...r,
    mode: portrait ? 'off' : r.mode === 'hybrid' ? 'probe' : r.mode,
    intensity: Math.min(r.intensity, 0.45),
    autoProbes: false,
  };
}

function liveVolumetrics(v: VolumetricSettings): VolumetricSettings {
  return {
    ...v,
    godRays: false,
    lightShafts: 0,
    cloudShadows: 0,
    scattering: Math.min(v.scattering, 0.15),
  };
}

function liveBloom(b: BloomSettings, portrait: boolean): BloomSettings {
  return {
    ...b,
    intensity: Math.min(b.intensity, portrait ? 0.28 : 0.4),
    radius: Math.min(b.radius, 0.55),
    lensDirt: 0,
    style: b.style === 'multi_res' ? 'soft' : b.style,
  };
}

function liveCamera(c: CameraRenderSettings): CameraRenderSettings {
  return {
    ...c,
    dof: false,
    motionBlur: 0,
    filmGrain: Math.min(c.filmGrain, 0.05),
    chromaticAberration: Math.min(c.chromaticAberration, 0.0004),
  };
}

function liveLights(l: LightMixerSettings): LightMixerSettings {
  return {
    ...l,
    shadowResolution:
      l.shadowResolution === 'ultra' || l.shadowResolution === 'high'
        ? 'medium'
        : l.shadowResolution,
    volumetrics: Math.min(l.volumetrics, 0.2),
  };
}

function livePerf(p: PerformanceSettings): PerformanceSettings {
  return {
    ...p,
    temporalUpscale: false,
    occlusionCulling: false,
    adaptiveSampling: true,
  };
}

function scalePipeline2ForLive(
  rp: RenderPipeline2State,
  portrait: boolean
): RenderPipeline2State {
  return {
    ...rp,
    gi: liveGi(rp.gi, portrait),
    ao: liveAo(rp.ao, portrait),
    contactShadows: liveContactShadows(rp.contactShadows, portrait),
    reflections: liveReflections(rp.reflections, portrait),
    volumetrics: liveVolumetrics(rp.volumetrics),
    bloom: liveBloom(rp.bloom, portrait),
    camera: liveCamera(rp.camera),
    lights: liveLights(rp.lights),
    performance: livePerf(rp.performance),
  };
}

function scalePipeline3ForLive(
  rp: RenderPipeline3State,
  portrait: boolean
): RenderPipeline3State {
  return {
    ...rp,
    gi: liveGi(rp.gi, portrait),
    ao: liveAo(rp.ao, portrait),
    contactShadows: liveContactShadows(rp.contactShadows, portrait),
    reflections: liveReflections(rp.reflections, portrait),
    volumetrics: liveVolumetrics(rp.volumetrics),
    bloom: liveBloom(rp.bloom, portrait),
    camera: liveCamera(rp.camera),
    lights: {
      ...liveLights(rp.lights),
      moonIntensity: Math.min(rp.lights.moonIntensity, 0.35),
    },
    performance: livePerf(rp.performance),
    particles: {
      ...rp.particles,
      enabled: portrait ? false : rp.particles.enabled,
      count: Math.min(rp.particles.count, portrait ? 0 : 2500),
      intensity: Math.min(rp.particles.intensity, 0.4),
    },
    vegetation: {
      ...rp.vegetation,
      density: Math.min(rp.vegetation.density, 0.25),
      trees: false,
    },
    water: {
      ...rp.water,
      caustics: Math.min(rp.water.caustics, 0.1),
      reflection: Math.min(rp.water.reflection, 0.45),
    },
    probes: {
      ...rp.probes,
      count: 1,
      intensity: Math.min(rp.probes.intensity, 0.5),
    },
    taa: {
      ...rp.taa,
      mode: 'smaa',
      historyWeight: Math.min(rp.taa.historyWeight, 0.7),
    },
    weather: {
      ...rp.weather,
      thunder: false,
      intensity: Math.min(rp.weather.intensity, portrait ? 0.2 : 0.45),
      rainRipples: portrait ? 0 : Math.min(rp.weather.rainRipples, 0.25),
      snowAccumulation: portrait ? 0 : Math.min(rp.weather.snowAccumulation, 0.2),
    },
  };
}

function stepDownAoQuality(q: RtxAoQuality): RtxAoQuality {
  if (q === 'ultra' || q === 'high') return 'medium';
  if (q === 'medium') return 'low';
  if (q === 'low') return 'performance';
  return 'performance';
}

/**
 * Temporarily lighten the scene for LIVE capture. Restores via snapshot.restore.
 */
export function prepareLiveRecordingQuality(
  appState: AppState,
  viewportFormat: ViewportFormat = '16:9'
): ExportQualitySnapshot {
  const portrait = isPortraitFormat(viewportFormat);

  const restore: Partial<AppState> = {
    visualFx: { ...appState.visualFx },
    sceneComposer: {
      ...appState.sceneComposer,
      lights: { ...appState.sceneComposer.lights },
      effectLevels: { ...appState.sceneComposer.effectLevels },
    },
    characterQuality: appState.characterQuality,
    rtxModeEnabled: appState.rtxModeEnabled,
    rtxSettings: { ...appState.rtxSettings },
    reflectionSystem: appState.reflectionSystem
      ? { ...appState.reflectionSystem }
      : undefined,
    asrp: appState.asrp ? { ...appState.asrp } : undefined,
    renderPipeline2: appState.renderPipeline2
      ? structuredClone(appState.renderPipeline2)
      : undefined,
    renderPipeline3: appState.renderPipeline3
      ? structuredClone(appState.renderPipeline3)
      : undefined,
  };

  const heavyWeather =
    appState.visualFx.weatherPreset === 'rain' ||
    appState.visualFx.weatherPreset === 'snow' ||
    appState.visualFx.weatherPreset === 'storm';

  const composer: SceneComposerState = {
    ...appState.sceneComposer,
    // Never flip Fog on for LIVE — keep project fog exactly as-is.
    fogEnabled: appState.sceneComposer.fogEnabled,
    fogDensity: appState.sceneComposer.fogDensity,
    fogColor: appState.sceneComposer.fogColor,
    lights: {
      ...appState.sceneComposer.lights,
      // Keep shadows for depth — flat look was from killing sunShadows + AO.
      sunShadows: true,
      sunIntensity: Math.max(appState.sceneComposer.lights.sunIntensity ?? 1, 1.05),
      hemisphereIntensity: Math.max(
        appState.sceneComposer.lights.hemisphereIntensity ?? 1,
        1.05
      ),
      ambientIntensity: Math.max(appState.sceneComposer.lights.ambientIntensity ?? 1, 0.95),
    },
    effectLevels: {
      ...appState.sceneComposer.effectLevels,
      ao:
        appState.sceneComposer.effectLevels.ao === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.ao === 'high'
            ? 'medium'
            : appState.sceneComposer.effectLevels.ao,
      rim:
        appState.sceneComposer.effectLevels.rim === 'off'
          ? 'low'
          : appState.sceneComposer.effectLevels.rim,
      reflection:
        appState.sceneComposer.effectLevels.reflection === 'high'
          ? 'low'
          : appState.sceneComposer.effectLevels.reflection,
    },
  };

  const fx: VisualFxSettings = {
    ...appState.visualFx,
    ssaoHalfRes: true,
    // Light AO for volume — not fog.
    ssaoEnabled: true,
    ssaoIntensity: Math.min(Math.max(appState.visualFx.ssaoIntensity ?? 0.85, 0.7), 1.0),
    dofEnabled: false,
    godRaysEnabled: false,
    particlesEnabled: portrait ? false : appState.visualFx.particlesEnabled,
    particleIntensity: Math.min(appState.visualFx.particleIntensity ?? 0.5, 0.35),
    weatherPreset: portrait && heavyWeather ? 'clear' : appState.visualFx.weatherPreset,
    precipIntensity: portrait && heavyWeather ? 0 : appState.visualFx.precipIntensity,
    floorReflection: Math.min(appState.visualFx.floorReflection ?? 0.7, portrait ? 0.4 : 0.62),
    materialDetailing: true,
    environmentIntensity: Math.max(appState.visualFx.environmentIntensity ?? 0.72, 0.8),
  };

  // Drop one quality tier on portrait; never bump during live.
  let characterQuality = appState.characterQuality;
  if (portrait) {
    if (characterQuality === 'uhd4k') characterQuality = 'hd';
    else if (characterQuality === 'hd') characterQuality = 'standard';
  } else if (characterQuality === 'uhd4k') {
    characterQuality = 'hd';
  }

  const rtxSettings: RtxSettings = {
    ...appState.rtxSettings,
    halfResAo: true,
    aoQuality: stepDownAoQuality(appState.rtxSettings.aoQuality),
    aoIntensity: Math.min(appState.rtxSettings.aoIntensity ?? 2, portrait ? 1.4 : 1.8),
    rtxBloomStrength: Math.min(appState.rtxSettings.rtxBloomStrength ?? 0.14, 0.1),
  };

  const patch: Partial<AppState> = {
    visualFx: fx,
    sceneComposer: composer,
    characterQuality,
    rtxSettings,
    reflectionSystem: appState.reflectionSystem
      ? {
          ...appState.reflectionSystem,
          exportBoost: false,
          refreshRate: Math.max(appState.reflectionSystem.refreshRate ?? 2.5, portrait ? 6 : 4),
          resolution: portrait ? 128 : appState.reflectionSystem.resolution,
        }
      : undefined,
    asrp: appState.asrp
      ? {
          ...appState.asrp,
          exportBoost: false,
        }
      : undefined,
  };

  if (appState.renderPipeline3?.enabled) {
    const scaled3 = scalePipeline3ForLive(appState.renderPipeline3, portrait);
    patch.renderPipeline3 = scaled3;
    if (appState.renderPipeline2?.enabled) {
      patch.renderPipeline2 = scalePipeline2ForLive(
        {
          ...appState.renderPipeline2,
          gi: scaled3.gi,
          ao: scaled3.ao,
          contactShadows: scaled3.contactShadows,
          reflections: scaled3.reflections,
          bloom: scaled3.bloom,
          camera: scaled3.camera,
          lights: scaled3.lights,
          performance: scaled3.performance,
          volumetrics: scaled3.volumetrics,
        },
        portrait
      );
    }
  } else if (appState.renderPipeline2?.enabled) {
    patch.renderPipeline2 = scalePipeline2ForLive(appState.renderPipeline2, portrait);
  }

  return { restore, patch, applied: true };
}

/** Suggested MediaRecorder bitrate for LIVE (Mbps). */
export function liveRecordingBitrateMbps(
  viewportFormat: ViewportFormat,
  nativeApp: boolean
): number {
  const portrait = isPortraitFormat(viewportFormat);
  if (nativeApp) return portrait ? 8 : 12;
  return portrait ? 10 : 14;
}

/** Cap canvas DPR while LIVE so encode + RP stay realtime. */
export function liveRecordingMaxDpr(viewportFormat: ViewportFormat): number {
  return isPortraitFormat(viewportFormat) ? 1 : 1.25;
}
