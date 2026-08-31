/**
 * Non-destructive post-FX view for render — user settings in appState stay intact.
 *
 * Character-quality-first reduction order:
 *   Degrade L1  → cheap post-FX (chromatic aberration, god rays, DOF)
 *   Degrade L2  → heavier post-FX (SSAO, bloom cap, material detailing)
 *   Degrade L3  → distant scene (weather, particles, reflections)
 *   Degrade L4  → final trims (bloom off, material smoothing, cheap AA on)
 *
 * Render resolution is NEVER touched here — see effectiveDpr (governor last-resort only).
 */
import type { AppState, ViewportFormat, VisualFxSettings } from '../types';
import { isPortraitFormat } from '../utils/characterQuality';
import { getEffectiveDegradeLevel } from './effectiveDegradeLevel';
import { isTemplateMotionActive } from './scenePerfPolicy';
import {
  getPerfGovernorFxGate,
  isPerfGovernorAutoEnabled,
} from './controller/perfGovernor';
import { isCinemaRenderCapture, isOfflineExportCapture } from '../video/recordingCapture';

export function getEffectiveVisualFx(
  visualFx: VisualFxSettings,
  appState: AppState,
  viewportFormat: ViewportFormat = '16:9'
): VisualFxSettings {
  // Viewport budgets only — never degrade Cinema / RP4 / offline export frames.
  if (isCinemaRenderCapture() || isOfflineExportCapture()) {
    return visualFx;
  }

  let base = visualFx;

  if (isPortraitFormat(viewportFormat)) {
    base = {
      ...base,
      bloomEnabled: false,
      dofEnabled: false,
      godRaysEnabled: false,
      ssaoEnabled: false,
    };
  }

  // Template playback in 9:16 only — 16:9 keeps full FX unless perf degrades.
  if (
    isPortraitFormat(viewportFormat) &&
    isTemplateMotionActive(appState) &&
    appState.isPlaying
  ) {
    base = {
      ...base,
      bloomEnabled: false,
      dofEnabled: false,
      godRaysEnabled: false,
      weatherPreset: 'clear',
      precipIntensity: 0,
    };
  }

  // Perf governor gate — post-FX → lighting → scene, before any render-scale step.
  if (isPerfGovernorAutoEnabled()) {
    const gate = getPerfGovernorFxGate();
    const gated: Partial<VisualFxSettings> = {};

    if (!gate.allowGodRays) gated.godRaysEnabled = false;
    if (!gate.allowSsao) gated.ssaoEnabled = false;
    if (!gate.allowChromaticAberration && (base.chromaticAberration ?? 0) > 0) {
      gated.chromaticAberration = 0;
    }
    if (!gate.allowDof) gated.dofEnabled = false;
    if (gate.bloomIntensityCap != null && base.bloomEnabled) {
      gated.bloomIntensity = Math.min(base.bloomIntensity, gate.bloomIntensityCap);
    }
    if (gate.reflectionCap != null) {
      gated.floorReflection = Math.min(base.floorReflection, gate.reflectionCap);
    }
    if (!gate.allowWeather && base.weatherPreset && base.weatherPreset !== 'clear') {
      gated.weatherPreset = 'clear';
      gated.precipIntensity = 0;
    }
    if (!gate.allowParticles && base.particlesEnabled) {
      gated.particlesEnabled = false;
    }

    if (Object.keys(gated).length > 0) {
      base = { ...base, ...gated };
    }
  }

  const level = getEffectiveDegradeLevel();
  if (level <= 0) return base;

  const patch: Partial<VisualFxSettings> = {};

  // L1 — cheap post-FX first: users rarely notice these disappearing.
  if (level >= 1) {
    if ((base.chromaticAberration ?? 0) > 0) patch.chromaticAberration = 0;
    patch.godRaysEnabled = false;
    patch.dofEnabled = false;
  }

  // L2 — heavier post-FX: SSAO off, bloom capped, material detailing off.
  if (level >= 2) {
    patch.ssaoEnabled = false;
    if (base.bloomEnabled) {
      patch.bloomIntensity = Math.min(base.bloomIntensity, 0.25);
    }
    patch.materialDetailing = false;
  }

  // L3 — distant scene: weather, particles, reflections.
  if (level >= 3) {
    if (base.weatherPreset && base.weatherPreset !== 'clear') {
      patch.weatherPreset = 'clear';
      patch.precipIntensity = 0;
    }
    patch.particlesEnabled = false;
    patch.floorReflection = Math.min(base.floorReflection, 0.25);
  }

  // L4 — final visual trims (still no resolution loss).
  if (level >= 4) {
    patch.bloomEnabled = false;
    patch.materialSmoothing = Math.min(visualFx.materialSmoothing ?? 0.55, 0.3);
    patch.smaaEnabled = true;
  }

  return { ...base, ...patch };
}

export function isPostFxReduced(
  visualFx: VisualFxSettings,
  appState: AppState,
  viewportFormat: ViewportFormat = '16:9'
): boolean {
  const eff = getEffectiveVisualFx(visualFx, appState, viewportFormat);
  return (
    eff.bloomEnabled !== visualFx.bloomEnabled ||
    eff.dofEnabled !== visualFx.dofEnabled ||
    eff.ssaoEnabled !== visualFx.ssaoEnabled ||
    eff.godRaysEnabled !== visualFx.godRaysEnabled ||
    eff.weatherPreset !== visualFx.weatherPreset
  );
}
