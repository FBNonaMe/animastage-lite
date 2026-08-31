import { MMEFXSource } from "../../compiler/ShaderSource.js";
import { EffectPlatformError } from "../../core/EffectErrors.js";

const PARAMETER_TYPES = new Set([
  "bool", "int", "float", "float2", "float3", "float4", "float4x4",
  "matrix", "texture", "texture2d", "texturecube", "sampler", "sampler2d", "samplercube",
]);
const SUPPORTED_SEMANTICS = new Set([
  "WORLD", "VIEW", "PROJECTION", "WORLDVIEW", "VIEWPROJECTION", "WORLDVIEWPROJECTION",
  "TIME", "ELAPSEDTIME", "POSITION", "NORMAL", "TEXCOORD", "COLOR", "DIFFUSE", "SPECULAR",
]);
const PARTIAL_SEMANTICS = new Set(["CONTROLOBJECT", "MATERIALDIFFUSE", "MATERIALSPECULAR", "MATERIALAMBIENT"]);

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (value) => value.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (value) => " ".repeat(value.length));
}
function lineAt(text, index) { return text.slice(0, index).split("\n").length; }
function balancedBlock(text, openIndex) {
  let depth = 0;
  let quote = "";
  for (let index = openIndex; index < text.length; index++) {
    const character = text[index];
    if (quote) {
      if (character === "\\") index++;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === "{") depth++;
    else if (character === "}" && --depth === 0) return index;
  }
  return -1;
}
function freezeDeep(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}

/** Structural MME/FX inspection. It intentionally does not translate HLSL. */
export function parseMMEEffect(input, { id = "effect.fx" } = {}) {
  const source = input instanceof MMEFXSource ? input : new MMEFXSource({ id, text: String(input ?? "") });
  const text = stripComments(source.text);
  const diagnostics = [];
  const parameters = [];
  const semantics = new Set();
  const parameterPattern = /\b(bool|int|float(?:[234](?:x[234])?)?|matrix|texture(?:2d|cube)?|sampler(?:2d|cube)?)\s+([A-Za-z_]\w*)\s*(?::\s*([A-Za-z_]\w*))?\s*(?:<([\s\S]*?)>)?\s*(?:=\s*([^;]+))?;/gi;
  for (const match of text.matchAll(parameterPattern)) {
    const type = match[1].toLowerCase();
    if (!PARAMETER_TYPES.has(type)) continue;
    const semantic = String(match[3] || "").toUpperCase();
    if (semantic) semantics.add(semantic.replace(/\d+$/, ""));
    parameters.push({
      name: match[2], type, semantic: match[3] || "", annotations: String(match[4] || "").trim(),
      initializer: String(match[5] || "").trim(), line: lineAt(text, match.index),
    });
  }

  const techniques = [];
  const techniquePattern = /\btechnique(?:10|11)?\s+([A-Za-z_]\w*)\s*(?:<[\s\S]*?>\s*)?\{/gi;
  for (const match of text.matchAll(techniquePattern)) {
    const open = match.index + match[0].lastIndexOf("{");
    const close = balancedBlock(text, open);
    if (close < 0) {
      diagnostics.push({ severity: "error", code: "MME_UNCLOSED_TECHNIQUE", message: `Technique ${match[1]} has no closing brace`, line: lineAt(text, match.index) });
      continue;
    }
    const body = text.slice(open + 1, close);
    const passes = [];
    const passPattern = /\bpass\s+([A-Za-z_]\w*)\s*(?:<[\s\S]*?>\s*)?\{/gi;
    for (const passMatch of body.matchAll(passPattern)) {
      const passOpen = passMatch.index + passMatch[0].lastIndexOf("{");
      const passClose = balancedBlock(body, passOpen);
      const passBody = passClose < 0 ? "" : body.slice(passOpen + 1, passClose);
      passes.push({
        name: passMatch[1],
        line: lineAt(text, open + 1 + passMatch.index),
        vertexShader: /\bVertexShader\s*=|\bCompileShader\s*\(\s*vs_/i.test(passBody),
        pixelShader: /\bPixelShader\s*=|\bCompileShader\s*\(\s*ps_/i.test(passBody),
        renderStates: [...passBody.matchAll(/\b(AlphaBlendEnable|BlendOp|SrcBlend|DestBlend|ZEnable|ZWriteEnable|CullMode|FillMode)\s*=\s*([^;]+);/gi)]
          .map((state) => ({ name: state[1], value: state[2].trim() })),
      });
      if (passClose < 0) diagnostics.push({ severity: "error", code: "MME_UNCLOSED_PASS", message: `Pass ${passMatch[1]} has no closing brace`, line: lineAt(text, open + 1 + passMatch.index) });
    }
    techniques.push({ name: match[1], line: lineAt(text, match.index), passes });
  }

  const supported = [];
  const partial = [];
  const unsupported = [];
  if (parameters.some((item) => item.type.startsWith("texture"))) supported.push("textures");
  if (parameters.some((item) => item.type.startsWith("sampler"))) supported.push("samplers");
  if (techniques.some((item) => item.passes.length > 1)) supported.push("multi-pass structure");
  if (techniques.length) supported.push("techniques and passes");
  for (const semantic of semantics) {
    if (SUPPORTED_SEMANTICS.has(semantic)) supported.push(`semantic ${semantic}`);
    else if (PARTIAL_SEMANTICS.has(semantic)) partial.push(`semantic ${semantic}`);
    else unsupported.push(`semantic ${semantic}`);
  }
  if (/\b(ID3DXEffect|D3DX|tex2Dproj|texCUBEbias|register\s*\()/i.test(text)) unsupported.push("legacy DirectX runtime binding");
  if (/\bCONTROLOBJECT\b/i.test(text) && !partial.includes("semantic CONTROLOBJECT")) partial.push("CONTROLOBJECT annotations");
  if (/\bscript\s*=|\bMMDPass\b/i.test(text)) partial.push("MME script annotations");
  const total = supported.length + partial.length + unsupported.length;
  const compatibility = total ? Math.max(0, Math.min(100, Math.round((supported.length + partial.length * 0.5) / total * 100))) : 0;
  if (!techniques.length) diagnostics.push({ severity: "warning", code: "MME_NO_TECHNIQUE", message: "No FX technique block was found", line: 1 });
  if (!source.text.trim()) diagnostics.push({ severity: "error", code: "MME_EMPTY_SOURCE", message: "Effect source is empty", line: 1 });

  return freezeDeep({
    schema: "animestage.mme-inspection/v1",
    source: { id: source.id, cacheKey: source.cacheKey, lines: source.lineCount },
    includes: source.includes,
    parameters,
    techniques,
    semantics: [...semantics],
    compatibility: { percent: compatibility, supported: [...new Set(supported)], partial: [...new Set(partial)], unsupported: [...new Set(unsupported)] },
    diagnostics,
    executable: false,
    note: "Structural inspection only. HLSL/MME source requires an explicit reviewed backend adapter before execution.",
  });
}

export function assertMMEStructurallyValid(report) {
  if (!report || report.schema !== "animestage.mme-inspection/v1") throw new TypeError("MME compatibility report is required");
  const errors = report.diagnostics.filter((entry) => entry.severity === "error");
  if (errors.length) throw new EffectPlatformError(`MME source has ${errors.length} structural error(s)`, {
    code: "MME_STRUCTURE_INVALID", details: { diagnostics: errors },
  });
  return report;
}
