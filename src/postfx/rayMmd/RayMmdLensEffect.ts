/**
 * Ray-MMD PostProcessHDR ColorDispersion mode 1 — radial lens (MIT).
 */
import { Uniform, Vector2 } from 'three';
import { BlendFunction, Effect } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';
import type { RayMmdLensSettings } from '../../standaloneEffects/types';
import { RAY_MMD_LENS_NEUTRAL } from '../../standaloneEffects/presets';

const FRAGMENT = /* glsl */ `
uniform float uDispersion;
uniform float uRadius;
uniform float uMix;
uniform vec2 uTexel;
uniform vec2 uResolution;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uDispersion < 0.0001 || uMix < 0.0001) {
    outputColor = inputColor;
    return;
  }

  vec2 coord = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0) + 0.5;
  float L = length(coord * 2.0 - 1.0);
  L = 1.0 - smoothstep(uRadius + 1.0, uRadius, L);
  float scale = (uResolution.x * 0.5) / 512.0;
  vec2 offset = uTexel * L * (uDispersion * 8.0) * scale;

  vec3 shifted;
  shifted.r = texture2D(inputBuffer, uv - offset).r;
  shifted.g = inputColor.g;
  shifted.b = texture2D(inputBuffer, uv + offset).b;

  outputColor = vec4(mix(inputColor.rgb, shifted, uMix), inputColor.a);
}`;

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
}

export class RayMmdLensEffectImpl extends Effect {
  constructor(params: Partial<RayMmdLensSettings> & { width?: number; height?: number } = {}) {
    super('RayMmdLensEffect', FRAGMENT, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uDispersion', new Uniform(0)],
        ['uRadius', new Uniform(0.35)],
        ['uMix', new Uniform(1)],
        ['uTexel', new Uniform(new Vector2(1, 1))],
        ['uResolution', new Uniform(new Vector2(1, 1))],
      ]),
    });
    const { width = 1, height = 1, ...lens } = params;
    this.setSize(width, height);
    this.setParams(lens);
  }

  setSize(width: number, height: number): void {
    this.uniforms.get('uResolution')!.value.set(Math.max(1, width), Math.max(1, height));
    this.uniforms.get('uTexel')!.value.set(1 / Math.max(1, width), 1 / Math.max(1, height));
  }

  setParams(parameters: Partial<RayMmdLensSettings> = {}): boolean {
    const p = { ...RAY_MMD_LENS_NEUTRAL, ...parameters };
    this.uniforms.get('uDispersion')!.value = clampNum(p.dispersion, 0, 1.5, 0);
    this.uniforms.get('uRadius')!.value = clampNum(p.radius, 0, 1.5, 0.35);
    this.uniforms.get('uMix')!.value = clampNum(p.mix, 0, 1, 1);
    return p.enabled && this.uniforms.get('uDispersion')!.value > 0.0001;
  }
}

export const RayMmdLensEffect = wrapEffect(RayMmdLensEffectImpl);
