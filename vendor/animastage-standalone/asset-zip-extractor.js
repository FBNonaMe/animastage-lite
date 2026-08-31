/*
 * Bounded, observable ZIP extraction for AnimeStage asset packs.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * JSZip decompresses on the browser main thread. Starting every entry at once
 * creates a large amount of competing work and keeps every temporary buffer
 * alive until Promise.all settles. Large MMD packs can therefore look stuck or
 * exhaust memory. This module limits in-flight entries, yields between files,
 * filters unrelated archive payloads, and guarantees a visible failure when a
 * worker stops making progress.
 */

export const ZIP_ASSET_EXTENSIONS = new Set([
    "pmx", "pmd", "glb", "gltf", "obj", "mtl", "bin",
    "png", "jpg", "jpeg", "bmp", "tga", "webp", "gif",
    "ktx", "ktx2", "dds", "spa", "sph",
    "vmd", "hdr", "json",
]);

const MIME_BY_EXTENSION = Object.freeze({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    bmp: "image/bmp",
    tga: "image/x-tga",
    webp: "image/webp",
    gif: "image/gif",
    json: "application/json",
    gltf: "model/gltf+json",
    glb: "model/gltf-binary",
    bin: "application/octet-stream",
});

const JUNK_PARTS = new Set(["__macosx", ".git", ".svn"]);
const JUNK_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const GIB = 1024 * 1024 * 1024;

// requestAnimationFrame is intentionally not used: browsers suspend it for a
// background/minimized tab, which would pause an archive after the first file.
const waitForTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

export function normalizeZipAssetPath(value) {
    const raw = String(value ?? "").replace(/\\/g, "/").replace(/\0/g, "");
    const parts = [];
    for (const part of raw.split("/")) {
        if (!part || part === ".") continue;
        if (part === ".." || /^[a-z]:$/i.test(part)) return "";
        parts.push(part);
    }
    return parts.join("/");
}

export function isUsefulZipAssetPath(path, extensions = ZIP_ASSET_EXTENSIONS) {
    const normalized = normalizeZipAssetPath(path);
    if (!normalized) return false;
    const parts = normalized.toLowerCase().split("/");
    if (parts.some((part) => JUNK_PARTS.has(part))) return false;
    const name = parts[parts.length - 1];
    if (JUNK_FILES.has(name)) return false;
    const dot = name.lastIndexOf(".");
    return dot > 0 && extensions.has(name.slice(dot + 1));
}

function entrySize(entry) {
    const size = Number(entry?._data?.uncompressedSize);
    return Number.isFinite(size) && size >= 0 ? size : 0;
}

function entryCompressedSize(entry) {
    const size = Number(entry?._data?.compressedSize);
    return Number.isFinite(size) && size >= 0 ? size : 0;
}

function defaultCreateFile(bytes, name, options) {
    return new File([bytes], name, options);
}

function withStallWatchdog(work, describe, getLastActivity, timeoutMs) {
    if (!(timeoutMs > 0)) return work;
    let timer = null;
    const stalled = new Promise((_, reject) => {
        timer = setInterval(() => {
            if (Date.now() - getLastActivity() < timeoutMs) return;
            clearInterval(timer);
            timer = null;
            reject(new Error(`ZIP extraction stalled while reading ${describe}`));
        }, Math.min(5000, Math.max(50, Math.floor(timeoutMs / 4))));
    });
    return Promise.race([work, stalled]).finally(() => {
        if (timer != null) clearInterval(timer);
    });
}

/**
 * Extract only files AnimeStage can consume.
 * Returns { files, stats }; onProgress receives a structured snapshot.
 */
export async function extractAssetZip(file, {
    JSZip,
    onProgress = null,
    concurrency = 2,
    maxEntries = 20000,
    maxUncompressedBytes = 3 * GIB,
    maxSingleFileBytes = 1536 * 1024 * 1024,
    stallTimeoutMs = 90000,
    includePath = isUsefulZipAssetPath,
    createFile = defaultCreateFile,
} = {}) {
    if (!file || typeof file.arrayBuffer !== "function") {
        throw new TypeError("A readable ZIP File is required");
    }
    if (!JSZip?.loadAsync) throw new TypeError("JSZip.loadAsync is unavailable");

    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    const emit = (state) => {
        try { onProgress?.({ archive: file.name || "archive.zip", ...state }); } catch (_) {}
    };
    emit({ phase: "read", percent: 0, completed: 0, total: 0 });
    const packed = await file.arrayBuffer();
    emit({ phase: "index", percent: 0, completed: 0, total: 0 });
    const zip = await JSZip.loadAsync(packed, {
        checkCRC32: false,
        createFolders: false,
    });

    const candidates = [];
    let archiveEntries = 0;
    let skipped = 0;
    zip.forEach((rawPath, entry) => {
        if (entry.dir) return;
        archiveEntries++;
        const path = normalizeZipAssetPath(rawPath);
        if (!path || !includePath(path)) {
            skipped++;
            return;
        }
        candidates.push({ path, entry, size: entrySize(entry) });
    });

    if (archiveEntries > maxEntries) {
        throw new Error(`ZIP has ${archiveEntries.toLocaleString()} files; safety limit is ${maxEntries.toLocaleString()}`);
    }
    const totalBytes = candidates.reduce((sum, item) => sum + item.size, 0);
    if (totalBytes > maxUncompressedBytes) {
        throw new Error(`ZIP expands to ${(totalBytes / GIB).toFixed(2)} GiB; browser safety limit is ${(maxUncompressedBytes / GIB).toFixed(2)} GiB`);
    }
    const oversized = candidates.find((item) => item.size > maxSingleFileBytes);
    if (oversized) {
        throw new Error(`ZIP entry is too large for browser memory: ${oversized.path} (${(oversized.size / GIB).toFixed(2)} GiB)`);
    }

    // Reject obvious decompression bombs while allowing ordinary compressed
    // textures and repetitive JSON/OBJ data.
    const suspicious = candidates.find((item) => {
        const compressed = entryCompressedSize(item.entry);
        return item.size > 128 * 1024 * 1024 && compressed > 0 && item.size / compressed > 1500;
    });
    if (suspicious) throw new Error(`Suspicious ZIP compression ratio: ${suspicious.path}`);

    const files = new Array(candidates.length);
    const activeProgress = new Map();
    let next = 0;
    let completed = 0;
    let completedBytes = 0;
    let lastEmit = 0;

    const progressSnapshot = (force = false) => {
        const now = globalThis.performance?.now?.() ?? Date.now();
        if (!force && now - lastEmit < 80) return;
        lastEmit = now;
        const activeBytes = [...activeProgress.values()].reduce((sum, item) => (
            sum + item.size * item.percent / 100
        ), 0);
        const bytePercent = totalBytes > 0
            ? ((completedBytes + activeBytes) / totalBytes) * 100
            : (candidates.length ? completed / candidates.length * 100 : 100);
        emit({
            phase: "extract",
            percent: Math.max(0, Math.min(100, Math.round(bytePercent))),
            completed,
            total: candidates.length,
            completedBytes,
            totalBytes,
            skipped,
        });
    };
    progressSnapshot(true);

    const worker = async () => {
        while (true) {
            const index = next++;
            if (index >= candidates.length) return;
            const item = candidates[index];
            let lastActivity = Date.now();
            activeProgress.set(index, { size: item.size, percent: 0 });
            const work = item.entry.async("uint8array", (metadata) => {
                lastActivity = Date.now();
                activeProgress.set(index, {
                    size: item.size,
                    percent: Number(metadata?.percent) || 0,
                });
                progressSnapshot(false);
            });
            const bytes = await withStallWatchdog(
                work,
                item.path,
                () => lastActivity,
                stallTimeoutMs,
            );
            const name = item.path.split("/").pop() || "asset.bin";
            const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
            const extracted = createFile(bytes, name, {
                type: MIME_BY_EXTENSION[extension] || "application/octet-stream",
                lastModified: item.entry.date instanceof Date ? item.entry.date.getTime() : Date.now(),
            });
            extracted._relPath = item.path;
            files[index] = extracted;
            activeProgress.delete(index);
            completed++;
            completedBytes += item.size || bytes.byteLength || 0;
            progressSnapshot(true);
            // Give input, animation and progress painting a chance to run.
            await waitForTurn();
        }
    };

    const workers = Math.max(1, Math.min(4, Math.floor(concurrency) || 1, candidates.length || 1));
    await Promise.all(Array.from({ length: workers }, () => worker()));
    const elapsedMs = (globalThis.performance?.now?.() ?? Date.now()) - startedAt;
    emit({
        phase: "done",
        percent: 100,
        completed,
        total: candidates.length,
        completedBytes,
        totalBytes,
        skipped,
        elapsedMs,
    });
    return {
        files: files.filter(Boolean),
        stats: {
            archiveEntries,
            extracted: completed,
            skipped,
            totalBytes,
            elapsedMs,
            concurrency: workers,
        },
    };
}
