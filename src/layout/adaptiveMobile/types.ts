/** CapCut-style adaptive mobile workspace — shared by UI 1.0 & UI 3.0 */

export type MobileSnapLevel = 0 | 1 | 2 | 3;

export const MOBILE_SNAP_VH: Record<MobileSnapLevel, number> = {
  0: 0,
  1: 28,
  2: 52,
  3: 85,
};

/**
 * Full feature catalog — zero feature loss vs desktop Studio3 panels.
 * Layout changes by device; capabilities do not.
 */
export type MobileWorkspaceTool =
  | 'assets'
  | 'photo'
  | 'envbuild'
  | 'ashfall'
  | 'scene'
  | 'animation'
  | 'camera'
  | 'lighting'
  | 'materials'
  | 'physics'
  | 'fx'
  | 'timeline'
  | 'ai'
  | 'mocap'
  | 'smart'
  | 'director'
  | 'cinematic'
  | 'performance'
  | 'inspector'
  | 'render'
  | 'more';

export type MobileToolGroup =
  | 'create'
  | 'edit'
  | 'look'
  | 'new'
  | 'export'
  | 'system';

export const MOBILE_WORKSPACE_TOOLS: {
  id: MobileWorkspaceTool;
  label: string;
  group: MobileToolGroup;
  /** Highlight in More as a recent / 1.4+ feature */
  isNew?: boolean;
}[] = [
  { id: 'assets', label: 'Assets', group: 'create' },
  { id: 'scene', label: 'Scene', group: 'create' },
  { id: 'photo', label: 'Photo Studio', group: 'new', isNew: true },
  { id: 'envbuild', label: 'Environ+', group: 'new', isNew: true },
  { id: 'ashfall', label: 'Ashfall City', group: 'new', isNew: true },
  { id: 'lighting', label: 'Dynamic Sky', group: 'new', isNew: true },
  { id: 'animation', label: 'Anim Library', group: 'edit' },
  { id: 'timeline', label: 'Timeline', group: 'edit' },
  { id: 'camera', label: 'Camera', group: 'edit' },
  { id: 'inspector', label: 'Inspect', group: 'edit' },
  { id: 'materials', label: 'Material', group: 'look' },
  { id: 'physics', label: 'Physics', group: 'look' },
  { id: 'fx', label: 'Effects', group: 'look' },
  { id: 'cinematic', label: 'Cinematic', group: 'new', isNew: true },
  { id: 'ai', label: 'AI / OpenRouter', group: 'new', isNew: true },
  { id: 'mocap', label: 'WHAM Mocap', group: 'new', isNew: true },
  { id: 'smart', label: 'Smart Studio', group: 'new', isNew: true },
  { id: 'director', label: 'AI Scene Director', group: 'new', isNew: true },
  { id: 'performance', label: 'Perf', group: 'system' },
  { id: 'render', label: 'RP4 Export', group: 'export' },
  { id: 'more', label: 'More', group: 'system' },
];

/**
 * Bottom dock — keep short so thumbs hit essentials.
 * All advanced / 1.4+ features live under More.
 */
export const MOBILE_PRIMARY_RAIL: MobileWorkspaceTool[] = [
  'assets',
  'timeline',
  'camera',
  'fx',
  'more',
];

/**
 * More sheet catalog — every tool except the More button itself.
 * New features are grouped under "New in 1.4".
 */
export const MOBILE_MORE_CATALOG: MobileWorkspaceTool[] = MOBILE_WORKSPACE_TOOLS.filter(
  (t) => t.id !== 'more'
).map((t) => t.id);

/** Tools that should prefer opening from More (not on primary rail). */
export const MOBILE_MORE_PREFERRED: MobileWorkspaceTool[] = MOBILE_WORKSPACE_TOOLS.filter(
  (t) => t.isNew || t.group === 'new'
).map((t) => t.id);

export type MobileSelectionKind =
  | 'none'
  | 'character'
  | 'bone'
  | 'material'
  | 'camera'
  | 'light'
  | 'stage';

export type MobileTransformMode = 'translate' | 'rotate';

export interface MobileSelectionContext {
  kind: MobileSelectionKind;
  label: string;
  modelId?: string | null;
  boneId?: string | null;
  materialName?: string | null;
}

export type MobileToolboxActionId =
  | 'move'
  | 'rotate'
  | 'camera'
  | 'undo'
  | 'redo'
  | 'play'
  | 'pause'
  | 'render'
  | 'assets';
