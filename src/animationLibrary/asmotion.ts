import type { AsMotionDocument, AnimationLibraryAsset } from './types';
import type { TimelineKeyframe } from '../types';

export function createAsMotionDocument(
  asset: AnimationLibraryAsset,
  extras?: {
    boneKeys?: TimelineKeyframe[];
    morphKeys?: TimelineKeyframe[];
    cameraKeys?: TimelineKeyframe[];
    mapping?: AsMotionDocument['mapping'];
    previewImageDataUrl?: string | null;
  }
): AsMotionDocument {
  return {
    version: 1,
    kind: 'animastage.motion',
    name: asset.name,
    fps: asset.fps || 30,
    durationSec: asset.durationSec,
    loop: asset.loop,
    skeletonType: asset.skeletonType,
    tags: asset.tags,
    author: asset.author,
    thumbnail: asset.thumbnail,
    previewImageDataUrl: extras?.previewImageDataUrl ?? null,
    boneKeys: extras?.boneKeys ?? asset.keyframes ?? [],
    morphKeys: extras?.morphKeys ?? [],
    cameraKeys: extras?.cameraKeys ?? [],
    mapping: extras?.mapping,
    metadata: {
      format: asset.format,
      source: asset.sourceFileNames?.join(',') ?? '',
    },
  };
}

export function parseAsMotionJson(text: string): AsMotionDocument {
  const doc = JSON.parse(text) as AsMotionDocument;
  if (doc.kind !== 'animastage.motion' || doc.version !== 1) {
    throw new Error('Not a valid AnimaStage .asmotion file');
  }
  return doc;
}

export function asMotionToAsset(doc: AsMotionDocument): AnimationLibraryAsset {
  const now = Date.now();
  return {
    id: `asm_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name: doc.name,
    format: 'asmotion',
    durationSec: doc.durationSec,
    fps: doc.fps,
    skeletonType: doc.skeletonType,
    loop: doc.loop,
    tags: doc.tags?.length ? doc.tags : ['asmotion'],
    author: doc.author || 'User',
    compatibility: 'compatible',
    thumbnail: doc.thumbnail || '💾',
    previewImageUrl: doc.previewImageDataUrl ?? null,
    createdAt: now,
    updatedAt: now,
    keyframes: doc.boneKeys ?? [],
    sourceFileNames: [`${doc.name}.asmotion`],
  };
}

export function downloadAsMotion(doc: AsMotionDocument, filename?: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${doc.name.replace(/\s+/g, '_')}.asmotion.json`;
  a.click();
  URL.revokeObjectURL(url);
}
