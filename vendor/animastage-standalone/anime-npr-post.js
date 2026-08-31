/*
 * AnimeStage Star Rail NPR bloom + tonemap pass.
 *
 * Source port of Bloom.shader, UberPost.shader and PostProcessPass.cs from
 * StarRailNPRShader, Copyright (C) 2023 Stalo <stalowork@163.com>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PREFILTER = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uClampMax;
varying vec2 vUv;
void main() {
    vec3 color = min(texture2D(tDiffuse, vUv).rgb, vec3(uClampMax));
    gl_FragColor = vec4(max(vec3(0.0), color - vec3(uThreshold)), 1.0);
}`;

const DOWNSAMPLE = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexelSize;
varying vec2 vUv;
void main() {
    vec2 h = uTexelSize * 0.5;
    vec3 color =
        texture2D(tDiffuse, vUv + vec2(-h.x, -h.y)).rgb +
        texture2D(tDiffuse, vUv + vec2(-h.x,  h.y)).rgb +
        texture2D(tDiffuse, vUv + vec2( h.x, -h.y)).rgb +
        texture2D(tDiffuse, vUv + vec2( h.x,  h.y)).rgb;
    gl_FragColor = vec4(color * 0.25, 1.0);
}`;

const BLUR = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uDirection;
uniform vec2 uTexelSize;
uniform float uSigma;
varying vec2 vUv;
void main() {
    // Nine explicit bilinear taps approximate the previous 15-tap Gaussian.
    // Keeping all texture gradients outside a GLSL loop avoids ANGLE/D3D
    // warning X3595 and paired weights reduce NPR bloom bandwidth by ~40%.
    float variance = max(0.001, uSigma * uSigma);
    float w0 = 1.0;
    float w1 = exp(-0.5 * 1.0 / variance);
    float w2 = exp(-0.5 * 4.0 / variance);
    float w3 = exp(-0.5 * 9.0 / variance);
    float w4 = exp(-0.5 * 16.0 / variance);
    float w5 = exp(-0.5 * 25.0 / variance);
    float w6 = exp(-0.5 * 36.0 / variance);
    float w7 = exp(-0.5 * 49.0 / variance);
    float p12 = w1 + w2;
    float p34 = w3 + w4;
    float p56 = w5 + w6;
    float o12 = (w1 + 2.0 * w2) / max(p12, 0.00001);
    float o34 = (3.0 * w3 + 4.0 * w4) / max(p34, 0.00001);
    float o56 = (5.0 * w5 + 6.0 * w6) / max(p56, 0.00001);
    vec2 axis = uDirection * uTexelSize;
    vec3 color = texture2D(tDiffuse, vUv).rgb * w0;
    color += texture2D(tDiffuse, vUv + axis * o12).rgb * p12;
    color += texture2D(tDiffuse, vUv - axis * o12).rgb * p12;
    color += texture2D(tDiffuse, vUv + axis * o34).rgb * p34;
    color += texture2D(tDiffuse, vUv - axis * o34).rgb * p34;
    color += texture2D(tDiffuse, vUv + axis * o56).rgb * p56;
    color += texture2D(tDiffuse, vUv - axis * o56).rgb * p56;
    color += texture2D(tDiffuse, vUv + axis * 7.0).rgb * w7;
    color += texture2D(tDiffuse, vUv - axis * 7.0).rgb * w7;
    float weightSum = w0 + 2.0 * (p12 + p34 + p56 + w7);
    gl_FragColor = vec4(color / max(weightSum, 0.00001), 1.0);
}`;

const COMBINE = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform float uBloomIntensity;
uniform vec3 uBloomTint;
uniform float uOn;
uniform vec3 uABC;
uniform vec2 uDE;
uniform float uAmount;
uniform vec3 uTint;
varying vec2 vUv;

vec3 srACES(vec3 x) {
    vec3 u = uABC.x * x + uABC.y;
    vec3 v = uABC.z * x + uDE.x;
    return clamp((x * u) / (x * v + uDE.y), 0.0, 1.0);
}

void main() {
    vec4 source = texture2D(tDiffuse, vUv);
    vec3 bloom =
        texture2D(tBloom0, vUv).rgb * 0.35 +
        texture2D(tBloom1, vUv).rgb * 0.30 +
        texture2D(tBloom2, vUv).rgb * 0.22 +
        texture2D(tBloom3, vUv).rgb * 0.13;
    // PostProcessPass.cs scales configured bloom intensity by 0.6.
    vec3 color = source.rgb + bloom * uBloomTint * uBloomIntensity * 0.6;
    if (uOn > 0.5) color = mix(color, srACES(color) * uTint, uAmount);
    gl_FragColor = vec4(color, source.a);
}`;

const makeMaterial = (fragmentShader, uniforms) =>
    new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
    });

const makeTarget = () =>
    new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
    });

export class AnimeNprPostPass extends Pass {
    constructor() {
        super();
        this.enabled = false;
        // Only bloom genuine HDR highlights. A sub-one threshold made bright
        // skin and white hair part of the bloom source and flattened materials.
        this.threshold = 1.0;
        this.clampMax = 65472;
        this.bloomIntensity = 0.55;
        this.bloomTint = new THREE.Color(1, 1, 1);
        this._width = 1;
        this._height = 1;
        this._mips = Array.from({ length: 4 }, makeTarget);
        this._temps = Array.from({ length: 4 }, makeTarget);
        this._mips.forEach((target, index) => {
            target.texture.name = `AnimeNprBloomMip${index}`;
        });

        this.prefilterMaterial = makeMaterial(PREFILTER, {
            tDiffuse: { value: null },
            uThreshold: { value: this.threshold },
            uClampMax: { value: this.clampMax },
        });
        this.downsampleMaterial = makeMaterial(DOWNSAMPLE, {
            tDiffuse: { value: null },
            uTexelSize: { value: new THREE.Vector2(1, 1) },
        });
        this.blurMaterial = makeMaterial(BLUR, {
            tDiffuse: { value: null },
            uDirection: { value: new THREE.Vector2(1, 0) },
            uTexelSize: { value: new THREE.Vector2(1, 1) },
            uSigma: { value: 2 },
        });
        this.uniforms = {
            tDiffuse: { value: null },
            tBloom0: { value: this._mips[0].texture },
            tBloom1: { value: this._mips[1].texture },
            tBloom2: { value: this._mips[2].texture },
            tBloom3: { value: this._mips[3].texture },
            uBloomIntensity: { value: this.bloomIntensity },
            uBloomTint: { value: this.bloomTint },
            uOn: { value: 1 },
            uABC: { value: new THREE.Vector3(2.8, 0.4, 2.1) },
            uDE: { value: new THREE.Vector2(0.5, 1.5) },
            uAmount: { value: 0.85 },
            uTint: { value: new THREE.Color(1, 1, 1) },
        };
        this.combineMaterial = makeMaterial(COMBINE, this.uniforms);
        this.fsQuad = new FullScreenQuad(this.prefilterMaterial);
    }

    setSize(width, height) {
        this._width = Math.max(1, width | 0);
        this._height = Math.max(1, height | 0);
        for (let i = 0; i < 4; i++) {
            const divisor = 2 ** (i + 2);
            const w = Math.max(1, Math.floor(this._width / divisor));
            const h = Math.max(1, Math.floor(this._height / divisor));
            this._mips[i].setSize(w, h);
            this._temps[i].setSize(w, h);
        }
    }

    setAmount(value) {
        this.uniforms.uAmount.value = Math.max(
            0,
            Math.min(1, Number(value) || 0),
        );
    }

    setParams(a, b, c, d, e) {
        this.uniforms.uABC.value.set(a, b, c);
        this.uniforms.uDE.value.set(d, e);
    }

    setBloom({ intensity, threshold, clamp, tint } = {}) {
        if (intensity != null)
            this.uniforms.uBloomIntensity.value = Math.max(
                0,
                Number(intensity) || 0,
            );
        if (threshold != null)
            this.prefilterMaterial.uniforms.uThreshold.value = Math.max(
                0,
                Number(threshold) || 0,
            );
        if (clamp != null)
            this.prefilterMaterial.uniforms.uClampMax.value = Math.max(
                1,
                Number(clamp) || 1,
            );
        if (tint != null) this.uniforms.uBloomTint.value.set(tint);
    }

    _draw(renderer, material, target, clear = true) {
        this.fsQuad.material = material;
        renderer.setRenderTarget(target);
        if (clear) renderer.clear();
        this.fsQuad.render(renderer);
    }

    render(renderer, writeBuffer, readBuffer) {
        if (
            this._width !== readBuffer.width ||
            this._height !== readBuffer.height
        )
            this.setSize(readBuffer.width, readBuffer.height);

        this.prefilterMaterial.uniforms.tDiffuse.value = readBuffer.texture;
        this._draw(renderer, this.prefilterMaterial, this._mips[0]);

        for (let i = 1; i < 4; i++) {
            const source = this._mips[i - 1];
            this.downsampleMaterial.uniforms.tDiffuse.value = source.texture;
            this.downsampleMaterial.uniforms.uTexelSize.value.set(
                1 / source.width,
                1 / source.height,
            );
            this._draw(renderer, this.downsampleMaterial, this._mips[i]);
        }

        // Source kernels: 4, 4, 6 and 14 samples. Sigma values below preserve
        // their increasing spread while keeping a fixed WebGL loop bound.
        const sigmas = [1.2, 1.2, 1.8, 4.2];
        for (let i = 0; i < 4; i++) {
            const mip = this._mips[i];
            this.blurMaterial.uniforms.uSigma.value = sigmas[i];
            this.blurMaterial.uniforms.uTexelSize.value.set(
                1 / mip.width,
                1 / mip.height,
            );
            this.blurMaterial.uniforms.tDiffuse.value = mip.texture;
            this.blurMaterial.uniforms.uDirection.value.set(0, 1);
            this._draw(renderer, this.blurMaterial, this._temps[i]);
            this.blurMaterial.uniforms.tDiffuse.value = this._temps[i].texture;
            this.blurMaterial.uniforms.uDirection.value.set(1, 0);
            this._draw(renderer, this.blurMaterial, mip);
        }

        this.uniforms.tDiffuse.value = readBuffer.texture;
        this._draw(
            renderer,
            this.combineMaterial,
            this.renderToScreen ? null : writeBuffer,
            this.clear,
        );
    }

    dispose() {
        this.prefilterMaterial.dispose();
        this.downsampleMaterial.dispose();
        this.blurMaterial.dispose();
        this.combineMaterial.dispose();
        this.fsQuad.dispose();
        for (const target of [...this._mips, ...this._temps]) target.dispose();
    }
}
