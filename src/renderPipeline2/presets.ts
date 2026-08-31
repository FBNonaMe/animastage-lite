import { DEFAULT_RENDER_PIPELINE_2 } from './defaults';
import type { RenderPipeline2PresetDef, RenderPipeline2State } from './types';

function mergePreset(
  patch: Partial<RenderPipeline2State>
): Partial<RenderPipeline2State> {
  return {
    ...patch,
    gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, ...patch.gi },
    ao: { ...DEFAULT_RENDER_PIPELINE_2.ao, ...patch.ao },
    contactShadows: {
      ...DEFAULT_RENDER_PIPELINE_2.contactShadows,
      ...patch.contactShadows,
    },
    reflections: {
      ...DEFAULT_RENDER_PIPELINE_2.reflections,
      ...patch.reflections,
    },
    volumetrics: {
      ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
      ...patch.volumetrics,
    },
    bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, ...patch.bloom },
    color: { ...DEFAULT_RENDER_PIPELINE_2.color, ...patch.color },
    materials: { ...DEFAULT_RENDER_PIPELINE_2.materials, ...patch.materials },
    lights: { ...DEFAULT_RENDER_PIPELINE_2.lights, ...patch.lights },
    camera: { ...DEFAULT_RENDER_PIPELINE_2.camera, ...patch.camera },
    performance: {
      ...DEFAULT_RENDER_PIPELINE_2.performance,
      ...patch.performance,
    },
  };
}

export const RENDER_PIPELINE_2_PRESETS: RenderPipeline2PresetDef[] = [
  {
    id: 'classic_mmd',
    label: 'Classic MMD',
    description: 'Bright toon-friendly look with light AO',
    patch: mergePreset({
      activePreset: 'classic_mmd',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, mode: 'off', intensity: 0.25 },
      ao: { ...DEFAULT_RENDER_PIPELINE_2.ao, mode: 'ssao', intensity: 0.55 },
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, style: 'classic', intensity: 0.35 },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, toneMapper: 'anime', gradeAlias: 'neutral' },
      materials: { ...DEFAULT_RENDER_PIPELINE_2.materials, look: 'toon' },
    }),
  },
  {
    id: 'anime',
    label: 'Anime',
    description: 'Default anime cinematic pipeline',
    patch: mergePreset({ activePreset: 'anime' }),
  },
  {
    id: 'soft_anime',
    label: 'Soft Anime',
    description: 'Soft bloom, gentle AO, warm skin',
    patch: mergePreset({
      activePreset: 'soft_anime',
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, style: 'soft', intensity: 0.62, threshold: 0.42 },
      ao: { ...DEFAULT_RENDER_PIPELINE_2.ao, intensity: 0.7, radius: 0.7 },
      materials: {
        ...DEFAULT_RENDER_PIPELINE_2.materials,
        skinSoftness: 0.75,
        skinBackLight: 0.5,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'warm', toneMapper: 'aces' },
    }),
  },
  {
    id: 'studio',
    label: 'Studio',
    description: 'Clean controlled lighting for portraits',
    patch: mergePreset({
      activePreset: 'studio',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, mode: 'ssgi', intensity: 0.4, sunBounce: 0.2 },
      volumetrics: { ...DEFAULT_RENDER_PIPELINE_2.volumetrics, fogEnabled: false },
      lights: {
        ...DEFAULT_RENDER_PIPELINE_2.lights,
        sunIntensity: 0.9,
        ambientIntensity: 0.75,
        temperature: 5200,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'neutral', toneMapper: 'agx' },
    }),
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'DOF-ready film look with richer GI',
    patch: mergePreset({
      activePreset: 'cinematic',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, quality: 'high', intensity: 0.7 },
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, style: 'cinematic', intensity: 0.55 },
      camera: {
        ...DEFAULT_RENDER_PIPELINE_2.camera,
        dof: true,
        bokehScale: 1.8,
        vignette: 0.35,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'cinematic', toneMapper: 'aces' },
    }),
  },
  {
    id: 'movie',
    label: 'Movie',
    description: 'Teal-orange grade, vignette, soft shafts',
    patch: mergePreset({
      activePreset: 'movie',
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        fogEnabled: true,
        lightShafts: 0.35,
        distanceFog: 0.3,
      },
      camera: {
        ...DEFAULT_RENDER_PIPELINE_2.camera,
        vignette: 0.45,
        filmGrain: 0.12,
        chromaticAberration: 0.0012,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'cinematic', contrast: 0.14 },
    }),
  },
  {
    id: 'photoreal',
    label: 'Photoreal',
    description: 'Higher GI/AO, AgX tone map, PBR materials',
    patch: mergePreset({
      activePreset: 'photoreal',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, mode: 'hybrid', quality: 'ultra', intensity: 0.85 },
      ao: { ...DEFAULT_RENDER_PIPELINE_2.ao, mode: 'gtao', intensity: 1.25, samples: 16 },
      materials: { ...DEFAULT_RENDER_PIPELINE_2.materials, look: 'pbr' },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, toneMapper: 'agx', gradeAlias: 'neutral' },
      reflections: { ...DEFAULT_RENDER_PIPELINE_2.reflections, mode: 'hybrid', intensity: 0.85 },
    }),
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon bloom, cool grade, night fog',
    patch: mergePreset({
      activePreset: 'cyberpunk',
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, intensity: 0.85, threshold: 0.35, radius: 0.9 },
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        fogEnabled: true,
        distanceFog: 0.45,
        godRays: true,
        godRaysIntensity: 0.4,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'cold', temperature: -0.15 },
      lights: { ...DEFAULT_RENDER_PIPELINE_2.lights, ambientIntensity: 0.35, sunIntensity: 0.55 },
    }),
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    description: 'Warm shafts, soft GI, magical bloom',
    patch: mergePreset({
      activePreset: 'fantasy',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, skyBounce: 0.75, colorBleeding: 0.5 },
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, style: 'soft', intensity: 0.7 },
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        fogEnabled: true,
        lightShafts: 0.5,
        scattering: 0.4,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'warm', temperature: 0.12 },
    }),
  },
  {
    id: 'golden_hour',
    label: 'Golden Hour',
    description: 'Warm sun bounce and soft contact shadows',
    patch: mergePreset({
      activePreset: 'golden_hour',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, sunBounce: 0.85, skyBounce: 0.35 },
      lights: {
        ...DEFAULT_RENDER_PIPELINE_2.lights,
        temperature: 4200,
        sunIntensity: 1.35,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'warm', temperature: 0.18 },
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        godRays: true,
        godRaysIntensity: 0.55,
        lightShafts: 0.45,
      },
    }),
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Low key lighting with cool ambient GI',
    patch: mergePreset({
      activePreset: 'night',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, intensity: 0.35, sunBounce: 0.1, skyBounce: 0.7 },
      lights: {
        ...DEFAULT_RENDER_PIPELINE_2.lights,
        sunIntensity: 0.25,
        ambientIntensity: 0.3,
        temperature: 7500,
      },
      bloom: { ...DEFAULT_RENDER_PIPELINE_2.bloom, intensity: 0.65, threshold: 0.4 },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'cold', exposure: 0.92 },
    }),
  },
  {
    id: 'rain',
    label: 'Rain',
    description: 'Wet reflections, cooler grade, soft fog',
    patch: mergePreset({
      activePreset: 'rain',
      reflections: { ...DEFAULT_RENDER_PIPELINE_2.reflections, intensity: 0.95, mode: 'ssr' },
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        fogEnabled: true,
        distanceFog: 0.4,
        heightFog: 0.35,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'cold', contrast: 0.12 },
      materials: { ...DEFAULT_RENDER_PIPELINE_2.materials, look: 'pbr' },
    }),
  },
  {
    id: 'fog',
    label: 'Fog',
    description: 'Heavy atmosphere and soft light shafts',
    patch: mergePreset({
      activePreset: 'fog',
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        fogEnabled: true,
        distanceFog: 0.65,
        heightFog: 0.55,
        scattering: 0.5,
        lightShafts: 0.4,
      },
      ao: { ...DEFAULT_RENDER_PIPELINE_2.ao, intensity: 0.6 },
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, intensity: 0.45 },
    }),
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Orange sun bounce, god rays, warm grade',
    patch: mergePreset({
      activePreset: 'sunset',
      gi: { ...DEFAULT_RENDER_PIPELINE_2.gi, sunBounce: 0.9, colorBleeding: 0.55 },
      lights: {
        ...DEFAULT_RENDER_PIPELINE_2.lights,
        temperature: 3800,
        sunIntensity: 1.4,
      },
      volumetrics: {
        ...DEFAULT_RENDER_PIPELINE_2.volumetrics,
        godRays: true,
        godRaysIntensity: 0.7,
        lightShafts: 0.55,
        fogEnabled: true,
        distanceFog: 0.25,
      },
      color: { ...DEFAULT_RENDER_PIPELINE_2.color, gradeAlias: 'warm', temperature: 0.22 },
    }),
  },
];

export function getRenderPipeline2Preset(id: string): RenderPipeline2PresetDef | undefined {
  return RENDER_PIPELINE_2_PRESETS.find((p) => p.id === id);
}

export function applyPresetToState(
  state: RenderPipeline2State,
  presetId: string
): RenderPipeline2State {
  const preset = getRenderPipeline2Preset(presetId);
  if (!preset) return state;
  return {
    ...state,
    ...preset.patch,
    version: 2,
    enabled: true,
    activePreset: preset.id,
    gi: { ...state.gi, ...preset.patch.gi },
    ao: { ...state.ao, ...preset.patch.ao },
    contactShadows: { ...state.contactShadows, ...preset.patch.contactShadows },
    reflections: { ...state.reflections, ...preset.patch.reflections },
    volumetrics: { ...state.volumetrics, ...preset.patch.volumetrics },
    bloom: { ...state.bloom, ...preset.patch.bloom },
    color: { ...state.color, ...preset.patch.color },
    materials: { ...state.materials, ...preset.patch.materials },
    lights: { ...state.lights, ...preset.patch.lights },
    camera: { ...state.camera, ...preset.patch.camera },
    performance: { ...state.performance, ...preset.patch.performance },
  };
}
