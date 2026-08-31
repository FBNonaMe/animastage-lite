import type { CharacterIntelligenceProfile, CisReport, CisUserSummary } from './types';
import { performanceLabel, tierLabel } from './modules/performancePredictor';

export const CIS_PROFILE_VERSION = 1;
export const CIS_CACHE_PREFIX = 'as_cis_profile_v1_';

export function loadCachedCisProfile(fingerprint: string): CharacterIntelligenceProfile | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${CIS_CACHE_PREFIX}${fingerprint}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CharacterIntelligenceProfile;
    if (parsed.version !== CIS_PROFILE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedCisProfile(profile: CharacterIntelligenceProfile): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      `${CIS_CACHE_PREFIX}${profile.fingerprint.combined}`,
      JSON.stringify(profile)
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function buildUserSummary(profile: CharacterIntelligenceProfile): CisUserSummary {
  const perf = performanceLabel(profile.performance);
  const physicsLabel =
    profile.physics.stability === 'stable'
      ? 'Optimized'
      : profile.physics.stability === 'fair'
        ? 'Tuned'
        : profile.physics.rigidBodyCount === 0
          ? 'Static'
          : 'Stabilizing';

  const visualQualityLabel =
    profile.performance.recommendedTier === 'ultra'
      ? 'Ultra'
      : profile.performance.recommendedTier === 'quality'
        ? 'High'
        : profile.performance.recommendedTier === 'balanced'
          ? 'Balanced'
          : 'Efficient';

  return {
    imported: true,
    healthPercent: profile.health.overall,
    physicsLabel,
    performanceLabel: perf,
    visualQualityLabel,
    ready: profile.diagnostics.errorCount === 0,
    headline: 'Everything Ready',
  };
}

export function buildPendingSummary(): CisUserSummary {
  return {
    imported: false,
    healthPercent: 0,
    physicsLabel: 'Analyzing…',
    performanceLabel: '…',
    visualQualityLabel: '…',
    ready: false,
    headline: 'Character Intelligence',
  };
}

export function mergeCachedReport(
  profile: CharacterIntelligenceProfile
): CisReport {
  return {
    status: 'cached',
    profile,
    userSummary: buildUserSummary(profile),
  };
}

export function formatTierRecommendation(profile: CharacterIntelligenceProfile): string {
  return tierLabel(profile.performance.recommendedTier);
}
