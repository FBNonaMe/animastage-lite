import { captureViewportSnapshot } from '../../utils/viewportSnapshot';
import type { ThumbnailCandidate } from './types';
import { scoreSceneVariation } from './sceneScorer';

export async function captureThumbnailCandidates(
  maxFrames: number,
  count: number,
  captureFrame: () => string | null,
  setFrame: (frame: number) => Promise<void>
): Promise<ThumbnailCandidate[]> {
  const frames: number[] = [];
  const step = Math.max(1, Math.floor(maxFrames / (count + 1)));
  for (let i = 1; i <= count; i++) {
    frames.push(Math.min(maxFrames - 1, i * step));
  }

  const results: ThumbnailCandidate[] = [];

  for (const frame of frames) {
    await setFrame(frame);
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const dataUrl = captureFrame();
    if (!dataUrl) continue;

    const faceVisibility = 0.5 + Math.random() * 0.5;
    const composition = 0.5 + Math.random() * 0.5;
    const { score } = scoreSceneVariation({
      faceVisibility,
      composition,
      lighting: 0.6 + Math.random() * 0.4,
      contrast: 0.55 + Math.random() * 0.45,
      noClipping: 0.7 + Math.random() * 0.3,
      framing: composition,
      performance: 0.8,
    });

    results.push({ frame, dataUrl, score });
  }

  return results.sort((a, b) => b.score - a.score);
}

export function captureSingleThumbnail(getCanvas: () => HTMLCanvasElement | null): string | null {
  return captureViewportSnapshot(getCanvas());
}
