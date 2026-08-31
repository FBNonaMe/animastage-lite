import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Cpu, Plus, Sparkles, Sun, WandSparkles, Zap } from 'lucide-react';
import {
  BUILTIN_SCENE_FX,
  SCENE_MOOD_PRESETS,
  createSceneFxInstance,
  detectSceneFxCapabilities,
  type SceneFxCapabilities,
  type SceneMoodPresetId,
  type SceneStudioState,
  type SmartSceneCharacterFx,
  type SmartSceneOptions,
} from '../../sceneStudio';
import { defaultEffectWindow } from '../../sceneDirector/effectTimeline';
import { FX_BONE_CHOICES } from '../../sceneStudio/runtime/boneSampler';
import type { DynamicSkyState } from '../../dynamicSky';
import type { ViewportFormat } from '../../types';
import type { ShotPresetId } from '../../shotComposer/types';

interface SceneStudioPanelProps {
  state: SceneStudioState;
  dynamicSky: DynamicSkyState;
  onPatch: (patch: Partial<SceneStudioState>) => void;
  onApplyMood: (id: SceneMoodPresetId) => void;
  onPatchDynamicSky: (patch: Partial<DynamicSkyState>) => void;
  onSmartScene?: (options: SmartSceneOptions) => void;
  maxFrames?: number;
}

const modeClass =
  'px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wide border cursor-pointer';

const SMART_ASPECTS: ViewportFormat[] = ['9:16', '16:9', '1:1', '4:5', '21:9'];
const SMART_SHOTS: ShotPresetId[] = ['full_body', 'medium', 'close_up', 'portrait'];
const CHARACTER_FX_CHIPS: { id: SmartSceneCharacterFx; label: string }[] = [
  { id: 'aura', label: 'Aura' },
  { id: 'magic_circle', label: 'Circle' },
  { id: 'trail', label: 'Trail' },
];

export default function SceneStudioPanel({
  state,
  dynamicSky,
  onPatch,
  onApplyMood,
  onPatchDynamicSky,
  onSmartScene,
  maxFrames = 120,
}: SceneStudioPanelProps) {
  const [capabilities, setCapabilities] = useState<SceneFxCapabilities | null>(null);
  const [smartAspect, setSmartAspect] = useState<ViewportFormat>('16:9');
  const [smartShot, setSmartShot] = useState<ShotPresetId>('full_body');
  const [smartFx, setSmartFx] = useState<SmartSceneCharacterFx[]>([]);
  const [smartBone, setSmartBone] = useState<string>('right_hand');

  const addableFx = useMemo(
    () => BUILTIN_SCENE_FX.filter((fx) => fx.mount !== 'post'),
    []
  );

  useEffect(() => {
    let cancelled = false;
    void detectSceneFxCapabilities(state.backendPreference).then((next) => {
      if (!cancelled) setCapabilities(next);
    });
    return () => {
      cancelled = true;
    };
  }, [state.backendPreference]);

  return (
    <div className="p-2 space-y-2 text-[10px] text-zinc-300">
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-bold text-cyan-100">Scene Studio 2.0</p>
            <p className="text-[9px] text-zinc-500">Environment → Mood → Shot → Render</p>
          </div>
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[8px] uppercase text-zinc-400">
            {capabilities?.backend ?? 'detecting'}
          </span>
        </div>
      </div>

      <div className="flex gap-1">
        {(['basic', 'advanced', 'pro'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onPatch({ uiMode: mode })}
            className={`${modeClass} ${
              state.uiMode === mode
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-zinc-800 text-zinc-500'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {onSmartScene ? (
        <section className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-2 space-y-2">
          <p className="flex items-center gap-1 font-bold text-violet-100">
            <Zap className="h-3 w-3 text-violet-300" />
            Smart Scene
          </p>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={smartAspect}
              onChange={(event) => setSmartAspect(event.target.value as ViewportFormat)}
              className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[10px]"
            >
              {SMART_ASPECTS.map((aspect) => (
                <option key={aspect} value={aspect}>
                  {aspect}
                </option>
              ))}
            </select>
            <select
              value={smartShot}
              onChange={(event) => setSmartShot(event.target.value as ShotPresetId)}
              className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[10px]"
            >
              {SMART_SHOTS.map((shot) => (
                <option key={shot} value={shot}>
                  {shot.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {CHARACTER_FX_CHIPS.map((chip) => {
              const active = smartFx.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    setSmartFx((prev) =>
                      prev.includes(chip.id)
                        ? prev.filter((id) => id !== chip.id)
                        : [...prev, chip.id]
                    )
                  }
                  className={`rounded border px-1.5 py-0.5 text-[9px] cursor-pointer ${
                    active
                      ? 'border-pink-500/50 bg-pink-500/15 text-pink-100'
                      : 'border-zinc-800 text-zinc-500'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
            {smartFx.includes('trail') ? (
              <select
                value={smartBone}
                onChange={(event) => setSmartBone(event.target.value)}
                className="rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[9px]"
              >
                {FX_BONE_CHOICES.map((bone) => (
                  <option key={bone.id} value={bone.id}>
                    {bone.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              onSmartScene({
                mood: state.activeMoodPresetId ?? 'cinematic',
                aspectRatio: smartAspect,
                shotPreset: smartShot,
                characterFx: smartFx,
                targetBone: smartBone,
              })
            }
            className="w-full rounded bg-violet-500/20 border border-violet-500/40 px-2 py-1.5 text-[10px] font-bold text-violet-100 hover:bg-violet-500/30 cursor-pointer"
          >
            Build scene · {state.activeMoodPresetId ?? 'cinematic'}
          </button>
        </section>
      ) : null}

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
        <p className="mb-2 flex items-center gap-1 font-bold text-zinc-200">
          <WandSparkles className="h-3 w-3 text-violet-300" />
          Mood presets
        </p>
        <div className="grid grid-cols-2 gap-1">
          {SCENE_MOOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => onApplyMood(preset.id)}
              className={`rounded border px-2 py-1.5 text-left cursor-pointer ${
                state.activeMoodPresetId === preset.id
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="block text-[9px] font-bold">{preset.name}</span>
              <span className="block truncate text-[8px] text-zinc-600">
                {preset.timeHours}:00 · {preset.weather.weather}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 space-y-2">
        <p className="flex items-center gap-1 font-bold text-zinc-200">
          <Sun className="h-3 w-3 text-amber-300" />
          Time & weather
        </p>
        <label className="block">
          <span className="flex justify-between text-zinc-500">
            Time of day <b className="text-zinc-300">{dynamicSky.timeHours.toFixed(1)}h</b>
          </span>
          <input
            type="range"
            min={0}
            max={24}
            step={0.1}
            value={dynamicSky.timeHours}
            onChange={(event) =>
              onPatchDynamicSky({ timeHours: Number(event.target.value), presetId: null })
            }
            className="w-full accent-amber-400"
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1 text-zinc-500">
            <CloudRain className="h-3 w-3" />
            Weather
          </span>
          <select
            value={dynamicSky.weather}
            onChange={(event) => {
              const weather = event.target.value as DynamicSkyState['weather'];
              onPatchDynamicSky({ weather, presetId: null });
              onPatch({ weather: { ...state.weather, weather } });
            }}
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px]"
          >
            {['clear', 'cloudy', 'overcast', 'rain', 'storm', 'snow', 'fog', 'wind'].map(
              (weather) => (
                <option key={weather} value={weather}>
                  {weather.replace('_', ' ')}
                </option>
              )
            )}
          </select>
        </label>
        {state.uiMode !== 'basic' ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {(
              [
                ['intensity', 'Intensity', 0, 2, 0.05],
                ['density', 'Density', 0, 2, 0.05],
                ['speed', 'Speed', 0.1, 3, 0.05],
                ['turbulence', 'Turbulence', 0, 2, 0.05],
                ['directionDeg', 'Direction', 0, 360, 5],
              ] as const
            ).map(([key, label, min, max, step]) => (
              <label key={key} className="block">
                <span className="flex justify-between text-[9px] text-zinc-500">
                  {label}
                  <b className="text-zinc-300">
                    {key === 'directionDeg'
                      ? `${Math.round(state.weather[key])}°`
                      : state.weather[key].toFixed(2)}
                  </b>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={state.weather[key]}
                  onChange={(event) =>
                    onPatch({
                      weather: { ...state.weather, [key]: Number(event.target.value) },
                    })
                  }
                  className="w-full accent-sky-400"
                />
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1 font-bold text-zinc-200">
            <Sparkles className="h-3 w-3 text-pink-300" />
            Scene FX stack
          </p>
          <span className="text-[8px] text-zinc-600">{state.fxStack.length} layers</span>
        </div>
        {state.fxStack.length ? (
          <div className="space-y-1">
            {state.fxStack.map((effect) => (
              <div
                key={effect.id}
                className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={effect.enabled}
                  onChange={(event) =>
                    onPatch({
                      fxStack: state.fxStack.map((item) =>
                        item.id === effect.id ? { ...item, enabled: event.target.checked } : item
                      ),
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-bold">{effect.name}</p>
                  {effect.effectId.includes('trail') ? (
                    <select
                      value={effect.targetBone ?? 'right_hand'}
                      onChange={(event) =>
                        onPatch({
                          fxStack: state.fxStack.map((item) =>
                            item.id === effect.id
                              ? { ...item, targetBone: event.target.value }
                              : item
                          ),
                        })
                      }
                      className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5 text-[8px]"
                    >
                      {FX_BONE_CHOICES.map((bone) => (
                        <option key={bone.id} value={bone.id}>
                          {bone.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[8px] uppercase text-zinc-600">{effect.mount}</p>
                  )}
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={effect.intensity}
                  onChange={(event) =>
                    onPatch({
                      fxStack: state.fxStack.map((item) =>
                        item.id === effect.id
                          ? { ...item, intensity: Number(event.target.value) }
                          : item
                      ),
                    })
                  }
                  className="w-14 accent-pink-400"
                />
                <button
                  type="button"
                  title="Remove effect"
                  onClick={() =>
                    onPatch({ fxStack: state.fxStack.filter((item) => item.id !== effect.id) })
                  }
                  className="text-[10px] text-zinc-600 hover:text-red-300 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-zinc-600">Choose a mood to build the FX stack.</p>
        )}

        <div className="mt-2 flex flex-wrap gap-1 border-t border-zinc-800 pt-2">
          {addableFx.map((definition) => (
            <button
              key={definition.id}
              type="button"
              title={definition.description}
              onClick={() =>
                onPatch({
                  fxStack: [
                    ...state.fxStack,
                    createSceneFxInstance(definition.id, {
                      order: state.fxStack.length,
                      targetBone: definition.requires.bones ? 'right_hand' : null,
                      window: defaultEffectWindow(maxFrames),
                    }, maxFrames),
                  ],
                })
              }
              className="flex items-center gap-0.5 rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:text-zinc-100 cursor-pointer"
            >
              <Plus className="h-2.5 w-2.5" />
              {definition.name}
            </button>
          ))}
        </div>
      </section>

      {state.uiMode !== 'basic' ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 space-y-2">
          <p className="flex items-center gap-1 font-bold text-zinc-200">
            <Cpu className="h-3 w-3 text-emerald-300" />
            Runtime
          </p>
          <select
            value={state.backendPreference}
            onChange={(event) =>
              onPatch({
                backendPreference: event.target.value as SceneStudioState['backendPreference'],
              })
            }
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[10px]"
          >
            <option value="auto">Auto (WebGPU preferred)</option>
            <option value="webgpu">WebGPU / WGSL</option>
            <option value="webgl">WebGL fallback</option>
          </select>
          <label className="block">
            <span className="flex justify-between text-zinc-500">
              Particle budget <b>{state.particles.requestedCount.toLocaleString()}</b>
            </span>
            <input
              type="range"
              min={1000}
              max={250000}
              step={1000}
              value={state.particles.requestedCount}
              onChange={(event) =>
                onPatch({
                  particles: {
                    ...state.particles,
                    requestedCount: Number(event.target.value),
                  },
                })
              }
              className="w-full accent-emerald-400"
            />
          </label>
          {capabilities?.fallbackReason ? (
            <p className="text-[9px] text-amber-300/80">{capabilities.fallbackReason}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
