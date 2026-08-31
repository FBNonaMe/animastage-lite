/**
 * Ray-MMD ColorVignette — ColorGrading.fxsub adapter (MIT).
 */
import { Uniform, Vector2 } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';
import type { RayMmdVignetteSettings } from '../../standaloneEffects/types';
import { RAY_MMD_VIGNETTE_NEUTRAL } from '../../standaloneEffects/presets';

const FRAGMENT = /* glsl */ `
uniform float uAmount;
uniform float uMix;
uniform float uInner;
uniform float uOuter;
uniform vec2 uResolution;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 coord = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0) + 0.5;
  float L = length(coord * 2.0 - 1.0);
  float inner = uInner - uAmount;
  float outer = uOuter - uAmount * 2.0;
  float vig = smoothstep(outer, inner, L);
  vec3 color = inputColor.rgb * mix(1.0, vig, uMix);
  outputColor = vec4(color, inputColor.a);
}`;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

export class RayMmdVignetteEffectImpl extends Effect {
  constructor(
    params: Partial<RayMmdVignetteSettings> & { width?: number; height?: number } = {}
  ) {
    super('RayMmdVignetteEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uAmount', new Uniform(0)],
        ['uMix', new Uniform(1)],
        ['uInner', new Uniform(0.72)],
        ['uOuter', new Uniform(1.28)],
        ['uResolution', new Uniform(new Vector2(1, 1))],
      ]),
    });
    const { width = 1, height = 1, ...vig } = params;
    this.setSize(width, height);
    this.setParams(vig);
  }

  setSize(width: number, height: number): void {
    this.uniforms.get('uResolution')!.value.set(Math.max(1, width), Math.max(1, height));
  }

  setParams(parameters: Partial<RayMmdVignetteSettings> = {}): boolean {
    const p = { ...RAY_MMD_VIGNETTE_NEUTRAL, ...parameters };
    this.uniforms.get('uAmount')!.value = clampNum(p.amount, 0, 2, 0);
    this.uniforms.get('uMix')!.value = clampNum(p.mix, 0, 1, 1);
    this.uniforms.get('uInner')!.value = clampNum(p.inner, 0, 2, 0.72);
    this.uniforms.get('uOuter')!.value = clampNum(p.outer, 0, 3, 1.28);
    return p.enabled && this.uniforms.get('uAmount')!.value > 0.0001;
  }
}

export const RayMmdVignetteEffect = wrapEffect(RayMmdVignetteEffectImpl);
