import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Droplets,
  Palette,
  Sparkles,
  Sun,
  Wand2,
  Download,
  Upload,
  Clapperboard,
} from 'lucide-react';
import type { AppState, SceneBackgroundSettings, VisualFxSettings, ParticlePresetId, WeatherPresetId } from '../../types';
import {
  COMPOSER_PRESETS,
  VISUAL_STYLE_PATCHES,
  applyComposerPreset,
  applyVisualStyle,
  buildAutoScene,
  composerStateToVisualFxPatch,
  computeSceneHealth,
  downloadScenePreset,
  parseScenePreset,
  serializeScenePreset,
  type ComposerPresetId,
  type ComposerSkyId,
  type ComposerVisualStyleId,
  type MaterialOverrideId,
  type SceneComposerState,
  type PresetPreviewSource,
} from '../../sceneComposer';
import { MMD_WEATHER_PRESETS } from '../../visualFx/mmdWeatherPresets';
import { PARTICLE_PRESET_LABELS } from '../../visualFx/visualFxPresets';
import SunDial from './SunDial';
import PresetPreviewCard from './PresetPreviewCard';
import PresetBackgroundBar from './PresetBackgroundBar';
import { useViewportSnapshot } from '../../hooks/useViewportSnapshot';
import type { ProcessedMMDFiles } from '../../utils/mmdFiles';

interface SceneComposerPanelProps {
  appState: AppState;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchComposer: (patch: Partial<SceneComposerState>) => void;
  onReplaceComposer: (next: SceneComposerState) => void;
  onPatchSceneBackground?: (patch: Partial<SceneBackgroundSettings>) => void;
  onImportBackgroundModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  getViewportCanvas?: () => HTMLCanvasElement | null;
  captureViewportFrame?: () => string | null;
  invalidateViewport?: () => void;
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
        className="w-full accent-violet-400"
      />
    </label>
  );
}

function Section({
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#0e1014]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-violet-200 bg-[#141820] hover:bg-[#1a1e28] cursor-pointer"
      >
        {icon}
        {title}
        <span className="ml-auto text-zinc-500">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="p-2.5 space-y-2.5">{children}</div> : null}
    </div>
  );
}

const SKY_PRESETS: { id: ComposerSkyId; label: string }[] = [
  { id: 'blue', label: 'Blue Sky' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'fantasy', label: 'Fantasy' },
  { id: 'cyber', label: 'Cyber' },
];

const EFFECT_LEVELS = ['off', 'low', 'medium', 'high', 'auto'] as const;

export default function SceneComposerPanel({
  appState,
  onSetVisualFx,
  onPatchComposer,
  onReplaceComposer,
  onPatchSceneBackground,
  onImportBackgroundModel,
  getViewportCanvas,
  captureViewportFrame,
  invalidateViewport,
}: SceneComposerPanelProps) {
  const composer = appState.sceneComposer;
  const fx = appState.visualFx;
  const sceneBg = appState.sceneBackground;
  const fileRef = useRef<HTMLInputElement>(null);
  const health = useMemo(() => computeSceneHealth(appState), [appState]);
  const hasModel = appState.models.some((m) => m.visible);
  const backgroundStage = appState.models.find((m) => m.visible && m.assetKind === 'stage');
  const previewSource: PresetPreviewSource = composer.presetPreviewSource ?? 'model';
  const snapshotKey = `${appState.models.length}-${backgroundStage?.id ?? ''}-${sceneBg.imageUrl ?? ''}-${composer.visualStyle}-${fx.scenePreset}`;
  const modelSnapshot = useViewportSnapshot({
    captureFrame: captureViewportFrame,
    getCanvas: getViewportCanvas,
    invalidateScene: invalidateViewport,
    enabled: hasModel && previewSource === 'model',
    refreshKey: snapshotKey,
  });

  const syncFxFromComposer = useCallback(
    (next: SceneComposerState) => {
      onReplaceComposer(next);
      onSetVisualFx(composerStateToVisualFxPatch(next, fx));
    },
    [fx, onReplaceComposer, onSetVisualFx]
  );

  const patchComposer = useCallback(
    (patch: Partial<SceneComposerState>) => {
      const next = { ...composer, ...patch };
      if (patch.lights) next.lights = { ...composer.lights, ...patch.lights };
      if (patch.effectLevels) next.effectLevels = { ...composer.effectLevels, ...patch.effectLevels };
      syncFxFromComposer(next);
    },
    [composer, syncFxFromComposer]
  );

  const handleBackgroundPhoto = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    onPatchSceneBackground?.({ imageUrl: url, opacity: sceneBg.opacity || 1 });
    patchComposer({ presetPreviewSource: 'image', bgMode: 'custom' });
  };

  const clearBackgroundPhoto = () => {
    onPatchSceneBackground?.({ imageUrl: null, opacity: 1 });
    patchComposer({ presetPreviewSource: hasModel ? 'model' : 'minimal', bgMode: 'scene' });
  };

  const applyPreset = (id: ComposerPresetId) => {
    const keepPreview = composer.presetPreviewSource ?? 'model';
    const result = applyComposerPreset(id, fx, composer);
    onReplaceComposer({ ...result.composer, presetPreviewSource: keepPreview });
    onSetVisualFx(result.visualFx);
    if (result.sceneBackground) onPatchSceneBackground?.(result.sceneBackground);
  };

  const runAutoScene = () => {
    const result = buildAutoScene(appState);
    onReplaceComposer({ ...composer, ...result.composer });
    onSetVisualFx({ ...fx, ...result.visualFx });
    if (result.sceneBackground) onPatchSceneBackground?.(result.sceneBackground);
  };

  const skyToScene = (sky: ComposerSkyId) => {
    const map: Record<ComposerSkyId, VisualFxSettings['scenePreset']> = {
      blue: 'outdoor',
      sunset: 'sunset',
      night: 'nightclub',
      cloudy: 'warehouse',
      fantasy: 'outdoor',
      cyber: 'cyber',
    };
    onSetVisualFx({ scenePreset: map[sky] });
    patchComposer({ skyPreset: sky });
  };

  return (
    <div className="space-y-3" id="scene-composer-panel">
      <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-2.5 space-y-2">
        <button
          type="button"
          onClick={runAutoScene}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-violet-600/80 to-fuchsia-600/70 text-white text-[11px] font-bold uppercase tracking-wide cursor-pointer hover:opacity-90"
        >
          <Wand2 className="w-4 h-4" />
          Auto Scene
        </button>
        <div className="grid grid-cols-2 gap-1 text-[9px]">
          {[
            ['Lighting', health.lighting],
            ['Performance', health.performance],
            ['Environment', health.environment],
            ['Weather', health.weather],
            ['Visual Quality', health.visualQuality],
            ['Score', `${health.overallPercent}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-zinc-400 px-1">
              <span>{k}</span>
              <span className="text-emerald-300 font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <Section title="Lighting" icon={<Sun className="w-3.5 h-3.5 text-amber-300" />} defaultOpen>
        <SunDial
          azimuth={composer.lights.sunAzimuth}
          elevation={composer.lights.sunElevation}
          onChange={(azimuth, elevation) =>
            patchComposer({ lights: { ...composer.lights, sunAzimuth: azimuth, sunElevation: elevation } })
          }
        />
        <Slider
          label="Sun brightness"
          value={composer.lights.sunIntensity}
          min={0.2}
          max={2}
          step={0.05}
          onChange={(v) => patchComposer({ lights: { ...composer.lights, sunIntensity: v } })}
        />
        <label className="flex items-center gap-2 text-[10px] text-zinc-400">
          <input
            type="color"
            value={composer.lights.sunColor}
            onChange={(e) =>
              patchComposer({ lights: { ...composer.lights, sunColor: e.target.value } })
            }
            className="w-8 h-6 rounded cursor-pointer"
          />
          Sun color
          <input
            type="checkbox"
            checked={composer.lights.sunShadows}
            onChange={(e) =>
              patchComposer({ lights: { ...composer.lights, sunShadows: e.target.checked } })
            }
            className="ml-auto accent-violet-400"
          />
          Shadows
        </label>
        <Slider
          label="Ambient"
          value={composer.lights.ambientIntensity}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => patchComposer({ lights: { ...composer.lights, ambientIntensity: v } })}
        />
      </Section>

      <Section title="Environment" icon={<Cloud className="w-3.5 h-3.5 text-sky-300" />}>
        <div className="grid grid-cols-2 gap-1">
          {SKY_PRESETS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => skyToScene(s.id)}
              className={`text-[9px] font-bold py-1.5 rounded border cursor-pointer ${
                composer.skyPreset === s.id
                  ? 'border-sky-400/50 bg-sky-950/40 text-sky-200'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1 pt-1">
          {(
            [
              ['scene', 'Default'],
              ['transparent', 'Transparent'],
              ['solid_white', 'Studio White'],
              ['solid_black', 'Studio Black'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                patchComposer({ bgMode: mode });
                if (mode === 'transparent') onPatchSceneBackground?.({ imageUrl: null, opacity: 0 });
              }}
              className={`text-[9px] font-bold py-1.5 rounded border cursor-pointer ${
                composer.bgMode === mode
                  ? 'border-violet-400/50 bg-violet-950/30 text-violet-200'
                  : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          label="Environment brightness"
          value={composer.envBrightness}
          min={0.2}
          max={1.2}
          step={0.02}
          onChange={(v) => patchComposer({ envBrightness: v })}
        />
      </Section>

      <Section title="Colors" icon={<Palette className="w-3.5 h-3.5 text-pink-300" />}>
        <Slider label="Exposure" value={composer.exposure} min={0.5} max={1.4} step={0.02} onChange={(v) => patchComposer({ exposure: v })} />
        <Slider label="Brightness" value={composer.brightness} min={0.6} max={1.4} step={0.02} onChange={(v) => patchComposer({ brightness: v })} />
        <Slider label="Contrast" value={composer.contrast} min={0.6} max={1.5} step={0.02} onChange={(v) => patchComposer({ contrast: v })} />
        <Slider label="Saturation" value={composer.saturation} min={0.5} max={1.5} step={0.02} onChange={(v) => patchComposer({ saturation: v })} />
        <Slider label="Warm / Cool" value={composer.temperature} min={-0.5} max={0.5} step={0.02} onChange={(v) => patchComposer({ temperature: v })} />
      </Section>

      <Section title="Atmosphere" icon={<Droplets className="w-3.5 h-3.5 text-cyan-300" />}>
        <label className="flex items-center gap-2 text-[10px] text-zinc-400">
          <input
            type="checkbox"
            checked={composer.fogEnabled}
            onChange={(e) => patchComposer({ fogEnabled: e.target.checked })}
            className="accent-cyan-400"
          />
          Fog
        </label>
        {composer.fogEnabled ? (
          <>
            <Slider label="Fog density" value={composer.fogDensity} min={0} max={1} step={0.02} onChange={(v) => patchComposer({ fogDensity: v })} />
            <label className="flex items-center gap-2 text-[10px] text-zinc-400">
              <input type="color" value={composer.fogColor} onChange={(e) => patchComposer({ fogColor: e.target.value })} className="w-8 h-6 rounded" />
              Fog color
            </label>
          </>
        ) : null}
        <Slider label="Wind" value={composer.windStrength} min={0} max={1} step={0.05} onChange={(v) => patchComposer({ windStrength: v })} />
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(MMD_WEATHER_PRESETS) as WeatherPresetId[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onSetVisualFx(MMD_WEATHER_PRESETS[w]!)}
              className={`text-[8px] font-bold py-1 rounded border capitalize cursor-pointer ${
                fx.weatherPreset === w ? 'border-cyan-400/50 text-cyan-200 bg-cyan-950/30' : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {(['sparkles', 'petals', 'snow', 'fireflies', 'confetti', 'dust'] as ParticlePresetId[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onSetVisualFx({ particlesEnabled: p !== 'none', particlePreset: p })}
              className={`text-[8px] font-bold py-1 rounded border cursor-pointer ${
                fx.particlePreset === p && fx.particlesEnabled
                  ? 'border-fuchsia-400/50 text-fuchsia-200'
                  : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {PARTICLE_PRESET_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Effects" icon={<Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />}>
        {(['bloom', 'ao', 'dof', 'reflection'] as const).map((key) => (
          <label key={key} className="block text-[9px] text-zinc-500 font-bold uppercase">
            {key}
            <select
              value={composer.effectLevels[key === 'ao' ? 'ao' : key === 'reflection' ? 'reflection' : key]}
              onChange={(e) =>
                patchComposer({
                  effectLevels: {
                    ...composer.effectLevels,
                    [key === 'ao' ? 'ao' : key]: e.target.value,
                  },
                })
              }
              className="mt-0.5 w-full bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-200 py-1"
            >
              {EFFECT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="pt-1 border-t border-zinc-800">
          <div className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Visual Style</div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(VISUAL_STYLE_PATCHES) as ComposerVisualStyleId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const r = applyVisualStyle(id, fx, composer);
                  onReplaceComposer(r.composer);
                  onSetVisualFx(r.visualFx);
                }}
                className={`text-[8px] font-bold py-1.5 rounded border cursor-pointer ${
                  composer.visualStyle === id
                    ? 'border-pink-400/50 text-pink-200 bg-pink-950/20'
                    : 'border-zinc-800 text-zinc-500'
                }`}
              >
                {VISUAL_STYLE_PATCHES[id].label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Material look</div>
        <div className="grid grid-cols-3 gap-1">
          {(
            ['default', 'soft_toon', 'outline', 'studio', 'flat', 'stylized'] as MaterialOverrideId[]
          ).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchComposer({ materialOverride: m })}
              className={`text-[8px] font-bold py-1 rounded border capitalize cursor-pointer ${
                composer.materialOverride === m ? 'border-violet-400/50 text-violet-200' : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {m.replace('_', ' ')}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Presets" icon={<Clapperboard className="w-3.5 h-3.5 text-amber-200" />} defaultOpen>
        <PresetBackgroundBar
          previewSource={previewSource}
          onPreviewSourceChange={(source) => patchComposer({ presetPreviewSource: source })}
          backgroundImageUrl={sceneBg.imageUrl}
          modelSnapshotUrl={modelSnapshot}
          backgroundStageName={backgroundStage?.name ?? null}
          hasSceneModel={hasModel}
          onImportBackgroundModel={
            onImportBackgroundModel
              ? (data) => {
                  onImportBackgroundModel(data);
                  patchComposer({ presetPreviewSource: 'model', bgMode: 'scene' });
                  invalidateViewport?.();
                }
              : undefined
          }
          onUploadPhoto={(file) => handleBackgroundPhoto(file)}
          onClearPhoto={clearBackgroundPhoto}
        />

        {sceneBg.imageUrl && previewSource === 'image' ? (
          <label className="block space-y-1 pt-2">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Photo opacity in viewport</span>
              <span>{sceneBg.opacity.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={sceneBg.opacity}
              onChange={(e) => onPatchSceneBackground?.({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-sky-400"
            />
          </label>
        ) : null}

        <p className="text-[8px] text-zinc-500 leading-snug pt-2">
          Tap a preset below to apply lighting to your background.
        </p>
        <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pt-1">
          {COMPOSER_PRESETS.map((p) => (
            <PresetPreviewCard
              key={p.id}
              preset={p}
              previewSource={previewSource}
              modelSnapshotUrl={modelSnapshot}
              backgroundImageUrl={sceneBg.imageUrl}
              onClick={() => applyPreset(p.id)}
            />
          ))}
        </div>
        <div className="flex gap-1 pt-2">
          <button
            type="button"
            onClick={() =>
              downloadScenePreset(
                'my-scene.scenepreset',
                serializeScenePreset('My Scene', fx, composer, appState.sceneBackground, appState.sceneHdr)
              )
            }
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold border border-zinc-700 rounded text-zinc-300 cursor-pointer"
          >
            <Download className="w-3 h-3" /> Save
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold border border-zinc-700 rounded text-zinc-300 cursor-pointer"
          >
            <Upload className="w-3 h-3" /> Load
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".scenepreset,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void f.text().then((text) => {
                const parsed = parseScenePreset(text);
                if ('error' in parsed) {
                  window.alert(parsed.error);
                  return;
                }
                onReplaceComposer(parsed.sceneComposer);
                onSetVisualFx(parsed.visualFx);
                if (parsed.sceneBackground) onPatchSceneBackground?.(parsed.sceneBackground);
              });
              e.target.value = '';
            }}
          />
        </div>
      </Section>
    </div>
  );
}
