import type { UmceModelContext } from '../umce/types';
import type { ApisBoneMetrics, ApisDetectedChain, ApisChainKind } from './types';

const MMD_DYNAMIC = 1;

function isFlexibleBone(m: ApisBoneMetrics): boolean {
  return (
    m.hasPhysicsBody ||
    m.isPhysicsOnly ||
    m.isGrant ||
    m.influenceWeight > 50 ||
    (m.childCount <= 1 && m.depth > 4)
  );
}

function chainKindFromSignals(
  bones: ApisBoneMetrics[],
  avgLen: number,
  refLen: number,
  bodyCount: number
): { kind: ApisChainKind; confidence: number } {
  const names = bones.map((b) => b.name.toLowerCase()).join(' ');
  let kind: ApisChainKind = 'unknown_flexible';
  let confidence = 0.45;

  const lenRatio = avgLen / Math.max(refLen, 0.01);
  const depth = bones.length;
  const influence = bones.reduce((s, b) => s + b.influenceWeight, 0);

  if (lenRatio > 1.8 && depth >= 6) {
    kind = 'long_hair';
    confidence = 0.72;
  } else if (lenRatio > 1.2 && depth >= 4) {
    kind = 'hair';
    confidence = 0.65;
  } else if (bodyCount >= 3 && depth >= 5 && influence > 200) {
    kind = 'skirt';
    confidence = 0.68;
  } else if (bodyCount >= 2 && depth >= 4) {
    kind = 'dress';
    confidence = 0.6;
  } else if (depth >= 3 && bodyCount >= 1) {
    kind = 'accessory';
    confidence = 0.55;
  }

  // Name hints — low weight tiebreaker only (max +0.12)
  const nameBoost: Array<[RegExp, ApisChainKind, number]> = [
    [/尻尾|しっぽ|tail/i, 'tail', 0.1],
    [/ツイン|twin|twintail/i, 'twin_tail', 0.1],
    [/ポニー|ponytail/i, 'ponytail', 0.1],
    [/スカート|skirt/i, 'skirt', 0.1],
    [/ケープ|cape|マント/i, 'cape', 0.1],
    [/リボン|ribbon/i, 'ribbon', 0.08],
    [/髪|hair/i, 'hair', 0.08],
    [/マフラー|scarf/i, 'scarf', 0.08],
    [/袖|sleeve/i, 'sleeve', 0.08],
  ];
  for (const [re, k, boost] of nameBoost) {
    if (re.test(names)) {
      kind = k;
      confidence = Math.min(0.95, confidence + boost);
      break;
    }
  }

  if (kind === 'hair' && lenRatio < 0.8) kind = 'short_hair';

  return { kind, confidence: Math.min(0.98, confidence) };
}

export function detectFlexibleChains(
  metrics: ApisBoneMetrics[],
  ctx: UmceModelContext,
  refLen: number
): ApisDetectedChain[] {
  const byIndex = new Map(metrics.map((m) => [m.index, m]));
  const dynamicBodies = ctx.rigidBodies.filter((r) => r.type === MMD_DYNAMIC || r.type === 2);
  const chains: ApisDetectedChain[] = [];
  const usedBones = new Set<number>();

  const seeds = dynamicBodies.length
    ? dynamicBodies.map((r) => r.boneIndex).filter((i) => i >= 0)
    : metrics.filter((m) => m.childCount === 0 && m.influenceWeight > 80).map((m) => m.index);

  for (const seed of seeds) {
    if (usedBones.has(seed)) continue;
    const chainIndices: number[] = [];
    let cur = seed;
    const seen = new Set<number>();

    while (cur >= 0 && !seen.has(cur)) {
      seen.add(cur);
      const m = byIndex.get(cur);
      if (!m) break;
      chainIndices.unshift(cur);
      if (m.parentIndex < 0) break;
      const parent = byIndex.get(m.parentIndex);
      if (!parent) break;
      if (!isFlexibleBone(m) && !m.hasPhysicsBody) break;
      if (parent.childCount > 2 && !parent.hasPhysicsBody) break;
      cur = m.parentIndex;
    }

    if (chainIndices.length < 2) continue;
    chainIndices.forEach((i) => usedBones.add(i));

    const chainBones = chainIndices.map((i) => byIndex.get(i)!).filter(Boolean);
    const avgLen =
      chainBones.reduce((s, b) => s + b.length, 0) / Math.max(1, chainBones.length);
    const bodyIndices = dynamicBodies
      .filter((r) => chainIndices.includes(r.boneIndex))
      .map((r) => r.index);
    const { kind, confidence } = chainKindFromSignals(
      chainBones,
      avgLen,
      refLen,
      bodyIndices.length
    );

    chains.push({
      id: `chain_${chains.length}`,
      kind,
      confidence,
      boneIndices: chainIndices,
      rigidBodyIndices: bodyIndices,
      avgBoneLength: avgLen,
      depth: chainIndices.length,
      vertexInfluence: chainBones.reduce((s, b) => s + b.influenceWeight, 0),
    });
  }

  return chains.sort((a, b) => b.vertexInfluence - a.vertexInfluence);
}
