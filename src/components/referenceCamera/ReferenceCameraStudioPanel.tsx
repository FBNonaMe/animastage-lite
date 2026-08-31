import { useCallback, useRef, useState } from 'react';
import {
  Camera,
  Copy,
  Focus,
  Layers,
  ClipboardPaste,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  CopyPlus,
} from 'lucide-react';
import type { AppState, CameraEasingId, CameraKeyframe, ViewportFormat } from '../../types';
import {
  CAMERA_EASING_OPTIONS,
  CAMERA_SHOT_PRESETS,
  DEFAULT_REFERENCE_CAMERA,
  FOLLOW_TARGET_OPTIONS,
  FRAMING_MODE_OPTIONS,
  REFERENCE_VIDEO_ACCEPT,
  type CompositionGuideId,
  type FramingModeId,
  type ReferenceCameraState,
  type ReferenceViewMode,
  autoMatchCameraFromReference,
  duplicateCameraKeyframe,
  moveCameraKeyframe,
  patchCameraKeyframe,
  recommendCompositionPlacement,
  shotPresetToKeyframe,
  smoothCameraKeyframes,
  snapshotFromKeyframe,
} from '../../referenceCamera';
import { VIEWPORT_FORMAT_OPTIONS } from '../../utils/viewportFormat';
import CameraTemplateLibraryPanel from './CameraTemplateLibraryPanel';

const GUIDE_OPTIONS: { id: CompositionGuideId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'thirds', label: 'Rule of Thirds' },
  { id: 'golden', label: 'Golden Ratio' },
  { id: 'center', label: 'Center' },
  { id: 'safe', label: 'Safe Area' },
  { id: 'action_safe', label: 'Action Safe' },
  { id: 'title_safe', label: 'Title Safe' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'social', label: 'Social Media' },
];

interface ReferenceCameraStudioPanelProps {
  appState: AppState;
  rcs: ReferenceCameraState;
  viewportFormat: ViewportFormat;
  onPatchRcs: (patch: Partial<ReferenceCameraState>) => void;
  onSetCameraKeyframes: (keyframes: CameraKeyframe[]) => void;
  onRegisterCameraKeyframe: () => void;
  onSetCurrentFrame: (frame: number) => void;
  onSetCameraMode: (mode: AppState['cameraMode']) => void;
  onViewportFormatChange: (format: ViewportFormat) => void;
  onClose?: () => void;
}

export default function ReferenceCameraStudioPanel({
  appState,
  rcs,
  viewportFormat,
  onPatchRcs,
  onSetCameraKeyframes,
  onRegisterCameraKeyframe,
  onSetCurrentFrame,
  onSetCameraMode,
  onViewportFormatChange,
  onClose,
}: ReferenceCameraStudioPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<string | null>(null);
  const keys = appState.cameraKeyframes;
  const selected = keys.find((k) => k.id === selectedId) ?? null;

  const importVideo = useCallback(
    async (file: File) => {
      const blobUrl = URL.createObjectURL(file);
      const meta = await probeVideo(file, blobUrl);
      if (rcs.reference?.blobUrl) {
        URL.revokeObjectURL(rcs.reference.blobUrl);
      }
      onPatchRcs({
        reference: {
          blobUrl,
          fileName: file.name,
          durationSec: meta.duration,
          width: meta.width,
          height: meta.height,
        },
        viewMode: rcs.viewMode === 'hidden' ? 'overlay' : rcs.viewMode,
      });
    },
    [onPatchRcs, rcs.reference?.blobUrl, rcs.viewMode]
  );

  const clearReference = useCallback(() => {
    if (rcs.reference?.blobUrl) URL.revokeObjectURL(rcs.reference.blobUrl);
    onPatchRcs({ reference: null, lastAutoMatchNotes: null });
  }, [onPatchRcs, rcs.reference?.blobUrl]);

  const applyPreset = useCallback(
    (presetId: string) => {
      const focus = appState.cameraOrbitAnchor ?? ([0, 10, 0] as [number, number, number]);
      const kf = shotPresetToKeyframe(presetId, appState.currentFrame, focus);
      onSetCameraMode('mmd');
      onSetCameraKeyframes(
        [...keys.filter((k) => k.frame !== kf.frame), kf].sort((a, b) => a.frame - b.frame)
      );
      setSelectedId(kf.id);
    },
    [appState.cameraOrbitAnchor, appState.currentFrame, keys, onSetCameraKeyframes, onSetCameraMode]
  );

  const runSmooth = useCallback(() => {
    onSetCameraKeyframes(smoothCameraKeyframes(keys));
    onPatchRcs({
      lastAutoMatchNotes:
        'Smooth Camera applied — gimbal stabilize, speed normalize, timing preserved.',
    });
  }, [keys, onPatchRcs, onSetCameraKeyframes]);

  const runAutoMatch = useCallback(async () => {
    if (!rcs.reference) return;
    setBusy(true);
    try {
      const res = await fetch(rcs.reference.blobUrl);
      const blob = await res.blob();
      const file = new File([blob], rcs.reference.fileName, { type: blob.type || 'video/mp4' });
      const result = await autoMatchCameraFromReference(
        file,
        appState.maxFrames,
        appState.cameraOrbitAnchor?.[1] ?? 10,
        viewportFormat
      );
      onSetCameraMode('mmd');
      onSetCameraKeyframes(result.keyframes);
      setRecommendedTemplateId(result.recommendedId);
      onPatchRcs({
        lastAutoMatchNotes: result.notes,
        showPath: true,
      });
      if (result.keyframes[0]) setSelectedId(result.keyframes[0].id);
    } finally {
      setBusy(false);
    }
  }, [
    appState.cameraOrbitAnchor,
    appState.maxFrames,
    onPatchRcs,
    onSetCameraKeyframes,
    onSetCameraMode,
    rcs.reference,
    viewportFormat,
  ]);

  const copyPose = useCallback(() => {
    if (!selected) return;
    onPatchRcs({ clipboard: snapshotFromKeyframe(selected) });
  }, [onPatchRcs, selected]);

  const pastePose = useCallback(() => {
    if (!rcs.clipboard) return;
    const snap = rcs.clipboard;
    const id = `cam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const kf: CameraKeyframe = {
      id,
      frame: appState.currentFrame,
      position: [...snap.position],
      rotation: [...snap.rotation],
      fov: snap.fov,
      target: [...snap.target],
      easing: 'cinematic',
    };
    onSetCameraMode('mmd');
    onSetCameraKeyframes(
      [...keys.filter((k) => k.frame !== kf.frame), kf].sort((a, b) => a.frame - b.frame)
    );
    setSelectedId(id);
  }, [appState.currentFrame, keys, onSetCameraKeyframes, onSetCameraMode, rcs.clipboard]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0a0c10] text-zinc-200 border-l border-zinc-800/80">
      <header className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-800/80">
        <Camera className="w-4 h-4 text-cyan-400" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-zinc-100 truncate">
            Cinematic Camera 2.0
          </h2>
          <p className="text-[9px] text-zinc-500 truncate">Gimbal-smooth directing — few keys, cinematic motion</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0">
        {/* Reference import */}
        <Section title="Reference video" icon={<Upload className="w-3 h-3" />}>
          <p className="text-[9px] text-zinc-500 mb-2">
            Guide only — never included in the final render. MP4, MOV, WEBM, AVI, GIF.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={REFERENCE_VIDEO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importVideo(f);
              e.target.value = '';
            }}
          />
          <div className="flex gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-2 py-1.5 rounded-lg bg-cyan-600/80 text-[9px] font-bold text-white cursor-pointer"
            >
              Import video
            </button>
            {rcs.reference ? (
              <button
                type="button"
                onClick={clearReference}
                className="px-2 py-1.5 rounded-lg border border-zinc-700 text-[9px] text-zinc-400 cursor-pointer"
              >
                Clear
              </button>
            ) : null}
          </div>
          {rcs.reference ? (
            <p className="mt-1.5 text-[9px] text-cyan-400/90 truncate">{rcs.reference.fileName}</p>
          ) : null}

          <div className="mt-2 grid grid-cols-3 gap-1">
            {(
              [
                ['overlay', 'Overlay'],
                ['side_by_side', 'Side-by-side'],
                ['hidden', 'Hide'],
              ] as [ReferenceViewMode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onPatchRcs({ viewMode: id })}
                className={`px-1.5 py-1 rounded text-[8px] font-bold border cursor-pointer ${
                  rcs.viewMode === id
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                    : 'border-zinc-700 text-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block mt-2 text-[9px] text-zinc-500">
            Overlay opacity
            <input
              type="range"
              min={0.05}
              max={0.85}
              step={0.05}
              value={rcs.overlayOpacity}
              onChange={(e) => onPatchRcs({ overlayOpacity: parseFloat(e.target.value) })}
              className="w-full accent-cyan-400 mt-1"
            />
          </label>
          <Toggle
            label="Sync to playhead"
            on={rcs.syncFrames}
            onChange={(v) => onPatchRcs({ syncFrames: v })}
          />
        </Section>

        {/* Aspect + guides */}
        <Section title="Framing" icon={<Layers className="w-3 h-3" />}>
          <div className="flex flex-wrap gap-1 mb-2">
            {VIEWPORT_FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onViewportFormatChange(opt.id)}
                className={`px-2 py-1 rounded text-[8px] font-bold border cursor-pointer ${
                  viewportFormat === opt.id
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                    : 'border-zinc-700 text-zinc-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="block text-[9px] text-zinc-500">
            Composition guide
            <select
              value={rcs.compositionGuide}
              onChange={(e) => {
                const guide = e.target.value as CompositionGuideId;
                const focus = appState.cameraOrbitAnchor ?? ([0, 10, 0] as [number, number, number]);
                const rec = recommendCompositionPlacement(guide, focus);
                onPatchRcs({ compositionGuide: guide, compositionHint: rec.note });
              }}
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200"
            >
              {GUIDE_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          {rcs.compositionHint ? (
            <p className="mt-1 text-[8px] text-cyan-400/80">{rcs.compositionHint}</p>
          ) : null}
          <label className="block mt-2 text-[9px] text-zinc-500">
            Character framing
            <select
              value={rcs.framingMode ?? 'auto_reframe'}
              onChange={(e) =>
                onPatchRcs({ framingMode: e.target.value as FramingModeId })
              }
              className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-200"
            >
              {FRAMING_MODE_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 space-y-1">
            <Toggle
              label="Portrait keep-in-frame (9:16)"
              on={rcs.portraitKeepInFrame !== false}
              onChange={(v) => onPatchRcs({ portraitKeepInFrame: v })}
            />
            <Toggle
              label="Gimbal stabilize playback"
              on={rcs.stabilizeMotion !== false}
              onChange={(v) => onPatchRcs({ stabilizeMotion: v })}
            />
            <Toggle label="Show camera path" on={rcs.showPath} onChange={(v) => onPatchRcs({ showPath: v })} />
            <Toggle label="Frustum preview" on={rcs.showFrustum} onChange={(v) => onPatchRcs({ showFrustum: v })} />
            <Toggle label="Ghost cameras" on={rcs.showGhosts} onChange={(v) => onPatchRcs({ showGhosts: v })} />
          </div>
        </Section>

        {/* Cinematic Template Library */}
        <Section title="Cinematic templates" icon={<Sparkles className="w-3 h-3" />}>
          <CameraTemplateLibraryPanel
            appState={appState}
            rcs={rcs}
            viewportFormat={viewportFormat}
            onSetCameraKeyframes={onSetCameraKeyframes}
            onSetCameraMode={onSetCameraMode}
            onPatchRcs={onPatchRcs}
            recommendedId={recommendedTemplateId}
          />
        </Section>

        {/* Shot presets */}
        <Section title="Single-shot pose" icon={<Focus className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
            {CAMERA_SHOT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.description}
                onClick={() => applyPreset(p.id)}
                className="px-1.5 py-1.5 rounded border border-zinc-800 text-left text-[8px] font-bold text-zinc-400 hover:border-cyan-500/40 hover:text-cyan-100 cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Keyframe tools */}
        <Section title="Camera keyframes" icon={<Camera className="w-3 h-3" />}>
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              onClick={() => {
                onSetCameraMode('mmd');
                onRegisterCameraKeyframe();
              }}
              className="px-2 py-1 rounded bg-pink-600/80 text-[9px] font-bold text-white cursor-pointer"
            >
              + Key at playhead
            </button>
            <button
              type="button"
              onClick={runSmooth}
              disabled={keys.length < 2}
              className="px-2 py-1 rounded border border-violet-500/40 bg-violet-500/15 text-[9px] font-bold text-violet-100 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" /> Smooth Camera
            </button>
            <button
              type="button"
              onClick={() => void runAutoMatch()}
              disabled={!rcs.reference || busy}
              className="px-2 py-1 rounded border border-amber-500/40 text-[9px] font-bold text-amber-100 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Wand2 className="w-3 h-3" /> {busy ? 'Matching…' : 'Auto Match'}
            </button>
            <button
              type="button"
              onClick={copyPose}
              disabled={!selected}
              className="px-2 py-1 rounded border border-zinc-700 text-[9px] text-zinc-400 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
            <button
              type="button"
              onClick={pastePose}
              disabled={!rcs.clipboard}
              className="px-2 py-1 rounded border border-zinc-700 text-[9px] text-zinc-400 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
            >
              <ClipboardPaste className="w-3 h-3" /> Paste
            </button>
          </div>
          {rcs.lastAutoMatchNotes ? (
            <p className="text-[8px] text-amber-400/80 mb-2">{rcs.lastAutoMatchNotes}</p>
          ) : null}

          <div className="space-y-1 max-h-44 overflow-y-auto">
            {keys.length === 0 ? (
              <p className="text-[9px] text-zinc-600 py-2">No camera keys yet — place a few shots.</p>
            ) : (
              keys
                .slice()
                .sort((a, b) => a.frame - b.frame)
                .map((kf) => (
                  <div
                    key={kf.id}
                    className={`flex items-center gap-1 px-1.5 py-1 rounded border text-[9px] ${
                      selectedId === kf.id
                        ? 'border-cyan-500/50 bg-cyan-500/10'
                        : 'border-zinc-800'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left text-zinc-300 cursor-pointer truncate"
                      onClick={() => {
                        setSelectedId(kf.id);
                        onSetCurrentFrame(kf.frame);
                      }}
                    >
                      f{kf.frame} · FOV {Math.round(kf.fov)} · {kf.easing ?? 'cinematic'}
                      {kf.followTarget ? ` · →${kf.followTarget}` : ''}
                      {kf.focusDistance != null ? ` · focus ${Math.round(kf.focusDistance)}` : ''}
                    </button>
                    <button
                      type="button"
                      title="Duplicate"
                      className="p-0.5 text-zinc-500 hover:text-cyan-300 cursor-pointer"
                      onClick={() => {
                        const next = duplicateCameraKeyframe(keys, kf.id, 10);
                        onSetCameraKeyframes(next);
                      }}
                    >
                      <CopyPlus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      className="p-0.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                      onClick={() =>
                        onSetCameraKeyframes(keys.filter((k) => k.id !== kf.id))
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
            )}
          </div>

          {selected ? (
            <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2">
              <label className="block text-[9px] text-zinc-500">
                Frame
                <input
                  type="number"
                  min={0}
                  max={appState.maxFrames}
                  value={selected.frame}
                  onChange={(e) => {
                    const frame = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onSetCameraKeyframes(moveCameraKeyframe(keys, selected.id, frame));
                  }}
                  className="mt-0.5 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px]"
                />
              </label>
              <label className="block text-[9px] text-zinc-500">
                Interpolation
                <select
                  value={selected.easing ?? 'easeInOut'}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        easing: e.target.value as CameraEasingId,
                      })
                    )
                  }
                  className="mt-0.5 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px]"
                >
                  {CAMERA_EASING_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[9px] text-zinc-500">
                Follow target
                <select
                  value={selected.followTarget ?? 'body'}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        followTarget: e.target.value as CameraKeyframe['followTarget'],
                      })
                    )
                  }
                  className="mt-0.5 w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px]"
                >
                  {FOLLOW_TARGET_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[9px] text-zinc-500">
                FOV
                <input
                  type="range"
                  min={18}
                  max={75}
                  step={1}
                  value={selected.fov}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        fov: parseFloat(e.target.value),
                      })
                    )
                  }
                  className="w-full accent-cyan-400 mt-1"
                />
              </label>
              <label className="block text-[9px] text-zinc-500">
                Roll °
                <input
                  type="range"
                  min={-30}
                  max={30}
                  step={1}
                  value={selected.roll ?? selected.rotation[2] ?? 0}
                  onChange={(e) => {
                    const roll = parseFloat(e.target.value);
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        roll,
                        rotation: [selected.rotation[0], selected.rotation[1], roll],
                      })
                    );
                  }}
                  className="w-full accent-cyan-400 mt-1"
                />
              </label>
              <label className="block text-[9px] text-zinc-500">
                Focus distance
                <input
                  type="range"
                  min={1}
                  max={80}
                  step={0.5}
                  value={selected.focusDistance ?? 20}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        focusDistance: parseFloat(e.target.value),
                      })
                    )
                  }
                  className="w-full accent-cyan-400 mt-1"
                />
              </label>
              <label className="block text-[9px] text-zinc-500">
                DOF strength
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selected.dofStrength ?? 0}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        dofStrength: parseFloat(e.target.value),
                      })
                    )
                  }
                  className="w-full accent-cyan-400 mt-1"
                />
              </label>
              <label className="block text-[9px] text-zinc-500">
                Speed
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.05}
                  value={selected.speed ?? 1}
                  onChange={(e) =>
                    onSetCameraKeyframes(
                      patchCameraKeyframe(keys, selected.id, {
                        speed: parseFloat(e.target.value),
                      })
                    )
                  }
                  className="w-full accent-cyan-400 mt-1"
                />
              </label>
            </div>
          ) : null}
        </Section>
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
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      {children}
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
      className="w-full flex items-center justify-between px-1.5 py-1 rounded text-[9px] cursor-pointer"
    >
      <span className="text-zinc-400">{label}</span>
      <span
        className={`w-7 h-3.5 rounded-full relative transition-colors ${
          on ? 'bg-cyan-500/80' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${
            on ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function probeVideo(
  _file: File,
  blobUrl: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(v.duration) ? v.duration : 0,
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
      });
      v.src = '';
    };
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    v.src = blobUrl;
  });
}

export { DEFAULT_REFERENCE_CAMERA };
