import type { AnimaStageScene } from './types';
import { parseSceneJson } from './codec';
import {
  autosaveProjectJson,
  loadAutosaveJson,
  validateProject,
} from '../../stability/projectValidation';
import type { AppState } from '../../types';

const STORAGE_KEY = 'as_saved_project_v2';

export function saveSceneToStorage(scene: AnimaStageScene): void {
  try {
    const json = JSON.stringify(scene);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem('as_saved_project', json);
    autosaveProjectJson(json);
  } catch {
    /* ignore */
  }
}

/** Soft validation before persist — logs issues; never blocks save. */
export function validateAndSaveScene(
  scene: AnimaStageScene,
  appState?: Pick<AppState, 'models' | 'maxFrames'>
): void {
  if (appState) {
    const issues = validateProject(appState as AppState);
    const hard = issues.filter((i) => i.level === 'error');
    if (hard.length && typeof console !== 'undefined') {
      console.warn('[projectValidation]', hard.map((i) => i.message).join('; '));
    }
  }
  saveSceneToStorage(scene);
}

export function loadSceneFromStorage(): AnimaStageScene | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      localStorage.getItem('as_saved_project') ??
      loadAutosaveJson();
    if (!raw) return null;
    return parseSceneJson(raw);
  } catch {
    return null;
  }
}

export function hasStoredScene(): boolean {
  return loadSceneFromStorage() !== null;
}
