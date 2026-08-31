/**
 * OpenRouter model catalog — discovery, capabilities, badges.
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  free: boolean;
  /** Prompt price per token as string from API (often "0") */
  promptPrice: string;
  completionPrice: string;
  description?: string;
  capabilities: {
    chat: boolean;
    reasoning: boolean;
    vision: boolean;
    longContext: boolean;
    functionCalling: boolean;
    jsonOutput: boolean;
  };
  badges: Array<'fast' | 'reasoning' | 'vision' | 'chat' | 'recommended' | 'free'>;
}

type RawModel = {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  top_provider?: { context_length?: number };
  supported_parameters?: string[];
};

const RECOMMENDED_IDS = [
  'deepseek/deepseek-r1:free',
  'deepseek/deepseek-chat-v3-0324:free',
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-4b:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
];

const FAST_HINT = /flash|mini|small|lite|instant|haiku|turbo|fast/i;
const REASON_HINT = /reason|r1|o1|o3|think|deepseek-r/i;
const VISION_HINT = /vision|vl|gpt-4o|gemini-.*flash|claude-3|pixtral|qwen2\.5-vl/i;

function providerFromId(id: string): string {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(0, slash) : 'openrouter';
}

function isFreePricing(prompt?: string, completion?: string, id?: string): boolean {
  if (id?.includes(':free')) return true;
  const p = Number(prompt ?? '1');
  const c = Number(completion ?? '1');
  return (Number.isFinite(p) && p === 0) && (Number.isFinite(c) && c === 0);
}

export function normalizeOpenRouterModel(raw: RawModel): OpenRouterModel | null {
  const id = String(raw.id ?? '').trim();
  if (!id) return null;
  const name = String(raw.name ?? id).trim();
  const contextLength = Math.max(
    0,
    Number(raw.context_length ?? raw.top_provider?.context_length ?? 0) || 0
  );
  const promptPrice = String(raw.pricing?.prompt ?? '0');
  const completionPrice = String(raw.pricing?.completion ?? '0');
  const free = isFreePricing(promptPrice, completionPrice, id);

  const mods = raw.architecture?.input_modalities ?? [];
  const modality = String(raw.architecture?.modality ?? '');
  const vision =
    mods.includes('image') ||
    /image|vision/i.test(modality) ||
    VISION_HINT.test(id) ||
    VISION_HINT.test(name);

  const params = raw.supported_parameters ?? [];
  const jsonOutput =
    params.includes('response_format') ||
    params.includes('structured_outputs') ||
    true; // most chat models can follow JSON instructions
  const functionCalling =
    params.includes('tools') || params.includes('tool_choice') || params.includes('functions');

  const reasoning = REASON_HINT.test(id) || REASON_HINT.test(name);
  const fast = FAST_HINT.test(id) || FAST_HINT.test(name);
  const longContext = contextLength >= 100_000;
  const recommended = RECOMMENDED_IDS.includes(id);

  const badges: OpenRouterModel['badges'] = ['chat'];
  if (free) badges.unshift('free');
  if (recommended) badges.push('recommended');
  if (fast) badges.push('fast');
  if (reasoning) badges.push('reasoning');
  if (vision) badges.push('vision');

  return {
    id,
    name,
    provider: providerFromId(id),
    contextLength,
    free,
    promptPrice,
    completionPrice,
    description: raw.description,
    capabilities: {
      chat: true,
      reasoning,
      vision,
      longContext,
      functionCalling,
      jsonOutput,
    },
    badges,
  };
}

export function sortModels(models: OpenRouterModel[]): OpenRouterModel[] {
  return [...models].sort((a, b) => {
    const score = (m: OpenRouterModel) =>
      (m.badges.includes('recommended') ? 8 : 0) +
      (m.free ? 4 : 0) +
      (m.badges.includes('fast') ? 1 : 0);
    const d = score(b) - score(a);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
}

export function filterModels(
  models: OpenRouterModel[],
  opts: { freeOnly?: boolean; query?: string; capability?: keyof OpenRouterModel['capabilities'] }
): OpenRouterModel[] {
  const q = opts.query?.trim().toLowerCase() ?? '';
  return models.filter((m) => {
    if (opts.freeOnly && !m.free) return false;
    if (opts.capability && !m.capabilities[opts.capability]) return false;
    if (!q) return true;
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
    );
  });
}

export const BADGE_LABEL: Record<OpenRouterModel['badges'][number], string> = {
  free: 'Free',
  recommended: 'Recommended',
  fast: 'Fast',
  reasoning: 'Reasoning',
  vision: 'Vision',
  chat: 'Chat',
};
