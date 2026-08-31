import type { MMDModel } from '../types';
import type { CharacterIntelligenceProfile } from './types';

/** Primary accessor — all subsystems should read CIS profile from here. */
export function getCharacterProfile(model: MMDModel | null | undefined): CharacterIntelligenceProfile | null {
  return model?.cisReport?.profile ?? null;
}

export function isCharacterProfileReady(model: MMDModel | null | undefined): boolean {
  const status = model?.cisReport?.status;
  return status === 'ready' || status === 'cached';
}

export function getRecommendedPerformanceTier(model: MMDModel | null | undefined) {
  return getCharacterProfile(model)?.performance.recommendedTier ?? 'balanced';
}

export function modelSupportsCapability(
  model: MMDModel | null | undefined,
  capabilityId: string
): boolean {
  const caps = getCharacterProfile(model)?.capabilities ?? [];
  return caps.find((c) => c.id === capabilityId)?.supported ?? false;
}
