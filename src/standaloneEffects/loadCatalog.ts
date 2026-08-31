import { STANDALONE_PATHS } from '../config/standaloneBundle';
import type { StandaloneEffectsCatalog } from './types';

let cached: StandaloneEffectsCatalog | null = null;
let inflight: Promise<StandaloneEffectsCatalog | null> | null = null;

export async function loadStandaloneEffectsCatalog(): Promise<StandaloneEffectsCatalog | null> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = fetch(`${STANDALONE_PATHS.effectsCatalog}/effects-catalog.json`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
      const data = (await res.json()) as StandaloneEffectsCatalog;
      cached = data;
      return data;
    })
    .catch((err) => {
      console.warn('[StandaloneEffects] Failed to load catalog:', err);
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function getRuntimeCompatibleEffects(catalog: StandaloneEffectsCatalog) {
  return catalog.effects.filter((e) => e.runtimeCompatible);
}
