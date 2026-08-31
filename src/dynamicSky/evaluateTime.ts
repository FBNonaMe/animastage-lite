import type { DynamicSkyColors, DynamicSkyLook, DynamicSkyPeriodId } from './types';

export interface TimeKeySample {
  hour: number;
  period: DynamicSkyPeriodId;
  sunElevation: number;
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemisphereIntensity: number;
  colors: DynamicSkyColors;
  fogEnabled: boolean;
  fogDensity: number;
  fogColor: string;
  exposure: number;
  bloomIntensity: number;
  temperature: number;
  saturation: number;
  contrast: number;
  environmentIntensity: number;
  atmosphericDensity: number;
  skyBrightness: number;
}

/** Anchor samples across 24h — continuous lerp between neighbors. */
export const TIME_KEY_SAMPLES: TimeKeySample[] = [
  {
    hour: 0,
    period: 'midnight',
    sunElevation: -42,
    sunColor: '#1a2030',
    sunIntensity: 0.05,
    ambientColor: '#1c2438',
    ambientIntensity: 0.55,
    hemisphereIntensity: 0.45,
    colors: {
      zenith: '#050814',
      horizon: '#10182c',
      ground: '#080a10',
      sunGlow: '#304878',
      fog: '#121828',
      moon: '#d8e4ff',
    },
    fogEnabled: true,
    fogDensity: 0.22,
    fogColor: '#121828',
    exposure: 0.72,
    bloomIntensity: 0.22,
    temperature: -0.15,
    saturation: 0.92,
    contrast: 1.06,
    environmentIntensity: 0.45,
    atmosphericDensity: 0.55,
    skyBrightness: 0.28,
  },
  {
    hour: 5,
    period: 'dawn',
    sunElevation: -4,
    sunColor: '#ffb8a0',
    sunIntensity: 0.35,
    ambientColor: '#c8b0c8',
    ambientIntensity: 0.7,
    hemisphereIntensity: 0.65,
    colors: {
      zenith: '#1a2848',
      horizon: '#e8a090',
      ground: '#2a2030',
      sunGlow: '#ffc0a8',
      fog: '#d8b8c0',
      moon: '#e8f0ff',
    },
    fogEnabled: true,
    fogDensity: 0.28,
    fogColor: '#d8b8c0',
    exposure: 0.8,
    bloomIntensity: 0.28,
    temperature: 0.12,
    saturation: 1.02,
    contrast: 1.02,
    environmentIntensity: 0.55,
    atmosphericDensity: 0.7,
    skyBrightness: 0.45,
  },
  {
    hour: 6.5,
    period: 'sunrise',
    sunElevation: 8,
    sunColor: '#ffb078',
    sunIntensity: 0.85,
    ambientColor: '#ffd0b0',
    ambientIntensity: 0.85,
    hemisphereIntensity: 0.85,
    colors: {
      zenith: '#4a78c8',
      horizon: '#ffc090',
      ground: '#3a3028',
      sunGlow: '#ffd8a0',
      fog: '#f0c8a8',
      moon: '#eef2ff',
    },
    fogEnabled: true,
    fogDensity: 0.24,
    fogColor: '#f0c8a8',
    exposure: 0.88,
    bloomIntensity: 0.34,
    temperature: 0.28,
    saturation: 1.08,
    contrast: 1.02,
    environmentIntensity: 0.72,
    atmosphericDensity: 0.75,
    skyBrightness: 0.7,
  },
  {
    hour: 9,
    period: 'morning',
    sunElevation: 32,
    sunColor: '#fff0e0',
    sunIntensity: 1.05,
    ambientColor: '#e0ecff',
    ambientIntensity: 0.95,
    hemisphereIntensity: 1,
    colors: {
      zenith: '#5a90e8',
      horizon: '#c8dcff',
      ground: '#405060',
      sunGlow: '#fff8e8',
      fog: '#d8e8f8',
      moon: '#ffffff',
    },
    fogEnabled: true,
    fogDensity: 0.12,
    fogColor: '#d8e8f8',
    exposure: 0.94,
    bloomIntensity: 0.22,
    temperature: 0.05,
    saturation: 1.04,
    contrast: 1.03,
    environmentIntensity: 0.9,
    atmosphericDensity: 0.5,
    skyBrightness: 0.95,
  },
  {
    hour: 12,
    period: 'noon',
    sunElevation: 62,
    sunColor: '#fff8f0',
    sunIntensity: 1.2,
    ambientColor: '#d8e4ff',
    ambientIntensity: 1,
    hemisphereIntensity: 1.05,
    colors: {
      zenith: '#3a78e0',
      horizon: '#b8d4ff',
      ground: '#486078',
      sunGlow: '#ffffff',
      fog: '#c8d8f0',
      moon: '#ffffff',
    },
    fogEnabled: false,
    fogDensity: 0.08,
    fogColor: '#c8d8f0',
    exposure: 0.98,
    bloomIntensity: 0.18,
    temperature: 0,
    saturation: 1,
    contrast: 1.04,
    environmentIntensity: 1.05,
    atmosphericDensity: 0.4,
    skyBrightness: 1.1,
  },
  {
    hour: 15,
    period: 'afternoon',
    sunElevation: 42,
    sunColor: '#fff4e8',
    sunIntensity: 1.1,
    ambientColor: '#e4ecff',
    ambientIntensity: 0.95,
    hemisphereIntensity: 1,
    colors: {
      zenith: '#4a88e0',
      horizon: '#c8dcff',
      ground: '#485868',
      sunGlow: '#fff8f0',
      fog: '#d0e0f0',
      moon: '#ffffff',
    },
    fogEnabled: false,
    fogDensity: 0.1,
    fogColor: '#d0e0f0',
    exposure: 0.95,
    bloomIntensity: 0.2,
    temperature: 0.04,
    saturation: 1.02,
    contrast: 1.04,
    environmentIntensity: 0.95,
    atmosphericDensity: 0.45,
    skyBrightness: 1,
  },
  {
    hour: 17.5,
    period: 'golden_hour',
    sunElevation: 18,
    sunColor: '#ffd4a8',
    sunIntensity: 1.0,
    ambientColor: '#ffe4c8',
    ambientIntensity: 0.9,
    hemisphereIntensity: 0.9,
    colors: {
      zenith: '#6088c8',
      horizon: '#ffc890',
      ground: '#4a3828',
      sunGlow: '#ffe0b0',
      fog: '#f0d8b8',
      moon: '#fff0e8',
    },
    fogEnabled: true,
    fogDensity: 0.16,
    fogColor: '#f0d8b8',
    exposure: 0.88,
    bloomIntensity: 0.3,
    temperature: 0.25,
    saturation: 1.1,
    contrast: 1.05,
    environmentIntensity: 0.82,
    atmosphericDensity: 0.65,
    skyBrightness: 0.85,
  },
  {
    hour: 19,
    period: 'sunset',
    sunElevation: 6,
    sunColor: '#ff8a4a',
    sunIntensity: 0.92,
    ambientColor: '#ffc090',
    ambientIntensity: 0.7,
    hemisphereIntensity: 0.75,
    colors: {
      zenith: '#2a4070',
      horizon: '#ff9050',
      ground: '#3a2818',
      sunGlow: '#ffb070',
      fog: '#e8a878',
      moon: '#e8f0ff',
    },
    fogEnabled: true,
    fogDensity: 0.26,
    fogColor: '#e8a878',
    exposure: 0.84,
    bloomIntensity: 0.38,
    temperature: 0.35,
    saturation: 1.12,
    contrast: 1.04,
    environmentIntensity: 0.68,
    atmosphericDensity: 0.8,
    skyBrightness: 0.65,
  },
  {
    hour: 20.2,
    period: 'blue_hour',
    sunElevation: -2,
    sunColor: '#a8c0ff',
    sunIntensity: 0.4,
    ambientColor: '#8098c8',
    ambientIntensity: 0.9,
    hemisphereIntensity: 0.85,
    colors: {
      zenith: '#101830',
      horizon: '#4060a0',
      ground: '#121820',
      sunGlow: '#7898d8',
      fog: '#304878',
      moon: '#d0dcff',
    },
    fogEnabled: true,
    fogDensity: 0.2,
    fogColor: '#304878',
    exposure: 0.76,
    bloomIntensity: 0.28,
    temperature: -0.2,
    saturation: 0.98,
    contrast: 1.05,
    environmentIntensity: 0.58,
    atmosphericDensity: 0.7,
    skyBrightness: 0.4,
  },
  {
    hour: 21.5,
    period: 'evening',
    sunElevation: -18,
    sunColor: '#6070a0',
    sunIntensity: 0.12,
    ambientColor: '#405070',
    ambientIntensity: 0.7,
    hemisphereIntensity: 0.55,
    colors: {
      zenith: '#080e1c',
      horizon: '#182038',
      ground: '#0a0c12',
      sunGlow: '#506888',
      fog: '#182030',
      moon: '#d8e4ff',
    },
    fogEnabled: true,
    fogDensity: 0.18,
    fogColor: '#182030',
    exposure: 0.74,
    bloomIntensity: 0.24,
    temperature: -0.12,
    saturation: 0.94,
    contrast: 1.06,
    environmentIntensity: 0.5,
    atmosphericDensity: 0.6,
    skyBrightness: 0.32,
  },
  {
    hour: 24,
    period: 'midnight',
    sunElevation: -42,
    sunColor: '#1a2030',
    sunIntensity: 0.05,
    ambientColor: '#1c2438',
    ambientIntensity: 0.55,
    hemisphereIntensity: 0.45,
    colors: {
      zenith: '#050814',
      horizon: '#10182c',
      ground: '#080a10',
      sunGlow: '#304878',
      fog: '#121828',
      moon: '#d8e4ff',
    },
    fogEnabled: true,
    fogDensity: 0.22,
    fogColor: '#121828',
    exposure: 0.72,
    bloomIntensity: 0.22,
    temperature: -0.15,
    saturation: 0.92,
    contrast: 1.06,
    environmentIntensity: 0.45,
    atmosphericDensity: 0.55,
    skyBrightness: 0.28,
  },
];

function wrapHour(h: number): number {
  let x = h % 24;
  if (x < 0) x += 24;
  return x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

function lerpColors(a: DynamicSkyColors, b: DynamicSkyColors, t: number): DynamicSkyColors {
  return {
    zenith: lerpColor(a.zenith, b.zenith, t),
    horizon: lerpColor(a.horizon, b.horizon, t),
    ground: lerpColor(a.ground, b.ground, t),
    sunGlow: lerpColor(a.sunGlow, b.sunGlow, t),
    fog: lerpColor(a.fog, b.fog, t),
    moon: lerpColor(a.moon, b.moon, t),
  };
}

function findNeighbors(hour: number): { a: TimeKeySample; b: TimeKeySample; t: number } {
  const h = wrapHour(hour);
  const samples = TIME_KEY_SAMPLES;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i]!;
    const b = samples[i + 1]!;
    if (h >= a.hour && h <= b.hour) {
      const span = Math.max(1e-6, b.hour - a.hour);
      return { a, b, t: (h - a.hour) / span };
    }
  }
  return { a: samples[0]!, b: samples[samples.length - 1]!, t: 0 };
}

/** Sun azimuth: full orbit, east (~90°) near sunrise (~6.5h). */
export function sunAzimuthFromTime(timeHours: number): number {
  const h = wrapHour(timeHours);
  return wrapHour((h - 6.5) * (360 / 24) + 90);
}

export function moonAzimuthFromTime(timeHours: number): number {
  return (sunAzimuthFromTime(timeHours) + 180) % 360;
}

export function evaluateTimeOfDay(timeHours: number): DynamicSkyLook {
  const h = wrapHour(timeHours);
  const { a, b, t } = findNeighbors(h);
  const sunElevation = lerp(a.sunElevation, b.sunElevation, t);
  const nightMode = sunElevation < 2;
  const moonElevation = Math.max(-5, 55 - Math.abs(sunElevation + 10) * 0.85);

  return {
    period: t < 0.5 ? a.period : b.period,
    timeHours: h,
    sunAzimuth: sunAzimuthFromTime(h),
    sunElevation,
    sunColor: lerpColor(a.sunColor, b.sunColor, t),
    sunIntensity: Math.max(0.02, lerp(a.sunIntensity, b.sunIntensity, t)),
    moonAzimuth: moonAzimuthFromTime(h),
    moonElevation,
    moonIntensity: nightMode ? lerp(0.35, 0.85, Math.min(1, (2 - sunElevation) / 20)) : 0.05,
    moonColor: lerpColor(a.colors.moon, b.colors.moon, t),
    ambientColor: lerpColor(a.ambientColor, b.ambientColor, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    hemisphereIntensity: lerp(a.hemisphereIntensity, b.hemisphereIntensity, t),
    colors: lerpColors(a.colors, b.colors, t),
    fogEnabled: a.fogEnabled || b.fogEnabled,
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    fogColor: lerpColor(a.fogColor, b.fogColor, t),
    cloudCoverage: 0.25,
    cloudDensity: 0.45,
    cloudSpeed: 0.35,
    cloudOpacity: 0.55,
    exposure: lerp(a.exposure, b.exposure, t),
    bloomIntensity: lerp(a.bloomIntensity, b.bloomIntensity, t),
    temperature: lerp(a.temperature, b.temperature, t),
    saturation: lerp(a.saturation, b.saturation, t),
    contrast: lerp(a.contrast, b.contrast, t),
    environmentIntensity: lerp(a.environmentIntensity, b.environmentIntensity, t),
    atmosphericDensity: lerp(a.atmosphericDensity, b.atmosphericDensity, t),
    skyBrightness: lerp(a.skyBrightness, b.skyBrightness, t),
    windStrength: 0.1,
    nightMode,
  };
}

export function periodLabel(id: DynamicSkyPeriodId): string {
  const map: Record<DynamicSkyPeriodId, string> = {
    midnight: 'Midnight',
    dawn: 'Dawn',
    sunrise: 'Sunrise',
    morning: 'Morning',
    noon: 'Noon',
    afternoon: 'Afternoon',
    golden_hour: 'Golden Hour',
    sunset: 'Sunset',
    blue_hour: 'Blue Hour',
    evening: 'Evening',
  };
  return map[id];
}

export function formatTimeHours(h: number): string {
  const x = wrapHour(h);
  const hh = Math.floor(x) % 24;
  const mm = Math.floor((x - Math.floor(x)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
