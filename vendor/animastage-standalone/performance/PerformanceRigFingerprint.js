import { normalizePerformanceName } from "./PerformanceNameNormalizer.js";

function fnv1a(text, seed = 0x811c9dc5) {
  let hash = seed >>> 0;
  for (const char of text) {
    const cp = char.codePointAt(0) || 0;
    hash ^= cp & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= (cp >>> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    if (cp > 0xffff) {
      hash ^= (cp >>> 16) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

function orderedMorphNames(mesh) {
  const dictionary = mesh?.morphTargetDictionary || {};
  return Object.entries(dictionary)
    .sort((a, b) => Number(a[1]) - Number(b[1]) || a[0].localeCompare(b[0]))
    .map(([name, index]) => `${index}:${normalizePerformanceName(name)}`);
}

/** Stable across sessions and independent of Three.js UUIDs and file paths. */
export function createPerformanceRigFingerprint(mesh) {
  const bones = mesh?.skeleton?.bones || [];
  const indexOf = new Map();
  for (let i = 0; i < bones.length; i++) indexOf.set(bones[i], i);
  const parts = [`b:${bones.length}`, `v:${mesh?.geometry?.attributes?.position?.count || 0}`];
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const parent = bone?.parent?.isBone ? (indexOf.get(bone.parent) ?? -1) : -1;
    const px = Number(bone?.position?.x || 0).toFixed(5);
    const py = Number(bone?.position?.y || 0).toFixed(5);
    const pz = Number(bone?.position?.z || 0).toFixed(5);
    parts.push(`${i}:${parent}:${normalizePerformanceName(bone?.name)}:${px},${py},${pz}`);
  }
  parts.push(`m:${orderedMorphNames(mesh).join("|")}`);
  const payload = parts.join(";");
  const a = fnv1a(payload, 0x811c9dc5).toString(16).padStart(8, "0");
  const b = fnv1a(payload, 0x9e3779b9).toString(16).padStart(8, "0");
  return `mmd-performance-v1-${a}${b}`;
}

