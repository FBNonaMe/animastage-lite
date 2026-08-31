import type { ViewportFormat } from '../types';

/** Portrait preview frame — half of 1080×1920 for sharper Shorts capture. */
export const VIEWPORT_916_WIDTH = 540;
export const VIEWPORT_916_HEIGHT = 960;

/** Export / record target (Full HD vertical). */
export const SHORTS_EXPORT_WIDTH = 1080;
export const SHORTS_EXPORT_HEIGHT = 1920;

export const VIEWPORT_FORMAT_OPTIONS: { id: ViewportFormat; label: string }[] = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '21:9', label: '21:9' },
];

export function viewportAspect(format: ViewportFormat): number {
  switch (format) {
    case '9:16':
      return 9 / 16;
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '21:9':
      return 21 / 9;
    case '16:9':
    default:
      return 16 / 9;
  }
}

/** CSS aspect-ratio string for framed preview shells. */
export function viewportAspectCss(format: ViewportFormat): string {
  switch (format) {
    case '9:16':
      return '9 / 16';
    case '1:1':
      return '1 / 1';
    case '4:5':
      return '4 / 5';
    case '21:9':
      return '21 / 9';
    case '16:9':
    default:
      return '16 / 9';
  }
}

/** Whether the format should use a centered framed preview (not full-bleed). */
export function isFramedViewportFormat(format: ViewportFormat): boolean {
  return format !== '16:9';
}
