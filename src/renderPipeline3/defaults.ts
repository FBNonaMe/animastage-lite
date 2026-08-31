import type { RenderPipeline3State } from './types';
import { DEFAULT_RENDER_PIPELINE_2 } from '../renderPipeline2/defaults';

const rp2 = DEFAULT_RENDER_PIPELINE_2;

export const DEFAULT_RENDER_PIPELINE_3: RenderPipeline3State = {
  version: 3,
  enabled: true,
  activePreset: 'anime',
  gi: { ...rp2.gi },
  ao: { ...rp2.ao },
  contactShadows: { ...rp2.contactShadows },
  reflections: { ...rp2.reflections, autoProbes: true },
  volumetrics: { ...rp2.volumetrics },
  bloom: { ...rp2.bloom, lensDirt: 0.15 },
  color: { ...rp2.color },
  materials: {
    ...rp2.materials,
    library: 'anime_skin',
  },
  lights: {
    ...rp2.lights,
    moonIntensity: 0.35,
  },
  camera: { ...rp2.camera },
  performance: { ...rp2.performance, temporalUpscale: true },
  weather: {
    mode: 'clear',
    intensity: 0,
    wetGround: 0,
    rainRipples: 0,
    snowAccumulation: 0,
    wind: 0.15,
    thunder: false,
    cloudCover: 0.25,
  },
  water: {
    enabled: false,
    reflection: 0.75,
    refraction: 0.55,
    foam: 0.35,
    waves: 0.4,
    caustics: 0.3,
    shoreFade: 0.5,
  },
  particles: {
    enabled: false,
    preset: 'none',
    count: 8000,
    intensity: 0.65,
  },
  vegetation: {
    enabled: false,
    density: 0.4,
    wind: 0.35,
    grass: true,
    trees: false,
    flowers: false,
  },
  probes: {
    enabled: true,
    scene: 'auto',
    blending: true,
    count: 2,
    intensity: 0.7,
  },
  taa: {
    mode: 'smaa',
    stabilizeHair: true,
    stabilizeOutline: true,
    historyWeight: 0.85,
  },
  lens: {
    focal: '50mm',
    cookie: 'none',
    cookieIntensity: 0.5,
  },
  passes: {
    enabled: ['beauty'],
  },
  graph: {
    nodes: ['sky', 'gi', 'ao', 'lighting', 'materials', 'bloom', 'lut', 'tone', 'output'],
    sky: true,
    gi: true,
    ao: true,
    lighting: true,
    materials: true,
    bloom: true,
    lut: true,
    tone: true,
  },
  validator: {
    enabled: true,
    autoFixOnPreset: true,
  },
};
