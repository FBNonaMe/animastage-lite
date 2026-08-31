/*
 * AnimaStage WebGL adapter for Ray-MMD 1.5.2 HDR bloom.
 * Original: Shader/PostProcessBloom.fxsub by Rui / ray-cast, MIT License.
 * Source revision: a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8
 *
 * Preserves the original five viewport ratios (1/2 through 1/32), threshold
 * modes, separable Gaussian structure and weighted recombination. The pass is
 * isolated and disabled when no Effects Platform instance owns it.
 */

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PREFILTER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uMode;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec3 color = texture2D(tDiffuse, vUv).rgb;
  float lum = max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 0.0001);
  vec3 bloom;
  if (uMode < 1.5) bloom = max(vec3(0.0), color - uThreshold);
  else if (uMode < 2.5) bloom = clamp(color - uThreshold, 0.0, 1.0);
  else if (uMode < 3.5) bloom = clamp(color * (lum - uThreshold) / lum, 0.0, 1.0);
  else bloom = clamp(color * clamp((lum - uThreshold) / lum, 0.0, 1.0), 0.0, 8.0);
  gl_FragColor = vec4(bloom * uTint, 1.0);
}`;

const DOWNSAMPLE = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 color = texture2D(tDiffuse, vUv + vec2(-h.x, -h.y)).rgb
    + texture2D(tDiffuse, vUv + vec2(-h.x, h.y)).rgb
    + texture2D(tDiffuse, vUv + vec2(h.x, -h.y)).rgb
    + texture2D(tDiffuse, vUv + vec2(h.x, h.y)).rgb;
  gl_FragColor = vec4(color * 0.25, 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform vec2 uAxis;
uniform float uRadius;
varying vec2 vUv;
void main() {
  float variance = max(0.05, uRadius * uRadius);
  float w0 = 1.0;
  float w1 = exp(-0.5 / variance);
  float w2 = exp(-2.0 / variance);
  float w3 = exp(-4.5 / variance);
  float w4 = exp(-8.0 / variance);
  vec2 axis = uAxis * uTexel;
  vec3 color = texture2D(tDiffuse, vUv).rgb * w0;
  color += texture2D(tDiffuse, vUv + axis).rgb * w1;
  color += texture2D(tDiffuse, vUv - axis).rgb * w1;
  color += texture2D(tDiffuse, vUv + axis * 2.0).rgb * w2;
  color += texture2D(tDiffuse, vUv - axis * 2.0).rgb * w2;
  color += texture2D(tDiffuse, vUv + axis * 3.0).rgb * w3;
  color += texture2D(tDiffuse, vUv - axis * 3.0).rgb * w3;
  color += texture2D(tDiffuse, vUv + axis * 4.0).rgb * w4;
  color += texture2D(tDiffuse, vUv - axis * 4.0).rgb * w4;
  gl_FragColor = vec4(color / max(w0 + 2.0 * (w1 + w2 + w3 + w4), 0.0001), 1.0);
}`;

const COMBINE = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform sampler2D uBloom4;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  vec4 source = texture2D(tDiffuse, vUv);
  vec3 bloom = texture2D(uBloom0, vUv).rgb * 0.32
    + texture2D(uBloom1, vUv).rgb * 0.25
    + texture2D(uBloom2, vUv).rgb * 0.19
    + texture2D(uBloom3, vUv).rgb * 0.14
    + texture2D(uBloom4, vUv).rgb * 0.10;
  gl_FragColor = vec4(source.rgb + bloom * uIntensity, source.a);
}`;

const makeTarget = (name) => {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = name;
  return target;
};

const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({
  vertexShader: VERTEX,
  fragmentShader,
  uniforms,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const number = (value, min, max, fallback) => {
  const parsed = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : fallback));
};

export class RayBloomPass extends Pass {
  constructor() {
    super();
    this.enabled = false;
    this.needsSwap = true;
    this._mips = Array.from({ length: 5 }, (_, index) => makeTarget(`RayBloomMip${index}`));
    this._temps = Array.from({ length: 5 }, (_, index) => makeTarget(`RayBloomTemp${index}`));
    this.prefilter = material(PREFILTER, {
      tDiffuse: { value: null },
      uThreshold: { value: 1 },
      uMode: { value: 4 },
      uTint: { value: new THREE.Color(1, 1, 1) },
    });
    this.downsample = material(DOWNSAMPLE, {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2(1, 1) },
    });
    this.blur = material(BLUR, {
      tDiffuse: { value: null },
      uTexel: { value: new THREE.Vector2(1, 1) },
      uAxis: { value: new THREE.Vector2(1, 0) },
      uRadius: { value: 2.2 },
    });
    this.combineUniforms = {
      tDiffuse: { value: null },
      uBloom0: { value: this._mips[0].texture },
      uBloom1: { value: this._mips[1].texture },
      uBloom2: { value: this._mips[2].texture },
      uBloom3: { value: this._mips[3].texture },
      uBloom4: { value: this._mips[4].texture },
      uIntensity: { value: 0 },
    };
    this.combine = material(COMBINE, this.combineUniforms);
    this.fsQuad = new FullScreenQuad(this.prefilter);
    this._width = 1;
    this._height = 1;
  }

  setParams(parameters = {}) {
    const amount = number(parameters.amount, 0, 4, 0);
    this.combineUniforms.uIntensity.value = amount;
    this.prefilter.uniforms.uThreshold.value = number(parameters.threshold, 0, 8, 1);
    this.prefilter.uniforms.uMode.value = number(parameters.mode, 1, 4, 4);
    this.blur.uniforms.uRadius.value = number(parameters.radius, 0.1, 10, 2.2);
    try { this.prefilter.uniforms.uTint.value.set(parameters.tint || "#ffffff"); }
    catch (_) { this.prefilter.uniforms.uTint.value.set("#ffffff"); }
    this.enabled = amount > 0.0001;
    return this.enabled;
  }

  setSize(width, height) {
    this._width = Math.max(1, width | 0);
    this._height = Math.max(1, height | 0);
    for (let index = 0; index < 5; index++) {
      const divisor = 2 ** (index + 1);
      const w = Math.max(1, Math.floor(this._width / divisor));
      const h = Math.max(1, Math.floor(this._height / divisor));
      this._mips[index].setSize(w, h);
      this._temps[index].setSize(w, h);
    }
  }

  _draw(renderer, target, passMaterial) {
    this.fsQuad.material = passMaterial;
    renderer.setRenderTarget(target);
    renderer.clear();
    this.fsQuad.render(renderer);
  }

  render(renderer, writeBuffer, readBuffer) {
    if (this._width !== readBuffer.width || this._height !== readBuffer.height) this.setSize(readBuffer.width, readBuffer.height);
    this.prefilter.uniforms.tDiffuse.value = readBuffer.texture;
    this._draw(renderer, this._mips[0], this.prefilter);
    for (let index = 1; index < 5; index++) {
      const source = this._mips[index - 1];
      this.downsample.uniforms.tDiffuse.value = source.texture;
      this.downsample.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
      this._draw(renderer, this._mips[index], this.downsample);
    }
    for (let index = 0; index < 5; index++) {
      const mip = this._mips[index];
      this.blur.uniforms.uTexel.value.set(1 / mip.width, 1 / mip.height);
      this.blur.uniforms.tDiffuse.value = mip.texture;
      this.blur.uniforms.uAxis.value.set(1, 0);
      this._draw(renderer, this._temps[index], this.blur);
      this.blur.uniforms.tDiffuse.value = this._temps[index].texture;
      this.blur.uniforms.uAxis.value.set(0, 1);
      this._draw(renderer, mip, this.blur);
    }
    this.combineUniforms.tDiffuse.value = readBuffer.texture;
    this.fsQuad.material = this.combine;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.prefilter.dispose();
    this.downsample.dispose();
    this.blur.dispose();
    this.combine.dispose();
    this.fsQuad.dispose();
    for (const target of [...this._mips, ...this._temps]) target.dispose();
  }
}
