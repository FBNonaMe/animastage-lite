import assert from "node:assert/strict";
import { EFFECT_MANIFEST_SCHEMA, normalizeEffectManifest } from "./core/EffectManifest.js";
import { EffectDependencyError, EffectPlatformError } from "./core/EffectErrors.js";
import { EffectGraph } from "./graph/EffectGraph.js";
import { PostProcessingEffectBridge } from "./integration/PostProcessingEffectBridge.js";
import { createEffectStackPreset, parseEffectStackPreset, serializeEffectStackPreset } from "./presets/EffectPresets.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectRuntime } from "./runtime/EffectRuntime.js";
import { EffectStack } from "./runtime/EffectStack.js";

const manifest = (id, passId, options = {}) => ({
  schema: EFFECT_MANIFEST_SCHEMA,
  id,
  version: "1.0.0",
  name: id,
  author: { name: "Test" },
  kind: "post-process",
  slot: `post.${passId}`,
  status: "RUNTIME_TESTED",
  categories: ["post processing"],
  tags: ["test"],
  renderers: ["webgl2"],
  languages: ["native"],
  parameters: [{ id: "amount", type: "float", min: 0, max: 4, default: options.amount ?? 1 }],
  passes: options.passes || [{ id: passId }],
  dependencies: options.dependencies || [],
  license: { type: "MIT", redistributionAllowed: true, commercialUseAllowed: true, modificationAllowed: true },
  provenance: { sourceType: "builtin" },
});

const normalized = normalizeEffectManifest(manifest("test.normalized", "normalized"));
assert.equal(normalized.passes[0].id, "normalized");
assert.equal(normalized.license.redistributionAllowed, true);
assert(Object.isFrozen(normalized.passes));

const passState = new Map();
const pass = (id) => ({ setParams(parameters) { passState.set(id, { ...parameters }); } });
const host = {
  passes: { grade: pass("grade"), bloom: pass("bloom"), bad: pass("bad") },
  orders: [],
  reorderPasses(ids) { this.orders.push(ids.slice()); },
};
const post = new PostProcessingEffectBridge(() => host);
const adapter = {
  capture: () => post.capture(),
  restore: (snapshot) => post.restore(snapshot),
  validate: () => true,
  getTarget: () => post.getTarget(),
  assertPostPass: (id) => post.assertPass(id),
  applyPostEffect: (instance, id, parameters) => post.apply(instance, id, parameters),
  updatePostEffect: (instance, parameters) => post.update(instance, parameters),
  removePostEffect: (instance) => post.remove(instance),
  reorderEffects: (instances, graph) => post.reorder(instances, graph),
};
const implementation = (passId, { fail = false, cleanup = null } = {}) => ({
  create: ({ instance, adapter: bridge, parameters, resources }) => ({
    restoreOnDisable: false,
    validate: () => bridge.assertPostPass(passId),
    activate: () => {
      if (fail) throw new Error("simulated stack GPU failure");
      if (cleanup) resources.defer(cleanup, "stack-test-cleanup");
      bridge.applyPostEffect(instance, passId, parameters);
    },
    updateParameters: (next) => bridge.updatePostEffect(instance, next),
    deactivate: () => bridge.removePostEffect(instance),
  }),
});

const registry = new EffectsRegistry();
registry.register(manifest("test.grade", "grade"), implementation("grade"));
registry.register(manifest("test.bloom", "bloom"), implementation("bloom"));
registry.register(manifest("test.bad", "bad"), implementation("bad", { fail: true }));
let cleanupCount = 0;
registry.register(manifest("test.cleanup", "grade"), implementation("grade", { cleanup: () => { cleanupCount++; } }));
const runtime = new EffectRuntime({ registry, adapter });
const stack = new EffectStack({ registry, runtime, adapter });
const owner = { kind: "editor", id: "test" };
const target = post.getTarget();

const grade = await stack.add("test.grade", { owner, target, parameters: { amount: 1.25 } });
const bloom = await stack.add("test.bloom", { owner, target, parameters: { amount: 2 } });
assert.equal(stack.size, 2);
assert.deepEqual(stack.graph.orderedNodes.map((node) => node.effectId), ["test.grade", "test.bloom"]);
assert.deepEqual(host.orders.at(-1), ["grade", "bloom"]);

const duplicate = await stack.duplicate(grade.stackEntryId);
assert.equal(stack.size, 3, "duplicate placements use independent runtime slots");
assert.equal(runtime.instances.length, 3);
await stack.updateParameters(duplicate.stackEntryId, { amount: 3 });
assert.equal(stack.getEntry(duplicate.stackEntryId).parameters.amount, 3);
await stack.move(duplicate.stackEntryId, 0);
assert.equal(stack.entries[0].stackEntryId, duplicate.stackEntryId);
assert.deepEqual(host.orders.at(-1), ["grade", "bloom"], "shared pass IDs remain unique in composer order");
await stack.setEnabled(bloom.stackEntryId, false);
assert.equal(stack.getEntry(bloom.stackEntryId).enabled, false);
await stack.setEnabled(bloom.stackEntryId, true);

const preset = createEffectStackPreset(stack.snapshot(), { id: "test.stack", name: "Test stack", author: "Test" });
const parsedPreset = parseEffectStackPreset(serializeEffectStackPreset(preset));
assert.deepEqual(parsedPreset, preset);
await stack.restore(parsedPreset);
assert.equal(stack.size, 3);

const beforeFailedRestore = stack.snapshot();
const failedPreset = createEffectStackPreset({
  schema: "animestage.effect-stack/v1",
  entries: [{
    stackEntryId: "bad-entry",
    effect: { id: "test.bad", version: "1.0.0" },
    owner: { kind: "editor", id: "test" },
    target: { kind: "post-chain", id: "main-composer" },
    parameters: { amount: 1 },
    enabled: true,
  }],
}, { id: "test.bad-stack", name: "Bad stack", author: "Test" });
await assert.rejects(() => stack.restore(failedPreset), /simulated stack GPU failure/);
assert.deepEqual(stack.snapshot(), beforeFailedRestore, "failed preset restore rolls the entire previous stack back");

const makeDefinition = (id, passes) => ({ key: `${id}@1.0.0`, manifest: normalizeEffectManifest(manifest(id, "main", { passes })) });
assert.throws(() => new EffectGraph([
  { stackEntryId: "a", definition: makeDefinition("graph.a", [{ id: "a", before: ["b"] }]), enabled: true },
  { stackEntryId: "b", definition: makeDefinition("graph.b", [{ id: "b", before: ["a"] }]), enabled: true },
]), EffectDependencyError, "cycles are rejected before composer mutation");
assert.throws(() => new EffectGraph([
  { stackEntryId: "reader", definition: makeDefinition("graph.reader", [{ id: "read", reads: ["missing-buffer"] }]), enabled: true },
]), (error) => error instanceof EffectPlatformError && error.code === "EFFECT_GRAPH_RESOURCE_MISSING");
assert.throws(() => new EffectGraph([
  { stackEntryId: "writer-a", definition: makeDefinition("graph.writer-a", [{ id: "a", writes: ["shared"] }]), enabled: true },
  { stackEntryId: "writer-b", definition: makeDefinition("graph.writer-b", [{ id: "b", writes: ["shared"] }]), enabled: true },
]), (error) => error instanceof EffectPlatformError && error.code === "EFFECT_GRAPH_WRITE_CONFLICT");

// Lightweight resource-lifetime stress: repeated placement teardown owns and
// releases exactly one resource every time.
await stack.clear();
for (let index = 0; index < 100; index++) {
  const entry = await stack.add("test.cleanup", { owner, target });
  await stack.remove(entry.stackEntryId);
}
assert.equal(cleanupCount, 100);
assert.equal(runtime.instances.length, 0);
assert.equal(stack.size, 0);
assert.equal(runtime.resourceStats.allocated, 100);
assert.equal(runtime.resourceStats.released, 100);
assert.equal(runtime.resourceStats.active, 0, "resource tracker must prove no live resource remains after stress teardown");
assert.equal(runtime.resourceStats.failedDisposals, 0);

console.log("AnimaStage Effects Platform phase-4 stack/graph contracts: PASS");
