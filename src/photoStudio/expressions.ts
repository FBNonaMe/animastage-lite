/**
 * Photo Studio expression library — maps to eyes/mouth/brow morph weights.
 */
import type { PhotoExpressionDef, PhotoExpressionId } from './types';

export const PHOTO_EXPRESSIONS: PhotoExpressionDef[] = [
  { id: 'smile', label: 'Smile', morphs: { eyes: 0.05, mouth: 0.45, brow: 0.08 } },
  { id: 'cute_smile', label: 'Cute Smile', morphs: { eyes: 0.18, mouth: 0.38, brow: 0.22 } },
  { id: 'open_mouth', label: 'Open Mouth', morphs: { eyes: 0.1, mouth: 0.72, brow: 0.12 } },
  { id: 'laugh', label: 'Laugh', morphs: { eyes: 0.35, mouth: 0.7, brow: 0.15 } },
  { id: 'cry', label: 'Cry', morphs: { eyes: 0.55, mouth: 0.25, brow: 0.55 } },
  { id: 'surprised', label: 'Surprised', morphs: { eyes: 0.02, mouth: 0.65, brow: 0.45 } },
  { id: 'embarrassed', label: 'Embarrassed', morphs: { eyes: 0.28, mouth: 0.22, brow: 0.4 } },
  { id: 'sleepy', label: 'Sleepy', morphs: { eyes: 0.72, mouth: 0.12, brow: 0.18 } },
  { id: 'angry', label: 'Angry', morphs: { eyes: 0.08, mouth: 0.15, brow: 0.7 } },
  { id: 'determined', label: 'Determined', morphs: { eyes: 0.02, mouth: 0.18, brow: 0.48 } },
  { id: 'sad', label: 'Sad', morphs: { eyes: 0.4, mouth: 0.08, brow: 0.5 } },
  { id: 'thinking', label: 'Thinking', morphs: { eyes: 0.22, mouth: 0.06, brow: 0.38 } },
  { id: 'blink', label: 'Blink', morphs: { eyes: 1, mouth: 0.1, brow: 0.05 } },
  { id: 'wink', label: 'Wink', morphs: { eyes: 0.55, mouth: 0.4, brow: 0.15 } },
  { id: 'confident', label: 'Confident', morphs: { eyes: 0.04, mouth: 0.32, brow: 0.2 } },
];

export function getPhotoExpression(id: PhotoExpressionId): PhotoExpressionDef | undefined {
  return PHOTO_EXPRESSIONS.find((e) => e.id === id);
}
