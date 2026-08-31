import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Layers,
  Loader2,
  Mountain,
  Move3d,
  Save,
  Sparkles,
  Sun,
  Wand2,
} from 'lucide-react';
import { processImportedAssets } from '../../utils/assetImport';
import type { ProcessedMMDFiles } from '../../utils/mmdFiles';
import type { AppState, CameraOrbitPresetId, VisualFxSettings } from '../../types';
import type { DynamicSkyState } from '../../dynamicSky';
import type { SceneComposerState } from '../../sceneComposer';
import {
  BACKGROUND_FX,
  DEFAULT_ENV_DEPTH,
  ENVIRONMENT_CATEGORIES,
  SMART_CAMERAS,
  WORLD_SCALE_PRESETS,
  analyzeScene,
  createEnvironmentPresetId,
  generateShowcase,
  loadEnvironmentPresets,
  placementToPosition,
  saveEnvironmentPreset,
  type AssetImportRole,
  type CharacterPlacementId,
  type EnvironmentCategoryId,
  type EnvironmentDepthSettings,
  type EnvironmentPatches,
  type EnvironmentPresetV1,
  type WorldScalePresetId,
} from '../../environmentBuilder';

type Tab = 'import' | 'fit' | 'look' | 'camera' | 'library' | 'presets';

export interface EnvironmentBuilderPanelProps {
  appState: AppState;
  onImportBackgroundModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onLoadCustomModel?: (data: ProcessedMMDFiles | ProcessedMMDFiles[]) => void;
  onImportHdr?: (file: File) => void;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchDynamicSky: (patch: Partial<DynamicSkyState>) => void;
  onPatchSceneComposer: (
    patch: Partial<SceneComposerState> & { lights?: Partial<SceneComposerState['lights']> }
  ) => void;
  onApplyCameraPreset: (presetId: CameraOrbitPresetId) => void;
  onPatchCameraStudio: (patch: Partial<AppState['cameraStudio']>) => void;
  onModifyModelPosition: (
    modelId: string,
    axis: 'positionX' | 'positionY' | 'positionZ',
    value: number
  ) => void;
  onModelRotate?: (modelId: string, x: number, y: number, z: number) => void;
  onSetModelWorldScale?: (modelId: string, scale: number) => void;
  onStatus?: (message: string) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'fit', label: 'Fit' },
  { id: 'look', label: 'Depth/FX' },
  { id: 'camera', label: 'Camera' },
  { id: 'library', label: 'Library' },
  { id: 'presets', label: 'Presets' },
];

const IMPORT_ROLES: Array<{ id: AssetImportRole; label: string; hint: string }> = [
  { id: 'environment', label: 'Environment', hint: 'Background scene' },
  { id: 'background', label: 'Background', hint: 'Backdrop stage' },
  { id: 'character', label: 'Character', hint: 'Playable model' },
  { id: 'prop', label: 'Prop', hint: 'Scene object' },
];

const PLACEMENTS: Array<{ id: CharacterPlacementId; label: string }> = [
  { id: 'snap_floor', label: 'Snap to Floor' },
  { id: 'snap_stage', label: 'Snap to Stage' },
  { id: 'center', label: 'Center' },
  { id: 'spawn_left', label: 'Spawn Left' },
  { id: 'spawn_right', label: 'Spawn Right' },
  { id: 'spawn_back', label: 'Spawn Back' },
];

function Chip({
  active,
  label,
  sub,
  onClick,
}: {
  active?: boolean;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 text-left p-2 border rounded-md transition-colors ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-100'
          : 'border-[#283142] bg-[#111722] text-zinc-200 hover:border-[#46536a]'
      }`}
    >
      <span className="block text-[10px] font-bold leading-tight">{label}</span>
      {sub ? <span className="block text-[8px] text-zinc-500 mt-0.5 line-clamp-2">{sub}</span> : null}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function depthToPatches(depth: EnvironmentDepthSettings): EnvironmentPatches {
  return {
    visualFx: {
      dofEnabled: depth.blur > 0.02,
      dofBokehScale: 1.5 + depth.blur * 6,
      environmentIntensity: depth.brightness,
    },
    sceneComposer: {
      fogEnabled: depth.fog > 0.02,
      fogDensity: depth.fog,
      exposure: depth.exposure,
      brightness: depth.brightness,
      contrast: depth.contrast,
      saturation: depth.saturation,
    },
  };
}

export default function EnvironmentBuilderPanel({
  appState,
  onImportBackgroundModel,
  onLoadCustomModel,
  onImportHdr,
  onSetVisualFx,
  onPatchDynamicSky,
  onPatchSceneComposer,
  onApplyCameraPreset,
  onPatchCameraStudio,
  onModifyModelPosition,
  onModelRotate,
  onSetModelWorldScale,
  onStatus,
}: EnvironmentBuilderPanelProps) {
  const [tab, setTab] = useState<Tab>('import');
  const [role, setRole] = useState<AssetImportRole>('environment');
  const [scaleId, setScaleId] = useState<WorldScalePresetId>('mmd');
  const [categoryId, setCategoryId] = useState<EnvironmentCategoryId | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [depth, setDepth] = useState<EnvironmentDepthSettings>(DEFAULT_ENV_DEPTH);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [presets, setPresets] = useState(() => loadEnvironmentPresets());
  const modelInputRef = useRef<HTMLInputElement>(null);
  const hdrInputRef = useRef<HTMLInputElement>(null);
  const pendingEnvScaleRef = useRef(false);
  const prevStageIdRef = useRef<string | null>(null);

  const analysis = useMemo(() => analyzeScene(appState, categoryId), [appState, categoryId]);
  const characters = appState.models.filter((m) => m.assetKind !== 'stage');
  const stageModel =
    [...appState.models].reverse().find((m) => m.assetKind === 'stage') ?? null;
  const envScale = stageModel?.worldScale ?? 1;
  const selectedCharacterId =
    appState.selectedObjectId &&
    characters.some((m) => m.id === appState.selectedObjectId)
      ? appState.selectedObjectId
      : characters[0]?.id ?? null;

  const status = (text: string) => {
    setMessage(text);
    onStatus?.(text);
  };

  const applyPatches = (patches: EnvironmentPatches) => {
    if (patches.visualFx) onSetVisualFx(patches.visualFx);
    if (patches.dynamicSky) onPatchDynamicSky(patches.dynamicSky);
    if (patches.sceneComposer) onPatchSceneComposer(patches.sceneComposer);
    if (patches.cameraPreset) onApplyCameraPreset(patches.cameraPreset);
    if (patches.message) status(patches.message);
  };

  // After an environment import lands in state, blow it up to the chosen
  // world scale so the character actually fits inside the scene.
  const stageId = stageModel?.id ?? null;
  useEffect(() => {
    if (stageId && stageId !== prevStageIdRef.current && pendingEnvScaleRef.current) {
      pendingEnvScaleRef.current = false;
      const preset = WORLD_SCALE_PRESETS.find((p) => p.id === scaleId);
      const multiplier = preset?.envScaleMultiplier ?? 1;
      onSetModelWorldScale?.(stageId, multiplier);
      if (preset && preset.id !== 'custom') {
        onPatchCameraStudio({
          focusTarget: preset.cameraStudio.focusTarget,
          orbitPreset: preset.cameraStudio.orbitPreset,
          autoFocus: true,
        });
        onApplyCameraPreset(preset.cameraStudio.orbitPreset);
      }
      status(
        multiplier === 1
          ? 'Environment auto-sized for your character — walk inside.'
          : `Environment scaled ×${multiplier} — walk your character inside.`
      );
    }
    prevStageIdRef.current = stageId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);

  const runImport = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await processImportedAssets(files);
      if ('error' in result) throw new Error(result.error);
      if (result.kind === 'hdr_only') {
        if (result.hdrFiles[0] && onImportHdr) {
          onImportHdr(result.hdrFiles[0]);
          status('HDRI environment lighting applied.');
        }
        return;
      }
      if (result.kind !== 'characters' || !result.models.length) {
        throw new Error('No 3D model found. Use GLB, GLTF, FBX, OBJ, PMX or a ZIP folder.');
      }
      const payload = result.models.length === 1 ? result.models[0]! : result.models;
      if (role === 'environment' || role === 'background') {
        pendingEnvScaleRef.current = true;
        onImportBackgroundModel?.(payload);
        status('Environment imported — scaling to fit your character…');
      } else {
        onLoadCustomModel?.(payload);
        status(`${role === 'prop' ? 'Prop' : 'Character'} imported.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const applyScale = (id: WorldScalePresetId) => {
    setScaleId(id);
    const preset = WORLD_SCALE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (preset.envScaleMultiplier != null && stageModel) {
      onSetModelWorldScale?.(stageModel.id, preset.envScaleMultiplier);
    }
    if (preset.id !== 'custom') {
      onPatchCameraStudio({
        focusTarget: preset.cameraStudio.focusTarget,
        orbitPreset: preset.cameraStudio.orbitPreset,
        autoFocus: true,
      });
      onApplyCameraPreset(preset.cameraStudio.orbitPreset);
      status(
        stageModel
          ? `${preset.label} — environment ×${preset.envScaleMultiplier ?? envScale.toFixed(1)}, camera re-framed`
          : `${preset.label} — will apply on next environment import`
      );
    }
  };

  const place = (id: CharacterPlacementId) => {
    if (!selectedCharacterId) {
      status('Select a character first.');
      return;
    }
    const pos = placementToPosition(id);
    if (pos.x !== undefined) onModifyModelPosition(selectedCharacterId, 'positionX', pos.x);
    if (pos.y !== undefined) onModifyModelPosition(selectedCharacterId, 'positionY', pos.y);
    if (pos.z !== undefined) onModifyModelPosition(selectedCharacterId, 'positionZ', pos.z);
    status(`Placed character: ${id.replace(/_/g, ' ')}`);
  };

  const turnCharacter = (deltaY: number) => {
    if (!selectedCharacterId) {
      status('Select a character first.');
      return;
    }
    const character = characters.find((m) => m.id === selectedCharacterId);
    if (!character) return;
    const nextY = (character.rotationY ?? 0) + deltaY;
    onModelRotate?.(
      selectedCharacterId,
      character.rotationX ?? 0,
      nextY,
      character.rotationZ ?? 0
    );
    status(`Turned character ${deltaY > 0 ? '+' : ''}${deltaY}°`);
  };

  const patchDepth = (patch: Partial<EnvironmentDepthSettings>) => {
    const next = { ...depth, ...patch };
    setDepth(next);
    applyPatches(depthToPatches(next));
  };

  const generate = () => {
    applyPatches(generateShowcase(appState, categoryId));
    for (const character of characters) {
      onModifyModelPosition(character.id, 'positionY', 0);
    }
  };

  const savePreset = () => {
    const preset: EnvironmentPresetV1 = {
      version: 1,
      id: createEnvironmentPresetId(),
      name: `Environment ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      categoryId,
      scaleId,
      cameraId: (cameraId as EnvironmentPresetV1['cameraId']) ?? null,
      depth,
      timeHours: appState.dynamicSky?.timeHours ?? null,
      visualFx: appState.visualFx,
      dynamicSky: appState.dynamicSky,
      sceneComposer: appState.sceneComposer,
    };
    setPresets(saveEnvironmentPreset(preset));
    status('Environment Preset saved.');
  };

  const applyPreset = (preset: EnvironmentPresetV1) => {
    if (preset.visualFx) onSetVisualFx(preset.visualFx);
    if (preset.dynamicSky) onPatchDynamicSky(preset.dynamicSky);
    if (preset.sceneComposer) onPatchSceneComposer(preset.sceneComposer);
    setDepth(preset.depth);
    setScaleId(preset.scaleId);
    setCategoryId(preset.categoryId);
    status(`Applied ${preset.name}`);
  };

  return (
    <div className="text-zinc-200 bg-[#0c1119] min-h-full">
      <header className="p-3 border-b border-[#233142] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.13),transparent_48%)]">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-emerald-300" />
          <div>
            <h2 className="text-[12px] font-black tracking-wide m-0">ENVIRONMENT BUILDER</h2>
            <p className="text-[8px] text-zinc-500 m-0">Import a scene · place a character · Generate</p>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-100 text-[9px] font-bold disabled:opacity-40"
          >
            <Wand2 className="w-3 h-3" /> Generate
          </button>
        </div>
        <div className="grid grid-cols-6 gap-0.5 mt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`py-1.5 rounded text-[8px] font-bold ${
                tab === item.id ? 'bg-emerald-500/20 text-emerald-100' : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-3 space-y-4">
        {tab === 'import' ? (
          <>
            <Section title="Import as">
              <div className="grid grid-cols-2 gap-1">
                {IMPORT_ROLES.map((item) => (
                  <Chip key={item.id} active={role === item.id} label={item.label} sub={item.hint} onClick={() => setRole(item.id)} />
                ))}
              </div>
            </Section>
            <Section title="Background import">
              <button
                type="button"
                disabled={busy}
                onClick={() => modelInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-md border border-emerald-500/35 bg-emerald-950/20 text-[10px] font-bold text-emerald-200 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Box className="w-3.5 h-3.5" />}
                Import 3D {role === 'character' ? 'Character' : role === 'prop' ? 'Prop' : 'Environment'}
              </button>
              <button
                type="button"
                disabled={busy || !onImportHdr}
                onClick={() => hdrInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-md border border-amber-500/35 bg-amber-950/10 text-[9px] font-bold text-amber-200 disabled:opacity-40"
              >
                <Sun className="w-3.5 h-3.5" /> Import HDRI Lighting
              </button>
              <p className="text-[7px] text-zinc-600 m-0 text-center">GLB · GLTF · FBX · OBJ · PMX · ZIP · HDR</p>
              {error ? <p className="text-[8px] text-rose-400 m-0">{error}</p> : null}
            </Section>
            <Section title="Auto Scale">
              <div className="grid grid-cols-2 gap-1">
                {WORLD_SCALE_PRESETS.map((preset) => (
                  <Chip key={preset.id} active={scaleId === preset.id} label={preset.label} sub={preset.description} onClick={() => applyScale(preset.id)} />
                ))}
              </div>
            </Section>
            <Section title="Environment Scale">
              {stageModel ? (
                <>
                  <label className="block">
                    <span className="flex justify-between text-[8px] text-zinc-500">
                      <span>Size multiplier</span>
                      <span className="text-emerald-200">×{envScale.toFixed(2)}</span>
                    </span>
                    <input
                      type="range"
                      min={0.25}
                      max={30}
                      step={0.05}
                      value={Math.min(30, envScale)}
                      onChange={(e) =>
                        onSetModelWorldScale?.(stageModel.id, Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        // Tiny legacy imports (~character-sized) need a big jump;
                        // already-scaled scenes grow more gently.
                        const next = envScale < 2 ? 6 : Math.min(30, Number((envScale * 1.6).toFixed(2)));
                        onSetModelWorldScale?.(stageModel.id, next);
                        status(`Environment ×${next} — character should fit inside.`);
                      }}
                      className="py-2 rounded-md border border-emerald-500/35 bg-emerald-950/20 text-[9px] font-bold text-emerald-200"
                    >
                      Fit character inside
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetModelWorldScale?.(stageModel.id, 1);
                        status('Environment reset to import size.');
                      }}
                      className="py-2 rounded-md border border-[#334158] text-[9px] font-bold text-zinc-300"
                    >
                      Reset ×1
                    </button>
                  </div>
                  <p className="text-[7px] text-zinc-600 m-0">
                    FBX/GLB/OBJ stages auto-resize on import. If still tiny, press Fit or raise the slider.
                  </p>
                </>
              ) : (
                <p className="text-[8px] text-zinc-500 m-0">
                  Import an environment first — then adjust its real size here.
                </p>
              )}
            </Section>
          </>
        ) : null}

        {tab === 'fit' ? (
          <>
            <Section title="Scene Analyzer">
              <div className="p-2 rounded border border-[#243044] bg-[#101722] text-[9px] space-y-1">
                <div className="flex justify-between"><span className="text-zinc-500">Scene type</span><span className="font-bold text-emerald-200">{analysis.kind}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Environment</span><span>{analysis.hasEnvironment ? 'Imported' : 'None'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Characters</span><span>{analysis.characterCount}</span></div>
              </div>
              <div className="space-y-1 mt-1">
                {analysis.suggestions.map((item) => (
                  <div key={item} className="px-2 py-1.5 rounded bg-[#111722] border border-[#253044] text-[9px] text-zinc-300">
                    <Sparkles className="inline w-3 h-3 mr-1.5 text-amber-300" />{item}
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Character Placement">
              <div className="grid grid-cols-2 gap-1">
                {PLACEMENTS.map((item) => (
                  <Chip key={item.id} label={item.label} onClick={() => place(item.id)} />
                ))}
              </div>
              <p className="text-[7px] text-zinc-600 m-0">
                {selectedCharacterId ? 'Applies to the selected character.' : 'Select a character to enable placement.'}
              </p>
            </Section>
            <Section title="Character Facing">
              <div className="grid grid-cols-3 gap-1">
                <Chip label="Turn −90°" onClick={() => turnCharacter(-90)} />
                <Chip label="Turn 180°" onClick={() => turnCharacter(180)} />
                <Chip label="Turn +90°" onClick={() => turnCharacter(90)} />
              </div>
              <p className="text-[7px] text-zinc-600 m-0">
                Or select the character → press Rotate in the viewport → drag the green ring.
              </p>
            </Section>
          </>
        ) : null}

        {tab === 'look' ? (
          <>
            <Section title="Background Depth">
              {([
                ['blur', 'Depth Blur'],
                ['fog', 'Atmospheric Fog'],
                ['distanceFade', 'Distance Fade'],
                ['brightness', 'Brightness'],
                ['saturation', 'Saturation'],
                ['exposure', 'Exposure'],
                ['contrast', 'Contrast'],
              ] as Array<[keyof EnvironmentDepthSettings, string]>).map(([key, label]) => {
                const max = key === 'blur' || key === 'fog' || key === 'distanceFade' ? 1 : 2;
                return (
                  <label key={key} className="block">
                    <span className="flex justify-between text-[8px] text-zinc-500">
                      <span>{label}</span>
                      <span className="text-emerald-200">{depth[key].toFixed(2)}</span>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={max}
                      step={0.01}
                      value={depth[key]}
                      onChange={(e) => patchDepth({ [key]: Number(e.target.value) } as Partial<EnvironmentDepthSettings>)}
                      className="w-full"
                    />
                  </label>
                );
              })}
            </Section>
            <Section title="Background FX">
              <div className="grid grid-cols-3 gap-1">
                {BACKGROUND_FX.map((item) => (
                  <Chip key={item.id} label={item.label} onClick={() => { onSetVisualFx(item.visualFx); status(`${item.label} enabled`); }} />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'camera' ? (
          <Section title="Smart Camera">
            <div className="grid grid-cols-2 gap-1">
              {SMART_CAMERAS.map((item) => (
                <Chip
                  key={item.id}
                  active={cameraId === item.id}
                  label={item.label}
                  sub={item.description}
                  onClick={() => {
                    setCameraId(item.id);
                    onPatchCameraStudio({ focusTarget: item.focusTarget, autoFocus: true });
                    onApplyCameraPreset(item.preset);
                    status(`Camera: ${item.label}`);
                  }}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {tab === 'library' ? (
          <Section title="Background Library">
            <div className="grid grid-cols-2 gap-1">
              {ENVIRONMENT_CATEGORIES.map((item) => (
                <Chip
                  key={item.id}
                  active={categoryId === item.id}
                  label={item.label}
                  sub={item.description}
                  onClick={() => {
                    setCategoryId(item.id);
                    applyPatches(item.patches);
                  }}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {tab === 'presets' ? (
          <Section title="Environment Presets">
            <button type="button" onClick={savePreset} className="w-full p-2 rounded border border-[#334158] text-[9px] font-bold">
              <Save className="inline w-3 h-3 mr-1" /> Save current environment
            </button>
            <div className="space-y-1 mt-1">
              {presets.length === 0 ? (
                <p className="text-[9px] text-zinc-500 m-0">No presets yet. Build a scene and save it.</p>
              ) : (
                presets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyPreset(preset)} className="w-full text-left px-2 py-1.5 bg-[#111722] rounded text-[9px] flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-emerald-300" /> {preset.name}
                  </button>
                ))
              )}
            </div>
          </Section>
        ) : null}

        {message ? (
          <div className="sticky bottom-2 p-2 rounded border border-emerald-500/30 bg-[#0f1d18]/95 text-[8px] text-emerald-100 flex items-center gap-1.5">
            <Move3d className="w-3 h-3" /> {message}
          </div>
        ) : null}
      </div>

      <input
        ref={modelInputRef}
        type="file"
        accept=".pmx,.pmd,.fbx,.glb,.gltf,.vrm,.obj,.zip,application/zip"
        multiple
        className="hidden"
        onChange={(e) => {
          void runImport(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <input
        ref={hdrInputRef}
        type="file"
        accept=".hdr,.exr"
        className="hidden"
        onChange={(e) => {
          void runImport(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}
