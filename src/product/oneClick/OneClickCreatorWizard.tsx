import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Star,
  Heart,
  Play,
  Pause,
  Download,
  Share2,
  RotateCcw,
  Loader2,
  Zap,
  Monitor,
  Smartphone,
  Camera,
  KeyRound,
  PanelRightOpen,
  PanelRightClose,
  UserRound,
  Clapperboard,
  Palette,
  Film,
  Trophy,
  Check,
  Wand2,
} from 'lucide-react';
import type { useOneClickCreator } from './useOneClickCreator';
import {
  MOTION_CATEGORIES,
  getMotionsForCategory,
} from './motionLibrary';
import { VISUAL_STYLE_CARDS } from './visualStyleCards';
import { ONE_CLICK_STEPS, type MotionCategoryId, type OneClickStep } from './types';
import type { SmartVideoMetadata } from '../../smartMetadata/types';
import VideoInformationPanel from '../../components/smartMetadata/VideoInformationPanel';

type CreatorApi = ReturnType<typeof useOneClickCreator>;

interface OneClickCreatorWizardProps {
  api: CreatorApi;
  metadata: SmartVideoMetadata | null;
  onMetadataRegenerate?: () => void;
  onMetadataSelectTitle?: (index: number) => void;
  onMetadataSetPlatform?: (platform: SmartVideoMetadata['platform']) => void;
  onMetadataLocaleChange?: (locale: SmartVideoMetadata['locale']) => void;
  exportProgress?: { phase: string; progress: number; message: string };
  onSaveProject?: () => void;
  isPlaying?: boolean;
  currentFrame?: number;
  maxFrames?: number;
  cameraKeyCount?: number;
}

const STEP_META: Record<
  Exclude<OneClickStep, 'complete'>,
  { title: string; subtitle: string; icon: typeof UserRound }
> = {
  character: {
    title: 'Import Character',
    subtitle: 'PMX, PMD, ZIP — or try our demo model',
    icon: UserRound,
  },
  motion: {
    title: 'Choose Motion',
    subtitle: 'Pick a dance or pose — you control the camera',
    icon: Clapperboard,
  },
  style: {
    title: 'Visual Style',
    subtitle: 'Lighting, bloom & color — one tap',
    icon: Palette,
  },
  export: {
    title: 'Export Video',
    subtitle: 'Platform, thumbnail & MP4 — ready to share',
    icon: Film,
  },
};

const CATEGORY_GRADIENT: Partial<Record<MotionCategoryId, string>> = {
  trending: 'from-rose-500 to-orange-400',
  popular: 'from-violet-500 to-fuchsia-500',
  dance: 'from-cyan-500 to-blue-500',
  cute: 'from-pink-400 to-rose-400',
  favorites: 'from-amber-400 to-orange-500',
};

function StepProgress({ current }: { current: OneClickStep }) {
  const activeIdx = ONE_CLICK_STEPS.findIndex((s) => s.id === current);
  const progressPct =
    current === 'complete' ? 100 : Math.max(0, (activeIdx / (ONE_CLICK_STEPS.length - 1)) * 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 px-0.5">
        <span>Your progress</span>
        <span className="text-cyan-400/90">{Math.round(progressPct)}%</span>
      </div>
      <div className="relative flex items-center justify-between">
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {ONE_CLICK_STEPS.map((step, i) => {
          const done = i < activeIdx || current === 'complete';
          const active = step.id === current;
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1.5">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-bold border-2 transition-all duration-300 ${
                  active
                    ? 'border-cyan-400 bg-gradient-to-br from-violet-600/40 to-cyan-600/40 text-white shadow-lg shadow-cyan-500/25 scale-110'
                    : done
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                }`}
              >
                {done && !active ? <Check className="w-3.5 h-3.5" /> : step.num}
              </div>
              <span
                className={`hidden sm:block text-[9px] font-semibold max-w-[4.5rem] text-center leading-tight ${
                  active ? 'text-cyan-300' : done ? 'text-emerald-400/80' : 'text-zinc-600'
                }`}
              >
                {step.label.split(' ').slice(-1)[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepHero({ step }: { step: Exclude<OneClickStep, 'complete'> }) {
  const meta = STEP_META[step];
  const Icon = meta.icon;
  return (
    <div className="text-center mb-5 creator-step-enter">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-500/20 border border-white/10 shadow-inner mb-3 relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-cyan-500/10 landing-glow-pulse" />
        <Icon className="w-7 h-7 text-cyan-300 relative z-10" />
      </div>
      <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
        {meta.title}
      </h2>
      <p className="text-xs text-zinc-500 mt-1.5 max-w-[16rem] mx-auto leading-relaxed">{meta.subtitle}</p>
    </div>
  );
}

function GlassSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 space-y-3 shadow-inner shadow-black/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const colors =
    level === 'easy'
      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25'
      : level === 'hard'
        ? 'text-rose-300 bg-rose-500/15 border-rose-500/25'
        : 'text-amber-300 bg-amber-500/15 border-amber-500/25';
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${colors}`}>
      {level}
    </span>
  );
}

function Stars({ count }: { count: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tight" aria-label={`${count} stars`}>
      {'★'.repeat(count)}
      <span className="text-zinc-700">{'★'.repeat(5 - count)}</span>
    </span>
  );
}

function CreatorPreviewDock({
  isPlaying,
  currentFrame,
  maxFrames,
  cameraKeyCount,
  onTogglePlay,
  onScrub,
  onEditCamera,
  onSaveKeyframe,
}: {
  isPlaying: boolean;
  currentFrame: number;
  maxFrames: number;
  cameraKeyCount: number;
  onTogglePlay: () => void;
  onScrub: (frame: number) => void;
  onEditCamera: () => void;
  onSaveKeyframe: () => void;
}) {
  const safeMax = Math.max(1, maxFrames);
  const pct = Math.min(100, (currentFrame / safeMax) * 100);

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-2.5 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p className="text-[10px] text-zinc-300/90 bg-[#0c0e14]/75 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 shadow-lg">
        <Wand2 className="w-3 h-3 inline mr-1.5 text-fuchsia-400 -mt-px" />
        Orbit scene · scrub · <span className="text-amber-300 font-semibold">Key</span> saves camera
      </p>
      <div className="relative w-full max-w-[min(100%,40rem)]">
        <div className="absolute -inset-px rounded-[1.15rem] bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-cyan-500/30 blur-sm opacity-60" />
        <div className="relative flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#0c0e14]/90 backdrop-blur-xl p-2 shadow-2xl">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/80 to-cyan-600/80 hover:from-violet-500 hover:to-cyan-500 border border-white/10 text-white text-[11px] font-bold cursor-pointer shadow-lg shadow-cyan-500/15 transition-all"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="flex items-center gap-2 px-2 min-w-[11rem] flex-1">
            <input
              type="range"
              min={0}
              max={safeMax}
              value={currentFrame}
              onChange={(e) => onScrub(Number(e.target.value))}
              className="flex-1 h-1.5 accent-cyan-400 cursor-pointer"
              aria-label="Scrub timeline"
            />
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums whitespace-nowrap">
              {currentFrame}/{safeMax}
            </span>
          </div>
          <button
            type="button"
            onClick={onEditCamera}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/20 text-[11px] font-bold text-violet-200 cursor-pointer transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            Cam
          </button>
          <button
            type="button"
            onClick={onSaveKeyframe}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/20 text-[11px] font-bold text-amber-200 cursor-pointer transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Key
            {cameraKeyCount > 0 ? (
              <span className="text-[9px] bg-amber-500/25 px-1.5 py-0.5 rounded-full">{cameraKeyCount}</span>
            ) : null}
          </button>
          <div className="hidden sm:flex w-full px-1 pt-0.5">
            <div className="w-full h-1 bg-zinc-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-cyan-400 transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompletionScreen({
  api,
  metadata,
  exportFileName,
  onSaveProject,
}: {
  api: CreatorApi;
  metadata: SmartVideoMetadata | null;
  exportFileName: string | null;
  onSaveProject?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl">
      <div className="absolute inset-0 creator-ambient pointer-events-none" />
      <div className="relative w-full max-w-md rounded-3xl border border-emerald-500/30 bg-[#0e1016]/95 shadow-2xl overflow-hidden">
        <div className="creator-gradient-line" />
        <div className="p-8 text-center">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-5 mx-auto">
            <div className="absolute inset-0 rounded-full bg-emerald-400/10 landing-glow-pulse" />
            <Trophy className="w-10 h-10 text-amber-300 relative z-10" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent mb-2">
            Your video is ready!
          </h2>
          <p className="text-sm text-zinc-400 mb-2">Congratulations — your first MMD animation is done.</p>
          {exportFileName ? (
            <p className="text-[10px] text-zinc-500 font-mono truncate mb-6 px-4">{exportFileName}</p>
          ) : (
            <div className="mb-6" />
          )}
          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={api.exit}
              className="creator-shimmer-btn flex items-center justify-center gap-2 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-cyan-400 text-white font-bold text-sm py-3.5 rounded-xl cursor-pointer shadow-lg shadow-fuchsia-500/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Watch in Studio
            </button>
            {onSaveProject ? (
              <button
                type="button"
                onClick={onSaveProject}
                className="flex items-center justify-center gap-2 w-full border border-white/10 hover:border-cyan-500/40 bg-white/[0.03] text-zinc-200 font-semibold text-sm py-3 rounded-xl cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                Save Project
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  void navigator.share({
                    title: metadata?.titles[metadata.selectedTitleIndex] ?? 'My MMD animation',
                    text: metadata?.description?.slice(0, 120) ?? 'Made with AnimaStage Lite',
                  }).catch(() => {});
                }
              }}
              className="flex items-center justify-center gap-2 w-full border border-white/10 hover:border-violet-500/40 bg-white/[0.03] text-zinc-200 font-semibold text-sm py-3 rounded-xl cursor-pointer transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
            <button
              type="button"
              onClick={api.createAnother}
              className="flex items-center justify-center gap-2 w-full text-cyan-400 hover:text-cyan-300 font-semibold text-sm py-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Create Another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OneClickCreatorWizard({
  api,
  metadata,
  onMetadataRegenerate,
  onMetadataSelectTitle,
  onMetadataSetPlatform,
  onMetadataLocaleChange,
  exportProgress,
  onSaveProject,
  isPlaying = false,
  currentFrame = 0,
  maxFrames = 300,
  cameraKeyCount = 0,
}: OneClickCreatorWizardProps) {
  const { state } = api;
  const [motionCategory, setMotionCategory] = useState<MotionCategoryId>('trending');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const motions = getMotionsForCategory(motionCategory, api.favorites, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        api.handleCharacterImport(e.dataTransfer.files);
      }
    },
    [api]
  );

  if (!state.active) return null;

  if (state.step === 'complete') {
    return (
      <CompletionScreen
        api={api}
        metadata={metadata}
        exportFileName={state.exportFileName}
        onSaveProject={onSaveProject}
      />
    );
  }

  const currentStep = state.step as Exclude<OneClickStep, 'complete'>;

  return (
    <div className="pointer-events-none absolute inset-0 z-[90] flex flex-col justify-between">
      <div className="creator-ambient absolute inset-0 pointer-events-none" />

      <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] relative z-10">
        <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0c0e14]/80 backdrop-blur-xl px-3.5 py-2 shadow-xl">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 shadow-lg shadow-fuchsia-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block leading-tight">Create My First Video</span>
            <span className="hidden sm:block text-[9px] text-zinc-500">Scene live · adjust camera anytime</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={api.togglePanel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c0e14]/80 backdrop-blur-xl px-3 py-2 text-[11px] font-bold text-zinc-200 hover:text-white hover:border-cyan-500/30 cursor-pointer shadow-lg transition-colors"
          >
            {state.panelMinimized ? (
              <>
                <PanelRightOpen className="w-3.5 h-3.5 text-cyan-400" />
                Guide
              </>
            ) : (
              <>
                <PanelRightClose className="w-3.5 h-3.5" />
                Hide
              </>
            )}
          </button>
          <button
            type="button"
            onClick={api.exit}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-[#0c0e14]/80 backdrop-blur-xl text-zinc-400 hover:text-white hover:border-rose-500/30 cursor-pointer shadow-lg transition-colors"
            aria-label="Close wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {state.statusMessage ? (
        <div className="pointer-events-none flex justify-center px-3 relative z-10">
          <div className="rounded-xl border border-cyan-400/30 bg-[#0c0e14]/85 px-4 py-2 text-[11px] text-cyan-100 font-semibold backdrop-blur-xl shadow-lg">
            <Sparkles className="w-3 h-3 inline mr-1.5 text-cyan-400" />
            {state.statusMessage}
          </div>
        </div>
      ) : (
        <div />
      )}

      {state.panelMinimized ? (
        <button
          type="button"
          onClick={api.togglePanel}
          className="creator-fab pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 z-20 inline-flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0c0e14]/90 backdrop-blur-xl px-3 py-4 shadow-2xl hover:border-cyan-500/40 cursor-pointer transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-[9px] font-bold text-zinc-300">Steps</span>
        </button>
      ) : null}

      {!state.panelMinimized ? (
        <aside className="pointer-events-auto absolute right-0 z-20 w-full sm:w-[min(100%,26rem)] md:w-[min(100%,30rem)] flex flex-col overflow-hidden top-auto bottom-[8.5rem] max-h-[min(58vh,32rem)] sm:top-14 sm:bottom-0 sm:max-h-none rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl border-l border-t sm:border-t-0 border-white/10 creator-panel-surface">
          <div className="creator-gradient-line shrink-0" />
          <div className="sm:hidden w-10 h-1 rounded-full bg-zinc-700 mx-auto mt-2 shrink-0" aria-hidden />
          <div className="shrink-0 px-5 pt-4 pb-2 border-b border-white/[0.06]">
            <StepProgress current={state.step} />
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
            {state.preparing ? (
              <div className="flex flex-col items-center justify-center gap-3 text-zinc-400 text-sm py-16">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
                </div>
                <p className="font-semibold text-zinc-300">Preparing your scene…</p>
                <p className="text-[10px] text-zinc-500">Lighting, motion & camera</p>
              </div>
            ) : (
              <>
                <StepHero step={currentStep} />

                {state.step === 'character' ? (
                  <div className="space-y-5 creator-step-enter">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 creator-card-lift ${
                        dragOver
                          ? 'border-cyan-400/80 creator-drop-glow bg-cyan-500/10'
                          : 'border-zinc-600/60 bg-gradient-to-b from-white/[0.04] to-transparent hover:border-cyan-500/40'
                      }`}
                    >
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-white/10 mb-4">
                        <Upload className="w-8 h-8 text-cyan-400" />
                      </div>
                      <p className="text-sm font-bold text-zinc-100 mb-1">Drop your model here</p>
                      <p className="text-xs text-zinc-500 mb-5">PMX · PMD · ZIP folder</p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-sm font-semibold text-zinc-100 cursor-pointer transition-colors"
                      >
                        Browse files
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pmx,.pmd,.zip,.vmd"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) api.handleCharacterImport(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    <div className="relative rounded-2xl overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-cyan-600/20" />
                      <div className="relative text-center p-5 border border-white/10 rounded-2xl">
                        <p className="text-xs text-zinc-400 mb-3">No model yet?</p>
                        <button
                          type="button"
                          onClick={() => void api.loadDemoCharacter()}
                          className="creator-shimmer-btn inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-fuchsia-500/25 cursor-pointer transition-all"
                        >
                          <Sparkles className="w-4 h-4" />
                          Load Demo Character
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {state.step === 'motion' ? (
                  <div className="space-y-4 creator-step-enter">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                      {MOTION_CATEGORIES.map((cat) => {
                        const grad = CATEGORY_GRADIENT[cat.id];
                        const active = motionCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setMotionCategory(cat.id)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold cursor-pointer transition-all border ${
                              active
                                ? grad
                                  ? `bg-gradient-to-r ${grad} text-white border-transparent shadow-lg`
                                  : 'bg-cyan-500/25 text-cyan-200 border-cyan-500/40'
                                : 'text-zinc-400 border-zinc-700/80 bg-zinc-900/50 hover:border-zinc-600'
                            }`}
                          >
                            {cat.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid gap-3">
                      {motions.map((motion) => {
                        const selected = state.selectedMotionId === motion.id;
                        return (
                          <div
                            key={motion.id}
                            className={`relative rounded-2xl border overflow-hidden creator-card-lift transition-all ${
                              selected
                                ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                : 'border-white/[0.08] bg-white/[0.02] hover:border-cyan-500/30'
                            }`}
                          >
                            {selected ? (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-violet-500 to-cyan-400" />
                            ) : null}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                api.toggleFavorite(motion.id);
                              }}
                              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-black/30 text-zinc-500 hover:text-rose-400 cursor-pointer backdrop-blur-sm"
                              aria-label="Favorite"
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  api.favorites.includes(motion.id) ? 'fill-rose-400 text-rose-400' : ''
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => void api.selectMotion(motion.id)}
                              className="w-full text-left p-4 pr-12 cursor-pointer"
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-bold text-sm text-white">{motion.name}</span>
                                {motion.featured ? (
                                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                                ) : null}
                              </div>
                              <p className="text-[10px] text-zinc-500 mb-2.5 line-clamp-2 leading-relaxed">
                                {motion.description}
                              </p>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[9px] text-zinc-400 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                  {motion.durationSec}s
                                </span>
                                <DifficultyBadge level={motion.difficulty} />
                                <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5 text-cyan-500/80" />
                                  {motion.perfEstimate}
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {motions.length === 0 ? (
                      <p className="text-center text-xs text-zinc-500 py-10">
                        No motions here yet — try <strong className="text-zinc-400">Trending</strong> or{' '}
                        <strong className="text-zinc-400">Dance</strong>.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {state.step === 'style' ? (
                  <div className="grid grid-cols-2 gap-3 creator-step-enter">
                    {VISUAL_STYLE_CARDS.map((card) => {
                      const selected = state.selectedStyleId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => void api.selectStyle(card.id)}
                          className={`group relative rounded-2xl border overflow-hidden text-left cursor-pointer creator-card-lift ${
                            selected
                              ? 'border-cyan-400/60 ring-2 ring-cyan-400/25 shadow-lg shadow-cyan-500/15'
                              : 'border-white/[0.08] hover:border-white/20'
                          }`}
                        >
                          <div className={`h-20 bg-gradient-to-br ${card.swatch} relative`}>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                            {selected ? (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                                <Check className="w-3.5 h-3.5 text-zinc-950" />
                              </div>
                            ) : null}
                          </div>
                          <div className="p-3 bg-white/[0.02]">
                            <p className="font-bold text-sm text-white group-hover:text-cyan-100 transition-colors">
                              {card.label}
                            </p>
                            <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 leading-relaxed">
                              {card.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {state.step === 'export' ? (
                  <div className="space-y-4 creator-step-enter">
                    <GlassSection title="Auto Performance">
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-300">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/50 border border-white/5">
                          {state.deviceClass === 'phone' || state.deviceClass === 'tablet' ? (
                            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {state.deviceClass}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-semibold">
                          {state.qualityMode}
                        </span>
                        <span className="text-zinc-500 self-center">GPU {state.gpuTier}</span>
                      </div>
                    </GlassSection>

                    <GlassSection title="Platform">
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['youtube_shorts', 'Shorts', '9:16 · 60 FPS', 'from-red-500/20 to-rose-600/10'],
                            ['tiktok', 'TikTok', 'Vertical', 'from-cyan-500/15 to-pink-500/15'],
                            ['instagram_reels', 'Reels', 'Vertical', 'from-purple-500/15 to-pink-500/15'],
                            ['youtube', 'YouTube', '16:9 HD', 'from-red-500/15 to-orange-500/10'],
                          ] as const
                        ).map(([id, label, hint, grad]) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => api.setPlatform(id)}
                            className={`text-left px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                              state.selectedPlatform === id
                                ? 'border-cyan-500/50 bg-gradient-to-br shadow-md shadow-cyan-500/10'
                                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                            } ${state.selectedPlatform === id ? grad : ''}`}
                          >
                            <p className="text-xs font-bold text-white">{label}</p>
                            <p className="text-[9px] text-zinc-500 mt-0.5">{hint}</p>
                          </button>
                        ))}
                      </div>
                    </GlassSection>

                    {state.sceneVariations.length > 0 ? (
                      <GlassSection
                        title="Scene Showcase"
                        action={
                          <div className="flex gap-0.5">
                            {([5, 10, 20, 50] as const).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => api.setShowcaseCount(n)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold cursor-pointer ${
                                  state.showcaseCount === n
                                    ? 'bg-cyan-500/25 text-cyan-300'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        }
                      >
                        <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                          {state.sceneVariations.slice(0, 9).map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => void api.selectVariation(v.id)}
                              className={`text-left p-2.5 rounded-xl border cursor-pointer transition-all ${
                                state.selectedVariationId === v.id
                                  ? 'border-amber-500/50 bg-amber-500/10 shadow-md'
                                  : 'border-white/[0.06] hover:border-white/12'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-white">{v.label}</span>
                                <Stars count={v.stars} />
                              </div>
                              <p className="text-[9px] text-zinc-500">
                                {v.cameraPreset} · {Math.round(v.score * 100)}%
                              </p>
                            </button>
                          ))}
                        </div>
                      </GlassSection>
                    ) : null}

                    <GlassSection
                      title="Thumbnail"
                      action={
                        <button
                          type="button"
                          onClick={() => void api.generateThumbnails()}
                          className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          Pick frames
                        </button>
                      }
                    >
                      {state.thumbnails.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {state.thumbnails.map((t) => (
                            <button
                              key={t.frame}
                              type="button"
                              onClick={() => api.selectThumbnail(t.frame)}
                              className={`shrink-0 w-14 h-20 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                                state.selectedThumbnailFrame === t.frame
                                  ? 'border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105'
                                  : 'border-transparent opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={t.dataUrl}
                                alt={`Frame ${t.frame}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-500">Best frames from your timeline — auto-picked on export.</p>
                      )}
                    </GlassSection>

                    {metadata &&
                    onMetadataRegenerate &&
                    onMetadataSelectTitle &&
                    onMetadataSetPlatform &&
                    onMetadataLocaleChange ? (
                      <div className="rounded-2xl border border-white/[0.08] overflow-hidden">
                        <VideoInformationPanel
                          metadata={metadata}
                          onRegenerate={onMetadataRegenerate}
                          onTitleSelect={onMetadataSelectTitle}
                          onPlatformChange={onMetadataSetPlatform}
                          onLocaleChange={onMetadataLocaleChange}
                        />
                      </div>
                    ) : null}

                    {exportProgress && exportProgress.phase !== 'idle' ? (
                      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-violet-500/5 p-5">
                        <div className="flex items-center gap-2 text-sm text-cyan-200 mb-3 font-semibold">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {exportProgress.message || 'Exporting your video…'}
                        </div>
                        <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-300"
                            style={{ width: `${Math.round(exportProgress.progress * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={state.exporting}
                        onClick={() => void api.exportVideo()}
                        className="creator-shimmer-btn w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 hover:from-violet-500 hover:via-fuchsia-400 hover:to-cyan-400 disabled:opacity-50 text-white font-bold text-base shadow-xl shadow-fuchsia-500/25 cursor-pointer transition-all"
                      >
                        {state.exporting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                        Export MP4
                      </button>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>
      ) : null}

      {(state.characterReady || state.step !== 'character') && (
        <CreatorPreviewDock
          isPlaying={isPlaying}
          currentFrame={currentFrame}
          maxFrames={maxFrames}
          cameraKeyCount={cameraKeyCount}
          onTogglePlay={api.togglePlayback}
          onScrub={api.scrubToFrame}
          onEditCamera={api.enterCameraEdit}
          onSaveKeyframe={api.saveCameraKeyframe}
        />
      )}
    </div>
  );
}

export type { CreatorApi };
