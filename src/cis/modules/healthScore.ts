import type { CisHealthBreakdown, CharacterIntelligenceProfile } from '../types';

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeHealthScore(
  profile: Pick<
    CharacterIntelligenceProfile,
    'skeleton' | 'morphs' | 'materials' | 'physics' | 'mesh' | 'compatibility' | 'modelAnalysis'
  >
): CisHealthBreakdown {
  const skeleton = clampScore(
    (profile.skeleton.boneCount > 10 ? 40 : profile.skeleton.boneCount * 4) +
      profile.skeleton.symmetryScore * 0.4 +
      (profile.skeleton.regions.head?.length ? 15 : 0) +
      (profile.skeleton.regions.spine?.length ? 10 : 0)
  );

  const morphs = clampScore(
    profile.morphs.totalMorphs > 0
      ? 50 +
          profile.morphs.categories.filter((c) => c.detected).length * 6 +
          (profile.morphs.hasFacialExpressions ? 10 : 0)
      : 40
  );

  const texPenalty = profile.materials.missingTextureCount * 8;
  const materials = clampScore(
    90 - texPenalty - profile.materials.unusedMaterialCount * 2
  );

  const textures = clampScore(95 - profile.materials.missingTextureCount * 10 - profile.materials.largeTextureCount * 3);

  const physics =
    profile.physics.stability === 'stable'
      ? 92
      : profile.physics.stability === 'fair'
        ? 75
        : profile.physics.rigidBodyCount === 0
          ? 70
          : 55;

  const tri = profile.mesh.triangleCount;
  const performance = clampScore(
    tri <= 80_000 ? 95 : tri <= 200_000 ? 82 : tri <= 400_000 ? 68 : tri <= 800_000 ? 52 : 38
  );

  const animation = clampScore(
    85 -
      profile.compatibility.brokenReferences.length * 10 -
      profile.compatibility.missingData.length * 5
  );

  const compatibility = clampScore(
    (profile.compatibility.sourceFormat === 'pmx' || profile.compatibility.sourceFormat === 'pmd'
      ? 90
      : profile.compatibility.gltfReady
        ? 75
        : 65) - profile.compatibility.unsupportedFeatures.length * 5
  );

  const overall = clampScore(
    skeleton * 0.15 +
      morphs * 0.1 +
      materials * 0.12 +
      textures * 0.1 +
      physics * 0.18 +
      performance * 0.15 +
      animation * 0.1 +
      compatibility * 0.1
  );

  return {
    overall,
    physics,
    skeleton,
    morphs,
    materials,
    textures,
    animation,
    performance,
    compatibility,
  };
}
