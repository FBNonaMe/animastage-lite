#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const MANIFEST_PATH = resolve(ROOT, ".animastage-package-manifest.json");
const checkOnly = process.argv.includes("--check");
const normalize = (path) => path.split(sep).join("/");
const inside = (path) => {
  const target = resolve(path);
  assert(target === ROOT || target.startsWith(ROOT + sep), `Path escaped package root: ${target}`);
  return target;
};
const hashFile = async (path) => createHash("sha256").update(await readFile(path)).digest("hex");

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = inside(resolve(directory, entry.name));
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const previous = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const paths = new Set(previous.files.map((entry) => entry.path));
const addFile = (path) => paths.add(normalize(relative(ROOT, inside(path))));
const addTree = async (path) => { for (const file of await collectFiles(path)) addFile(file); };

// Runtime source registry, user-visible catalog and redistributable verified
// packages are part of the standalone. Developer test/CLI files remain out.
addFile(resolve(ROOT, "animestage-next/effects/discovery/EffectSourceRegistry.js"));
addFile(resolve(ROOT, "animestage-next/effects/EffectsPlatform.js"));
for (const directory of [
  "builtin", "compatibility", "compiler", "core", "diagnostics", "discovery",
  "graph", "integration", "loaders", "parameters", "presets", "preview", "reflection", "registry", "renderers", "runtime", "testing", "ui",
]) {
  await addTree(resolve(ROOT, "animestage-next/effects", directory));
}
await addTree(resolve(ROOT, "assets/effects-library"));
for (const name of [
  "effect-package-format.md", "effects-architecture.md", "effects-migration-status.md",
  "effects-catalog.md", "effects-download-report.md", "effects-discovery-report.md",
  "shader-studio.md", "mme-compatibility.md", "effect-library.md", "effect-development.md", "effects-final-report.md",
]) {
  addFile(resolve(ROOT, "docs", name));
}
addFile(resolve(ROOT, "THIRD_PARTY_NOTICES.md"));

const files = [];
for (const path of [...paths].sort()) {
  const absolute = inside(resolve(ROOT, ...path.split("/")));
  const info = await stat(absolute);
  files.push({ path, bytes: info.size, sha256: await hashFile(absolute) });
}
const next = {
  schema: previous.schema,
  entrypoint: previous.entrypoint,
  fileCount: files.length,
  totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
  files,
};

if (checkOnly) {
  assert.equal(previous.fileCount, next.fileCount, "package file count changed");
  assert.equal(previous.totalBytes, next.totalBytes, "package byte count changed");
  assert.deepEqual(previous.files, next.files, "package manifest hashes changed");
  console.log(`AnimaStage package manifest integrity: PASS (${next.fileCount} files)`);
} else {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`AnimaStage package manifest updated: ${next.fileCount} files, ${next.totalBytes} bytes`);
}
