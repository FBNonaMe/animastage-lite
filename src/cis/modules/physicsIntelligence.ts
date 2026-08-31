import type { ApisReport } from '../../apis/types';
import type { UmceReport } from '../../umce/types';
import type { CisPhysicsChainSummary, CisPhysicsProfile } from '../types';

const CHAIN_LABELS: Record<string, string> = {
  hair: 'Hair',
  long_hair: 'Long Hair',
  short_hair: 'Short Hair',
  twin_tail: 'Twin Tails',
  ponytail: 'Ponytail',
  skirt: 'Skirt',
  dress: 'Dress',
  cape: 'Cape',
  scarf: 'Scarf',
  sleeve: 'Sleeves',
  tail: 'Tail',
  ribbon: 'Ribbon',
  accessory: 'Accessories',
};

export function buildPhysicsProfile(
  umceReport: UmceReport | null,
  apisReport: ApisReport | null
): CisPhysicsProfile {
  const rigidBodyCount = umceReport?.stats.rigidBodies ?? 0;
  const constraintCount = umceReport?.stats.constraints ?? 0;
  const dynamicBodyCount = umceReport?.stats.rigidBodies ?? 0;

  const chainMap = new Map<string, number>();
  const profile = apisReport?.profile;
  if (profile?.classifications) {
    for (const c of profile.classifications) {
      const key = c.kind;
      chainMap.set(key, (chainMap.get(key) ?? 0) + 1);
    }
  }

  const chains: CisPhysicsChainSummary[] = [...chainMap.entries()].map(([kind, count]) => ({
    kind,
    label: CHAIN_LABELS[kind] ?? kind,
    count,
    stable: (profile?.benchmark.score ?? 70) >= 65,
  }));

  if (chains.length === 0 && rigidBodyCount > 0) {
    chains.push({
      kind: 'generic',
      label: 'Physics Bodies',
      count: rigidBodyCount,
      stable: constraintCount <= rigidBodyCount * 2,
    });
  }

  const benchScore = profile?.benchmark.score ?? 75;
  const stability: CisPhysicsProfile['stability'] =
    benchScore >= 80 ? 'stable' : benchScore >= 60 ? 'fair' : 'unstable';

  const physicsCost: CisPhysicsProfile['physicsCost'] =
    dynamicBodyCount > 40 ? 'high' : dynamicBodyCount > 15 ? 'medium' : 'low';

  return {
    rigidBodyCount,
    constraintCount,
    dynamicBodyCount,
    chains,
    stability,
    physicsCost,
    apisProfile: profile ?? null,
  };
}
