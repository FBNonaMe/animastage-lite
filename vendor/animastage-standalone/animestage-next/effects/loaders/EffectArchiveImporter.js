import { normalizeEffectManifest } from "../core/EffectManifest.js";
import { EffectPackageSecurityError } from "../core/EffectErrors.js";
import {
  buildProvenanceRecord,
  inspectEffectPackageEntries,
  normalizeEffectPackagePath,
  sha256Hex,
} from "./EffectPackageInspector.js";

const GIB = 1024 * 1024 * 1024;
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

function uncompressedSize(entry) {
  const value = Number(entry?._data?.uncompressedSize);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function compressedSize(entry) {
  const value = Number(entry?._data?.compressedSize);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function importEffectArchive(file, {
  JSZip,
  manifest: manifestInput,
  source = {},
  dates = {},
  onProgress = null,
  cryptoApi = globalThis.crypto,
  concurrency = 2,
  maxEntries = 30000,
  maxUncompressedBytes = 4 * GIB,
  maxSingleFileBytes = 1024 * 1024 * 1024,
} = {}) {
  if (!file || typeof file.arrayBuffer !== "function") throw new TypeError("A readable effect ZIP File is required");
  if (!JSZip?.loadAsync) throw new TypeError("JSZip.loadAsync is unavailable");
  const manifest = normalizeEffectManifest(manifestInput, { source: file.name || "effect archive" });
  const emit = (phase, data = {}) => {
    try { onProgress?.(Object.freeze({ phase, archive: file.name || "effect.zip", ...data })); } catch (_) {}
  };

  emit("read", { percent: 0 });
  const packed = await file.arrayBuffer();
  const archiveSha256 = await sha256Hex(packed, cryptoApi);
  emit("index", { percent: 2, archiveSha256 });
  const zip = await JSZip.loadAsync(packed, { checkCRC32: true, createFolders: false });
  const indexed = [];
  const unsafePaths = [];
  zip.forEach((rawPath, entry) => {
    if (entry.dir) return;
    const path = normalizeEffectPackagePath(rawPath);
    if (!path) {
      unsafePaths.push(rawPath);
      return;
    }
    indexed.push({
      path,
      entry,
      size: uncompressedSize(entry),
      packedSize: compressedSize(entry),
    });
  });
  if (unsafePaths.length) {
    throw new EffectPackageSecurityError("Effect archive contains unsafe extraction paths", { unsafePaths });
  }
  if (indexed.length > maxEntries) {
    throw new EffectPackageSecurityError(`Effect archive contains ${indexed.length} files; limit is ${maxEntries}`);
  }
  const totalBytes = indexed.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > maxUncompressedBytes) {
    throw new EffectPackageSecurityError("Effect archive expands beyond the configured limit", { totalBytes });
  }
  for (const item of indexed) {
    if (item.size > maxSingleFileBytes) {
      throw new EffectPackageSecurityError(`Effect archive entry is too large: ${item.path}`, { size: item.size });
    }
    if (item.size > 128 * 1024 * 1024 && item.packedSize > 0 && item.size / item.packedSize > 1500) {
      throw new EffectPackageSecurityError(`Suspicious compression ratio: ${item.path}`);
    }
  }

  const extracted = new Array(indexed.length);
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= indexed.length) return;
      const item = indexed[index];
      const bytes = await item.entry.async("uint8array");
      extracted[index] = Object.freeze({ path: item.path, bytes });
      completed++;
      emit("extract", {
        completed,
        total: indexed.length,
        percent: 2 + Math.round(completed / Math.max(1, indexed.length) * 88),
      });
      await turn();
    }
  };
  const workers = Math.max(1, Math.min(4, Math.floor(concurrency) || 1, indexed.length || 1));
  await Promise.all(Array.from({ length: workers }, worker));
  emit("verify", { percent: 92 });
  const inspection = await inspectEffectPackageEntries(extracted, {
    cryptoApi,
    maxEntries,
    maxTotalBytes: maxUncompressedBytes,
    maxSingleFileBytes,
  });
  const provenance = buildProvenanceRecord({
    manifest,
    inspection,
    source: {
      archiveFilename: file.name || source.archiveFilename || "effect.zip",
      ...source,
    },
    dates,
  });
  emit("done", {
    percent: 100,
    accepted: inspection.accepted.length,
    quarantined: inspection.quarantined.length,
    archiveSha256,
  });
  const acceptedPaths = new Set(inspection.accepted.map((entry) => entry.path));
  const quarantineReasons = new Map([
    ...inspection.quarantined.map((entry) => [entry.path, entry.reason]),
    ...inspection.rejected.filter((entry) => entry.path).map((entry) => [entry.path, entry.reason]),
  ]);
  const originalEntries = extracted.filter((entry) => acceptedPaths.has(entry.path));
  const quarantineEntries = extracted
    .filter((entry) => quarantineReasons.has(entry.path))
    .map((entry) => Object.freeze({ ...entry, reason: quarantineReasons.get(entry.path) }));
  return Object.freeze({
    schema: "animestage.effect-package/v1",
    manifest,
    provenance: Object.freeze({ ...provenance, archiveSha256 }),
    inspection,
    // The archive bytes are retained byte-for-byte. The adapter must write
    // them only under source/, while extracted bytes belong under original/.
    sourceArchive: packed,
    originalEntries: Object.freeze(originalEntries),
    quarantineEntries: Object.freeze(quarantineEntries),
    adaptedEntries: Object.freeze([]),
  });
}
