import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { EFFECT_MANIFEST_SCHEMA, normalizeEffectManifest } from "./core/EffectManifest.js";
import { EffectManifestError, EffectDependencyError, EffectApplyError } from "./core/EffectErrors.js";
import { inspectEffectPackageEntries } from "./loaders/EffectPackageInspector.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectRuntime } from "./runtime/EffectRuntime.js";
import { createEffectsPlatform } from "./EffectsPlatform.js";

function manifest(id, { version = "1.0.0", dependencies = [], slot = "test.slot" } = {}) {
  return {
    schema: EFFECT_MANIFEST_SCHEMA,
    id,
    version,
    name: id,
    author: { name: "Test" },
    kind: "utility",
    slot,
    status: "RUNTIME_TESTED",
    categories: ["test"],
    tags: ["test"],
    renderers: ["raster"],
    languages: ["javascript"],
    dependencies,
    provenance: { sourceType: "builtin" },
  };
}

assert.throws(
  () => normalizeEffectManifest({ schema: EFFECT_MANIFEST_SCHEMA, id: "bad" }),
  EffectManifestError,
  "invalid manifests must be rejected before registration",
);

const registry = new EffectsRegistry();
registry.register(manifest("test.base", { version: "1.0.0" }), { create: () => ({}) });
registry.register(manifest("test.base", { version: "1.2.0" }), { create: () => ({}) });
registry.register(manifest("test.child", {
  dependencies: [{ id: "test.base", range: "^1.0.0" }],
}), { create: () => ({}) });
assert.equal(registry.resolve("test.base").manifest.version, "1.2.0", "latest compatible version is selected");
assert.deepEqual(
  registry.resolveDependencyOrder(registry.require("test.child")).map((definition) => definition.manifest.id),
  ["test.base", "test.child"],
  "dependencies must be ordered before the effect",
);
assert.equal(registry.getEffect("test.base").manifest.version, "1.2.0");
assert.equal(registry.findEffects({ renderer: "raster" }).length, 3);
assert.equal(registry.getCompatibility("test.child", {
  renderer: "raster",
  languages: ["javascript"],
}).compatible, true);
const incompatible = registry.getCompatibility("test.child", {
  renderer: "webgpu",
  languages: ["wgsl"],
});
assert.equal(incompatible.compatible, false);
assert.ok(incompatible.reasons.includes("renderer:webgpu"));
assert.ok(incompatible.reasons.includes("language:javascript"));

const cyclic = new EffectsRegistry();
cyclic.register(manifest("cycle.one", { dependencies: [{ id: "cycle.two" }] }), { create: () => ({}) });
cyclic.register(manifest("cycle.two", { dependencies: [{ id: "cycle.one" }] }), { create: () => ({}) });
assert.throws(() => cyclic.resolveDependencyOrder(cyclic.require("cycle.one")), EffectDependencyError);

const state = { value: "original", restores: 0 };
const adapter = {
  capture: () => ({ value: state.value }),
  restore: (snapshot) => { state.value = snapshot.value; state.restores++; },
};
const runtimeRegistry = new EffectsRegistry();
runtimeRegistry.register(manifest("runtime.good"), {
  create: ({ resources }) => ({
    activate: () => {
      state.value = "good";
      resources.defer(() => { state.cleaned = (state.cleaned || 0) + 1; }, "test-cleanup");
    },
  }),
});
runtimeRegistry.register(manifest("runtime.bad", { slot: "bad.slot" }), {
  create: () => ({
    activate: () => { state.value = "corrupt"; throw new Error("GPU compile failed"); },
  }),
});
const runtime = new EffectRuntime({ registry: runtimeRegistry, adapter });
const owner = { kind: "editor", id: "test" };
const targetA = { kind: "model", id: "a" };
const targetB = { kind: "model", id: "b" };
const goodA = await runtime.apply("runtime.good", { owner, target: targetA });
assert.equal(state.value, "good");
assert.equal(goodA.state, "active");
await runtime.apply("runtime.good", { owner, target: targetB });
assert.equal(runtime.instances.length, 2, "different model targets own isolated instances");
state.value = "before-bad";
await assert.rejects(() => runtime.apply("runtime.bad", { owner, target: targetA }), EffectApplyError);
assert.equal(state.value, "before-bad", "failed application restores the exact previous state");
assert.equal(state.restores, 1, "rollback executes exactly once");

const inspection = await inspectEffectPackageEntries([
  { path: "original/effect.fx", bytes: '#include "shared/common.fxh"\nfloat4 main():SV_Target{return 1;}' },
  { path: "original/shared/common.fxh", bytes: "float helper = 1.0;" },
  { path: "original/README.txt", bytes: "Shift-JIS compatible metadata" },
  { path: "original/setup.exe", bytes: new Uint8Array([77, 90]) },
  { path: "../escape.fx", bytes: "unsafe" },
], { cryptoApi: webcrypto });
assert.equal(inspection.accepted.length, 3);
assert.equal(inspection.quarantined.length, 1, "executables are catalogued but never accepted");
assert.equal(inspection.rejected.some((entry) => entry.reason === "unsafe-path"), true);
assert.deepEqual(inspection.dependencies, ["shared/common.fxh"]);
assert.equal(inspection.dependencyReferences.length, 1);
assert.equal(inspection.dependencyReferences[0].resolved, "original/shared/common.fxh");
assert.equal(inspection.missingDependencies.length, 0);
assert.match(inspection.packageSha256, /^[a-f0-9]{64}$/);

let extensionRenderer = null;
const studioState = { mode: "original" };
const fakeStudio = {
  setLibraryExtension: (renderer) => { extensionRenderer = renderer; },
  getEffectTarget: () => ({ kind: "model", id: "fake-model", ref: studioState }),
  captureEffectState: () => ({ mode: studioState.mode }),
  restoreEffectState: (snapshot) => { studioState.mode = snapshot.mode; },
  applyEffectMode: (mode) => { studioState.mode = mode; },
};
const platform = createEffectsPlatform({ shaderStudio: fakeStudio }).mount();
assert.equal(typeof extensionRenderer, "function", "platform mounts inside the existing Shader Studio");
const builtIn = await platform.runtime.apply("animestage.material.mmd2", {
  owner: { kind: "editor", id: "shader-studio" },
  target: fakeStudio.getEffectTarget(),
});
assert.equal(studioState.mode, "mmd2", "built-in effects use the live Shader Studio bridge");
await platform.runtime.disable(builtIn);
assert.equal(studioState.mode, "original", "disabling restores the captured material state");

console.log("AnimaStage Effects Platform phase-1 contracts: PASS");
