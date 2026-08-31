import type { UmceReport } from '../../umce/types';
import type { CisAutoRepairPatch } from '../types';

export function buildAutoRepairs(
  umceReport: UmceReport | null,
  missingTextures: string[]
): CisAutoRepairPatch[] {
  const patches: CisAutoRepairPatch[] = [];

  if (umceReport?.repairs?.length) {
    for (const r of umceReport.repairs) {
      patches.push({
        id: `umce_${r.kind}`,
        category: 'skeleton',
        description: r.description ?? r.kind,
        applied: r.applied ?? false,
      });
    }
  }

  for (const tex of missingTextures.slice(0, 8)) {
    patches.push({
      id: `tex_${tex}`,
      category: 'texture',
      description: `Fallback for missing texture: ${tex}`,
      applied: true,
    });
  }

  if (patches.length === 0) {
    patches.push({
      id: 'none',
      category: 'none',
      description: 'No repairs needed',
      applied: false,
    });
  }

  return patches;
}
