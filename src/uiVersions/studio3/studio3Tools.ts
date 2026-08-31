/**
 * UI 3.0 tool catalog — all panels on one compact strip (grouped).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  Camera,
  Clapperboard,
  FolderOpen,
  Lightbulb,
  Mountain,
  Palette,
  Sparkles,
  Wand2,
  Wind,
  Activity,
  Aperture,
  Film,
  Building2,
  Globe2,
  Bot,
  Users,
} from 'lucide-react';
import type { Studio3PanelId } from './workspaceLayout';

export type Studio3ToolGroup = 'create' | 'edit' | 'look' | 'render' | 'system';

export interface Studio3ToolDef {
  id: Studio3PanelId;
  /** Short label for the tab strip */
  short: string;
  /** Full name for titles / command palette */
  label: string;
  icon: LucideIcon;
  group: Studio3ToolGroup;
  /** Extra search terms for Ctrl+K */
  keywords?: string[];
}

export const STUDIO3_TOOLS: Studio3ToolDef[] = [
  {
    id: 'scene',
    short: 'Scene',
    label: 'Scene Graph',
    icon: Boxes,
    group: 'create',
    keywords: ['hierarchy', 'objects', 'outliner'],
  },
  {
    id: 'world',
    short: 'World',
    label: 'Scene Studio 2.0',
    icon: Globe2,
    group: 'create',
    keywords: ['environment', 'weather', 'mood', 'scene fx', 'smart scene', 'world'],
  },
  {
    id: 'assets',
    short: 'Assets',
    label: 'Asset Browser',
    icon: FolderOpen,
    group: 'create',
    keywords: ['import', 'pmx', 'vmd', 'glb', 'load', 'model'],
  },
  {
    id: 'photo',
    short: 'Photo',
    label: 'Photo Studio',
    icon: Aperture,
    group: 'create',
    keywords: ['still', 'pose', 'snapshot'],
  },
  {
    id: 'smart',
    short: 'Smart',
    label: 'Smart Studio',
    icon: Clapperboard,
    group: 'create',
    keywords: ['guided', 'auto'],
  },
  {
    id: 'workflow',
    short: 'Dir',
    label: 'Director Workflow',
    icon: Users,
    group: 'create',
    keywords: ['cast', 'clips', 'music', 'scene', 'director', 'reze'],
  },
  {
    id: 'director',
    short: 'AI Dir',
    label: 'AI Scene Director',
    icon: Bot,
    group: 'create',
    keywords: [
      'ai scene',
      'scene director',
      'prompt',
      'generate scene',
      'openrouter',
      'natural language',
    ],
  },
  {
    id: 'ashfall',
    short: 'City',
    label: 'Ashfall City',
    icon: Building2,
    group: 'create',
    keywords: ['ashfall', 'city', 'world'],
  },
  {
    id: 'animlib',
    short: 'Anim',
    label: 'Animation Library',
    icon: Clapperboard,
    group: 'edit',
    keywords: ['motion', 'vmd', 'retarget', 'library'],
  },
  {
    id: 'camera',
    short: 'Cam',
    label: 'Camera Studio',
    icon: Camera,
    group: 'edit',
    keywords: ['orbit', 'framing', '9:16'],
  },
  {
    id: 'shots',
    short: 'Shot',
    label: 'Shot Composer',
    icon: Aperture,
    group: 'edit',
    keywords: [
      'place character',
      'create shot',
      'framing',
      'shorts',
      'placement',
      'compose',
    ],
  },
  {
    id: 'ai',
    short: 'AI',
    label: 'AI / Motion Capture',
    icon: Wand2,
    group: 'edit',
    keywords: ['mocap', 'wham', 'openrouter', 'text motion'],
  },
  {
    id: 'lighting',
    short: 'Env',
    label: 'Environment / Lighting',
    icon: Lightbulb,
    group: 'look',
    keywords: ['sky', 'lights', 'dynamic sky', 'weather'],
  },
  {
    id: 'envbuild',
    short: 'Build',
    label: 'Environment Builder',
    icon: Mountain,
    group: 'look',
    keywords: ['background', 'hdr', 'stage'],
  },
  {
    id: 'physics',
    short: 'Phys',
    label: 'Physics Studio',
    icon: Wind,
    group: 'look',
    keywords: ['hair', 'cloth', 'warmup', 'ammo'],
  },
  {
    id: 'fx',
    short: 'FX',
    label: 'FX Studio',
    icon: Sparkles,
    group: 'look',
    keywords: ['bloom', 'lut', 'post', 'grade'],
  },
  {
    id: 'material',
    short: 'Mat',
    label: 'Material Studio',
    icon: Palette,
    group: 'look',
    keywords: ['texture', 'shader', 'toon'],
  },
  {
    id: 'cinematic',
    short: 'Film',
    label: 'Cinematic Render',
    icon: Film,
    group: 'render',
    keywords: ['quality', 'sun', 'weather', 'style', 'cinema'],
  },
  {
    id: 'renderpipe',
    short: 'Pipe',
    label: 'Render Pipeline 4.0',
    icon: Sparkles,
    group: 'render',
    keywords: ['export', 'mp4', 'pipeline', 'render'],
  },
  {
    id: 'performance',
    short: 'Perf',
    label: 'Performance',
    icon: Activity,
    group: 'system',
    keywords: ['fps', 'gpu', 'quality mode'],
  },
];

export const STUDIO3_GROUP_ORDER: Studio3ToolGroup[] = [
  'create',
  'edit',
  'look',
  'render',
  'system',
];

export const STUDIO3_GROUP_LABEL: Record<Studio3ToolGroup, string> = {
  create: 'Create',
  edit: 'Edit',
  look: 'Look',
  render: 'Render',
  system: 'System',
};

/** Tools in strip order, with group breaks for compact dividers. */
export function studio3ToolsByGroup(): { group: Studio3ToolGroup; tools: Studio3ToolDef[] }[] {
  return STUDIO3_GROUP_ORDER.map((group) => ({
    group,
    tools: STUDIO3_TOOLS.filter((t) => t.group === group),
  })).filter((g) => g.tools.length > 0);
}

export function findStudio3Tool(id: Studio3PanelId): Studio3ToolDef | undefined {
  return STUDIO3_TOOLS.find((t) => t.id === id);
}

export function matchStudio3ToolQuery(tool: Studio3ToolDef, q: string): boolean {
  if (!q) return true;
  const hay = [tool.short, tool.label, tool.id, ...(tool.keywords ?? [])]
    .join(' ')
    .toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}
