/**
 * Cancellation primitives shared by the modular offline renderer.
 *
 * The module intentionally depends only on web-platform APIs that also exist in
 * current Node releases. It does not import DOM, Three.js, or application state.
 */

export class RenderCancelledError extends Error {
  constructor(message = 'Offline render cancelled', options = {}) {
    const { cause, details } = options;
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'RenderCancelledError';
    this.code = 'RENDER_CANCELLED';
    this.details = details ?? null;
  }
}

export function isRenderCancelled(error) {
  return error instanceof RenderCancelledError
    || error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR'
    || error?.code === 'RENDER_CANCELLED';
}

export function cancellationFromSignal(signal, details) {
  const reason = signal?.reason;
  if (reason instanceof RenderCancelledError) return reason;
  if (reason instanceof Error) {
    return new RenderCancelledError(reason.message || 'Offline render cancelled', {
      cause: reason,
      details,
    });
  }
  return new RenderCancelledError(
    typeof reason === 'string' && reason.length ? reason : 'Offline render cancelled',
    { details },
  );
}

export function throwIfAborted(signal, details) {
  if (signal?.aborted) throw cancellationFromSignal(signal, details);
}

/**
 * Links zero or more AbortSignals to a private controller.
 * The returned dispose function removes every listener and is safe to call more
 * than once.
 */
export function createLinkedAbortController(signals = []) {
  const controller = new AbortController();
  const removers = [];
  let disposed = false;

  const abortFrom = (signal) => {
    if (!controller.signal.aborted) controller.abort(signal?.reason);
  };

  for (const signal of signals.filter(Boolean)) {
    if (signal.aborted) {
      abortFrom(signal);
      break;
    }
    const listener = () => abortFrom(signal);
    signal.addEventListener('abort', listener, { once: true });
    removers.push(() => signal.removeEventListener('abort', listener));
  }

  return {
    controller,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const remove of removers.splice(0)) remove();
    },
  };
}
