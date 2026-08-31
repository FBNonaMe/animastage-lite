import { EffectManifestError } from "../core/EffectErrors.js";
import { parseSemver } from "../core/EffectManifest.js";

export const EFFECT_STACK_SCHEMA = "animestage.effect-stack/v1";
export const EFFECT_STACK_PRESET_SCHEMA = "animestage.effect-stack-preset/v1";

function plain(value) { return value != null && typeof value === "object" && !Array.isArray(value); }
function freezeDeep(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}
function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new EffectManifestError(`${field} must be a non-empty string`);
  return value.trim();
}
function identity(value, field) {
  if (!plain(value)) throw new EffectManifestError(`${field} must be an object`);
  return { kind: requiredString(value.kind, `${field}.kind`), id: requiredString(value.id, `${field}.id`) };
}

function stablePresetId(stack) {
  const canonicalize = (value) => {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  };
  const canonical = canonicalize(stack);
  let hash = 2166136261;
  for (let index = 0; index < canonical.length; index++) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `preset-${hash.toString(16).padStart(8, "0")}`;
}

export function normalizeEffectStackSnapshot(input) {
  if (!plain(input) || input.schema !== EFFECT_STACK_SCHEMA) {
    throw new EffectManifestError(`Effect stack must use schema ${EFFECT_STACK_SCHEMA}`);
  }
  if (!Array.isArray(input.entries)) throw new EffectManifestError("effect stack entries must be an array");
  const seen = new Set();
  const entries = input.entries.map((entry, index) => {
    const field = `entries[${index}]`;
    if (!plain(entry)) throw new EffectManifestError(`${field} must be an object`);
    const stackEntryId = requiredString(entry.stackEntryId, `${field}.stackEntryId`);
    if (seen.has(stackEntryId)) throw new EffectManifestError(`Duplicate stack entry ID "${stackEntryId}"`);
    seen.add(stackEntryId);
    if (!plain(entry.effect)) throw new EffectManifestError(`${field}.effect must be an object`);
    const effect = {
      id: requiredString(entry.effect.id, `${field}.effect.id`).toLowerCase(),
      version: requiredString(entry.effect.version, `${field}.effect.version`),
    };
    if (!parseSemver(effect.version)) throw new EffectManifestError(`${field}.effect.version must be semantic version`);
    if (entry.parameters != null && !plain(entry.parameters)) throw new EffectManifestError(`${field}.parameters must be an object`);
    return {
      stackEntryId,
      effect,
      owner: identity(entry.owner, `${field}.owner`),
      target: identity(entry.target, `${field}.target`),
      parameters: { ...(entry.parameters || {}) },
      enabled: entry.enabled !== false,
      label: typeof entry.label === "string" ? entry.label.trim() : "",
    };
  });
  return freezeDeep({ schema: EFFECT_STACK_SCHEMA, entries });
}

export function createEffectStackPreset(stackSnapshot, {
  id = null,
  name = "Untitled Effect Stack",
  description = "",
  author = "AnimaStage user",
} = {}) {
  const stack = normalizeEffectStackSnapshot(stackSnapshot);
  return freezeDeep({
    schema: EFFECT_STACK_PRESET_SCHEMA,
    id: requiredString(id || stablePresetId(stack), "preset.id"),
    name: requiredString(name, "preset.name"),
    description: String(description || ""),
    author: requiredString(author, "preset.author"),
    stack,
  });
}

export function normalizeEffectStackPreset(input) {
  if (!plain(input) || input.schema !== EFFECT_STACK_PRESET_SCHEMA) {
    throw new EffectManifestError(`Effect preset must use schema ${EFFECT_STACK_PRESET_SCHEMA}`);
  }
  return createEffectStackPreset(input.stack, {
    id: input.id,
    name: input.name,
    description: input.description,
    author: input.author,
  });
}

export function serializeEffectStackPreset(preset, spacing = 2) {
  return `${JSON.stringify(normalizeEffectStackPreset(preset), null, spacing)}\n`;
}

export function parseEffectStackPreset(text) {
  let parsed;
  try { parsed = JSON.parse(String(text)); }
  catch (cause) { throw new EffectManifestError(`Effect preset JSON is invalid: ${cause.message}`); }
  return normalizeEffectStackPreset(parsed);
}
