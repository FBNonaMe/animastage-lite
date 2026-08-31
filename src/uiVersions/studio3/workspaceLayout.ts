/**
 * UI 3.0 workspace layout persistence (panel sizes / visibility).
 * Independent from .animastage project files.
 */
export type Studio3PanelId =
  | 'scene'
  | 'world'
  | 'assets'
  | 'inspector'
  | 'timeline'
  | 'photo'
  | 'envbuild'
  | 'ashfall'
  | 'renderpipe'
  | 'animlib'
  | 'camera'
  | 'lighting'
  | 'cinematic'
  | 'material'
  | 'physics'
  | 'fx'
  | 'ai'
  | 'smart'
  | 'performance'
  | 'shots'
  | 'director'
  | 'workflow';

export interface Studio3WorkspaceLayout {
  version: 1;
  name: string;
  leftWidth: number;
  rightWidth: number;
  bottomHeight: number;
  leftPanel: Studio3PanelId;
  rightPanel: Studio3PanelId;
  showLeft: boolean;
  showRight: boolean;
  showBottom: boolean;
  showPerf: boolean;
}

export const DEFAULT_STUDIO3_LAYOUT: Studio3WorkspaceLayout = {
  version: 1,
  name: 'Default',
  leftWidth: 260,
  rightWidth: 280,
  bottomHeight: 168,
  leftPanel: 'scene',
  rightPanel: 'inspector',
  showLeft: true,
  showRight: true,
  showBottom: true,
  showPerf: false,
};

const LAYOUT_KEY = 'as_ui3_workspace_layout';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Keep docks from eating the viewport (also migrates older oversized saves). */
export function normalizeStudio3Layout(
  layout: Partial<Studio3WorkspaceLayout> | null | undefined
): Studio3WorkspaceLayout {
  const merged: Studio3WorkspaceLayout = {
    ...DEFAULT_STUDIO3_LAYOUT,
    ...layout,
    version: 1,
  };
  return {
    ...merged,
    name: String(merged.name || 'Default').slice(0, 64),
    leftWidth: clamp(Number(merged.leftWidth) || DEFAULT_STUDIO3_LAYOUT.leftWidth, 200, 360),
    rightWidth: clamp(Number(merged.rightWidth) || DEFAULT_STUDIO3_LAYOUT.rightWidth, 220, 380),
    bottomHeight: clamp(Number(merged.bottomHeight) || DEFAULT_STUDIO3_LAYOUT.bottomHeight, 140, 260),
  };
}

export function loadStudio3Layout(): Studio3WorkspaceLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_STUDIO3_LAYOUT };
    const parsed = JSON.parse(raw) as Partial<Studio3WorkspaceLayout>;
    return normalizeStudio3Layout(parsed);
  } catch {
    return { ...DEFAULT_STUDIO3_LAYOUT };
  }
}

export function saveStudio3Layout(layout: Studio3WorkspaceLayout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(normalizeStudio3Layout(layout)));
  } catch {
    /* ignore */
  }
}

export function exportStudio3LayoutJson(layout: Studio3WorkspaceLayout): string {
  return JSON.stringify(normalizeStudio3Layout(layout), null, 2);
}

export function importStudio3LayoutJson(json: string): Studio3WorkspaceLayout {
  const parsed = JSON.parse(json) as Partial<Studio3WorkspaceLayout>;
  return normalizeStudio3Layout({
    ...parsed,
    name: String(parsed.name ?? 'Imported').slice(0, 64),
  });
}
