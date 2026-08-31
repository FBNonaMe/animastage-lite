import {
  Activity,
  Aperture,
  Boxes,
  Camera,
  Clapperboard,
  Crosshair,
  Film,
  FolderOpen,
  Gauge,
  Lightbulb,
  MoreHorizontal,
  Mountain,
  Palette,
  Sparkles,
  Video,
  Wand2,
  Wind,
  Bot,
} from 'lucide-react';
import { cn } from '../../components/UI/cn';
import {
  MOBILE_MORE_CATALOG,
  MOBILE_WORKSPACE_TOOLS,
  type MobileToolGroup,
  type MobileWorkspaceTool,
} from './types';

const ICONS: Record<MobileWorkspaceTool, typeof Boxes> = {
  assets: FolderOpen,
  photo: Aperture,
  envbuild: Mountain,
  ashfall: Mountain,
  scene: Boxes,
  animation: Clapperboard,
  camera: Camera,
  lighting: Lightbulb,
  materials: Palette,
  physics: Wind,
  fx: Sparkles,
  timeline: Film,
  ai: Wand2,
  mocap: Video,
  smart: Clapperboard,
  director: Bot,
  cinematic: Aperture,
  performance: Gauge,
  inspector: Crosshair,
  render: Video,
  more: MoreHorizontal,
};

const GROUP_ORDER: MobileToolGroup[] = [
  'new',
  'create',
  'edit',
  'look',
  'export',
  'system',
];

const GROUP_LABEL: Record<MobileToolGroup, string> = {
  new: 'New in 1.4',
  create: 'Create & Load',
  edit: 'Edit',
  look: 'Look & FX',
  export: 'Export',
  system: 'System',
};

export interface MobileMoreSheetProps {
  open: boolean;
  active: MobileWorkspaceTool | null;
  onSelect: (tool: MobileWorkspaceTool) => void;
  onClose: () => void;
}

/** Full feature catalog — overflow for phone; new features live here. */
export default function MobileMoreSheet({
  open,
  active,
  onSelect,
  onClose,
}: MobileMoreSheetProps) {
  if (!open) return null;

  const byGroup = MOBILE_MORE_CATALOG.reduce<
    Record<string, { id: MobileWorkspaceTool; label: string; isNew?: boolean }[]>
  >((acc, id) => {
    const meta = MOBILE_WORKSPACE_TOOLS.find((t) => t.id === id);
    if (!meta) return acc;
    const g = meta.group;
    (acc[g] ??= []).push({ id: meta.id, label: meta.label, isNew: meta.isNew });
    return acc;
  }, {});

  return (
    <div className="am-more-sheet" role="dialog" aria-modal="true" aria-label="All studio tools">
      <button type="button" className="am-more-sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="am-more-sheet__card">
        <div className="am-more-sheet__handle" aria-hidden />
        <div className="am-more-sheet__head">
          <div className="min-w-0 flex-1">
            <p className="am-more-sheet__title">More tools</p>
            <p className="am-more-sheet__sub">
              New features + full desktop catalog — opens as a sheet above the dock
            </p>
          </div>
          <button type="button" className="am-more-sheet__close shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="am-more-sheet__body">
          {GROUP_ORDER.map((group) => {
            const items = byGroup[group];
            if (!items?.length) return null;
            return (
              <section key={group} className="am-more-sheet__group">
                <h3 className="am-more-sheet__group-title">{GROUP_LABEL[group]}</h3>
                <div className="am-more-sheet__grid">
                  {items.map(({ id, label: toolLabel, isNew }) => {
                    const Icon = ICONS[id] ?? Activity;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          'am-more-sheet__item',
                          active === id && 'am-more-sheet__item--active',
                          isNew && 'am-more-sheet__item--new'
                        )}
                        onClick={() => onSelect(id)}
                      >
                        {isNew ? <span className="am-more-sheet__badge">New</span> : null}
                        <Icon className="am-more-sheet__icon" aria-hidden />
                        <span className="am-more-sheet__label">{toolLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { ICONS as MOBILE_TOOL_ICONS };
