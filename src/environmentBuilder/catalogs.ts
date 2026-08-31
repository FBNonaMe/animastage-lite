/** Environment Builder one-click catalogs. */
import type {
  BackgroundFxDef,
  EnvironmentCategoryDef,
  SmartCameraDef,
  WorldScalePresetDef,
} from './types';

export const WORLD_SCALE_PRESETS: WorldScalePresetDef[] = [
  {
    id: 'real_world',
    label: 'Real World',
    description: 'Extra-large streets / buildings / photogrammetry',
    unitMeters: 1,
    envScaleMultiplier: 2,
    cameraStudio: { focusTarget: 'full', orbitPreset: 'full_body' },
  },
  {
    id: 'anime',
    label: 'Anime Scale',
    description: 'City blocks, school yards — comfortable walk-in size',
    unitMeters: 1.1,
    envScaleMultiplier: 1.5,
    cameraStudio: { focusTarget: 'body', orbitPreset: 'face_portrait' },
  },
  {
    id: 'mmd',
    label: 'MMD Scale',
    description: 'Default — room / stage sized for MMD characters',
    unitMeters: 0.08,
    envScaleMultiplier: 1,
    cameraStudio: { focusTarget: 'full', orbitPreset: 'full_body' },
  },
  {
    id: 'vrm',
    label: 'VRM Scale',
    description: 'VRoid worlds — rooms and plazas',
    unitMeters: 1,
    envScaleMultiplier: 1.5,
    cameraStudio: { focusTarget: 'body', orbitPreset: 'face_portrait' },
  },
  {
    id: 'custom',
    label: 'Custom Scale',
    description: 'Manual — use the Environment Scale slider',
    unitMeters: 1,
    envScaleMultiplier: null,
    cameraStudio: { focusTarget: 'full', orbitPreset: 'manual' },
  },
];

export const ENVIRONMENT_CATEGORIES: EnvironmentCategoryDef[] = [
  {
    id: 'anime_street', label: 'Anime Street', kind: 'outdoor', description: 'Bright anime city street',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'natural', bloomEnabled: true, bloomIntensity: 0.5 },
      dynamicSky: { enabled: true, presetId: 'anime_day', timeHours: 11 },
      cameraPreset: 'full_body',
      message: 'Anime Street look applied',
    },
  },
  {
    id: 'japanese_school', label: 'Japanese School', kind: 'outdoor', description: 'School exterior, clear sky',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'natural', bloomIntensity: 0.45 },
      dynamicSky: { enabled: true, presetId: 'anime_day', timeHours: 10 },
      cameraPreset: 'full_body',
    },
  },
  {
    id: 'temple', label: 'Temple', kind: 'outdoor', description: 'Misty cinematic temple',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'rim', weatherPreset: 'fog', bloomIntensity: 0.6 },
      dynamicSky: { enabled: true, presetId: 'foggy_morning', timeHours: 7 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'shrine', label: 'Shrine', kind: 'outdoor', description: 'Golden shrine mood',
    patches: {
      visualFx: { scenePreset: 'sunset', lightPreset: 'rim', bloomIntensity: 0.62 },
      dynamicSky: { enabled: true, presetId: 'golden_hour', timeHours: 17.5 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'bedroom', label: 'Bedroom', kind: 'indoor', description: 'Warm private interior',
    patches: {
      visualFx: { scenePreset: 'studio', lightPreset: 'natural', bloomIntensity: 0.4 },
      dynamicSky: { enabled: false },
      sceneComposer: { exposure: 1.05, temperature: 0.15 },
      cameraPreset: 'face_portrait',
    },
  },
  {
    id: 'cafe', label: 'Cafe', kind: 'indoor', description: 'Cozy warm cafe',
    patches: {
      visualFx: { scenePreset: 'studio', lightPreset: 'natural', bloomIntensity: 0.42 },
      sceneComposer: { exposure: 1.05, temperature: 0.2 },
      cameraPreset: 'face_portrait',
    },
  },
  {
    id: 'forest', label: 'Forest', kind: 'outdoor', description: 'Soft misty forest',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'rim', weatherPreset: 'fog', particlesEnabled: true, particlePreset: 'fireflies' },
      dynamicSky: { enabled: true, presetId: 'foggy_morning', timeHours: 8 },
      cameraPreset: 'full_body',
    },
  },
  {
    id: 'beach', label: 'Beach', kind: 'outdoor', description: 'Bright coastal daylight',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'natural', bloomIntensity: 0.55 },
      dynamicSky: { enabled: true, presetId: 'sunny_day', timeHours: 14 },
      cameraPreset: 'full_body',
    },
  },
  {
    id: 'cyberpunk', label: 'Cyberpunk', kind: 'outdoor', description: 'Wet neon night city',
    patches: {
      visualFx: { scenePreset: 'cyber', lightPreset: 'neon', bloomIntensity: 0.95, weatherPreset: 'rain', wetness: 0.8 },
      dynamicSky: { enabled: true, presetId: 'cyberpunk', timeHours: 21.5 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'concert', label: 'Concert', kind: 'stage', description: 'Performance stage lights',
    patches: {
      visualFx: { scenePreset: 'stage', lightPreset: 'concert', bloomIntensity: 0.9 },
      dynamicSky: { enabled: false },
      cameraPreset: 'dramatic_bloom',
    },
  },
  {
    id: 'fantasy', label: 'Fantasy', kind: 'outdoor', description: 'Epic fantasy atmosphere',
    patches: {
      visualFx: { scenePreset: 'sunset', lightPreset: 'rim', bloomIntensity: 0.85, particlesEnabled: true, particlePreset: 'sparkles' },
      dynamicSky: { enabled: true, presetId: 'golden_hour', timeHours: 17 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'castle', label: 'Castle', kind: 'outdoor', description: 'Grand castle establishing light',
    patches: {
      visualFx: { scenePreset: 'sunset', lightPreset: 'rim', bloomIntensity: 0.7 },
      dynamicSky: { enabled: true, presetId: 'golden_hour', timeHours: 16.5 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'snow', label: 'Snow', kind: 'outdoor', description: 'Cold snowy daylight',
    patches: {
      visualFx: { scenePreset: 'outdoor', lightPreset: 'rim', weatherPreset: 'snow', precipIntensity: 0.7, particlesEnabled: true, particlePreset: 'snow' },
      dynamicSky: { enabled: true, presetId: 'snow', timeHours: 10 },
      cameraPreset: 'full_body',
    },
  },
  {
    id: 'city', label: 'City', kind: 'outdoor', description: 'Modern city daytime',
    patches: {
      visualFx: { scenePreset: 'cyber', lightPreset: 'natural', bloomIntensity: 0.5 },
      dynamicSky: { enabled: true, presetId: 'sunny_day', timeHours: 13 },
      cameraPreset: 'full_body',
    },
  },
  {
    id: 'night', label: 'Night', kind: 'outdoor', description: 'Deep night city',
    patches: {
      visualFx: { scenePreset: 'nightclub', lightPreset: 'neon', bloomIntensity: 0.8 },
      dynamicSky: { enabled: true, presetId: 'night', timeHours: 22 },
      cameraPreset: 'hero_low',
    },
  },
  {
    id: 'studio', label: 'Studio', kind: 'indoor', description: 'Neutral photo studio',
    patches: {
      visualFx: { scenePreset: 'studio', lightPreset: 'natural', bloomIntensity: 0.35 },
      dynamicSky: { enabled: false },
      sceneComposer: { exposure: 1.08 },
      cameraPreset: 'face_portrait',
    },
  },
];

export const SMART_CAMERAS: SmartCameraDef[] = [
  { id: 'entrance', label: 'Entrance', description: 'Wide establishing shot', preset: 'orbit180_slow', focusTarget: 'full' },
  { id: 'hero', label: 'Hero Shot', description: 'Low dramatic hero angle', preset: 'hero_low', focusTarget: 'full' },
  { id: 'portrait', label: 'Portrait', description: 'Face-focused portrait', preset: 'face_portrait', focusTarget: 'face' },
  { id: 'wide', label: 'Wide Shot', description: 'Full body in environment', preset: 'full_body', focusTarget: 'full' },
  { id: 'movie', label: 'Movie Shot', description: 'Cinematic bloom framing', preset: 'dramatic_bloom', focusTarget: 'body' },
  { id: 'low_angle', label: 'Low Angle', description: 'Looking up at the subject', preset: 'hero_low', focusTarget: 'body' },
  { id: 'high_angle', label: 'High Angle', description: 'Looking down composition', preset: 'orbit180', focusTarget: 'body' },
  { id: 'orbit', label: 'Orbit', description: 'Full 360 turntable', preset: 'orbit360', focusTarget: 'full' },
  { id: 'walkthrough', label: 'Walkthrough', description: 'Slow moving arc', preset: 'orbit180_slow', focusTarget: 'full' },
];

export const BACKGROUND_FX: BackgroundFxDef[] = [
  { id: 'bloom', label: 'Bloom', visualFx: { bloomEnabled: true, bloomIntensity: 0.7 } },
  { id: 'dof', label: 'DOF', visualFx: { dofEnabled: true, dofFocusDistance: 0.02, dofBokehScale: 3.2 } },
  { id: 'fog', label: 'Fog', visualFx: { weatherPreset: 'fog' } },
  { id: 'volumetric', label: 'Volumetric Light', visualFx: { godRaysEnabled: true, godRaysDensity: 0.7 } },
  { id: 'god_rays', label: 'God Rays', visualFx: { godRaysEnabled: true, godRaysDensity: 0.85, godRaysDecay: 0.94 } },
  { id: 'ssr', label: 'SSR', visualFx: { floorReflection: 0.9 } },
  { id: 'reflections', label: 'Reflections', visualFx: { floorReflection: 0.8, environmentIntensity: 0.9 } },
  { id: 'ao', label: 'Ambient Occlusion', visualFx: { ssaoEnabled: true, ssaoIntensity: 1.2, aoIntensity: 5 } },
  { id: 'shadow_catcher', label: 'Shadow Catcher', visualFx: { floorReflection: 0.35, aoIntensity: 4 } },
];

export function getEnvironmentCategory(id: string) {
  return ENVIRONMENT_CATEGORIES.find((c) => c.id === id) ?? null;
}
