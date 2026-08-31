import { getEffectiveDegradeLevel } from '../effectiveDegradeLevel';
import { getPerfGovernorFxGate } from './perfGovernor';

/**
 * Read-only render hints for Viewport — does not change animation.
 * Shadows degrade in resolution first (L1–L2), turn off only at L3+
 * or when the governor's scene tier disables them. DPR is never touched here.
 */
export function getPerfRenderAdaptation(): {
  enableShadows: boolean;
  /** Shadow map resolution multiplier (1 = full). */
  shadowMapScale: number;
} {
  const gate = getPerfGovernorFxGate();
  const level = getEffectiveDegradeLevel();

  if (!gate.allowShadows) {
    return { enableShadows: false, shadowMapScale: 0.5 };
  }
  if (level >= 4) {
    return { enableShadows: false, shadowMapScale: 0.5 };
  }
  if (level >= 3) {
    return { enableShadows: true, shadowMapScale: 0.5 };
  }
  if (level >= 2 || gate.shadowScale < 1) {
    return { enableShadows: true, shadowMapScale: 0.5 };
  }
  if (level >= 1) {
    return { enableShadows: true, shadowMapScale: 0.75 };
  }
  return { enableShadows: true, shadowMapScale: 1 };
}
