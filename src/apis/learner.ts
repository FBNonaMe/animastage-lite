import type { ApisPhysicsProfile, ApisBenchmarkResult } from './types';
import { mergeBenchmarkIntoProfile } from './benchmark';
import { saveCachedApisProfile } from './cache';

export function finalizeProfileAfterBenchmark(
  profile: ApisPhysicsProfile,
  live: ApisBenchmarkResult
): ApisPhysicsProfile {
  const merged = mergeBenchmarkIntoProfile(profile, live);
  saveCachedApisProfile(merged);
  return merged;
}
