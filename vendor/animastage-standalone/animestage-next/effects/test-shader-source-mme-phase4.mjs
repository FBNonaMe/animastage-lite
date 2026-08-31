import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GLSLSource, MMEFXSource, WGSLSource, createShaderSource,
} from "./compiler/ShaderSource.js";
import { assertMMEStructurallyValid, parseMMEEffect } from "./compatibility/mme/MMEEffectParser.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const glsl = new GLSLSource({ id: "shader/main.glsl", text: "#include \"common.glsl\"\nvoid main(){}" });
const resolved = glsl.resolveIncludes((id) => id === "shader/common.glsl" ? "vec3 tone(vec3 x){return x;}" : null);
assert.match(resolved.source.text, /vec3 tone/);
assert.equal(resolved.dependencies[0], "shader/common.glsl");
assert.equal(resolved.sourceMap.at(-1).sourceId, "shader/main.glsl");
assert.ok(createShaderSource({ id: "main.wgsl", language: "wgsl", text: "@compute @workgroup_size(1) fn main() {}" }) instanceof WGSLSource);
assert.throws(() => new GLSLSource({ id: "../escape.glsl", text: "" }), /package-relative/);
assert.throws(() => glsl.resolveIncludes(() => null), /Missing shader include/);

const cycleA = new GLSLSource({ id: "a.glsl", text: "#include \"b.glsl\"" });
const cycleB = new GLSLSource({ id: "b.glsl", text: "#include \"a.glsl\"" });
assert.throws(() => cycleA.resolveIncludes((id) => id === "a.glsl" ? cycleA : cycleB), /include cycle/);

const fixture = `
float4x4 WorldViewProj : WORLDVIEWPROJECTION;
texture2D ColorTexture;
float Control < string UIName = "Control"; > = 1.0;
technique MainTechnique {
  pass MainPass {
    AlphaBlendEnable = TRUE;
    VertexShader = compile vs_3_0 VSMain();
    PixelShader = compile ps_3_0 PSMain();
  }
}
`;
const report = parseMMEEffect(new MMEFXSource({ id: "fixture.fx", text: fixture }));
assert.equal(report.techniques[0].passes[0].name, "MainPass");
assert.ok(report.parameters.some((item) => item.name === "WorldViewProj"));
assert.ok(report.compatibility.supported.includes("techniques and passes"));
assert.equal(report.executable, false);
assertMMEStructurallyValid(report);

const rayFile = `${root}\\assets\\effects-library\\third-party\\ray-cast\\ray-mmd\\1.5.2\\original\\ray-mmd-1.5.2\\Extension\\DummyScreen\\DummyScreen.fx`;
const rayReport = parseMMEEffect(fs.readFileSync(rayFile, "utf8"), { id: "ray-mmd/Extension/DummyScreen/DummyScreen.fx" });
assert.ok(rayReport.techniques.length >= 1, "real preserved Ray-MMD source must be structurally indexed");
assert.ok(rayReport.source.lines > 10);

console.log("AnimaStage ShaderSource + MME inspection contracts: PASS");
