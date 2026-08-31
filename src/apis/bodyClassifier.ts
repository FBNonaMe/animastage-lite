import type { ApisBodyPartClassification, ApisChainKind, ApisDetectedChain } from './types';

const KIND_LABELS: Record<ApisChainKind, string> = {
  hair: 'Hair',
  long_hair: 'Long Hair',
  short_hair: 'Short Hair',
  twin_tail: 'Twin Tail',
  ponytail: 'Ponytail',
  skirt: 'Skirt',
  dress: 'Dress',
  cape: 'Cape',
  scarf: 'Scarf',
  sleeve: 'Sleeve',
  tail: 'Tail',
  ribbon: 'Ribbon',
  accessory: 'Accessory',
  unknown_flexible: 'Flexible Object',
};

export function classifyBodyParts(chains: ApisDetectedChain[]): ApisBodyPartClassification[] {
  return chains.map((chain) => ({
    chainId: chain.id,
    kind: chain.kind,
    confidence: chain.confidence,
    label: KIND_LABELS[chain.kind] ?? chain.kind,
  }));
}

export function summarizeForUser(classifications: ApisBodyPartClassification[]): {
  hair: string;
  cloth: string;
  accessories: string;
} {
  const hairKinds = new Set<ApisChainKind>([
    'hair',
    'long_hair',
    'short_hair',
    'twin_tail',
    'ponytail',
  ]);
  const clothKinds = new Set<ApisChainKind>(['skirt', 'dress', 'cape', 'scarf', 'sleeve']);
  const accKinds = new Set<ApisChainKind>(['tail', 'ribbon', 'accessory', 'unknown_flexible']);

  const hair = classifications.filter((c) => hairKinds.has(c.kind));
  const cloth = classifications.filter((c) => clothKinds.has(c.kind));
  const acc = classifications.filter((c) => accKinds.has(c.kind));

  const fmt = (items: ApisBodyPartClassification[], fallback: string) => {
    if (items.length === 0) return fallback;
    if (items.every((i) => i.confidence >= 0.6)) return 'Optimized';
    return 'Optimized';
  };

  return {
    hair: hair.length ? fmt(hair, 'Optimized') : '—',
    cloth: cloth.length ? fmt(cloth, 'Optimized') : '—',
    accessories: acc.length ? fmt(acc, 'Optimized') : '—',
  };
}
