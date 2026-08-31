export const FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
export const FACE_LANDMARKER_LOCAL_URL = new URL("../vendor/mediapipe/models/face_landmarker.task", import.meta.url).href;
export const MEDIAPIPE_MODEL_CACHE = "animastage-performance-models-v1";

function emitStatus(callback, message) {
  if (typeof callback === "function") callback(message);
}

function responseLooksLikeTask(response) {
  if (!response?.ok) return false;
  const type = String(response.headers?.get?.("content-type") || "").toLowerCase();
  const length = Number(response.headers?.get?.("content-length"));
  if (type.includes("text/html") || type.includes("application/json")) return false;
  return !Number.isFinite(length) || length === 0 || length > 100_000;
}

async function toModelBuffer(response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 100_000) throw new Error("The face landmarker model is incomplete or invalid.");
  return bytes;
}

/**
 * Resolve a MediaPipe task without forcing the user through a file picker.
 * Resolution order is local asset, persistent browser cache, then official CDN.
 */
export async function resolveMediaPipeTaskModel({
  localUrl,
  remoteUrl,
  cacheName = MEDIAPIPE_MODEL_CACHE,
  fetchImpl = globalThis.fetch,
  cacheStorage = globalThis.caches,
  onStatus,
} = {}) {
  if (!localUrl || !remoteUrl) throw new Error("MediaPipe model URLs are not configured.");
  if (typeof fetchImpl !== "function") throw new Error("This browser cannot download the MediaPipe model.");

  emitStatus(onStatus, "Checking for a local face tracker…");
  try {
    const localResponse = await fetchImpl(localUrl, { method: "HEAD", cache: "no-store" });
    if (responseLooksLikeTask(localResponse)) return { modelAssetPath: localUrl, source: "local" };
  } catch (_) {
    // A bundled model is optional; continue with the persistent browser cache.
  }

  let cache = null;
  try {
    cache = cacheStorage?.open ? await cacheStorage.open(cacheName) : null;
    const cached = await cache?.match(remoteUrl);
    if (cached?.ok) {
      emitStatus(onStatus, "Loading the cached face tracker…");
      return { modelAssetBuffer: await toModelBuffer(cached), source: "cache" };
    }
  } catch (_) {
    cache = null;
  }

  emitStatus(onStatus, "Downloading the official face tracker (first run only)…");
  let response;
  try {
    response = await fetchImpl(remoteUrl, { mode: "cors", cache: "no-cache" });
  } catch (error) {
    throw new Error(`Automatic face model download failed: ${error?.message || error}. Select a local face_landmarker.task file instead.`);
  }
  if (!responseLooksLikeTask(response)) {
    throw new Error(`Automatic face model download failed (HTTP ${response?.status || "error"}). Select a local face_landmarker.task file instead.`);
  }

  try { await cache?.put(remoteUrl, response.clone()); } catch (_) {}
  return { modelAssetBuffer: await toModelBuffer(response), source: "download" };
}

export function resolveFaceLandmarkerModel(options = {}) {
  return resolveMediaPipeTaskModel({
    ...options,
    localUrl: options.localUrl || FACE_LANDMARKER_LOCAL_URL,
    remoteUrl: options.remoteUrl || FACE_LANDMARKER_MODEL_URL,
  });
}

export async function modelSourceFromFile(file) {
  if (!file) throw new Error("No face landmarker model was selected.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength < 100_000) throw new Error("The selected .task model is incomplete or invalid.");
  return { modelAssetBuffer: bytes, source: "manual", name: file.name || "face_landmarker.task" };
}

export function faceModelSourceLabel(source) {
  if (source?.source === "local") return "bundled local model";
  if (source?.source === "cache") return "cached official model";
  if (source?.source === "download") return "official model";
  if (source?.source === "manual") return source.name || "manual model";
  return "face model";
}
