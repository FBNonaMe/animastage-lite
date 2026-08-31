import { Lightbulb, Sparkles, Sun } from 'lucide-react';
import type { AppState, VisualFxSettings } from '../../types';
import type { SceneComposerState } from '../../sceneComposer';
import {
  COMPOSER_PRESETS,
  applyComposerPreset,
  normalizeSceneComposerLights,
  type ComposerPresetId,
} from '../../sceneComposer';
import { CINEMATIC_LIGHTING_LABELS } from '../../product/cinematic';
import type { CinematicLightingPresetId } from '../../product/cinematic';
import SunDial from '../sceneComposer/SunDial';
import {
  CINEMATIC_LIGHTING_PRESETS,
  applyCinematicLightingPreset,
  type SceneStudioState,
} from '../../sceneStudio';

interface LightingStudioPanelProps {
  appState: AppState;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchComposer: (patch: Partial<SceneComposerState>) => void;
  onReplaceComposer: (next: SceneComposerState) => void;
  onApplyCinematicLighting?: (preset: CinematicLightingPresetId) => void;
  onPatchSceneStudio?: (patch: Partial<SceneStudioState>) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-500">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-400"
      />
    </label>
  );
}

const STUDIO_PRESETS: ComposerPresetId[] = [
  'studio',
  'golden_hour',
  'sunset',
  'night',
  'moonlight',
  'concert',
  'indoor',
  'outdoor',
  'cyberpunk',
  'fantasy',
  'dream',
];

export default function LightingStudioPanel({
  appState,
  onSetVisualFx,
  onPatchComposer,
  onReplaceComposer,
  onApplyCinematicLighting,
  onPatchSceneStudio,
}: LightingStudioPanelProps) {
  const composer = appState.sceneComposer;
  const lights = normalizeSceneComposerLights(composer.lights);

  const applyComposer = (id: ComposerPresetId) => {
    const result = applyComposerPreset(id, appState.visualFx, composer);
    onReplaceComposer(result.composer);
    onSetVisualFx(result.visualFx);
  };

  const patchLights = (patch: Partial<typeof lights>) =>
    onPatchComposer({ lights: { ...lights, ...patch } });

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-[#0c0e14]/94 backdrop-blur-xl shadow-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Sun className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">Lighting Studio</p>
          <p className="text-[9px] text-zinc-500">Sun, exposure & scene presets</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Exposure"
          value={composer.exposure}
          min={0.4}
          max={1.6}
          step={0.02}
          onChange={(exposure) => {
            onPatchComposer({ exposure });
            onSetVisualFx({ toneExposure: exposure * composer.brightness });
          }}
        />
        <Slider
          label="Sun intensity"
          value={lights.sunIntensity}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(sunIntensity) =>
            onPatchComposer({ lights: { ...lights, sunIntensity } })
          }
        />
        <Slider
          label="Ambient"
          value={lights.ambientIntensity}
          min={0}
          max={2}
          step={0.05}
          onChange={(ambientIntensity) =>
            onPatchComposer({ lights: { ...lights, ambientIntensity } })
          }
        />
        <Slider
          label="Temperature"
          value={composer.temperature}
          min={-1}
          max={1}
          step={0.05}
          onChange={(temperature) => onPatchComposer({ temperature })}
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          Sun direction
        </p>
        <SunDial
          azimuth={lights.sunAzimuth}
          elevation={lights.sunElevation}
          onChange={(sunAzimuth, sunElevation) =>
            onPatchComposer({ lights: { ...lights, sunAzimuth, sunElevation } })
          }
        />
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-violet-200">
            <Lightbulb className="h-3 w-3" />
            Character lighting
          </p>
          <label className="flex items-center gap-1 text-[9px] text-zinc-400">
            <input
              type="checkbox"
              checked={lights.characterRigEnabled}
              onChange={(event) => patchLights({ characterRigEnabled: event.target.checked })}
            />
            Rig
          </label>
        </div>

        {lights.characterRigEnabled ? (
          <>
            {onPatchSceneStudio ? (
              <label className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1 text-[9px] text-zinc-400">
                Follow character + camera
                <input
                  type="checkbox"
                  checked={appState.sceneStudio?.autoCharacterLights ?? false}
                  onChange={(event) =>
                    onPatchSceneStudio({ autoCharacterLights: event.target.checked })
                  }
                />
              </label>
            ) : null}

            {(
              [
                ['key', 'Key', 'keyEnabled', 'keyIntensity', 'keyColor'],
                ['fill', 'Fill', 'fillEnabled', 'fillIntensity', 'fillColor'],
                ['rim', 'Rim', 'rimEnabled', 'rimIntensity', 'rimColor'],
              ] as const
            ).map(([, label, enabledKey, intensityKey, colorKey]) => (
              <div
                key={label}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded border border-zinc-800/80 bg-black/20 px-2 py-1"
              >
                <label className="flex items-center gap-1 text-[9px] font-bold text-zinc-300">
                  <input
                    type="checkbox"
                    checked={lights[enabledKey]}
                    onChange={(event) => patchLights({ [enabledKey]: event.target.checked })}
                  />
                  {label}
                </label>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={lights[intensityKey]}
                  disabled={!lights[enabledKey]}
                  onChange={(event) =>
                    patchLights({ [intensityKey]: Number(event.target.value) })
                  }
                  className="w-full accent-violet-400 disabled:opacity-30"
                />
                <input
                  type="color"
                  value={lights[colorKey]}
                  disabled={!lights[enabledKey]}
                  onChange={(event) => patchLights({ [colorKey]: event.target.value })}
                  className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-30"
                  title={`${label} color`}
                />
              </div>
            ))}
          </>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
          Lighting presets
        </p>
        <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
          {CINEMATIC_LIGHTING_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() =>
                onPatchComposer({
                  lights: applyCinematicLightingPreset(lights, preset.id),
                })
              }
              className="cursor-pointer rounded-lg border border-zinc-700/80 px-2 py-1 text-left text-[9px] font-bold text-zinc-400 hover:border-violet-500/40 hover:text-violet-200"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Scene presets
        </p>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          {STUDIO_PRESETS.map((id) => {
            const preset = COMPOSER_PRESETS.find((p) => p.id === id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyComposer(id)}
                className="px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border border-zinc-700/80 text-zinc-400 hover:border-amber-500/40 hover:text-amber-200"
              >
                {preset?.label ?? id}
              </button>
            );
          })}
        </div>
      </div>

      {onApplyCinematicLighting ? (
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
            Cinematic looks
          </p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {(Object.keys(CINEMATIC_LIGHTING_LABELS) as CinematicLightingPresetId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onApplyCinematicLighting(id)}
                className="px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border border-zinc-700/80 text-zinc-400 hover:border-violet-500/40 hover:text-violet-200"
              >
                {CINEMATIC_LIGHTING_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
