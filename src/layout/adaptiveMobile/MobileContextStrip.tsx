import { cn } from '../../components/UI/cn';
import { contextToolsForKind } from './resolveContext';
import type { MobileSelectionContext, MobileWorkspaceTool } from './types';

export interface MobileContextStripProps {
  context: MobileSelectionContext;
  onTool: (toolId: string) => void;
  className?: string;
}

/** Context-sensitive tool chips over the viewport (CapCut-style). */
export default function MobileContextStrip({
  context,
  onTool,
  className,
}: MobileContextStripProps) {
  const tools = contextToolsForKind(context.kind);

  return (
    <div
      className={cn('am-context-strip', className)}
      role="toolbar"
      aria-label={`Tools for ${context.label}`}
    >
      <span className="am-context-strip__label" title={context.label}>
        {context.kind === 'none' ? 'Select' : context.label}
      </span>
      <div className="am-context-strip__tools">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className="am-context-strip__chip"
            onClick={() => onTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Map context chip ids → workspace tool / action. */
export function mapContextChipToWorkspace(
  chipId: string
): MobileWorkspaceTool | 'move' | 'rotate' | null {
  switch (chipId) {
    case 'animate':
    case 'pose':
      return 'animation';
    case 'materials':
      return 'materials';
    case 'physics':
      return 'physics';
    case 'camera':
      return 'camera';
    case 'timeline':
      return 'timeline';
    case 'fx':
      return 'fx';
    case 'lighting':
      return 'lighting';
    case 'scene':
      return 'scene';
    case 'render':
      return 'render';
    case 'assets':
    case 'load':
      return 'assets';
    case 'inspector':
      return 'inspector';
    case 'move':
      return 'move';
    case 'rotate':
      return 'rotate';
    default:
      return null;
  }
}
