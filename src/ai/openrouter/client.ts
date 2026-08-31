/**
 * OpenRouter HTTP client — single cloud AI gateway for AnimaStage Lite.
 * Docs: https://openrouter.ai/docs
 */
import {
  loadOpenRouterSettings,
  loadModelsCache,
  MODELS_CACHE_TTL_MS,
  resolveOpenRouterApiKey,
  saveModelsCache,
  saveOpenRouterSettings,
} from './settings';
import {
  filterModels,
  normalizeOpenRouterModel,
  sortModels,
  type OpenRouterModel,
} from './models';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const APP_TITLE = 'AnimaStage Lite';
const APP_REFERER =
  typeof window !== 'undefined' ? window.location.origin : 'https://animastage.lite';

export function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return (
    status === 429 ||
    /\b429\b/.test(msg) ||
    /rate.?limit/i.test(msg) ||
    /quota/i.test(msg)
  );
}

function extractApiErrorMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string; code?: string | number };
      message?: string;
    };
    const nested = json.error?.message || json.message;
    if (nested) return String(nested);
  } catch {
    /* plain text */
  }
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

export function formatOpenRouterError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const rawMsg = String((err as { message?: string })?.message ?? err ?? '');
  const detail = extractApiErrorMessage(rawMsg);

  if (status === 401 || status === 403) {
    return detail && !/^invalid/i.test(detail)
      ? detail
      : 'Invalid OpenRouter API key. Paste the key from openrouter.ai/keys, click Save, then Test.';
  }
  if (isRateLimitError(err)) {
    return 'OpenRouter rate limit on free models. Wait a bit or pick another free model.';
  }
  if (status === 404) {
    return 'Model unavailable. Pick another free model in AI Settings.';
  }
  if (status === 402) {
    return 'This model requires credits. Pick a free (:free) model instead.';
  }
  if (detail) return detail.length > 200 ? `${detail.slice(0, 197)}…` : detail;
  return 'OpenRouter request failed';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': APP_REFERER,
    'X-Title': APP_TITLE,
  };
}

async function openRouterFetch(
  path: string,
  init: RequestInit & {
    timeoutMs?: number;
    /** Models catalog is public; chat requires a key. */
    auth?: 'required' | 'optional' | 'none';
  } = {}
): Promise<Response> {
  const authMode = init.auth ?? 'required';
  const key = authMode === 'none' ? undefined : resolveOpenRouterApiKey();
  if (authMode === 'required' && !key) {
    throw Object.assign(new Error('Add an OpenRouter API key in AI Settings'), { status: 401 });
  }

  const { timeoutMs: timeoutOpt, auth: _auth, ...fetchInit } = init;
  const timeoutMs = timeoutOpt ?? loadOpenRouterSettings().timeoutMs;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OPENROUTER_BASE}${path}`, {
      ...fetchInit,
      signal: ctrl.signal,
      headers: {
        ...(key
          ? authHeaders(key)
          : {
              'Content-Type': 'application/json',
              'HTTP-Referer': APP_REFERER,
              'X-Title': APP_TITLE,
            }),
        ...(fetchInit.headers ?? {}),
      },
    });
    return res;
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw Object.assign(new Error('OpenRouter request timed out'), { status: 408 });
    }
    throw Object.assign(
      new Error('Network error reaching OpenRouter'),
      { status: 0, cause: err }
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchOpenRouterModels(force = false): Promise<OpenRouterModel[]> {
  const cached = loadModelsCache();
  if (
    !force &&
    cached &&
    Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS &&
    cached.models.length
  ) {
    return sortModels(
      cached.models
        .map((row) => normalizeOpenRouterModel(row as Parameters<typeof normalizeOpenRouterModel>[0]))
        .filter((m): m is OpenRouterModel => Boolean(m))
    );
  }

  const res = await openRouterFetch('/models', {
    method: 'GET',
    timeoutMs: 30_000,
    auth: 'none',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(
      new Error(extractApiErrorMessage(body) || `OpenRouter models failed (${res.status})`),
      { status: res.status }
    );
  }
  const data = (await res.json()) as { data?: unknown[] };
  const rawList = Array.isArray(data.data) ? data.data : [];
  saveModelsCache(rawList);
  return sortModels(
    rawList
      .map((row) => normalizeOpenRouterModel(row as Parameters<typeof normalizeOpenRouterModel>[0]))
      .filter((m): m is OpenRouterModel => Boolean(m))
  );
}

export function getCachedOrEmptyModels(): OpenRouterModel[] {
  const cached = loadModelsCache();
  if (!cached?.models?.length) return [];
  return sortModels(
    cached.models
      .map((row) => normalizeOpenRouterModel(row as Parameters<typeof normalizeOpenRouterModel>[0]))
      .filter((m): m is OpenRouterModel => Boolean(m))
  );
}

export interface GenerateCloudTextOptions {
  onProgress?: (message: string) => void;
  systemInstruction?: string;
  responseJsonSchema?: Record<string, unknown>;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  /** @deprecated Gemini compat — ignored */
  store?: boolean;
}

function pickFallbackModels(primary: string, catalog: OpenRouterModel[]): string[] {
  const pool = filterModels(catalog, { freeOnly: true });
  const ids = [primary, ...pool.map((m) => m.id)].filter(Boolean);
  return [...new Set(ids)].slice(0, 5);
}

/**
 * Chat completion via OpenRouter — drop-in replacement for generateGeminiText.
 */
export async function generateCloudText(
  prompt: string,
  options: GenerateCloudTextOptions = {}
): Promise<string> {
  const settings = loadOpenRouterSettings();
  let catalog = getCachedOrEmptyModels();
  if (!catalog.length) {
    options.onProgress?.('Loading OpenRouter models…');
    try {
      catalog = await fetchOpenRouterModels(false);
    } catch {
      /* continue with configured model only */
    }
  }

  let modelId = options.modelId || settings.modelId;
  const free = filterModels(catalog, { freeOnly: true });
  if (modelId && free.length && !free.some((m) => m.id === modelId)) {
    modelId = '';
  }
  if (!modelId) {
    modelId = free[0]?.id ?? '';
  }
  if (!modelId) {
    throw new Error('No free OpenRouter model available. Open AI Settings and refresh models.');
  }

  // Persist default if empty
  if (!settings.modelId && modelId) {
    saveOpenRouterSettings({ modelId });
  }

  const candidates = pickFallbackModels(modelId, catalog);
  const temperature = options.temperature ?? settings.temperature;
  const maxTokens = options.maxTokens ?? settings.maxTokens;

  let lastErr: unknown;
  for (let modelIdx = 0; modelIdx < candidates.length; modelIdx++) {
    const model = candidates[modelIdx]!;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0 || modelIdx > 0) {
          options.onProgress?.(
            attempt > 0 ? `Retry ${attempt}/2 (${model})…` : `Trying ${model}…`
          );
        } else {
          options.onProgress?.(`OpenRouter · ${model}`);
        }

        const messages: Array<{ role: string; content: string }> = [];
        if (options.systemInstruction) {
          messages.push({ role: 'system', content: options.systemInstruction });
        }
        const userContent = options.responseJsonSchema
          ? `${prompt}\n\nRespond with valid JSON only matching the required schema.`
          : prompt;
        messages.push({ role: 'user', content: userContent });

        const body: Record<string, unknown> = {
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        };
        if (options.responseJsonSchema) {
          body.response_format = { type: 'json_object' };
        }

        const res = await openRouterFetch('/chat/completions', {
          method: 'POST',
          body: JSON.stringify(body),
          timeoutMs: settings.timeoutMs,
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const err = Object.assign(
            new Error(extractApiErrorMessage(errBody) || `OpenRouter HTTP ${res.status}`),
            { status: res.status }
          );
          throw err;
        }

        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        let text = '';
        if (typeof content === 'string') text = content;
        else if (Array.isArray(content)) {
          text = content.map((c) => c.text ?? '').join('');
        }
        text = text.trim();
        if (!text) throw new Error('OpenRouter returned an empty response');

        // Track recent
        const recent = [model, ...settings.recentIds.filter((id) => id !== model)].slice(0, 12);
        saveOpenRouterSettings({ recentIds: recent, modelId: settings.modelId || model });

        return text;
      } catch (err) {
        lastErr = err;
        if (!isRateLimitError(err)) {
          const status = (err as { status?: number })?.status;
          // Try next model on unavailable / bad request for this model
          if (status === 404 || status === 400) {
            if (modelIdx < candidates.length - 1) break;
            throw err instanceof Error ? err : new Error(formatOpenRouterError(err));
          }
          if (modelIdx < candidates.length - 1 && (status === 402 || status === 403)) break;
          if (status !== 429) {
            throw err instanceof Error ? err : new Error(formatOpenRouterError(err));
          }
        }
        if (attempt < 2) {
          const wait = 1500 * (attempt + 1);
          options.onProgress?.(`Rate limited — wait ${Math.ceil(wait / 1000)}s…`);
          await sleep(Math.min(wait, 8000));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(formatOpenRouterError(lastErr));
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  modelId: string;
  latencyMs: number;
}

export async function testOpenRouterConnection(
  onProgress?: (message: string) => void
): Promise<ConnectionTestResult> {
  const settings = loadOpenRouterSettings();
  const started = performance.now();
  onProgress?.('Testing OpenRouter…');

  // Ensure models available
  try {
    await fetchOpenRouterModels(false);
  } catch (err) {
    return {
      ok: false,
      message: formatOpenRouterError(err),
      modelId: settings.modelId || '—',
      latencyMs: Math.round(performance.now() - started),
    };
  }

  const catalog = getCachedOrEmptyModels();
  let modelId = settings.modelId;
  const freePool = filterModels(catalog, { freeOnly: true });
  // Drop paid selection if user had one saved earlier
  if (modelId && !freePool.some((m) => m.id === modelId)) {
    modelId = '';
  }
  if (!modelId) {
    modelId = freePool[0]?.id ?? '';
    if (modelId) saveOpenRouterSettings({ modelId });
  }
  if (!modelId) {
    return {
      ok: false,
      message: 'No free models found. Click refresh and try again.',
      modelId: '—',
      latencyMs: Math.round(performance.now() - started),
    };
  }

  try {
    const reply = await generateCloudText('Reply with exactly one word: ok', {
      onProgress,
      modelId,
      maxTokens: 16,
      temperature: 0,
    });
    const latencyMs = Math.round(performance.now() - started);
    return {
      ok: true,
      message: reply.slice(0, 80),
      modelId,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      message: formatOpenRouterError(err),
      modelId: modelId || '—',
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

/** @deprecated name — use generateCloudText */
export const generateOpenRouterText = generateCloudText;
