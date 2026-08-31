/**
 * Cloud LLM client — OpenRouter only.
 * Kept filename for import stability; Gemini SDK removed.
 */
export {
  generateCloudText as generateGeminiText,
  generateCloudText,
  testOpenRouterConnection,
  formatOpenRouterError as formatGeminiError,
  isRateLimitError,
  type GenerateCloudTextOptions as GenerateGeminiOptions,
} from './openrouter';

import { testOpenRouterConnection, loadOpenRouterSettings } from './openrouter';

/** @deprecated — OpenRouter model id from settings */
export const DEFAULT_GEMINI_MODEL = 'openrouter';

export const GEMINI_MODEL_CANDIDATES = [] as const;

/** Always null — OpenRouter uses fetch, not GoogleGenAI. */
export function createGeminiClient(): null {
  return null;
}

export async function testGeminiConnection(
  onProgress?: (message: string) => void
): Promise<string> {
  const result = await testOpenRouterConnection(onProgress);
  if (!result.ok) throw new Error(result.message);
  return `ok · ${result.modelId} · ${result.latencyMs}ms`;
}

export function getActiveCloudModelId(): string {
  return loadOpenRouterSettings().modelId || '(auto)';
}
