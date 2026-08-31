export {
  type OpenRouterSettings,
  DEFAULT_OPENROUTER_SETTINGS,
  getStoredOpenRouterApiKey,
  setStoredOpenRouterApiKey,
  resolveOpenRouterApiKey,
  hasOpenRouterApiKey,
  loadOpenRouterSettings,
  saveOpenRouterSettings,
  loadModelsCache,
  saveModelsCache,
  MODELS_CACHE_TTL_MS,
} from './settings';

export {
  type OpenRouterModel,
  normalizeOpenRouterModel,
  sortModels,
  filterModels,
  BADGE_LABEL,
} from './models';

export {
  generateCloudText,
  generateOpenRouterText,
  fetchOpenRouterModels,
  getCachedOrEmptyModels,
  testOpenRouterConnection,
  formatOpenRouterError,
  isRateLimitError,
  type GenerateCloudTextOptions,
  type ConnectionTestResult,
} from './client';
