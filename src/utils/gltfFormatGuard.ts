/**
 * Probe glTF / GLB headers so we can reject legacy GLB 1.0 with a clear message.
 * Three.js GLTFLoader only supports glTF 2.0+.
 */

const GLB_MAGIC = 0x46546c67; // 'glTF'

export type GltfProbeResult =
  | { kind: 'glb'; version: number; length: number }
  | { kind: 'gltf-json' }
  | { kind: 'unknown' };

export function probeGltfBinaryHeader(buffer: ArrayBuffer): GltfProbeResult {
  if (buffer.byteLength < 12) return { kind: 'unknown' };
  const view = new DataView(buffer);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    // JSON glTF usually starts with '{'
    const head = new TextDecoder().decode(buffer.slice(0, Math.min(32, buffer.byteLength))).trimStart();
    if (head.startsWith('{') || head.startsWith('[')) return { kind: 'gltf-json' };
    return { kind: 'unknown' };
  }
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  return { kind: 'glb', version, length };
}

export function humanizeGltfLoadError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err ?? 'GLTF load failed');

  if (/Legacy binary file detected/i.test(raw) || /version < 2/i.test(raw)) {
    return new Error(
      'This GLB is glTF 1.0 (legacy). AnimaStage needs glTF 2.0. Re-export as GLB 2.0 from Blender (File → Export → glTF 2.0), or convert at https://gltf.report / gltf-pipeline.'
    );
  }
  if (/Unsupported glTF-Binary header/i.test(raw)) {
    return new Error(
      'File looks damaged or is not a real GLB. Try re-exporting as .glb (glTF 2.0) or use .fbx / .pmx.'
    );
  }
  if (/Unexpected token|JSON/i.test(raw) && /gltf/i.test(raw)) {
    return new Error(
      'Invalid glTF JSON. If this came from a ZIP, make sure .bin and textures are included.'
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

export async function assertGltf2Compatible(fetchUrl: string): Promise<void> {
  const res = await fetch(fetchUrl);
  if (!res.ok) {
    throw new Error(`Could not fetch model (${res.status})`);
  }
  // Only need the header for GLB; for large files Range would be nicer but blob URLs may not support it.
  const buf = await res.arrayBuffer();
  const probe = probeGltfBinaryHeader(buf);
  if (probe.kind === 'glb' && probe.version < 2) {
    throw humanizeGltfLoadError(
      new Error('THREE.GLTFLoader: Legacy binary file detected.')
    );
  }
}
