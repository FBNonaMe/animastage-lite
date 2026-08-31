/**
 * Analyze RP3 + scene hints; suggest improvements and optional auto-fix patch.
 */
import type { RenderPipeline3State } from './types';
import { mergeRenderPipeline3 } from './merge';

export type ValidatorSeverity = 'info' | 'warn' | 'critical';

export interface ValidatorIssue {
  id: string;
  severity: ValidatorSeverity;
  area:
    | 'lighting'
    | 'shadows'
    | 'ao'
    | 'bloom'
    | 'gi'
    | 'performance'
    | 'vram'
    | 'fps'
    | 'weather'
    | 'taa';
  message: string;
  fixLabel?: string;
}

export interface ValidatorReport {
  score: number;
  issues: ValidatorIssue[];
  /** Partial state to apply for Auto Fix. */
  autoFix: Partial<RenderPipeline3State>;
}

export function validateRenderPipeline3(state: RenderPipeline3State): ValidatorReport {
  const issues: ValidatorIssue[] = [];
  const autoFix: Partial<RenderPipeline3State> = {};

  if (state.gi.mode !== 'off' && state.gi.intensity > 0.95 && state.ao.intensity > 1.2) {
    issues.push({
      id: 'gi_ao_clash',
      severity: 'warn',
      area: 'gi',
      message: 'Very strong GI + AO may crush midtones. Lower AO or GI slightly.',
      fixLabel: 'Balance GI/AO',
    });
    autoFix.ao = { ...state.ao, intensity: Math.min(state.ao.intensity, 1.05) };
    autoFix.gi = { ...state.gi, intensity: Math.min(state.gi.intensity, 0.75) };
  }

  if (state.bloom.enabled && state.bloom.intensity > 0.85 && state.bloom.threshold < 0.4) {
    issues.push({
      id: 'bloom_blowout',
      severity: 'warn',
      area: 'bloom',
      message: 'Bloom threshold is low with high intensity — risk of white blow-out.',
      fixLabel: 'Raise bloom threshold',
    });
    autoFix.bloom = {
      ...state.bloom,
      threshold: Math.max(state.bloom.threshold, 0.55),
      intensity: Math.min(state.bloom.intensity, 0.7),
    };
  }

  if (state.lights.sunIntensity > 1.8 && state.color.exposure > 1.15) {
    issues.push({
      id: 'overexposed',
      severity: 'critical',
      area: 'lighting',
      message: 'Sun + exposure both high. Characters may clip to white.',
      fixLabel: 'Normalize exposure',
    });
    autoFix.color = { ...state.color, exposure: 1.0 };
    autoFix.lights = { ...state.lights, sunIntensity: Math.min(state.lights.sunIntensity, 1.25) };
  }

  if (!state.contactShadows.enabled && state.ao.mode === 'off') {
    issues.push({
      id: 'flat_ground',
      severity: 'info',
      area: 'shadows',
      message: 'No contact shadows and AO off — characters may float on the ground.',
      fixLabel: 'Enable contact shadows',
    });
    autoFix.contactShadows = { ...state.contactShadows, enabled: true };
    autoFix.ao = { ...state.ao, mode: 'hybrid', intensity: 0.9 };
  }

  if (state.particles.enabled && state.particles.count > 60000) {
    issues.push({
      id: 'particle_vram',
      severity: 'warn',
      area: 'vram',
      message: 'Particle count is very high for browsers / Android.',
      fixLabel: 'Cap particles',
    });
    autoFix.particles = { ...state.particles, count: 24000 };
  }

  if (state.gi.quality === 'ultra' && state.ao.samples > 14 && state.performance.autoQualityScale) {
    issues.push({
      id: 'fps_risk',
      severity: 'warn',
      area: 'fps',
      message: 'Ultra GI + high AO samples may drop below realtime on mobile.',
      fixLabel: 'Prefer high quality',
    });
    autoFix.gi = { ...state.gi, ...(autoFix.gi ?? {}), quality: 'high', halfResolution: true };
    autoFix.ao = { ...state.ao, ...(autoFix.ao ?? {}), samples: Math.min(state.ao.samples, 10) };
  }

  if (state.weather.mode === 'rain' && state.weather.wetGround < 0.3) {
    issues.push({
      id: 'dry_rain',
      severity: 'info',
      area: 'weather',
      message: 'Rain is on but wet ground is low — reflections will look dry.',
      fixLabel: 'Wet the ground',
    });
    autoFix.weather = { ...state.weather, wetGround: 0.7, rainRipples: 0.55 };
  }

  if (state.taa.mode === 'off' && (state.materials.hairAnisotropy > 0.5 || state.gi.temporalAccumulation)) {
    issues.push({
      id: 'hair_flicker',
      severity: 'info',
      area: 'taa',
      message: 'TAA/SMAA off — hair and outlines may flicker under motion.',
      fixLabel: 'Enable SMAA',
    });
    autoFix.taa = { ...state.taa, mode: 'smaa', stabilizeHair: true, stabilizeOutline: true };
  }

  if (!state.graph.ao && state.ao.mode !== 'off') {
    issues.push({
      id: 'graph_ao',
      severity: 'info',
      area: 'ao',
      message: 'AO is configured but disabled in the render graph.',
      fixLabel: 'Enable AO node',
    });
    autoFix.graph = { ...state.graph, ao: true };
  }

  const penalty = issues.reduce((n, i) => n + (i.severity === 'critical' ? 18 : i.severity === 'warn' ? 10 : 4), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return { score, issues, autoFix };
}

export function applyValidatorAutoFix(state: RenderPipeline3State): RenderPipeline3State {
  const { autoFix } = validateRenderPipeline3(state);
  if (!Object.keys(autoFix).length) return state;
  return mergeRenderPipeline3(state, { ...autoFix, activePreset: 'custom' });
}
