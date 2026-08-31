import { CharsetEncoder } from "../vendor/three/examples/jsm/libs/mmdparser.module.js";

let unicodeToSjis = null;
function sjisMap() {
  if (unicodeToSjis) return unicodeToSjis;
  unicodeToSjis = new Map();
  for (const [encoded, unicode] of Object.entries(new CharsetEncoder().s2uTable)) if (!unicodeToSjis.has(unicode)) unicodeToSjis.set(unicode, Number(encoded));
  return unicodeToSjis;
}
function fixedSjis(text, length) {
  const output = new Uint8Array(length), map = sjisMap(); let offset = 0;
  for (const char of String(text || "")) {
    const code = map.get(char.charCodeAt(0)) ?? 0x3f, size = code > 0xff ? 2 : 1;
    if (offset + size > length) break;
    if (size === 2) output[offset++] = (code >> 8) & 0xff;
    output[offset++] = code & 0xff;
  }
  return output;
}
function interpolation64() {
  const bytes = new Uint8Array(64);
  for (let block = 0; block < 4; block++) for (let axis = 0; axis < 4; axis++) {
    const base = block * 16; bytes[base + axis] = 20; bytes[base + axis + 4] = 20; bytes[base + axis + 8] = 107; bytes[base + axis + 12] = 107;
  }
  return bytes;
}
function trackBoneIndex(name, mesh) {
  let match = String(name).match(/\.bones\[(\d+)\]\.quaternion$/); if (match) return Number(match[1]);
  match = String(name).match(/\.bones\[([^\]]+)\]\.quaternion$/); if (!match) return -1;
  return mesh.skeleton.bones.findIndex((bone) => bone.name === match[1]);
}
function trackMorphIndex(name) { const match = String(name).match(/\.morphTargetInfluences\[(\d+)\]$/); return match ? Number(match[1]) : -1; }

export function writeVmdFromClip(mesh, clip, options = {}) {
  if (!mesh?.skeleton || !clip?.tracks?.length) return null;
  const fps = 30, interpolation = interpolation64();
  const boneFrames = [], morphFrames = [], morphNames = [];
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary || {})) morphNames[index] = name;
  if (options.morphRegistry) {
    for (const record of options.morphRegistry.all()) {
      if (record.targetInfluenceIndex >= 0 && record.originalName) morphNames[record.targetInfluenceIndex] = record.originalName;
    }
  }
  for (const track of clip.tracks) {
    const boneIndex = trackBoneIndex(track.name, mesh), morphIndex = trackMorphIndex(track.name);
    if (boneIndex >= 0 && mesh.skeleton.bones[boneIndex]) {
      for (let i = 0; i < track.times.length; i++) {
        const o = i * 4, q = [track.values[o], track.values[o + 1], track.values[o + 2], track.values[o + 3]];
        boneFrames.push({ name: mesh.skeleton.bones[boneIndex].name, frame: Math.max(0, Math.round(track.times[i] * fps)), position: [0, 0, 0], rotation: [-q[0], -q[1], q[2], q[3]] });
      }
    } else if (morphIndex >= 0 && morphNames[morphIndex]) {
      for (let i = 0; i < track.times.length; i++) morphFrames.push({ name: morphNames[morphIndex], frame: Math.max(0, Math.round(track.times[i] * fps)), weight: Math.max(0, Math.min(1, Number(track.values[i]) || 0)) });
    }
  }
  boneFrames.sort((a, b) => a.frame - b.frame || a.name.localeCompare(b.name)); morphFrames.sort((a, b) => a.frame - b.frame || a.name.localeCompare(b.name));
  const size = 30 + 20 + 4 + boneFrames.length * 111 + 4 + morphFrames.length * 23 + 4;
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer); let offset = 0;
  const putBytes = (value) => { bytes.set(value, offset); offset += value.length; };
  putBytes(fixedSjis("Vocaloid Motion Data 0002", 30)); putBytes(fixedSjis(options.modelName || mesh.name || "AnimeStage", 20));
  view.setUint32(offset, boneFrames.length, true); offset += 4;
  for (const frame of boneFrames) {
    putBytes(fixedSjis(frame.name, 15)); view.setUint32(offset, frame.frame, true); offset += 4;
    for (const value of frame.position) { view.setFloat32(offset, value, true); offset += 4; }
    for (const value of frame.rotation) { view.setFloat32(offset, value, true); offset += 4; }
    putBytes(interpolation);
  }
  view.setUint32(offset, morphFrames.length, true); offset += 4;
  for (const frame of morphFrames) {
    putBytes(fixedSjis(frame.name, 15)); view.setUint32(offset, frame.frame, true); offset += 4; view.setFloat32(offset, frame.weight, true); offset += 4;
  }
  view.setUint32(offset, 0, true);
  return bytes;
}
