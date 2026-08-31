import { useMemo, useState } from 'react';
import {
  Aperture,
  Camera,
  Download,
  Heart,
  Lightbulb,
  Loader2,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { AppState, MorphState, VisualFxSettings } from '../../types';
import type { DynamicSkyState } from '../../dynamicSky';
import type { SceneComposerState } from '../../sceneComposer';
import type { PoseSnapshotV1 } from '../../pose/poseTypes';
import {
  PHOTO_ATMOSPHERES,
  PHOTO_CAMERAS,
  PHOTO_CINEMATIC_FX,
  PHOTO_COMPOSITIONS,
  PHOTO_DOF,
  PHOTO_EXPRESSIONS,
  PHOTO_GRADES,
  PHOTO_LIGHTING,
  PHOTO_POSES,
  PHOTO_SCENES,
  PHOTO_SOCIAL_EXPORTS,
  PHOTO_WEATHER,
  ULTRA_RENDER_SIZES,
  buildPhotoAiSuggestions,
  createPhotoPresetId,
  generateDirectorLook,
  loadPhotoPresets,
  loadPhotoSession,
  renderPhotoStill,
  savePhotoPreset,
  savePhotoSession,
  searchPhotoPoses,
  type PhotoLookPatches,
  type PhotoPoseCategory,
  type PhotoPresetV1,
} from '../../photoStudio';
import {
  getVqStoreSnapshot,
  setVqDebugHud,
  setVqLegacyCompare,
  setVqPhotoMode,
  setVqPreferredPreset,
} from '../../visualQuality';

type Tab = 'create' | 'pose' | 'look' | 'camera' | 'render' | 'director';

export interface PhotoStudioPanelProps {
  appState: AppState;
  onSetVisualFx: (patch: Partial<VisualFxSettings>) => void;
  onPatchDynamicSky: (patch: Partial<DynamicSkyState>) => void;
  onPatchSceneComposer: (
    patch: Partial<SceneComposerState> & { lights?: Partial<SceneComposerState['lights']> }
  ) => void;
  onPatchCameraStudio: (patch: Partial<AppState['cameraStudio']>) => void;
  onApplyPose?: (pose: PoseSnapshotV1) => void;
  onModifyMorphs: (
    modelId: string,
    morphName: 'eyes' | 'mouth' | 'brow',
    value: number
  ) => void;
  getViewportCanvas?: () => HTMLCanvasElement | null;
  invalidateViewport?: () => void;
  onStatus?: (message: string) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'create', label: 'Create' },
  { id: 'pose', label: 'Pose' },
  { id: 'look', label: 'Look' },
  { id: 'camera', label: 'Camera' },
  { id: 'render', label: 'Render' },
  { id: 'director', label: 'Director' },
];

function GridButton({
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
      className={`min-h-12 text-left p-2 border rounded-md transition-colors ${
        active
          ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
          : 'border-[#283142] bg-[#111722] text-zinc-200 hover:border-[#46536a]'
      }`}
    >
      <span className="block text-[10px] font-bold leading-tight">{label}</span>
      {sub ? <span className="block text-[8px] text-zinc-500 mt-0.5 line-clamp-2">{sub}</span> : null}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="m-0 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

export default function PhotoStudioPanel({
  appState,
  onSetVisualFx,
  onPatchDynamicSky,
  onPatchSceneComposer,
  onPatchCameraStudio,
  onApplyPose,
  onModifyMorphs,
  getViewportCanvas,
  invalidateViewport,
  onStatus,
}: PhotoStudioPanelProps) {
  const initial = loadPhotoSession();
  const [tab, setTab] = useState<Tab>('create');
  const [query, setQuery] = useState(initial.query);
  const [category, setCategory] = useState<PhotoPoseCategory | 'All'>(initial.category);
  const [favorites, setFavorites] = useState(initial.favoritePoseIds);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState(() => loadPhotoPresets());
  const [suggestion, setSuggestion] = useState<string | null>(initial.lastSuggestion);

  const modelId = appState.selectedObjectId ?? appState.models[0]?.id ?? null;
  const filteredPoses = useMemo(
    () => searchPhotoPoses(query, category, favorites),
    [query, category, favorites]
  );
  const suggestions = useMemo(() => buildPhotoAiSuggestions(appState), [appState]);

  const status = (message: string) => {
    setSuggestion(message);
    savePhotoSession({ lastSuggestion: message });
    onStatus?.(message);
  };

  const applyMorphs = (morphs: MorphState) => {
    if (!modelId) return;
    onModifyMorphs(modelId, 'eyes', morphs.eyes);
    onModifyMorphs(modelId, 'mouth', morphs.mouth);
    onModifyMorphs(modelId, 'brow', morphs.brow);
  };

  const applyLook = (look: PhotoLookPatches) => {
    if (look.visualFx) onSetVisualFx(look.visualFx);
    if (look.dynamicSky) onPatchDynamicSky(look.dynamicSky);
    if (look.sceneComposer) onPatchSceneComposer(look.sceneComposer);
    if (look.cameraStudio) onPatchCameraStudio(look.cameraStudio);
    if (look.pose) onApplyPose?.(look.pose);
    if (look.morphs) applyMorphs(look.morphs);
    if (look.message) status(look.message);
  };

  const randomize = () => applyLook(generateDirectorLook());

  const exportSize = async (
    width: number,
    height: number,
    mime: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
    name?: string,
    transparent = false
  ) => {
    setBusy(true);
    try {
      const result = await renderPhotoStill({
        canvas: getViewportCanvas?.() ?? null,
        width,
        height,
        mime,
        transparent,
        filename: name,
        invalidate: invalidateViewport,
      });
      status(result.message);
    } finally {
      setBusy(false);
    }
  };

  const runDirector = async (count: number) => {
    if (!getViewportCanvas?.()) {
      status('Viewport is not ready.');
      return;
    }
    setBusy(true);
    try {
      for (let i = 0; i < count; i++) {
        const look = generateDirectorLook();
        applyLook(look);
        await new Promise((resolve) => setTimeout(resolve, 180));
        const result = await renderPhotoStill({
          canvas: getViewportCanvas?.() ?? null,
          width: 1920,
          height: 1080,
          mime: 'image/jpeg',
          filename: `animastage-director-${String(i + 1).padStart(2, '0')}.jpg`,
          invalidate: invalidateViewport,
          settleFrames: 2,
        });
        if (!result.ok) {
          status(result.message);
          break;
        }
      }
      status(`Screenshot Director generated ${count} variations.`);
    } finally {
      setBusy(false);
    }
  };

  const saveCurrentPreset = () => {
    const pose = appState.models.find((m) => m.id === modelId)?.poseHold ?? null;
    const preset: PhotoPresetV1 = {
      version: 1,
      id: createPhotoPresetId(),
      name: `Photo ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      poseId: pose?.id ?? null,
      expressionId: (selected.expression as PhotoPresetV1['expressionId']) ?? null,
      sceneId: (selected.scene as PhotoPresetV1['sceneId']) ?? null,
      lightingId: (selected.light as PhotoPresetV1['lightingId']) ?? null,
      atmosphereId: (selected.atmosphere as PhotoPresetV1['atmosphereId']) ?? null,
      cameraId: (selected.camera as PhotoPresetV1['cameraId']) ?? null,
      compositionId: (selected.composition as PhotoPresetV1['compositionId']) ?? null,
      dofId: (selected.dof as PhotoPresetV1['dofId']) ?? null,
      fxIds: [],
      gradeId: (selected.grade as PhotoPresetV1['gradeId']) ?? null,
      weatherId: (selected.weather as PhotoPresetV1['weatherId']) ?? null,
      timeHours: appState.dynamicSky?.timeHours ?? null,
      visualFx: appState.visualFx,
      dynamicSky: appState.dynamicSky,
      cameraStudio: appState.cameraStudio,
      pose,
    };
    setPresets(savePhotoPreset(preset));
    status('Photo Preset saved.');
  };

  const applyPreset = (preset: PhotoPresetV1) =>
    applyLook({
      visualFx: preset.visualFx,
      dynamicSky: preset.dynamicSky,
      cameraStudio: preset.cameraStudio,
      pose: preset.pose,
      message: `Applied ${preset.name}`,
    });

  const choose = (group: string, id: string) =>
    setSelected((current) => ({ ...current, [group]: id }));

  return (
    <div className="text-zinc-200 bg-[#0c1119] min-h-full">
      <header className="p-3 border-b border-[#242d3d] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.13),transparent_48%)]">
        <div className="flex items-center gap-2">
          <Aperture className="w-4 h-4 text-cyan-300" />
          <div>
            <h2 className="text-[12px] font-black tracking-wide m-0">PHOTO STUDIO 2.0</h2>
            <p className="text-[8px] text-zinc-500 m-0">Cinematic anime artwork in a few clicks</p>
          </div>
          <button
            type="button"
            onClick={randomize}
            disabled={!modelId || busy}
            className="ml-auto p-2 rounded border border-cyan-500/30 text-cyan-200 disabled:opacity-40"
            title="Random complete look"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-0.5 mt-3">
          {TABS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`py-1.5 rounded text-[8px] font-bold ${
                tab === item.id ? 'bg-cyan-500/20 text-cyan-100' : 'text-zinc-500 hover:bg-white/5'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-3 space-y-4">
        {!modelId ? (
          <div className="p-3 border border-amber-500/30 bg-amber-500/5 rounded text-[9px] text-amber-100">
            Load and select a character to use poses and expressions.
          </div>
        ) : null}

        {tab === 'create' ? (
          <>
            <Section title="Quick create">
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={randomize} disabled={!modelId} className="p-3 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-left disabled:opacity-40">
                  <Wand2 className="w-4 h-4 text-cyan-300 mb-2" />
                  <span className="block text-[10px] font-bold">Auto Artwork</span>
                  <span className="text-[8px] text-zinc-500">Pose + camera + light + FX</span>
                </button>
                <button type="button" onClick={() => setTab('render')} className="p-3 rounded-md border border-[#293448] bg-[#111722] text-left">
                  <Download className="w-4 h-4 text-emerald-300 mb-2" />
                  <span className="block text-[10px] font-bold">Ultra Render</span>
                  <span className="text-[8px] text-zinc-500">1080p through 8K</span>
                </button>
              </div>
            </Section>
            <Section title="Photo AI Assistant">
              <div className="space-y-1">
                {suggestions.map((item) => (
                  <button type="button" key={item} onClick={() => status(item)} className="w-full text-left px-2 py-1.5 rounded bg-[#111722] border border-[#253044] text-[9px] text-zinc-300">
                    <Sparkles className="inline w-3 h-3 mr-1.5 text-amber-300" />{item}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Photo Presets">
              <button type="button" onClick={saveCurrentPreset} className="w-full p-2 rounded border border-[#334158] text-[9px] font-bold">
                <Save className="inline w-3 h-3 mr-1" /> Save current Photo Preset
              </button>
              <div className="space-y-1 mt-1">
                {presets.slice(0, 8).map((preset) => (
                  <button type="button" key={preset.id} onClick={() => applyPreset(preset)} className="w-full text-left px-2 py-1.5 bg-[#111722] rounded text-[9px]">
                    {preset.name}
                  </button>
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'pose' ? (
          <>
            <Section title="Smart Pose Library">
              <div className="relative">
                <Search className="absolute left-2 top-2 w-3 h-3 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    savePhotoSession({ query: e.target.value });
                  }}
                  placeholder="Search poses…"
                  className="w-full pl-7 pr-2 py-1.5 bg-[#111722] border border-[#2a3548] rounded text-[9px]"
                />
              </div>
              <select
                value={category}
                onChange={(e) => {
                  const value = e.target.value as PhotoPoseCategory | 'All';
                  setCategory(value);
                  savePhotoSession({ category: value });
                }}
                className="w-full p-1.5 bg-[#111722] border border-[#2a3548] rounded text-[9px]"
              >
                <option>All</option>
                {[...new Set(PHOTO_POSES.map((pose) => pose.category))].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <div className="grid grid-cols-3 gap-1">
                {filteredPoses.map((pose) => (
                  <div key={pose.id} className="relative">
                    <GridButton
                      active={selected.pose === pose.id}
                      label={`${pose.thumbnail} ${pose.name}`}
                      sub={pose.category}
                      onClick={() => {
                        choose('pose', pose.id);
                        onApplyPose?.(pose);
                      }}
                    />
                    <button
                      type="button"
                      title="Favorite"
                      onClick={() => {
                        const next = favorites.includes(pose.id)
                          ? favorites.filter((id) => id !== pose.id)
                          : [...favorites, pose.id];
                        setFavorites(next);
                        savePhotoSession({ favoritePoseIds: next });
                      }}
                      className="absolute top-1 right-1 p-1"
                    >
                      <Heart className={`w-2.5 h-2.5 ${favorites.includes(pose.id) ? 'fill-rose-400 text-rose-400' : 'text-zinc-600'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Expressions">
              <div className="grid grid-cols-3 gap-1">
                {PHOTO_EXPRESSIONS.map((expression) => (
                  <GridButton
                    key={expression.id}
                    active={selected.expression === expression.id}
                    label={expression.label}
                    onClick={() => {
                      choose('expression', expression.id);
                      applyMorphs(expression.morphs);
                    }}
                  />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'look' ? (
          <>
            <Section title="Anime Scene Library">
              <div className="grid grid-cols-2 gap-1">
                {PHOTO_SCENES.map((scene) => (
                  <GridButton key={scene.id} active={selected.scene === scene.id} label={scene.label} sub={scene.description} onClick={() => {
                    choose('scene', scene.id);
                    applyLook({ visualFx: scene.visualFx, dynamicSky: scene.dynamicSky });
                  }} />
                ))}
              </div>
            </Section>
            <Section title="Smart Lighting">
              <div className="grid grid-cols-3 gap-1">
                {PHOTO_LIGHTING.map((light) => (
                  <GridButton key={light.id} active={selected.light === light.id} label={light.label} onClick={() => {
                    choose('light', light.id);
                    applyLook({ visualFx: light.visualFx, dynamicSky: light.dynamicSky, sceneComposer: light.composer });
                  }} />
                ))}
              </div>
            </Section>
            <Section title="Atmosphere">
              <div className="grid grid-cols-3 gap-1">
                {PHOTO_ATMOSPHERES.map((item) => (
                  <GridButton key={item.id} active={selected.atmosphere === item.id} label={item.label} onClick={() => {
                    choose('atmosphere', item.id);
                    onSetVisualFx(item.visualFx);
                  }} />
                ))}
              </div>
            </Section>
            <Section title="Weather + Dynamic Sky">
              <input
                type="range"
                min={0}
                max={24}
                step={0.1}
                value={appState.dynamicSky?.timeHours ?? 12}
                onChange={(e) => onPatchDynamicSky({ enabled: true, timeHours: Number(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-[8px] text-zinc-500">
                <span>0:00</span><span className="text-cyan-200">{(appState.dynamicSky?.timeHours ?? 12).toFixed(1)}h</span><span>24:00</span>
              </div>
              <div className="grid grid-cols-3 gap-1 mt-2">
                {PHOTO_WEATHER.map((item) => (
                  <GridButton key={item.id} active={selected.weather === item.id} label={item.label} onClick={() => {
                    choose('weather', item.id);
                    applyLook({ dynamicSky: item.dynamicSky, visualFx: item.visualFx });
                  }} />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'camera' ? (
          <>
            <Section title="Professional Camera Presets">
              <div className="grid grid-cols-2 gap-1">
                {PHOTO_CAMERAS.map((camera) => (
                  <GridButton key={camera.id} active={selected.camera === camera.id} label={camera.label} sub={camera.description} onClick={() => {
                    choose('camera', camera.id);
                    onPatchCameraStudio(camera.cameraStudio);
                  }} />
                ))}
              </div>
            </Section>
            <Section title="Auto Composition">
              <div className="grid grid-cols-2 gap-1">
                {PHOTO_COMPOSITIONS.map((item) => (
                  <GridButton key={item.id} active={selected.composition === item.id} label={item.label} sub={item.description} onClick={() => {
                    choose('composition', item.id);
                    onPatchCameraStudio(item.cameraStudio);
                  }} />
                ))}
              </div>
            </Section>
            <Section title="Depth of Field">
              <div className="grid grid-cols-3 gap-1">
                {PHOTO_DOF.map((item) => (
                  <GridButton key={item.id} active={selected.dof === item.id} label={item.label} onClick={() => {
                    choose('dof', item.id);
                    onSetVisualFx(item.visualFx);
                  }} />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'render' ? (
          <>
            <Section title="Visual Quality 2.0">
              <p className="text-[9px] text-zinc-500 m-0">
                Photo export locks max shadows, AO, fog, particles, and DOF for stills.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <GridButton
                  label="Photo Quality On"
                  sub="Max VQ for stills"
                  onClick={() => {
                    setVqPhotoMode(true);
                    setVqPreferredPreset('photo');
                    onStatus?.('VQ Photo Quality enabled');
                  }}
                />
                <GridButton
                  label="Balanced"
                  sub="Desktop default"
                  onClick={() => {
                    setVqPhotoMode(false);
                    setVqPreferredPreset('balanced');
                    onStatus?.('VQ Balanced');
                  }}
                />
                <GridButton
                  label="A/B Legacy"
                  sub="Compare pre-VQ2"
                  onClick={() => {
                    const next = !getVqStoreSnapshot().legacyCompare;
                    setVqLegacyCompare(next);
                    onStatus?.(next ? 'A/B Legacy ON' : 'A/B Legacy OFF');
                  }}
                />
                <GridButton
                  label="VQ Debug HUD"
                  onClick={() => {
                    const next = !getVqStoreSnapshot().debugHud;
                    setVqDebugHud(next);
                    onStatus?.(next ? 'VQ Debug HUD ON' : 'VQ Debug HUD OFF');
                  }}
                />
              </div>
            </Section>
            <Section title="Ultra Render">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(ULTRA_RENDER_SIZES).map(([name, size]) => (
                  <GridButton key={name} label={`${name.toUpperCase()} · ${size.width}×${size.height}`} onClick={() => void exportSize(size.width, size.height)} />
                ))}
                <GridButton label="Transparent PNG" onClick={() => void exportSize(3840, 2160, 'image/png', undefined, true)} />
                <GridButton label="JPG" onClick={() => void exportSize(3840, 2160, 'image/jpeg')} />
                <GridButton label="WebP" onClick={() => void exportSize(3840, 2160, 'image/webp')} />
              </div>
            </Section>
            <Section title="Social Export">
              <div className="grid grid-cols-2 gap-1">
                {PHOTO_SOCIAL_EXPORTS.map((item) => (
                  <GridButton key={item.id} label={item.label} sub={`${item.width} × ${item.height}`} onClick={() => void exportSize(item.width, item.height, item.mime)} />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {tab === 'director' ? (
          <>
            <Section title="Screenshot Director">
              <p className="text-[9px] text-zinc-500 m-0">Automatically varies camera, pose, lighting, DOF, FX, composition and weather.</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[10, 20, 50].map((count) => (
                  <button key={count} type="button" disabled={busy || !modelId} onClick={() => void runDirector(count)} className="py-3 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-[10px] font-black disabled:opacity-40">
                    {busy ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `Generate ${count}`}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Cinematic Effects">
              <div className="grid grid-cols-2 gap-1">
                {PHOTO_CINEMATIC_FX.map((item) => (
                  <GridButton key={item.id} label={item.label} onClick={() => onSetVisualFx(item.visualFx)} />
                ))}
              </div>
            </Section>
            <Section title="Color Grading">
              <div className="grid grid-cols-3 gap-1">
                {PHOTO_GRADES.map((item) => (
                  <GridButton key={item.id} active={selected.grade === item.id} label={item.label} onClick={() => {
                    choose('grade', item.id);
                    onSetVisualFx(item.visualFx);
                  }} />
                ))}
              </div>
            </Section>
          </>
        ) : null}

        {suggestion ? (
          <div className="sticky bottom-2 p-2 rounded border border-cyan-500/30 bg-[#101c28]/95 text-[8px] text-cyan-100">
            <Lightbulb className="inline w-3 h-3 mr-1 text-amber-300" /> {suggestion}
          </div>
        ) : null}
        {busy ? (
          <div className="flex items-center justify-center gap-2 text-[9px] text-cyan-200 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendering…
          </div>
        ) : null}
      </div>
    </div>
  );
}
