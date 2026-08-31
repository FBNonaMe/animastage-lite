import type { InstalledStylePack } from './types';
import { adaptMmdShaderBundle, isMmdShaderBundle } from './mmdShaderAdapter';
import {
  assertRequiredPackageFiles,
  findPackageFile,
  validateConfig,
  validateManifest,
  validateShaderSource,
} from './validate';

const MAX_PREVIEW_BYTES = 96_000;

async function readText(file: File): Promise<string> {
  return file.text();
}

async function readPreviewDataUrl(file: File): Promise<string | null> {
  if (file.size > MAX_PREVIEW_BYTES) return null;
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const b64 = btoa(binary);
    const mime = file.type || 'image/webp';
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function parseStylePackFiles(
  files: File[],
  sourceUrl?: string
): Promise<InstalledStylePack> {
  if (isMmdShaderBundle(files)) {
    return adaptMmdShaderBundle(files, sourceUrl);
  }

  assertRequiredPackageFiles(files);

  const manifestFile = findPackageFile(files, 'manifest.json')!;
  const configFile = findPackageFile(files, 'config.json')!;
  const vertFile = findPackageFile(files, 'shader.vert')!;
  const fragFile = findPackageFile(files, 'shader.frag')!;
  const previewFile = findPackageFile(files, 'preview.webp')!;

  let manifestRaw: unknown;
  let configRaw: unknown;
  try {
    manifestRaw = JSON.parse(await readText(manifestFile));
  } catch {
    throw new Error('manifest.json is not valid JSON.');
  }
  try {
    configRaw = JSON.parse(await readText(configFile));
  } catch {
    throw new Error('config.json is not valid JSON.');
  }

  const manifest = validateManifest(manifestRaw);
  const config = validateConfig(configRaw);

  const shaderVert = await readText(vertFile);
  const shaderFrag = await readText(fragFile);
  validateShaderSource(shaderVert, 'shader.vert');
  validateShaderSource(shaderFrag, 'shader.frag');

  const previewDataUrl = await readPreviewDataUrl(previewFile);

  return {
    manifest,
    config,
    previewDataUrl,
    shaderVert,
    shaderFrag,
    installedAt: Date.now(),
    sourceUrl,
  };
}
