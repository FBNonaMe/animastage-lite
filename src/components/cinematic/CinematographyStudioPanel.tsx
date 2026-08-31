import { useCallback, useMemo, useState } from 'react';
import {
  Aperture,
  Camera,
  Clapperboard,
  Film,
  Layers,
  Scan,
  Sparkles,
  Sun,
  Target,
  Upload,
  User,
  Video,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import type { AppState, VisualFxSettings } from '../../types';
import type { SceneComposerState } from '../../sceneComposer';
import type { CinematicEngineApi } from '../../product/cinematic';
import type { VcsApi, VcsFocusTarget } from '../../product/vcs';
import { VCS_DIRECTOR_MODES } from '../../product/vcs';
import VcsDirectorPanel from '../vcs/VcsDirectorPanel';
import LightingStudioPanel from '../lighting/LightingStudioPanel';

type StudioTab =
  | 'overview'
  | 'director'
  | 'camera'
  | 'character'
  | 'lighting'
  | 'shots'
  | 'render'
  | 'reference';

const TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" /> },
  { id: 'director', label: 'Director', icon: <Clapperboard className="w-3.5 h-3.5" /> },
  { id: 'camera', label: 'Camera', icon: <Camera className="w-3.5 h-3.5" /> },
  { id: 'character', label: 'Character', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'lighting', label: 'Lighting', icon: <Sun className="w-3.5 h-3.5" /> },
  { id: 'shots', label: 'Shots', icon: <Film className="w-3.5 h-3.5" /> },
  { id: 'render', label: 'Render', icon: <Aperture className="w-3.5 h-3.5" /> },
  { id: 'reference', label: 'Reference', icon: <Upload className="w-3.5 h-3.5" /> },
];

const MODULES = [
  { id: 1, name: 'Camera Director', tab: 'director' as StudioTab },
  { id: 2, name: 'Character Analysis', tab: 'character' as StudioTab },
  { id: 3, name: 'Safe Camera System', tab: 'camera' as StudioTab },
  { id: 4, name: 'Dynamic Camera Volume', tab: 'camera' as StudioTab },
  { id: 5, name: 'Smart Camera Target', tab: 'camera' as StudioTab },
  { id: 6, name: 'Virtual Camera Operator', tab: 'camera' as StudioTab },
  { id: 7, name: 'Smart Zoom', tab: 'camera' as StudioTab },
  { id: 8, name: 'Camera Composition', tab: 'camera' as StudioTab },
  { id: 9, name: 'Camera Collision', tab: 'camera' as StudioTab },
  { id: 10, name: 'Camera Timeline', tab: 'shots' as StudioTab },
  { id: 11, name: 'Manual Camera Creator', tab: 'camera' as StudioTab },
  { id: 12, name: 'Camera Gizmo', tab: 'camera' as StudioTab },
  { id: 13, name: 'Lighting Studio', tab: 'lighting' as StudioTab },
  { id: 14, name: 'Lighting Presets', tab: 'lighting' as StudioTab },
  { id: 15, name: 'Shot Manager', tab: 'shots' as StudioTab },
  { id: 16, name: 'Reference Video Analyzer', tab: 'reference' as StudioTab },
  { id: 17, name: 'Auto Director', tab: 'director' as StudioTab },
  { id: 18, name: 'Render Quality', tab: 'render' as StudioTab },
  { id: 19, name: 'Adaptive Performance', tab: 'render' as StudioTab },
];

const FOCUS_TARGETS: { id: VcsFocusTarget; label: string }[] = [
  { id: 'face', label: 'Face' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest' },
  { id: 'com', label: 'Center' },
  { id: 'feet', label: 'Feet' },
];

export interface CinematographyStudioPanelProps {
  appState: AppState;
  vcs: VcsApi;
  cinematicEngine?: CinematicEngineApi;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchSceneComposer: (patch: Partial<SceneComposerState>) => void;
  onReplaceSceneComposer: (next: SceneComposerState) => void;
  onPatchSceneStudio?: (patch: Partial<import('../../sceneStudio').SceneStudioState>) => void;
  onEnterDirectCameraMode?: () => void;
  onRegisterCameraKeyframe?: () => void;
  onPatchCameraStudio?: (patch: Partial<AppState['cameraStudio']>) => void;
  onSetRtxModeEnabled?: (enabled: boolean) => void;
  onOpenReferenceCameraStudio?: () => void;
  onClose?: () => void;
  embedded?: boolean;
}

export default function CinematographyStudioPanel({
  appState,
  vcs,
  cinematicEngine,
  onSetVisualFx,
  onPatchSceneComposer,
  onReplaceSceneComposer,
  onPatchSceneStudio,
  onEnterDirectCameraMode,
  onRegisterCameraKeyframe,
  onPatchCameraStudio,
  onSetRtxModeEnabled,
  onOpenReferenceCameraStudio,
  onClose,
  embedded = false,
}: CinematographyStudioPanelProps) {
  const [tab, setTab] = useState<StudioTab>('overview');
  const [newCamName, setNewCamName] = useState('Camera A');
  const [newShotName, setNewShotName] = useState('Shot 01');
  const [refBusy, setRefBusy] = useState(false);

  const vcsState = vcs.getState();
  const profile = vcs.getActiveProfile();
  const cinematic = appState.cinematic;
  const profiles = Object.values(vcsState.characterProfiles);

  const moduleActive = useMemo(() => {
    const s = vcsState;
    return {
      1: s.enabled,
      2: profiles.length > 0,
      3: s.safeCamera,
      4: s.showSafeVolumeGizmo,
      5: Boolean(s.focusTarget),
      6: s.handheld,
      7: s.smartZoom,
      8: s.composition,
      9: s.safeCamera,
      10: appState.cameraKeyframes.length > 0,
      11: s.cameras.length > 0 || appState.cameraStudio.directPlacement,
      12: appState.cameraStudio.directPlacement !== false,
      13: true,
      14: Boolean(s.lightingPreset),
      15: s.shots.length > 0,
      16: Boolean(s.referenceAnalysis),
      17: s.variations.length > 0,
      18: appState.visualFx.bloomEnabled || appState.rtxModeEnabled,
      19: s.adaptivePerformance,
    } as Record<number, boolean>;
  }, [vcsState, profiles.length, appState]);

  const handleReferenceUpload = useCallback(
    async (file: File) => {
      setRefBusy(true);
      try {
        await vcs.analyzeReference(file);
        vcs.enableSystem();
        setTab('reference');
      } finally {
        setRefBusy(false);
      }
    },
    [vcs]
  );

  return (
    <div
      className={`flex flex-col h-full bg-[#080a0f]/98 border border-cyan-500/20 ${
        embedded ? '' : 'rounded-2xl shadow-2xl'
      }`}
    >
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 bg-gradient-to-r from-cyan-950/40 to-violet-950/30">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
          <Video className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-white truncate">Cinematography Studio</h2>
          <p className="text-[9px] text-zinc-500">Virtual Cinematography System — 19 modules</p>
        </div>
        <button
          type="button"
          onClick={() => vcs.enableSystem()}
          className={`px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer ${
            vcsState.enabled
              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : 'border-zinc-600 text-zinc-400 hover:border-cyan-500/40'
          }`}
        >
          {vcsState.enabled ? 'VCS ON' : 'Enable VCS'}
        </button>
        {onClose ? (
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        ) : null}
      </header>

      <nav className="shrink-0 flex gap-0.5 px-2 py-1.5 overflow-x-auto border-b border-zinc-800/80">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide cursor-pointer ${
              tab === t.id
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {tab === 'overview' && (
          <div className="space-y-3">
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Все модули Virtual Cinematography System. Зелёный = активен. Нажми на модуль, чтобы
              перейти к настройкам.
            </p>
            <div className="grid grid-cols-1 gap-1">
              {MODULES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTab(m.tab)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-zinc-800/80 hover:border-cyan-500/30 text-left cursor-pointer"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      moduleActive[m.id] ? 'bg-emerald-400' : 'bg-zinc-600'
                    }`}
                  />
                  <span className="text-[9px] text-zinc-500 w-5">{m.id}</span>
                  <span className="text-[10px] font-semibold text-zinc-200 flex-1">{m.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'director' && <VcsDirectorPanel api={vcs} />}

        {tab === 'camera' && (
          <div className="space-y-3">
            <Section title="Manual placement (Module 11–12)" icon={<Camera className="w-3.5 h-3.5" />}>
              <div className="flex flex-wrap gap-2">
                <ActionBtn label="Move Cam + Gizmo" onClick={onEnterDirectCameraMode} primary />
                <ActionBtn
                  label="Save Keyframe"
                  onClick={onRegisterCameraKeyframe}
                />
                <ToggleBtn
                  label="Direct Gizmo"
                  on={appState.cameraStudio.directPlacement !== false}
                  onChange={(v) => onPatchCameraStudio?.({ directPlacement: v })}
                />
                <ToggleBtn
                  label="Safe Volume"
                  on={vcsState.showSafeVolumeGizmo}
                  onChange={(v) => vcs.patch({ showSafeVolumeGizmo: v, enabled: true })}
                />
              </div>
              <p className="text-[9px] text-zinc-500 mt-1">
                Голубой ромб = камера, розовая сфера = точка взгляда. ЛКМ орбита, колесо зум.
              </p>
            </Section>

            <Section title="Safe camera & operator (3–9)" icon={<Target className="w-3.5 h-3.5" />}>
              <div className="flex flex-wrap gap-1 mb-2">
                {FOCUS_TARGETS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => vcs.setFocusTarget(f.id)}
                    className={`px-2 py-1 rounded text-[9px] font-bold border cursor-pointer ${
                      vcsState.focusTarget === f.id
                        ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <ToggleBtn label="Safe Cam" on={vcsState.safeCamera} onChange={(v) => vcs.patch({ safeCamera: v, enabled: true })} />
                <ToggleBtn label="Collision" on={vcsState.safeCamera} onChange={(v) => vcs.patch({ safeCamera: v })} />
                <ToggleBtn label="Handheld" on={vcsState.handheld} onChange={(v) => vcs.patch({ handheld: v, enabled: true })} />
                <ToggleBtn label="Composition" on={vcsState.composition} onChange={(v) => vcs.patch({ composition: v, enabled: true })} />
                <ToggleBtn label="Smart Zoom" on={vcsState.smartZoom} onChange={(v) => vcs.patch({ smartZoom: v, enabled: true })} />
              </div>
              <label className="block mt-2 text-[9px] text-zinc-500">
                Handheld intensity
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={vcsState.handheldIntensity}
                  onChange={(e) => vcs.patch({ handheldIntensity: parseFloat(e.target.value) })}
                  className="w-full accent-violet-400 mt-1"
                />
              </label>
            </Section>

            <Section title="Virtual cameras (11)" icon={<Video className="w-3.5 h-3.5" />}>
              <div className="flex gap-1 mb-2">
                <input
                  value={newCamName}
                  onChange={(e) => setNewCamName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    vcs.saveCameraFromTimeline(newCamName || 'Camera');
                    vcs.enableSystem();
                  }}
                  className="px-2 py-1 rounded bg-cyan-600/80 text-[9px] font-bold text-white cursor-pointer"
                >
                  Save
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {vcsState.cameras.length === 0 ? (
                  <p className="text-[9px] text-zinc-600">No virtual cameras yet — save from timeline.</p>
                ) : (
                  vcsState.cameras.map((cam) => (
                    <div
                      key={cam.id}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-zinc-800 text-[9px]"
                    >
                      <span className="flex-1 truncate text-zinc-300">{cam.name}</span>
                      <button type="button" onClick={() => vcs.activateCamera(cam.id)} className="text-cyan-400 cursor-pointer">Use</button>
                      <button type="button" onClick={() => vcs.duplicateCamera(cam.id)} className="text-zinc-500 cursor-pointer">Dup</button>
                      <button type="button" onClick={() => vcs.deleteCamera(cam.id)} className="text-red-400 cursor-pointer">Del</button>
                    </div>
                  ))
                )}
              </div>
            </Section>

            <Section title="Director modes (1)" icon={<Clapperboard className="w-3.5 h-3.5" />}>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {VCS_DIRECTOR_MODES.slice(0, 8).map((m) => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => vcs.setDirectorMode(m.mode)}
                    className="px-2 py-0.5 rounded text-[8px] font-bold border border-zinc-700 text-zinc-400 hover:border-cyan-500/40 cursor-pointer"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Section>
          </div>
        )}

        {tab === 'character' && (
          <div className="space-y-2">
            <Section title="Character profile (Module 2)" icon={<Scan className="w-3.5 h-3.5" />}>
              {profiles.length === 0 ? (
                <p className="text-[10px] text-zinc-500">Load a PMX model — profile builds automatically.</p>
              ) : (
                profiles.map((p) => (
                  <div key={p.modelId} className="rounded-lg border border-zinc-800 p-2 text-[9px] space-y-1">
                    <p className="font-bold text-zinc-300">Model {p.modelId.slice(0, 8)}…</p>
                    <Stat label="Height" value={`${p.skeletonHeight.toFixed(1)} u`} />
                    <Stat label="Safe radius" value={`${p.safeCameraRadius.toFixed(1)} u`} />
                    <Stat label="Collision" value={`${p.collisionRadius.toFixed(1)} u`} />
                    <Stat label="Hair extent" value={`${p.hairExtent.toFixed(1)} u`} />
                    <Stat label="Physics bodies" value={String(p.physicsBodyCount)} />
                  </div>
                ))
              )}
              {profile ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2 text-[9px]">
                  <p className="text-emerald-300 font-bold mb-1">Merged focus</p>
                  <Stat label="COM" value={profile.centerOfMass.map((n) => n.toFixed(1)).join(', ')} />
                  <Stat label="Face" value={profile.facePosition.map((n) => n.toFixed(1)).join(', ')} />
                </div>
              ) : null}
            </Section>
          </div>
        )}

        {tab === 'lighting' && (
          <LightingStudioPanel
            appState={appState}
            onSetVisualFx={onSetVisualFx}
            onPatchComposer={onPatchSceneComposer}
            onReplaceComposer={onReplaceSceneComposer}
            onApplyCinematicLighting={(id) => vcs.setLighting(id)}
            onPatchSceneStudio={onPatchSceneStudio}
          />
        )}

        {tab === 'shots' && (
          <div className="space-y-3">
            <Section title="Shot manager (10, 15)" icon={<Film className="w-3.5 h-3.5" />}>
              <div className="flex gap-1 mb-2">
                <input
                  value={newShotName}
                  onChange={(e) => setNewShotName(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    vcs.addShot(newShotName || `Shot ${vcsState.shots.length + 1}`);
                    vcs.enableSystem();
                  }}
                  className="px-2 py-1 rounded bg-violet-600/80 text-[9px] font-bold text-white cursor-pointer"
                >
                  + Shot
                </button>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {vcsState.shots.map((shot, i) => (
                  <div key={shot.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-800 text-[9px]">
                    <span className="text-zinc-500">{i + 1}.</span>
                    <span className="flex-1 text-zinc-300">{shot.name}</span>
                    <span className="text-zinc-600">{shot.startFrame}–{shot.endFrame}f</span>
                    <button type="button" onClick={() => vcs.deleteShot(shot.id)} className="text-red-400 cursor-pointer">Del</button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => vcs.applyShots()}
                disabled={vcsState.shots.length === 0}
                className="w-full mt-2 py-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-[10px] font-bold text-violet-200 cursor-pointer disabled:opacity-40"
              >
                Apply all shots → Camera timeline
              </button>
              <p className="text-[9px] text-zinc-600 mt-1">
                Timeline keys: {appState.cameraKeyframes.length} · Mode: {appState.cameraMode}
              </p>
            </Section>
          </div>
        )}

        {tab === 'render' && (
          <div className="space-y-3">
            <Section title="Render quality (18)" icon={<Sparkles className="w-3.5 h-3.5" />}>
              <div className="flex flex-wrap gap-1 mb-2">
                {(['auto', 'low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => vcs.patchRenderQuality(q, vcsState.adaptivePerformance)}
                    className={`px-2 py-1 rounded text-[9px] font-bold border cursor-pointer ${
                      vcsState.renderQuality === q
                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <ToggleBtn
                label="Adaptive performance (19)"
                on={vcsState.adaptivePerformance}
                onChange={(v) => vcs.patchRenderQuality(vcsState.renderQuality, v)}
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                <ToggleBtn label="Bloom" on={appState.visualFx.bloomEnabled} onChange={(v) => vcs.patchVisualFx({ bloomEnabled: v })} />
                <ToggleBtn label="SSAO" on={appState.visualFx.ssaoEnabled !== false} onChange={(v) => vcs.patchVisualFx({ ssaoEnabled: v })} />
                <ToggleBtn label="DOF" on={appState.visualFx.dofEnabled} onChange={(v) => vcs.patchVisualFx({ dofEnabled: v })} />
                <ToggleBtn label="Vignette" on={appState.visualFx.vignetteEnabled} onChange={(v) => vcs.patchVisualFx({ vignetteEnabled: v })} />
                <ToggleBtn label="RTX" on={appState.rtxModeEnabled} onChange={(v) => onSetRtxModeEnabled?.(v)} />
              </div>
              <label className="block mt-2 text-[9px] text-zinc-500">
                Exposure
                <input
                  type="range"
                  min={0.4}
                  max={1.6}
                  step={0.02}
                  value={appState.visualFx.toneExposure ?? 1}
                  onChange={(e) => vcs.patchVisualFx({ toneExposure: parseFloat(e.target.value) })}
                  className="w-full accent-amber-400 mt-1"
                />
              </label>
              <button
                type="button"
                onClick={() => vcs.analyzeQuality()}
                className="w-full mt-2 py-2 rounded-xl border border-cyan-500/30 text-[10px] font-bold text-cyan-200 cursor-pointer"
              >
                Analyze visual quality
              </button>
            </Section>
          </div>
        )}

        {tab === 'reference' && (
          <div className="space-y-3">
            <Section title="Reference video (16)" icon={<Upload className="w-3.5 h-3.5" />}>
              <p className="text-[9px] text-zinc-500 mb-2">
                Import a reference clip — analyze mood, or open Reference Camera Studio for
                overlay / keyframe directing. Guide only — never in the final render.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border border-dashed border-zinc-700 hover:border-cyan-500/40 cursor-pointer">
                <Upload className="w-6 h-6 text-zinc-500" />
                <span className="text-[10px] font-bold text-zinc-400">
                  {refBusy ? 'Analyzing…' : 'Upload reference video'}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={refBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleReferenceUpload(f);
                  }}
                />
              </label>
              {vcsState.referenceVideoName ? (
                <p className="text-[9px] text-cyan-400">File: {vcsState.referenceVideoName}</p>
              ) : null}
              {vcsState.referenceAnalysis ? (
                <pre className="text-[9px] text-zinc-400 whitespace-pre-wrap rounded-lg border border-zinc-800 p-2 max-h-40 overflow-y-auto">
                  {vcsState.referenceAnalysis}
                </pre>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onOpenReferenceCameraStudio?.();
                  onClose?.();
                }}
                className="w-full mt-2 py-2 rounded-xl border border-pink-500/40 bg-pink-500/10 text-[10px] font-bold text-pink-100 cursor-pointer"
              >
                Open Reference Camera Studio
              </button>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-[#0c0e14]/80 p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1">
        {icon}
        {title}
      </p>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-500">
      <span>{label}</span>
      <span className="text-zinc-300 font-mono">{value}</span>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  primary,
}: {
  label: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-lg text-[9px] font-bold cursor-pointer border ${
        primary
          ? 'bg-cyan-600/90 border-cyan-400/40 text-white'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
      }`}
    >
      {label}
    </button>
  );
}

function ToggleBtn({
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
        on ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200' : 'border-zinc-700 text-zinc-500'
      }`}
    >
      <Zap className="w-2.5 h-2.5" />
      {label}
    </button>
  );
}
