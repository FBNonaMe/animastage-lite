import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Upload,
  Sun,
  Play,
  Video,
  Share2,
  Film,
  Clapperboard,
  LayoutDashboard,
  Bookmark,
} from 'lucide-react';

const STEPS: { label: string; sub: string; icon: LucideIcon }[] = [
  { label: 'Open Studio', sub: 'UI 3.0', icon: LayoutDashboard },
  { label: 'Import', sub: 'PMX / VMD', icon: Upload },
  { label: 'Scene Studio', sub: 'Mood + FX', icon: Sun },
  { label: 'Motion', sub: 'VMD / Mocap', icon: Clapperboard },
  { label: 'Pose', sub: 'Smart presets', icon: Bookmark },
  { label: 'Look', sub: 'Cinematic FX', icon: Film },
  { label: 'Director', sub: 'Clips + FX', icon: Play },
  { label: 'Export', sub: 'MP4 Shorts', icon: Video },
  { label: 'Share', sub: '9:16', icon: Share2 },
];

export default function FlowDiagram() {
  return (
    <div className="w-full overflow-x-auto pb-2 -mx-1 px-1 landing-flow-scroll">
      <div className="flex items-stretch min-w-[820px] sm:min-w-0 sm:flex-wrap sm:justify-center gap-2 sm:gap-2.5">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1.5 sm:gap-2">
            <div className="glass-panel rounded-xl px-2.5 py-3 sm:px-3.5 sm:py-3.5 min-w-[76px] sm:min-w-[88px] text-center">
              <step.icon className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-cyan-400 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-100">{step.label}</p>
              <p className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5">{step.sub}</p>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0 hidden sm:block" />
            )}
          </div>
        ))}
      </div>
      <p className="sm:hidden text-[10px] text-zinc-600 text-center mt-2 m-0">
        Swipe sideways to see the full pipeline →
      </p>
    </div>
  );
}
