import assert from "node:assert/strict";
import { normalizeEffectManifest } from "./core/EffectManifest.js";
import { EffectPreviewCache, createEffectPreviewKey } from "./preview/EffectPreviewCache.js";
import { EffectPreviewService } from "./preview/EffectPreviewService.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";

const manifest = {
  schema: "animestage.effect/v1",
  id: "test.preview.effect",
  version: "1.0.0",
  name: "Preview Test",
  author: "AnimeStage Tests",
  kind: "post-process",
  status: "GPU_TESTED",
  renderers: ["webgl2"],
  languages: ["glsl"],
  preview: {
    enabled: true,
    renderer: "isolated-webgl2",
    width: 320,
    height: 180,
    background: "#11101f",
    cacheRevision: "test1",
  },
  parameters: [{ id: "amount", label: "Amount", type: "float", default: 0.5, min: 0, max: 1 }],
};

const normalized = normalizeEffectManifest(manifest);
assert.equal(normalized.preview.enabled, true);
assert.equal(normalized.preview.width, 320);
assert.throws(() => normalizeEffectManifest({ ...manifest, preview: { enabled: true, width: 4 } }), /between 32 and 2048/);

assert.equal(
  createEffectPreviewKey({ b: 2, a: { y: 1, x: 0 } }),
  createEffectPreviewKey({ a: { x: 0, y: 1 }, b: 2 }),
  "cache keys must not depend on object insertion order",
);

const revoked = [];
let urlSequence = 0;
const urlApi = {
  createObjectURL: () => `blob:test-${++urlSequence}`,
  revokeObjectURL: (url) => revoked.push(url),
};
const cache = new EffectPreviewCache({ maxEntries: 1, maxBytes: 1024 * 1024, urlApi });
const first = cache.set("first", { blob: new Blob(["one"], { type: "image/png" }), isolated: true }, { effectKey: "first", width: 32, height: 32 });
assert.equal(first.url, "blob:test-1");
cache.set("second", { blob: new Blob(["two"], { type: "image/png" }), isolated: true }, { effectKey: "second", width: 32, height: 32 });
assert.equal(cache.get("first"), null);
assert.deepEqual(revoked, ["blob:test-1"], "LRU eviction must release owned object URLs");

const registry = new EffectsRegistry();
const definition = registry.register(manifest, { create() {} }, { source: "test" });
let renders = 0;
let unrelatedMutations = 0;
const adapter = {
  async renderPreview(_definition, parameters, options) {
    renders++;
    await Promise.resolve();
    return {
      blob: new Blob([JSON.stringify({ parameters, options })], { type: "image/png" }),
      width: options.width,
      height: options.height,
      backend: "test-isolated",
      isolated: true,
    };
  },
  capture: () => { unrelatedMutations++; },
  applyPostEffect: () => { unrelatedMutations++; },
};
const serviceCache = new EffectPreviewCache({ maxEntries: 8, urlApi });
const previews = new EffectPreviewService({ registry, adapter, cache: serviceCache });
const [previewA, previewB] = await Promise.all([
  previews.render(definition, { parameters: { amount: 0.75 } }),
  previews.render(definition, { parameters: { amount: 0.75 } }),
]);
assert.equal(renders, 1, "concurrent identical previews must be deduplicated");
assert.equal(previewA.record.key, previewB.record.key);
assert.equal(previewB.deduplicated, true);
assert.equal(unrelatedMutations, 0, "preview must not enter runtime capture/apply paths");

const cached = await previews.render(definition, { parameters: { amount: 0.75 } });
assert.equal(cached.cacheHit, true);
assert.equal(renders, 1);
const changed = await previews.render(definition, { parameters: { amount: 0.25 } });
assert.equal(changed.cacheHit, false);
assert.equal(renders, 2, "parameter changes require a distinct thumbnail");

const unsafe = new EffectPreviewService({
  registry,
  cache: new EffectPreviewCache({ urlApi }),
  adapter: { renderPreview: async () => ({ blob: new Blob(["unsafe"]), isolated: false }) },
});
await assert.rejects(() => unsafe.render(definition), /isolation contract/);

previews.clearCache();
assert.equal(previews.stats.entries, 0);
assert.ok(revoked.length >= 3, "clearing the cache must release all remaining object URLs");

console.log("Effect preview phase 6 tests: PASS");
