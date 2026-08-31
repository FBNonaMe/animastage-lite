import type { Studio3PanelId } from '../../uiVersions/studio3/workspaceLayout';
import type { MobileWorkspaceTool } from './types';
import { MOBILE_WORKSPACE_TOOLS } from './types';

/** Map CapCut rail / More tool → real Studio 3.0 panel (or timeline host). */
export function workspaceToStudioPanel(
  tool: MobileWorkspaceTool
): Studio3PanelId | 'timeline' | null {
  switch (tool) {
    case 'photo':
      return 'photo';
    case 'envbuild':
      return 'envbuild';
    case 'ashfall':
      return 'ashfall';
    case 'assets':
      return 'assets';
    case 'scene':
      return 'scene';
    case 'camera':
      return 'camera';
    case 'lighting':
      return 'lighting';
    case 'materials':
      return 'material';
    case 'physics':
      return 'physics';
    case 'fx':
      return 'fx';
    case 'ai':
    case 'mocap':
      return 'ai';
    case 'smart':
      return 'smart';
    case 'director':
      return 'director';
    case 'cinematic':
      return 'cinematic';
    case 'performance':
      return 'performance';
    case 'inspector':
      return 'inspector';
    case 'render':
      return 'renderpipe';
    case 'animation':
      return 'animlib';
    case 'timeline':
      return 'timeline';
    case 'more':
      return null;
    default:
      return null;
  }
}

export function workspaceToolTitle(tool: MobileWorkspaceTool): string {
  return MOBILE_WORKSPACE_TOOLS.find((t) => t.id === tool)?.label ?? tool;
}

export function isTimelineWorkspaceTool(tool: MobileWorkspaceTool | null): boolean {
  return tool === 'timeline';
}

/** Sheets that need tall snap (timeline / dense editors). */
export function prefersTallSheet(tool: MobileWorkspaceTool | null): boolean {
  return (
    tool === 'timeline' ||
    tool === 'animation' ||
    tool === 'physics' ||
    tool === 'ai' ||
    tool === 'mocap' ||
    // mocap shares AI panel (Motion Capture Studio 2.0)
    tool === 'smart' ||
    tool === 'director' ||
    tool === 'cinematic' ||
    tool === 'render' ||
    tool === 'envbuild' ||
    tool === 'ashfall'
  );
}
