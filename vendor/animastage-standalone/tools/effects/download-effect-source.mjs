#!/usr/bin/env node
import { createHash, webcrypto } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "../../vendor/jszip/dist/jszip.min.js";
import { OFFICIAL_EFFECT_SOURCES, getOfficialEffectSource } from "../../animestage-next/effects/discovery/EffectSourceRegistry.js";
import { importEffectArchive } from "../../animestage-next/effects/loaders/EffectArchiveImporter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const LIBRARY_ROOT = resolve(ROOT, "assets/effects-library/third-party");
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;

function safeSegment(value) {
  return String(value || "source").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
}

function ensureInside(base, candidate) {
  const root = resolve(base);
  const target = resolve(candidate);
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Unsafe output path rejected: ${target}`);
  return target;
}

function packageDirectory(source) {
  return ensureInside(LIBRARY_ROOT, resolve(
    LIBRARY_ROOT,
    safeSegment(source.owner),
    safeSegment(source.repository),
    safeSegment(source.revision.label || source.revision.commit || "source"),
  ));
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function fetchArchive(url, { attempts = 4, maxWaitMs = 5000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "AnimaStage-Effect-Source-Downloader" },
      });
      if (!response.ok) throw new Error(`Download returned HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES) throw new Error("Archive exceeds the 1 GiB safety limit");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Download stream is unavailable");
      const chunks = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_ARCHIVE_BYTES) {
          await reader.cancel("archive limit exceeded");
          throw new Error("Archive exceeded the 1 GiB safety limit while downloading");
        }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, total);
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, Math.min(maxWaitMs, 400 * 2 ** attempt)));
    }
  }
  throw lastError || new Error("Archive download failed");
}

async function listProvenanceFiles(directory) {
  if (!await exists(directory)) return [];
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = ensureInside(LIBRARY_ROOT, resolve(directory, entry.name));
    if (entry.isDirectory()) results.push(...await listProvenanceFiles(path));
    else if (entry.isFile() && entry.name === "provenance.json") results.push(path);
  }
  return results;
}

async function findArchiveDuplicate(archiveSha256) {
  for (const path of await listProvenanceFiles(LIBRARY_ROOT)) {
    try {
      const provenance = JSON.parse(await readFile(path, "utf8"));
      if (provenance.archiveSha256 === archiveSha256) return path;
    } catch (_) {}
  }
  return null;
}

async function writeEntry(base, entry) {
  const output = ensureInside(base, resolve(base, ...entry.path.split("/")));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, entry.bytes);
}

async function downloadSource(source, { dryRun = false } = {}) {
  if (!source) throw new Error("Unknown effect source");
  if (source.downloadPolicy !== "bundle-allowed") {
    throw new Error(`${source.id} is metadata-only: repository rules prohibit bundling the unchanged source`);
  }
  const target = packageDirectory(source);
  if (dryRun) return { id: source.id, target, dryRun: true };
  console.log(`Downloading ${source.id} from its official source...`);
  const archive = await fetchArchive(source.downloadUrl);
  const archiveSha256 = createHash("sha256").update(archive).digest("hex");
  const duplicate = await findArchiveDuplicate(archiveSha256);
  if (duplicate && !duplicate.startsWith(target + sep)) {
    throw new Error(`Identical archive already indexed at ${relative(ROOT, duplicate)}`);
  }
  if (await exists(target)) {
    const provenancePath = resolve(target, "provenance.json");
    const previous = JSON.parse(await readFile(provenancePath, "utf8"));
    if (previous.archiveSha256 !== archiveSha256) {
      throw new Error(`Immutable package ${source.id} already exists with a different archive hash`);
    }
    console.log(`Already verified: ${source.id} (${archiveSha256})`);
    return { id: source.id, target, archiveSha256, alreadyPresent: true };
  }

  const fileLike = {
    name: `${safeSegment(source.repository)}-${safeSegment(source.revision.label)}.zip`,
    async arrayBuffer() {
      return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
    },
  };
  const effectPackage = await importEffectArchive(fileLike, {
    JSZip,
    cryptoApi: webcrypto,
    manifest: { ...source.manifest, status: "VERIFIED" },
    source: {
      sourceUrl: source.officialUrl,
      downloadUrl: source.downloadUrl,
      sourceType: "official-github",
      archiveFilename: fileLike.name,
      archiveVersion: source.revision.label,
      revision: source.revision.commit,
      licenseUrl: source.license.url,
      readmeLocation: "original/README.md",
      redistributionNotes: source.license.redistributionAllowed
        ? "Bundling permitted subject to attribution and license retention."
        : "Do not redistribute the unchanged source archive.",
      compatibilityNotes: "Native MME HLSL/DX9 source; no WebGL/WebGPU runtime compatibility is claimed.",
    },
    dates: { discoveryDate: "2026-08-29", downloadDate: new Date().toISOString() },
    onProgress: (progress) => {
      if (progress.phase === "extract" && (progress.completed === progress.total || progress.completed % 250 === 0)) {
        console.log(`  inspected ${progress.completed}/${progress.total} files`);
      }
    },
  });

  const stage = ensureInside(dirname(target), `${target}.staging-${process.pid}-${Date.now()}`);
  await mkdir(stage, { recursive: true });
  let committed = false;
  try {
    await mkdir(resolve(stage, "source"), { recursive: true });
    await mkdir(resolve(stage, "original"), { recursive: true });
    await mkdir(resolve(stage, "adapted"), { recursive: true });
    await writeFile(resolve(stage, "source", fileLike.name), archive);
    for (const entry of effectPackage.originalEntries) await writeEntry(resolve(stage, "original"), entry);
    if (effectPackage.quarantineEntries.length) {
      await mkdir(resolve(stage, "quarantine"), { recursive: true });
      for (const entry of effectPackage.quarantineEntries) await writeEntry(resolve(stage, "quarantine"), entry);
    }
    const writtenManifest = {
      ...effectPackage.manifest,
      status: "VERIFIED",
      provenance: { ...effectPackage.manifest.provenance, sha256: archiveSha256 },
    };
    const provenance = { ...effectPackage.provenance, archiveSha256 };
    await writeFile(resolve(stage, "effect.manifest.json"), `${JSON.stringify(writtenManifest, null, 2)}\n`, "utf8");
    await writeFile(resolve(stage, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
    await writeFile(resolve(stage, "inspection.json"), `${JSON.stringify(effectPackage.inspection, null, 2)}\n`, "utf8");
    await writeFile(resolve(stage, "adapted", "README.md"),
      "# Adapter status\n\nNo runtime adapter is present yet. The verified original source must remain immutable. Generated WebGL/WebGPU adapters belong in this directory.\n",
      "utf8");
    await mkdir(dirname(target), { recursive: true });
    await rename(stage, target);
    committed = true;
  } finally {
    if (!committed && await exists(stage)) await rm(stage, { recursive: true, force: true });
  }
  console.log(`Verified ${source.id}: ${archiveSha256}`);
  console.log(`  accepted ${effectPackage.inspection.accepted.length}, quarantined ${effectPackage.inspection.quarantined.length}, rejected ${effectPackage.inspection.rejected.length}`);
  return { id: source.id, target, archiveSha256, inspection: effectPackage.inspection };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
let selected = [];
if (args.includes("--all-redistributable")) {
  selected = OFFICIAL_EFFECT_SOURCES.filter((source) => source.downloadPolicy === "bundle-allowed");
} else {
  const idIndex = args.indexOf("--id");
  const id = idIndex >= 0 ? args[idIndex + 1] : args.find((value) => !value.startsWith("--"));
  if (!id) {
    console.error("Usage: node tools/effects/download-effect-source.mjs --id <source-id> [--dry-run]");
    console.error("       node tools/effects/download-effect-source.mjs --all-redistributable");
    process.exitCode = 2;
  } else {
    const source = getOfficialEffectSource(id);
    if (!source) throw new Error(`Unknown effect source: ${id}`);
    selected = [source];
  }
}

for (const source of selected) await downloadSource(source, { dryRun });
