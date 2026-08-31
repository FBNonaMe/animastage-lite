import { EFFECT_MANIFEST_SCHEMA } from "../core/EffectManifest.js";

export const EFFECT_SOURCE_REGISTRY_SCHEMA = "animestage.effect-sources/v1";
export const EFFECT_SOURCE_REGISTRY_VERSION = "2026.08.29";

function manifest({ id, name, author, description, kind, categories, tags, capabilities, sourceUrl, downloadUrl, revision, terms, licenseUrl, license = null, status = "DISCOVERED" }) {
  return Object.freeze({
    schema: EFFECT_MANIFEST_SCHEMA,
    id,
    version: id === "raycast.ray-mmd" ? "1.5.2" : "0.0.0-source",
    name,
    description,
    author,
    kind,
    slot: `external.${kind}.${id}`,
    status,
    categories,
    tags,
    renderers: ["source-reference"],
    languages: ["hlsl", "mme-fx"],
    capabilities,
    dependencies: [],
    license: license || {
      type: "unknown",
      redistributionAllowed: "unknown",
      commercialUseAllowed: "unknown",
      modificationAllowed: "unknown",
      noticeFiles: [],
    },
    compatibility: {
      nativeRuntime: "MikuMikuEffect / Direct3D 9",
      webRuntime: "adapter-required",
      exactSourceDoesNotImplyCompatibility: true,
    },
    provenance: {
      sourceUrl,
      downloadUrl,
      sourceType: "official-github",
      archiveVersion: revision.label,
      revision: revision.commit,
      licenseUrl,
      terms,
    },
  });
}

const SOURCES = [
  {
    id: "raycast.ray-mmd",
    owner: "ray-cast",
    repository: "ray-mmd",
    officialUrl: "https://github.com/ray-cast/ray-mmd",
    downloadUrl: "https://codeload.github.com/ray-cast/ray-mmd/zip/refs/tags/1.5.2",
    revision: { type: "tag", label: "1.5.2", commit: "a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8" },
    pinned: { defaultBranch: "master", pushedAt: "2024-06-23T05:58:12Z" },
    license: {
      id: "MIT",
      url: "https://github.com/ray-cast/ray-mmd/blob/master/LICENSE.txt",
      redistributionAllowed: true,
      commercialUseAllowed: true,
      attributionRequired: true,
      reviewRequired: false,
    },
    downloadPolicy: "bundle-allowed",
    manifest: manifest({
      id: "raycast.ray-mmd",
      name: "Ray-MMD 1.5.2 source",
      author: { name: "Rui / ray-cast", original: "Rui", url: "https://github.com/ray-cast" },
      description: "Official HLSL/DX9 Ray-MMD source package; verified source, WebGL/WebGPU adapter still required.",
      kind: "preset-stack",
      categories: ["materials", "lighting", "environment", "post processing", "imported"],
      tags: ["ray-mmd", "pbr", "fog", "ssr", "ssao", "dof", "bloom", "hlsl"],
      capabilities: ["pbr-materials", "multiple-lights", "volumetrics", "screen-space-effects", "tone-mapping"],
      sourceUrl: "https://github.com/ray-cast/ray-mmd",
      downloadUrl: "https://codeload.github.com/ray-cast/ray-mmd/zip/refs/tags/1.5.2",
      revision: { label: "1.5.2", commit: "a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8" },
      licenseUrl: "https://github.com/ray-cast/ray-mmd/blob/master/LICENSE.txt",
      terms: "MIT; retain copyright and permission notice",
      license: {
        type: "MIT",
        redistributionAllowed: true,
        commercialUseAllowed: true,
        modificationAllowed: true,
        noticeFiles: ["assets/effects-library/licenses/ray-mmd-MIT.txt"],
      },
      status: "VERIFIED",
    }),
  },
  {
    id: "kh40.animasa", repository: "AniMasa", branch: "main", commit: "b99d51e2cb4d5215bace900a3abee2acefc26492",
    name: "Ani:Masa", description: "Animasa Miku-specific three-tone material shader.", kind: "material",
    tags: ["animasa", "toon", "camera-angle"], capabilities: ["three-tone-material"],
    terms: "Modification allowed; intact shader redistribution prohibited; credit KH40 or shader name.", commercial: null,
  },
  {
    id: "kh40.drop-shadow-stage", repository: "DropShadow_Stage", branch: "main", commit: "60486b905d7ea3bba44b19c623dfab0c01a3e406",
    name: "DropShadow Stage", description: "KH40 stage-compatible edit of BeamManP DropShadow.", kind: "lighting",
    tags: ["drop-shadow", "stage"], capabilities: ["stage-drop-shadow"],
    terms: "Edited redistribution allowed; intact effect redistribution prohibited; credit BeamManP and KH40.", commercial: null,
  },
  {
    id: "kh40.mes40", repository: "MES40", branch: "master", commit: "58a27f0c59e52498ffeeb08b7949471ff5123a47",
    name: "MES40", description: "MMD Extended Shader with maps, IBL, rim light, parallax and HgShadow integration.", kind: "material",
    tags: ["mes40", "extended-material", "ibl", "parallax"], capabilities: ["normal-map", "specular-map", "ibl", "parallax", "soft-shadow"],
    terms: "Modification allowed; commercial use and intact redistribution prohibited; credits file required for distributions.", commercial: false,
  },
  {
    id: "kh40.shadekai", repository: "Shadekai", branch: "main", commit: "d0817cc65fd007c31aeb2d7307f3c145e50b55d9",
    name: "Shadekai", description: "Project Sekai-oriented MMD shader with vertex-color driven outlines and HgShadow.", kind: "material",
    tags: ["project-sekai", "toon", "vertex-color"], capabilities: ["character-lighting", "rim-light", "vertex-outline", "soft-shadow"],
    terms: "Modification allowed; commercial use and intact redistribution prohibited; credit KH40 or shader name.", commercial: false,
  },
  {
    id: "kh40.tonemap-raycast", repository: "ToneMap_raycast", branch: "main", commit: "aef3633d96a5c9841d47b72ff60916dd253002ea",
    name: "ToneMap raycast", description: "Standalone KH40 port of Ray-MMD tone mapping.", kind: "post-process",
    tags: ["tone-map", "raycast"], capabilities: ["tone-mapping", "highlight-rolloff"],
    terms: "No explicit redistribution license in repository README; source attribution recorded; legal review required.", commercial: null,
  },
  {
    id: "kh40.working-floor-blur", repository: "WorkingFloor2_Blur", branch: "main", commit: "",
    name: "WorkingFloor2 Blur", description: "KH40 blurred-reflection edit of HariganeP WorkingFloor2.", kind: "environment",
    tags: ["floor", "reflection", "blur"], capabilities: ["planar-reflection", "reflection-blur"],
    terms: "Edited redistribution allowed; intact effect redistribution prohibited; credit HariganeP and KH40.", commercial: null,
  },
].map((source) => {
  if (source.owner) return source;
  const owner = "KH40-khoast40";
  const officialUrl = `https://github.com/${owner}/${source.repository}`;
  const downloadUrl = `https://codeload.github.com/${owner}/${source.repository}/zip/refs/heads/${source.branch}`;
  const revision = { type: "branch", label: source.branch, commit: source.commit };
  return {
    ...source,
    owner,
    officialUrl,
    downloadUrl,
    revision,
    pinned: { defaultBranch: source.branch },
    license: {
      id: "LicenseRef-KH40-Repository-Rules",
      url: `${officialUrl}#rules`,
      redistributionAllowed: false,
      commercialUseAllowed: source.commercial,
      attributionRequired: true,
      reviewRequired: true,
    },
    downloadPolicy: "metadata-only",
    manifest: manifest({
      id: source.id,
      name: `${source.name} source`,
      author: { name: "KH40", original: "KH40 / khoast40", url: "https://github.com/KH40-khoast40" },
      description: `${source.description} Official source indexed; original is not bundled because repository rules prohibit intact redistribution.`,
      kind: source.kind,
      categories: [source.kind === "post-process" ? "post processing" : source.kind === "environment" ? "weather fx" : "materials", "imported"],
      tags: [...source.tags, "kh40", "source-reference"],
      capabilities: source.capabilities,
      sourceUrl: officialUrl,
      downloadUrl,
      revision,
      licenseUrl: `${officialUrl}#rules`,
      terms: source.terms,
      license: {
        type: "LicenseRef-KH40-Repository-Rules",
        redistributionAllowed: false,
        commercialUseAllowed: source.commercial == null ? "unknown" : source.commercial,
        modificationAllowed: true,
        noticeFiles: [],
      },
    }),
  };
});

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export const OFFICIAL_EFFECT_SOURCES = deepFreeze(SOURCES);

export function getOfficialEffectSource(id) {
  return OFFICIAL_EFFECT_SOURCES.find((source) => source.id === String(id || "").toLowerCase()) || null;
}

export function listOfficialEffectOwners() {
  return [...new Set(OFFICIAL_EFFECT_SOURCES.map((source) => source.owner))];
}
