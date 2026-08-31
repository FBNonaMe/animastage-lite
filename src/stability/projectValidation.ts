/**
 * Lightweight project validation before save / export.
 * Reports missing textures, empty motion, and physics risk — no UI surface beyond callers.
 */
import type { AppState, MMDModel } from '../types';

export type ProjectValidationLevel = 'info' | 'warn' | 'error';

export interface ProjectValidationIssue {
  level: ProjectValidationLevel;
  code: string;
  message: string;
  modelId?: string;
}

export function validateProject(appState: AppState): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];

  if (appState.models.length === 0) {
    issues.push({
      level: 'warn',
      code: 'no_models',
      message: 'Scene has no characters or stages.',
    });
  }

  for (const m of appState.models) {
    issues.push(...validateModel(m));
  }

  if (appState.maxFrames < 2) {
    issues.push({
      level: 'warn',
      code: 'short_timeline',
      message: 'Timeline is shorter than 2 frames.',
    });
  }

  return issues;
}

function validateModel(m: MMDModel): ProjectValidationIssue[] {
  const out: ProjectValidationIssue[] = [];
  if (!m.blobUrl) {
    out.push({
      level: 'error',
      code: 'missing_mesh',
      message: `"${m.name}" has no mesh URL.`,
      modelId: m.id,
    });
  }
  if (m.hasVmdAnimation && !(m.vmdBlobUrls?.length)) {
    out.push({
      level: 'warn',
      code: 'broken_vmd',
      message: `"${m.name}" is marked as having VMD but no motion URLs are attached.`,
      modelId: m.id,
    });
  }
  if ((m.keyframes?.length ?? 0) === 0 && !m.hasVmdAnimation) {
    out.push({
      level: 'info',
      code: 'no_motion',
      message: `"${m.name}" has no keyframes or VMD.`,
      modelId: m.id,
    });
  }
  return out;
}

/** Background autosave with version ring (crash recovery). */
const AUTOSAVE_KEY = 'as_autosave_v1';
const HISTORY_KEY = 'as_autosave_history_v1';
const HISTORY_MAX = 5;

export function autosaveProjectJson(json: string): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, json);
    const raw = localStorage.getItem(HISTORY_KEY);
    const hist: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    hist.unshift(json);
    while (hist.length > HISTORY_MAX) hist.pop();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch {
    /* quota / private mode */
  }
}

export function loadAutosaveJson(): string | null {
  try {
    return localStorage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
}

export function listAutosaveHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
