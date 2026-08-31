import assert from "node:assert/strict";
import { EffectPreviewCache } from "./preview/EffectPreviewCache.js";
import { EffectPreviewService } from "./preview/EffectPreviewService.js";

const definition = {
  key: "test.preview@1.0.0",
  manifest: {
    id: "test.preview", name: "Persistent Preview", parameters: [],
    preview: { enabled: true, isolated: true, width: 64, height: 64, renderer: "webgl2", cacheRevision: "1", background: "#000000" },
  },
};
const registry = { require: () => definition };
let renders = 0;
const adapter = { async renderPreview() { renders++; return { blob: new Blob(["png"], { type: "image/png" }), width: 64, height: 64, backend: "webgl2", isolated: true }; } };
const data = new Map();
const store = {
  available: true,
  async get(key) { return data.get(key) || null; },
  async put(key, result) { data.set(key, { ...result, blob: result.blob }); },
  async clear() { data.clear(); },
};
const urls = { createObjectURL: (() => { let i = 0; return () => `blob:test-${++i}`; })(), revokeObjectURL() {} };
const firstService = new EffectPreviewService({ registry, adapter, persistentStore: store, cache: new EffectPreviewCache({ urlApi: urls }) });
const first = await firstService.render(definition);
assert.equal(first.cacheHit, false);
assert.equal(renders, 1);
const secondService = new EffectPreviewService({ registry, adapter, persistentStore: store, cache: new EffectPreviewCache({ urlApi: urls }) });
const second = await secondService.render(definition);
assert.equal(second.cacheHit, true);
assert.equal(second.persistentHit, true);
assert.equal(renders, 1, "startup must reuse the persistent preview");
await secondService.clearCache();
assert.equal(data.size, 0);
console.log("Effect persistent preview cache phase 7: PASS");
