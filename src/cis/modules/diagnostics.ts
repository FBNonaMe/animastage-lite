import type { ModelAnalysisReport } from '../../analyzer/types';
import type { CisDiagnostics, CisDiagnosticRow, CharacterIntelligenceProfile } from '../types';

function row(
  id: string,
  label: string,
  status: CisDiagnosticRow['status'],
  detail?: string
): CisDiagnosticRow {
  return { id, label, status, detail };
}

export function buildDiagnostics(
  profile: Pick<
    CharacterIntelligenceProfile,
    'skeleton' | 'morphs' | 'materials' | 'physics' | 'compatibility' | 'modelAnalysis'
  >
): CisDiagnostics {
  const rows: CisDiagnosticRow[] = [];

  rows.push(
    row(
      'skeleton',
      'Skeleton',
      profile.skeleton.boneCount > 0 ? 'ok' : 'error',
      `${profile.skeleton.boneCount} bones`
    )
  );

  rows.push(
    row(
      'morphs',
      'Morphs',
      profile.morphs.totalMorphs > 0 ? 'ok' : 'warning',
      profile.morphs.totalMorphs > 0 ? `${profile.morphs.totalMorphs} morphs` : 'No morphs'
    )
  );

  rows.push(
    row(
      'physics',
      'Physics',
      profile.physics.stability === 'unstable'
        ? 'warning'
        : profile.physics.rigidBodyCount > 0
          ? 'ok'
          : 'skipped',
      profile.physics.stability === 'stable'
        ? 'Stable'
        : profile.physics.stability === 'fair'
          ? 'Fair'
          : profile.physics.rigidBodyCount === 0
            ? 'No physics bodies'
            : 'Needs tuning'
    )
  );

  rows.push(
    row(
      'materials',
      'Materials',
      profile.materials.missingTextureCount > 0 ? 'warning' : 'ok',
      profile.materials.missingTextureCount > 0
        ? `${profile.materials.missingTextureCount} missing textures`
        : 'Optimized'
    )
  );

  rows.push(
    row(
      'textures',
      'Textures',
      profile.materials.missingTextureCount > 0 ? 'warning' : 'ok',
      profile.materials.missingTextureCount > 0 ? 'Some missing' : 'Loaded'
    )
  );

  rows.push(
    row(
      'animation',
      'Animation',
      profile.compatibility.brokenReferences.length > 0 ? 'warning' : 'ok',
      'Compatible'
    )
  );

  const modelIssues = profile.modelAnalysis?.issues ?? [];
  for (const issue of modelIssues.slice(0, 4)) {
    rows.push(
      row(`issue_${issue.id}`, issue.title, issue.severity === 'error' ? 'error' : 'warning', issue.detail)
    );
  }

  const warningCount = rows.filter((r) => r.status === 'warning').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;

  return { rows, warningCount, errorCount };
}

export function diagnosticsFromAnalysis(modelAnalysis: ModelAnalysisReport | null): CisDiagnostics {
  if (!modelAnalysis) {
    return {
      rows: [row('pending', 'Analysis', 'skipped', 'Pending')],
      warningCount: 0,
      errorCount: 0,
    };
  }
  return buildDiagnostics({
    skeleton: { boneCount: modelAnalysis.stats.boneCount } as CharacterIntelligenceProfile['skeleton'],
    morphs: { totalMorphs: modelAnalysis.stats.morphCount } as CharacterIntelligenceProfile['morphs'],
    materials: {
      missingTextureCount: modelAnalysis.stats.missingTextureCount,
    } as CharacterIntelligenceProfile['materials'],
    physics: { stability: 'stable', rigidBodyCount: modelAnalysis.stats.rigidBodyCount } as CharacterIntelligenceProfile['physics'],
    compatibility: { brokenReferences: [] } as CharacterIntelligenceProfile['compatibility'],
    modelAnalysis,
  });
}
