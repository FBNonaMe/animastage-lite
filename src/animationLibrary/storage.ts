import type {
  AnimationLibraryAsset,
  AnimationLibraryState,
  CharacterMotionOverride,
  RetargetMappingPreset,
} from './types';

const META_KEY = 'as_animation_library_v1';

/** Persist metadata only (blob URLs are session-scoped). */
export type AnimationLibraryPersist = Pick<
  AnimationLibraryState,
  'version' | 'mappingPresets' | 'selectedAssetId' | 'previewSpeed' | 'previewLoop'
> & {
  /** Metadata without live blob URLs. */
  assetsMeta: Array<
    Omit<AnimationLibraryAsset, 'vmdBlobUrls' | 'fileMap' | 'rawBlobUrl' | 'previewImageUrl'> & {
      hadVmd: boolean;
      hadRaw: boolean;
    }
  >;
  packs: AnimationLibraryState['packs'];
  assignments: CharacterMotionOverride[];
};

export function serializeLibraryForStorage(state: AnimationLibraryState): AnimationLibraryPersist {
  return {
    version: 1,
    mappingPresets: state.mappingPresets,
    selectedAssetId: state.selectedAssetId,
    previewSpeed: state.previewSpeed,
    previewLoop: state.previewLoop,
    packs: state.packs,
    assignments: state.assignments,
    assetsMeta: state.assets
      .filter((a) => a.format !== 'template')
      .map((a) => {
        const {
          vmdBlobUrls: _v,
          fileMap: _f,
          rawBlobUrl: _r,
          previewImageUrl: _p,
          ...meta
        } = a;
        return {
          ...meta,
          hadVmd: Boolean(a.vmdBlobUrls?.length),
          hadRaw: Boolean(a.rawBlobUrl),
        };
      }),
  };
}

export function saveLibraryMeta(state: AnimationLibraryState): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(serializeLibraryForStorage(state)));
  } catch {
    /* quota */
  }
}

export function loadLibraryMeta(): AnimationLibraryPersist | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnimationLibraryPersist;
  } catch {
    return null;
  }
}

export function mergePersistedMeta(
  base: AnimationLibraryState,
  persisted: AnimationLibraryPersist | null
): AnimationLibraryState {
  if (!persisted) return base;
  const ready = base.assets.filter((a) => a.format === 'template');
  const custom: AnimationLibraryAsset[] = persisted.assetsMeta.map((m) => {
    const { hadVmd: _h, hadRaw: _r, ...rest } = m;
    return {
      ...rest,
      vmdBlobUrls: undefined,
      fileMap: undefined,
      rawBlobUrl: null,
      previewImageUrl: null,
      compatibility: rest.compatibility === 'compatible' && !rest.templateId ? 'retarget' : rest.compatibility,
    };
  });
  return {
    ...base,
    assets: [...ready, ...custom],
    packs: persisted.packs ?? [],
    mappingPresets: persisted.mappingPresets ?? [],
    assignments: persisted.assignments ?? [],
    selectedAssetId: persisted.selectedAssetId,
    previewSpeed: persisted.previewSpeed ?? 1,
    previewLoop: persisted.previewLoop !== false,
  };
}

export function upsertMappingPreset(
  presets: RetargetMappingPreset[],
  preset: RetargetMappingPreset
): RetargetMappingPreset[] {
  const i = presets.findIndex((p) => p.id === preset.id);
  if (i >= 0) {
    const next = [...presets];
    next[i] = preset;
    return next;
  }
  return [...presets, preset];
}
