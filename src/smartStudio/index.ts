export type {
  SceneProfile,
  SmartBackgroundId,
  SmartCameraPreset,
  SmartExpressionId,
  SmartGpuTier,
  SmartPhotoPreset,
  SmartStudioMode,
  SmartStudioPhase,
  SmartStudioReport,
  SmartStudioState,
  SmartVideoPath,
  SmartVideoPreset,
} from './types';

export { analyzeSceneProfile } from './analyzeScene';
export { estimateGpuTier, fpsTargetForTier, qualityLabelForTier } from './qualityEngine';
export { buildSmartStudioPatch } from './buildSmartPatch';
export {
  applyPatchToState,
  captureSmartSnapshot,
  prepareSmartStudio,
  restoreSmartSnapshot,
} from './applySmartStudio';
export { captureSmartStill } from './captureStill';
export type { StillExportKind } from './captureStill';
export { useSmartStudio } from './useSmartStudio';
export type { SmartStudioApi, SmartStudioBridge } from './useSmartStudio';
export { default as SmartStudioDialog } from './SmartStudioDialog';
export { default as SmartStudioOverlay } from './SmartStudioOverlay';
export { default as SmartReportCard } from './SmartReportCard';
