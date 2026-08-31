/**
 * Environment Studio — Time of Day, weather, sky, fog, clouds, exposure.
 */
import { Cloud, Moon, Sun, Wind } from 'lucide-react';
import {
  applyEnvPreset,
  ENV_PRESETS,
  formatTimeHours,
  periodLabel,
  resolveDynamicSkyLook,
  WEATHER_MODS,
  type DynamicEnvPresetId,
  type DynamicSkyQuality,
  type DynamicSkyState,
  type DynamicWeatherId,
} from '../../dynamicSky';
import type { SceneComposerState } from '../../sceneComposer/types';
import type { VisualFxSettings } from '../../types';
import { buildDynamicSkyPatches } from '../../dynamicSky/applyLook';

export interface EnvironmentStudioPanelProps {
  dynamicSky: DynamicSkyState;
  onPatchDynamicSky: (patch: Partial<DynamicSkyState>) => void;
  onApplyEnvironment: (args: {
    dynamicSky: DynamicSkyState;
    sceneComposer: Partial<SceneComposerState> & {
      lights?: Partial<SceneComposerState['lights']>;
    };
    visualFx: Partial<VisualFxSettings>;
  }) => void;
}

function applyAndEmit(
  next: DynamicSkyState,
  onPatchDynamicSky: EnvironmentStudioPanelProps['onPatchDynamicSky'],
  onApplyEnvironment: EnvironmentStudioPanelProps['onApplyEnvironment']
) {
  onPatchDynamicSky(next);
  if (!next.enabled) return;
  const look = resolveDynamicSkyLook(next);
  const patches = buildDynamicSkyPatches(look);
  const fogFromOverride =
    next.fogOverride != null
      ? {
          fogEnabled: next.fogOverride > 0.02,
          fogDensity: next.fogOverride,
        }
      : {};
  onApplyEnvironment({
    dynamicSky: next,
    sceneComposer: {
      ...patches.sceneComposer,
      ...fogFromOverride,
    },
    visualFx: patches.visualFx,
  });
}

export default function EnvironmentStudioPanel({
  dynamicSky,
  onPatchDynamicSky,
  onApplyEnvironment,
}: EnvironmentStudioPanelProps) {
  const look = resolveDynamicSkyLook(dynamicSky);

  const set = (patch: Partial<DynamicSkyState>) => {
    applyAndEmit({ ...dynamicSky, ...patch }, onPatchDynamicSky, onApplyEnvironment);
  };

  return (
    <div className="p-2 space-y-3 text-zinc-300">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-zinc-100 m-0">Environment Studio</p>
          <p className="text-[9px] text-zinc-500 m-0">Dynamic sky · time of day · weather</p>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[9px] font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={dynamicSky.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          Live
        </label>
      </div>

      {/* Time of day */}
      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-200/90">
          <Sun className="w-3.5 h-3.5" />
          Time of Day
          <span className="ml-auto font-mono text-zinc-300">
            {formatTimeHours(dynamicSky.timeHours)}
          </span>
        </div>
        <p className="text-[9px] text-zinc-500 m-0">
          {periodLabel(look.period)}
          {look.nightMode ? ' · Moonlight' : ' · Sunlight'}
        </p>
        <input
          type="range"
          min={0}
          max={24}
          step={0.05}
          value={dynamicSky.timeHours}
          disabled={!dynamicSky.enabled}
          onChange={(e) => set({ timeHours: Number(e.target.value), presetId: null })}
          className="w-full accent-amber-400"
        />
        <div className="flex gap-1">
          {(
            [
              ['Dawn', 5.5],
              ['Noon', 12],
              ['Golden', 17.5],
              ['Sunset', 19],
              ['Night', 22],
            ] as const
          ).map(([label, h]) => (
            <button
              key={label}
              type="button"
              disabled={!dynamicSky.enabled}
              onClick={() => set({ timeHours: h, presetId: null })}
              className="flex-1 py-1 text-[8px] font-bold rounded border border-zinc-700 text-zinc-400 cursor-pointer disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-zinc-500 w-16">Auto play</span>
          <input
            type="range"
            min={0}
            max={8}
            step={0.25}
            value={dynamicSky.playSpeed}
            disabled={!dynamicSky.enabled}
            onChange={(e) => onPatchDynamicSky({ playSpeed: Number(e.target.value) })}
            className="flex-1 accent-cyan-400"
          />
          <span className="text-[8px] font-mono text-zinc-500 w-8">
            {dynamicSky.playSpeed.toFixed(1)}x
          </span>
        </div>
      </section>

      {/* Weather */}
      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-200/90">
          <Cloud className="w-3.5 h-3.5" />
          Weather
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(WEATHER_MODS) as DynamicWeatherId[]).map((id) => (
            <button
              key={id}
              type="button"
              disabled={!dynamicSky.enabled}
              onClick={() => set({ weather: id, presetId: null })}
              className={`py-1.5 text-[8px] font-bold rounded border cursor-pointer disabled:opacity-40 ${
                dynamicSky.weather === id
                  ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                  : 'border-zinc-700 text-zinc-500'
              }`}
            >
              {WEATHER_MODS[id].label}
            </button>
          ))}
        </div>
      </section>

      {/* Clouds / fog / wind */}
      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-300">
          <Wind className="w-3.5 h-3.5" />
          Atmosphere
        </div>
        {(
          [
            ['Cloud coverage', 'cloudCoverage', dynamicSky.cloudCoverage],
            ['Cloud density', 'cloudDensity', dynamicSky.cloudDensity],
            ['Cloud speed', 'cloudSpeed', dynamicSky.cloudSpeed],
          ] as const
        ).map(([label, key, val]) => (
          <label key={key} className="block">
            <span className="text-[8px] text-zinc-500">{label}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={val}
              disabled={!dynamicSky.enabled}
              onChange={(e) => set({ [key]: Number(e.target.value), presetId: null })}
              className="w-full accent-zinc-400"
            />
          </label>
        ))}
        <label className="block">
          <span className="text-[8px] text-zinc-500">
            Fog density {look.fogDensity.toFixed(2)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={dynamicSky.fogOverride ?? look.fogDensity}
            disabled={!dynamicSky.enabled}
            onChange={(e) => {
              const fogOverride = Number(e.target.value);
              const next = { ...dynamicSky, fogOverride, presetId: null as const };
              onPatchDynamicSky(next);
              if (!next.enabled) return;
              const look = resolveDynamicSkyLook(next);
              const patches = buildDynamicSkyPatches(look);
              onApplyEnvironment({
                dynamicSky: next,
                sceneComposer: {
                  ...patches.sceneComposer,
                  fogEnabled: fogOverride > 0.02,
                  fogDensity: fogOverride,
                },
                visualFx: patches.visualFx,
              });
            }}
            className="w-full accent-zinc-400"
          />
        </label>
        <label className="block">
          <span className="text-[8px] text-zinc-500">
            Exposure {(dynamicSky.exposureOverride ?? look.exposure).toFixed(2)}
          </span>
          <input
            type="range"
            min={0.4}
            max={1.4}
            step={0.01}
            value={dynamicSky.exposureOverride ?? look.exposure}
            disabled={!dynamicSky.enabled}
            onChange={(e) => set({ exposureOverride: Number(e.target.value), presetId: null })}
            className="w-full accent-amber-400"
          />
        </label>
      </section>

      {/* Moon / sky toggles */}
      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-200/90 mb-1">
          <Moon className="w-3.5 h-3.5" />
          Sky layers
        </div>
        {(
          [
            ['Sky dome', 'showSkyDome'],
            ['Sun disk', 'showSunDisk'],
            ['Moon', 'showMoon'],
            ['Clouds', 'showClouds'],
            ['Animate clouds', 'animateClouds'],
          ] as const
        ).map(([label, key]) => (
          <label
            key={key}
            className="flex items-center justify-between text-[9px] text-zinc-400 cursor-pointer"
          >
            {label}
            <input
              type="checkbox"
              checked={dynamicSky[key]}
              onChange={(e) => onPatchDynamicSky({ [key]: e.target.checked })}
            />
          </label>
        ))}
        <div className="pt-1">
          <span className="text-[8px] text-zinc-500">Quality</span>
          <div className="grid grid-cols-4 gap-1 mt-1">
            {(['low', 'medium', 'high', 'ultra'] as DynamicSkyQuality[]).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onPatchDynamicSky({ quality: q })}
                className={`py-1 text-[8px] font-bold rounded border cursor-pointer capitalize ${
                  dynamicSky.quality === q
                    ? 'border-violet-400/50 bg-violet-500/15 text-violet-100'
                    : 'border-zinc-700 text-zinc-500'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Presets */}
      <section className="rounded-md border border-[#2a3140] bg-[#0c0f14] p-2 space-y-2">
        <p className="text-[10px] font-bold text-zinc-300 m-0">Environment presets</p>
        <div className="grid grid-cols-2 gap-1">
          {ENV_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.description}
              disabled={!dynamicSky.enabled}
              onClick={() => {
                const next = applyEnvPreset(dynamicSky, p.id as DynamicEnvPresetId);
                applyAndEmit(next, onPatchDynamicSky, onApplyEnvironment);
              }}
              className={`px-1.5 py-1.5 text-[8px] font-bold rounded border text-left cursor-pointer disabled:opacity-40 ${
                dynamicSky.presetId === p.id
                  ? 'border-cyan-400/50 bg-cyan-500/10 text-cyan-100'
                  : 'border-zinc-700 text-zinc-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <p className="text-[8px] text-zinc-600 m-0 leading-relaxed">
        Drag Time to transform lighting, sky, fog, clouds and post-FX in real time. Night
        automatically switches to moonlight.
      </p>
    </div>
  );
}
