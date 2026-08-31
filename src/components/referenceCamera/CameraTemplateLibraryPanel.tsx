import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderPlus,
  Save,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import type { AppState, CameraKeyframe, ViewportFormat } from '../../types';
import type { ReferenceCameraState } from '../../referenceCamera';
import {
  BUILTIN_CAMERA_TEMPLATES,
  TEMPLATE_CATEGORY_LABELS,
  applyCameraTemplate,
  createFolder,
  deleteUserTemplate,
  exportLibraryJson,
  exportTemplateJson,
  importLibraryJson,
  keyframesFromUserTemplate,
  listUserFolders,
  listUserTemplates,
  renameUserTemplate,
  saveUserTemplate,
  type CameraTemplateCategory,
  type CameraTemplateDef,
  type UserCameraTemplate,
} from '../../referenceCamera';

interface CameraTemplateLibraryPanelProps {
  appState: AppState;
  rcs: ReferenceCameraState;
  viewportFormat: ViewportFormat;
  onSetCameraKeyframes: (keyframes: CameraKeyframe[]) => void;
  onSetCameraMode: (mode: AppState['cameraMode']) => void;
  onPatchRcs: (patch: Partial<ReferenceCameraState>) => void;
  recommendedId?: string | null;
}

export default function CameraTemplateLibraryPanel({
  appState,
  rcs,
  viewportFormat,
  onSetCameraKeyframes,
  onSetCameraMode,
  onPatchRcs,
  recommendedId,
}: CameraTemplateLibraryPanelProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<CameraTemplateCategory | 'all' | 'user'>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [folderTick, setFolderTick] = useState(0);
  const userTemplates = useMemo(() => {
    void folderTick;
    return listUserTemplates();
  }, [folderTick]);
  const folders = useMemo(() => {
    void folderTick;
    return listUserFolders();
  }, [folderTick]);

  const builtins = useMemo(() => {
    if (category === 'all') return BUILTIN_CAMERA_TEMPLATES;
    if (category === 'user') return [];
    return BUILTIN_CAMERA_TEMPLATES.filter((t) => t.category === category);
  }, [category]);

  const adaptCtx = useCallback(
    () => ({
      focus: (appState.cameraOrbitAnchor ?? [0, 10, 0]) as [number, number, number],
      characterHeight: Math.max(12, (appState.cameraOrbitAnchor?.[1] ?? 10) * 1.55),
      durationFrames: appState.maxFrames,
      viewportFormat,
      minDistance: rcs.minDistance,
      maxDistance: rcs.maxDistance,
    }),
    [appState.cameraOrbitAnchor, appState.maxFrames, rcs.maxDistance, rcs.minDistance, viewportFormat]
  );

  const applyBuiltin = useCallback(
    (tpl: CameraTemplateDef) => {
      const applied = applyCameraTemplate(tpl, adaptCtx());
      onSetCameraMode('mmd');
      onSetCameraKeyframes(applied.keyframes);
      onPatchRcs({
        framingMode: applied.framing,
        minDistance: applied.safe.min,
        maxDistance: applied.safe.max,
        showPath: true,
        lastAutoMatchNotes: `Template: ${tpl.label} · ${applied.notes}`,
        constraints: Array.from(
          new Set<import('../../referenceCamera').CameraConstraintId>([
            ...rcs.constraints,
            'avoid_ground',
            'avoid_collision',
            'keep_character',
          ])
        ),
      });
      setPreviewId(tpl.id);
    },
    [adaptCtx, onPatchRcs, onSetCameraKeyframes, onSetCameraMode, rcs.constraints]
  );

  const applyUser = useCallback(
    (tpl: UserCameraTemplate) => {
      const keys = keyframesFromUserTemplate(tpl, appState.maxFrames);
      onSetCameraMode('mmd');
      onSetCameraKeyframes(keys);
      onPatchRcs({
        framingMode: tpl.framing,
        showPath: true,
        lastAutoMatchNotes: `User template: ${tpl.label}`,
      });
      setPreviewId(tpl.id);
    },
    [appState.maxFrames, onPatchRcs, onSetCameraKeyframes, onSetCameraMode]
  );

  const saveCurrent = useCallback(() => {
    if (appState.cameraKeyframes.length < 2) return;
    const name = window.prompt('Template name', 'My Camera Path');
    if (!name) return;
    saveUserTemplate({
      name,
      keyframes: appState.cameraKeyframes,
      folderId: null,
    });
    setFolderTick((n) => n + 1);
    setCategory('user');
    onPatchRcs({ lastAutoMatchNotes: `Saved template “${name}”.` });
  }, [appState.cameraKeyframes, onPatchRcs]);

  const categories = useMemo(() => {
    const ids = Array.from(new Set(BUILTIN_CAMERA_TEMPLATES.map((t) => t.category)));
    return ids;
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-[8px] text-zinc-500 leading-relaxed m-0">
        One-click cinematic paths — auto-adapted to character height, duration and aspect. Fully
        editable after apply.
      </p>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold border cursor-pointer ${
            category === 'all'
              ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
              : 'border-zinc-700 text-zinc-500'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-1.5 py-0.5 rounded text-[8px] font-bold border cursor-pointer ${
              category === c
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100'
                : 'border-zinc-700 text-zinc-500'
            }`}
          >
            {TEMPLATE_CATEGORY_LABELS[c] ?? c}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCategory('user')}
          className={`px-1.5 py-0.5 rounded text-[8px] font-bold border cursor-pointer ${
            category === 'user'
              ? 'border-pink-500/50 bg-pink-500/15 text-pink-100'
              : 'border-zinc-700 text-zinc-500'
          }`}
        >
          My Templates
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={saveCurrent}
          disabled={appState.cameraKeyframes.length < 2}
          className="px-2 py-1 rounded border border-zinc-700 text-[8px] font-bold text-zinc-300 cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
        >
          <Save className="w-3 h-3" /> Save current
        </button>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('Folder name', 'Favorites');
            if (!name) return;
            createFolder(name);
            setFolderTick((n) => n + 1);
          }}
          className="px-2 py-1 rounded border border-zinc-700 text-[8px] font-bold text-zinc-300 cursor-pointer inline-flex items-center gap-1"
        >
          <FolderPlus className="w-3 h-3" /> Folder
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([exportLibraryJson()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'camera-templates.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-2 py-1 rounded border border-zinc-700 text-[8px] font-bold text-zinc-300 cursor-pointer inline-flex items-center gap-1"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="px-2 py-1 rounded border border-zinc-700 text-[8px] font-bold text-zinc-300 cursor-pointer inline-flex items-center gap-1"
        >
          <Upload className="w-3 h-3" /> Import
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              try {
                const r = importLibraryJson(text);
                setFolderTick((n) => n + 1);
                setCategory('user');
                onPatchRcs({
                  lastAutoMatchNotes: `Imported ${r.templates} template(s), ${r.folders} folder(s).`,
                });
              } catch {
                onPatchRcs({ lastAutoMatchNotes: 'Import failed — invalid JSON.' });
              }
            });
            e.target.value = '';
          }}
        />
      </div>

      {folders.length > 0 ? (
        <p className="text-[8px] text-zinc-600 m-0">
          Folders: {folders.map((f) => f.name).join(', ')}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto">
        {category !== 'user' &&
          builtins.map((tpl) => {
            const active = previewId === tpl.id || recommendedId === tpl.id;
            return (
              <div
                key={tpl.id}
                className={`rounded border px-2 py-1.5 ${
                  recommendedId === tpl.id
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : active
                      ? 'border-cyan-500/40 bg-cyan-500/10'
                      : 'border-zinc-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-bold text-zinc-200 m-0 truncate flex items-center gap-1">
                      {recommendedId === tpl.id ? (
                        <Wand2 className="w-3 h-3 text-amber-300 shrink-0" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-cyan-400/70 shrink-0" />
                      )}
                      {tpl.label}
                    </p>
                    <p className="text-[8px] text-zinc-500 m-0 truncate">{tpl.description}</p>
                    <p className="text-[7px] text-zinc-600 m-0">
                      {tpl.easing} · FOV {tpl.baseFov}
                      {tpl.endFov ? `→${tpl.endFov}` : ''} · {tpl.framing}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewId(tpl.id)}
                      className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-zinc-700 text-zinc-400 cursor-pointer"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => applyBuiltin(tpl)}
                      className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-cyan-500/40 bg-cyan-600/30 text-cyan-100 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
                {previewId === tpl.id ? (
                  <TemplatePreviewStrip tpl={tpl} adaptCtx={adaptCtx()} />
                ) : null}
              </div>
            );
          })}

        {(category === 'user' || category === 'all') &&
          userTemplates.map((tpl) => (
            <div key={tpl.id} className="rounded border border-zinc-800 px-2 py-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-pink-100 m-0 truncate">{tpl.label}</p>
                  <p className="text-[8px] text-zinc-500 m-0">
                    {tpl.bakedKeyframes.length} keys · user
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => applyUser(tpl)}
                    className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-pink-500/40 text-pink-100 cursor-pointer"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt('Rename', tpl.label);
                      if (!name) return;
                      renameUserTemplate(tpl.id, name);
                      setFolderTick((n) => n + 1);
                    }}
                    className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-zinc-700 text-zinc-400 cursor-pointer"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const json = exportTemplateJson(tpl.id);
                      if (!json) return;
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${tpl.label.replace(/\s+/g, '-').toLowerCase()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-zinc-700 text-zinc-400 cursor-pointer"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Delete “${tpl.label}”?`)) return;
                      deleteUserTemplate(tpl.id);
                      setFolderTick((n) => n + 1);
                    }}
                    className="px-1.5 py-0.5 rounded text-[7px] font-bold border border-red-900/50 text-red-300 cursor-pointer"
                  >
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function TemplatePreviewStrip({
  tpl,
  adaptCtx,
}: {
  tpl: CameraTemplateDef;
  adaptCtx: {
    focus: [number, number, number];
    characterHeight: number;
    durationFrames: number;
    viewportFormat: ViewportFormat;
    minDistance?: number;
    maxDistance?: number;
  };
}) {
  const applied = useMemo(() => applyCameraTemplate(tpl, adaptCtx), [tpl, adaptCtx]);
  const pts = applied.keyframes.slice(0, 6);
  return (
    <div className="mt-1.5 flex gap-1 overflow-x-auto">
      {pts.map((k) => (
        <div
          key={k.id}
          className="shrink-0 w-14 rounded border border-zinc-800 bg-zinc-950/80 px-1 py-1"
          title={`f${k.frame}`}
        >
          <p className="text-[7px] text-cyan-300/90 m-0 font-mono">f{k.frame}</p>
          <p className="text-[6px] text-zinc-500 m-0">FOV {Math.round(k.fov)}</p>
          <p className="text-[6px] text-zinc-600 m-0 truncate">{k.easing}</p>
        </div>
      ))}
      <p className="text-[7px] text-zinc-600 self-center m-0">{applied.notes}</p>
    </div>
  );
}
