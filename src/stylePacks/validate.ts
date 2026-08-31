import type { CharacterQuality } from '../types';
import {
  COLOR_GRADES,
  LIGHT_PRESETS,
  SCENE_PRESETS,
} from '../visualFx/visualFxPresets';
import type {
  StylePackAppliedConfig,
  StylePackConfigFile,
  StylePackFxConfig,
  StylePackManifest,
} from './types';

const FX_KEYS = new Set([
  'bloomEnabled',
  'bloomIntensity',
  'bloomThreshold',
  'bloomRadius',
  'vignetteEnabled',
  'vignetteIntensity',
  'dofEnabled',
  'dofFocusDistance',
  'dofBokehScale',
  'chromaticAberration',
  'colorGrade',
  'scenePreset',
  'lightPreset',
  'particlesEnabled',
  'particlePreset',
  'particleIntensity',
  'environmentIntensity',
  'floorReflection',
  'aoIntensity',
  'toneExposure',
  'ssaoEnabled',
  'ssaoIntensity',
  'godRaysEnabled',
  'smaaEnabled',
  'materialDetailing',
  'materialSmoothing',
  'renderMode',
  'customLutUrl',
  'customLutName',
  'customLutIntensity',
  'customLutEnabled',
  'postFxStackOrder',
  'weatherPreset',
] as const);

const CHARACTER_QUALITIES = new Set<CharacterQuality>(['standard', 'hd', 'uhd4k']);

const REQUIRED_FILES = ['manifest.json', 'shader.vert', 'shader.frag', 'preview.webp', 'config.json'] as const;

export function parseStyleId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,48}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function validateManifest(raw: unknown): StylePackManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('manifest.json must be a JSON object.');
  }
  const m = raw as Record<string, unknown>;
  const id = parseStyleId(m.id);
  if (!id) throw new Error('manifest.json: "id" must be a short slug (letters, numbers, - or _).');
  const name = typeof m.name === 'string' ? m.name.trim() : '';
  if (!name) throw new Error('manifest.json: "name" is required.');
  const version = typeof m.version === 'string' ? m.version.trim() : '';
  if (!version) throw new Error('manifest.json: "version" is required.');

  return {
    id,
    name,
    version,
    author: typeof m.author === 'string' ? m.author.trim() : undefined,
    description: typeof m.description === 'string' ? m.description.trim() : undefined,
    updateUrl: typeof m.updateUrl === 'string' ? m.updateUrl.trim() : undefined,
    minAppVersion: typeof m.minAppVersion === 'string' ? m.minAppVersion.trim() : undefined,
  };
}

function pickFx(raw: Record<string, unknown>): StylePackFxConfig {
  const fx: StylePackFxConfig = {};
  for (const key of FX_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (key === 'colorGrade' && typeof value === 'string') {
      if (value in COLOR_GRADES) fx.colorGrade = value as StylePackFxConfig['colorGrade'];
      continue;
    }
    if (key === 'scenePreset' && typeof value === 'string') {
      if (value in SCENE_PRESETS) fx.scenePreset = value as StylePackFxConfig['scenePreset'];
      continue;
    }
    if (key === 'lightPreset' && typeof value === 'string') {
      if (value in LIGHT_PRESETS) fx.lightPreset = value as StylePackFxConfig['lightPreset'];
      continue;
    }
    if (typeof value === 'boolean') {
      (fx as Record<string, boolean>)[key] = value;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      (fx as Record<string, number>)[key] = value;
      continue;
    }
    if (typeof value === 'string' && (key === 'particlePreset' || key === 'weatherPreset')) {
      (fx as Record<string, string>)[key] = value;
    }
  }
  return fx;
}

export function validateConfig(raw: unknown): StylePackAppliedConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('config.json must be a JSON object.');
  }
  const obj = raw as StylePackConfigFile & Record<string, unknown>;
  const source = obj.fx && typeof obj.fx === 'object' ? (obj.fx as Record<string, unknown>) : obj;
  const fx = pickFx(source);

  let characterQuality: CharacterQuality | undefined;
  const cq = obj.characterQuality ?? source.characterQuality;
  if (typeof cq === 'string' && CHARACTER_QUALITIES.has(cq as CharacterQuality)) {
    characterQuality = cq as CharacterQuality;
  }

  return { fx, characterQuality };
}

export function validateShaderSource(text: string, label: string): void {
  const src = text.trim();
  if (!src) throw new Error(`${label} is empty.`);
  if (src.length > 120_000) throw new Error(`${label} is too large.`);
  if (!/void\s+main\s*\(/i.test(src)) {
    throw new Error(`${label} does not look like a valid shader (missing main).`);
  }
}

export function getPackageRelPath(file: File): string {
  const rel = (file as File & { _mmdRelativePath?: string })._mmdRelativePath;
  return (rel || file.name).replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
}

export function findPackageFile(files: File[], fileName: string): File | null {
  const target = fileName.toLowerCase();
  return (
    files.find((f) => {
      const rel = getPackageRelPath(f);
      return rel === target || rel.endsWith(`/${target}`);
    }) ?? null
  );
}

export function assertRequiredPackageFiles(files: File[]): void {
  const missing = REQUIRED_FILES.filter((name) => !findPackageFile(files, name));
  if (missing.length > 0) {
    throw new Error(`Style package is missing: ${missing.join(', ')}`);
  }
}

export function isStylePackBundle(files: File[]): boolean {
  if (
    Boolean(findPackageFile(files, 'manifest.json')) &&
    Boolean(findPackageFile(files, 'config.json')) &&
    Boolean(findPackageFile(files, 'shader.vert')) &&
    Boolean(findPackageFile(files, 'shader.frag'))
  ) {
    return true;
  }
  if (findPackageFile(files, 'ray.fx') || findPackageFile(files, 'ray.conf')) return true;
  if (findPackageFile(files, 'fx.fx')) return true;
  return files.some((f) => {
    const p = getPackageRelPath(f);
    return p.endsWith('.fx') || p.endsWith('.fxsub') || p.endsWith('.fxh');
  });
}

export function isNewerVersion(current: string, next: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.-]/)
      .map((part) => parseInt(part, 10) || 0);
  const a = parse(current);
  const b = parse(next);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}
