/**
 * Native AnimaStage normalized motion document (.md / .asmd.json).
 * Character-independent capture data for reuse across models.
 */
import type { TimelineKeyframe } from '../../types';
import type { WhamPipelineResult, WhamPoseSequence } from '../wham/types';
import type { MocapQualityReport } from '../pipeline/qualityReport';

export interface AsMdDocument {
  version: 1;
  kind: 'animastage.motion.md';
  name: string;
  fps: number;
  duration: number;
  engine: string;
  quality: string;
  source: string;
  tags: string[];
  author: string;
  thumbnail?: string;
  /** Character-independent pose sequence */
  sequence: WhamPoseSequence;
  keyframes: TimelineKeyframe[];
  jointConfidence: WhamPipelineResult['jointConfidence'];
  qualityReport?: MocapQualityReport | null;
  metadata?: Record<string, string | number | boolean>;
}

export function buildAsMdDocument(
  result: WhamPipelineResult,
  opts?: {
    name?: string;
    engine?: string;
    tags?: string[];
    author?: string;
    qualityReport?: MocapQualityReport | null;
  }
): AsMdDocument {
  return {
    version: 1,
    kind: 'animastage.motion.md',
    name: opts?.name ?? result.motionSpec.name ?? 'mocap_motion',
    fps: result.meta.sampleFps,
    duration: result.meta.duration,
    engine: opts?.engine ?? result.source,
    quality: result.quality,
    source: result.source,
    tags: opts?.tags ?? ['mocap', result.source],
    author: opts?.author ?? 'AnimaStage Lite',
    thumbnail: '🎬',
    sequence: result.sequence,
    keyframes: result.keyframes,
    jointConfidence: result.jointConfidence,
    qualityReport: opts?.qualityReport ?? null,
    metadata: {
      frameCount: result.meta.frameCount,
      keyCount: result.meta.keyCount,
      aspect: result.meta.aspect,
    },
  };
}

export function parseAsMdDocument(raw: unknown): AsMdDocument {
  const doc = raw as AsMdDocument;
  if (!doc || doc.kind !== 'animastage.motion.md' || doc.version !== 1) {
    throw new Error('Not a valid AnimaStage .md motion document');
  }
  if (!doc.sequence?.frames?.length) {
    throw new Error('.md document has no pose frames');
  }
  return doc;
}

export function downloadAsMd(doc: AsMdDocument, filename?: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ?? `${doc.name.replace(/\s+/g, '_')}.asmd.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Convert .md doc into animation-library-friendly keyframes + meta. */
export function asMdToLibraryPayload(doc: AsMdDocument): {
  name: string;
  keyframes: TimelineKeyframe[];
  durationSec: number;
  fps: number;
  tags: string[];
  author: string;
} {
  return {
    name: doc.name,
    keyframes: doc.keyframes,
    durationSec: doc.duration,
    fps: doc.fps,
    tags: [...new Set([...doc.tags, 'mocap', 'reusable'])],
    author: doc.author,
  };
}
