import { useCallback, useRef } from 'react';
import type { AppState, MMDModel, TimelineKeyframe, TimelineTrackId } from '../types';
import { createEmptyKeyframes, mergeTimelineKeyframes } from '../components/TimelineLogic';
import { createDefaultLayers } from '../editor/animationLayers';
import type { useClipEditor } from './useClipEditor';
import type { useGlobalUndo } from './useGlobalUndo';
import { buildVmdFromTimeline, downloadVmd } from '../editor/vmdExport';
import { analyzeLoadedMesh } from '../analyzer/analyzeModel';
import { runCisPipeline, type CisReport } from '../cis';
import type { ApisReport } from '../apis';
import { registerCharacterProfile } from '../product/vcs/applyVcs';
import { stepPlayhead } from './useEditorKeyboard';

type ClipEditor = ReturnType<typeof useClipEditor>;
type GlobalUndo = ReturnType<typeof useGlobalUndo>;

function markDirty(models: MMDModel[], modelId: string | null): MMDModel[] {
  if (!modelId) return models;
  return models.map((m) => (m.id === modelId ? { ...m, clipDirty: true } : m));
}

export function useEditorDocument(
  appState: AppState,
  setAppState: React.Dispatch<React.SetStateAction<AppState>>,
  clipEditor: ClipEditor,
  globalUndo: GlobalUndo,
  handlers: {
    setCurrentFrame: (f: number) => void;
    setIsPlaying: (p: boolean) => void;
    setTimelineActiveTrack: (t: AppState['timelineActiveTrack']) => void;
    handleDeleteKeyframe: (modelId: string, track: string, frame: number) => void;
  }
) {
  const selectedId = appState.selectedObjectId;
  const selectedModel = appState.models.find((m) => m.id === selectedId);

  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const pmxBufferCacheRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const analysisTokenRef = useRef<string | null>(null);
  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateModelKeyframes = useCallback(
    (modelId: string, keyframes: TimelineKeyframe[], commit = true) => {
      if (commit) globalUndo.record(appStateRef.current);
      setAppState((prev) => ({
        ...prev,
        models: markDirty(
          prev.models.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  keyframes: commit ? clipEditor.commit(keyframes) : keyframes,
                }
              : m
          ),
          modelId
        ),
      }));
    },
    [setAppState, clipEditor, globalUndo]
  );

  const recordGlobalState = useCallback(() => {
    globalUndo.record(appStateRef.current);
  }, [globalUndo]);

  const handleUndo = useCallback(() => {
    if (globalUndo.canUndo()) {
      setAppState((s) => globalUndo.undo(s) ?? s);
      return;
    }
    if (!selectedId || !selectedModel) return;
    const prev = clipEditor.applyUndo(selectedModel.keyframes);
    setAppState((s) => ({
      ...s,
      models: s.models.map((m) => (m.id === selectedId ? { ...m, keyframes: prev } : m)),
    }));
  }, [selectedId, selectedModel, clipEditor, setAppState, globalUndo]);

  const handleRedo = useCallback(() => {
    if (globalUndo.canRedo()) {
      setAppState((s) => globalUndo.redo(s) ?? s);
      return;
    }
    if (!selectedId || !selectedModel) return;
    const next = clipEditor.applyRedo(selectedModel.keyframes);
    setAppState((s) => ({
      ...s,
      models: s.models.map((m) => (m.id === selectedId ? { ...m, keyframes: next } : m)),
    }));
  }, [selectedId, selectedModel, clipEditor, setAppState, globalUndo]);

  const handleCopy = useCallback(() => {
    if (!selectedModel) return;
    clipEditor.copyAtFrame(selectedModel.keyframes, appState.currentFrame);
  }, [selectedModel, appState.currentFrame, clipEditor]);

  const handlePaste = useCallback(() => {
    if (!selectedId || !selectedModel) return;
    const next = clipEditor.pasteAtFrame(selectedModel.keyframes, appState.currentFrame, false);
    updateModelKeyframes(selectedId, next, false);
  }, [selectedId, selectedModel, appState.currentFrame, clipEditor, updateModelKeyframes]);

  const handleMirrorPaste = useCallback(() => {
    if (!selectedId || !selectedModel) return;
    const next = clipEditor.pasteAtFrame(selectedModel.keyframes, appState.currentFrame, true);
    updateModelKeyframes(selectedId, next, false);
  }, [selectedId, selectedModel, appState.currentFrame, clipEditor, updateModelKeyframes]);

  const handleExportVmd = useCallback(() => {
    if (!selectedModel) return;
    const buf = buildVmdFromTimeline({
      keyframes: selectedModel.keyframes,
      maxFrames: appState.maxFrames,
      bones: selectedModel.bones,
      morphs: selectedModel.morphs,
      clipName: selectedModel.name,
      nativeBezier: appState.sceneDirector?.vmdNativeBezier !== false,
    });
    downloadVmd(buf, `${selectedModel.name.replace(/\s+/g, '_')}.vmd`);
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === selectedModel.id ? { ...m, clipDirty: false } : m
      ),
    }));
  }, [selectedModel, appState.maxFrames, appState.sceneDirector?.vmdNativeBezier, setAppState]);

  const handleNewClip = useCallback(() => {
    if (!selectedId) return;
    globalUndo.record(appState);
    setAppState((prev) => ({
      ...prev,
      models: prev.models.map((m) =>
        m.id === selectedId
          ? {
              ...m,
              keyframes: createEmptyKeyframes(),
              activeTemplateId: null,
              vmdPlaybackEnabled: false,
              clipDirty: true,
            }
          : m
      ),
      currentFrame: 0,
      isPlaying: false,
    }));
    clipEditor.clearUndo();
    globalUndo.clear();
  }, [selectedId, appState, setAppState, clipEditor, globalUndo]);

  const handleSimplifyTrack = useCallback(() => {
    const track = appState.timelineActiveTrack;
    if (!selectedId || !selectedModel || !track || track === 'camera') return;
    const next = clipEditor.simplify(selectedModel.keyframes, track as TimelineTrackId);
    updateModelKeyframes(selectedId, next, false);
  }, [selectedId, selectedModel, appState.timelineActiveTrack, clipEditor, updateModelKeyframes]);

  const handleClearTrack = useCallback(() => {
    const track = appState.timelineActiveTrack;
    if (!selectedId || !selectedModel || !track || track === 'camera') return;
    const next = clipEditor.clearTrack(selectedModel.keyframes, track as TimelineTrackId);
    updateModelKeyframes(selectedId, next, false);
  }, [selectedId, selectedModel, appState.timelineActiveTrack, clipEditor, updateModelKeyframes]);

  const handleTimeStretch = useCallback(
    (factor: number) => {
      if (!selectedId || !selectedModel) return;
      const next = clipEditor.stretch(
        selectedModel.keyframes,
        factor,
        appState.maxFrames
      );
      updateModelKeyframes(selectedId, next, false);
    },
    [selectedId, selectedModel, appState.maxFrames, clipEditor, updateModelKeyframes]
  );

  const handleMoveKeyframe = useCallback(
    (track: TimelineTrackId, from: number, to: number) => {
      if (!selectedId || !selectedModel) return;
      const next = clipEditor.moveKey(selectedModel.keyframes, track, from, to);
      updateModelKeyframes(selectedId, next, false);
    },
    [selectedId, selectedModel, clipEditor, updateModelKeyframes]
  );

  const handlePatchKeyframe = useCallback(
    (
      track: TimelineTrackId,
      frame: number,
      patch: Partial<TimelineKeyframe>,
      commit = true
    ) => {
      if (!selectedId || !selectedModel) return;
      const next = selectedModel.keyframes.map((kf) =>
        kf.track === track && kf.frame === frame ? { ...kf, ...patch } : kf
      );
      updateModelKeyframes(selectedId, next, commit);
    },
    [selectedId, selectedModel, updateModelKeyframes]
  );

  const handleDeleteAtPlayhead = useCallback(() => {
    const track = appState.timelineActiveTrack;
    if (!selectedId || !track || track === 'camera') return;
    handlers.handleDeleteKeyframe(selectedId, track, appState.currentFrame);
    setAppState((prev) => ({
      ...prev,
      models: markDirty(prev.models, selectedId),
    }));
  }, [selectedId, appState.timelineActiveTrack, appState.currentFrame, handlers, setAppState]);

  const runModelAnalysis = useCallback(
    async (
      modelId: string,
      mesh: import('three').SkinnedMesh | null,
      opts?: {
        fileMap?: Record<string, string>;
        modelFileName?: string;
        pmxBuffer?: ArrayBuffer | null;
        force?: boolean;
      }
    ) => {
      if (!mesh) return;

      const token = `${modelId}:${mesh.uuid}`;
      if (!opts?.force) {
        if (analysisTokenRef.current === token) return;
      } else {
        analysisTokenRef.current = null;
      }

      try {
        const fileName = opts?.modelFileName ?? '';
        const wantsPmxParse =
          /\.pm[xd]$/i.test(fileName) &&
          !/\.(glb|gltf|vrm|fbx|obj)$/i.test(fileName);

        let pmxBuffer = wantsPmxParse
          ? (opts?.pmxBuffer ?? pmxBufferCacheRef.current.get(modelId) ?? null)
          : null;
        if (!pmxBuffer && wantsPmxParse && opts?.fileMap && opts?.modelFileName) {
          const key = opts.modelFileName.toLowerCase();
          const rawUrl = opts.fileMap[key] ?? opts.fileMap[opts.modelFileName];
          const fetchUrl = rawUrl?.split('#')[0];
          if (fetchUrl?.startsWith('blob:')) {
            pmxBuffer = await fetch(fetchUrl).then((r) => r.arrayBuffer());
            if (pmxBuffer) pmxBufferCacheRef.current.set(modelId, pmxBuffer);
          }
        }

        const report = await analyzeLoadedMesh(mesh, {
          fileMap: opts?.fileMap,
          modelFileName: opts?.modelFileName,
          pmxBuffer,
        });

        analysisTokenRef.current = token;
        setAppState((prev) => ({
          ...prev,
          models: prev.models.map((m) =>
            m.id === modelId ? { ...m, modelAnalysis: report } : m
          ),
        }));
      } catch (err) {
        console.warn('[Analyzer] Failed:', err);
      }
    },
    [setAppState]
  );

  const handlePmxMetadata = useCallback(
    (
      modelId: string,
      meta: {
        bones: import('../types').PmxBoneInfo[];
        morphs: import('../types').PmxMorphInfo[];
        materials: import('../types').PmxMaterialInfo[];
      },
      mesh?: import('three').SkinnedMesh | null
    ) => {
      const defaultGroups = [
        {
          id: 'arms',
          name: 'Arms',
          boneNames: meta.bones
            .filter((b) => /腕|肩|arm|elbow/i.test(b.name))
            .map((b) => b.name),
          muted: false,
          solo: false,
        },
        {
          id: 'legs',
          name: 'Legs',
          boneNames: meta.bones
            .filter((b) => /足|脚|leg|thigh/i.test(b.name))
            .map((b) => b.name),
          muted: false,
          solo: false,
        },
      ];
      setAppState((prev) => {
        const existing = prev.models.find((m) => m.id === modelId);
        const sameMeta =
          existing?.pmxBones?.length === meta.bones.length &&
          existing?.pmxMorphs?.length === meta.morphs.length &&
          existing.pmxBones?.[0]?.name === meta.bones[0]?.name;
        if (sameMeta && existing?.boneGroups) {
          return prev;
        }
        return {
          ...prev,
          models: prev.models.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  pmxBones: meta.bones,
                  pmxMorphs: meta.morphs,
                  pmxMaterials: meta.materials,
                  boneGroups: m.boneGroups ?? defaultGroups,
                  animLayers: m.animLayers ?? createDefaultLayers(m.keyframes),
                }
              : m
          ),
        };
      });

      setAppState((prev) => registerCharacterProfile(prev, modelId, meta.bones, mesh ?? null));

      if (mesh) {
        const existingModel = appStateRef.current.models.find((m) => m.id === modelId);

        setAppState((prev) => ({
          ...prev,
          models: prev.models.map((m) =>
            m.id === modelId
              ? {
                  ...m,
                  cisReport: {
                    status: 'analyzing',
                    profile: null,
                    userSummary: {
                      imported: false,
                      healthPercent: 0,
                      physicsLabel: 'Analyzing…',
                      performanceLabel: '…',
                      visualQualityLabel: '…',
                      ready: false,
                      headline: 'Character Intelligence',
                    },
                  } satisfies CisReport,
                }
              : m
          ),
        }));

        if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
        analysisTimerRef.current = setTimeout(() => {
          analysisTimerRef.current = null;
          const model = appStateRef.current.models.find((m) => m.id === modelId);
          if (!model) return;

          void (async () => {
            const format = model.modelFormat ?? 'mmd';
            const fileName = model.modelFileName ?? '';
            const wantsPmxParse =
              format === 'mmd' &&
              /\.pm[xd]$/i.test(fileName) &&
              !/\.(glb|gltf|vrm|fbx|obj)$/i.test(fileName);

            let pmxBuffer: ArrayBuffer | null = null;
            if (wantsPmxParse) {
              pmxBuffer = pmxBufferCacheRef.current.get(modelId) ?? null;
              if (!pmxBuffer && model.fileMap && model.modelFileName) {
                const key = model.modelFileName.toLowerCase();
                const rawUrl = model.fileMap[key] ?? model.fileMap[model.modelFileName];
                const fetchUrl = rawUrl?.split('#')[0];
                if (fetchUrl?.startsWith('blob:')) {
                  pmxBuffer = await fetch(fetchUrl).then((r) => r.arrayBuffer());
                  if (pmxBuffer) pmxBufferCacheRef.current.set(modelId, pmxBuffer);
                }
              }
            }

            const cisReport = await runCisPipeline(mesh, {
              modelId,
              modelFileName: model.modelFileName,
              modelFormat: format,
              contentFingerprint: model.contentFingerprint,
              fileMap: model.fileMap,
              pmxBuffer,
              pmxByteSize: pmxBuffer?.byteLength,
              applyRepairs: true,
            });

            const profile = cisReport.profile;
            analysisTokenRef.current = `${modelId}:${mesh.uuid}`;

            setAppState((prev) => ({
              ...prev,
              models: prev.models.map((m) =>
                m.id === modelId
                  ? {
                      ...m,
                      cisReport,
                      modelAnalysis: profile?.modelAnalysis ?? m.modelAnalysis,
                      umceReport: profile?.umceReport ?? m.umceReport,
                      apisReport: profile?.apisReport ?? m.apisReport,
                    }
                  : m
              ),
            }));
          })().catch((err) => {
            console.warn('[CIS] Failed:', err);
          });
        }, 400);
      }
    },
    [setAppState, runModelAnalysis]
  );

  const handleSelectPmxBone = useCallback(
    (boneName: string) => {
      setAppState((prev) => ({ ...prev, selectedBoneId: boneName }));
    },
    [setAppState]
  );

  const handleApisReportUpdate = useCallback(
    (modelId: string, patch: Partial<ApisReport>) => {
      setAppState((prev) => ({
        ...prev,
        models: prev.models.map((m) => {
          if (m.id !== modelId) return m;
          const base = m.apisReport ?? {
            status: 'analyzing' as const,
            modelHash: patch.modelHash ?? '',
            profile: null,
            userSummary: {
              hair: 'Pending',
              cloth: 'Pending',
              accessories: 'Pending',
              simulation: 'Analyzing',
              performance: '—',
              optimized: false,
            },
          };
          const merged = { ...base, ...patch };
          return {
            ...m,
            apisReport: merged,
            cisReport: m.cisReport?.profile
              ? {
                  ...m.cisReport,
                  profile: { ...m.cisReport.profile, apisReport: merged },
                }
              : m.cisReport,
          };
        }),
      }));
    },
    [setAppState]
  );

  return {
    handleUndo,
    handleRedo,
    recordGlobalState,
    handleCopy,
    handlePaste,
    handleMirrorPaste,
    handleExportVmd,
    handleNewClip,
    handleSimplifyTrack,
    handleClearTrack,
    handleTimeStretch,
    handleMoveKeyframe,
    handlePatchKeyframe,
    handleDeleteAtPlayhead,
    handlePmxMetadata,
    handleApisReportUpdate,
    handleSelectPmxBone,
    runModelAnalysis,
    updateModelKeyframes,
    stepFrame: (d: number) => {
      const f = stepPlayhead(d, appState.maxFrames);
      handlers.setCurrentFrame(f);
    },
  };
}
