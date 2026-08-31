import type { UmceModelContext } from '../umce/types';

export function computeApisModelHash(
  ctx: UmceModelContext,
  modelFileName?: string,
  contentFingerprint?: string,
  pmxByteSize?: number
): string {
  if (contentFingerprint?.trim()) {
    return contentFingerprint.trim().toLowerCase();
  }
  const name = (modelFileName ?? 'model').toLowerCase();
  const size = pmxByteSize ?? ctx.vertexCount ?? 0;
  const bones = ctx.bones.length;
  const bodies = ctx.rigidBodies.length;
  const constraints = ctx.constraints.length;
  return `${name}:${size}:${bones}:${bodies}:${constraints}`;
}
