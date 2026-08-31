import assert from "node:assert/strict";
import { ShaderCompilationError } from "./core/EffectErrors.js";
import { EffectSourceWorkbench, ShaderCompilationService } from "./compiler/ShaderCompilationService.js";
import { createShaderSource } from "./compiler/ShaderSource.js";
import { reflectShaderSource } from "./reflection/ShaderReflection.js";
import { WebGPUShaderBackend } from "./renderers/webgpu/WebGPUShaderBackend.js";

const wgsl = createShaderSource({
  id: "tests/reflect.wgsl", language: "wgsl",
  text: `// @param exposure float min=0 max=4 default=1 label="Exposure"
struct Params { exposure: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@fragment fn main() -> @location(0) vec4f { return vec4f(params.exposure); }`,
});
const reflection = reflectShaderSource(wgsl);
assert.equal(reflection.entryPoints[0].stage, "fragment");
assert.equal(reflection.bindings[0].binding, 0);
assert.equal(reflection.parameters[0].label, "Exposure");
assert.equal(reflection.parameters.filter((entry) => entry.id === "params").length, 1);

let compiles = 0;
const fakeBackend = {
  id: "webgpu", revision: "test",
  async compile(source, options) {
    compiles++;
    if (source.text.includes("INVALID")) throw new ShaderCompilationError("synthetic failure", {
      backend: "webgpu", sourceId: source.id, stage: options.stage,
      diagnostics: [{ severity: "error", message: "invalid token", line: 2, column: 3 }],
    });
    return { backend: "webgpu", stage: options.stage, module: {}, isolated: true, diagnostics: [], dispose() {} };
  },
};
const compiler = new ShaderCompilationService({ backends: [fakeBackend], maxEntries: 2 });
const workbench = new EffectSourceWorkbench({ compiler });
const first = await workbench.stage(wgsl, { stage: "fragment" });
assert.equal(first.committed, true);
assert.equal(first.current.revision, 1);
const cached = await compiler.compile(wgsl, { stage: "fragment" });
assert.equal(cached.cacheHit, true);
assert.equal(compiles, 1);
const invalid = createShaderSource({ id: "tests/invalid.wgsl", language: "wgsl", text: "@fragment\nfn main() -> @location(0) vec4f { INVALID }" });
const rolledBack = await workbench.stage(invalid, { stage: "fragment" });
assert.equal(rolledBack.committed, false);
assert.equal(rolledBack.current.revision, 1);
assert.equal(rolledBack.error.diagnostics[0].line, 2);
assert.equal(compiler.stats.pinned, 1);

let adapterRequests = 0;
const fakeGpu = {
  async requestAdapter() {
    adapterRequests++;
    return {
      async requestDevice() {
        return {
          lost: new Promise(() => {}),
          createShaderModule({ code }) {
            return { async getCompilationInfo() { return { messages: code.includes("INVALID") ? [{ type: "error", message: "bad WGSL", lineNum: 2, linePos: 4 }] : [] }; } };
          },
        };
      },
    };
  },
};
const native = new WebGPUShaderBackend({ gpu: fakeGpu });
assert.equal(adapterRequests, 0, "WebGPU must initialize lazily");
const artifact = await native.compile(wgsl, { stage: "fragment" });
assert.equal(artifact.backend, "webgpu");
assert.equal(adapterRequests, 1);
await assert.rejects(() => native.compile(invalid, { stage: "fragment" }), (error) => error instanceof ShaderCompilationError && error.diagnostics[0].column === 4);
assert.equal(adapterRequests, 1, "device must be reused");

console.log("Effect shader compiler/backends phase 7: PASS");
