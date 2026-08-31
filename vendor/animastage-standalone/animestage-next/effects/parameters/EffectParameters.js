import { EffectManifestError } from "../core/EffectErrors.js";

export const EFFECT_PARAMETER_TYPES = Object.freeze([
  "float",
  "int",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "color",
  "enum",
  "texture",
  "cubemap",
  "curve",
  "range",
  "angle",
  "matrix",
]);

const PARAMETER_ID = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new EffectManifestError(`${field} must be a finite number`, { field, value });
  return number;
}

function freezeDeep(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}

function normalizeOption(option, field) {
  const value = isPlainObject(option) ? option.value : option;
  if (typeof value !== "string" && typeof value !== "number") {
    throw new EffectManifestError(`${field}.value must be a string or number`, { field, value });
  }
  return Object.freeze({
    value,
    label: isPlainObject(option) && typeof option.label === "string" ? option.label : String(value),
  });
}

function vector(value, length, field) {
  if (!Array.isArray(value) || value.length !== length) {
    throw new EffectManifestError(`${field} must contain ${length} numbers`, { field, value });
  }
  return Object.freeze(value.map((entry, index) => finiteNumber(entry, `${field}[${index}]`)));
}

function normalizeValue(definition, value, field) {
  const type = definition.type;
  if (type === "float" || type === "angle" || type === "int") {
    let number = finiteNumber(value, field);
    if (definition.min != null && number < definition.min) {
      throw new EffectManifestError(`${field} is below ${definition.min}`, { field, value: number });
    }
    if (definition.max != null && number > definition.max) {
      throw new EffectManifestError(`${field} is above ${definition.max}`, { field, value: number });
    }
    if (type === "int") number = Math.round(number);
    return number;
  }
  if (type === "bool") {
    if (typeof value !== "boolean") throw new EffectManifestError(`${field} must be boolean`, { field, value });
    return value;
  }
  if (type.startsWith("vec")) return vector(value, Number(type.slice(3)), field);
  if (type === "range") {
    const result = vector(value, 2, field);
    if (result[0] > result[1]) throw new EffectManifestError(`${field} minimum cannot exceed maximum`, { field, value });
    return result;
  }
  if (type === "matrix") return vector(value, definition.size, field);
  if (type === "color") {
    if (typeof value === "string" && /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value)) return value.toLowerCase();
    if (Array.isArray(value) && (value.length === 3 || value.length === 4)) return vector(value, value.length, field);
    throw new EffectManifestError(`${field} must be #RRGGBB, #RRGGBBAA, RGB, or RGBA`, { field, value });
  }
  if (type === "enum") {
    if (!definition.options.some((option) => Object.is(option.value, value))) {
      throw new EffectManifestError(`${field} is not an allowed enum value`, { field, value });
    }
    return value;
  }
  if (type === "texture" || type === "cubemap") {
    if (value == null || typeof value === "string") return value ?? null;
    throw new EffectManifestError(`${field} must be a package resource path or null`, { field, value });
  }
  if (type === "curve") {
    if (!Array.isArray(value)) throw new EffectManifestError(`${field} must be an array of [time, value] points`);
    return Object.freeze(value.map((point, index) => vector(point, 2, `${field}[${index}]`)));
  }
  throw new EffectManifestError(`Unsupported parameter type "${type}"`, { field, type });
}

export function normalizeEffectParameterDefinitions(input) {
  if (input == null) return Object.freeze([]);
  if (!Array.isArray(input)) throw new EffectManifestError("parameters must be an array");
  const seen = new Set();
  const definitions = input.map((entry, index) => {
    if (!isPlainObject(entry)) throw new EffectManifestError(`parameters[${index}] must be an object`);
    const id = String(entry.id || "").trim();
    if (!PARAMETER_ID.test(id)) throw new EffectManifestError(`Invalid parameter ID "${id}"`, { index, id });
    if (seen.has(id)) throw new EffectManifestError(`Duplicate parameter ID "${id}"`, { id });
    seen.add(id);
    const type = String(entry.type || "float").toLowerCase();
    if (!EFFECT_PARAMETER_TYPES.includes(type)) throw new EffectManifestError(`Unknown parameter type "${type}"`, { id, type });
    const definition = {
      id,
      type,
      label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : id,
      description: typeof entry.description === "string" ? entry.description.trim() : "",
      group: typeof entry.group === "string" ? entry.group.trim() : "",
      unit: typeof entry.unit === "string" ? entry.unit.trim() : "",
      min: entry.min == null ? null : finiteNumber(entry.min, `parameters[${index}].min`),
      max: entry.max == null ? null : finiteNumber(entry.max, `parameters[${index}].max`),
      step: entry.step == null ? null : finiteNumber(entry.step, `parameters[${index}].step`),
      size: type === "matrix" ? (entry.size === 9 ? 9 : 16) : null,
      options: type === "enum"
        ? Object.freeze((entry.options || []).map((option, optionIndex) => normalizeOption(option, `parameters[${index}].options[${optionIndex}]`)))
        : Object.freeze([]),
    };
    if (type === "enum" && !definition.options.length) {
      throw new EffectManifestError(`Enum parameter "${id}" requires options`, { id });
    }
    if (definition.min != null && definition.max != null && definition.min > definition.max) {
      throw new EffectManifestError(`Parameter "${id}" min cannot exceed max`, { id });
    }
    const fallback = type === "bool" ? false
      : type === "enum" ? definition.options[0].value
        : type === "color" ? "#ffffff"
          : type === "texture" || type === "cubemap" ? null
            : type === "curve" ? []
              : type === "range" ? [definition.min ?? 0, definition.max ?? 1]
                : type.startsWith("vec") ? Array(Number(type.slice(3))).fill(0)
                  : type === "matrix" ? Array(definition.size).fill(0).map((_, i) => i % (Math.sqrt(definition.size) + 1) === 0 ? 1 : 0)
                    : 0;
    definition.default = normalizeValue(definition, entry.default ?? fallback, `parameters[${index}].default`);
    return freezeDeep(definition);
  });
  return Object.freeze(definitions);
}

export function effectParameterDefaults(definitions) {
  return freezeDeep(Object.fromEntries((definitions || []).map((definition) => [definition.id, definition.default])));
}

export function normalizeEffectParameterValues(definitions, input = {}, { partial = false, base = null } = {}) {
  if (!isPlainObject(input)) throw new EffectManifestError("Effect parameter values must be an object");
  const table = new Map((definitions || []).map((definition) => [definition.id, definition]));
  for (const id of Object.keys(input)) {
    if (!table.has(id)) throw new EffectManifestError(`Unknown effect parameter "${id}"`, { id });
  }
  const result = partial
    ? { ...(base || effectParameterDefaults(definitions)) }
    : { ...effectParameterDefaults(definitions) };
  for (const [id, value] of Object.entries(input)) result[id] = normalizeValue(table.get(id), value, `parameters.${id}`);
  return freezeDeep(result);
}
