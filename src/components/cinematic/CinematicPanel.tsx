import { Clapperboard, Film, Sparkles, Sun, Zap } from 'lucide-react';
import {
  CINEMATIC_LIGHTING_LABELS,
  type CinematicCameraMode,
  type CinematicEngineApi,
  type CinematicLightingPresetId,
} from '../../product/cinematic';

const CAMERA_MODES: { id: CinematicCameraMode; label: string }[] = [
  { id: 'showcase', label: 'Showcase' },
  { id: 'hero', label: 'Hero' },
  { id: 'dance', label: 'Dance' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'drone', label: 'Drone' },
  { id: 'close_up', label: 'Close-Up' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'face', label: 'Face' },
  { id: 'dynamic', label: 'Dynamic' },
];

const LIGHTING_IDS = Object.keys(CINEMATIC_LIGHTING_LABELS) as CinematicLightingPresetId[];

interface CinematicPanelProps {
  api: CinematicEngineApi;
  compact?: boolean;
}

export default function CinematicPanel({ api, compact = false }: CinematicPanelProps) {
  const state = api.getState();
  const score = state.lastVisualScore;

  return (
    <div
      className={`rounded-2xl border border-violet-500/25 bg-[#0c0e14]/92 backdrop-blur-xl shadow-xl ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center">
          <Film className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Cinematic Engine</p>
          <p className="text-[9px] text-zinc-500">Anime-quality camera & lighting</p>
        </div>
        {score != null ? (
          <span className="ml-auto text-[10px] font-bold text-cyan-400 tabular-nums">
            {Math.round(score * 100)}%
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
            <Clapperboard className="w-3 h-3" /> Camera
          </p>
          <div className="flex flex-wrap gap-1">
            {CAMERA_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => api.setCameraMode(m.id)}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border transition-colors ${
                  state.cameraMode === m.id
                    ? 'bg-violet-500/25 border-violet-400/40 text-violet-200'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
            <Sun className="w-3 h-3" /> Lighting
          </p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {LIGHTING_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => api.applyLighting(id)}
                className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border transition-colors ${
                  state.lightingPreset === id
                    ? 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                    : 'border-zinc-700/80 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {CINEMATIC_LIGHTING_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Toggle
            label="Handheld"
            on={state.handheld}
            onChange={(v) => api.patchEngine({ handheld: v, enabled: true })}
          />
          <Toggle
            label="Collision"
            on={state.collisionAvoidance}
            onChange={(v) => api.patchEngine({ collisionAvoidance: v, enabled: true })}
          />
          <Toggle
            label="Adaptive FX"
            on={state.adaptiveEffects}
            onChange={(v) => api.patchEngine({ adaptiveEffects: v, enabled: true })}
          />
        </div>

        <button
          type="button"
          onClick={() => api.analyzeQuality()}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/20 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Analyze Visual Quality
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer ${
        on
          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
          : 'border-zinc-700 text-zinc-500'
      }`}
    >
      <Zap className="w-2.5 h-2.5" />
      {label}
    </button>
  );
}
