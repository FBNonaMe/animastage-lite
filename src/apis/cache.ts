import type { ApisPhysicsProfile, ApisReport } from './types';

const STORAGE_PREFIX = 'as_apis_profile_v1_';

export function loadCachedApisProfile(modelHash: string): ApisPhysicsProfile | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${modelHash}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApisPhysicsProfile;
    if (parsed?.version !== 1 || parsed.modelHash !== modelHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedApisProfile(profile: ApisPhysicsProfile): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${profile.modelHash}`, JSON.stringify(profile));
  } catch {
    /* quota */
  }
}

export function mergeCachedReport(
  report: ApisReport,
  cached: ApisPhysicsProfile | null
): ApisReport {
  if (!cached) return report;
  return {
    ...report,
    status: 'cached',
    profile: cached,
    userSummary: buildUserSummaryFromProfile(cached),
  };
}

export function buildUserSummaryFromProfile(profile: ApisPhysicsProfile): ApisReport['userSummary'] {
  const hairKinds = new Set(['hair', 'long_hair', 'short_hair', 'twin_tail', 'ponytail']);
  const clothKinds = new Set(['skirt', 'dress', 'cape', 'scarf', 'sleeve']);
  const hasHair = profile.classifications.some((c) => hairKinds.has(c.kind));
  const hasCloth = profile.classifications.some((c) => clothKinds.has(c.kind));
  const hasAcc = profile.classifications.some(
    (c) => !hairKinds.has(c.kind) && !clothKinds.has(c.kind)
  );

  const perf =
    profile.benchmark.score >= 85
      ? 'Excellent'
      : profile.benchmark.score >= 70
        ? 'Good'
        : 'Balanced';

  return {
    hair: hasHair ? 'Optimized' : '—',
    cloth: hasCloth ? 'Optimized' : '—',
    accessories: hasAcc ? 'Optimized' : '—',
    simulation: profile.stability === 'excellent' ? 'Stable' : 'Stable',
    performance: perf,
    optimized: true,
  };
}
