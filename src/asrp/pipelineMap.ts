/** Pipeline flag helpers — kept out of index to avoid circular imports with v2/resolveFrame. */
import type { AsrpPipelineId } from './types';

export function pipelineToRenderFlags(pipeline: AsrpPipelineId): {
  renderMode: 'mmd_fidelity' | 'pbr_cinematic' | 'asrp' | 'anime_npr';
  rtxModeEnabled: boolean;
} {
  if (pipeline === 'classic') {
    return { renderMode: 'mmd_fidelity', rtxModeEnabled: false };
  }
  if (pipeline === 'rtx_lite') {
    return { renderMode: 'asrp', rtxModeEnabled: true };
  }
  return { renderMode: 'asrp', rtxModeEnabled: false };
}

export function renderFlagsToPipeline(
  renderMode: string | undefined,
  rtxModeEnabled: boolean
): AsrpPipelineId {
  if (renderMode === 'anime_npr') return 'asrp';
  if (renderMode === 'mmd_fidelity') return 'classic';
  if (rtxModeEnabled) return 'rtx_lite';
  return 'asrp';
}
