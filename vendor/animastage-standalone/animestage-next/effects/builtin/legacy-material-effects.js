import { EFFECT_MANIFEST_SCHEMA } from "../core/EffectManifest.js";

const builtin = ({ id, name, description, tags, mode }) => ({
  manifest: {
    schema: EFFECT_MANIFEST_SCHEMA,
    id,
    version: "1.0.0",
    name,
    description,
    author: { name: "AnimaStage", original: "AnimaStage" },
    kind: "material",
    slot: "material.pipeline",
    status: "PRODUCTION_READY",
    categories: ["materials", "anime / toon", "builtin"],
    tags,
    renderers: ["raster", "rtx"],
    languages: ["javascript", "glsl"],
    capabilities: ["legacy-shader-studio-bridge", "transactional-rollback"],
    dependencies: [],
    license: {
      type: "GPL-3.0-or-later",
      redistributionAllowed: true,
      commercialUseAllowed: true,
      modificationAllowed: true,
      noticeFiles: ["LICENSE", "THIRD_PARTY_NOTICES.md"],
    },
    entryPoints: { bridge: "legacy-shader-studio" },
    compatibility: { legacyShaderStudio: true, offlineRender: true },
    provenance: { sourceType: "builtin" },
  },
  implementation: {
    create: ({ adapter, target }) => ({
      validate: () => adapter.assertTarget?.(target),
      activate: () => adapter.applyLegacyMode(mode, target),
    }),
  },
});

export const LEGACY_MATERIAL_EFFECTS = Object.freeze([
  builtin({
    id: "animestage.material.original",
    name: "Original MMD Materials",
    description: "Original PMX/MMD materials exactly as loaded.",
    tags: ["original", "mmd", "toon", "safe"],
    mode: "original",
  }),
  builtin({
    id: "animestage.material.figure-pbr",
    name: "Figure PBR",
    description: "Physical figure-style skin, cloth, hair, metal and glass presets.",
    tags: ["pbr", "figure", "skin", "cloth", "hair"],
    mode: "figure",
  }),
  builtin({
    id: "animestage.material.mmd2",
    name: "MMD 2.0",
    description: "Native MMD toon shading with AnimaStage cinematic overlays.",
    tags: ["mmd", "toon", "anime", "cinematic"],
    mode: "mmd2",
  }),
]);
