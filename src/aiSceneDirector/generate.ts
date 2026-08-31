/**
 * Generate a Scene Plan via OpenRouter or NVIDIA NIM, validated against the Asset Registry.
 * Falls back to offline keyword planning when no API key is present.
 */
import {
  generateCloudText,
  formatOpenRouterError,
  hasOpenRouterApiKey,
} from '../ai/openrouter';
import {
  generateNvidiaText,
  formatNvidiaError,
  hasNvidiaApiKey,
  loadAiDirectorCloudProvider,
  type AiDirectorCloudProvider,
} from '../ai/nvidia';
import type { AiDirectorRegistry } from './registry';
import { registryCatalogText } from './registry';
import { buildLocalScenePlan } from './localPlan';
import { validateScenePlan } from './validate';
import type { AiDirectorMode, AiScenePlanValidation } from './types';

export const SCENE_DIRECTOR_SYSTEM_PROMPT = `You are the AnimaStage Lite Scene Director.
You create structured cinematic SCENE PLANS for an existing 3D/MMD engine.
You are NOT a video generator and you must NEVER invent asset filenames or ids.

Rules:
- Only use asset ids from the provided Asset Registry.
- Prefer the currently selected character when the user does not name one.
- Prefer mood/scene presets as a base, then adjust weather/lighting/shot.
- Placement and camera transforms are intents only (center, street_center, full_body…).
- The engine will raycast, scale, frame and render — do not invent X/Y/Z numbers.
- Output ONLY a JSON object matching the schema. No markdown.

JSON schema:
{
  "version": 1,
  "summary": "short description",
  "environmentId": "registry id or null",
  "characterId": "registry id or null",
  "moodPresetId": "clear_day|sunset|golden_hour|night|moonlight|rain|heavy_rain|storm|snow|fog|heavy_fog|cyberpunk|neon_night|fantasy|apocalypse|cinematic|anime|mmd|null",
  "timeHours": 0-24 or null,
  "weather": "clear|cloudy|rain|storm|snow|fog|wind|null",
  "fog": "none|light|medium|heavy|null",
  "lightingPresetId": "anime_soft|studio|golden_hour|sunset|moonlight|night|cyberpunk|fantasy|warm_cinema|cold_cinema|high_contrast|soft_portrait|null",
  "shotPreset": "full_body|medium|close_up|portrait|hero|wide|low_angle|high_angle|side|back|showcase|dance|anime_intro|shorts|null",
  "aspectRatio": "9:16|16:9|1:1|4:5|21:9|null",
  "cameraMovement": "static|slow_orbit|orbit|push_in|pull_out|pan|none",
  "placement": "center|left|right|foreground|background|near_camera|far_camera|street_center|keep",
  "physicsPresetId": "safe|default|anime|realistic|cinematic|windy|heavy|light|null",
  "fxIds": ["weather.rain", "..."],
  "colorGrade": "string or null",
  "materialStyle": "anime|cyberpunk|cinematic|realistic|classic_mmd|null",
  "animationAssetId": "registry animation id or null",
  "notes": ["..."],
  "warnings": []
}`;

const SCENE_PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    version: { type: 'number' },
    summary: { type: 'string' },
    environmentId: {},
    characterId: {},
    moodPresetId: {},
    timeHours: {},
    weather: {},
    fog: {},
    lightingPresetId: {},
    shotPreset: {},
    aspectRatio: {},
    cameraMovement: { type: 'string' },
    placement: { type: 'string' },
    physicsPresetId: {},
    fxIds: { type: 'array' },
    colorGrade: {},
    materialStyle: {},
    animationAssetId: {},
    notes: { type: 'array' },
    warnings: { type: 'array' },
  },
  required: ['version', 'summary'],
};

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Scene Director returned non-JSON output');
  }
}

export function resolveSceneDirectorProvider(
  preferred?: AiDirectorCloudProvider
): AiDirectorCloudProvider | 'local' {
  const want = preferred ?? loadAiDirectorCloudProvider();
  if (want === 'nvidia' && hasNvidiaApiKey()) return 'nvidia';
  if (want === 'openrouter' && hasOpenRouterApiKey()) return 'openrouter';
  if (hasNvidiaApiKey()) return 'nvidia';
  if (hasOpenRouterApiKey()) return 'openrouter';
  return 'local';
}

export interface GenerateScenePlanOptions {
  mode?: AiDirectorMode;
  onProgress?: (message: string) => void;
  /** Prefer offline heuristics even if a key exists. */
  forceLocal?: boolean;
  /** Preferred cloud provider (NVIDIA or OpenRouter). */
  provider?: AiDirectorCloudProvider;
}

export async function generateScenePlan(
  prompt: string,
  registry: AiDirectorRegistry,
  options: GenerateScenePlanOptions = {}
): Promise<AiScenePlanValidation & { source: 'ai' | 'local'; provider: AiDirectorCloudProvider | 'local' }> {
  const cleaned = prompt.trim();
  if (!cleaned) {
    throw new Error('Describe the scene first.');
  }

  const provider = options.forceLocal
    ? 'local'
    : resolveSceneDirectorProvider(options.provider);

  if (provider === 'local') {
    options.onProgress?.(
      hasNvidiaApiKey() || hasOpenRouterApiKey()
        ? 'Building local scene plan…'
        : 'No API key — building offline plan…'
    );
    const local = buildLocalScenePlan(cleaned, registry);
    return { ...local, source: 'local', provider: 'local' };
  }

  options.onProgress?.(
    provider === 'nvidia'
      ? 'AI Scene Director · NVIDIA…'
      : 'AI Scene Director · analyzing assets…'
  );
  const catalog = registryCatalogText(registry);
  const userPrompt =
    `User scene request:\n${cleaned}\n\n` +
    `Selected character id: ${registry.selectedCharacterId ?? 'none'}\n` +
    `Has environment: ${registry.hasEnvironment ? 'yes' : 'no'}\n\n` +
    `Asset Registry (ONLY use these ids):\n${catalog}`;

  const commonOpts = {
    onProgress: options.onProgress,
    systemInstruction: SCENE_DIRECTOR_SYSTEM_PROMPT,
    responseJsonSchema: SCENE_PLAN_JSON_SCHEMA,
    temperature: options.mode === 'pro' ? 0.35 : 0.55,
    maxTokens: 1200,
  };

  try {
    const text =
      provider === 'nvidia'
        ? await generateNvidiaText(userPrompt, commonOpts)
        : await generateCloudText(userPrompt, commonOpts);
    const raw = extractJsonObject(text);
    const validated = validateScenePlan(raw, registry);
    if (!validated.plan.notes.length) {
      validated.plan.notes = [
        provider === 'nvidia'
          ? 'Generated with NVIDIA Scene Director'
          : 'Generated with OpenRouter Scene Director',
      ];
    }
    return { ...validated, source: 'ai', provider };
  } catch (err) {
    const errLabel =
      provider === 'nvidia' ? formatNvidiaError(err) : formatOpenRouterError(err);
    options.onProgress?.(`AI failed (${errLabel}) — using local plan`);
    const local = buildLocalScenePlan(cleaned, registry);
    local.plan.warnings = [
      ...local.plan.warnings,
      `${provider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'} fallback: ${errLabel}`,
    ];
    return { ...local, source: 'local', provider: 'local' };
  }
}
