/** Floor helpers for character / camera placement. */
import type { EnvAnalysisCache } from './types';

export function resolveFloorY(
  analysis: EnvAnalysisCache | null,
  override: number | null
): number {
  if (override != null && Number.isFinite(override)) return override;
  return analysis?.floorY ?? 0;
}
