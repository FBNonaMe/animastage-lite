import type { CompositionGuideId } from './types';

export type GuideLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'third' | 'safe' | 'center' | 'golden';
};

/** Normalized 0–1 guide lines for overlay SVG. */
export function compositionGuideLines(guide: CompositionGuideId): GuideLine[] {
  if (guide === 'none') return [];
  const lines: GuideLine[] = [];

  if (guide === 'thirds') {
    for (const v of [1 / 3, 2 / 3]) {
      lines.push({ x1: v, y1: 0, x2: v, y2: 1, kind: 'third' });
      lines.push({ x1: 0, y1: v, x2: 1, y2: v, kind: 'third' });
    }
  }
  if (guide === 'golden') {
    const g = 1 / 1.618;
    lines.push({ x1: g, y1: 0, x2: g, y2: 1, kind: 'golden' });
    lines.push({ x1: 1 - g, y1: 0, x2: 1 - g, y2: 1, kind: 'golden' });
    lines.push({ x1: 0, y1: g, x2: 1, y2: g, kind: 'golden' });
    lines.push({ x1: 0, y1: 1 - g, x2: 1, y2: 1 - g, kind: 'golden' });
  }
  if (guide === 'center') {
    lines.push({ x1: 0.5, y1: 0, x2: 0.5, y2: 1, kind: 'center' });
    lines.push({ x1: 0, y1: 0.5, x2: 1, y2: 0.5, kind: 'center' });
  }
  if (guide === 'safe' || guide === 'action_safe' || guide === 'title_safe') {
    const inset =
      guide === 'title_safe' ? 0.1 : guide === 'action_safe' ? 0.05 : 0.07;
    lines.push({ x1: inset, y1: inset, x2: 1 - inset, y2: inset, kind: 'safe' });
    lines.push({ x1: 1 - inset, y1: inset, x2: 1 - inset, y2: 1 - inset, kind: 'safe' });
    lines.push({ x1: 1 - inset, y1: 1 - inset, x2: inset, y2: 1 - inset, kind: 'safe' });
    lines.push({ x1: inset, y1: 1 - inset, x2: inset, y2: inset, kind: 'safe' });
  }
  if (guide === 'portrait' || guide === 'social') {
    lines.push({ x1: 0.12, y1: 0.1, x2: 0.88, y2: 0.1, kind: 'safe' });
    lines.push({ x1: 0.12, y1: 0.9, x2: 0.88, y2: 0.9, kind: 'safe' });
    lines.push({ x1: 0.5, y1: 0.18, x2: 0.5, y2: 0.78, kind: 'center' });
    if (guide === 'social') {
      lines.push({ x1: 1 / 3, y1: 0, x2: 1 / 3, y2: 1, kind: 'third' });
      lines.push({ x1: 2 / 3, y1: 0, x2: 2 / 3, y2: 1, kind: 'third' });
    }
  }
  return lines;
}
