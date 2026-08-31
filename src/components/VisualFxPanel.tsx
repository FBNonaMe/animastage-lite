import {
  Aperture,
  Droplets,
  Palette,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import type {
  AppState,
  ColorGradePresetId,
  LightPresetId,
  LookPresetId,
  ParticlePresetId,
  ScenePresetId,
  VisualFxSettings,
} from '../types';
import {
  applyLookPreset,
  COLOR_GRADES,
  DEFAULT_VISUAL_FX,
  LIGHT_PRESETS,
  LOOK_PRESETS,
  PARTICLE_PRESET_LABELS,
  SCENE_PRESETS,
} from '../visualFx/visualFxPresets';
import LutControls from './postfx/LutControls';
import { RENDER_TIER_CONFIG } from '../render/renderTierConfig';
import type { RenderTier } from '../types';
import { isRtxFeatureAvailable } from '../utils/platform';

interface VisualFxPanelProps {
  appState: AppState;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onApplyLookPreset: (id: LookPresetId) => void;
  onSetRtxModeEnabled: (enabled: boolean) => void;
  onSetRenderTier?: (tier: RenderTier) => void;
}

function SliderRow({
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
        <span className="text-zinc-500 font-mono">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-fuchsia-400"
      />
    </label>
  );
}

export default function VisualFxPanel({
  appState,
  onSetVisualFx,
  onApplyLookPreset,
  onSetRtxModeEnabled,
  onSetRenderTier,
}: VisualFxPanelProps) {
  const fx = appState.visualFx;
  const rtxLive = appState.rtxModeEnabled && !appState.isPlaying;
  const tier = appState.renderTier;

  return (
    <div className="space-y-4">
      <div className="border-[#76b900]/35 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="text-[11px] font-bold text-[#76b900]">Render Engine</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSetRenderTier?.('lite')}
            className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
              tier === 'lite'
                ? 'border-emerald-500/50 bg-emerald-950/30'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            <span className="text-[10px] font-bold text-zinc-200 block">Lite</span>
            <span className="text-[8px] text-zinc-500">{RENDER_TIER_CONFIG.lite.subtitle}</span>
          </button>
          <button
            type="button"
            onClick={() => onSetRenderTier?.('pro')}
            className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
              tier === 'pro'
                ? 'border-[#76b900]/50 bg-[#76b900]/10'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
            }`}
          >
            <span className="text-[10px] font-bold text-[#76b900] block">PRO</span>
            <span className="text-[8px] text-zinc-500">{RENDER_TIER_CONFIG.pro.subtitle}</span>
          </button>
        </div>
        <p className="text-[9px] text-zinc-500 leading-relaxed">
          PMX/VMD/timeline/physics — same in Lite and PRO. PRO: 16× anisotropy, ultra N8AO,
          IBL 512, 2K mirror floor, RTX stack auto-enabled.
        </p>
        {tier === 'pro' && (
          <div className="text-[9px] text-[#76b900]/90 bg-[#76b900]/5 border border-[#76b900]/25 rounded-md p-2 leading-relaxed space-y-0.5">
            <div className="font-bold">PRO active</div>
            <div>· 16× texture anisotropy · 2048 shadows</div>
            <div>· N8AO full-res ultra · SMAA · bloom · IBL</div>
            <div>· RTX pauses during playback (60 FPS)</div>
          </div>
        )}
      </div>

      <div className="border-fuchsia-500/30 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-fuchsia-300">
          <Wand2 className="w-3.5 h-3.5" />
          One-Click Looks
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {LOOK_PRESETS.map((look) => (
            <button
              key={look.id}
              type="button"
              onClick={() => onApplyLookPreset(look.id)}
              className="text-left p-2 rounded-md border border-zinc-800 bg-zinc-900/80 hover:border-fuchsia-500/40 hover:bg-fuchsia-950/20 transition-all cursor-pointer"
              title={look.description}
            >
              <span className="text-[10px] font-bold text-zinc-200 block">{look.label}</span>
              <span className="text-[8px] text-zinc-500 leading-tight block mt-0.5">
                {look.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isRtxFeatureAvailable() && (
      <div className="border-cyan-500/25 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
          <span className="flex items-center gap-1.5">
            <Aperture className="w-3.5 h-3.5" /> RTX / Ultra Photo
          </span>
          <span className={`text-[8px] font-mono ${rtxLive ? 'text-cyan-400' : 'text-zinc-500'}`}>
            {rtxLive ? 'ACTIVE' : appState.rtxModeEnabled ? 'PAUSED' : 'OFF'}
          </span>
        </div>
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          N8AO traced occlusion, mirror floor, SMAA, bloom + all FX below. Pauses during playback
          for FPS.
        </p>
        <button
          type="button"
          onClick={() => onSetRtxModeEnabled(!appState.rtxModeEnabled)}
          className={`w-full p-2.5 border rounded-md text-xs font-bold transition-all cursor-pointer ${
            rtxLive
              ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
              : appState.rtxModeEnabled
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-cyan-200'
          }`}
        >
          {rtxLive
            ? 'Disable RTX Mode'
            : appState.rtxModeEnabled
              ? 'RTX Enabled (paused for playback)'
              : 'Enable RTX Mode'}
        </button>
      </div>
      )}

      <div className="border-[#e879ff]/30 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#e879ff]">
          <Sun className="w-3.5 h-3.5" />
          Scene &amp; Lighting
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-zinc-400">Scene</span>
          <select
            value={fx.scenePreset}
            onChange={(e) =>
              onSetVisualFx({ scenePreset: e.target.value as ScenePresetId })
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md text-xs px-2 py-1.5 text-zinc-200"
          >
            {Object.values(SCENE_PRESETS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-zinc-400">Lighting</span>
          <select
            value={fx.lightPreset}
            onChange={(e) =>
              onSetVisualFx({ lightPreset: e.target.value as LightPresetId })
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md text-xs px-2 py-1.5 text-zinc-200"
          >
            {Object.values(LIGHT_PRESETS).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <SliderRow
          label="IBL Environment"
          value={fx.environmentIntensity}
          min={0.2}
          max={1.2}
          step={0.02}
          onChange={(v) => onSetVisualFx({ environmentIntensity: v })}
        />
        <SliderRow
          label="Floor Reflection (RTX)"
          value={fx.floorReflection}
          min={0.2}
          max={1}
          step={0.02}
          onChange={(v) => onSetVisualFx({ floorReflection: v })}
        />
      </div>

      <div className="border-[#e879ff]/30 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-bold text-[#e879ff]">
            <Sparkles className="w-3.5 h-3.5" />
            Bloom &amp; Glow
          </span>
          <button
            type="button"
            onClick={() => onSetVisualFx({ bloomEnabled: !fx.bloomEnabled })}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
              fx.bloomEnabled
                ? 'bg-[#e879ff]/20 border-[#e879ff]/50 text-[#f0d0ff]'
                : 'border-zinc-700 text-zinc-500'
            }`}
          >
            {fx.bloomEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <SliderRow
          label="Bloom Intensity"
          value={fx.bloomIntensity}
          min={0.1}
          max={1}
          step={0.02}
          onChange={(v) => onSetVisualFx({ bloomIntensity: v, bloomEnabled: true })}
        />
        <SliderRow
          label="Bloom Threshold"
          value={fx.bloomThreshold}
          min={0.15}
          max={0.85}
          step={0.02}
          onChange={(v) => onSetVisualFx({ bloomThreshold: v })}
        />
      </div>

      <div className="border-violet-500/30 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center gap-2 text-[11px] font-bold text-violet-300">
          <Palette className="w-3.5 h-3.5" />
          Color &amp; Lens
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-zinc-400">Color Grade</span>
          <select
            value={fx.colorGrade}
            disabled={Boolean(fx.customLutUrl) && fx.customLutEnabled !== false}
            onChange={(e) =>
              onSetVisualFx({ colorGrade: e.target.value as ColorGradePresetId })
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md text-xs px-2 py-1.5 text-zinc-200 disabled:opacity-50"
          >
            {Object.values(COLOR_GRADES).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <LutControls visualFx={fx} onSetVisualFx={onSetVisualFx} compact showBuiltInGrade={false} />
        <label className="flex items-center justify-between text-[10px] font-bold text-zinc-400 cursor-pointer">
          <span>Depth of Field (Bokeh)</span>
          <input
            type="checkbox"
            checked={fx.dofEnabled}
            onChange={(e) => onSetVisualFx({ dofEnabled: e.target.checked })}
            className="accent-violet-400"
          />
        </label>
        {fx.dofEnabled && (
          <>
            <SliderRow
              label="DOF Focus"
              value={fx.dofFocusDistance}
              min={0.005}
              max={0.06}
              step={0.001}
              onChange={(v) => onSetVisualFx({ dofFocusDistance: v })}
            />
            <SliderRow
              label="DOF Bokeh Scale"
              value={fx.dofBokehScale}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(v) => onSetVisualFx({ dofBokehScale: v })}
            />
          </>
        )}
        <label className="flex items-center justify-between text-[10px] font-bold text-zinc-400 cursor-pointer">
          <span>Vignette</span>
          <input
            type="checkbox"
            checked={fx.vignetteEnabled}
            onChange={(e) => onSetVisualFx({ vignetteEnabled: e.target.checked })}
            className="accent-violet-400"
          />
        </label>
        {fx.vignetteEnabled && (
          <SliderRow
            label="Vignette Strength"
            value={fx.vignetteIntensity}
            min={0.1}
            max={0.85}
            step={0.02}
            onChange={(v) => onSetVisualFx({ vignetteIntensity: v })}
          />
        )}
        <SliderRow
          label="Chromatic Aberration"
          value={fx.chromaticAberration}
          min={0}
          max={0.004}
          step={0.0002}
          onChange={(v) => onSetVisualFx({ chromaticAberration: v })}
        />
        {isRtxFeatureAvailable() && appState.rtxModeEnabled && (
          <SliderRow
            label="AO Intensity (RTX)"
            value={fx.aoIntensity}
            min={1}
            max={8}
            step={0.2}
            onChange={(v) => onSetVisualFx({ aoIntensity: v })}
          />
        )}
      </div>

      <div className="border-sky-500/30 border bg-[#121418] p-3 rounded-md shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] font-bold text-sky-300">
            <Droplets className="w-3.5 h-3.5" />
            Particles
          </span>
          <button
            type="button"
            onClick={() => onSetVisualFx({ particlesEnabled: !fx.particlesEnabled })}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
              fx.particlesEnabled
                ? 'bg-sky-950/40 border-sky-500/50 text-sky-300'
                : 'border-zinc-700 text-zinc-500'
            }`}
          >
            {fx.particlesEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold text-zinc-400">Particle Type</span>
          <select
            value={fx.particlePreset}
            onChange={(e) =>
              onSetVisualFx({
                particlePreset: e.target.value as ParticlePresetId,
                particlesEnabled: e.target.value !== 'none',
              })
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md text-xs px-2 py-1.5 text-zinc-200"
          >
            {Object.entries(PARTICLE_PRESET_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <SliderRow
          label="Particle Intensity"
          value={fx.particleIntensity}
          min={0.15}
          max={1}
          step={0.05}
          onChange={(v) => onSetVisualFx({ particleIntensity: v })}
        />
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onSetVisualFx({ ...DEFAULT_VISUAL_FX })}
          className="w-full p-2 text-[10px] font-bold text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-md cursor-pointer"
        >
          Reset all FX to default
        </button>
      </div>
    </div>
  );
}
