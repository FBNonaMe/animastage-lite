#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getOfficialEffectSource } from "../../animestage-next/effects/discovery/EffectSourceRegistry.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const safe = (value) => String(value || "source").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

const idIndex = process.argv.indexOf("--id");
const id = idIndex >= 0 ? process.argv[idIndex + 1] : "raycast.ray-mmd";
const source = getOfficialEffectSource(id);
assert(source, `Unknown source ${id}`);
const packageRoot = resolve(ROOT, "assets/effects-library/third-party", safe(source.owner), safe(source.repository), safe(source.revision.label || "source"));
const provenance = JSON.parse(await readFile(resolve(packageRoot, "provenance.json"), "utf8"));
const inspection = JSON.parse(await readFile(resolve(packageRoot, "inspection.json"), "utf8"));
const archive = await readFile(resolve(packageRoot, "source", provenance.archiveFilename));

assert.equal(hash(archive), provenance.archiveSha256, "immutable archive SHA-256 must match provenance");
assert.match(provenance.archiveSha256, /^[a-f0-9]{64}$/);
assert.equal(inspection.quarantined.length, 0, "official Ray-MMD tag must not contain executable entries");
assert.equal(inspection.rejected.every((entry) => entry.extension === "zip"), true, "only nested tool archives may remain unsupported");

for (const record of inspection.accepted) {
  const bytes = await readFile(resolve(packageRoot, "original", ...record.path.split("/")));
  assert.equal(bytes.byteLength, record.size, `${record.path} size mismatch`);
  assert.equal(hash(bytes), record.sha256, `${record.path} hash mismatch`);
}

const fingerprintInput = inspection.accepted
  .map((record) => `${record.path}\0${record.sha256}\0${record.size}`)
  .sort()
  .join("\n");
const packageSha256 = createHash("sha256").update(new TextEncoder().encode(fingerprintInput)).digest("hex");
assert.equal(packageSha256, inspection.packageSha256, "extracted package fingerprint must be deterministic");
assert.equal(provenance.sha256, inspection.packageSha256, "provenance must retain package fingerprint");
assert(webcrypto.subtle, "Node WebCrypto must be available for browser parity");

console.log(`Verified source package ${id}: PASS`);
console.log(`  archive ${provenance.archiveSha256}`);
console.log(`  files ${inspection.accepted.length}, bytes ${inspection.totalBytes}`);
