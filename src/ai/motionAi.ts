/**
 * AI-assisted keyframes via OpenRouter (optional API key).
 * Text→motion uses MotionSpec pipeline (see generateMotionSpec.ts).
 */
import type { TimelineKeyframe, TimelineTrackId } from '../types';
import { TIMELINE_TRACK_IDS } from '../components/TimelineLogic';
import { generateTimelineFromMotionPrompt } from './generateMotionSpec';
import { hasOpenRouterApiKey } from './openrouter';
import {
  formatGeminiError,
  generateGeminiText,
} from './geminiClient';

export type MotionRefineStyle = 'smoother' | 'energetic';

const MORPH_TRACKS = new Set<TimelineTrackId>([
  'morph_eyes',
  'morph_mouth',
  'morph_brow',
]);

function createKeyframeId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function hasMotionAi(): boolean {
  return hasOpenRouterApiKey();
}

function clampTrackValue(track: TimelineTrackId, value: number): number {
  if (MORPH_TRACKS.has(track)) return Math.min(1, Math.max(0, value));
  return Math.min(120, Math.max(-120, value));
}

function sortKeyframes(keys: TimelineKeyframe[]): TimelineKeyframe[] {
  return keys.sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track));
}

function refineTrackLocally(
  keys: TimelineKeyframe[],
  style: MotionRefineStyle
): TimelineKeyframe[] {
  const sorted = [...keys].sort((a, b) => a.frame - b.frame);

  return sorted.map((key, index) => {
    const prev = sorted[index - 1];
    const next = sorted[index + 1];
    let value = key.value;

    if (style === 'smoother') {
      if (prev && next) {
        value = prev.value * 0.22 + key.value * 0.56 + next.value * 0.22;
      }
      if (!MORPH_TRACKS.has(key.track)) value *= 0.94;
    } else {
      const scale = MORPH_TRACKS.has(key.track) ? 1.08 : 1.32;
      value *= scale;

      if (prev && next && !MORPH_TRACKS.has(key.track)) {
        value += (next.value - prev.value) * 0.1;
      }
    }

    return {
      ...key,
      id: createKeyframeId(),
      value: clampTrackValue(key.track, value),
      interpolation: 'bezier' as const,
      easeIn: style === 'smoother' ? 0.58 : 0.22,
      easeOut: style === 'smoother' ? 0.58 : 0.2,
    };
  });
}

/** Deterministic refine presets. They work offline and preserve frames/tracks. */
export function refineKeyframesLocal(
  source: TimelineKeyframe[],
  style: MotionRefineStyle
): TimelineKeyframe[] {
  const byTrack = new Map<TimelineTrackId, TimelineKeyframe[]>();
  for (const key of source) {
    const trackKeys = byTrack.get(key.track) ?? [];
    trackKeys.push(key);
    byTrack.set(key.track, trackKeys);
  }

  return sortKeyframes(
    Array.from(byTrack.values()).flatMap((keys) => refineTrackLocally(keys, style))
  );
}

function detectRefineStyle(prompt: string): MotionRefineStyle | null {
  const normalized = prompt.trim().toLowerCase();
  if (
    /мяг|плав|спокой|smooth|soft|gentle|fluid|less jitter|natural/.test(normalized)
  ) {
    return 'smoother';
  }
  if (
    /энерг|динами|сильн|резк|быстр|energetic|dynamic|power|strong|punch|intense/.test(
      normalized
    )
  ) {
    return 'energetic';
  }
  return null;
}

function parseAiKeyframes(
  text: string,
  maxFrames: number
): TimelineKeyframe[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as Array<{
    frame: number;
    track: TimelineTrackId;
    value: number;
  }>;

  return sortKeyframes(
    parsed
      .filter(
        (key) =>
          TIMELINE_TRACK_IDS.includes(key.track) &&
          Number.isFinite(key.frame) &&
          Number.isFinite(key.value) &&
          key.frame >= 0 &&
          key.frame <= maxFrames
      )
      .map((key) => ({
        id: createKeyframeId(),
        frame: Math.round(key.frame),
        track: key.track,
        value: clampTrackValue(key.track, Number(key.value)),
        interpolation: 'bezier' as const,
        easeIn: 0.4,
        easeOut: 0.4,
      }))
  );
}

/**
 * Refine existing motion from natural language. Known smooth/energetic requests
 * use the offline presets; custom instructions use OpenRouter when configured.
 */
export async function refineMotionFromPrompt(
  source: TimelineKeyframe[],
  prompt: string,
  maxFrames: number
): Promise<{ keyframes: TimelineKeyframe[]; source: 'local' | 'ai' }> {
  if (source.length === 0) throw new Error('Add or import motion keys first');

  const preset = detectRefineStyle(prompt);
  if (preset) {
    return { keyframes: refineKeyframesLocal(source, preset), source: 'local' };
  }

  if (!hasMotionAi()) {
    throw new Error('Use Smoother/Energetic, or add an OpenRouter API key in AI Settings');
  }

  const compact = source.slice(0, 500).map(({ frame, track, value }) => ({
    frame,
    track,
    value: Number(value.toFixed(3)),
  }));
  try {
    const text = await generateGeminiText(`${SYSTEM}

Refine the EXISTING motion according to: "${prompt}".
Keep the same duration (0-${maxFrames}) and same general choreography.
Return a complete replacement keyframe array, not a patch.
Preserve important poses; improve timing, easing and motion quality.
Existing keys: ${JSON.stringify(compact)}`);
    const refined = parseAiKeyframes(text, maxFrames);
    if (refined.length === 0) throw new Error('AI returned no valid motion keys');
    return { keyframes: refined, source: 'ai' };
  } catch (err) {
    throw new Error(formatGeminiError(err));
  }
}

const SYSTEM = `You output ONLY valid JSON arrays for MMD-style timeline keyframes.
Each item: { "frame": number, "track": one of [${TIMELINE_TRACK_IDS.join(', ')}], "value": number }
Morph tracks: 0-1. Bone tracks: degrees roughly -90 to 90.
No markdown, no explanation.`;

/**
 * Text → MotionSpec (humanoid) → timeline keys.
 * With API key: Gemini + optional self-review.
 * Without: offline presets (wave / bow / nod / dance).
 */
export async function generateKeyframesFromPrompt(
  prompt: string,
  maxFrames: number,
  options?: { refine?: boolean; onProgress?: (msg: string) => void }
): Promise<TimelineKeyframe[]> {
  const result = await generateTimelineFromMotionPrompt(prompt, maxFrames, {
    refine: options?.refine,
    onProgress: options?.onProgress,
  });
  return result.keyframes;
}

export { generateTimelineFromMotionPrompt } from './generateMotionSpec';
export { testGeminiConnection, DEFAULT_GEMINI_MODEL } from './geminiClient';

export async function infillKeyframes(
  existing: TimelineKeyframe[],
  startFrame: number,
  endFrame: number,
  hint: string
): Promise<TimelineKeyframe[]> {
  if (!hasMotionAi()) throw new Error('Add an OpenRouter API key in AI Settings');

  const context = existing
    .filter((k) => k.frame >= startFrame - 5 && k.frame <= endFrame + 5)
    .slice(0, 40);

  try {
    const text = await generateGeminiText(
      `${SYSTEM}\n\nExisting keys: ${JSON.stringify(context)}\nFill frames ${startFrame}-${endFrame}. ${hint}`
    );
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as Array<{
      frame: number;
      track: TimelineTrackId;
      value: number;
    }>;

    return parsed.map((k) => ({
      id: createKeyframeId(),
      frame: Math.round(k.frame),
      track: k.track,
      value: Number(k.value),
      interpolation: 'bezier' as const,
    }));
  } catch (err) {
    throw new Error(formatGeminiError(err));
  }
}

/** Retarget: scale arm/head motion from source keys to target intensity. */
export function retargetKeyframes(
  source: TimelineKeyframe[],
  intensity = 1
): TimelineKeyframe[] {
  return source.map((k) => ({
    ...k,
    id: createKeyframeId(),
    value: k.value * intensity,
  }));
}
