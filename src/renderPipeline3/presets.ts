import type { RenderPipeline3PresetDef, RenderPipeline3PresetId, RenderPipeline3State } from './types';
import { DEFAULT_RENDER_PIPELINE_3 } from './defaults';
import { mergeRenderPipeline3 } from './merge';

const d = DEFAULT_RENDER_PIPELINE_3;

export const RENDER_PIPELINE_3_PRESETS: RenderPipeline3PresetDef[] = [
  {
    id: 'classic_mmd',
    label: 'Classic MMD',
    description: 'Flat anime look, light GI, soft AO',
    patch: {
      gi: { ...d.gi, mode: 'off', intensity: 0.25 },
      ao: { ...d.ao, mode: 'ssao', intensity: 0.7, samples: 8 },
      materials: { ...d.materials, look: 'toon', library: 'anime_skin' },
      bloom: { ...d.bloom, intensity: 0.28, style: 'classic' },
      color: { ...d.color, toneMapper: 'anime', gradeAlias: 'anime' },
      weather: { ...d.weather, mode: 'clear', intensity: 0 },
      particles: { ...d.particles, enabled: false, preset: 'none' },
    },
  },
  {
    id: 'anime',
    label: 'Anime',
    description: 'Balanced realtime anime cinema',
    patch: {
      gi: { ...d.gi, mode: 'ssgi', quality: 'medium' },
      ao: { ...d.ao, mode: 'hybrid' },
      materials: { ...d.materials, look: 'anime', library: 'anime_skin' },
      bloom: { ...d.bloom, style: 'cinematic', intensity: 0.48 },
      color: { ...d.color, gradeAlias: 'cinematic' },
    },
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Clean key light, controlled reflections',
    patch: {
      gi: { ...d.gi, mode: 'ssgi', intensity: 0.4, sunBounce: 0.3 },
      lights: { ...d.lights, sunIntensity: 1.35, ambientIntensity: 0.4, moonIntensity: 0.1 },
      probes: { ...d.probes, scene: 'room', enabled: true },
      weather: { ...d.weather, mode: 'clear' },
      color: { ...d.color, gradeAlias: 'neutral', toneMapper: 'aces' },
    },
  },
  {
    id: 'photoreal',
    label: 'Photoreal',
    description: 'PBR materials, strong GI and AO',
    patch: {
      gi: { ...d.gi, mode: 'hybrid', quality: 'high', intensity: 0.75 },
      ao: { ...d.ao, mode: 'gtao', intensity: 1.15, samples: 14 },
      materials: { ...d.materials, look: 'pbr', library: 'stone' },
      bloom: { ...d.bloom, style: 'soft', intensity: 0.35 },
      color: { ...d.color, toneMapper: 'agx', gradeAlias: 'neutral' },
      taa: { ...d.taa, mode: 'taa' },
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'DoF, vignette, filmic grade',
    patch: {
      gi: { ...d.gi, mode: 'ssgi', quality: 'high' },
      camera: {
        ...d.camera,
        dof: true,
        bokehScale: 1.8,
        vignette: 0.4,
        filmGrain: 0.08,
        chromaticAberration: 0.0012,
      },
      bloom: { ...d.bloom, style: 'multi_res', intensity: 0.55, lensDirt: 0.25 },
      color: { ...d.color, gradeAlias: 'cinematic', contrast: 0.14 },
      lens: { ...d.lens, focal: '85mm' },
    },
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    description: 'Warm glow, magic particles, soft fog',
    patch: {
      gi: { ...d.gi, mode: 'ssgi', skyBounce: 0.7, colorBleeding: 0.5 },
      volumetrics: { ...d.volumetrics, fogEnabled: true, heightFog: 0.35, godRays: true },
      materials: { ...d.materials, look: 'anime', library: 'fabric' },
      particles: { ...d.particles, enabled: true, preset: 'magic', count: 12000, intensity: 0.8 },
      vegetation: { ...d.vegetation, enabled: true, flowers: true, density: 0.5 },
      color: { ...d.color, gradeAlias: 'warm', temperature: 0.12 },
    },
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon bloom, wet streets, cold grade',
    patch: {
      gi: { ...d.gi, mode: 'ssvgi', intensity: 0.65 },
      bloom: { ...d.bloom, intensity: 0.85, threshold: 0.35, style: 'cinematic' },
      weather: { ...d.weather, mode: 'rain', intensity: 0.7, wetGround: 0.85, rainRipples: 0.6 },
      probes: { ...d.probes, scene: 'street' },
      color: { ...d.color, gradeAlias: 'cold', temperature: -0.15 },
      materials: { ...d.materials, look: 'metal', library: 'metal' },
    },
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    description: 'Warm sun bounce and soft haze',
    patch: {
      gi: { ...d.gi, sunBounce: 0.8, skyBounce: 0.45, colorBleeding: 0.45 },
      lights: { ...d.lights, sunIntensity: 1.2, temperature: 4200, moonIntensity: 0.05 },
      volumetrics: { ...d.volumetrics, godRays: true, godRaysIntensity: 0.55, scattering: 0.4 },
      color: { ...d.color, gradeAlias: 'warm', temperature: 0.2, exposure: 1.08 },
      lens: { ...d.lens, focal: '50mm', cookie: 'leaves', cookieIntensity: 0.35 },
    },
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Moon fill, stars, low ambient',
    patch: {
      gi: { ...d.gi, mode: 'ssgi', intensity: 0.35, skyBounce: 0.7 },
      lights: {
        ...d.lights,
        sunIntensity: 0.15,
        moonIntensity: 0.85,
        ambientIntensity: 0.25,
        skyIntensity: 0.45,
      },
      bloom: { ...d.bloom, intensity: 0.55, threshold: 0.45 },
      color: { ...d.color, gradeAlias: 'cold', exposure: 0.92 },
      particles: { ...d.particles, enabled: true, preset: 'fireflies', count: 6000 },
    },
  },
  {
    id: 'rain',
    label: 'Rain',
    description: 'Wet ground, ripples, soft fog',
    patch: {
      weather: {
        ...d.weather,
        mode: 'rain',
        intensity: 0.75,
        wetGround: 0.8,
        rainRipples: 0.7,
        cloudCover: 0.75,
        wind: 0.45,
      },
      volumetrics: { ...d.volumetrics, fogEnabled: true, distanceFog: 0.35 },
      reflections: { ...d.reflections, intensity: 0.85, mode: 'hybrid' },
      color: { ...d.color, gradeAlias: 'cold', contrast: 0.1 },
    },
  },
  {
    id: 'snow',
    label: 'Snow',
    description: 'Snowfall, accumulation, cool grade',
    patch: {
      weather: {
        ...d.weather,
        mode: 'snow',
        intensity: 0.7,
        snowAccumulation: 0.75,
        wind: 0.35,
        cloudCover: 0.65,
        wetGround: 0.2,
      },
      particles: { ...d.particles, enabled: true, preset: 'snow', count: 20000, intensity: 0.9 },
      color: { ...d.color, gradeAlias: 'cold', exposure: 1.1 },
      gi: { ...d.gi, skyBounce: 0.8, colorBleeding: 0.25 },
    },
  },
  {
    id: 'fog',
    label: 'Fog',
    description: 'Height fog and soft scattering',
    patch: {
      weather: { ...d.weather, mode: 'fog', intensity: 0.8, cloudCover: 0.9 },
      volumetrics: {
        ...d.volumetrics,
        fogEnabled: true,
        heightFog: 0.7,
        distanceFog: 0.55,
        scattering: 0.5,
      },
      gi: { ...d.gi, intensity: 0.45, halfResolution: true },
      color: { ...d.color, gradeAlias: 'noir', contrast: -0.05 },
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Orange rim, god rays, warm LUT',
    patch: {
      gi: { ...d.gi, sunBounce: 0.75, colorBleeding: 0.55 },
      lights: { ...d.lights, temperature: 3800, sunIntensity: 1.1, moonIntensity: 0.2 },
      volumetrics: { ...d.volumetrics, godRays: true, godRaysIntensity: 0.65, lightShafts: 0.55 },
      color: { ...d.color, gradeAlias: 'warm', temperature: 0.25 },
      bloom: { ...d.bloom, intensity: 0.6, style: 'soft' },
      lens: { ...d.lens, focal: '35mm' },
    },
  },
];

export function getRenderPipeline3Preset(id: RenderPipeline3PresetId) {
  return RENDER_PIPELINE_3_PRESETS.find((p) => p.id === id);
}

export function applyPresetToState3(
  base: RenderPipeline3State,
  id: RenderPipeline3PresetId
): RenderPipeline3State {
  const preset = getRenderPipeline3Preset(id);
  if (!preset) return base;
  return mergeRenderPipeline3(base, { ...preset.patch, activePreset: id, enabled: true });
}
