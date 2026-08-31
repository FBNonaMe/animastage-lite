import { applyLookPreset, DEFAULT_VISUAL_FX } from '../visualFx/visualFxPresets';
import type { StylePackAppliedConfig, StylePackFxConfig, InstalledStylePack } from './types';
import { findPackageFile, getPackageRelPath } from './validate';

export type MmdShaderKind = 'ray-mmd' | 'plugin-shader' | 'generic-mme';

export interface MmdShaderAdaptationInfo {
  kind: MmdShaderKind;
  variant?: string;
  sourceLabel: string;
  /** Original MMD files detected (for diagnostics). */
  detectedFiles: string[];
  /** Human-readable note shown in manifest description. */
  note: string;
}

const MINIMAL_VERT = `#version 300 es
// MMD shader placeholder — native HLSL (.fx) is adapted to AnimaStage post-FX.
void main() {
  gl_Position = vec4(0.0);
}
`;

const MINIMAL_FRAG = `#version 300 es
precision mediump float;
// MMD shader placeholder — see config.json for applied look.
void main() {
  gl_FragColor = vec4(1.0);
}
`;

export function detectMmdShaderKind(files: File[]): MmdShaderKind | null {
  if (
    findPackageFile(files, 'ray.fx') ||
    findPackageFile(files, 'ray.conf') ||
    findPackageFile(files, 'ray_advanced.conf')
  ) {
    return 'ray-mmd';
  }
  if (findPackageFile(files, 'fx.fx')) {
    return 'plugin-shader';
  }
  const paths = files.map((f) => getPackageRelPath(f));
  if (paths.some((p) => p.endsWith('.fx'))) {
    if (paths.some((p) => /plug-?in|plugin/i.test(p))) return 'plugin-shader';
    return 'generic-mme';
  }
  if (paths.some((p) => p.endsWith('.fxsub') || p.endsWith('.fxh'))) {
    if (paths.some((p) => /plug-?in|plugin/i.test(p))) return 'plugin-shader';
    if (paths.some((p) => p.includes('ray-mmd') || p.includes('ray/'))) return 'ray-mmd';
    return 'generic-mme';
  }
  return null;
}

export function isMmdShaderBundle(files: File[]): boolean {
  return detectMmdShaderKind(files) !== null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'mmd-shader';
}

function detectVariantLabel(files: File[]): string | undefined {
  for (const f of files) {
    const path = getPackageRelPath(f);
    const match = path.match(
      /(original|eye|glitter|hair.?layer|aniso|ibl|sss|alpha|pointlight)/i
    );
    if (match) return match[1]!.toLowerCase().replace(/\s+/g, '-');
  }
  return undefined;
}

function parseRayConfDefines(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/#define\s+(\w+)\s+(-?\d+(?:\.\d+)?)/);
    if (m) out[m[1]!] = Number(m[2]);
  }
  return out;
}

function tonemapToColorGrade(op: number): StylePackFxConfig['colorGrade'] {
  if (op === 5) return 'cinematic';
  if (op === 6) return 'warm';
  if (op === 1 || op === 2) return 'neutral';
  if (op === 4) return 'cold';
  return 'neutral';
}

function bloomFromMode(mode: number): { enabled: boolean; intensity: number; threshold: number } {
  if (mode <= 0) return { enabled: false, intensity: 0.35, threshold: 0.65 };
  const intensity = mode >= 4 ? 0.52 : mode >= 3 ? 0.45 : 0.38;
  const threshold = mode >= 4 ? 0.5 : 0.58;
  return { enabled: true, intensity, threshold };
}

function mapRayConfToFx(def: Record<string, number>): StylePackFxConfig {
  const bloom = bloomFromMode(def.HDR_BLOOM_MODE ?? 0);
  const ssdo = def.SSDO_QUALITY ?? 0;
  const ssr = def.SSR_QUALITY ?? 0;
  const ssss = def.SSSS_QUALITY ?? 0;
  const toon = def.TOON_ENABLE ?? 0;
  const fog = def.FOG_ENABLE ?? 0;
  const tonemap = def.HDR_TONEMAP_OPERATOR ?? 4;
  const dispersion = def.POST_DISPERSION_MODE ?? 0;
  const aa = def.AA_QUALITY ?? 0;
  const ibl = def.IBL_QUALITY ?? 0;
  const flare = def.HDR_FLARE_MODE ?? 0;
  const star = def.HDR_STAR_MODE ?? 0;

  const fx: StylePackFxConfig = {
    postFxStackEnabled: true,
    bloomEnabled: bloom.enabled,
    bloomIntensity: bloom.intensity,
    bloomThreshold: bloom.threshold,
    bloomRadius: bloom.enabled ? 0.42 : undefined,
    dofEnabled: (def.BOKEH_QUALITY ?? 0) > 0,
    dofBokehScale: 2.85,
    dofFocusDistance: 0.022,
    vignetteEnabled: tonemap === 6,
    vignetteIntensity: 0.35,
    ssaoEnabled: ssdo > 0,
    ssaoIntensity: Math.min(2.2, 0.55 + ssdo * 0.22),
    smaaEnabled: aa >= 2,
    chromaticAberration: dispersion >= 2 ? 0.014 : dispersion === 1 ? 0.005 : 0,
    environmentIntensity: ibl > 0 ? 1.08 : 0.88,
    floorReflection: ssr > 0 ? Math.min(0.92, 0.68 + ssr * 0.06) : 0.62,
    aoIntensity: ssdo > 0 ? 3.6 + ssdo * 0.15 : 2.8,
    materialDetailing: true,
    materialSmoothing: ssss > 0 ? 0.62 : 0.48,
    scenePreset: fog > 0 ? 'dawn' : 'studio',
    lightPreset: 'natural',
    colorGrade: tonemapToColorGrade(tonemap),
    toneExposure: tonemap === 5 ? 0.92 : tonemap === 6 ? 1.05 : 1.0,
    godRaysEnabled: flare > 0 || star > 0,
    godRaysDensity: flare > 0 || star > 0 ? 0.55 : undefined,
    particlesEnabled: false,
  };

  if (toon > 0) {
    fx.colorGrade = 'anime';
    fx.bloomIntensity = Math.max(fx.bloomIntensity ?? 0.4, 0.5);
    fx.scenePreset = 'studio';
    fx.lightPreset = 'anime';
  }

  return fx;
}

function mapPluginShaderToFx(variant?: string): StylePackFxConfig {
  const anime = applyLookPreset('anime');
  const base: StylePackFxConfig = {
    bloomEnabled: anime.bloomEnabled,
    bloomIntensity: anime.bloomIntensity,
    bloomThreshold: anime.bloomThreshold,
    bloomRadius: anime.bloomRadius,
    vignetteEnabled: anime.vignetteEnabled,
    vignetteIntensity: anime.vignetteIntensity,
    dofEnabled: anime.dofEnabled,
    dofFocusDistance: anime.dofFocusDistance,
    dofBokehScale: anime.dofBokehScale,
    chromaticAberration: anime.chromaticAberration,
    colorGrade: anime.colorGrade,
    scenePreset: anime.scenePreset,
    lightPreset: anime.lightPreset,
    particlesEnabled: anime.particlesEnabled,
    particlePreset: anime.particlePreset,
    particleIntensity: anime.particleIntensity,
    environmentIntensity: anime.environmentIntensity,
    floorReflection: anime.floorReflection,
    aoIntensity: anime.aoIntensity,
    toneExposure: anime.toneExposure,
    ssaoEnabled: anime.ssaoEnabled,
    ssaoIntensity: anime.ssaoIntensity,
    materialDetailing: true,
    materialSmoothing: 0.58,
    postFxStackEnabled: true,
  };

  if (variant === 'eye') {
    base.dofEnabled = true;
    base.dofFocusDistance = 0.018;
    base.bloomIntensity = (base.bloomIntensity ?? 0.45) * 0.85;
  } else if (variant === 'glitter') {
    base.particlesEnabled = true;
    base.particlePreset = 'sparkles';
    base.particleIntensity = 0.75;
    base.bloomIntensity = (base.bloomIntensity ?? 0.45) * 1.15;
  } else if (variant === 'hair-layer' || variant === 'hairlayer') {
    base.materialSmoothing = 0.68;
    base.aoIntensity = (base.aoIntensity ?? 3) * 1.1;
  }

  return base;
}

function mapGenericMmeToFx(): StylePackFxConfig {
  return {
    ...DEFAULT_VISUAL_FX,
    postFxStackEnabled: true,
    bloomEnabled: true,
    bloomIntensity: 0.4,
    bloomThreshold: 0.58,
    ssaoEnabled: true,
    ssaoIntensity: 1.0,
    materialDetailing: true,
    materialSmoothing: 0.52,
    scenePreset: 'studio',
    lightPreset: 'natural',
    colorGrade: 'neutral',
    environmentIntensity: 0.95,
    floorReflection: 0.7,
  };
}

async function readOptionalText(files: File[], name: string): Promise<string | null> {
  const file = findPackageFile(files, name);
  if (!file) return null;
  try {
    return await file.text();
  } catch {
    return null;
  }
}

async function previewFromMmdFiles(files: File[]): Promise<string | null> {
  const images = files.filter((f) => {
    const p = getPackageRelPath(f);
    if (f.size > 96_000) return false;
    return /\.(webp|png|jpg|jpeg)$/i.test(p);
  });

  const score = (f: File) => {
    const p = getPackageRelPath(f);
    if (/preview|hanrei|thumb/i.test(p)) return 0;
    if (/grad\.png/i.test(p)) return 1;
    return 2;
  };

  images.sort((a, b) => score(a) - score(b));
  const pick = images[0];
  if (!pick) return null;

  try {
    const buf = await pick.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const ext = getPackageRelPath(pick).split('.').pop()?.toLowerCase() ?? 'png';
    const mime =
      ext === 'webp' ? 'image/webp' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function buildAdaptationInfo(
  kind: MmdShaderKind,
  files: File[],
  variant?: string
): MmdShaderAdaptationInfo {
  const detected = files
    .filter((f) => /\.(fx|fxsub|fxh|conf|x)$/i.test(getPackageRelPath(f)))
    .map((f) => getPackageRelPath(f))
    .slice(0, 12);

  const labels: Record<MmdShaderKind, string> = {
    'ray-mmd': 'Ray-MMD',
    'plugin-shader': 'Plug-In Shader',
    'generic-mme': 'MME Effect',
  };

  return {
    kind,
    variant,
    sourceLabel: labels[kind],
    detectedFiles: detected,
    note:
      'MMD DirectX shaders (.fx) are adapted to AnimaStage WebGL post-processing. For full quality use the original pack in desktop MMD + MME.',
  };
}

/** Convert Ray-MMD / Plug-In Shader / generic MME ZIP into an AnimaStage style pack. */
export async function adaptMmdShaderBundle(
  files: File[],
  sourceUrl?: string
): Promise<InstalledStylePack> {
  const kind = detectMmdShaderKind(files);
  if (!kind) {
    throw new Error(
      'No MMD shader detected. Expected ray.fx, ray.conf, FX.fx, or another .fx effect file.'
    );
  }

  const variant = detectVariantLabel(files);
  const adaptation = buildAdaptationInfo(kind, files, variant);

  let config: StylePackAppliedConfig;
  let packId: string;
  let packName: string;
  let author: string;

  if (kind === 'ray-mmd') {
    const confText = await readOptionalText(files, 'ray.conf');
    const def = confText ? parseRayConfDefines(confText) : {};
    config = { fx: mapRayConfToFx(def), characterQuality: 'hd' };
    packId = variant ? slugify(`ray-mmd-${variant}`) : 'ray-mmd-adapted';
    packName = variant ? `Ray-MMD (${variant})` : 'Ray-MMD (Adapted)';
    author = 'ray-cast / ray-mmd';
  } else if (kind === 'plugin-shader') {
    config = { fx: mapPluginShaderToFx(variant), characterQuality: 'hd' };
    packId = variant ? slugify(`plugin-shader-${variant}`) : 'plugin-shader-adapted';
    packName = variant
      ? `Plug-In Shader (${variant.replace(/-/g, ' ')})`
      : 'Plug-In Shader (Adapted)';
    author = 'Plug-In Shader / JoshuaWithJ';
  } else {
    config = { fx: mapGenericMmeToFx(), characterQuality: 'standard' };
    const fxFile =
      files.find((f) => getPackageRelPath(f).endsWith('.fx')) ??
      files.find((f) => getPackageRelPath(f).endsWith('.fxsub'));
    const stem = fxFile?.name.replace(/\.(fx|fxsub)$/i, '') ?? 'mme-effect';
    packId = slugify(stem);
    packName = `${stem} (Adapted)`;
    author = 'MMD Community';
  }

  const previewDataUrl = await previewFromMmdFiles(files);

  return {
    manifest: {
      id: packId,
      name: packName,
      version: '1.0.0-adapted',
      author,
      description: `${adaptation.sourceLabel} → AnimaStage. ${adaptation.note}`,
    },
    config,
    previewDataUrl,
    shaderVert: MINIMAL_VERT,
    shaderFrag: MINIMAL_FRAG,
    installedAt: Date.now(),
    sourceUrl,
    mmdShader: adaptation,
  };
}
