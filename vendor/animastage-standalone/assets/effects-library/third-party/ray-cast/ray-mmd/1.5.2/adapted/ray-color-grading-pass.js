/*
 * AnimaStage WebGL adapter for Ray-MMD 1.5.2 color grading.
 * Original: Shader/ColorGrading.fxsub by Rui / ray-cast, MIT License.
 * Source revision: a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8
 *
 * This is an explicitly labelled backend adaptation, not the original DX9
 * effect. It ports the published tone operators and color-correction math,
 * while keeping color-space conversion in AnimaStage's OutputPass.
 */

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export const RAY_COLOR_GRADE_NEUTRAL = Object.freeze({
  amount: 0,
  operator: 0,
  exposure: 0,
  temperature: 6500,
  saturation: 1,
  contrast: 1,
  gamma: 1,
  gain: 1,
  offset: 0,
  vignette: 0,
});

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
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
varying vec2 vUv;

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

vec3 dither(vec3 color) {
  vec2 seed = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec3 noise = fract(sin(vec3(
    dot(seed, vec2(34.483, 89.637)),
    dot(seed + 0.5789, vec2(34.483, 89.637)),
    dot(seed + 1.1578, vec2(34.483, 89.637))
  )) * vec3(29156.4765, 38273.5639, 47843.7546));
  return color + (noise - 0.5) / 255.0;
}

void main() {
  vec4 source = texture2D(tDiffuse, vUv);
  vec3 color = source.rgb * exp2(uExposure);
  vec3 neutralTemperature = colorTemperature(6500.0);
  color *= colorTemperature(uTemperature) / max(neutralTemperature, vec3(0.0001));
  color = colorCorrect(color);
  color = applyToneOperator(color);
  float radius = length((vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0));
  color *= 1.0 - smoothstep(0.25, 0.82, radius) * uVignette;
  color = dither(color);
  gl_FragColor = vec4(mix(source.rgb, color, uAmount), source.a);
}`;

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
};

export class RayColorGradingPass extends Pass {
  constructor() {
    super();
    this.enabled = false;
    this.needsSwap = true;
    this.uniforms = {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAmount: { value: 0 },
      uOperator: { value: 0 },
      uExposure: { value: 0 },
      uTemperature: { value: 6500 },
      uSaturation: { value: 1 },
      uContrast: { value: 1 },
      uGamma: { value: 1 },
      uGain: { value: 1 },
      uOffset: { value: 0 },
      uVignette: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  setParams(parameters = {}) {
    const p = { ...RAY_COLOR_GRADE_NEUTRAL, ...(parameters || {}) };
    this.uniforms.uAmount.value = clamp(p.amount, 0, 1, 0);
    this.uniforms.uOperator.value = clamp(p.operator, 0, 6, 0);
    this.uniforms.uExposure.value = clamp(p.exposure, -8, 8, 0);
    this.uniforms.uTemperature.value = clamp(p.temperature, 1000, 40000, 6500);
    this.uniforms.uSaturation.value = clamp(p.saturation, 0, 3, 1);
    this.uniforms.uContrast.value = clamp(p.contrast, 0.1, 3, 1);
    this.uniforms.uGamma.value = clamp(p.gamma, 0.1, 4, 1);
    this.uniforms.uGain.value = clamp(p.gain, 0, 4, 1);
    this.uniforms.uOffset.value = clamp(p.offset, -1, 1, 0);
    this.uniforms.uVignette.value = clamp(p.vignette, 0, 1, 0);
    this.enabled = this.uniforms.uAmount.value > 0.0001;
    return this.enabled;
  }

  setSize(width, height) {
    this.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  }

  render(renderer, writeBuffer, readBuffer) {
    if (this.uniforms.uResolution.value.x !== readBuffer.width || this.uniforms.uResolution.value.y !== readBuffer.height) {
      this.setSize(readBuffer.width, readBuffer.height);
    }
    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
