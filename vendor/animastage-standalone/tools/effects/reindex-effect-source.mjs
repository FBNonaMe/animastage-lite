#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "../../vendor/jszip/dist/jszip.min.js";
import { getOfficialEffectSource } from "../../animestage-next/effects/discovery/EffectSourceRegistry.js";
import { importEffectArchive } from "../../animestage-next/effects/loaders/EffectArchiveImporter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const LIBRARY_ROOT = resolve(ROOT, "assets/effects-library/third-party");
const safe = (value) => String(value || "source").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ensureInside = (base, candidate) => {
  const root = resolve(base);
  const target = resolve(candidate);
  if (target !== root && !target.startsWith(root + sep)) throw new Error(`Unsafe path rejected: ${target}`);
  return target;
};
const atomicJson = async (path, value) => {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
};

const idIndex = process.argv.indexOf("--id");
const id = idIndex >= 0 ? process.argv[idIndex + 1] : "raycast.ray-mmd";
const source = getOfficialEffectSource(id);
assert(source, `Unknown source ${id}`);
assert.equal(source.downloadPolicy, "bundle-allowed", "restricted source packages may not be reindexed into the distributable library");
const packageRoot = ensureInside(LIBRARY_ROOT, resolve(
  LIBRARY_ROOT, safe(source.owner), safe(source.repository), safe(source.revision.label || "source"),
));
const oldProvenance = JSON.parse(await readFile(resolve(packageRoot, "provenance.json"), "utf8"));
const archivePath = resolve(packageRoot, "source", oldProvenance.archiveFilename);
const archive = await readFile(archivePath);
assert.equal(hash(archive), oldProvenance.archiveSha256, "refusing to reindex a source archive whose bytes changed");

const fileLike = {
  name: oldProvenance.archiveFilename,
  arrayBuffer: async () => archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength),
};
const effectPackage = await importEffectArchive(fileLike, {
  JSZip,
  cryptoApi: webcrypto,
  manifest: { ...source.manifest, status: "VERIFIED" },
  source: {
    sourceUrl: source.officialUrl,
    downloadUrl: source.downloadUrl,
    sourceType: "official-github",
    archiveFilename: oldProvenance.archiveFilename,
    archiveVersion: source.revision.label,
    revision: source.revision.commit,
    licenseUrl: source.license.url,
    readmeLocation: oldProvenance.readmeLocation || "original/README.md",
    redistributionNotes: oldProvenance.redistributionNotes,
    compatibilityNotes: oldProvenance.compatibilityNotes,
  },
  dates: {
    discoveryDate: oldProvenance.discoveryDate,
    downloadDate: oldProvenance.downloadDate,
  },
});

let added = 0;
for (const entry of effectPackage.originalEntries) {
  const output = ensureInside(resolve(packageRoot, "original"), resolve(packageRoot, "original", ...entry.path.split("/")));
  if (await exists(output)) {
    assert.equal(hash(await readFile(output)), hash(entry.bytes), `immutable original changed: ${entry.path}`);
  } else {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, entry.bytes, { flag: "wx" });
    added++;
  }
}
for (const entry of effectPackage.quarantineEntries) {
  const output = ensureInside(resolve(packageRoot, "quarantine"), resolve(packageRoot, "quarantine", ...entry.path.split("/")));
  if (!await exists(output)) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, entry.bytes, { flag: "wx" });
  }
}

const archiveSha256 = oldProvenance.archiveSha256;
await atomicJson(resolve(packageRoot, "effect.manifest.json"), {
  ...effectPackage.manifest,
  status: "VERIFIED",
  provenance: { ...effectPackage.manifest.provenance, sha256: archiveSha256 },
});
await atomicJson(resolve(packageRoot, "provenance.json"), { ...effectPackage.provenance, archiveSha256 });
await atomicJson(resolve(packageRoot, "inspection.json"), effectPackage.inspection);

console.log(`Reindexed ${id}: ${added} newly accepted file(s) added without rewriting immutable originals`);
console.log(`  accepted ${effectPackage.inspection.accepted.length}, quarantined ${effectPackage.inspection.quarantined.length}, rejected ${effectPackage.inspection.rejected.length}`);
