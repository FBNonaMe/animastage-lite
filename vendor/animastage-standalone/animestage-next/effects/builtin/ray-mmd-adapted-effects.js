import { EFFECT_MANIFEST_SCHEMA } from "../core/EffectManifest.js";

const RAY_REVISION = "a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8";
const RAY_SHA256 = "5b8c095a4d77c0a6f259829c2cbdb1a279a5d993217e3f277f578a9cf7328494";

const parameter = (id, label, type, defaultValue, extra = {}) => ({
  id,
  label,
  type,
  default: defaultValue,
  group: "Ray Color Grade",
  ...extra,
});

export const RAY_MMD_ADAPTED_EFFECTS = Object.freeze([
  Object.freeze({
    manifest: {
      schema: EFFECT_MANIFEST_SCHEMA,
      id: "raycast.ray-mmd.color-grading",
      version: "1.5.2",
      name: "Ray-MMD Color Grading",
      description: "WebGL adapter of Ray-MMD color correction, temperature, vignette, dithering and six tone operators.",
      author: { name: "Rui / ray-cast + AnimaStage adapter", original: "Rui", url: "https://github.com/ray-cast/ray-mmd" },
      kind: "post-process",
      slot: "post.ray-color-grading",
      status: "GPU_TESTED",
      categories: ["post processing", "color", "ray-mmd", "imported"],
      tags: ["ray-mmd", "color grading", "aces", "hable", "reinhard", "temperature", "vignette"],
      renderers: ["webgl2", "raster", "anime-npr", "rtx"],
      languages: ["glsl", "native"],
      capabilities: ["parameter-reflection", "transactional-rollback", "live-parameters", "deterministic"],
      requirements: {
        features: ["webgl2", "effect-composer"],
        limits: { maxTextureUnits: 4 },
        policy: "disable",
      },
      dependencies: [],
      passes: [{ id: "ray.color-grading", kind: "post-process" }],
      license: {
        type: "MIT",
        redistributionAllowed: true,
        commercialUseAllowed: true,
        modificationAllowed: true,
        noticeFiles: ["assets/effects-library/licenses/ray-mmd-MIT.txt"],
      },
      entryPoints: {
        postPass: "ray.color-grading",
        original: "Shader/ColorGrading.fxsub",
        adapted: "adapted/ray-color-grading-pass.js",
      },
      compatibility: {
        sourceRuntime: "MikuMikuEffect / Direct3D 9",
        adapterRuntime: "AnimaStage EffectComposer / WebGL2",
        scope: "color grading and tone operators only",
        exactSourceDoesNotImplyFullPipelineCompatibility: true,
      },
      preview: {
        enabled: true,
        renderer: "isolated-webgl2",
        width: 320,
        height: 180,
        background: "#11101f",
        cacheRevision: "ray-color-adapter1",
      },
      parameters: [
        parameter("amount", "Mix", "float", 1, { min: 0, max: 1, step: 0.01 }),
        parameter("operator", "Tone operator", "enum", 5, { options: [
          { value: 0, label: "None" },
          { value: 1, label: "Reinhard" },
          { value: 2, label: "Hable · white 4" },
          { value: 3, label: "Hable · white 8" },
          { value: 4, label: "Hejl 2015" },
          { value: 5, label: "ACES" },
          { value: 6, label: "Naughty Dog" },
        ] }),
        parameter("exposure", "Exposure", "float", 0, { min: -8, max: 8, step: 0.05, unit: "EV" }),
        parameter("temperature", "Temperature", "float", 6500, { min: 1000, max: 40000, step: 100, unit: "K" }),
        parameter("saturation", "Saturation", "float", 1, { min: 0, max: 3, step: 0.01 }),
        parameter("contrast", "Contrast", "float", 1, { min: 0.1, max: 3, step: 0.01 }),
        parameter("gamma", "Gamma", "float", 1, { min: 0.1, max: 4, step: 0.01 }),
        parameter("gain", "Gain", "float", 1, { min: 0, max: 4, step: 0.01 }),
        parameter("offset", "Offset", "float", 0, { min: -1, max: 1, step: 0.01 }),
        parameter("vignette", "Vignette", "float", 0, { min: 0, max: 1, step: 0.01 }),
      ],
      provenance: {
        sourceUrl: "https://github.com/ray-cast/ray-mmd",
        downloadUrl: "https://codeload.github.com/ray-cast/ray-mmd/zip/refs/tags/1.5.2",
        sourceType: "official-github-adapted",
        archiveVersion: "1.5.2",
        revision: RAY_REVISION,
        sha256: RAY_SHA256,
        licenseUrl: "https://github.com/ray-cast/ray-mmd/blob/master/LICENSE.txt",
        terms: "MIT; original source preserved separately",
      },
    },
    implementation: {
      create: ({ instance, adapter, target, parameters }) => ({
        restoreOnDisable: false,
        validate: () => {
          adapter.assertTarget?.(target, instance);
          adapter.assertPostPass?.("ray.color-grading");
        },
        activate: () => adapter.applyPostEffect?.(instance, "ray.color-grading", parameters),
        updateParameters: (next) => adapter.updatePostEffect?.(instance, next),
        deactivate: () => adapter.removePostEffect?.(instance),
      }),
    },
  }),
  Object.freeze({
    manifest: {
      schema: EFFECT_MANIFEST_SCHEMA,
      id: "raycast.ray-mmd.hdr-bloom",
      version: "1.5.2",
      name: "Ray-MMD HDR Bloom",
      description: "Five-level WebGL bloom adapter with Ray-MMD threshold modes, Gaussian radius and HDR tint.",
      author: { name: "Rui / ray-cast + AnimaStage adapter", original: "Rui", url: "https://github.com/ray-cast/ray-mmd" },
      kind: "post-process",
      slot: "post.ray-hdr-bloom",
      status: "GPU_TESTED",
      categories: ["post processing", "bloom / glow", "ray-mmd", "imported"],
      tags: ["ray-mmd", "bloom", "glow", "hdr", "gaussian", "five-level"],
      renderers: ["webgl2", "raster", "anime-npr", "rtx"],
      languages: ["glsl", "native"],
      capabilities: ["multi-pass", "parameter-reflection", "transactional-rollback", "live-parameters", "deterministic"],
      requirements: {
        features: ["webgl2", "effect-composer"],
        limits: { maxTextureUnits: 8, maxTextureSize: 2048 },
        policy: "disable",
      },
      dependencies: [],
      passes: [{ id: "ray.hdr-bloom", kind: "post-process" }],
      license: {
        type: "MIT",
        redistributionAllowed: true,
        commercialUseAllowed: true,
        modificationAllowed: true,
        noticeFiles: ["assets/effects-library/licenses/ray-mmd-MIT.txt"],
      },
      entryPoints: {
        postPass: "ray.hdr-bloom",
        original: "Shader/PostProcessBloom.fxsub",
        adapted: "adapted/ray-bloom-pass.js",
      },
      compatibility: {
        sourceRuntime: "MikuMikuEffect / Direct3D 9",
        adapterRuntime: "AnimaStage EffectComposer / WebGL2",
        scope: "five-level bloom; star streak and ghost passes are not included in this adapter",
        exactSourceDoesNotImplyFullPipelineCompatibility: true,
      },
      preview: {
        enabled: true,
        renderer: "isolated-webgl2",
        width: 320,
        height: 180,
        background: "#11101f",
        cacheRevision: "ray-bloom-adapter1",
      },
      parameters: [
        parameter("amount", "Intensity", "float", 0.65, { min: 0, max: 4, step: 0.01 }),
        parameter("threshold", "HDR threshold", "float", 1, { min: 0, max: 8, step: 0.01 }),
        parameter("radius", "Gaussian radius", "float", 2.2, { min: 0.1, max: 10, step: 0.1 }),
        parameter("mode", "Threshold mode", "enum", 4, { options: [
          { value: 1, label: "Linear HDR" },
          { value: 2, label: "Clamped" },
          { value: 3, label: "Luminance" },
          { value: 4, label: "Luminance HDR" },
        ] }),
        parameter("tint", "Bloom tint", "color", "#ffffff"),
      ],
      provenance: {
        sourceUrl: "https://github.com/ray-cast/ray-mmd",
        downloadUrl: "https://codeload.github.com/ray-cast/ray-mmd/zip/refs/tags/1.5.2",
        sourceType: "official-github-adapted",
        archiveVersion: "1.5.2",
        revision: RAY_REVISION,
        sha256: RAY_SHA256,
        licenseUrl: "https://github.com/ray-cast/ray-mmd/blob/master/LICENSE.txt",
        terms: "MIT; original source preserved separately",
      },
    },
    implementation: {
      create: ({ instance, adapter, target, parameters }) => ({
        restoreOnDisable: false,
        validate: () => {
          adapter.assertTarget?.(target, instance);
          adapter.assertPostPass?.("ray.hdr-bloom");
        },
        activate: () => adapter.applyPostEffect?.(instance, "ray.hdr-bloom", parameters),
        updateParameters: (next) => adapter.updatePostEffect?.(instance, next),
        deactivate: () => adapter.removePostEffect?.(instance),
      }),
    },
  }),
]);
