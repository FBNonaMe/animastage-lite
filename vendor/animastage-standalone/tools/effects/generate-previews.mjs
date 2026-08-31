#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RAY_MMD_ADAPTED_EFFECTS } from "../../animestage-next/effects/builtin/ray-mmd-adapted-effects.js";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const directory = resolve(ROOT, "assets/effects-library/previews");
const output = resolve(directory, "preview-jobs.json");
const jobs = RAY_MMD_ADAPTED_EFFECTS.filter((entry) => entry.manifest.preview?.enabled).map((entry) => ({
  effect: `${entry.manifest.id}@${entry.manifest.version}`,
  width: entry.manifest.preview.width, height: entry.manifest.preview.height,
  renderer: entry.manifest.preview.renderer, cacheRevision: entry.manifest.preview.cacheRevision,
  seed: 1, isolationRequired: true,
})).sort((a, b) => a.effect.localeCompare(b.effect));
await mkdir(directory, { recursive: true });
await writeFile(output, `${JSON.stringify({ schema: "animestage.preview-jobs/v1", jobs }, null, 2)}\n`, "utf8");
console.log(`Preview job manifest generated: ${jobs.length} isolated GPU job(s)`);
console.log("Open Shader Studio > Previews > Generate all to render and persist them on the target GPU.");
