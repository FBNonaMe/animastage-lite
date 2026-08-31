export type {
  CharacterIntelligenceProfile,
  CisReport,
  CisUserSummary,
  CisPipelineOptions,
  CisPipelineStatus,
  CisCapability,
  CisHealthBreakdown,
  CisPerformanceEstimate,
  CisPerformanceTier,
  CisSkeletonMap,
  CisMorphProfile,
  CisMaterialProfile,
  CisPhysicsProfile,
  CisDiagnostics,
  CisFingerprint,
  CisSourceFormat,
} from './types';

export {
  runCisPipeline,
  cisReportFromProfile,
  performanceLabel,
} from './pipeline';

export {
  buildUserSummary,
  loadCachedCisProfile,
  saveCachedCisProfile,
  formatTierRecommendation,
} from './cache';

export { analyzeSkeleton } from './modules/skeletonAnalyzer';
export { analyzeMesh } from './modules/meshAnalyzer';
export { analyzeMorphs } from './modules/morphAnalyzer';
export { analyzeMaterials } from './modules/materialIntelligence';
export { buildPhysicsProfile } from './modules/physicsIntelligence';
export { scanCapabilities } from './modules/capabilityScanner';
export { computeHealthScore } from './modules/healthScore';
export {
  getCharacterProfile,
  isCharacterProfileReady,
  getRecommendedPerformanceTier,
  modelSupportsCapability,
} from './accessors';
