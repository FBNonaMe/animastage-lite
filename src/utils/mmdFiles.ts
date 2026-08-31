import * as THREE from 'three';
import { MMDFlexibleTextureLoader } from './mmdTextureLoader';
import type { CharacterModelFormat, AssetModelKind } from '../types';
import { cacheVmdArrayBuffer } from './vmdBlobCache';
import './mmdCharsetPatch';

export type { CharacterModelFormat };

export interface ProcessedMMDFiles {
  name: string;
  blobUrl: string;
  modelFileName: string;
  modelFormat?: CharacterModelFormat;
  assetKind?: AssetModelKind;
  modelByteSize?: number;
  contentFingerprint?: string;
  manager: THREE.LoadingManager;
  fileMap: Record<string, string>;
  vmdBlobUrls: string[];
  vmdFileNames: string[];
  cameraVmdBlobUrl?: string | null;
  cameraVmdFileName?: string | null;
  hasCameraVmd?: boolean;
}

interface VmdMetadata {
  motionCount: number;
  morphCount: number;
  cameraCount: number;
}

async function parseVmdMetadata(file: File): Promise<VmdMetadata> {
  const buffer = await file.arrayBuffer();
  const mod = await import('mmd-parser');
  const ParserCtor =
    (mod as { Parser?: new () => { parseVmd: (buf: ArrayBuffer, raw: boolean) => { metadata: VmdMetadata } } })
      .Parser ??
    (mod as { default?: { Parser?: new () => { parseVmd: (buf: ArrayBuffer, raw: boolean) => { metadata: VmdMetadata } } } })
      .default?.Parser;

  if (!ParserCtor) {
    return { motionCount: 0, morphCount: 0, cameraCount: 0 };
  }

  const parser = new ParserCtor();
  const vmd = parser.parseVmd(buffer, true);
  const meta = vmd.metadata ?? { motionCount: 0, morphCount: 0, cameraCount: 0 };
  return {
    motionCount: meta.motionCount ?? 0,
    morphCount: meta.morphCount ?? 0,
    cameraCount: meta.cameraCount ?? 0,
  };
}

export async function classifyVmdFiles(vmdFiles: File[]): Promise<{
  motionVmds: File[];
  cameraVmd?: File;
}> {
  const motionVmds: File[] = [];
  const cameraOnlyCandidates: File[] = [];
  const cameraNamedCandidates: File[] = [];
  let combinedCameraVmd: File | undefined;
  let bestCombinedCameraCount = -1;

  for (const file of vmdFiles) {
    let meta: VmdMetadata;
    try {
      meta = await parseVmdMetadata(file);
    } catch (err) {
      console.warn('[MMD] Failed to parse VMD metadata:', file.name, err);
      meta = { motionCount: 0, morphCount: 0, cameraCount: 0 };
    }

    const isMotion = meta.motionCount > 0 || meta.morphCount > 0;
    const isCamera = meta.cameraCount > 0;
    const nameHintsCamera = /camera|cam|カメラ/i.test(file.name);

    if (isMotion) {
      motionVmds.push(file);
    }

    if (isCamera && !isMotion) {
      cameraOnlyCandidates.push(file);
    } else if (isCamera && isMotion) {
      if (meta.cameraCount > bestCombinedCameraCount) {
        bestCombinedCameraCount = meta.cameraCount;
        combinedCameraVmd = file;
      }
    }

    if (nameHintsCamera) {
      cameraNamedCandidates.push(file);
    }
  }

  if (cameraOnlyCandidates.length > 0) {
    return {
      motionVmds,
      cameraVmd: cameraOnlyCandidates[0],
    };
  }

  if (cameraNamedCandidates.length > 0) {
    const namedOnly = cameraNamedCandidates.find(
      (f) => !motionVmds.includes(f) || /camera|cam|カメラ/i.test(f.name)
    );
    if (namedOnly) {
      return { motionVmds, cameraVmd: namedOnly };
    }
  }

  // Do not hijack the viewport with embedded dance-camera data from motion VMDs.
  void combinedCameraVmd;

  // Any .vmd not already assigned is treated as character motion.
  const assigned = new Set<File>(motionVmds);
  for (const file of vmdFiles) {
    if (!assigned.has(file) && !/camera|cam|カメラ/i.test(file.name)) {
      motionVmds.push(file);
    }
  }

  return { motionVmds };
}

const BLOB_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True only for real object-URL blobs (uuid), not blob:http://host/Texture\\file.png */
export function isValidBlobUrl(url: string): boolean {
  if (!url.startsWith('blob:')) return false;

  const rest = url.slice(5);
  const originMatch = rest.match(/^https?:\/\/[^/]+\/(.+)$/i);
  if (originMatch) {
    const segment = originMatch[1].split('#')[0];
    return BLOB_UUID_RE.test(segment);
  }

  return BLOB_UUID_RE.test(rest.split('#')[0]);
}

/**
 * Turn PMX / loader URLs into a lookup key for fileMap.
 * Handles:
 *  - Texture\\file.png
 *  - blob:http://localhost:3000/Texture\\file.png  (malformed relative-to-blob)
 *  - blob:http://localhost:3000/uuid#model.pmx
 */
export function extractAssetLookupPath(url: string): string {
  let path = url.trim();

  if (path.startsWith('blob:')) {
    const withoutScheme = path.slice(5);

    const originMatch = withoutScheme.match(/^https?:\/\/[^/]+\/(.+)$/i);
    if (originMatch) {
      path = originMatch[1];
    } else {
      const slashIdx = withoutScheme.indexOf('/');
      path = slashIdx >= 0 ? withoutScheme.slice(slashIdx + 1) : withoutScheme;
    }
  }

  try {
    path = decodeURIComponent(path);
  } catch {
    // keep as-is
  }

  // Sketchfab / Blender absolute paths: C:\textures\foo.png → textures/foo.png
  path = path.replace(/^file:\/\/\/[a-zA-Z]:\/*/i, '');
  path = path.replace(/^[a-zA-Z]:[\\/]+/, '');
  path = path.replace(/^\/+/, '');

  const hashIdx = path.indexOf('#');
  if (hashIdx >= 0) {
    const beforeHash = path.slice(0, hashIdx);
    const afterHash = path.slice(hashIdx + 1);

    if (BLOB_UUID_RE.test(beforeHash)) {
      // blob origin uuid#filename — filename is not a texture path unless it contains slashes
      if (afterHash.includes('/') || afterHash.includes('\\')) {
        path = afterHash;
      } else {
        path = afterHash;
      }
    } else if (
      afterHash.includes('.') &&
      (afterHash.includes('/') || afterHash.includes('\\'))
    ) {
      path = afterHash;
    } else if (beforeHash) {
      path = beforeHash;
    }
  }

  // If still a bare uuid segment, nothing useful to lookup
  if (BLOB_UUID_RE.test(path)) {
    return '';
  }

  return path
    .replace(/\\/g, '/')
    .replace(/^\.+\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();
}

export function normalizeAssetPath(path: string): string {
  return extractAssetLookupPath(path).toLowerCase();
}

export function getFileRelativePath(file: File): string {
  return (
    (file as File & { _mmdRelativePath?: string })._mmdRelativePath ||
    file.webkitRelativePath ||
    file.name
  );
}

export async function getFilesAsync(dataTransfer: DataTransfer): Promise<File[]> {
  const files: File[] = [];

  if (dataTransfer.items) {
    const items = Array.from(dataTransfer.items).filter((i) => i.kind === 'file');
    const promises = items.map((item) => {
      return new Promise<void>((resolve) => {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          const traverse = (e: FileSystemEntry, pathPrefix = ''): Promise<void> => {
            return new Promise((res) => {
              if (e.isFile) {
                (e as FileSystemFileEntry).file((f: File) => {
                  const relPath = pathPrefix ? `${pathPrefix}${f.name}` : f.name;
                  Object.defineProperty(f, '_mmdRelativePath', { value: relPath, enumerable: false });
                  files.push(f);
                  res();
                });
              } else if (e.isDirectory) {
                const reader = (e as FileSystemDirectoryEntry).createReader();
                const dirPrefix = pathPrefix ? `${pathPrefix}${e.name}/` : `${e.name}/`;
                const readAll = () => {
                  reader.readEntries((entries: FileSystemEntry[]) => {
                    if (entries.length === 0) {
                      res();
                    } else {
                      Promise.all(entries.map((child) => traverse(child, dirPrefix))).then(readAll);
                    }
                  });
                };
                readAll();
              } else {
                res();
              }
            });
          };
          traverse(entry).then(resolve);
        } else {
          const f = item.getAsFile();
          if (f) files.push(f);
          resolve();
        }
      });
    });
    await Promise.all(promises);
  } else {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      files.push(dataTransfer.files[i]);
    }
  }

  return files;
}

/** All path spellings PMX / Windows / drag-drop may use when referencing the same file. */
export function pathVariants(raw: string): string[] {
  const normalized = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '').trim();
  const lower = normalized.toLowerCase();
  const backslash = normalized.replace(/\//g, '\\');
  const backslashLower = backslash.toLowerCase();

  const variants = new Set<string>([
    raw,
    raw.toLowerCase(),
    normalized,
    lower,
    backslash,
    backslashLower,
  ]);

  const parts = normalized.split('/').filter(Boolean);
  const basename = parts[parts.length - 1];
  if (basename) {
    variants.add(basename);
    variants.add(basename.toLowerCase());
  }

  for (let i = 0; i < parts.length; i++) {
    const suffixForward = parts.slice(i).join('/');
    const suffixBack = parts.slice(i).join('\\');
    variants.add(suffixForward);
    variants.add(suffixForward.toLowerCase());
    variants.add(suffixBack);
    variants.add(suffixBack.toLowerCase());
  }

  return [...variants].filter(Boolean);
}

const IMAGE_EXTENSIONS = ['.tga', '.bmp', '.png', '.jpg', '.jpeg', '.webp', '.dds'];

function tryExtensionAlternatives(
  lookupPath: string,
  index: Map<string, string>
): string | undefined {
  const normalized = normalizeAssetPath(lookupPath);
  const parts = normalized.split('/').filter(Boolean);
  const filename = parts.pop() || '';
  const dir = parts.length ? `${parts.join('/')}/` : '';

  const dot = filename.lastIndexOf('.');
  const stem = dot >= 0 ? filename.slice(0, dot) : filename;
  if (!stem) return undefined;

  for (const ext of IMAGE_EXTENSIONS) {
    const withDir = `${dir}${stem}${ext}`;
    const indexed = index.get(withDir);
    if (indexed) return indexed;

    const basename = `${stem}${ext}`;
    const byBase = index.get(basename);
    if (byBase) return byBase;
  }

  return undefined;
}

export function registerFileInMap(file: File, fileMap: Record<string, string>, blobUrl: string) {
  const relPath = getFileRelativePath(file);
  for (const variant of pathVariants(relPath)) {
    fileMap[variant] = blobUrl;
  }
  for (const variant of pathVariants(file.name)) {
    fileMap[variant] = blobUrl;
  }
}

/** Blob URLs for every file in a drop/folder (shared across multi-character import). */
export function buildFileMapFromFiles(files: File[]): Record<string, string> {
  const fileMap: Record<string, string> = {};
  for (const file of files) {
    registerFileInMap(file, fileMap, URL.createObjectURL(file));
  }
  return fileMap;
}

export function buildAssetIndex(fileMap: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>();

  const register = (key: string, blobUrl: string) => {
    for (const variant of pathVariants(key)) {
      index.set(variant.toLowerCase(), blobUrl);
      const base = variant.replace(/\\/g, '/').split('/').pop();
      if (base) index.set(base.toLowerCase(), blobUrl);
    }
  };

  for (const [key, blobUrl] of Object.entries(fileMap)) {
    register(key, blobUrl);
  }

  return index;
}

export function lookupInFileMap(
  lookupPath: string,
  fileMap: Record<string, string>,
  index: Map<string, string>
): string | undefined {
  if (!lookupPath) return undefined;

  for (const variant of pathVariants(lookupPath)) {
    const direct = fileMap[variant] ?? fileMap[variant.toLowerCase()];
    if (direct) return direct;

    const indexed = index.get(variant.toLowerCase());
    if (indexed) return indexed;
  }

  const normalized = normalizeAssetPath(lookupPath);
  if (normalized && index.has(normalized)) {
    return index.get(normalized);
  }

  const basename = normalized.split('/').pop() || '';
  if (basename && index.has(basename)) {
    return index.get(basename);
  }

  const altExtension = tryExtensionAlternatives(lookupPath, index);
  if (altExtension) {
    return altExtension;
  }

  for (const [key, val] of index.entries()) {
    if (
      normalized.endsWith('/' + key) ||
      key.endsWith('/' + normalized) ||
      normalized.endsWith(key) ||
      key.endsWith(normalized)
    ) {
      return val;
    }
  }

  return undefined;
}

/** Strip #filename suffix — FileLoader cannot fetch blob URLs with a fragment. */
export function normalizeBlobFetchUrl(url: string): string {
  if (!url.startsWith('blob:')) return url;
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return url;
  const base = url.slice(0, hashIdx);
  return isValidBlobUrl(base) ? base : url;
}

/**
 * Resolve PMX texture paths (incl. malformed blob:…/Texture\\file.png) to real blob URLs.
 * Never returns broken blob:http://host/relative paths.
 */
export function resolveAssetUrl(
  url: string,
  fileMap: Record<string, string>,
  index?: Map<string, string>
): string {
  if (!url) return url;
  if (url.startsWith('data:')) return url;
  if (isValidBlobUrl(url)) return normalizeBlobFetchUrl(url);

  const assetIndex = index ?? buildAssetIndex(fileMap);
  const lookupPath = extractAssetLookupPath(url);
  const resolved = lookupInFileMap(lookupPath, fileMap, assetIndex);

  if (resolved) {
    return normalizeBlobFetchUrl(resolved);
  }

  // Last resort: basename from raw url (handles Texture\file.png without blob prefix)
  const rawBasename = url.replace(/\\/g, '/').split('/').pop()?.split('#')[0]?.toLowerCase();
  if (rawBasename && assetIndex.has(rawBasename)) {
    return assetIndex.get(rawBasename)!;
  }

  console.warn('[MMD] Texture not found in dropped files:', lookupPath || url, '(original:', url, ')');
  return url.startsWith('blob:') ? '' : url;
}

export function createMMDLoadingManager(fileMap: Record<string, string>): THREE.LoadingManager {
  const index = buildAssetIndex(fileMap);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => resolveAssetUrl(url, fileMap, index));
  return manager;
}

export function createMMDTextureManager(fileMap: Record<string, string>): THREE.LoadingManager {
  return createAssetBundleLoadingManager(fileMap);
}

/** FBX / GLTF / OBJ bundles — resolves all sidecar textures from folder or ZIP. */
export function createAssetBundleLoadingManager(fileMap: Record<string, string>): THREE.LoadingManager {
  const manager = createMMDLoadingManager(fileMap);
  const textureLoader = new MMDFlexibleTextureLoader(manager);
  manager.addHandler(
    /\.(tga|bmp|png|jpe?g|webp|gif|dds|ktx2?|tif|tiff|exr|hdr)$/i,
    textureLoader
  );
  return manager;
}

function buildFileMap(files: File[]): {
  fileMap: Record<string, string>;
  modelFile: File | undefined;
  vmdFiles: File[];
} {
  const fileMap: Record<string, string> = {};
  let modelFile: File | undefined;
  const vmdFiles: File[] = [];

  for (const file of files) {
    const blobUrl = URL.createObjectURL(file);
    registerFileInMap(file, fileMap, blobUrl);

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pmd') || lowerName.endsWith('.pmx')) {
      if (!modelFile) modelFile = file;
    } else if (lowerName.endsWith('.vmd')) {
      vmdFiles.push(file);
    }
  }

  return { fileMap, modelFile, vmdFiles };
}

export interface ProcessedVmdFiles {
  fileMap: Record<string, string>;
  vmdBlobUrls: string[];
  vmdFileNames: string[];
  cameraVmdBlobUrl?: string | null;
  cameraVmdFileName?: string | null;
  hasCameraVmd?: boolean;
}

/** Merge motion-only import into an already-loaded character. */
export function mergeVmdIntoModel<T extends {
  fileMap?: Record<string, string>;
  customManager?: THREE.LoadingManager;
  vmdBlobUrls?: string[];
  vmdFileNames?: string[];
  hasVmdAnimation?: boolean;
  vmdPlaybackEnabled?: boolean;
  activeVmdIndex?: number;
  activeTemplateId?: string | null;
}>(model: T, vmd: ProcessedVmdFiles): T & {
  fileMap: Record<string, string>;
  customManager: THREE.LoadingManager;
  vmdBlobUrls: string[];
  vmdFileNames: string[];
  hasVmdAnimation: boolean;
  vmdPlaybackEnabled: boolean;
  activeVmdIndex: number;
  activeTemplateId: null;
} {
  const fileMap = { ...(model.fileMap ?? {}), ...vmd.fileMap };
  const nameToIndex = new Map((model.vmdFileNames ?? []).map((n, i) => [n, i]));
  const vmdBlobUrls = [...(model.vmdBlobUrls ?? [])];
  const vmdFileNames = [...(model.vmdFileNames ?? [])];

  for (let i = 0; i < vmd.vmdBlobUrls.length; i++) {
    const name = vmd.vmdFileNames[i]!;
    const url = vmd.vmdBlobUrls[i]!;
    const existingIdx = nameToIndex.get(name);
    if (existingIdx != null) {
      // Re-assign from library: refresh blob URL, keep slot.
      vmdBlobUrls[existingIdx] = url;
    } else {
      nameToIndex.set(name, vmdFileNames.length);
      vmdBlobUrls.push(url);
      vmdFileNames.push(name);
    }
  }

  const activeName = vmd.vmdFileNames[vmd.vmdFileNames.length - 1];
  const activeVmdIndex = Math.max(
    0,
    activeName != null ? (nameToIndex.get(activeName) ?? vmdBlobUrls.length - 1) : vmdBlobUrls.length - 1
  );

  return {
    ...model,
    fileMap,
    customManager: model.customManager ?? createMMDTextureManager(fileMap),
    vmdBlobUrls,
    vmdFileNames,
    hasVmdAnimation: vmdBlobUrls.length > 0,
    vmdPlaybackEnabled: true,
    activeVmdIndex,
    activeTemplateId: null,
  };
}

export async function processVmdFiles(
  files: File[]
): Promise<ProcessedVmdFiles | { error: string }> {
  const vmdFiles = files.filter((file) => file.name.toLowerCase().endsWith('.vmd'));
  if (vmdFiles.length === 0) {
    return { error: 'Please select at least one .vmd motion file.' };
  }

  const fileMap: Record<string, string> = {};
  for (const file of vmdFiles) {
    const blobUrl = URL.createObjectURL(file);
    registerFileInMap(file, fileMap, blobUrl);
    cacheVmdArrayBuffer(blobUrl, await file.arrayBuffer());
  }

  const { motionVmds, cameraVmd } = await classifyVmdFiles(vmdFiles);
  const motionSources =
    motionVmds.length > 0 ? motionVmds : vmdFiles.filter((file) => file !== cameraVmd);

  if (motionSources.length === 0 && !cameraVmd) {
    return { error: 'No usable motion data found in the selected .vmd file(s).' };
  }

  const vmdBlobUrls = motionSources.map(
    (file) => `${fileMap[file.name.toLowerCase()]}#${file.name}`
  );
  const vmdFileNames = motionSources.map((file) => file.name);

  const cameraVmdBlobUrl = cameraVmd
    ? `${fileMap[cameraVmd.name.toLowerCase()]}#${cameraVmd.name}`
    : null;

  return {
    fileMap,
    vmdBlobUrls,
    vmdFileNames,
    cameraVmdBlobUrl,
    cameraVmdFileName: cameraVmd?.name ?? null,
    hasCameraVmd: Boolean(cameraVmd),
  };
}

export async function processMMDFiles(
  files: File[]
): Promise<ProcessedMMDFiles | { error: string }> {
  if (files.length === 0) {
    return { error: 'No files provided.' };
  }

  const { fileMap, modelFile, vmdFiles } = buildFileMap(files);

  if (!modelFile) {
    return { error: 'Please drop at least one .pmd or .pmx model file.' };
  }

  const { motionVmds, cameraVmd } = await classifyVmdFiles(vmdFiles);

  const motionSources =
    motionVmds.length > 0 ? motionVmds : vmdFiles.filter((file) => file !== cameraVmd);

  if (motionSources.length === 0 && vmdFiles.length > 0) {
    motionSources.push(...vmdFiles.filter((file) => file !== cameraVmd));
  }

  const manager = createMMDTextureManager(fileMap);
  const modelBlobUrl = `${fileMap[modelFile.name.toLowerCase()]}#${modelFile.name}`;

  const vmdBlobUrls = motionSources.map((f) => `${fileMap[f.name.toLowerCase()]}#${f.name}`);
  const vmdFileNames = motionSources.map((f) => f.name);

  const cameraVmdBlobUrl = cameraVmd
    ? `${fileMap[cameraVmd.name.toLowerCase()]}#${cameraVmd.name}`
    : null;

  return {
    name: modelFile.name.replace(/\.[^/.]+$/, ''),
    blobUrl: modelBlobUrl,
    modelFileName: modelFile.name,
    modelByteSize: modelFile.size,
    contentFingerprint: `${modelFile.name.toLowerCase()}:${modelFile.size}`,
    manager,
    fileMap,
    vmdBlobUrls,
    vmdFileNames,
    cameraVmdBlobUrl,
    cameraVmdFileName: cameraVmd?.name ?? null,
    hasCameraVmd: Boolean(cameraVmd),
  };
}

/** Strip `#fragment` so revoke/retain match createObjectURL bases. */
export function blobUrlBase(url: string): string {
  return normalizeBlobFetchUrl(url);
}

/**
 * Blob bases still referenced by live models.
 * Multi-character / stage+character imports share one fileMap — deleting one
 * model must not revoke URLs the others still need.
 */
export function collectRetainedBlobBases(
  models: Array<{
    fileMap?: Record<string, string>;
    blobUrl?: string | null;
    vmdBlobUrls?: string[];
  }>
): Set<string> {
  const retain = new Set<string>();
  const add = (url?: string | null) => {
    if (!url?.startsWith('blob:')) return;
    const base = blobUrlBase(url);
    if (isValidBlobUrl(base)) retain.add(base);
  };

  for (const model of models) {
    add(model.blobUrl);
    for (const url of model.vmdBlobUrls ?? []) add(url);
    if (!model.fileMap) continue;
    for (const url of Object.values(model.fileMap)) add(url);
  }
  return retain;
}

export function revokeBlobUrl(url?: string | null, retainBases?: Set<string>): void {
  if (!url?.startsWith('blob:')) return;
  const base = blobUrlBase(url);
  if (!isValidBlobUrl(base)) return;
  if (retainBases?.has(base)) return;
  try {
    URL.revokeObjectURL(base);
  } catch {
    /* already revoked */
  }
}

/**
 * Revoke object URLs owned by a fileMap.
 * Pass `retainBases` from remaining models so shared maps stay alive.
 * HTTP demo URLs are ignored (never created via createObjectURL).
 */
export function revokeFileMapUrls(
  fileMap?: Record<string, string>,
  retainBases?: Set<string>
): void {
  if (!fileMap) return;
  const seen = new Set<string>();
  for (const url of Object.values(fileMap)) {
    const base = blobUrlBase(url);
    if (!isValidBlobUrl(base) || seen.has(base)) continue;
    seen.add(base);
    if (retainBases?.has(base)) continue;
    try {
      URL.revokeObjectURL(base);
    } catch {
      /* already revoked */
    }
  }
}
