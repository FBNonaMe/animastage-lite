/**
 * NVIDIA NIM (build.nvidia.com) API key + model settings.
 * Hosted OpenAI-compatible endpoint: https://integrate.api.nvidia.com/v1
 */

export interface NvidiaSettings {
  /** Model id e.g. meta/llama-3.3-70b-instruct */
  modelId: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

const KEY_STORAGE = 'animastage.nvidiaApiKey';
const SETTINGS_STORAGE = 'animastage.nvidiaSettings';
/** Scene Director preferred cloud provider when both keys exist. */
const DIRECTOR_PROVIDER_STORAGE = 'animastage.aiDirectorProvider';

export type AiDirectorCloudProvider = 'openrouter' | 'nvidia';

export const DEFAULT_NVIDIA_SETTINGS: NvidiaSettings = {
  modelId: 'meta/llama-3.3-70b-instruct',
  temperature: 0.55,
  maxTokens: 2048,
  timeoutMs: 90_000,
};

/** Curated chat models that work well for JSON scene plans on NVIDIA Integrate. */
export const NVIDIA_SCENE_DIRECTOR_MODELS: { id: string; label: string }[] = [
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
  { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (fast)' },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', label: 'Nemotron 70B' },
  { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B' },
  { id: 'mistralai/mixtral-8x7b-instruct-v0.1', label: 'Mixtral 8x7B' },
];

export function sanitizeNvidiaApiKey(raw: string): string {
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

export function getStoredNvidiaApiKey(): string {
  try {
    return sanitizeNvidiaApiKey(localStorage.getItem(KEY_STORAGE) ?? '');
  } catch {
    return '';
  }
}

export function setStoredNvidiaApiKey(key: string): void {
  const trimmed = sanitizeNvidiaApiKey(key);
  try {
    if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function resolveNvidiaApiKey(): string | undefined {
  const fromEnv = sanitizeNvidiaApiKey(
    (import.meta.env.VITE_NVIDIA_API_KEY as string | undefined) ?? ''
  );
  if (fromEnv) return fromEnv;
  const fromStore = getStoredNvidiaApiKey();
  return fromStore || undefined;
}

export function hasNvidiaApiKey(): boolean {
  return Boolean(resolveNvidiaApiKey());
}

export function loadNvidiaSettings(): NvidiaSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE);
    if (!raw) return { ...DEFAULT_NVIDIA_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<NvidiaSettings>;
    return {
      ...DEFAULT_NVIDIA_SETTINGS,
      ...parsed,
      modelId:
        typeof parsed.modelId === 'string' && parsed.modelId.trim()
          ? parsed.modelId.trim()
          : DEFAULT_NVIDIA_SETTINGS.modelId,
    };
  } catch {
    return { ...DEFAULT_NVIDIA_SETTINGS };
  }
}

export function saveNvidiaSettings(patch: Partial<NvidiaSettings>): NvidiaSettings {
  const next = {
    ...loadNvidiaSettings(),
    ...patch,
  };
  try {
    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function loadAiDirectorCloudProvider(): AiDirectorCloudProvider {
  try {
    const raw = localStorage.getItem(DIRECTOR_PROVIDER_STORAGE);
    if (raw === 'nvidia' || raw === 'openrouter') return raw;
  } catch {
    /* ignore */
  }
  // Prefer NVIDIA when only that key exists.
  if (hasNvidiaApiKey() && !resolveOpenRouterKeySafe()) return 'nvidia';
  return 'openrouter';
}

export function saveAiDirectorCloudProvider(provider: AiDirectorCloudProvider): void {
  try {
    localStorage.setItem(DIRECTOR_PROVIDER_STORAGE, provider);
  } catch {
    /* ignore */
  }
}

function resolveOpenRouterKeySafe(): boolean {
  try {
    const fromEnv = String(import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim();
    if (fromEnv) return true;
    return Boolean(localStorage.getItem('animastage.openrouterApiKey')?.trim());
  } catch {
    return false;
  }
}
