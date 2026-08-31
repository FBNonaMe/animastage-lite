import type { WebGLRenderer } from 'three';

/**
 * EffectComposer reads `getContextAttributes().alpha` on init — must be non-null.
 */
export function isWebGlContextReady(gl: WebGLRenderer): boolean {
  try {
    if (!gl.domElement?.isConnected) return false;
    const ctx = gl.getContext();
    if (!ctx) return false;
    if (typeof ctx.isContextLost === 'function' && ctx.isContextLost()) return false;
    const attrs = ctx.getContextAttributes();
    return attrs != null && typeof attrs.alpha === 'boolean';
  } catch {
    return false;
  }
}
