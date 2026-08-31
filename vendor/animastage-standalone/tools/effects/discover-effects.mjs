#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverOfficialEffectSources } from "./lib/GitHubDiscovery.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const argumentsSet = new Set(process.argv.slice(2));
const offline = argumentsSet.has("--offline");
const output = resolve(ROOT, "assets/effects-library/catalog/source-discovery.json");
const reportPath = resolve(ROOT, "docs/effects-discovery-report.md");

const discovery = await discoverOfficialEffectSources({ offline });
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(discovery, null, 2)}\n`, "utf8");

const rows = discovery.sources.map((source) => [
  source.manifest.name,
  `[official](${source.officialUrl})`,
  source.revision.label || source.repositoryMetadata.defaultBranch,
  source.license.id,
  source.downloadPolicy,
  source.discoveryMode,
].join(" | "));
const failed = discovery.network.filter((entry) => !entry.ok);
const report = `# Official effect source discovery\n\nGenerated ${discovery.generatedAt}. Registry ${discovery.registryVersion}.\n\n` +
  `| Source | Official URL | Revision | Terms | Policy | Evidence |\n|---|---|---|---|---|---|\n` +
  rows.map((row) => `| ${row} |`).join("\n") +
  `\n\n## Network status\n\n` +
  (offline ? "Discovery ran in pinned offline mode.\n" : failed.length
    ? `GitHub API was unavailable for ${failed.length} owner(s); pinned records were used and the errors remain in the JSON report.\n`
    : "All configured owners were refreshed through the paginated GitHub API.\n") +
  `\nPinned fallback is explicit evidence, not a compatibility claim. Packages remain non-runnable until an AnimaStage adapter passes runtime and GPU tests.\n`;
await writeFile(reportPath, report, "utf8");
console.log(`Effect discovery: ${discovery.sources.length} official sources indexed`);
console.log(`  ${output}`);
console.log(`  ${reportPath}`);
