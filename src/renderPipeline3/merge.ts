import type { RenderPipeline3State } from './types';

export function mergeRenderPipeline3(
  base: RenderPipeline3State,
  patch: Partial<RenderPipeline3State>
): RenderPipeline3State {
  return {
    ...base,
    ...patch,
    version: 3,
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
    weather: { ...base.weather, ...patch.weather },
    water: { ...base.water, ...patch.water },
    particles: { ...base.particles, ...patch.particles },
    vegetation: { ...base.vegetation, ...patch.vegetation },
    probes: { ...base.probes, ...patch.probes },
    taa: { ...base.taa, ...patch.taa },
    lens: { ...base.lens, ...patch.lens },
    passes: {
      ...base.passes,
      ...patch.passes,
      enabled: patch.passes?.enabled ?? base.passes.enabled,
    },
    graph: { ...base.graph, ...patch.graph },
    validator: { ...base.validator, ...patch.validator },
  };
}
