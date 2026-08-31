import { Camera, Clapperboard, Sparkles, X } from 'lucide-react';
import type { SmartStudioMode } from './types';

interface SmartStudioDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (mode: SmartStudioMode) => void;
  hasModel: boolean;
}

const MODES: Array<{
  id: SmartStudioMode;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  accent: string;
}> = [
  {
    id: 'showcase',
    title: 'Auto Showcase',
    subtitle: 'Live presentation — camera, lights, idle, FX',
    icon: Sparkles,
    accent: 'from-violet-500/30 to-fuchsia-500/20 border-violet-400/40',
  },
  {
    id: 'photo',
    title: 'Auto Photo',
    subtitle: 'Perfect stills — DOF, framing, max quality',
    icon: Camera,
    accent: 'from-cyan-500/30 to-sky-500/20 border-cyan-400/40',
  },
  {
    id: 'video',
    title: 'Auto Video',
    subtitle: 'Cinematic paths — Shorts, Reels, trailers',
    icon: Clapperboard,
    accent: 'from-rose-500/30 to-orange-500/20 border-rose-400/40',
  },
];

export default function SmartStudioDialog({
  open,
  onClose,
  onSelect,
  hasModel,
}: SmartStudioDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg max-h-[min(85dvh,var(--app-height,100dvh))] flex flex-col rounded-2xl border border-white/10 bg-[#0c0e14]/95 shadow-2xl overflow-hidden"
        role="dialog"
        aria-labelledby="smart-studio-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2
              id="smart-studio-title"
              className="text-base font-bold text-white tracking-wide flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-violet-300" />
              AnimaStage Smart Studio
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              One click. Professional scene in seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!hasModel ? (
          <div className="px-5 py-8 text-center text-sm text-amber-200/90">
            Load a PMX/PMD model first, then open Smart Studio.
          </div>
        ) : (
          <div className="p-4 grid gap-3">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSelect(mode.id)}
                  className={`text-left rounded-xl border bg-gradient-to-r ${mode.accent} px-4 py-3.5 hover:brightness-110 transition-all cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-black/30 border border-white/10">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{mode.title}</div>
                      <div className="text-[11px] text-zinc-300/90 mt-0.5">{mode.subtitle}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 border-t border-white/5 text-[10px] text-zinc-500">
          Analyzes model, animation, camera, lighting, physics & GPU — no manual setup.
        </div>
      </div>
    </div>
  );
}
