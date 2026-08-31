import type { MorphState } from '../types';
import type { SmartExpressionId } from './types';

const EXPRESSION_POOL: SmartExpressionId[] = [
  'smile',
  'neutral',
  'cute',
  'happy',
  'serious',
  'idle',
];

export function pickSmartExpression(seed?: number): SmartExpressionId {
  const i =
    typeof seed === 'number'
      ? Math.abs(seed) % EXPRESSION_POOL.length
      : Math.floor(Math.random() * EXPRESSION_POOL.length);
  return EXPRESSION_POOL[i]!;
}

/** Map expression id → simple eyes/mouth/brow morph weights (0–1). */
export function expressionToMorphs(id: SmartExpressionId): MorphState {
  switch (id) {
    case 'smile':
      return { eyes: 0.05, mouth: 0.45, brow: 0.1 };
    case 'cute':
      return { eyes: 0.15, mouth: 0.35, brow: 0.25 };
    case 'happy':
      return { eyes: 0.2, mouth: 0.55, brow: 0.15 };
    case 'serious':
      return { eyes: 0, mouth: 0.05, brow: 0.4 };
    case 'idle':
      return { eyes: 0.08, mouth: 0.12, brow: 0.08 };
    case 'neutral':
    default:
      return { eyes: 0, mouth: 0.1, brow: 0.05 };
  }
}
