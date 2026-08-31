/**
 * Ray-MMD 1.5.2 SSR — simplified cone-trace adapter (MIT, PostProcessSSR.fxsub).
 * Uses depth buffer ray march instead of full G-buffer decode.
 */
import { Uniform, Vector2 } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';
import type { RayMmdSsrSettings } from '../../standaloneEffects/types';
import { RAY_MMD_SSR_NEUTRAL } from '../../standaloneEffects/presets';

const FRAGMENT = /* glsl */ `
uniform float uIntensity;
uniform float uThreshold;
uniform float uRangeScale;
uniform float uFadeStart;
uniform float uMaxDistance;
uniform vec2 uTexel;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec3 base = inputColor.rgb;
  if (uIntensity < 0.0001 || depth >= 0.9999) {
    outputColor = inputColor;
    return;
  }

  vec2 boundary = abs(uv * 2.0 - 1.0);
  float fadeDiff = max(0.01, 1.0 - uFadeStart);
  float edgeFade = (1.0 - clamp((boundary.x - uFadeStart) / fadeDiff, 0.0, 1.0));
  edgeFade *= (1.0 - clamp((boundary.y - uFadeStart) / fadeDiff, 0.0, 1.0));

  vec2 marchUv = uv;
  vec2 stepUv = vec2(0.0, uTexel.y * uRangeScale * 2.4);
  vec3 refl = vec3(0.0);
  float hitWeight = 0.0;
  float refDepth = depth;

  for (int i = 0; i < 28; i++) {
    marchUv -= stepUv;
    if (marchUv.y < 0.02 || marchUv.y > 0.98) break;
    float sampleDepth = readDepth(marchUv);
    float diff = sampleDepth - refDepth;
    if (diff > uThreshold * 0.0015) {
      refl = texture2D(inputBuffer, marchUv).rgb;
      hitWeight = 1.0 - float(i) / 28.0;
      break;
    }
  }

  float fresnel = pow(1.0 - clamp(uv.y, 0.0, 1.0), 1.6);
  float glossMask = smoothstep(0.92, 0.55, depth);
  vec3 ssr = refl * hitWeight * fresnel * glossMask * edgeFade * uIntensity;
  outputColor = vec4(base + ssr, inputColor.a);
}`;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

export class RayMmdSsrEffectImpl extends Effect {
  constructor(params: Partial<RayMmdSsrSettings> & { width?: number; height?: number } = {}) {
    super('RayMmdSsrEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uIntensity', new Uniform(0)],
        ['uThreshold', new Uniform(1)],
        ['uRangeScale', new Uniform(0.75)],
        ['uFadeStart', new Uniform(0.8)],
        ['uMaxDistance', new Uniform(48)],
        ['uTexel', new Uniform(new Vector2(1, 1))],
      ]),
    });
    const { width = 1, height = 1, ...ssr } = params;
    this.setTexel(width, height);
    this.setParams(ssr);
  }

  setTexel(width: number, height: number): void {
    this.uniforms.get('uTexel')!.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }

  setParams(parameters: Partial<RayMmdSsrSettings> = {}): boolean {
    const p = { ...RAY_MMD_SSR_NEUTRAL, ...parameters };
    this.uniforms.get('uIntensity')!.value = clampNum(p.amount, 0, 2, 0);
    this.uniforms.get('uThreshold')!.value = clampNum(p.threshold, 0, 4, 1);
    this.uniforms.get('uRangeScale')!.value = clampNum(p.rangeScale, 0.1, 2, 0.75);
    this.uniforms.get('uFadeStart')!.value = clampNum(p.fadeStart, 0, 0.98, 0.8);
    this.uniforms.get('uMaxDistance')!.value = clampNum(p.maxDistance, 4, 120, 48);
    return p.enabled && this.uniforms.get('uIntensity')!.value > 0.0001;
  }
}

export const RayMmdSsrEffect = wrapEffect(RayMmdSsrEffectImpl);
