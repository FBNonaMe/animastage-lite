/**
 * Ray-MMD 1.5.2 HDR bloom — WebGL adapter (MIT, ray-cast).
 * Multi-scale extract + blur approximation in postprocessing Effect form.
 */
import { Color, Uniform, Vector2 } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import type { RayMmdBloomSettings } from '../../standaloneEffects/types';
import { RAY_MMD_BLOOM_NEUTRAL } from '../../standaloneEffects/presets';
import { wrapEffect } from '@react-three/postprocessing';

const FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uThreshold;
uniform float uMode;
uniform vec3 uTint;
uniform float uRadius;
uniform vec2 uTexel;

vec3 extractBloom(vec3 color) {
  float lum = max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
  if (uMode < 1.5) return max(vec3(0.0), color - vec3(uThreshold));
  if (uMode < 2.5) return clamp(color - vec3(uThreshold), 0.0, 1.0);
  if (uMode < 3.5) return clamp(color * (lum - uThreshold) / lum, 0.0, 1.0);
  return clamp(color * clamp((lum - uThreshold) / lum, 0.0, 1.0), 0.0, 8.0);
}

vec3 blur9(sampler2D tex, vec2 uv, vec2 texel, vec2 axis) {
  vec2 a = axis * texel * uRadius;
  vec3 c = texture2D(tex, uv).rgb * 0.227027;
  c += texture2D(tex, uv + a * 1.384615).rgb * 0.194594;
  c += texture2D(tex, uv - a * 1.384615).rgb * 0.194594;
  c += texture2D(tex, uv + a * 3.230769).rgb * 0.121621;
  c += texture2D(tex, uv - a * 3.230769).rgb * 0.121621;
  return c;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 base = inputColor.rgb;
  vec3 bright = extractBloom(base) * uTint;

  vec2 texel = uTexel;
  vec3 b0 = blur9(inputBuffer, uv, texel, vec2(1.0, 0.0));
  vec3 b1 = blur9(inputBuffer, uv, texel * 2.0, vec2(0.0, 1.0));
  vec3 b2 = blur9(inputBuffer, uv, texel * 4.0, vec2(1.0, 1.0));
  b0 = extractBloom(b0);
  b1 = extractBloom(b1) * 0.75;
  b2 = extractBloom(b2) * 0.5;

  vec3 bloom = (bright * 0.32 + b0 * 0.25 + b1 * 0.19 + b2 * 0.14) * uTint;
  outputColor = vec4(base + bloom * uIntensity, inputColor.a);
}`;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

export class RayHdrBloomEffectImpl extends Effect {
  constructor(
    params: Partial<RayMmdBloomSettings> & { width?: number; height?: number } = {}
  ) {
    super('RayHdrBloomEffect', FRAGMENT, {
      blendFunction: BlendFunction.ADD,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(0)],
        ['uThreshold', new Uniform(1)],
        ['uMode', new Uniform(4)],
        ['uTint', new Uniform(new Color(1, 1, 1))],
        ['uRadius', new Uniform(2.2)],
        ['uTexel', new Uniform(new Vector2(1, 1))],
      ]),
    });
    const { width = 1, height = 1, ...bloom } = params;
    this.setTexel(width, height);
    this.setParams(bloom);
  }

  setTexel(width: number, height: number): void {
    this.uniforms.get('uTexel')!.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }

  setParams(parameters: Partial<RayMmdBloomSettings> = {}): boolean {
    const p = { ...RAY_MMD_BLOOM_NEUTRAL, ...parameters };
    this.uniforms.get('uIntensity')!.value = clampNum(p.amount, 0, 4, 0);
    this.uniforms.get('uThreshold')!.value = clampNum(p.threshold, 0, 8, 1);
    this.uniforms.get('uMode')!.value = clampNum(p.mode, 1, 4, 4);
    this.uniforms.get('uRadius')!.value = clampNum(p.radius, 0.1, 10, 2.2);
    try {
      this.uniforms.get('uTint')!.value.set(p.tint || '#ffffff');
    } catch {
      this.uniforms.get('uTint')!.value.set('#ffffff');
    }
    return p.enabled && this.uniforms.get('uIntensity')!.value > 0.0001;
  }
}

export const RayHdrBloomEffect = wrapEffect(RayHdrBloomEffectImpl);
