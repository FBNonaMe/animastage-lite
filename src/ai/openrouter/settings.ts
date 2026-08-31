/**
 * OpenRouter settings + secure key storage (localStorage / env only).
 */

export interface OpenRouterSettings {
  /** Selected model id (e.g. deepseek/deepseek-r1:free) */
  modelId: string;
  temperature: number;
  maxTokens: number;
  /** Request timeout in ms */
  timeoutMs: number;
  freeOnly: boolean;
  favoriteIds: string[];
  pinnedIds: string[];
  recentIds: string[];
}

const KEY_STORAGE = 'animastage.openrouterApiKey';
const SETTINGS_STORAGE = 'animastage.openrouterSettings';
const MODELS_CACHE_STORAGE = 'animastage.openrouterModelsCache';

export const DEFAULT_OPENROUTER_SETTINGS: OpenRouterSettings = {
  modelId: '',
  temperature: 0.7,
  maxTokens: 4096,
  timeoutMs: 90_000,
  freeOnly: true,
  favoriteIds: [],
  pinnedIds: [],
  recentIds: [],
};

/** Strip quotes, Bearer prefix, zero-width chars — common paste mistakes. */
export function sanitizeOpenRouterApiKey(raw: string): string {
  let k = String(raw ?? '').trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(k)) k = k.replace(/^bearer\s+/i, '').trim();
  k = k.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return k;
}

export function getStoredOpenRouterApiKey(): string {
  try {
    return sanitizeOpenRouterApiKey(localStorage.getItem(KEY_STORAGE) ?? '');
  } catch {
    return '';
  }
}

export function setStoredOpenRouterApiKey(key: string): void {
  const trimmed = sanitizeOpenRouterApiKey(key);
  try {
    if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

/** Env first, then saved UI key. Never logged / never sent elsewhere. */
export function resolveOpenRouterApiKey(): string | undefined {
  const fromEnv = sanitizeOpenRouterApiKey(
    (import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined) ?? ''
  );
  if (fromEnv) return fromEnv;
  const fromStore = getStoredOpenRouterApiKey();
  return fromStore || undefined;
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(resolveOpenRouterApiKey());
}

export function loadOpenRouterSettings(): OpenRouterSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE);
    if (!raw) return { ...DEFAULT_OPENROUTER_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<OpenRouterSettings>;
    return {
      ...DEFAULT_OPENROUTER_SETTINGS,
      ...parsed,
      // Studio ships free-only — never expose paid catalog in UI.
      freeOnly: true,
      favoriteIds: Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds : [],
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds : [],
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds : [],
    };
  } catch {
    return { ...DEFAULT_OPENROUTER_SETTINGS };
  }
}

export function saveOpenRouterSettings(patch: Partial<OpenRouterSettings>): OpenRouterSettings {
  const next = {
    ...loadOpenRouterSettings(),
    ...patch,
    freeOnly: true,
  };
  try {
    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export interface ModelsCachePayload {
  fetchedAt: number;
  models: unknown[];
}

export function loadModelsCache(): ModelsCachePayload | null {
  try {
    const raw = localStorage.getItem(MODELS_CACHE_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelsCachePayload;
    if (!Array.isArray(parsed.models) || !parsed.fetchedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveModelsCache(models: unknown[]): void {
  try {
    localStorage.setItem(
      MODELS_CACHE_STORAGE,
      JSON.stringify({ fetchedAt: Date.now(), models } satisfies ModelsCachePayload)
    );
  } catch {
    /* ignore */
  }
}

export const MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
