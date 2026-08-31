import { useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Download,
  GripVertical,
  Library,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { AppState, MMDModel } from '../../types';
import type { ProcessedVmdFiles } from '../../utils/mmdFiles';
import type { TimelineKeyframe } from '../../types';
import {
  planAssignAnimation,
  mergeLibraryAssets,
  upsertAssignment,
} from '../../animationLibrary/assign';
import { importAnimationFiles } from '../../animationLibrary/importAssets';
import { applyOptimizerToAsset } from '../../animationLibrary/optimizer';
import {
  createAsMotionDocument,
  downloadAsMotion,
} from '../../animationLibrary/asmotion';
import {
  RETARGET_SLOTS,
  type AnimationLibraryAsset,
  type AnimationLibraryState,
  type CharacterMotionOverride,
  type RetargetMappingPreset,
  type RetargetSlotId,
} from '../../animationLibrary/types';
import {
  createMappingPreset,
  defaultMmdSlotMap,
  inferSkeletonFromModel,
} from '../../animationLibrary/retarget';
import { boneRemapFromPreset, slotMapToBoneRemap } from '../../animationLibrary/boneRemap';
import { upsertMappingPreset } from '../../animationLibrary/storage';
import { patchAnimationLibrary } from '../../animationLibrary';
import { DEFAULT_OPTIMIZER_FLAGS } from '../../animationLibrary/defaults';

export interface AnimationLibraryPanelProps {
  appState: AppState;
  onPatchLibrary: (next: AnimationLibraryState) => void;
  onAssignVmd: (
    modelId: string,
    vmd: ProcessedVmdFiles,
    assetId: string,
    override?: Pick<
      CharacterMotionOverride,
      'speed' | 'loop' | 'playbackOffset' | 'boneRemap'
    >
  ) => void;
  onAssignTemplate: (modelId: string, templateId: string) => void;
  onAssignKeyframes: (modelId: string, keyframes: TimelineKeyframe[]) => void;
  onSetModelBoneRemap?: (modelId: string, remap: Record<string, string>) => void;
  onSetModelMotionSpeed?: (modelId: string, speed: number) => void;
}

function countAssetBones(asset: AnimationLibraryAsset): number {
  if (!asset.keyframes?.length) return 0;
  const names = new Set(
    asset.keyframes.filter((k) => k.track.startsWith('bone_')).map((k) => k.track)
  );
  return names.size;
}

function countAssetMorphs(asset: AnimationLibraryAsset): number {
  if (!asset.keyframes?.length) return 0;
  const names = new Set(
    asset.keyframes.filter((k) => k.track.startsWith('morph_')).map((k) => k.track)
  );
  return names.size;
}

type Tab = 'library' | 'retarget' | 'optimize' | 'packs';

function compatColor(c: AnimationLibraryAsset['compatibility']): string {
  if (c === 'compatible') return 'text-emerald-400';
  if (c === 'retarget') return 'text-amber-400';
  if (c === 'manual') return 'text-orange-400';
  return 'text-rose-400';
}

export default function AnimationLibraryPanel({
  appState,
  onPatchLibrary,
  onAssignVmd,
  onAssignTemplate,
  onAssignKeyframes,
  onSetModelBoneRemap,
  onSetModelMotionSpeed,
}: AnimationLibraryPanelProps) {
  const lib = appState.animationLibrary;
  const [tab, setTab] = useState<Tab>('library');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dragAssetId, setDragAssetId] = useState<string | null>(null);
  const [retargetDraft, setRetargetDraft] = useState<Partial<Record<RetargetSlotId, string>>>(
    () => defaultMmdSlotMap()
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const characters = useMemo(
    () =>
      appState.models.filter(
        (m) => m.assetKind !== 'stage' && m.assetKind !== 'prop'
      ),
    [appState.models]
  );

  const selected = lib?.assets.find((a) => a.id === lib.selectedAssetId) ?? null;

  const visible = useMemo(() => {
    if (!lib) return [];
    const q = filter.trim().toLowerCase();
    const list = lib.assets.filter((a) => {
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.format.includes(q) ||
        a.author.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  }, [lib, filter]);

  if (!lib) {
    return (
      <div className="p-3 text-[10px] text-zinc-500">Animation Library is not initialized.</div>
    );
  }

  const commit = (next: AnimationLibraryState) => onPatchLibrary(patchAnimationLibrary(lib, next));

  const selectAsset = (asset: AnimationLibraryAsset) => {
    commit({
      ...lib,
      selectedAssetId: asset.id,
      previewFrame: 0,
      previewPlaying: false,
    });
  };

  const handleImport = async (fileList: FileList | File[]) => {
    const files = [...fileList];
    if (!files.length) return;
    setBusy(true);
    setStatus(null);
    try {
      const { assets, packs } = await importAnimationFiles(files);
      let next = mergeLibraryAssets(lib, assets, packs);
      next = patchAnimationLibrary(lib, next);
      onPatchLibrary(next);

      const characters = appState.models.filter(
        (m) => m.assetKind !== 'stage' && m.assetKind !== 'prop'
      );
      const playable = assets.find(
        (a) => a.format === 'vmd' || a.format === 'template' || (a.keyframes?.length ?? 0) > 0
      );
      if (playable && characters.length === 1) {
        assignToModelWithLib(playable, characters[0]!, next);
        setStatus(
          `Imported & assigned “${playable.name}” → ${characters[0]!.name}. VMD plays live (amber clip on timeline).`
        );
      } else if (playable && characters.length > 1) {
        setStatus(
          `Imported ${assets.length} animation(s). Select one and press Assign on a character.`
        );
      } else {
        setStatus(`Imported ${assets.length} animation(s)${packs.length ? ` · ${packs.length} pack(s)` : ''}`);
      }
      setTab('library');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const assignToModelWithLib = (
    asset: AnimationLibraryAsset,
    model: MMDModel,
    library: AnimationLibraryState,
    speedOverride?: number
  ) => {
    const existing = library.assignments.find(
      (a) => a.modelId === model.id && a.assetId === asset.id
    );
    const plan = planAssignAnimation(asset, model, {
      speed: speedOverride ?? existing?.speed ?? library.previewSpeed ?? 1,
      loop: existing?.loop ?? library.previewLoop ?? asset.loop,
      playbackOffset: existing?.playbackOffset ?? 0,
      mappingPresetId: existing?.mappingPresetId ?? asset.mappingPresetId ?? null,
      boneRemap: existing?.boneRemap,
    });

    let boneRemap = plan.override.boneRemap;
    if (!boneRemap && plan.override.mappingPresetId) {
      const preset = library.mappingPresets.find(
        (p) => p.id === plan.override.mappingPresetId
      );
      boneRemap = boneRemapFromPreset(preset, model);
    }
    const override: CharacterMotionOverride = {
      ...plan.override,
      ...(boneRemap ? { boneRemap } : {}),
    };

    const nextLib: AnimationLibraryState = patchAnimationLibrary(library, {
      ...library,
      assignments: upsertAssignment(library, override),
      selectedAssetId: asset.id,
    });
    onPatchLibrary(nextLib);

    if (plan.mode === 'vmd' && plan.vmd) {
      if (boneRemap && onSetModelBoneRemap) {
        onSetModelBoneRemap(model.id, boneRemap);
      }
      onAssignVmd(model.id, plan.vmd, asset.id, {
        speed: override.speed,
        loop: override.loop,
        playbackOffset: override.playbackOffset,
        boneRemap,
      });
      setStatus(
        `${plan.message}. VMD attached (paused) — press Play, or Use timeline / Add Key to keyframe.`
      );
      if (plan.needsRetargetEditor) setTab('retarget');
      return;
    }
    if (plan.mode === 'template' && plan.templateId) {
      onAssignTemplate(model.id, plan.templateId);
      setStatus(plan.message);
      return;
    }
    if (plan.mode === 'keyframes' && plan.keyframes) {
      onAssignKeyframes(model.id, plan.keyframes);
      setStatus(plan.message);
      return;
    }
    setStatus(plan.message);
    if (plan.needsRetargetEditor || plan.mode === 'unsupported') setTab('retarget');
  };

  const assignToModel = (asset: AnimationLibraryAsset, model: MMDModel) => {
    assignToModelWithLib(asset, model, lib);
  };

  const removeAsset = (id: string) => {
    commit({
      ...lib,
      assets: lib.assets.filter((a) => a.id !== id || a.format === 'template'),
      selectedAssetId: lib.selectedAssetId === id ? null : lib.selectedAssetId,
      packs: lib.packs.map((p) => ({
        ...p,
        assetIds: p.assetIds.filter((aid) => aid !== id),
      })),
    });
  };

  const saveRetargetPreset = () => {
    const preset = createMappingPreset('Custom Mapping', 'mmd', 'humanoid', retargetDraft);
    commit({
      ...lib,
      mappingPresets: upsertMappingPreset(lib.mappingPresets, preset),
    });
    setStatus(`Saved mapping preset “${preset.name}”`);
  };

  const applyRemapToSelectedCharacter = () => {
    const model =
      characters.find((m) => m.id === appState.selectedObjectId) ?? characters[0];
    if (!model || !selected) {
      setStatus('Select a character and an animation first');
      return;
    }
    const remap = slotMapToBoneRemap(retargetDraft, model);
    onSetModelBoneRemap?.(model.id, remap);
    const override: CharacterMotionOverride = {
      modelId: model.id,
      assetId: selected.id,
      playbackOffset: 0,
      speed: lib.previewSpeed || 1,
      loop: selected.loop,
      rootMotion: true,
      rootMotionScale: 1,
      mappingPresetId: null,
      boneRemap: remap,
    };
    commit({
      ...lib,
      assignments: upsertAssignment(lib, override),
    });
    assignToModelWithLib(selected, model, {
      ...lib,
      assignments: upsertAssignment(lib, override),
    });
  };

  const optimizeSelected = () => {
    if (!selected) return;
    if (!selected.keyframes?.length) {
      commit({
        ...lib,
        assets: lib.assets.map((a) =>
          a.id === selected.id
            ? { ...a, optimized: { ...DEFAULT_OPTIMIZER_FLAGS }, tags: [...new Set([...a.tags, 'optimized'])] }
            : a
        ),
      });
      setStatus('Optimizer flags saved (VMD soft-fix at playback). Keyframe bake available for .asmotion.');
      return;
    }
    const optimized = applyOptimizerToAsset(selected, DEFAULT_OPTIMIZER_FLAGS);
    commit({
      ...lib,
      assets: lib.assets.map((a) => (a.id === selected.id ? optimized : a)),
    });
    setStatus('Motion optimized — duplicate keys / jitter cleaned');
  };

  const exportAsMotion = () => {
    if (!selected) return;
    const doc = createAsMotionDocument(selected);
    downloadAsMotion(doc);
  };

  const onDropCharacter = (model: MMDModel, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/as-anim-id') || dragAssetId;
    setDragAssetId(null);
    const asset = lib.assets.find((a) => a.id === id);
    if (asset) assignToModel(asset, model);
  };

  return (
    <div className="text-zinc-200 bg-[#0a0f18] min-h-full">
      <header className="p-3 border-b border-[#233142] bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.12),transparent_48%)]">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-amber-300" />
          <div>
            <h2 className="text-[12px] font-black tracking-wide m-0">ANIMATION LIBRARY</h2>
            <p className="text-[8px] text-zinc-500 m-0">
              Universal motions · drag onto any character · auto retarget
            </p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-0.5 mt-3">
          {(
            [
              ['library', 'Library'],
              ['retarget', 'Retarget'],
              ['optimize', 'Optimize'],
              ['packs', 'Packs'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`py-1.5 rounded text-[8px] font-bold ${
                tab === id ? 'bg-amber-500/20 text-amber-100' : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-3 space-y-3">
        {status ? (
          <p className="m-0 text-[9px] text-amber-100/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
            {status}
          </p>
        ) : null}

        {tab === 'library' ? (
          <>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded border border-amber-400/30 bg-amber-400/10 text-[9px] font-bold text-amber-100"
              >
                <Upload className="w-3.5 h-3.5" />
                {busy ? 'Importing…' : 'Import VMD / BVH / FBX / ZIP'}
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                multiple
                accept=".vmd,.bvh,.fbx,.glb,.gltf,.json,.asmotion,.zip,application/zip"
                onChange={(e) => {
                  if (e.target.files) void handleImport(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <input
              type="search"
              placeholder="Search name, tag, format…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-[10px] bg-[#111722] border border-[#283142] rounded px-2 py-1.5"
            />

            <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto">
              {visible.map((asset) => {
                const active = asset.id === lib.selectedAssetId;
                const boneN = countAssetBones(asset);
                const morphN = countAssetMorphs(asset);
                return (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(e) => {
                      setDragAssetId(asset.id);
                      e.dataTransfer.setData('text/as-anim-id', asset.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => selectAsset(asset)}
                    className={`relative text-left p-2 rounded border cursor-grab active:cursor-grabbing ${
                      active
                        ? 'border-amber-400/60 bg-amber-400/10'
                        : 'border-[#283142] bg-[#111722] hover:border-[#46536a]'
                    }`}
                  >
                    <div className="flex items-start gap-1">
                      <GripVertical className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-base leading-none">{asset.thumbnail}</span>
                          <span className="text-[10px] font-bold truncate">{asset.name}</span>
                          {asset.favorite ? (
                            <span className="text-[8px] text-amber-300 ml-auto">★</span>
                          ) : null}
                        </div>
                        <div className="text-[7px] text-zinc-500 mt-0.5">
                          {asset.format.toUpperCase()} ·{' '}
                          {asset.durationSec > 0 ? `${asset.durationSec.toFixed(1)}s` : '—'} ·{' '}
                          {asset.fps}fps · {asset.skeletonType}
                        </div>
                        <div className="text-[7px] text-zinc-600 mt-0.5">
                          {boneN > 0 || morphN > 0
                            ? `${boneN} bones · ${morphN} morphs · `
                            : ''}
                          {asset.author || 'Unknown'}
                          {asset.loop ? ' · loop' : ''}
                        </div>
                        <div className={`text-[7px] font-bold uppercase mt-0.5 ${compatColor(asset.compatibility)}`}>
                          {asset.compatibility}
                        </div>
                        {asset.tags.slice(0, 3).length ? (
                          <div className="text-[7px] text-zinc-600 truncate mt-0.5">
                            {asset.tags.slice(0, 3).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      <button
                        type="button"
                        className="p-0.5 text-zinc-600 hover:text-amber-300"
                        title="Favorite"
                        onClick={(e) => {
                          e.stopPropagation();
                          commit({
                            ...lib,
                            assets: lib.assets.map((a) =>
                              a.id === asset.id ? { ...a, favorite: !a.favorite } : a
                            ),
                          });
                        }}
                      >
                        {asset.favorite ? '★' : '☆'}
                      </button>
                      {asset.format !== 'template' ? (
                        <button
                          type="button"
                          className="p-0.5 text-zinc-600 hover:text-rose-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAsset(asset.id);
                          }}
                          title="Remove"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {selected ? (
              <section className="space-y-2 border border-[#283142] rounded p-2 bg-[#0f1520]">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-[10px] font-bold truncate">{selected.name}</span>
                  <span className="text-[8px] text-zinc-500 ml-auto">{selected.author}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded border border-[#283142]"
                    onClick={() =>
                      commit({ ...lib, previewPlaying: !lib.previewPlaying })
                    }
                  >
                    {lib.previewPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <label className="flex-1 text-[8px] text-zinc-500">
                    Scrub
                    <input
                      type="range"
                      min={0}
                      max={Math.max(1, Math.round(selected.durationSec * selected.fps) || 120)}
                      value={lib.previewFrame}
                      onChange={(e) =>
                        commit({ ...lib, previewFrame: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </label>
                  <label className="text-[8px] text-zinc-500 w-16">
                    Speed
                    <input
                      type="range"
                      min={0.25}
                      max={2}
                      step={0.05}
                      value={lib.previewSpeed}
                      onChange={(e) =>
                        commit({ ...lib, previewSpeed: Number(e.target.value) })
                      }
                      className="w-full"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[9px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={lib.previewLoop}
                    onChange={(e) => commit({ ...lib, previewLoop: e.target.checked })}
                  />
                  Loop preview
                </label>
                <p className="text-[7px] text-zinc-600 m-0">
                  Preview controls mark intent; assign to a character for live playback.
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={exportAsMotion}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-[#283142] text-[8px] font-bold"
                  >
                    <Download className="w-3 h-3" /> Save .asmotion
                  </button>
                </div>
              </section>
            ) : null}

            <section className="space-y-1.5">
              <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                Drop on character
              </h3>
              {characters.length === 0 ? (
                <p className="text-[9px] text-zinc-600 m-0">Load a character first.</p>
              ) : (
                <div className="space-y-1">
                  {characters.map((model) => {
                    const assignment = selected
                      ? lib.assignments.find(
                          (a) => a.modelId === model.id && a.assetId === selected.id
                        )
                      : undefined;
                    const speed = model.motionSpeed ?? assignment?.speed ?? 1;
                    return (
                      <div
                        key={model.id}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => onDropCharacter(model, e)}
                        className={`flex items-center gap-2 p-2 rounded border border-dashed ${
                          appState.selectedObjectId === model.id
                            ? 'border-amber-400/50 bg-amber-400/5'
                            : 'border-[#283142] bg-[#111722]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold truncate">{model.name}</div>
                          <div className="text-[7px] text-zinc-500">
                            {inferSkeletonFromModel(model)} ·{' '}
                            {model.hasVmdAnimation ? 'has motion' : 'no motion'}
                            {model.libraryAssetId ? ` · lib` : ''}
                          </div>
                          <label className="flex items-center gap-1 text-[7px] text-zinc-500 mt-1">
                            Speed
                            <input
                              type="range"
                              min={0.25}
                              max={2}
                              step={0.05}
                              value={speed}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                onSetModelMotionSpeed?.(model.id, next);
                                if (selected) {
                                  const override: CharacterMotionOverride = {
                                    modelId: model.id,
                                    assetId: selected.id,
                                    playbackOffset: assignment?.playbackOffset ?? 0,
                                    speed: next,
                                    loop: assignment?.loop ?? selected.loop,
                                    rootMotion: assignment?.rootMotion ?? true,
                                    rootMotionScale: assignment?.rootMotionScale ?? 1,
                                    mappingPresetId: assignment?.mappingPresetId ?? null,
                                    boneRemap: assignment?.boneRemap,
                                  };
                                  commit({
                                    ...lib,
                                    assignments: upsertAssignment(lib, override),
                                  });
                                }
                              }}
                              className="flex-1"
                            />
                            <span className="w-6 text-right">{speed.toFixed(2)}</span>
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={!selected}
                          onClick={() => selected && assignToModel(selected, model)}
                          className="px-2 py-1 rounded border border-amber-400/40 text-[8px] font-bold text-amber-100 disabled:opacity-40"
                        >
                          Assign
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

        {tab === 'retarget' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> Retarget Editor
            </h3>
            <p className="text-[8px] text-zinc-500 m-0">
              Auto mapping runs via UMCE on assign. Fill slots when the skeleton differs, then save a
              preset.
            </p>
            <div className="grid grid-cols-2 gap-1 max-h-[320px] overflow-y-auto">
              {RETARGET_SLOTS.map((slot) => (
                <label key={slot.id} className="block text-[8px] text-zinc-500">
                  {slot.label}
                  <input
                    type="text"
                    value={retargetDraft[slot.id] ?? ''}
                    onChange={(e) =>
                      setRetargetDraft((prev) => ({ ...prev, [slot.id]: e.target.value }))
                    }
                    className="w-full mt-0.5 text-[9px] bg-[#111722] border border-[#283142] rounded px-1.5 py-1 text-zinc-200"
                    placeholder="Bone name"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRetargetDraft(defaultMmdSlotMap())}
                className="flex-1 py-1.5 rounded border border-[#283142] text-[8px] font-bold"
              >
                Reset MMD map
              </button>
              <button
                type="button"
                onClick={saveRetargetPreset}
                className="flex-1 py-1.5 rounded border border-amber-400/40 text-[8px] font-bold text-amber-100"
              >
                Save preset
              </button>
            </div>
            <button
              type="button"
              onClick={applyRemapToSelectedCharacter}
              className="w-full py-2 rounded border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-bold text-emerald-100"
            >
              Apply mapping + assign selected
            </button>
            {lib.mappingPresets.length ? (
              <div className="space-y-1">
                <div className="text-[8px] text-zinc-500 font-bold uppercase">Saved presets</div>
                {lib.mappingPresets.map((p: RetargetMappingPreset) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left p-1.5 rounded border border-[#283142] text-[9px]"
                    onClick={() => setRetargetDraft({ ...p.slotMap })}
                  >
                    {p.name} · {p.sourceSkeleton} → {p.targetSkeleton}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === 'optimize' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Motion Optimizer
            </h3>
            <ul className="m-0 pl-4 text-[9px] text-zinc-400 space-y-0.5">
              <li>Foot sliding / hand jitter</li>
              <li>Broken curves / duplicate keys</li>
              <li>Noise · root instability</li>
              <li>Smooth · reduce keys · bake</li>
            </ul>
            <button
              type="button"
              disabled={!selected}
              onClick={optimizeSelected}
              className="w-full py-2 rounded border border-amber-400/40 bg-amber-400/10 text-[9px] font-bold text-amber-100 disabled:opacity-40"
            >
              Optimize selected animation
            </button>
          </section>
        ) : null}

        {tab === 'packs' ? (
          <section className="space-y-2">
            <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Animation Packs
            </h3>
            <p className="text-[8px] text-zinc-500 m-0">
              ZIP may include multiple motions, preview image, and metadata.json (name, author, tags).
            </p>
            {lib.packs.length === 0 ? (
              <p className="text-[9px] text-zinc-600 m-0">No packs yet — import a .zip from Library.</p>
            ) : (
              lib.packs.map((pack) => (
                <div
                  key={pack.id}
                  className="p-2 rounded border border-[#283142] bg-[#111722]"
                >
                  <div className="text-[10px] font-bold">{pack.name}</div>
                  <div className="text-[8px] text-zinc-500">
                    {pack.author} · {pack.assetIds.length} motions · {pack.tags.join(', ')}
                  </div>
                </div>
              ))
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
