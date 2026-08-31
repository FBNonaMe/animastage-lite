import {
  Aperture,
  Camera,
  Clapperboard,
  Lightbulb,
  Loader2,
  Play,
  Settings2,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  getMotionAnimationTemplates,
  TEMPLATE_CATEGORY_LABELS,
} from '../templates/animationTemplates';
import SmartReportCard from './SmartReportCard';
import type { SmartStudioApi } from './useSmartStudio';
import type { SmartStudioMode } from './types';

interface SmartStudioOverlayProps {
  api: SmartStudioApi;
  /** Selected model VMD list for motion picker. */
  vmdOptions?: Array<{ modelId: string; index: number; label: string }>;
}

function modeLabel(mode: SmartStudioMode | null): string {
  if (mode === 'showcase') return 'Auto Showcase';
  if (mode === 'photo') return 'Auto Photo';
  if (mode === 'video') return 'Auto Video';
  return 'Smart Studio';
}

export default function SmartStudioOverlay({ api, vmdOptions = [] }: SmartStudioOverlayProps) {
  const { state } = api;
  const motionTemplates = useMemo(() => getMotionAnimationTemplates().slice(0, 24), []);

  if (!state.active) return null;

  const preparing = state.phase === 'preparing';
  const showReport = state.reportVisible && state.report != null;
  const showAnimations = state.phase === 'animations';
  const showSettings = state.phase === 'settings';

  return (
    <div className="pointer-events-none absolute inset-0 z-[45] flex flex-col justify-between">
      <div className="pointer-events-auto flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-[#0c0e14]/85 backdrop-blur-md px-3 py-1.5 shadow-lg">
          <Sparkles className="w-3.5 h-3.5 text-violet-300" />
          <span className="text-[11px] font-bold text-white tracking-wide">
            {modeLabel(state.mode)}
          </span>
          {preparing ? (
            <Loader2 className="w-3.5 h-3.5 text-violet-300 animate-spin" />
          ) : (
            <span className="text-[9px] text-emerald-300/90 font-semibold uppercase">Live</span>
          )}
        </div>
        <button
          type="button"
          onClick={api.exit}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0c0e14]/85 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-zinc-200 hover:text-white hover:border-white/25 cursor-pointer shadow-lg"
        >
          <X className="w-3.5 h-3.5" />
          Exit Smart Studio
        </button>
      </div>

      {showReport ? (
        <div className="pointer-events-none flex justify-center px-3">
          <SmartReportCard report={state.report!} onDismiss={api.dismissReport} />
        </div>
      ) : preparing ? (
        <div className="pointer-events-none flex justify-center">
          <div className="rounded-xl border border-violet-400/20 bg-[#0c0e14]/80 px-4 py-3 text-xs text-violet-100 font-semibold backdrop-blur-md">
            Building professional scene…
          </div>
        </div>
      ) : state.statusMessage ? (
        <div className="pointer-events-none flex justify-center px-3">
          <div className="rounded-lg border border-emerald-400/25 bg-[#0c0e14]/85 px-3 py-2 text-[11px] text-emerald-100 font-semibold backdrop-blur-md">
            {state.statusMessage}
          </div>
        </div>
      ) : (
        <div />
      )}

      <div className="pointer-events-auto flex justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#0c0e14]/90 backdrop-blur-md p-1.5 shadow-2xl max-w-[min(100%,32rem)]">
          <ToolButton
            icon={Camera}
            label="Screenshot"
            onClick={() => void api.takeScreenshot('png')}
            disabled={preparing}
          />
          <ToolButton
            icon={Aperture}
            label="4K"
            onClick={() => void api.takeScreenshot('4k')}
            disabled={preparing}
          />
          <ToolButton
            icon={Clapperboard}
            label="Record"
            onClick={api.startRecording}
            disabled={preparing || state.mode === 'photo'}
          />
          <ToolButton
            icon={Play}
            label="Animation"
            onClick={() =>
              api.setPhase(state.phase === 'animations' ? 'ready' : 'animations')
            }
            disabled={preparing}
          />
          <ToolButton
            icon={Lightbulb}
            label="Lighting"
            onClick={() => api.recaptureReport()}
            disabled={preparing}
          />
          <ToolButton
            icon={Camera}
            label="Camera"
            onClick={api.cycleCamera}
            disabled={preparing}
          />
          <ToolButton
            icon={Smile}
            label="Expression"
            onClick={api.cycleExpression}
            disabled={preparing}
          />
          <ToolButton
            icon={Settings2}
            label="Settings"
            onClick={() => api.setPhase(state.phase === 'settings' ? 'ready' : 'settings')}
            disabled={preparing}
          />
        </div>
      </div>

      {showAnimations ? (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 w-[min(100%-1.5rem,22rem)] max-h-[min(50vh,20rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#0c0e14]/96 backdrop-blur-md p-3 text-[10px] text-zinc-300 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="font-bold text-zinc-100 text-[11px]">Choose animation</div>
            <button
              type="button"
              onClick={() => api.setPhase('ready')}
              className="text-[10px] font-bold text-violet-200 hover:text-white cursor-pointer px-2 py-0.5 rounded border border-violet-400/30"
            >
              OK
            </button>
          </div>
          {state.activeAnimationLabel ? (
            <div className="mb-2 text-[9px] text-emerald-300/90">
              Active: {state.activeAnimationLabel}
            </div>
          ) : null}

          {vmdOptions.length > 0 ? (
            <div className="mb-2">
              <div className="text-[9px] font-bold uppercase text-zinc-500 mb-1">VMD motions</div>
              <div className="flex flex-wrap gap-1">
                {vmdOptions.map((v) => (
                  <button
                    key={`${v.modelId}-${v.index}`}
                    type="button"
                    onClick={() => api.applyVmdMotion(v.modelId, v.index, v.label)}
                    className={`px-2 py-1 rounded-lg border text-[9px] font-bold cursor-pointer ${
                      state.activeAnimationId === `vmd:${v.index}`
                        ? 'border-violet-400/50 bg-violet-500/25 text-violet-100'
                        : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-violet-400/30'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="text-[9px] font-bold uppercase text-zinc-500 mb-1">Templates</div>
          <div className="flex flex-wrap gap-1">
            {motionTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                title={`${TEMPLATE_CATEGORY_LABELS[tpl.category]} — ${tpl.description}`}
                onClick={() => api.applyAnimationTemplate(tpl.id, tpl.name)}
                className={`px-2 py-1 rounded-lg border text-[9px] font-bold cursor-pointer ${
                  state.activeAnimationId === tpl.id
                    ? 'border-violet-400/50 bg-violet-500/25 text-violet-100'
                    : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-violet-400/30'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showSettings ? (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 w-[min(100%-1.5rem,20rem)] rounded-xl border border-white/10 bg-[#0c0e14]/95 backdrop-blur-md p-3 text-[10px] text-zinc-300 space-y-1.5 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="font-bold text-zinc-100 text-[11px]">Smart Settings</div>
            <button
              type="button"
              onClick={() => api.setPhase('ready')}
              className="text-[10px] font-bold text-violet-200 hover:text-white cursor-pointer px-2 py-0.5 rounded border border-violet-400/30"
            >
              OK
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Camera</span>
            <span>{state.cameraPreset.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Background</span>
            <span>{state.background.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Expression</span>
            <span>{state.expression}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Animation</span>
            <span>{state.activeAnimationLabel ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">GPU tier</span>
            <span>{state.profile?.gpuTier ?? '—'}</span>
          </div>
          <button
            type="button"
            onClick={() => api.recaptureReport()}
            className="w-full mt-1 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/30 text-violet-100 font-bold cursor-pointer hover:bg-violet-500/30"
          >
            Re-optimize scene
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-0.5 min-w-[3.25rem] px-2 py-1.5 rounded-xl text-zinc-200 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
    >
      <Icon className="w-4 h-4" />
      <span className="text-[8px] font-bold uppercase tracking-wide">{label}</span>
    </button>
  );
}
