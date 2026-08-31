/**
 * Parse .cube / .3dl LUT files into THREE.Data3DTexture for postprocessing LUT3DEffect.
 */
import * as THREE from 'three';

export type LutFileKind = 'cube' | '3dl';

export function detectLutFileKind(fileName: string): LutFileKind | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.cube')) return 'cube';
  if (lower.endsWith('.3dl')) return '3dl';
  return null;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function toByte(v: number): number {
  return Math.round(clamp01(v) * 255);
}

function buildData3DTexture(rgb: Float32Array, size: number): THREE.Data3DTexture {
  const data = new Uint8Array(size * size * size * 4);
  for (let i = 0; i < size * size * size; i++) {
    const o = i * 4;
    data[o] = toByte(rgb[i * 3]!);
    data[o + 1] = toByte(rgb[i * 3 + 1]!);
    data[o + 2] = toByte(rgb[i * 3 + 2]!);
    data[o + 3] = 255;
  }

  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function parseCubeLut(text: string): THREE.Data3DTexture {
  const lines = text.split(/\r?\n/);
  let size = 0;
  const values: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE')) continue;
    if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) continue;

    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = Number.parseInt(parts[1] ?? '', 10);
      continue;
    }

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 3) continue;
    const r = Number.parseFloat(parts[0]!);
    const g = Number.parseFloat(parts[1]!);
    const b = Number.parseFloat(parts[2]!);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    values.push(r, g, b);
  }

  if (!size || size < 2) {
    const inferred = Math.round(Math.cbrt(values.length / 3));
    size = inferred;
  }

  const expected = size * size * size * 3;
  if (values.length < expected) {
    throw new Error(`Invalid .cube LUT: expected ${size}^3 RGB triples, got ${values.length / 3}`);
  }

  return buildData3DTexture(new Float32Array(values.slice(0, expected)), size);
}

function parse3dlLut(text: string): THREE.Data3DTexture {
  const lines = text.split(/\r?\n/);
  let size = 33;
  const values: number[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.toLowerCase().startsWith('mesh')) {
      const parts = line.split(/\s+/);
      const meshSize = Number.parseInt(parts[parts.length - 1] ?? '', 10);
      if (meshSize >= 2) size = meshSize;
      continue;
    }

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 3) continue;
    const r = Number.parseFloat(parts[0]!);
    const g = Number.parseFloat(parts[1]!);
    const b = Number.parseFloat(parts[2]!);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;

    const scale = r > 1 || g > 1 || b > 1 ? 1 / 255 : 1;
    values.push(r * scale, g * scale, b * scale);
  }

  const expected = size * size * size * 3;
  if (values.length < expected) {
    const inferred = Math.round(Math.cbrt(values.length / 3));
    if (inferred >= 2) size = inferred;
  }

  const finalExpected = size * size * size * 3;
  if (values.length < finalExpected) {
    throw new Error(`Invalid .3dl LUT: expected ${size}^3 RGB triples, got ${values.length / 3}`);
  }

  return buildData3DTexture(new Float32Array(values.slice(0, finalExpected)), size);
}

export function parseLutText(text: string, kind: LutFileKind): THREE.Data3DTexture {
  return kind === 'cube' ? parseCubeLut(text) : parse3dlLut(text);
}

export async function parseLutFile(file: File): Promise<THREE.Data3DTexture> {
  const kind = detectLutFileKind(file.name);
  if (!kind) throw new Error('Unsupported LUT format — use .cube or .3dl');
  const text = await file.text();
  return parseLutText(text, kind);
}

export async function parseLutFromUrl(url: string, fileName: string): Promise<THREE.Data3DTexture> {
  const kind = detectLutFileKind(fileName);
  if (!kind) throw new Error('Unsupported LUT format — use .cube or .3dl');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`LUT fetch failed (${response.status})`);
  const text = await response.text();
  return parseLutText(text, kind);
}
