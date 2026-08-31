import type { CharacterIntelligenceProfile, CisFingerprint } from '../types';

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function hashList(items: string[]): string {
  return fnv1a(items.sort().join('|'));
}

export function buildFingerprint(
  profile: Pick<
    CharacterIntelligenceProfile,
    'skeleton' | 'morphs' | 'materials' | 'physics' | 'modelFileName' | 'sourceFormat'
  >,
  contentFingerprint?: string
): CisFingerprint {
  const skeletonHash = hashList(profile.skeleton.bones.map((b) => `${b.name}:${b.parentName ?? ''}`));
  const morphHash = hashList(
    profile.morphs.categories.flatMap((c) => c.morphNames).concat(profile.morphs.customMorphs)
  );
  const materialHash = hashList(profile.materials.materials.map((m) => `${m.name}:${m.kind}`));
  const physicsHash = fnv1a(
    `${profile.physics.rigidBodyCount}:${profile.physics.constraintCount}:${profile.physics.chains.map((c) => c.kind).join(',')}`
  );
  const textureHash = fnv1a(
    profile.materials.materials
      .map((m) => `${m.name}:${m.textureResolution ?? 0}`)
      .join(';')
  );
  const modelHash = contentFingerprint
    ? fnv1a(contentFingerprint)
    : fnv1a(`${profile.modelFileName ?? 'model'}:${profile.sourceFormat}`);

  const combined = fnv1a(
    [modelHash, skeletonHash, physicsHash, materialHash, morphHash, textureHash].join(':')
  );

  return {
    modelHash,
    skeletonHash,
    physicsHash,
    materialHash,
    morphHash,
    textureHash,
    combined,
  };
}
