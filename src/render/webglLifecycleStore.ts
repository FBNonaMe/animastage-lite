import type { EffectComposer } from 'postprocessing';
import * as THREE from 'three';
import type { AppState } from '../types';
import { disposeComposerRenderTargets } from '../postfx/mmdPostProcessing';
import { beginGpuRecoveryLoadGate } from './gpuRecoveryLoadGate';
import {
  initGraphicsSystem,
  isWebGlRecoveryInFlight,
  markWebGlContextLost,
} from './graphicsSystemStore';

export type WebGlRecoverHandler = () => void;

let registeredComposer: EffectComposer | null = null;
let registeredRenderer: THREE.WebGLRenderer | null = null;
let recoverHandler: WebGlRecoverHandler | null = null;
let contextLostListener: (() => void) | null = null;

const guardedCanvases = new WeakSet<HTMLCanvasElement>();

export function registerWebGlComposer(composer: EffectComposer | null): void {
  registeredComposer = composer;
}

export function registerWebGlRenderer(renderer: THREE.WebGLRenderer | null): void {
  registeredRenderer = renderer;
}

export function setWebGlRecoverHandler(handler: WebGlRecoverHandler | null): void {
  recoverHandler = handler;
}

export function setWebGlContextLostListener(listener: (() => void) | null): void {
  contextLostListener = listener;
}

export {
  isWebGlRecoveryInFlight,
  isWebGlContextLostActive,
  clearWebGlRecoveryState,
} from './graphicsSystemStore';

export function disposePostFxComposer(composer: EffectComposer | null = registeredComposer): void {
  if (!composer) return;
  disposeComposerRenderTargets(composer);
  try {
    composer.dispose();
  } catch {
    /* already disposed or context lost */
  }
  if (composer === registeredComposer) {
    registeredComposer = null;
  }
}

export function tearDownWebGlPipeline(renderer: THREE.WebGLRenderer | null = registeredRenderer): void {
  disposePostFxComposer(registeredComposer);

  if (!renderer) return;

  try {
    renderer.renderLists?.dispose?.();
  } catch {
    /* optional */
  }

  try {
    const bindingState = (
      renderer as THREE.WebGLRenderer & { bindingState?: { dispose?: () => void } }
    ).bindingState;
    bindingState?.dispose?.();
  } catch {
    /* best-effort */
  }

  try {
    renderer.dispose();
  } catch {
    /* context already lost */
  }

  if (renderer === registeredRenderer) {
    registeredRenderer = null;
  }
}

/** Context-loss recovery preserves user quality — only GPU pipeline is restarted. */
export function getContextLostRecoveryAppPatch(_state: AppState): Partial<AppState> {
  return {};
}

/**
 * Hardware recovery: dispose GPU objects, suspend canvas, reinit after 500ms.
 * User settings (HD/4K, Post-FX) are kept intact for discrete GPU.
 */
export function handleWebGlContextLost(event: Event, renderer: THREE.WebGLRenderer): void {
  event.preventDefault();
  if (isWebGlRecoveryInFlight()) return;

  console.warn(
    '[WebGL] Context lost — suspending renderer, freeing GPU memory, reinitializing in 1s…'
  );

  // Mark lost BEFORE dispose so PostFX subscribers unmount EffectComposer
  // before postprocessing reads getContextAttributes().alpha on a dead context.
  markWebGlContextLost();
  beginGpuRecoveryLoadGate();
  contextLostListener?.();
  // Suspend React canvas immediately (notify) before tearing down GL objects.
  initGraphicsSystem();
  renderer.setAnimationLoop(null);
  tearDownWebGlPipeline(renderer);

  recoverHandler?.();
}

/** Attach context guard on canvas — idempotent per canvas element. */
export function attachWebGlCanvasGuard(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer
): void {
  if (guardedCanvases.has(canvas)) return;
  guardedCanvases.add(canvas);
  registerWebGlRenderer(renderer);

  canvas.addEventListener(
    'webglcontextlost',
    (event) => handleWebGlContextLost(event, renderer),
    false
  );
}

export function detachWebGlCanvasGuard(canvas: HTMLCanvasElement): void {
  guardedCanvases.delete(canvas);
}
