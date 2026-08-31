import assert from "node:assert/strict";
import { EFFECT_MANIFEST_SCHEMA } from "./core/EffectManifest.js";
import { EffectManifestError } from "./core/EffectErrors.js";
import { PostProcessingEffectBridge } from "./integration/PostProcessingEffectBridge.js";
import {
  effectParameterDefaults,
  normalizeEffectParameterDefinitions,
  normalizeEffectParameterValues,
} from "./parameters/EffectParameters.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectRuntime } from "./runtime/EffectRuntime.js";

const definitions = normalizeEffectParameterDefinitions([
  { id: "amount", label: "Mix", type: "float", min: 0, max: 1, step: 0.01, default: 1 },
  { id: "operator", type: "enum", default: 5, options: [
    { value: 0, label: "None" },
    { value: 5, label: "ACES" },
  ] },
  { id: "enabled", type: "bool", default: true },
  { id: "tint", type: "color", default: "#FF00AA" },
  { id: "direction", type: "vec2", default: [1, 0] },
]);
assert.deepEqual(effectParameterDefaults(definitions), {
  amount: 1,
  operator: 5,
  enabled: true,
  tint: "#ff00aa",
  direction: [1, 0],
});
assert.deepEqual(normalizeEffectParameterValues(definitions, { amount: 0.5 }).amount, 0.5);
assert.throws(() => normalizeEffectParameterValues(definitions, { amount: 2 }), EffectManifestError);
assert.throws(() => normalizeEffectParameterValues(definitions, { surprise: 1 }), EffectManifestError);

const passState = { calls: [], current: {} };
const fakePass = {
  setParams(parameters) {
    if (parameters.exposure === 7) throw new Error("simulated GPU uniform rejection");
    passState.current = { ...parameters };
    passState.calls.push(passState.current);
  },
};
const post = new PostProcessingEffectBridge(() => ({ passes: { grade: fakePass } }));
const adapter = {
  capture: () => post.capture(),
  restore: (snapshot) => post.restore(snapshot),
  validate: () => true,
  assertPostPass: (passId) => post.assertPass(passId),
  applyPostEffect: (instance, passId, parameters) => post.apply(instance, passId, parameters),
  updatePostEffect: (instance, parameters) => post.update(instance, parameters),
  removePostEffect: (instance) => post.remove(instance),
};
const implementation = {
  create: ({ instance, adapter: effectAdapter, parameters }) => ({
    restoreOnDisable: false,
    validate: () => effectAdapter.assertPostPass("grade"),
    activate: () => effectAdapter.applyPostEffect(instance, "grade", parameters),
    updateParameters: (next) => effectAdapter.updatePostEffect(instance, next),
    deactivate: () => effectAdapter.removePostEffect(instance),
  }),
};
const manifest = (id, slot, exposure) => ({
  schema: EFFECT_MANIFEST_SCHEMA,
  id,
  version: "1.0.0",
  name: id,
  author: { name: "Test" },
  kind: "post-process",
  slot,
  status: "RUNTIME_TESTED",
  categories: ["post processing"],
  tags: ["test"],
  renderers: ["webgl2"],
  languages: ["native"],
  parameters: [
    { id: "amount", type: "float", min: 0, max: 1, default: 1 },
    { id: "exposure", type: "float", min: -8, max: 8, default: exposure },
  ],
  provenance: { sourceType: "builtin" },
});

const registry = new EffectsRegistry();
registry.register(manifest("test.grade-a", "post.grade-a", 1), implementation);
registry.register(manifest("test.grade-b", "post.grade-b", 2), implementation);
const runtime = new EffectRuntime({ registry, adapter });
const owner = { kind: "editor", id: "effects" };
const target = post.getTarget();
const first = await runtime.apply("test.grade-a", { owner, target });
const second = await runtime.apply("test.grade-b", { owner, target });
assert.equal(passState.current.exposure, 2, "latest layer owns a shared pass deterministically");

await runtime.updateParameters(second, { exposure: 3 });
assert.equal(passState.current.exposure, 3, "reflected parameters update the live pass");
await assert.rejects(() => runtime.updateParameters(second, { exposure: 7 }), /simulated GPU/);
assert.equal(passState.current.exposure, 3, "failed live updates restore the previous pass values");

await runtime.disable(first);
assert.equal(passState.current.exposure, 3, "disabling another layer cannot reset the active layer");
await runtime.disable(second);
assert.deepEqual(passState.current, {}, "the pass returns to its neutral state after its last owner is removed");

console.log("AnimaStage Effects Platform phase-3 runtime contracts: PASS");
