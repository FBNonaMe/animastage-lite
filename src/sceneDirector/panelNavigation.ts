import type { Studio3PanelId } from '../uiVersions/studio3/workspaceLayout';

export const STUDIO_PANEL_EVENT = 'animastage:studio-panel';
export const STUDIO_EDITOR_TAB_EVENT = 'animastage:editor-tab';

export type StudioEditorTab = 'timeline' | 'effects' | 'dopesheet' | 'curves';

export function requestStudioPanel(id: Studio3PanelId): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STUDIO_PANEL_EVENT, { detail: { id } }));
}

export function requestEditorTab(tab: StudioEditorTab): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STUDIO_EDITOR_TAB_EVENT, { detail: { tab } }));
}
