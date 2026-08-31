import assert from "node:assert/strict";
import { FrameContext } from "../core/FrameContext.js";
import { EFFECT_MANIFEST_SCHEMA } from "./core/EffectManifest.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectFrameState } from "./runtime/EffectFrameState.js";
import { EffectRuntime } from "./runtime/EffectRuntime.js";

const context = FrameContext.offline({ frameIndex: 120, fps: 60, seed: 42, metadata: { sceneRevision: 7 } });
const first = EffectFrameState.fromFrameContext(context);
const second = EffectFrameState.fromFrameContext(context);
assert.deepEqual(first.uniforms, second.uniforms);
for (let index = 0; index < 32; index++) {
  assert.equal(first.random("particles", index), second.random("particles", index));
}
assert.notEqual(first.random("particles", 0), first.random("particles", 1));
assert.notEqual(first.random("particles", 0), first.random("smoke", 0));

const manifest = (id) => ({
  schema: EFFECT_MANIFEST_SCHEMA,
  id,
  version: "1.0.0",
  name: id,
  author: { name: "Test" },
  kind: "utility",
  slot: id,
  status: "RUNTIME_TESTED",
  categories: ["test"], tags: ["test"], renderers: ["raster"], languages: ["native"],
  provenance: { sourceType: "builtin" },
});
const registry = new EffectsRegistry();
let goodFrames = 0;
let failedDeactivated = 0;
registry.register(manifest("frame.good"), {
  create: () => ({ updateFrame(frame) { assert(frame instanceof EffectFrameState); goodFrames++; } }),
});
registry.register(manifest("frame.bad"), {
  create: () => ({
    updateFrame() { throw new Error("deterministic frame failure"); },
    deactivate() { failedDeactivated++; },
  }),
});
const runtime = new EffectRuntime({ registry, adapter: { capture: () => null, restore: () => true } });
const options = { owner: { kind: "editor", id: "test" }, target: { kind: "scene", id: "scene" } };
await runtime.apply("frame.good", options);
await runtime.apply("frame.bad", options);
const result = runtime.evaluateFrame(context);
assert.equal(result.updated, 1);
assert.equal(result.failed, 1);
assert.equal(goodFrames, 1, "one bad effect cannot block later frame consumers");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(failedDeactivated, 1);
assert.equal(runtime.instances.length, 1, "only the offending instance is disabled");
assert.equal(runtime.diagnostics.query({ code: "EFFECT_FRAME_FAILED" }).length, 1);

console.log("AnimaStage Effects Platform deterministic frame contracts: PASS");
