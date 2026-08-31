import type { CisPerformanceEstimate, CisPerformanceTier, CharacterIntelligenceProfile } from '../types';

function costLevel(score: number): 'low' | 'medium' | 'high' {
  if (score <= 33) return 'low';
  if (score <= 66) return 'medium';
  return 'high';
}

function recommendTier(
  tri: number,
  physicsBodies: number,
  textureMb: number
): CisPerformanceTier {
  const load = tri / 100_000 + physicsBodies / 20 + textureMb / 128;
  if (load >= 8) return 'performance';
  if (load >= 4) return 'balanced';
  if (load >= 2) return 'quality';
  return 'ultra';
}

export function predictPerformance(
  profile: Pick<CharacterIntelligenceProfile, 'mesh' | 'physics' | 'materials' | 'health'>
): CisPerformanceEstimate {
  const tri = profile.mesh.triangleCount;
  const bodies = profile.physics.dynamicBodyCount;
  const texCount = profile.materials.materials.length;

  const textureMemoryMb = Math.round(texCount * 4 + profile.materials.largeTextureCount * 8);
  const memoryMb = Math.round(tri / 8000 + bodies * 0.5 + textureMemoryMb);

  const gpuScore = Math.min(100, tri / 8000 + profile.mesh.submeshCount * 2);
  const cpuScore = Math.min(100, bodies * 2 + profile.mesh.vertexCount / 50000);
  const physicsScore = Math.min(100, bodies * 2.5);

  let expectedFps = 60;
  if (tri > 400_000) expectedFps = 45;
  if (tri > 800_000) expectedFps = 30;
  if (tri > 1_200_000) expectedFps = 24;
  if (bodies > 30) expectedFps = Math.min(expectedFps, 50);

  const recommendedTier = recommendTier(tri, bodies, textureMemoryMb);

  return {
    cpuCost: costLevel(cpuScore),
    gpuCost: costLevel(gpuScore),
    memoryMb,
    textureMemoryMb,
    physicsCost: costLevel(physicsScore),
    animationCost: tri > 300_000 ? 'medium' : 'low',
    expectedFps,
    recommendedTier,
  };
}

export function tierLabel(tier: CisPerformanceTier): string {
  switch (tier) {
    case 'performance':
      return 'Performance';
    case 'balanced':
      return 'Balanced';
    case 'quality':
      return 'Quality';
    case 'ultra':
      return 'Ultra';
  }
}

export function performanceLabel(estimate: CisPerformanceEstimate): string {
  if (estimate.expectedFps >= 58 && estimate.gpuCost !== 'high') return 'Excellent';
  if (estimate.expectedFps >= 45) return 'Good';
  if (estimate.expectedFps >= 30) return 'Fair';
  return 'Heavy';
}
