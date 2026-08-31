/**
 * Smart Render — viewport-only quality scaling when GPU is overloaded.
 * Final / Cinema / RP4 export always uses lockExportQuality budgets.
 */
import type { AppState, VisualFxSettings } from '../types';
import type { RenderPipeline4State } from './types';
import { DEFAULT_RENDER_PIPELINE_4 } from './defaults';

export interface SmartViewportSnapshot {
  visualFx: VisualFxSettings;
  characterQuality: AppState['characterQuality'];
  rtxModeEnabled: boolean;
  reflectionSystem?: AppState['reflectionSystem'];
  asrp?: AppState['asrp'];
}

/**
 * Build a lighter viewport patch. Never call this for offline/cinema export.
 */
export function buildSmartViewportDowngrade(
  appState: AppState,
  measuredFps: number
): { patch: Partial<AppState>; scale: number } | null {
  const rp4 = appState.renderPipeline4 ?? DEFAULT_RENDER_PIPELINE_4;
  if (!rp4.smartRender.enabled) return null;
  if (measuredFps >= rp4.smartRender.targetFps) return null;

  const deficit = rp4.smartRender.targetFps - measuredFps;
  const scale = Math.max(0.45, 1 - deficit / Math.max(24, rp4.smartRender.targetFps));

  const fx: VisualFxSettings = {
    ...appState.visualFx,
    ssaoHalfRes: true,
    ssaoEnabled: scale > 0.7 ? appState.visualFx.ssaoEnabled : false,
    godRaysEnabled: false,
    dofEnabled: scale > 0.85 ? appState.visualFx.dofEnabled : false,
    particlesEnabled: scale > 0.75 ? appState.visualFx.particlesEnabled : false,
    bloomIntensity: (appState.visualFx.bloomIntensity ?? 0.3) * Math.min(1, scale + 0.15),
    particleIntensity: (appState.visualFx.particleIntensity ?? 0.5) * scale,
  };

  const patch: Partial<AppState> = {
    visualFx: fx,
    characterQuality:
      scale < 0.6
        ? 'standard'
        : appState.characterQuality === 'uhd4k'
          ? 'hd'
          : appState.characterQuality,
    reflectionSystem: appState.reflectionSystem
      ? {
          ...appState.reflectionSystem,
          refreshRate: Math.max(2.5, (appState.reflectionSystem.refreshRate ?? 2.5) * 1.5),
          resolution: scale < 0.7 ? 128 : appState.reflectionSystem.resolution,
          exportBoost: false,
        }
      : undefined,
    asrp: appState.asrp
      ? {
          ...appState.asrp,
          quality: scale < 0.65 ? 'simplified' : appState.asrp.quality,
          exportBoost: false,
        }
      : undefined,
    renderPipeline4: {
      ...rp4,
      smartRender: { ...rp4.smartRender, viewportScale: scale },
    },
  };

  return { patch, scale };
}

/** Ensure export path never reads viewport smart scale. */
export function assertExportQualityLocked(rp4: RenderPipeline4State): void {
  if (!rp4.lockExportQuality) {
    console.warn(
      '[RP4] lockExportQuality is off — enabling for this export to protect final quality.'
    );
  }
}
