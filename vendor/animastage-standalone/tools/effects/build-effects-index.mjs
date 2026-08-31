#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const input = resolve(ROOT, "assets/effects-library/catalog/effects-catalog.json");
const output = resolve(ROOT, "assets/effects-library/catalog/effects-index.json");
const catalog = JSON.parse(await readFile(input, "utf8"));
const effects = catalog.effects.map((effect) => ({
  key: `${effect.id}@${effect.version}`,
  id: effect.id, version: effect.version, name: effect.name, author: effect.author,
  category: effect.category, status: effect.status,
  runnable: effect.runtimeCompatible === true, bundled: effect.bundled === true,
  search: [...new Set(`${effect.id} ${effect.name} ${effect.author} ${effect.category} ${effect.status}`.toLowerCase().split(/[^\p{L}\p{N}._-]+/u).filter(Boolean))],
})).sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
const index = {
  schema: "animestage.effects-index/v1", sourceSchema: catalog.schema, sourceGeneratedAt: catalog.generatedAt,
  counts: { total: effects.length, runnable: effects.filter((entry) => entry.runnable).length, bundled: effects.filter((entry) => entry.bundled).length },
  categories: [...new Set(effects.map((entry) => entry.category))].sort(),
  statuses: [...new Set(effects.map((entry) => entry.status))].sort(), effects,
};
await writeFile(output, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Effect search index built: ${effects.length} entries -> ${output}`);
