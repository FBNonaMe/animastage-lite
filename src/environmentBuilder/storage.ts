import type { EnvironmentPresetV1 } from './types';

const KEY = 'animastage.environmentBuilder.presets.v1';

export function loadEnvironmentPresets(): EnvironmentPresetV1[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((x) => x?.version === 1) : [];
  } catch {
    return [];
  }
}

export function saveEnvironmentPreset(preset: EnvironmentPresetV1): EnvironmentPresetV1[] {
  const next = [preset, ...loadEnvironmentPresets().filter((x) => x.id !== preset.id)].slice(0, 100);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

export function deleteEnvironmentPreset(id: string): EnvironmentPresetV1[] {
  const next = loadEnvironmentPresets().filter((x) => x.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}

export function createEnvironmentPresetId(): string {
  return `env_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
