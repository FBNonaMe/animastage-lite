import { Aperture, Sparkles, Sun, Smartphone, Clapperboard } from 'lucide-react';
import type {
  AppState,
  CameraSnapshot,
  CharacterQuality,
  MmdLiteConfig,
  PathTracerSettings,
  PmxMaterialInfo,
  RtxSettings,
  StyleGalleryRuntimeState,
  ViewportFormat,
  VisualFxSettings,
} from '../types';
import { CHARACTER_QUALITY_PRESETS } from '../utils/characterQuality';
import { DEFAULT_RTX_SETTINGS, PORTRAIT_RTX_SETTINGS } from '../utils/rtxSettings';
import MmdRtxExtrasPanel from './MmdRtxExtrasPanel';
import VideoRecordPanel from './VideoRecordPanel';
import ShaderGalleryPanel from './stylePacks/ShaderGalleryPanel';
import MaterialInspectorPanel from './stylePacks/MaterialInspectorPanel';
import type { useVisualStyles } from '../stylePacks/useVisualStyles';
import type { SmartVideoMetadata, SmartMetadataLocale, SocialPlatformId } from '../smartMetadata/types';
import type { CinematicEngineApi } from '../product/cinematic';
import type { VcsApi } from '../product/vcs';
import type { SceneComposerState } from '../sceneComposer';
import CinematicPanel from './cinematic/CinematicPanel';
import VcsDirectorPanel from './vcs/VcsDirectorPanel';
import LightingStudioPanel from './lighting/LightingStudioPanel';
import LutControls from './postfx/LutControls';
import BundledEffectsPanel from './standaloneEffects/BundledEffectsPanel';

type VisualStylesApi = ReturnType<typeof useVisualStyles>;

interface FxSettingsPanelProps {
  visualFx: VisualFxSettings;
  mmdLite?: MmdLiteConfig;
  rtxModeEnabled: boolean;
  rtxSettings: RtxSettings;
  characterQuality: CharacterQuality;
  viewportFormat?: ViewportFormat;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchMmdLite?: (patch: Partial<MmdLiteConfig>) => void;
  onSetRtxModeEnabled: (enabled: boolean) => void;
  onPatchRtxSettings: (patch: Partial<RtxSettings>) => void;
  onCharacterQualityChange: (quality: CharacterQuality) => void;
  captureCamera?: () => CameraSnapshot | null;
  onFlyToBookmark?: (snapshot: CameraSnapshot) => void;
  onRestartPhysics?: () => void;
  onFixPhysics?: () => void;
  videoRecordBusy?: boolean;
  videoRecordMode?: 'idle' | 'offline' | 'live';
  exportDurationSec?: number;
  maxExportDurationSec?: number;
  onExportDurationSecChange?: (sec: number) => void;
  onRenderMp4?: () => void;
  onLiveRecord?: () => void;
  onCinemaRender?: () => void;
  videoMetadata?: SmartVideoMetadata | null;
  showVideoInformation?: boolean;
  onRegenerateMetadata?: () => void;
  onMetadataLocaleChange?: (locale: SmartMetadataLocale) => void;
  onMetadataPlatformChange?: (platform: SocialPlatformId) => void;
  onMetadataTitleSelect?: (index: number) => void;
  onMetadataCopyFeedback?: (message: string) => void;
  pathTracerLabEnabled?: boolean;
  pathTracer?: PathTracerSettings;
  onSetPathTracerLabEnabled?: (enabled: boolean) => void;
  onPatchPathTracer?: (patch: Partial<PathTracerSettings>) => void;
  /** Open Smart Studio mode picker or enter a mode directly. */
  onOpenSmartStudio?: () => void;
  onEnterSmartStudioMode?: (mode: 'showcase' | 'photo' | 'video') => void;
  onOpenCineStudio?: () => void;
  onOpenReferenceCameraStudio?: () => void;
  visualStyles?: VisualStylesApi;
  styleGallery?: StyleGalleryRuntimeState;
  onPatchStyleGallery?: (patch: Partial<StyleGalleryRuntimeState>) => void;
  pmxMaterials?: PmxMaterialInfo[];
  highlightMaterial?: string | null;
  onSelectMaterial?: (name: string | null) => void;
  cinematicEngine?: CinematicEngineApi;
  vcs?: VcsApi;
  appState?: AppState;
  onPatchSceneComposer?: (patch: Partial<SceneComposerState>) => void;
  onReplaceSceneComposer?: (next: SceneComposerState) => void;
  onPatchSceneStudio?: (patch: Partial<import('../sceneStudio').SceneStudioState>) => void;
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
        className="w-full accent-[#76b900]"
        onClick={(e) => e.stopPropagation()}
      />
    </label>
  );
}

export default function FxSettingsPanel({
  visualFx,
  mmdLite,
  rtxModeEnabled,
  rtxSettings,
  characterQuality,
  viewportFormat = '16:9',
  onSetVisualFx,
  onPatchMmdLite,
  onSetRtxModeEnabled,
  onPatchRtxSettings,
  onCharacterQualityChange,
  captureCamera,
  onFlyToBookmark,
  onRestartPhysics,
  onFixPhysics,
  videoRecordBusy = false,
  videoRecordMode = 'idle',
  exportDurationSec = 30,
  maxExportDurationSec = 120,
  onExportDurationSecChange,
  onRenderMp4,
  onLiveRecord,
  onCinemaRender,
  videoMetadata,
  showVideoInformation,
  onRegenerateMetadata,
  onMetadataLocaleChange,
  onMetadataPlatformChange,
  onMetadataTitleSelect,
  onMetadataCopyFeedback,
  pathTracerLabEnabled = false,
  pathTracer,
  onSetPathTracerLabEnabled,
  onPatchPathTracer,
  onOpenSmartStudio,
  onEnterSmartStudioMode,
  onOpenCineStudio,
  onOpenReferenceCameraStudio,
  visualStyles,
  styleGallery,
  onPatchStyleGallery,
  pmxMaterials = [],
  highlightMaterial = null,
  onSelectMaterial,
  cinematicEngine,
  vcs,
  appState,
  onPatchSceneComposer,
  onReplaceSceneComposer,
  onPatchSceneStudio,
}: FxSettingsPanelProps) {
  const exposure = visualFx.toneExposure ?? 1;
  const vertical = viewportFormat === '9:16';

  return (
    <div
      className="space-y-3 p-1"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {(onOpenCineStudio || onOpenReferenceCameraStudio) ? (
        <div className="border border-cyan-500/35 rounded-md p-2 space-y-2 bg-cyan-950/20">
          <div className="text-[10px] font-bold text-cyan-200 flex items-center gap-1">
            <Clapperboard className="w-3 h-3" />
            Camera studios
          </div>
          <p className="text-[8px] text-zinc-500 leading-relaxed">
            Cine Studio (VCS) and Reference Camera Studio — open from here, not the viewport bar.
          </p>
          <div className="flex flex-col gap-1.5">
            {onOpenCineStudio ? (
              <button
                type="button"
                onClick={onOpenCineStudio}
                className="w-full text-[9px] font-bold px-2 py-2 rounded border border-cyan-500/40 bg-cyan-600/30 text-cyan-100 hover:bg-cyan-500/40 cursor-pointer"
              >
                Открыть Cine Studio
              </button>
            ) : null}
            {onOpenReferenceCameraStudio ? (
              <button
                type="button"
                onClick={onOpenReferenceCameraStudio}
                className="w-full text-[9px] font-bold px-2 py-2 rounded border border-pink-500/40 bg-pink-600/20 text-pink-100 hover:bg-pink-500/30 cursor-pointer"
              >
                Reference Camera Studio
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {appState && onPatchSceneComposer && onReplaceSceneComposer ? (
        <LightingStudioPanel
          appState={appState}
          onSetVisualFx={onSetVisualFx}
          onPatchComposer={onPatchSceneComposer}
          onReplaceComposer={onReplaceSceneComposer}
          onApplyCinematicLighting={vcs ? (id) => vcs.setLighting(id) : undefined}
          onPatchSceneStudio={onPatchSceneStudio}
        />
      ) : null}

      {vcs ? <VcsDirectorPanel api={vcs} compact /> : null}
      {!vcs && cinematicEngine ? <CinematicPanel api={cinematicEngine} compact /> : null}

      {(onOpenSmartStudio || onEnterSmartStudioMode) && (
        <div className="border border-violet-500/35 rounded-md p-2 space-y-2 bg-violet-950/20">
          <div className="text-[10px] font-bold text-violet-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Smart Studio
          </div>
          <p className="text-[8px] text-zinc-500 leading-relaxed">
            One-click showcase, photo or video — auto camera, lights, FX and framing.
          </p>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() =>
                onEnterSmartStudioMode
                  ? onEnterSmartStudioMode('showcase')
                  : onOpenSmartStudio?.()
              }
              className="text-[9px] font-bold px-1.5 py-1.5 rounded border border-violet-500/40 bg-violet-600/30 text-violet-100 hover:bg-violet-500/40 cursor-pointer"
            >
              Showcase
            </button>
            <button
              type="button"
              onClick={() =>
                onEnterSmartStudioMode
                  ? onEnterSmartStudioMode('photo')
                  : onOpenSmartStudio?.()
              }
              className="text-[9px] font-bold px-1.5 py-1.5 rounded border border-cyan-500/40 bg-cyan-600/25 text-cyan-100 hover:bg-cyan-500/35 cursor-pointer"
            >
              Photo
            </button>
            <button
              type="button"
              onClick={() =>
                onEnterSmartStudioMode
                  ? onEnterSmartStudioMode('video')
                  : onOpenSmartStudio?.()
              }
              className="text-[9px] font-bold px-1.5 py-1.5 rounded border border-rose-500/40 bg-rose-600/25 text-rose-100 hover:bg-rose-500/35 cursor-pointer"
            >
              Video
            </button>
          </div>
        </div>
      )}

      {vertical && (
        <div className="flex items-start gap-2 px-1 py-1.5 rounded-md bg-[#39c5bb]/10 border border-[#39c5bb]/25">
          <Smartphone className="w-3.5 h-3.5 text-[#39c5bb] shrink-0 mt-0.5" />
          <p className="text-[8px] text-[#39c5bb]/90 leading-relaxed">
            9:16 Lite: DPR 1×, no RTX/Bloom, shadows off — stable WebGL. Export 1080×1920 @ 30 FPS.
          </p>
        </div>
      )}

      {visualStyles && (
        <>
          <ShaderGalleryPanel
            visualStyles={visualStyles}
            developerMode={styleGallery?.developerMode}
          />
          {styleGallery && onPatchStyleGallery && onSelectMaterial && (
            <MaterialInspectorPanel
              materials={pmxMaterials}
              styleGallery={styleGallery}
              selectedMaterial={highlightMaterial}
              onSelectMaterial={onSelectMaterial}
              onPatchStyleGallery={onPatchStyleGallery}
              developerMode={styleGallery.developerMode}
            />
          )}
        </>
      )}

      {onSetPathTracerLabEnabled && pathTracer && onPatchPathTracer && (
        <div className="border border-amber-500/30 rounded-md p-2 space-y-2 bg-amber-950/15">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-amber-300">Path Tracer Lab</span>
            <button
              type="button"
              onClick={() => onSetPathTracerLabEnabled(!pathTracerLabEnabled)}
              className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
                pathTracerLabEnabled
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-700'
              }`}
            >
              {pathTracerLabEnabled ? 'OPEN' : 'OFF'}
            </button>
          </div>
          <p className="text-[8px] text-zinc-500 leading-relaxed">
            PMX/PMD: adaptive WebGPU path trace (resolution, tris, denoise auto-tuned). Hold camera
            still to refine. Empty scene → WebGL2 demo. Chrome/Edge + WebGPU required.
          </p>
          {!pathTracerLabEnabled && (
            <button
              type="button"
              onClick={() => onSetPathTracerLabEnabled(true)}
              className="w-full text-[9px] font-bold py-2 rounded border border-amber-500/40 text-amber-200 hover:bg-amber-950/30 cursor-pointer"
            >
              Open Path Tracer
            </button>
          )}
          {pathTracerLabEnabled && (
            <>
              <SliderRow
                label="Bounces"
                value={pathTracer.bounces}
                min={1}
                max={5}
                step={1}
                onChange={(v) => onPatchPathTracer({ bounces: Math.round(v) })}
              />
              <SliderRow
                label="Sun °"
                value={pathTracer.sunAltDeg}
                min={2}
                max={55}
                step={1}
                onChange={(v) => onPatchPathTracer({ sunAltDeg: Math.round(v) })}
              />
              <SliderRow
                label="Exposure"
                value={pathTracer.exposure}
                min={0.2}
                max={2.2}
                step={0.05}
                onChange={(v) => onPatchPathTracer({ exposure: v })}
              />
              <SliderRow
                label="Aperture"
                value={pathTracer.aperture}
                min={0}
                max={0.4}
                step={0.01}
                onChange={(v) => onPatchPathTracer({ aperture: v })}
              />
              <div className="border-t border-amber-900/40 pt-2 space-y-1.5">
                <p className="text-[8px] font-bold uppercase text-[#76b900] m-0">
                  OIDN AI denoise (local WebGPU)
                </p>
                <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pathTracer.oidnEnabled === true}
                    onChange={(e) => onPatchPathTracer({ oidnEnabled: e.target.checked })}
                  />
                  Intel OIDN (bundled rt_ldr weights)
                </label>
                {pathTracer.oidnEnabled ? (
                  <label className="flex items-center gap-2 text-[9px] text-zinc-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pathTracer.oidnPreferAi !== false}
                      onChange={(e) => onPatchPathTracer({ oidnPreferAi: e.target.checked })}
                    />
                    Prefer OIDN over compute denoise
                  </label>
                ) : null}
              </div>
            </>
          )}
        </div>
      )}

      <div className="border border-[#76b900]/30 rounded-md p-2 space-y-2 bg-[#76b900]/5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-[#76b900] flex items-center gap-1">
            <Aperture className="w-3 h-3" /> FX RTX
          </span>
          <button
            type="button"
            onClick={() => onSetRtxModeEnabled(!rtxModeEnabled)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
              rtxModeEnabled
                ? 'bg-[#76b900]/20 text-[#a8e063] border-[#76b900]/50'
                : 'bg-zinc-900 text-zinc-500 border-zinc-700'
            }`}
          >
            {rtxModeEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {rtxModeEnabled && (
          <div className="space-y-2 pt-1 border-t border-[#76b900]/20">
            <SliderRow
              label="RTX AO (crevice shadows)"
              value={rtxSettings.aoIntensity}
              min={0.5}
              max={5}
              step={0.1}
              onChange={(v) => onPatchRtxSettings({ aoIntensity: v })}
            />
            <SliderRow
              label="RTX AO radius"
              value={rtxSettings.aoRadius}
              min={0.15}
              max={0.8}
              step={0.02}
              onChange={(v) => onPatchRtxSettings({ aoRadius: v })}
            />
            <SliderRow
              label="RTX Bloom"
              value={rtxSettings.rtxBloomStrength}
              min={0}
              max={0.35}
              step={0.01}
              onChange={(v) => onPatchRtxSettings({ rtxBloomStrength: v })}
            />
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-zinc-500">AO quality</span>
              <select
                value={rtxSettings.aoQuality}
                onChange={(e) =>
                  onPatchRtxSettings({
                    aoQuality: e.target.value as RtxSettings['aoQuality'],
                  })
                }
                className="text-[9px] bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-zinc-300"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="performance">Fast</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[9px] text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rtxSettings.halfResAo}
                onChange={(e) => onPatchRtxSettings({ halfResAo: e.target.checked })}
                className="accent-[#76b900]"
              />
              AO half-res (faster)
            </label>
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <div className="text-[9px] font-bold uppercase text-zinc-500 tracking-wide">
          Character quality
        </div>
        <div className="flex gap-1">
          {(['standard', 'hd', 'uhd4k'] as CharacterQuality[]).map((id) => {
            const p = CHARACTER_QUALITY_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onCharacterQualityChange(id)}
                className={`flex-1 py-1 text-[9px] font-bold rounded border cursor-pointer ${
                  characterQuality === id
                    ? 'border-[#39c5bb]/50 bg-[#39c5bb]/15 text-[#39c5bb]'
                    : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
                title={p.subtitle}
              >
                {p.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <SliderRow
          label="Brightness (exposure)"
          value={exposure}
          min={0.55}
          max={1.25}
          step={0.02}
          onChange={(v) => onSetVisualFx({ toneExposure: v })}
        />
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#e879ff]" /> Bloom
          </span>
          <button
            type="button"
            onClick={() => onSetVisualFx({ bloomEnabled: !visualFx.bloomEnabled })}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
              visualFx.bloomEnabled
                ? 'bg-[#e879ff]/20 text-[#f0d0ff] border-[#e879ff]/40'
                : 'bg-zinc-900 text-zinc-500 border-zinc-700'
            }`}
          >
            {visualFx.bloomEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {visualFx.bloomEnabled && (
          <>
            <SliderRow
              label="Bloom strength"
              value={visualFx.bloomIntensity}
              min={0.05}
              max={0.65}
              step={0.02}
              onChange={(v) => onSetVisualFx({ bloomIntensity: v })}
            />
            <SliderRow
              label="Bloom threshold"
              value={visualFx.bloomThreshold}
              min={0.55}
              max={1.05}
              step={0.02}
              onChange={(v) => onSetVisualFx({ bloomThreshold: v })}
            />
          </>
        )}
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-300 flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-300" /> Background blur (DOF)
          </span>
          <button
            type="button"
            onClick={() => onSetVisualFx({ dofEnabled: !visualFx.dofEnabled })}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
              visualFx.dofEnabled
                ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-500 border-zinc-700'
            }`}
          >
            {visualFx.dofEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {visualFx.dofEnabled && (
          <SliderRow
            label="Bokeh strength"
            value={visualFx.dofBokehScale ?? 1}
            min={0.4}
            max={2.5}
            step={0.1}
            onChange={(v) => onSetVisualFx({ dofBokehScale: v })}
          />
        )}
      </div>

      <LutControls visualFx={visualFx} onSetVisualFx={onSetVisualFx} />
      <BundledEffectsPanel visualFx={visualFx} onSetVisualFx={onSetVisualFx} />

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <div className="text-[9px] font-bold uppercase text-zinc-500 tracking-wide">
          Render Pipeline
        </div>
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          ASRP (default) adds Silhouette POM depth to materials. Classic keeps MMD toon. RTX Lite
          stacks POM with probes, AO and bloom.
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              onSetVisualFx({
                renderMode: 'mmd_fidelity',
                materialDetailing: true,
                bloomEnabled: true,
                bloomIntensity: Math.min(visualFx.bloomIntensity ?? 0.42, 0.38),
                toneExposure: 0.9,
                colorGrade: 'anime',
              });
              onSetRtxModeEnabled(false);
            }}
            className={`flex-1 py-1.5 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
              visualFx.renderMode === 'mmd_fidelity'
                ? 'border-pink-500/50 text-pink-200 bg-pink-500/10'
                : 'border-zinc-700 text-zinc-400 hover:border-pink-500/40'
            }`}
          >
            Classic
          </button>
          <button
            type="button"
            onClick={() => {
              onSetVisualFx({
                renderMode: 'asrp',
                materialDetailing: true,
                colorGrade: 'cinematic',
              });
              onSetRtxModeEnabled(false);
            }}
            className={`flex-1 py-1.5 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
              (visualFx.renderMode ?? 'asrp') === 'asrp' ||
              visualFx.renderMode === 'pbr_cinematic'
                ? 'border-cyan-500/50 text-cyan-200 bg-cyan-500/10'
                : 'border-zinc-700 text-zinc-400 hover:border-cyan-500/40'
            }`}
          >
            ASRP
          </button>
          <button
            type="button"
            onClick={() => {
              onSetVisualFx({
                renderMode: 'asrp',
                materialDetailing: true,
                colorGrade: 'cinematic',
                ssaoEnabled: true,
                bloomEnabled: true,
                floorReflection: Math.max(visualFx.floorReflection ?? 0.78, 0.92),
              });
              onSetRtxModeEnabled(true);
            }}
            className={`flex-1 py-1.5 text-[9px] font-bold rounded border cursor-pointer transition-colors ${
              rtxModeEnabled
                ? 'border-violet-500/50 text-violet-200 bg-violet-500/10'
                : 'border-zinc-700 text-zinc-400 hover:border-violet-500/40'
            }`}
          >
            RTX Lite
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-2">
        <div className="text-[9px] font-bold uppercase text-zinc-500 tracking-wide">
          Lite EffectComposer (SSAO / SMAA / God Rays)
        </div>
        <p className="text-[8px] text-zinc-600 leading-relaxed">
          Drag .hdr onto the viewport for IBL. Drop .cube / .3dl for custom LUT. 9:16 — SMAA + vignette only.
        </p>
        {(
          [
            ['postFxStackEnabled', 'Post-FX stack'],
            ['ssaoEnabled', 'SSAO (half-res)'],
            ['smaaEnabled', 'SMAA (TAA-lite)'],
            ['godRaysEnabled', 'God rays (unsupported)'],
            ['letterbox239', 'Letterbox 2.39'],
            ['materialDetailing', 'Material detailing'],
            ['vignetteEnabled', 'Vignette'],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 text-[9px] font-bold text-zinc-400 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={visualFx[key] !== false}
              onChange={(e) => onSetVisualFx({ [key]: e.target.checked })}
              className="accent-cyan-500"
            />
            {label}
          </label>
        ))}
        <SliderRow
          label="Material smoothing"
          value={visualFx.materialSmoothing ?? 0.55}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onSetVisualFx({ materialSmoothing: v })}
        />
      </div>

      <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() =>
              onSetVisualFx({
                bloomEnabled: false,
                dofEnabled: false,
                toneExposure: 0.92,
              })
            }
            className="flex-1 py-1.5 text-[9px] font-bold rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500 cursor-pointer"
          >
            Clean
          </button>
          <button
            type="button"
            onClick={() => {
              onSetRtxModeEnabled(true);
              onPatchRtxSettings(PORTRAIT_RTX_SETTINGS);
              onSetVisualFx({
                bloomEnabled: false,
                dofEnabled: false,
                toneExposure: 0.9,
              });
              onCharacterQualityChange('uhd4k');
            }}
            className="flex-1 py-1.5 text-[9px] font-bold rounded border border-[#39c5bb]/40 text-[#39c5bb] hover:bg-[#39c5bb]/10 cursor-pointer"
          >
            9:16 RTX
          </button>
        </div>
      {onRenderMp4 && onLiveRecord && onExportDurationSecChange && (
        <VideoRecordPanel
          busy={videoRecordBusy}
          mode={videoRecordMode}
          exportDurationSec={exportDurationSec}
          maxDurationSec={maxExportDurationSec}
          onExportDurationSecChange={onExportDurationSecChange}
          onRenderMp4={onRenderMp4}
          onLiveRecord={onLiveRecord}
          onCinemaRender={onCinemaRender}
          vertical={vertical}
          videoMetadata={videoMetadata}
          showVideoInformation={showVideoInformation}
          onRegenerateMetadata={onRegenerateMetadata}
          onMetadataLocaleChange={onMetadataLocaleChange}
          onMetadataPlatformChange={onMetadataPlatformChange}
          onMetadataTitleSelect={onMetadataTitleSelect}
          onMetadataCopyFeedback={onMetadataCopyFeedback}
        />
      )}

      {mmdLite && onPatchMmdLite && captureCamera && (
        <MmdRtxExtrasPanel
          visualFx={visualFx}
          mmdLite={mmdLite}
          onSetVisualFx={onSetVisualFx}
          onPatchMmdLite={onPatchMmdLite}
          captureCamera={captureCamera}
          onFlyToBookmark={onFlyToBookmark}
          onRestartPhysics={onRestartPhysics}
          onFixPhysics={onFixPhysics}
        />
      )}

        <button
          type="button"
          onClick={() => {
            onSetRtxModeEnabled(true);
            onPatchRtxSettings(DEFAULT_RTX_SETTINGS);
          }}
          className="w-full py-1 text-[9px] font-bold rounded border border-[#76b900]/30 text-[#76b900] hover:bg-[#76b900]/10 cursor-pointer"
        >
          RTX defaults
        </button>
      </div>
    </div>
  );
}
