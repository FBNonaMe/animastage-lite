#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OFFICIAL_EFFECT_SOURCES } from "../../animestage-next/effects/discovery/EffectSourceRegistry.js";
import { RAY_MMD_ADAPTED_EFFECTS } from "../../animestage-next/effects/builtin/ray-mmd-adapted-effects.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const CATALOG_PATH = resolve(ROOT, "assets/effects-library/catalog/effects-catalog.json");

const safe = (value) => String(value || "source").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "source";
const packageRoot = (source) => resolve(ROOT, "assets/effects-library/third-party", safe(source.owner), safe(source.repository), safe(source.revision.label || "source"));
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };

const effects = [
  { id: "animestage.material.original", version: "1.0.0", name: "Original MMD Materials", author: "AnimaStage", category: "Materials", status: "PRODUCTION_READY", runtimeCompatible: true },
  { id: "animestage.material.figure-pbr", version: "1.0.0", name: "Figure PBR", author: "AnimaStage", category: "Materials", status: "PRODUCTION_READY", runtimeCompatible: true },
  { id: "animestage.material.mmd2", version: "1.0.0", name: "MMD 2.0", author: "AnimaStage", category: "Anime / Toon", status: "PRODUCTION_READY", runtimeCompatible: true },
];
for (const entry of RAY_MMD_ADAPTED_EFFECTS) {
  const manifest = entry.manifest;
  effects.push({
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    author: manifest.author.name,
    category: manifest.categories[0] || manifest.kind,
    status: manifest.status,
    runtimeCompatible: true,
    bundled: true,
    rendererSupport: manifest.renderers,
    requirements: manifest.requirements || {},
    originalEntry: manifest.entryPoints.original,
    adaptedEntry: manifest.entryPoints.adapted,
    revision: { label: "1.5.2", commit: manifest.provenance.revision },
    license: { type: "MIT", redistributionAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
    archiveSha256: manifest.provenance.sha256,
  });
}

let downloaded = 0;
let verified = 0;
let quarantined = 0;
let rejected = 0;
let unresolvedDependencies = 0;
let structurallyParsedMME = 0;
let mmeStructuralErrors = 0;
for (const source of OFFICIAL_EFFECT_SOURCES) {
  const root = packageRoot(source);
  const provenancePath = resolve(root, "provenance.json");
  const inspectionPath = resolve(root, "inspection.json");
  const isDownloaded = await exists(provenancePath);
  let provenance = null;
  let inspection = null;
  if (isDownloaded) {
    downloaded++;
    provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
    if (/^[a-f0-9]{64}$/.test(provenance.archiveSha256 || "")) verified++;
    quarantined += inspection.quarantined?.length || 0;
    rejected += inspection.rejected?.length || 0;
    unresolvedDependencies += inspection.missingDependencies?.length || 0;
    structurallyParsedMME += inspection.compatibilityReports?.length || 0;
    mmeStructuralErrors += (inspection.compatibilityReports || [])
      .flatMap((report) => report.diagnostics || [])
      .filter((diagnostic) => diagnostic.severity === "error").length;
  }
  effects.push({
    id: source.id,
    version: source.manifest.version,
    name: source.manifest.name,
    author: source.manifest.author.name,
    category: source.manifest.categories[0] || source.manifest.kind,
    status: isDownloaded ? "VERIFIED" : "DISCOVERED",
    runtimeCompatible: false,
    bundled: isDownloaded,
    downloadPolicy: source.downloadPolicy,
    officialUrl: source.officialUrl,
    revision: source.revision,
    license: source.license,
    archiveSha256: provenance?.archiveSha256 || "",
    acceptedFiles: inspection?.accepted?.length || 0,
    quarantinedFiles: inspection?.quarantined?.length || 0,
    rejectedFiles: inspection?.rejected?.length || 0,
    unresolvedDependencies: inspection?.missingDependencies?.length || 0,
  });
}

const catalog = {
  schema: "animestage.effects-catalog/v1",
  generatedAt: new Date().toISOString(),
  effects,
};
await mkdir(dirname(CATALOG_PATH), { recursive: true });
await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const catalogRows = effects.map((effect) =>
  `| ${effect.name} | ${effect.author} | ${effect.category} | ${effect.status} | ${effect.runtimeCompatible ? "yes" : "no"} |`,
).join("\n");
await writeFile(resolve(ROOT, "docs/effects-catalog.md"),
  `# AnimaStage Effects Catalog\n\nGenerated ${catalog.generatedAt}.\n\n| Effect | Author | Category | Source status | Runtime ready |\n|---|---|---|---|---|\n${catalogRows}\n\n` +
  "`VERIFIED` means the official archive and extracted-file hashes were checked. It does not mean HLSL/DX9 code runs in WebGL/WebGPU. Runtime readiness requires a separate adapter plus runtime and GPU tests.\n",
  "utf8");

await writeFile(resolve(ROOT, "docs/effects-download-report.md"),
  `# Effects download report\n\nGenerated ${catalog.generatedAt}.\n\n| Metric | Count |\n|---|---:|\n` +
  `| Native material effects indexed | 3 |\n| GPU-tested third-party adapters | ${RAY_MMD_ADAPTED_EFFECTS.filter((entry) => entry.manifest.status === "GPU_TESTED").length} |\n| Official third-party sources indexed | ${OFFICIAL_EFFECT_SOURCES.length} |\n` +
  `| Third-party archives downloaded | ${downloaded} |\n| Archives with SHA-256 verification | ${verified} |\n` +
  `| Files isolated in quarantine | ${quarantined} |\n| Unsupported files retained only in the immutable source archive | ${rejected} |\n` +
  `| Unresolved literal shader includes | ${unresolvedDependencies} |\n` +
  `| MME .fx files structurally parsed | ${structurallyParsedMME} |\n` +
  `| MME structural parser errors | ${mmeStructuralErrors} |\n` +
  `| Production-ready third-party adapters | ${RAY_MMD_ADAPTED_EFFECTS.filter((entry) => entry.manifest.status === "PRODUCTION_READY").length} |\n\n` +
  "Ray-MMD may be bundled under MIT with attribution. KH40 repositories are metadata-only because their repository rules prohibit redistributing the unchanged shader; MES40 and Shadekai also prohibit commercial use. No quarantined program is executed.\n",
  "utf8");

console.log(`Effect catalog generated: ${effects.length} entries (${verified} verified external archive)`);
