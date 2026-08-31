/**
 * Ray-MMD 1.5.2 color grading — WebGL adapter ported from standalone bundle.
 * Original: Shader/ColorGrading.fxsub by Rui / ray-cast (MIT).
 * Source: vendor/animastage-standalone/assets/effects-library/.../ray-color-grading-pass.js
 */
import { Uniform, Vector2 } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';
import type { RayMmdColorGradeSettings } from '../../standaloneEffects/types';
import { RAY_MMD_COLOR_GRADE_NEUTRAL } from '../../standaloneEffects/presets';

const FRAGMENT = /* glsl */ `
uniform float uAmount;
uniform float uOperator;
uniform float uExposure;
uniform float uTemperature;
uniform float uSaturation;
uniform float uContrast;
uniform float uGamma;
uniform float uGain;
uniform float uOffset;
uniform float uVignette;
uniform vec2 uResolution;

float luminanceOf(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 colorTemperature(float kelvin) {
  float temp = max(10.0, kelvin / 100.0);
  float temp60 = max(0.0001, temp - 60.0);
  float red = temp <= 66.0 ? 255.0 : 329.698727446 * pow(temp60, -0.1332047592);
  float green = temp <= 66.0
    ? 99.4708025861 * log(temp) - 161.1195681661
    : 288.1221695283 * pow(temp60, -0.0755148492);
  float blue = temp >= 66.0 ? 255.0
    : (temp <= 19.0 ? 0.0 : 138.5177312231 * log(temp - 10.0) - 305.0447927307);
  return clamp(vec3(red, green, blue) / 255.0, 0.0, 1.0);
}

vec3 colorCorrect(vec3 color) {
  vec3 luma = vec3(luminanceOf(color));
  color = max(vec3(0.0), mix(luma, color, uSaturation));
  color = pow(max(color * (1.0 / 0.18), vec3(0.0)), vec3(uContrast)) * 0.18;
  color = pow(max(color, vec3(0.0)), vec3(1.0 / max(uGamma, 0.0001)));
  return max(vec3(0.0), color * uGain + uOffset);
}

vec3 tonemapACES(vec3 x) {
  const float A = 2.51;
  const float B = 0.03;
  const float C = 2.43;
  const float D = 0.59;
  const float E = 0.14;
  return (x * (A * x + B)) / (x * (C * x + D) + E);
}

vec3 tonemapHejl2015(vec3 hdr, float whitePoint) {
  vec4 vh = vec4(hdr, whitePoint);
  vec4 va = 1.425 * vh + 0.05;
  vec4 vf = (vh * va + 0.004) / (vh * (va + 0.55) + 0.0491) - 0.0821;
  return vf.rgb / max(vf.www, vec3(0.0001));
}

vec4 tonemapHable(vec4 x) {
  const float A = 0.22;
  const float B = 0.30;
  const float C = 0.10;
  const float D = 0.20;
  const float E = 0.01;
  const float F = 0.30;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 tonemapNaughtyDog(vec3 x) {
  const float A = -2586.3655;
  const float B = 0.6900;
  const float C = -767.6706;
  const float D = -8.5706;
  const float E = 2.8784;
  const float F = 107.4683;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 tonemapReinhard(vec3 color, float whitePoint) {
  float luma = max(luminanceOf(color), 0.0001);
  float mapped = luma * (1.0 + luma / (whitePoint * whitePoint)) / (1.0 + luma);
  return color * mapped / luma;
}

vec3 applyToneOperator(vec3 color) {
  if (uOperator < 0.5) return color;
  if (uOperator < 1.5) return clamp(tonemapReinhard(color, 4.0), 0.0, 1.0);
  if (uOperator < 2.5) {
    vec4 mapped = tonemapHable(vec4(color * 2.0, 4.0));
    return clamp(mapped.rgb / max(mapped.w, 0.0001), 0.0, 1.0);
  }
  if (uOperator < 3.5) {
    vec4 mapped = tonemapHable(vec4(color * 2.0, 8.0));
    return clamp(mapped.rgb / max(mapped.w, 0.0001), 0.0, 1.0);
  }
  if (uOperator < 4.5) return clamp(tonemapHejl2015(color, 4.0), 0.0, 1.0);
  if (uOperator < 5.5) return clamp(tonemapACES(color), 0.0, 1.0);
  return clamp(tonemapNaughtyDog(color), 0.0, 1.0);
}

vec3 dither(vec3 color, vec2 fragCoord) {
  vec2 seed = fragCoord / max(uResolution, vec2(1.0));
  vec3 noise = fract(sin(vec3(
    dot(seed, vec2(34.483, 89.637)),
    dot(seed + 0.5789, vec2(34.483, 89.637)),
    dot(seed + 1.1578, vec2(34.483, 89.637))
  )) * vec3(29156.4765, 38273.5639, 47843.7546));
  return color + (noise - 0.5) / 255.0;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 source = inputColor.rgb;
  vec3 color = source * exp2(uExposure);
  vec3 neutralTemperature = colorTemperature(6500.0);
  color *= colorTemperature(uTemperature) / max(neutralTemperature, vec3(0.0001));
  color = colorCorrect(color);
  color = applyToneOperator(color);
  float radius = length((uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0));
  color *= 1.0 - smoothstep(0.25, 0.82, radius) * uVignette;
  color = dither(color, gl_FragCoord.xy);
  outputColor = vec4(mix(source, color, uAmount), inputColor.a);
}`;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

export class RayColorGradingEffectImpl extends Effect {
  constructor(
    params: Partial<RayMmdColorGradeSettings> & { width?: number; height?: number } = {}
  ) {
    super('RayColorGradingEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uAmount', new Uniform(0)],
        ['uOperator', new Uniform(0)],
        ['uExposure', new Uniform(0)],
        ['uTemperature', new Uniform(6500)],
        ['uSaturation', new Uniform(1)],
        ['uContrast', new Uniform(1)],
        ['uGamma', new Uniform(1)],
        ['uGain', new Uniform(1)],
        ['uOffset', new Uniform(0)],
        ['uVignette', new Uniform(0)],
        ['uResolution', new Uniform(new Vector2(1, 1))],
      ]),
    });
    const { width = 1, height = 1, ...grade } = params;
    this.setSize(width, height);
    this.setParams(grade);
  }

  setParams(parameters: Partial<RayMmdColorGradeSettings> = {}): boolean {
    const p = { ...RAY_MMD_COLOR_GRADE_NEUTRAL, ...parameters };
    this.uniforms.get('uAmount')!.value = clampNum(p.amount, 0, 1, 0);
    this.uniforms.get('uOperator')!.value = clampNum(p.operator, 0, 6, 0);
    this.uniforms.get('uExposure')!.value = clampNum(p.exposure, -8, 8, 0);
    this.uniforms.get('uTemperature')!.value = clampNum(p.temperature, 1000, 40000, 6500);
    this.uniforms.get('uSaturation')!.value = clampNum(p.saturation, 0, 3, 1);
    this.uniforms.get('uContrast')!.value = clampNum(p.contrast, 0.1, 3, 1);
    this.uniforms.get('uGamma')!.value = clampNum(p.gamma, 0.1, 4, 1);
    this.uniforms.get('uGain')!.value = clampNum(p.gain, 0, 4, 1);
    this.uniforms.get('uOffset')!.value = clampNum(p.offset, -1, 1, 0);
    this.uniforms.get('uVignette')!.value = clampNum(p.vignette, 0, 1, 0);
    return p.enabled && this.uniforms.get('uAmount')!.value > 0.0001;
  }

  setSize(width: number, height: number): void {
    this.uniforms.get('uResolution')!.value.set(Math.max(1, width), Math.max(1, height));
  }
}

export const RayColorGradingEffect = wrapEffect(RayColorGradingEffectImpl);
