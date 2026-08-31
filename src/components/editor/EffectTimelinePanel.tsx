import { useCallback, useMemo, useRef, useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import type { AppState } from '../../types';
import type { SceneDirectorState } from '../../sceneDirector/types';
import type { SceneFxInstance, SceneStudioState } from '../../sceneStudio/types';
import { createSceneFxInstance } from '../../sceneStudio/library';
import { getRegistryEntry, SCENE_EFFECT_REGISTRY } from '../../sceneDirector/effectRegistry';
import {
  defaultEffectWindow,
  normalizeEffectWindow,
} from '../../sceneDirector/effectTimeline';
import {
  ensureEffectWindow,
  patchFxStack,
  removeFxInstance,
  removeEffectKeyframe,
  resizeEffectWindow,
  upsertEffectKeyframe,
} from '../../sceneDirector/effectKeyframes';
import EffectCurveEditorPanel from './EffectCurveEditorPanel';
import { MMD_FPS } from '../../utils/playhead';

const FRAME_W = 20;
const ROW_H = 28;

const CATEGORY_COLORS: Record<string, string> = {
  weather: 'from-sky-500/70 to-sky-400/30 border-sky-400/40',
  character: 'from-pink-500/70 to-pink-400/30 border-pink-400/40',
  magic: 'from-violet-500/70 to-violet-400/30 border-violet-400/40',
  particles: 'from-amber-500/70 to-amber-400/30 border-amber-400/40',
  cinematic: 'from-orange-500/70 to-orange-400/30 border-orange-400/40',
  energy: 'from-cyan-500/70 to-cyan-400/30 border-cyan-400/40',
  anime: 'from-fuchsia-500/70 to-fuchsia-400/30 border-fuchsia-400/40',
  environment: 'from-emerald-500/70 to-emerald-400/30 border-emerald-400/40',
  audio: 'from-indigo-500/70 to-indigo-400/30 border-indigo-400/40',
};

interface EffectTimelinePanelProps {
  appState: AppState;
  setCurrentFrame: (frame: number) => void;
  onPatchSceneStudio: (patch: Partial<SceneStudioState>) => void;
  onPatchSceneDirector?: (patch: Partial<SceneDirectorState>) => void;
}

type DragState = {
  mode: 'move' | 'start' | 'end';
  fxId: string;
  pointerFrame: number;
  baseWindow: ReturnType<typeof normalizeEffectWindow>;
} | null;

export default function EffectTimelinePanel({
  appState,
  setCurrentFrame,
  onPatchSceneStudio,
  onPatchSceneDirector,
}: EffectTimelinePanelProps) {
  const [view, setView] = useState<'timeline' | 'curves'>('timeline');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [addOpen, setAddOpen] = useState(false);

  const maxFrames = appState.maxFrames;
  const currentFrame = appState.currentFrame;
  const fxStack = appState.sceneStudio?.fxStack ?? [];
  const selectedId = appState.sceneDirector?.selectedEffectInstanceId ?? null;
  const selectedFx = fxStack.find((fx) => fx.id === selectedId) ?? null;
  const music = appState.sceneDirector?.music;
  const width = Math.max(maxFrames * FRAME_W, 480);

  const sortedStack = useMemo(
    () => [...fxStack].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [fxStack]
  );

  const patchStack = useCallback(
    (next: SceneFxInstance[]) => {
      onPatchSceneStudio({ fxStack: next });
    },
    [onPatchSceneStudio]
  );

  const selectFx = useCallback(
    (id: string | null) => {
      onPatchSceneDirector?.({ selectedEffectInstanceId: id });
    },
    [onPatchSceneDirector]
  );

  const frameFromClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - 120;
      return Math.max(0, Math.min(maxFrames, Math.round(x / FRAME_W)));
    },
    [maxFrames]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const frame = frameFromClientX(e.clientX);
      const fx = fxStack.find((item) => item.id === drag.fxId);
      if (!fx) return;

      if (drag.mode === 'move') {
        const span = drag.baseWindow.endFrame - drag.baseWindow.startFrame;
        const delta = frame - drag.pointerFrame;
        let startFrame = drag.baseWindow.startFrame + delta;
        startFrame = Math.max(0, Math.min(startFrame, maxFrames - span));
        patchStack(
          patchFxStack(fxStack, drag.fxId, {
            window: { ...drag.baseWindow, startFrame, endFrame: startFrame + span },
          })
        );
        return;
      }

      const resized =
        drag.mode === 'start'
          ? resizeEffectWindow(fx, 'start', frame, maxFrames)
          : resizeEffectWindow(fx, 'end', frame, maxFrames);
      patchStack(patchFxStack(fxStack, drag.fxId, { window: resized.window }));
    },
    [drag, frameFromClientX, fxStack, maxFrames, patchStack]
  );

  const beginDrag = (
    e: React.PointerEvent,
    mode: 'move' | 'start' | 'end',
    fx: SceneFxInstance
  ) => {
    e.stopPropagation();
    const window = normalizeEffectWindow(ensureEffectWindow(fx, maxFrames).window, maxFrames);
    setDrag({
      mode,
      fxId: fx.id,
      pointerFrame: frameFromClientX(e.clientX),
      baseWindow: window,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerUp = useCallback(() => setDrag(null), []);

  const addEffect = (effectId: string) => {
    const instance = createSceneFxInstance(
      effectId,
      {
        order: fxStack.length,
        window: defaultEffectWindow(maxFrames),
        targetModelId: appState.selectedObjectId,
      },
      maxFrames
    );
    patchStack([...fxStack, instance]);
    selectFx(instance.id);
    setAddOpen(false);
  };

  const intensityKeys = selectedFx?.keyframes?.filter((k) => k.parameterId === 'intensity') ?? [];

  if (view === 'curves') {
    return (
      <div className="flex h-full min-h-[160px] flex-col bg-[#0e1014]">
        <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1 shrink-0">
          <button
            type="button"
            onClick={() => setView('timeline')}
            className="rounded px-2 py-0.5 text-[9px] font-bold text-zinc-500 cursor-pointer hover:text-zinc-200"
          >
            Timeline
          </button>
          <span className="rounded bg-pink-500/15 px-2 py-0.5 text-[9px] font-bold text-pink-200">
            Curves
          </span>
        </div>
        <EffectCurveEditorPanel
          appState={appState}
          setCurrentFrame={setCurrentFrame}
          onPatchSceneStudio={onPatchSceneStudio}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[160px] bg-[#0e1014]">
      <div className="flex items-center gap-2 px-2 py-1 border-b border-zinc-800 shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-pink-300" />
        <span className="text-[9px] font-bold uppercase text-zinc-400">Effect timeline</span>
        <button
          type="button"
          onClick={() => setView('curves')}
          className="rounded px-2 py-0.5 text-[9px] font-bold text-zinc-500 cursor-pointer hover:text-pink-200"
        >
          Curves
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300 cursor-pointer hover:border-cyan-500/40"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
          {addOpen ? (
            <div className="absolute right-0 top-full z-30 mt-1 max-h-48 w-52 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 shadow-lg">
              {SCENE_EFFECT_REGISTRY.slice(0, 14).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => addEffect(entry.id)}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[9px] text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  <span>{entry.thumbnail}</span>
                  {entry.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedFx ? (
          <>
            <button
              type="button"
              title="Keyframe intensity at playhead"
              onClick={() => {
                const withWindow = ensureEffectWindow(selectedFx, maxFrames);
                let next = upsertEffectKeyframe(
                  withWindow,
                  currentFrame,
                  'intensity',
                  selectedFx.intensity
                );
                const keyframes = (next.keyframes ?? []).map((k) =>
                  k.frame === currentFrame && k.parameterId === 'intensity'
                    ? { ...k, interpolation: 'bezier' as const, easeOut: 0.33, easeIn: 0.33 }
                    : k
                );
                patchStack(patchFxStack(fxStack, selectedFx.id, { ...next, keyframes }));
              }}
              className="text-[9px] font-bold text-cyan-400 cursor-pointer"
            >
              ◆ Key
            </button>
            <button
              type="button"
              title="Remove selected effect"
              onClick={() => {
                patchStack(removeFxInstance(fxStack, selectedFx.id));
                selectFx(null);
              }}
              className="text-zinc-500 hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : null}
      </div>

      {selectedFx ? (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 border-b border-zinc-800/80 text-[9px] text-zinc-500 shrink-0">
          <span className="text-zinc-300 font-medium">{selectedFx.name}</span>
          <label className="flex items-center gap-1">
            Start
            <input
              type="number"
              min={0}
              max={maxFrames}
              value={normalizeEffectWindow(selectedFx.window, maxFrames).startFrame}
              onChange={(e) =>
                patchStack(
                  patchFxStack(fxStack, selectedFx.id, {
                    window: normalizeEffectWindow(
                      {
                        ...selectedFx.window,
                        startFrame: Number(e.target.value) || 0,
                      },
                      maxFrames
                    ),
                  })
                )
              }
              className="w-12 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[9px]"
            />
          </label>
          <label className="flex items-center gap-1">
            End
            <input
              type="number"
              min={0}
              max={maxFrames}
              value={normalizeEffectWindow(selectedFx.window, maxFrames).endFrame}
              onChange={(e) =>
                patchStack(
                  patchFxStack(fxStack, selectedFx.id, {
                    window: normalizeEffectWindow(
                      {
                        ...selectedFx.window,
                        endFrame: Number(e.target.value) || maxFrames,
                      },
                      maxFrames
                    ),
                  })
                )
              }
              className="w-12 rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[9px]"
            />
          </label>
          <label className="flex items-center gap-1">
            Int
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={selectedFx.intensity}
              onChange={(e) =>
                patchStack(
                  patchFxStack(fxStack, selectedFx.id, {
                    intensity: Number(e.target.value),
                  })
                )
              }
              className="w-16 accent-pink-400"
            />
          </label>
          {intensityKeys.length ? (
            <span className="text-zinc-600">{intensityKeys.length} intensity keys</span>
          ) : null}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto min-h-0"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex min-w-max" style={{ width: width + 120 }}>
          <div className="w-[120px] shrink-0 border-r border-zinc-800 bg-[#121418]">
            {music?.enabled && music.markers.length ? (
              <div
                className="flex items-center px-2 text-[9px] text-indigo-300 border-b border-zinc-850"
                style={{ height: ROW_H }}
              >
                Music
              </div>
            ) : null}
            {sortedStack.length ? (
              sortedStack.map((fx) => (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() => selectFx(fx.id)}
                  className={`w-full text-left px-2 truncate border-b border-zinc-850 text-[9px] cursor-pointer ${
                    selectedId === fx.id
                      ? 'bg-pink-500/10 text-pink-200'
                      : 'text-zinc-400 hover:bg-zinc-800/40'
                  } ${!fx.enabled || fx.runtimeError ? 'opacity-50' : ''}`}
                  style={{ height: ROW_H }}
                  title={fx.runtimeError?.message}
                >
                  {getRegistryEntry(fx.effectId)?.thumbnail ?? '✦'} {fx.name}
                </button>
              ))
            ) : (
              <div className="px-2 py-3 text-[9px] text-zinc-600">No effects — Add or use Scene tab</div>
            )}
          </div>

          <div className="relative flex-1" style={{ width }}>
            <div
              className="sticky top-0 z-10 h-6 border-b border-zinc-850 bg-[#16181d] flex relative"
              onClick={(e) => setCurrentFrame(frameFromClientX(e.clientX))}
            >
              {Array.from({ length: Math.min(maxFrames + 1, 300) }, (_, frame) =>
                frame % 10 === 0 ? (
                  <div
                    key={frame}
                    className="absolute text-[8px] font-mono text-zinc-500"
                    style={{ left: frame * FRAME_W }}
                  >
                    {frame}
                  </div>
                ) : null
              )}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none"
                style={{ left: currentFrame * FRAME_W + FRAME_W / 2 }}
              />
            </div>

            {music?.enabled && music.markers.length ? (
              <div className="relative border-b border-indigo-900/30 bg-indigo-950/20" style={{ height: ROW_H }}>
                {music.markers.map((marker) => {
                  const frame = Math.round(marker.timeSec * MMD_FPS);
                  return (
                    <div
                      key={marker.id}
                      className="absolute top-1 bottom-1 w-0.5 bg-indigo-400/80"
                      style={{ left: frame * FRAME_W + FRAME_W / 2 }}
                      title={marker.label}
                    />
                  );
                })}
              </div>
            ) : null}

            {sortedStack.map((fx) => {
              const window = normalizeEffectWindow(
                ensureEffectWindow(fx, maxFrames).window,
                maxFrames
              );
              const left = window.startFrame * FRAME_W;
              const barWidth = Math.max(FRAME_W, (window.endFrame - window.startFrame) * FRAME_W);
              const color =
                CATEGORY_COLORS[fx.category] ??
                'from-zinc-500/60 to-zinc-400/20 border-zinc-500/40';

              return (
                <div
                  key={fx.id}
                  className="relative border-b border-zinc-850/80"
                  style={{ height: ROW_H }}
                  onClick={() => selectFx(fx.id)}
                >
                  <div
                    className={`absolute top-1 bottom-1 rounded-sm bg-gradient-to-r border flex items-center px-1 ${color} ${
                      selectedId === fx.id ? 'ring-1 ring-pink-400/60' : ''
                    } ${!fx.enabled ? 'opacity-40' : ''}`}
                    style={{ left, width: barWidth }}
                  >
                    <span
                      className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 rounded-l-sm z-10"
                      onPointerDown={(e) => beginDrag(e, 'start', fx)}
                    />
                    <span className="truncate text-[8px] font-bold text-white/90 pointer-events-none flex-1 px-2">
                      {fx.name}
                    </span>
                    <span
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20 rounded-r-sm z-10"
                      onPointerDown={(e) => beginDrag(e, 'end', fx)}
                    />
                    <span
                      className="absolute inset-x-2 inset-y-0 cursor-grab z-[5]"
                      onPointerDown={(e) => beginDrag(e, 'move', fx)}
                    />
                  </div>
                  {(fx.keyframes ?? [])
                    .filter((k) => k.parameterId === 'intensity')
                    .map((k) => (
                      <button
                        key={`${k.frame}-${k.parameterId}`}
                        type="button"
                        className="absolute z-10 w-2 h-2 rotate-45 bg-cyan-400 border border-zinc-900 cursor-pointer"
                        style={{
                          left: k.frame * FRAME_W + FRAME_W / 2 - 4,
                          top: ROW_H / 2 - 4,
                        }}
                        title={`Intensity ${k.value.toFixed(2)} @ f${k.frame}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectFx(fx.id);
                          setCurrentFrame(k.frame);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          patchStack(
                            patchFxStack(
                              fxStack,
                              fx.id,
                              removeEffectKeyframe(fx, k.frame, k.parameterId)
                            )
                          );
                        }}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
