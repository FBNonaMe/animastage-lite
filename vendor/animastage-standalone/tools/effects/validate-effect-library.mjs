#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const readJson = async (path) => JSON.parse(await readFile(resolve(ROOT, path), "utf8"));
const catalog = await readJson("assets/effects-library/catalog/effects-catalog.json");
const discovery = await readJson("assets/effects-library/catalog/source-discovery.json");
assert.equal(catalog.schema, "animestage.effects-catalog/v1");
assert.equal(discovery.schema, "animestage.effect-sources/v1");
assert.ok(Array.isArray(catalog.effects) && catalog.effects.length > 0);
assert.ok(Array.isArray(discovery.sources) && discovery.sources.length > 0);

const catalogKeys = new Set();
for (const effect of catalog.effects) {
  assert.match(effect.id, /^[a-z0-9][a-z0-9._-]+$/i, `invalid effect id ${effect.id}`);
  assert.ok(effect.version && effect.name && effect.author && effect.status, `incomplete catalog entry ${effect.id}`);
  const key = `${effect.id}@${effect.version}`;
  assert.ok(!catalogKeys.has(key), `duplicate effect ${key}`);
  catalogKeys.add(key);
}

const sourceIds = new Set();
for (const source of discovery.sources) {
  assert.ok(!sourceIds.has(source.id), `duplicate source ${source.id}`);
  sourceIds.add(source.id);
  assert.match(source.officialUrl, /^https:\/\//, `${source.id} must use an official HTTPS URL`);
  assert.ok(source.license?.id && source.license?.url, `${source.id} is missing license metadata`);
  assert.ok(["bundle-allowed", "metadata-only"].includes(source.downloadPolicy), `${source.id} has an invalid download policy`);
  assert.equal(source.manifest?.provenance?.sourceUrl, source.officialUrl, `${source.id} provenance mismatch`);
  if (source.downloadPolicy === "metadata-only") assert.equal(source.license.redistributionAllowed, false, `${source.id} must not be bundled`);
}

const rayRoot = "assets/effects-library/third-party/ray-cast/ray-mmd/1.5.2";
const provenance = await readJson(`${rayRoot}/provenance.json`);
const archive = await readFile(resolve(ROOT, `${rayRoot}/source/ray-mmd-1.5.2.zip`));
const archiveSha256 = createHash("sha256").update(archive).digest("hex");
assert.equal(archiveSha256, provenance.archiveSha256, "Ray-MMD archive hash changed");
assert.equal(provenance.revision, "a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8", "Ray-MMD revision changed");
assert.match(provenance.licenseUrl, /LICENSE/i, "Ray-MMD license provenance is missing");

const counts = {
  indexed: catalog.effects.length,
  runnable: catalog.effects.filter((entry) => entry.runtimeCompatible).length,
  sourceReferences: discovery.sources.length,
  bundledSources: discovery.sources.filter((entry) => entry.downloadPolicy === "bundle-allowed").length,
  metadataOnly: discovery.sources.filter((entry) => entry.downloadPolicy === "metadata-only").length,
};
console.log(`Effect library validation: PASS (${counts.indexed} indexed, ${counts.runnable} runnable, ${counts.sourceReferences} source references)`);
console.log(`  archive ${archiveSha256}`);
console.log(`  bundled ${counts.bundledSources}, metadata-only ${counts.metadataOnly}`);
