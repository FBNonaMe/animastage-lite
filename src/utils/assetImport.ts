import JSZip from 'jszip';
import { isStylePackBundle } from '../stylePacks/validate';
import {
  inferAssetKindFromName,
  sortByAssetKind,
} from './assetModelKind';
import {
  buildFileMapFromFiles,
  classifyVmdFiles,
  createAssetBundleLoadingManager,
  getFileRelativePath,
  processVmdFiles,
  type ProcessedMMDFiles,
  type ProcessedVmdFiles,
} from './mmdFiles';

export const ASSET_TEX_EXTS = new Set([
  'png',
  'jpg',
  'jpeg',
  'bmp',
  'tga',
  'webp',
  'gif',
  'ktx',
  'ktx2',
  'dds',
  'tif',
  'tiff',
  'exr',
  'spa',
  'sph',
]);

/** Character + map mesh formats (mmd_rtx ingest). */
export const ASSET_MODEL_EXTS = new Set(['pmx', 'pmd', 'fbx', 'glb', 'gltf', 'obj', 'vrm']);

/** MMD characters — load into MMDModelWrapper. */
export const MMD_CHARACTER_EXTS = new Set(['pmx', 'pmd']);

/** Generic 3D assets — FBX / GLB / GLTF / VRM / OBJ (+ sidecar textures). */
export const GENERIC_MODEL_EXTS = new Set(['fbx', 'glb', 'gltf', 'vrm', 'obj']);

/** @deprecated use GENERIC_MODEL_EXTS */
export const FBX_CHARACTER_EXTS = new Set(['fbx']);

export interface AssetBundleStats {
  total: number;
  models: number;
  mmdCharacters: number;
  genericModels: number;
  textures: number;
  mtls: number;
  vmds: number;
  hdrs: number;
}

export interface IngestedAssetBundle {
  all: File[];
  models: File[];
  mmdCharacters: File[];
  genericModels: File[];
  textures: File[];
  mtls: File[];
  hdrs: File[];
  vmds: File[];
  stats: AssetBundleStats;
}

export type ProcessedImportResult =
  | {
      kind: 'characters';
      models: ProcessedMMDFiles[];
      hdrFiles: File[];
      stats: AssetBundleStats;
      skippedFormats: string[];
    }
  | { kind: 'vmd_only'; vmd: ProcessedVmdFiles }
  | { kind: 'hdr_only'; hdrFiles: File[] }
  | { kind: 'style_pack' };

function fileRelPath(file: File): string {
  const rel = getFileRelativePath(file);
  return rel.replace(/\\/g, '/').toLowerCase();
}

/** Extension from relative path or filename — handles nested ZIP paths and .PMX casing. */
export function getAssetExtension(file: File): string {
  const paths = [fileRelPath(file), file.name.trim()].map((p) =>
    p.replace(/\\/g, '/').trim().toLowerCase()
  );
  for (const path of paths) {
    if (!path) continue;
    if (path.endsWith('.pmx')) return 'pmx';
    if (path.endsWith('.pmd')) return 'pmd';
    if (path.endsWith('.fbx')) return 'fbx';
    if (path.endsWith('.glb')) return 'glb';
    if (path.endsWith('.gltf')) return 'gltf';
    if (path.endsWith('.obj')) return 'obj';
    if (path.endsWith('.vrm')) return 'vrm';
    if (path.endsWith('.vmd')) return 'vmd';
    if (path.endsWith('.hdr')) return 'hdr';
    if (path.endsWith('.zip')) return 'zip';
    const base = path.split('/').pop() ?? path;
    const dot = base.lastIndexOf('.');
    if (dot > 0) return base.slice(dot + 1);
  }
  return '';
}

function isZipEntryJunk(relPath: string): boolean {
  const rel = relPath.replace(/\\/g, '/');
  const parts = rel.split('/').filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.some((p) => p === '__MACOSX' || p === '.DS_Store')) return true;
  if (parts.some((p) => p.startsWith('._'))) return true;
  return false;
}

async function looksLikeZipArchive(file: File): Promise<boolean> {
  if (/\.zip$/i.test(file.name) || /\.zip$/i.test(fileRelPath(file))) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4b;
  } catch {
    return false;
  }
}

function genericModelFormat(file: File): 'fbx' | 'gltf' | 'obj' {
  const ext = getAssetExtension(file);
  if (ext === 'fbx') return 'fbx';
  if (ext === 'obj') return 'obj';
  return 'gltf';
}

function modelSortKey(file: File): string {
  const depth = fileRelPath(file).split('/').length;
  return `${String(depth).padStart(4, '0')}:${file.name.toLowerCase()}`;
}

export async function extractZipToFiles(file: File): Promise<File[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(`Could not read "${file.name}" — file may be corrupted or not a ZIP archive.`);
  }

  const out: File[] = [];
  const tasks: Promise<void>[] = [];

  for (const [relPath, entry] of Object.entries(zip.files)) {
    if (entry.dir || isZipEntryJunk(relPath)) continue;
    tasks.push(
      entry.async('blob').then((blob) => {
        const rel = String(relPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!rel || isZipEntryJunk(rel)) return;
        const name = rel.split('/').filter(Boolean).pop() || rel;
        const zipFile = new File([blob], name, {
          type: blob.type || 'application/octet-stream',
        });
        Object.defineProperty(zipFile, '_mmdRelativePath', { value: rel, enumerable: false });
        out.push(zipFile);
      })
    );
  }

  await Promise.all(tasks);
  return out;
}

/** Expand top-level and nested .zip archives; leave other files as-is. */
async function expandAllArchives(
  files: File[],
  onProgress?: (message: string) => void
): Promise<File[]> {
  const all: File[] = [];
  const queue = [...files];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (await looksLikeZipArchive(file)) {
      onProgress?.(`Extracting ${file.name}…`);
      const extracted = await extractZipToFiles(file);
      if (extracted.length === 0) {
        throw new Error(
          `"${file.name}" is empty or contains no usable files. Ensure the archive includes a .pmx or .pmd model.`
        );
      }
      queue.push(...extracted);
      continue;
    }
    all.push(file);
  }

  return all;
}

/**
 * Classify dropped / folder / zip files (ported from mmd_rtx ingestAssetBundle).
 */
export async function ingestAssetBundle(
  files: File[],
  onProgress?: (message: string) => void
): Promise<IngestedAssetBundle> {
  const all = await expandAllArchives(files, onProgress);

  const models: File[] = [];
  const textures: File[] = [];
  const mtls: File[] = [];
  const hdrs: File[] = [];
  const vmds: File[] = [];

  for (const f of all) {
    const ext = getAssetExtension(f);
    if (ASSET_MODEL_EXTS.has(ext)) models.push(f);
    else if (ext === 'mtl') mtls.push(f);
    else if (ASSET_TEX_EXTS.has(ext)) textures.push(f);
    else if (ext === 'vmd') vmds.push(f);
    else if (ext === 'hdr') hdrs.push(f);
  }

  models.sort((a, b) => modelSortKey(a).localeCompare(modelSortKey(b)));

  const seenModel = new Set<string>();
  const uniqueModels = models.filter((f) => {
    const key = fileRelPath(f) || f.name.toLowerCase();
    if (seenModel.has(key)) return false;
    seenModel.add(key);
    return true;
  });

  const mmdCharacters = uniqueModels.filter((f) => MMD_CHARACTER_EXTS.has(getAssetExtension(f)));
  const genericModels = uniqueModels.filter((f) => GENERIC_MODEL_EXTS.has(getAssetExtension(f)));

  return {
    all,
    models: uniqueModels,
    mmdCharacters,
    genericModels,
    textures,
    mtls,
    hdrs,
    vmds,
    stats: {
      total: all.length,
      models: uniqueModels.length,
      mmdCharacters: mmdCharacters.length,
      genericModels: genericModels.length,
      textures: textures.length,
      mtls: mtls.length,
      vmds: vmds.length,
      hdrs: hdrs.length,
    },
  };
}


function vmdUrlsForFiles(
  motionFiles: File[],
  fileMap: Record<string, string>
): { vmdBlobUrls: string[]; vmdFileNames: string[] } {
  return {
    vmdBlobUrls: motionFiles.map((f) => `${fileMap[f.name.toLowerCase()]}#${f.name}`),
    vmdFileNames: motionFiles.map((f) => f.name),
  };
}

function distributeMotionVmds(
  modelCount: number,
  motionFiles: File[],
  fileMap: Record<string, string>
): { vmdBlobUrls: string[]; vmdFileNames: string[] }[] {
  const slots = Array.from({ length: modelCount }, () => ({
    vmdBlobUrls: [] as string[],
    vmdFileNames: [] as string[],
  }));
  if (modelCount === 0) return slots;
  if (modelCount === 1) {
    const one = vmdUrlsForFiles(motionFiles, fileMap);
    slots[0] = one;
    return slots;
  }
  // One shared dance for the whole cast — assign to every character.
  if (motionFiles.length === 1) {
    const shared = vmdUrlsForFiles(motionFiles, fileMap);
    for (let i = 0; i < modelCount; i++) slots[i] = { ...shared };
    return slots;
  }
  motionFiles.forEach((file, i) => {
    const slot = i % modelCount;
    slots[slot].vmdBlobUrls.push(`${fileMap[file.name.toLowerCase()]}#${file.name}`);
    slots[slot].vmdFileNames.push(file.name);
  });
  return slots;
}

/**
 * Full import: zip extract, format split, multi-PMX, shared textures/VMDs.
 */
export async function processImportedAssets(
  files: File[],
  onProgress?: (message: string) => void
): Promise<ProcessedImportResult | { error: string }> {
  if (files.length === 0) {
    return { error: 'No files provided.' };
  }

  const bundle = await ingestAssetBundle(files, onProgress);
  const { mmdCharacters, genericModels, models, hdrs, vmds, all, stats } = bundle;
  const characterCount = mmdCharacters.length + genericModels.length;

  if (isStylePackBundle(all)) {
    return { kind: 'style_pack' };
  }

  if (characterCount === 0 && vmds.length === 0 && hdrs.length === 0) {
    const nonCharacter = models.filter(
      (f) =>
        !MMD_CHARACTER_EXTS.has(getAssetExtension(f)) &&
        !GENERIC_MODEL_EXTS.has(getAssetExtension(f))
    );
    if (nonCharacter.length > 0) {
      return {
        error:
          'Found unsupported mesh format. Use .pmx/.pmd/.fbx/.glb/.gltf/.vrm/.obj with textures in the same folder/ZIP.',
      };
    }
    const extHint = [...new Set(all.map(getAssetExtension).filter(Boolean))].slice(0, 10);
    const hint =
      extHint.length > 0
        ? ` Found ${stats.total} file(s) — types: ${extHint.join(', ')}.`
        : stats.total > 0
          ? ` Found ${stats.total} file(s) but none are .pmx/.pmd/.fbx/.glb/.gltf/.vrm/.obj.`
          : '';
    return {
      error: `Please drop at least one model file (.pmd, .pmx, .fbx, .glb, .gltf, .vrm, or .obj) with textures.${hint}`,
    };
  }

  if (characterCount === 0 && vmds.length > 0) {
    const vmd = await processVmdFiles(vmds);
    if ('error' in vmd) return vmd;
    return { kind: 'vmd_only', vmd };
  }

  if (characterCount === 0 && hdrs.length > 0) {
    return { kind: 'hdr_only', hdrFiles: hdrs };
  }

  const fileMap = buildFileMapFromFiles(all);
  const { motionVmds, cameraVmd } = await classifyVmdFiles(vmds);
  const motionSources =
    motionVmds.length > 0 ? motionVmds : vmds.filter((file) => file !== cameraVmd);

  const manager = createAssetBundleLoadingManager(fileMap);
  const vmdPerMmd = distributeMotionVmds(mmdCharacters.length, motionSources, fileMap);

  const cameraVmdBlobUrl = cameraVmd
    ? `${fileMap[cameraVmd.name.toLowerCase()]}#${cameraVmd.name}`
    : null;

  const processedMmd: ProcessedMMDFiles[] = mmdCharacters.map((modelFile, index) => {
    const { vmdBlobUrls, vmdFileNames } = vmdPerMmd[index] ?? {
      vmdBlobUrls: [],
      vmdFileNames: [],
    };
    const attachCamera = index === 0;
    return {
      name: modelFile.name.replace(/\.[^/.]+$/, ''),
      blobUrl: `${fileMap[modelFile.name.toLowerCase()]}#${modelFile.name}`,
      modelFileName: modelFile.name,
      modelFormat: 'mmd' as const,
      manager,
      fileMap,
      vmdBlobUrls,
      vmdFileNames,
      cameraVmdBlobUrl: attachCamera ? cameraVmdBlobUrl : null,
      cameraVmdFileName: attachCamera ? (cameraVmd?.name ?? null) : null,
      hasCameraVmd: attachCamera && Boolean(cameraVmd),
    };
  });

  const processedGeneric: ProcessedMMDFiles[] = genericModels.map((modelFile) => ({
    name: modelFile.name.replace(/\.[^/.]+$/, ''),
    blobUrl: `${fileMap[modelFile.name.toLowerCase()]}#${modelFile.name}`,
    modelFileName: modelFile.name,
    modelByteSize: modelFile.size,
    contentFingerprint: `${modelFile.name.toLowerCase()}:${modelFile.size}`,
    modelFormat: genericModelFormat(modelFile),
    assetKind: inferAssetKindFromName(modelFile.name),
    manager,
    fileMap,
    vmdBlobUrls: [],
    vmdFileNames: [],
    cameraVmdBlobUrl: null,
    cameraVmdFileName: null,
    hasCameraVmd: false,
  }));

  const processed = sortByAssetKind([...processedMmd, ...processedGeneric]);

  if (genericModels.length > 0 && motionSources.length > 0 && mmdCharacters.length === 0) {
    console.warn(
      '[Import] .vmd motions apply to MMD (.pmx/.pmd) models only — FBX/GLTF use embedded animations.'
    );
  }

  if (stats.textures > 0 && genericModels.length > 0) {
    console.info(
      `[Import] Bundle: ${genericModels.length} model(s), ${stats.textures} texture(s), ${stats.mtls} MTL — sidecar files linked via folder map.`
    );
  }

  const skippedFormats = models
    .filter(
      (f) =>
        !MMD_CHARACTER_EXTS.has(getAssetExtension(f)) &&
        !GENERIC_MODEL_EXTS.has(getAssetExtension(f))
    )
    .map((f) => f.name);

  return {
    kind: 'characters',
    models: processed,
    hdrFiles: hdrs,
    stats,
    skippedFormats,
  };
}
