export const RENDER_FRAME_MODES = Object.freeze({
  RASTER: 'raster',
  ANIME_NPR: 'anime-npr',
  PATH_TRACED: 'path-traced',
});

const VALID_MODES = new Set(Object.values(RENDER_FRAME_MODES));

function optionalFunction(value, name) {
  if (value !== undefined && typeof value !== 'function') {
    throw new TypeError(`${name} must be a function when provided`);
  }
  return value;
}

/**
 * DOM/renderer-neutral adapter contract.
 *
 * Concrete application bridges can wrap WebGL raster, Anime NPR, or path-traced
 * implementations without making the coordinator aware of Three.js.
 */
export class FrameRenderAdapter {
  constructor({
    id,
    mode,
    beginJob,
    sampleFrame,
    completeJob,
    abortJob,
    disposeJob,
  }) {
    if (!id || typeof id !== 'string') throw new TypeError('Render adapter id is required');
    if (!VALID_MODES.has(mode)) throw new TypeError(`Unsupported render adapter mode: ${mode}`);
    if (typeof sampleFrame !== 'function') throw new TypeError('sampleFrame must be a function');

    this.id = id;
    this.mode = mode;
    this.beginJob = optionalFunction(beginJob, 'beginJob');
    this.sampleFrame = sampleFrame;
    this.completeJob = optionalFunction(completeJob, 'completeJob');
    this.abortJob = optionalFunction(abortJob, 'abortJob');
    this.disposeJob = optionalFunction(disposeJob, 'disposeJob');
    Object.freeze(this);
  }
}

export class RenderAdapterRegistry {
  #adapters = new Map();

  constructor(adapters = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter) {
    if (!(adapter instanceof FrameRenderAdapter)) {
      throw new TypeError('Only FrameRenderAdapter instances may be registered');
    }
    if (this.#adapters.has(adapter.id)) {
      throw new Error(`Render adapter already registered: ${adapter.id}`);
    }
    this.#adapters.set(adapter.id, adapter);
    return this;
  }

  resolve(idOrMode) {
    if (this.#adapters.has(idOrMode)) return this.#adapters.get(idOrMode);
    const matches = [...this.#adapters.values()].filter((adapter) => adapter.mode === idOrMode);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`Render mode ${idOrMode} is ambiguous; select an adapter id`);
    }
    throw new Error(`No render adapter registered for: ${idOrMode}`);
  }

  list() {
    return [...this.#adapters.values()];
  }
}

function createModeFactory(mode) {
  return (configuration) => new FrameRenderAdapter({ ...configuration, mode });
}

export const createRasterFrameAdapter = createModeFactory(RENDER_FRAME_MODES.RASTER);
export const createAnimeNprFrameAdapter = createModeFactory(RENDER_FRAME_MODES.ANIME_NPR);
export const createPathTracedFrameAdapter = createModeFactory(RENDER_FRAME_MODES.PATH_TRACED);
