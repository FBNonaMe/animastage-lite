import JSZip from 'jszip';
import { processVmdFiles, type ProcessedVmdFiles } from '../utils/mmdFiles';
import { asMotionToAsset, parseAsMotionJson } from './asmotion';
import type {
  AnimationFormatId,
  AnimationLibraryAsset,
  AnimationPack,
  SkeletonTypeId,
} from './types';

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function formatFromExt(ext: string): AnimationFormatId | null {
  if (ext === 'vmd') return 'vmd';
  if (ext === 'bvh') return 'bvh';
  if (ext === 'fbx') return 'fbx';
  if (ext === 'glb' || ext === 'gltf') return 'gltf';
  if (ext === 'json' || ext === 'asmotion') return 'json';
  return null;
}

function skeletonGuess(format: AnimationFormatId): SkeletonTypeId {
  switch (format) {
    case 'vmd':
      return 'mmd';
    case 'bvh':
      return 'humanoid';
    case 'fbx':
      return 'mixamo';
    case 'gltf':
      return 'gltf';
    case 'template':
      return 'universal';
    default:
      return 'universal';
  }
}

function thumbFor(format: AnimationFormatId): string {
  switch (format) {
    case 'vmd':
      return '💃';
    case 'bvh':
      return '🦴';
    case 'fbx':
      return '📦';
    case 'gltf':
      return '🌐';
    case 'asmotion':
      return '💾';
    case 'json':
      return '📄';
    case 'pack':
      return '📚';
    default:
      return '🎬';
  }
}

export async function importVmdToAsset(files: File[]): Promise<AnimationLibraryAsset> {
  const processed = await processVmdFiles(files);
  if ('error' in processed) throw new Error(processed.error);
  return vmdProcessedToAsset(processed, files.map((f) => f.name));
}

export function vmdProcessedToAsset(
  processed: ProcessedVmdFiles,
  names: string[]
): AnimationLibraryAsset {
  const now = Date.now();
  const name = names[0]?.replace(/\.vmd$/i, '') || 'Custom VMD';
  return {
    id: uid('vmd'),
    name,
    format: 'vmd',
    durationSec: 0,
    fps: 30,
    skeletonType: 'mmd',
    loop: true,
    tags: ['custom', 'vmd'],
    author: 'User',
    compatibility: 'compatible',
    thumbnail: thumbFor('vmd'),
    createdAt: now,
    updatedAt: now,
    vmdBlobUrls: processed.vmdBlobUrls,
    vmdFileNames: processed.vmdFileNames,
    fileMap: processed.fileMap,
    cameraVmdBlobUrl: processed.cameraVmdBlobUrl,
    cameraVmdFileName: processed.cameraVmdFileName,
    hasCameraVmd: processed.hasCameraVmd,
    sourceFileNames: names,
  };
}

export async function importGenericMotionFile(file: File): Promise<AnimationLibraryAsset> {
  const ext = extOf(file.name);
  if (ext === 'vmd') return importVmdToAsset([file]);

  if (ext === 'json' || ext === 'asmotion' || file.name.toLowerCase().endsWith('.asmotion.json')) {
    const text = await file.text();
    try {
      const doc = parseAsMotionJson(text);
      return asMotionToAsset(doc);
    } catch {
      const parsed = JSON.parse(text) as { keyframes?: unknown[]; name?: string };
      if (Array.isArray(parsed.keyframes)) {
        const now = Date.now();
        return {
          id: uid('json'),
          name: parsed.name || file.name.replace(/\.json$/i, ''),
          format: 'json',
          durationSec: 0,
          fps: 30,
          skeletonType: 'universal',
          loop: true,
          tags: ['custom', 'json'],
          author: 'User',
          compatibility: 'compatible',
          thumbnail: thumbFor('json'),
          createdAt: now,
          updatedAt: now,
          keyframes: parsed.keyframes as AnimationLibraryAsset['keyframes'],
          sourceFileNames: [file.name],
        };
      }
      throw new Error('JSON is not a motion or .asmotion document');
    }
  }

  const format = formatFromExt(ext);
  if (!format) throw new Error(`Unsupported animation format: .${ext}`);

  const blobUrl = URL.createObjectURL(file);
  const now = Date.now();
  return {
    id: uid(format),
    name: file.name.replace(/\.[^.]+$/, ''),
    format,
    durationSec: 0,
    fps: 30,
    skeletonType: skeletonGuess(format),
    loop: true,
    tags: ['custom', format],
    author: 'User',
    compatibility: format === 'bvh' || format === 'fbx' || format === 'gltf' ? 'retarget' : 'compatible',
    thumbnail: thumbFor(format),
    createdAt: now,
    updatedAt: now,
    rawBlobUrl: blobUrl,
    sourceFileNames: [file.name],
  };
}

export interface PackImportResult {
  pack: AnimationPack;
  assets: AnimationLibraryAsset[];
}

export async function importAnimationZipPack(file: File): Promise<PackImportResult> {
  const zip = await JSZip.loadAsync(file);
  const motionFiles: File[] = [];
  let previewImageUrl: string | null = null;
  let meta: { name?: string; author?: string; tags?: string[] } = {};

  const entries = Object.keys(zip.files);
  for (const path of entries) {
    const entry = zip.files[path];
    if (!entry || entry.dir) continue;
    const base = path.split('/').pop() || path;
    const lower = base.toLowerCase();
    if (lower === 'metadata.json' || lower === 'pack.json') {
      try {
        meta = JSON.parse(await entry.async('string'));
      } catch {
        /* ignore */
      }
      continue;
    }
    if (/\.(png|jpg|jpeg|webp)$/i.test(lower) && /preview|thumb/i.test(lower)) {
      const blob = await entry.async('blob');
      previewImageUrl = URL.createObjectURL(blob);
      continue;
    }
    if (/\.(vmd|bvh|fbx|glb|gltf|json|asmotion)$/i.test(lower)) {
      const blob = await entry.async('blob');
      motionFiles.push(new File([blob], base, { type: blob.type || 'application/octet-stream' }));
    }
  }

  if (motionFiles.length === 0) {
    throw new Error('ZIP pack has no motion files (.vmd / .bvh / .fbx / .gltf / .json)');
  }

  const packId = uid('pack');
  const assets: AnimationLibraryAsset[] = [];
  for (const mf of motionFiles) {
    try {
      const asset = await importGenericMotionFile(mf);
      assets.push({
        ...asset,
        packId,
        tags: [...new Set([...asset.tags, ...(meta.tags ?? []), 'pack'])],
        author: meta.author || asset.author,
        previewImageUrl: asset.previewImageUrl ?? previewImageUrl,
      });
    } catch (err) {
      console.warn('[AnimationLibrary] skip pack file', mf.name, err);
    }
  }

  if (assets.length === 0) throw new Error('No usable motions inside ZIP pack');

  const pack: AnimationPack = {
    id: packId,
    name: meta.name || file.name.replace(/\.zip$/i, ''),
    author: meta.author || 'User',
    tags: meta.tags ?? ['pack'],
    previewImageUrl,
    assetIds: assets.map((a) => a.id),
    createdAt: Date.now(),
  };

  return { pack, assets };
}

export async function importAnimationFiles(files: File[]): Promise<{
  assets: AnimationLibraryAsset[];
  packs: AnimationPack[];
}> {
  const assets: AnimationLibraryAsset[] = [];
  const packs: AnimationPack[] = [];
  const vmds = files.filter((f) => f.name.toLowerCase().endsWith('.vmd'));
  const zips = files.filter((f) => f.name.toLowerCase().endsWith('.zip'));
  const others = files.filter(
    (f) => !f.name.toLowerCase().endsWith('.vmd') && !f.name.toLowerCase().endsWith('.zip')
  );

  if (vmds.length) {
    assets.push(await importVmdToAsset(vmds));
  }
  for (const z of zips) {
    const result = await importAnimationZipPack(z);
    packs.push(result.pack);
    assets.push(...result.assets);
  }
  for (const o of others) {
    assets.push(await importGenericMotionFile(o));
  }
  return { assets, packs };
}
