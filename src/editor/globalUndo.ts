/** Global editor undo snapshots — scene FX, director, camera, and timeline keys. */
import type { AppState, MMDModel } from '../types';

export interface EditorUndoSnapshot {
  models: MMDModel[];
  sceneStudio: AppState['sceneStudio'];
  sceneDirector: AppState['sceneDirector'];
  cameraKeyframes: AppState['cameraKeyframes'];
  maxFrames: number;
}

/** Live-only fields — never stored in undo snapshots (functions, loaders, GPU assets). */
const MODEL_RUNTIME_KEYS = [
  'customManager',
  'fileMap',
  'blobUrl',
  'vmdBlobUrls',
  'vmdFileNames',
  'modelFileName',
  'hasVmdAnimation',
  'pmxBones',
  'pmxMorphs',
  'pmxMaterials',
  'modelAnalysis',
  'umceReport',
  'apisReport',
  'cisReport',
  'contentFingerprint',
] as const satisfies readonly (keyof MMDModel)[];

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureModelForUndo(model: MMDModel): MMDModel {
  const { customManager: _manager, ...editable } = model;
  void _manager;

  try {
    return structuredClone(editable) as MMDModel;
  } catch {
    return cloneJson(editable) as MMDModel;
  }
}

function mergeModelUndo(live: MMDModel, snap: MMDModel): MMDModel {
  const merged = { ...snap };
  for (const key of MODEL_RUNTIME_KEYS) {
    if (key in live) {
      (merged as MMDModel)[key] = live[key];
    }
  }
  return merged;
}

export function captureEditorSnapshot(appState: AppState): EditorUndoSnapshot {
  return {
    models: appState.models.map(captureModelForUndo),
    sceneStudio: appState.sceneStudio
      ? (cloneJson(appState.sceneStudio) as AppState['sceneStudio'])
      : undefined,
    sceneDirector: appState.sceneDirector
      ? (cloneJson(appState.sceneDirector) as AppState['sceneDirector'])
      : undefined,
    cameraKeyframes: cloneJson(appState.cameraKeyframes),
    maxFrames: appState.maxFrames,
  };
}

export function applyEditorSnapshot(
  prev: AppState,
  snapshot: EditorUndoSnapshot
): AppState {
  const liveById = new Map(prev.models.map((m) => [m.id, m]));

  return {
    ...prev,
    models: snapshot.models.map((snapModel) => {
      const live = liveById.get(snapModel.id);
      return live ? mergeModelUndo(live, snapModel) : snapModel;
    }),
    sceneStudio: snapshot.sceneStudio,
    sceneDirector: snapshot.sceneDirector,
    cameraKeyframes: snapshot.cameraKeyframes,
    maxFrames: snapshot.maxFrames,
  };
}
