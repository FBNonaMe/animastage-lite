/**
 * First-run interface selection + migration preference storage.
 */
import {
  DEFAULT_EDITOR_INTERFACE,
  isEditorInterfaceId,
  type EditorInterfaceId,
} from './types';

const EDITOR_INTERFACE_KEY = 'as_editor_interface';
const INTERFACE_CHOSEN_KEY = 'as_editor_interface_chosen';
const MIGRATION_TIPS_KEY = 'as_ui3_migration_tips_dismissed';
const UI_TOUR_KEY = 'as_ui3_tour_seen';

export function loadEditorInterface(): EditorInterfaceId {
  try {
    const v = localStorage.getItem(EDITOR_INTERFACE_KEY);
    if (isEditorInterfaceId(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_EDITOR_INTERFACE;
}

export function saveEditorInterface(id: EditorInterfaceId): void {
  try {
    localStorage.setItem(EDITOR_INTERFACE_KEY, id);
    localStorage.setItem(INTERFACE_CHOSEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** True once the user has explicitly picked UI 1.0 or 3.0 (or migrated). */
export function hasChosenEditorInterface(): boolean {
  try {
    return localStorage.getItem(INTERFACE_CHOSEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markEditorInterfaceChosen(): void {
  try {
    localStorage.setItem(INTERFACE_CHOSEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function areMigrationTipsDismissed(): boolean {
  try {
    return localStorage.getItem(MIGRATION_TIPS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissMigrationTips(): void {
  try {
    localStorage.setItem(MIGRATION_TIPS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSeenUi3Tour(): boolean {
  try {
    return localStorage.getItem(UI_TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

export function markUi3TourSeen(): void {
  try {
    localStorage.setItem(UI_TOUR_KEY, '1');
  } catch {
    /* ignore */
  }
}
