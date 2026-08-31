/**
 * NVIDIA Integrate / NIM chat client (OpenAI-compatible).
 * Docs: https://docs.api.nvidia.com/nim/
 */
import {
  loadNvidiaSettings,
  resolveNvidiaApiKey,
  saveNvidiaSettings,
} from './settings';

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

function extractApiErrorMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  try {
    const json = JSON.parse(text) as {
      error?: { message?: string; code?: string | number };
      message?: string;
      detail?: string;
    };
    const nested = json.error?.message || json.message || json.detail;
    if (nested) return String(nested);
  } catch {
    /* plain text */
  }
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

export function formatNvidiaError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const rawMsg = String((err as { message?: string })?.message ?? err ?? '');
  const detail = extractApiErrorMessage(rawMsg);

  if (status === 401 || status === 403) {
    return detail && !/^invalid/i.test(detail)
      ? detail
      : 'Invalid NVIDIA API key. Get one at build.nvidia.com and paste it in AI Scene Director.';
  }
  if (status === 429) {
    return 'NVIDIA rate limit / quota. Wait a bit or pick another model.';
  }
  if (status === 404) {
    return 'NVIDIA model unavailable. Pick another model in AI Scene Director.';
  }
  if (detail) return detail.length > 200 ? `${detail.slice(0, 197)}…` : detail;
  return 'NVIDIA request failed';
}

export interface GenerateNvidiaTextOptions {
  onProgress?: (message: string) => void;
  systemInstruction?: string;
  /** Hint JSON-only reply (prompt padding); NVIDIA may ignore response_format. */
  responseJsonSchema?: Record<string, unknown>;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}

async function nvidiaFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const key = resolveNvidiaApiKey();
  if (!key) {
    throw Object.assign(new Error('Add a NVIDIA API key in AI Scene Director'), {
      status: 401,
    });
  }

  const { timeoutMs: timeoutOpt, ...fetchInit } = init;
  const timeoutMs = timeoutOpt ?? loadNvidiaSettings().timeoutMs;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${NVIDIA_BASE}${path}`, {
      ...fetchInit,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(fetchInit.headers ?? {}),
      },
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw Object.assign(new Error('NVIDIA request timed out'), { status: 408 });
    }
    throw Object.assign(new Error('Network error reaching NVIDIA'), {
      status: 0,
      cause: err,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Chat completion via NVIDIA Integrate API.
 */
export async function generateNvidiaText(
  prompt: string,
  options: GenerateNvidiaTextOptions = {}
): Promise<string> {
  const settings = loadNvidiaSettings();
  const model = options.modelId || settings.modelId || 'meta/llama-3.3-70b-instruct';
  const temperature = options.temperature ?? settings.temperature;
  const maxTokens = options.maxTokens ?? settings.maxTokens;

  options.onProgress?.(`NVIDIA · ${model}`);

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  const userContent = options.responseJsonSchema
    ? `${prompt}\n\nRespond with valid JSON only matching the required schema. No markdown.`
    : prompt;
  messages.push({ role: 'user', content: userContent });

  const bodyBase: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false,
  };

  const tryOnce = async (withJsonFormat: boolean): Promise<string> => {
    const body = { ...bodyBase };
    if (withJsonFormat && options.responseJsonSchema) {
      body.response_format = { type: 'json_object' };
    }

    const res = await nvidiaFetch('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
      timeoutMs: settings.timeoutMs,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw Object.assign(
        new Error(extractApiErrorMessage(errBody) || `NVIDIA HTTP ${res.status}`),
        { status: res.status }
      );
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
    if (!text) throw new Error('NVIDIA returned an empty response');
    return text;
  };

  try {
    const text = await tryOnce(Boolean(options.responseJsonSchema));
    if (!settings.modelId || settings.modelId !== model) {
      saveNvidiaSettings({ modelId: model });
    }
    return text;
  } catch (err) {
    const status = (err as { status?: number })?.status;
    // Some NIM models reject response_format — retry without it.
    if (options.responseJsonSchema && (status === 400 || status === 422)) {
      options.onProgress?.(`NVIDIA · ${model} (plain JSON)`);
      const text = await tryOnce(false);
      saveNvidiaSettings({ modelId: model });
      return text;
    }
    throw err instanceof Error ? err : new Error(formatNvidiaError(err));
  }
}
