/**
 * Video ingest for WHAM — format + aspect validation.
 */
import { WHAM_VIDEO_EXTENSIONS } from './types';

export function isWhamVideoFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const extOk = WHAM_VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (extOk) return true;
  if (file.type.startsWith('video/')) return true;
  return false;
}

export function resolveVideoAspect(
  width: number,
  height: number
): '9:16' | '16:9' | '1:1' | 'other' {
  if (width <= 0 || height <= 0) return 'other';
  const r = width / height;
  if (Math.abs(r - 1) < 0.08) return '1:1';
  if (r < 0.7) return '9:16';
  if (r > 1.4) return '16:9';
  return 'other';
}

export async function loadVideoElement(file: File): Promise<{
  video: HTMLVideoElement;
  url: string;
  duration: number;
  width: number;
  height: number;
}> {
  if (!isWhamVideoFile(file)) {
    throw new Error('Unsupported video. Use MP4, MOV, AVI, MKV, or WEBM.');
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Could not open video'));
  });

  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0.05) {
    URL.revokeObjectURL(url);
    throw new Error('Video duration is too short');
  }

  return {
    video,
    url,
    duration,
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
  };
}

export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const t = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.001));
  if (Math.abs(video.currentTime - t) < 0.001) return;
  video.currentTime = t;
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video seek failed'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
  });
}
