/** Persist recent AI Scene Director plans locally (no server). */
import type { AiDirectorHistoryEntry, AiDirectorMode, AiScenePlan } from './types';

const KEY = 'as_ai_scene_director_history_v1';
const MAX = 20;

export function loadAiDirectorHistory(): AiDirectorHistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiDirectorHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function pushAiDirectorHistory(
  prompt: string,
  plan: AiScenePlan,
  mode: AiDirectorMode
): AiDirectorHistoryEntry[] {
  const entry: AiDirectorHistoryEntry = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ai_scene_${Date.now()}`,
    createdAt: Date.now(),
    prompt,
    plan,
    mode,
  };
  const next = [entry, ...loadAiDirectorHistory()].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}
