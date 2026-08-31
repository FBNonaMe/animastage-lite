const PARAM_ANNOTATION = /^\s*\/\/\s*@param\s+([A-Za-z_]\w*)\s+([\w<>]+)(.*)$/;

function cleanNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseOptions(text) {
  const result = {};
  const pattern = /([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s]+)/g;
  let match;
  while ((match = pattern.exec(text))) {
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

function parameterAnnotations(text) {
  const parameters = [];
  text.split("\n").forEach((line, index) => {
    const match = PARAM_ANNOTATION.exec(line);
    if (!match) return;
    const options = parseOptions(match[3]);
    parameters.push(Object.freeze({
      id: match[1],
      type: match[2],
      label: options.label || match[1],
      min: cleanNumber(options.min),
      max: cleanNumber(options.max),
      step: cleanNumber(options.step),
      default: options.default ?? null,
      line: index + 1,
      source: "annotation",
    }));
  });
  return parameters;
}

function unique(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const identity = key(item);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function reflectGLSL(text) {
  const bindings = [];
  const uniforms = [];
  const entries = [];
  const uniformPattern = /(?:layout\s*\(([^)]*)\)\s*)?uniform\s+([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(?:\s*\[\s*(\d+)\s*\])?\s*;/g;
  let match;
  while ((match = uniformPattern.exec(text))) {
    const line = text.slice(0, match.index).split("\n").length;
    const binding = /binding\s*=\s*(\d+)/.exec(match[1] || "");
    const record = Object.freeze({ name: match[3], type: match[2], arrayLength: Number(match[4]) || 1, line });
    uniforms.push(record);
    if (binding) bindings.push(Object.freeze({ group: 0, binding: Number(binding[1]), name: match[3], type: match[2], line }));
  }
  const entryPattern = /\bvoid\s+(main|[A-Za-z_]\w*)\s*\(/g;
  while ((match = entryPattern.exec(text))) entries.push(Object.freeze({ name: match[1], stage: "unknown", line: text.slice(0, match.index).split("\n").length }));
  return { uniforms, bindings, entries };
}

function reflectWGSL(text) {
  const bindings = [];
  const uniforms = [];
  const entries = [];
  const overrides = [];
  const bindingPattern = /@group\s*\(\s*(\d+)\s*\)\s*@binding\s*\(\s*(\d+)\s*\)\s*var(?:<([^>]+)>)?\s+([A-Za-z_]\w*)\s*:\s*([^;]+);/g;
  let match;
  while ((match = bindingPattern.exec(text))) {
    const line = text.slice(0, match.index).split("\n").length;
    const record = Object.freeze({ group: Number(match[1]), binding: Number(match[2]), addressSpace: match[3] || "handle", name: match[4], type: match[5].trim(), line });
    bindings.push(record);
    if ((match[3] || "").includes("uniform")) uniforms.push(Object.freeze({ name: match[4], type: match[5].trim(), arrayLength: 1, line }));
  }
  const entryPattern = /@(vertex|fragment|compute)(?:\s+@workgroup_size\s*\([^)]*\))?\s*fn\s+([A-Za-z_]\w*)\s*\(/g;
  while ((match = entryPattern.exec(text))) entries.push(Object.freeze({ stage: match[1], name: match[2], line: text.slice(0, match.index).split("\n").length }));
  const overridePattern = /\boverride\s+([A-Za-z_]\w*)\s*:\s*([^=;]+)(?:=\s*([^;]+))?;/g;
  while ((match = overridePattern.exec(text))) overrides.push(Object.freeze({ name: match[1], type: match[2].trim(), default: match[3]?.trim() ?? null, line: text.slice(0, match.index).split("\n").length }));
  return { uniforms, bindings, entries, overrides };
}

export function reflectShaderSource(source) {
  if (!source?.language || typeof source.text !== "string") throw new TypeError("Shader reflection requires a ShaderSource");
  const structural = source.language === "wgsl" ? reflectWGSL(source.text)
    : source.language === "glsl" ? reflectGLSL(source.text)
      : { uniforms: [], bindings: [], entries: [], overrides: [] };
  const parameters = unique([
    ...parameterAnnotations(source.text),
    ...structural.uniforms.map((uniform) => Object.freeze({ id: uniform.name, type: uniform.type, label: uniform.name, min: null, max: null, step: null, default: null, line: uniform.line, source: "uniform" })),
  ], (entry) => entry.id);
  return Object.freeze({
    schema: "animestage.shader-reflection/v1",
    sourceId: source.id,
    language: source.language,
    entryPoints: Object.freeze(structural.entries || []),
    bindings: Object.freeze(structural.bindings || []),
    uniforms: Object.freeze(structural.uniforms || []),
    overrides: Object.freeze(structural.overrides || []),
    parameters: Object.freeze(parameters),
  });
}
