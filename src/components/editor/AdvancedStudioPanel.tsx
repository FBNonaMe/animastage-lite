import { useState, useRef } from 'react';
import {
  Users,
  Sparkles,
  Video,
  Layers,
  Loader2,
  Radio,
  Wand2,
} from 'lucide-react';
import type { AnimationLayerDef, MMDModel, TimelineKeyframe } from '../../types';
import type { CollabMode } from '../../collab/collabSync';
import { createDefaultLayers } from '../../editor/animationLayers';
import { extractMocapFromVideo, type MocapProgress } from '../../mocap/videoMocap';
import MotionCaptureStudio from '../../mocap/MotionCaptureStudio';
import {
  generateTimelineFromMotionPrompt,
  refineKeyframesLocal,
  refineMotionFromPrompt,
  retargetKeyframes,
  infillKeyframes,
  hasMotionAi,
} from '../../ai/motionAi';
import { OFFLINE_MOTION_PRESETS } from '../../ai/motionSpecPresets';
import OpenRouterSettingsPanel from '../ai/OpenRouterSettingsPanel';
import { hasOpenRouterApiKey } from '../../ai/openrouter';

interface AdvancedStudioPanelProps {
  selectedModel: MMDModel | undefined;
  maxFrames: number;
  collabConnected: boolean;
  collabRoom: string;
  collabPeers: number;
  collabStatus?: string;
  onCollabJoin: (room: string, mode: CollabMode) => void;
  onCollabLeave: () => void;
  onApplyKeyframes: (keyframes: TimelineKeyframe[], mode: 'merge' | 'replace') => void;
  onUpdateLayers: (layers: AnimationLayerDef[]) => void;
  onToggleGroupSolo: (groupId: string) => void;
  onToggleGroupMute: (groupId: string) => void;
  onSaveMocapToLibrary?: (payload: {
    name: string;
    keyframes: TimelineKeyframe[];
    durationSec: number;
    fps: number;
    tags: string[];
    author: string;
  }) => void;
}

export default function AdvancedStudioPanel({
  selectedModel,
  maxFrames,
  collabConnected,
  collabRoom,
  collabPeers,
  collabStatus = '',
  onCollabJoin,
  onCollabLeave,
  onApplyKeyframes,
  onUpdateLayers,
  onToggleGroupSolo,
  onToggleGroupMute,
  onSaveMocapToLibrary,
}: AdvancedStudioPanelProps) {
  const [roomInput, setRoomInput] = useState('animastage-room');
  const [aiPrompt, setAiPrompt] = useState('wave hello');
  const [selfReview, setSelfReview] = useState(false);
  const [mocapProgress, setMocapProgress] = useState<MocapProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);

  const layers = selectedModel?.animLayers ?? [];
  const cloudReady = hasMotionAi() || hasOpenRouterApiKey();

  const handleMocap = async (file: File) => {
    setBusy(true);
    try {
      const keys = await extractMocapFromVideo(file, setMocapProgress);
      onApplyKeyframes(keys, 'merge');
      setStatus(`Mocap: +${keys.length} keys`);
    } catch (e) {
      setStatus((e as Error).message);
      setMocapProgress({ phase: 'error', progress: 0, message: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleAiGenerate = async () => {
    setBusy(true);
    setStatus(selfReview ? 'Generating + self-review…' : 'Generating…');
    try {
      const result = await generateTimelineFromMotionPrompt(aiPrompt, maxFrames, {
        refine: selfReview,
        onProgress: setStatus,
      });
      onApplyKeyframes(result.keyframes, 'replace');
      setStatus(
        `${result.spec.name} · ${result.keyframes.length} keys · ${result.spec.duration.toFixed(1)}s · ${result.source}${result.refined ? ' +review' : ''}`
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAiInfill = async () => {
    if (!selectedModel || !hasMotionAi()) return;
    setBusy(true);
    try {
      const start = Math.max(0, selectedModel.keyframes.length ? 10 : 0);
      const end = Math.min(maxFrames, start + 30);
      const keys = await infillKeyframes(selectedModel.keyframes, start, end, aiPrompt);
      onApplyKeyframes(keys, 'merge');
      setStatus(`Infill ${start}-${end}: ${keys.length} keys`);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRetarget = () => {
    if (!selectedModel?.keyframes.length) return;
    const keys = retargetKeyframes(selectedModel.keyframes, 1.25);
    onApplyKeyframes(keys, 'replace');
    setStatus('Retarget ×1.25');
  };

  const handleQuickRefine = (style: 'smoother' | 'energetic') => {
    if (!selectedModel?.keyframes.length) {
      setStatus('Add or import motion keys first');
      return;
    }
    const keys = refineKeyframesLocal(selectedModel.keyframes, style);
    onApplyKeyframes(keys, 'replace');
    setStatus(
      style === 'smoother'
        ? `Refined: smoother motion (${keys.length} keys)`
        : `Refined: more energetic (${keys.length} keys)`
    );
  };

  const handlePromptRefine = async () => {
    if (!selectedModel?.keyframes.length) {
      setStatus('Add or import motion keys first');
      return;
    }
    setBusy(true);
    try {
      const result = await refineMotionFromPrompt(
        selectedModel.keyframes,
        aiPrompt,
        maxFrames
      );
      onApplyKeyframes(result.keyframes, 'replace');
      setStatus(
        `Refined (${result.source === 'ai' ? 'AI' : 'offline'}): ${result.keyframes.length} keys`
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addLayer = () => {
    if (!selectedModel) return;
    const next = [
      ...layers,
      {
        id: `layer_${Date.now()}`,
        name: `Layer ${layers.length + 1}`,
        weight: 0.5,
        keyframes: [],
        muted: false,
        boneMask: null,
      },
    ];
    onUpdateLayers(next);
  };

  if (!selectedModel) {
    return (
      <p className="text-[10px] text-zinc-500 p-2">Select a model for Mocap / AI / Collab</p>
    );
  }

  return (
    <div className="space-y-3 p-1 max-h-[420px] overflow-y-auto">
      {/* Layers */}
      <section className="border border-amber-500/25 rounded-md p-2 bg-amber-950/10">
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-200 mb-2">
          <Layers className="w-3 h-3" />
          Animation layers
        </div>
        {layers.length === 0 ? (
          <button
            type="button"
            onClick={() =>
              onUpdateLayers(createDefaultLayers(selectedModel.keyframes))
            }
            className="text-[9px] font-bold text-amber-300 border border-amber-500/40 px-2 py-1 rounded cursor-pointer"
          >
            Initialize layers
          </button>
        ) : (
          <div className="space-y-2">
            {layers.map((layer) => (
              <div key={layer.id} className="bg-zinc-900/80 rounded p-1.5 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-zinc-300">{layer.name}</span>
                  <label className="flex items-center gap-1 text-[8px] text-zinc-500">
                    <input
                      type="checkbox"
                      checked={layer.muted}
                      onChange={() =>
                        onUpdateLayers(
                          layers.map((l) =>
                            l.id === layer.id ? { ...l, muted: !l.muted } : l
                          )
                        )
                      }
                    />
                    mute
                  </label>
                </div>
                <label className="block text-[8px] text-zinc-500">
                  Weight {(layer.weight * 100).toFixed(0)}%
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.weight}
                    className="w-full accent-amber-400"
                    onChange={(e) =>
                      onUpdateLayers(
                        layers.map((l) =>
                          l.id === layer.id
                            ? { ...l, weight: parseFloat(e.target.value) }
                            : l
                        )
                      )
                    }
                  />
                </label>
                <span className="text-[8px] text-zinc-600 font-mono">
                  {layer.keyframes.length} keys
                  {layer.boneMask?.length ? ` · mask ${layer.boneMask.length}` : ''}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={addLayer}
              className="text-[9px] text-amber-300 cursor-pointer"
            >
              + layer
            </button>
          </div>
        )}
        {selectedModel.boneGroups && selectedModel.boneGroups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedModel.boneGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onToggleGroupSolo(g.id)}
                className={`text-[8px] px-1 rounded border cursor-pointer ${
                  g.solo ? 'border-amber-400 text-amber-300' : 'border-zinc-700 text-zinc-500'
                }`}
              >
                solo {g.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Motion Capture Studio 2.0 (WHAM + Landmark + Auto) */}
      <MotionCaptureStudio
        maxFrames={maxFrames}
        disabled={busy}
        onApplyKeyframes={onApplyKeyframes}
        onSaveToLibrary={onSaveMocapToLibrary}
        onStatus={setStatus}
      />

      {/* Legacy file picker kept for quick access */}
      <section className="border border-cyan-500/15 rounded-md p-2 bg-cyan-950/5">
        <div className="flex items-center gap-1 text-[9px] font-bold text-cyan-200/70 mb-1.5">
          <Video className="w-3 h-3" />
          Quick mocap (engine auto)
        </div>
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleMocap(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => videoInputRef.current?.click()}
          className="w-full py-1.5 text-[9px] font-bold rounded border border-cyan-500/30 text-cyan-200/80 cursor-pointer disabled:opacity-50"
        >
          {busy && mocapProgress?.phase === 'processing' ? (
            <span className="flex items-center justify-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {mocapProgress.message}
            </span>
          ) : (
            'Upload video…'
          )}
        </button>
      </section>

      {/* OpenRouter AI gateway */}
      <OpenRouterSettingsPanel compact onStatus={setStatus} />

      {/* AI motion */}
      <section className="border border-violet-500/25 rounded-md p-2 bg-violet-950/10">
        <div className="flex items-center gap-1 text-[10px] font-bold text-violet-200 mb-2">
          <Sparkles className="w-3 h-3" />
          Text → motion {cloudReady ? '(OpenRouter)' : '(offline presets)'}
        </div>
        <p className="text-[8px] text-zinc-600 mb-2 m-0">
          {cloudReady
            ? 'Custom prompts use your OpenRouter model; chips below are offline.'
            : 'No key needed for preset chips below.'}
        </p>
        <div className="flex flex-wrap gap-1 mb-2 max-h-24 overflow-y-auto">
          {OFFLINE_MOTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={busy}
              title={preset.prompt}
              onClick={() => {
                setAiPrompt(preset.prompt);
                void (async () => {
                  setBusy(true);
                  setStatus(`Offline · ${preset.label}…`);
                  try {
                    const result = await generateTimelineFromMotionPrompt(
                      preset.prompt,
                      maxFrames,
                      { refine: false, onProgress: setStatus }
                    );
                    onApplyKeyframes(result.keyframes, 'replace');
                    setStatus(
                      `${result.spec.name} · ${result.keyframes.length} keys · offline`
                    );
                  } catch (e) {
                    setStatus((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              className="px-1.5 py-0.5 text-[8px] font-semibold rounded border border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-violet-500/50 hover:text-violet-100 cursor-pointer disabled:opacity-40"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <input
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          className="w-full text-[10px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 mb-2 text-zinc-200"
          placeholder='e.g. "wave hello" / "clap" / "victory pose"'
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void handleAiGenerate();
            }
          }}
        />
        <label className="flex items-center gap-1.5 text-[8px] text-zinc-400 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selfReview}
            onChange={(e) => setSelfReview(e.target.checked)}
            className="accent-violet-400"
          />
          Self-review pass (2× API — keep off on free models)
        </label>
        <div className="grid grid-cols-2 gap-1 mb-1.5">
          <button
            type="button"
            disabled={busy || selectedModel.keyframes.length === 0}
            onClick={() => handleQuickRefine('smoother')}
            title="Smooth jitter and soften transitions. Works offline."
            className="py-1.5 text-[9px] font-bold rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 cursor-pointer disabled:opacity-40"
          >
            Smoother
          </button>
          <button
            type="button"
            disabled={busy || selectedModel.keyframes.length === 0}
            onClick={() => handleQuickRefine('energetic')}
            title="Increase pose amplitude and add punch. Works offline."
            className="py-1.5 text-[9px] font-bold rounded border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 cursor-pointer disabled:opacity-40"
          >
            Energetic
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAiGenerate()}
            className="w-full py-1.5 text-[9px] font-bold rounded border border-violet-500/50 bg-violet-500/20 text-violet-100 cursor-pointer disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3 inline mr-1" />
            )}
            Generate &amp; apply
          </button>
          <button
            type="button"
            disabled={busy || selectedModel.keyframes.length === 0}
            onClick={() => void handlePromptRefine()}
            className="flex-1 py-1 text-[9px] font-bold rounded border border-violet-500/40 text-violet-200 cursor-pointer disabled:opacity-40"
          >
            Refine existing
          </button>
          <button
            type="button"
            disabled={busy || !cloudReady}
            onClick={() => void handleAiInfill()}
            className="flex-1 py-1 text-[9px] font-bold rounded border border-zinc-600 text-zinc-300 cursor-pointer disabled:opacity-40"
          >
            Infill
          </button>
          <button
            type="button"
            onClick={handleRetarget}
            className="flex-1 py-1 text-[9px] font-bold rounded border border-zinc-600 text-zinc-300 cursor-pointer"
          >
            Retarget ×1.25
          </button>
        </div>
        <p className="text-[8px] text-zinc-600 mt-1.5 leading-relaxed">
          Pipeline: offline presets (chips) or OpenRouter for custom text. Ctrl+Enter.
          Replaces current keys.
        </p>
      </section>

      {/* Collab */}
      <section className="border border-emerald-500/25 rounded-md p-2 bg-emerald-950/10">
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-200 mb-2">
          <Users className="w-3 h-3" />
          Collaboration
        </div>
        <p className="text-[8px] text-zinc-500 mb-2 leading-relaxed">
          Local — tabs in this browser (no WebSocket). WebRTC — other devices
          (requires signaling; see VITE_COLLAB_SIGNALING).
        </p>
        {!collabConnected ? (
          <div className="space-y-1.5">
            <input
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              className="w-full text-[10px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onCollabJoin(roomInput, 'local')}
                className="flex-1 px-2 py-1 text-[9px] font-bold rounded bg-emerald-600 text-white cursor-pointer"
              >
                Local
              </button>
              <button
                type="button"
                onClick={() => onCollabJoin(roomInput, 'webrtc')}
                className="flex-1 px-2 py-1 text-[9px] font-bold rounded border border-emerald-500/50 text-emerald-200 cursor-pointer"
              >
                WebRTC
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-emerald-300 flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse" />
                {collabRoom} · {collabPeers}
              </span>
              <button
                type="button"
                onClick={onCollabLeave}
                className="text-[9px] text-red-400 cursor-pointer"
              >
                Leave
              </button>
            </div>
            {collabStatus && (
              <p className="text-[8px] text-zinc-500">{collabStatus}</p>
            )}
          </div>
        )}
      </section>

      {status && (
        <p className="text-[9px] text-zinc-400 font-mono border-t border-zinc-800 pt-2">{status}</p>
      )}
    </div>
  );
}
