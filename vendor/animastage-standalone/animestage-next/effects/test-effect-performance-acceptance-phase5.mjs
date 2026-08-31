import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { normalizeEffectManifest, EFFECT_MANIFEST_SCHEMA } from "./core/EffectManifest.js";
import { EffectsRegistry } from "./registry/EffectsRegistry.js";
import { EffectCompatibilityService, probeEffectRenderer } from "./compatibility/EffectCapabilityProbe.js";
import { EffectPassProfiler } from "./diagnostics/EffectPassProfiler.js";
import {
  compareEffectFrames,
  createEffectAcceptanceReport,
  digestEffectAcceptanceReport,
  signEffectAcceptanceReport,
  verifyEffectAcceptanceReport,
} from "./testing/EffectVisualAcceptance.js";

function manifest(id, { requirements = null, capabilities = ["feature-provided"], status = "RUNTIME_TESTED" } = {}) {
  return {
    schema: EFFECT_MANIFEST_SCHEMA,
    id,
    version: "1.0.0",
    name: id,
    author: { name: "Test" },
    kind: "post-process",
    status,
    renderers: ["webgl2"],
    languages: ["glsl"],
    capabilities,
    requirements,
    provenance: { sourceType: "test" },
  };
}

const normalized = normalizeEffectManifest(manifest("phase5.requirements", {
  requirements: { features: ["webgl2", "effect-composer"], limits: { maxTextureSize: 2048 }, policy: "disable" },
}));
assert.deepEqual(normalized.requirements.features, ["webgl2", "effect-composer"]);
assert.equal(normalized.requirements.limits.maxTextureSize, 2048);

const registry = new EffectsRegistry();
const supported = registry.register(normalized, { create: () => ({}) });
registry.register(manifest("phase5.safe-fallback"), { create: () => ({}) });
const fallbackSource = registry.register(manifest("phase5.needs-fallback", {
  requirements: { features: ["imaginary-gpu-feature"], fallbackEffect: "phase5.safe-fallback", policy: "fallback" },
}), { create: () => ({}) });

const context = Object.freeze({
  available: true,
  backend: "webgl2",
  device: Object.freeze({ vendor: "Test", renderer: "Fake GPU" }),
  features: Object.freeze(["webgl2", "effect-composer"]),
  languages: Object.freeze(["glsl"]),
  limits: Object.freeze({ maxTextureSize: 4096 }),
});
const adapter = { getCompatibilityContext: () => context };
const compatibility = new EffectCompatibilityService({ registry, adapter });
assert.equal(compatibility.evaluate(supported).compatible, true);
assert.equal(compatibility.evaluate(supported).missingFeatures.length, 0, "provided capabilities are not device requirements");
const resolution = compatibility.resolve(fallbackSource);
assert.equal(resolution.definition.manifest.id, "phase5.safe-fallback");
assert.equal(resolution.fallbackFrom, fallbackSource);

let clock = 0;
const extension = { TIME_ELAPSED_EXT: 0x88bf, GPU_DISJOINT_EXT: 0x8fbb };
const fakeGl = {
  QUERY_RESULT_AVAILABLE: 0x8867,
  QUERY_RESULT: 0x8866,
  createQuery: () => ({}),
  deleteQuery: () => {},
  beginQuery: () => {},
  endQuery: () => {},
  getExtension: (name) => name === "EXT_disjoint_timer_query_webgl2" ? extension : null,
  getQueryParameter: (_query, parameter) => parameter === 0x8867 ? true : 2_000_000,
  getParameter: (parameter) => parameter === extension.GPU_DISJOINT_EXT ? false : 0,
};
const fakeRenderer = { getContext: () => fakeGl };
const pass = { renders: 0, render() { this.renders++; } };
const profiler = new EffectPassProfiler({ now: () => clock++, warningAfterSamples: 1, sampleWindow: 16 });
assert.equal(profiler.instrumentPass("phase5.pass", pass, { budgetMs: 3 }), true);
pass.render(fakeRenderer);
pass.render(fakeRenderer);
const performanceReport = profiler.getReport();
assert.equal(pass.renders, 2);
assert.equal(performanceReport.instrumented, 1);
assert.equal(performanceReport.passes[0].gpu.samples, 1);
assert.equal(performanceReport.passes[0].gpu.averageMs, 2);
profiler.dispose();
assert.equal(pass.render === undefined, false, "original render method is restored");

const probed = probeEffectRenderer(fakeRenderer, { passIds: ["phase5.pass"] });
assert.equal(probed.available, true);
assert.equal(probed.features.includes("gpu-timer-query"), true);

const baseline = { width: 2, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255, 200, 210, 220, 255]) };
const identical = { width: 2, height: 1, data: new Uint8ClampedArray(baseline.data) };
const changed = { width: 2, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255, 10, 10, 10, 255]) };
assert.equal(compareEffectFrames(baseline, identical).passed, true);
assert.equal(compareEffectFrames(baseline, identical).psnr, Infinity);
const failedDiff = compareEffectFrames(baseline, changed, { allowedMismatchRatio: 0, minimumSsim: 0.999, createDiff: true });
assert.equal(failedDiff.passed, false);
assert.equal(failedDiff.mismatchedPixels, 1);
assert.equal(failedDiff.diff.data.length, 8);

const acceptance = createEffectAcceptanceReport({
  effect: { id: "raycast.ray-mmd.hdr-bloom", version: "1.5.2" },
  adapterVersion: "1.0.0",
  sourceRevision: "test-revision",
  device: { vendor: "Test", renderer: "Fake GPU", backend: "webgl2" },
  cases: [{ id: "still-1080p", renderer: "raster", resolution: "1920x1080", passed: true, metrics: { ssim: 1 } }],
});
const digestA = await digestEffectAcceptanceReport(acceptance, { cryptoApi: webcrypto });
const digestB = await digestEffectAcceptanceReport(acceptance, { cryptoApi: webcrypto });
assert.equal(digestA, digestB);
assert.match(digestA, /^[a-f0-9]{64}$/);
const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const signed = await signEffectAcceptanceReport(acceptance, keys.privateKey, { cryptoApi: webcrypto });
assert.equal(await verifyEffectAcceptanceReport(signed, keys.publicKey, { cryptoApi: webcrypto }), true);
assert.equal(await verifyEffectAcceptanceReport({ ...signed, adapterVersion: "tampered" }, keys.publicKey, { cryptoApi: webcrypto }), false);

console.log("AnimaStage Effects Platform phase-5 performance/acceptance contracts: PASS");
