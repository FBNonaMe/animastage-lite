/** Asset GPU warm-up gate — blocks Play until shaders/textures/skeleton are ready. */

let loading = false;
let message = '';
const listeners = new Set<() => void>();

let snapshot = { isAssetLoading: false, message: '' };

function rebuild(): void {
  snapshot = { isAssetLoading: loading, message };
}

function notify(): void {
  rebuild();
  listeners.forEach((l) => l());
}

export function setAssetLoading(active: boolean, msg = ''): void {
  loading = active;
  message = active ? msg || 'Warming up shaders and textures…' : '';
  notify();
}

export function getAssetLoadingState(): typeof snapshot {
  return snapshot;
}

export function isAssetLoading(): boolean {
  return loading;
}

export function subscribeAssetLoading(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetAssetLoadingStore(): void {
  loading = false;
  message = '';
  rebuild();
}
