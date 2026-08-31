// weather-fog-pass.js — depth-aware ATMOSPHERE pass for AnimeStage (v2).
//
// One full-screen pass, three depth-aware effects (depth reused for free
// from SSAOPass's normal/depth render target — no extra scene renders):
//
//   1. HEIGHT FOG — analytic exponential integral (I. Quilez technique)
//      with wind-driven noise, light scattering toward the dominant light,
//      soft horizon veil, and INTERLEAVED-GRADIENT-NOISE DITHER
//      (Jimenez IGN, as popularized by Demofox's blue-noise fog and the
//      MIT gam0022/volumetric-fog) — kills banding completely.
//   2. SNOW VEIL — Baldwin "Just Snow" multi-parallax flake layers for
//      distant snow depth. Depth-gated: never draws over near geometry.
//      (A screen-space rain veil was tried and removed — screen-locked
//      streaks read as "stuck to the camera"; rain density comes from the
//      world-space particle layers instead.)
//
// Enabled per-frame ONLY when (fog > 0 or a veil is active) AND a valid
// depth texture exists (raster mode with SSAO). RTX keeps its own sky fog.
// Deterministic: time is fed from the weather clock (timeline time offline).

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

const FRAG = /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4  uProjInv;
    uniform mat4  uCamWorld;
    uniform vec3  uCamPos;
    uniform float uTime;
    uniform float uDensity;       // overall fog amount
    uniform float uHeightFloor;   // world Y where fog is densest
    uniform float uHeightFalloff; // exp falloff with altitude
    uniform float uNoiseScale;
    uniform float uNoiseSpeed;
    uniform vec2  uWind;
    uniform vec3  uFogColor;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform float uScatter;
    uniform float uSkyCap;        // virtual distance for sky pixels
    uniform float uVeilSnow;      // snow-veil strength 0..1
    uniform float uSlant;         // screen-space rain slant from wind
    uniform float uAspect;
    varying vec2  vUv;

    float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
                   mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x),
                   f.y);
    }
    // Jimenez interleaved gradient noise — per-pixel dither, no texture
    float ign(vec2 px) {
        return fract(52.9829189 * fract(0.06711056 * px.x + 0.00583715 * px.y));
    }
    // Baldwin-style multi-parallax snow veil (5 depth layers)
    float snowVeil(vec2 uv, float t) {
        float acc = 0.0;
        for (int i = 0; i < 5; i++) {
            float fi = float(i + 1);
            float depth = fi / 5.0;
            float sc = 7.0 + fi * 9.0;
            vec2 p = vec2(uv.x * uAspect, uv.y) * sc;
            p.y += t * (0.35 + depth * 0.55) * sc * 0.14;
            p.x += uSlant * t * 0.4 * sc * 0.14 * depth
                 + sin(t * 0.5 + fi * 1.7) * 0.35;
            vec2 cell = floor(p);
            vec2 f = fract(p) - 0.5;
            vec2 h = vec2(hash21(cell + fi * 3.1), hash21(cell + fi * 7.7)) - 0.5;
            float d = length(f - h * 0.7);
            float fl = smoothstep(0.10 + depth * 0.04, 0.01, d)
                     * step(0.72, hash21(cell + 5.3));
            acc += fl * (1.0 - depth * 0.55);
        }
        return acc;
    }

    void main() {
        vec4 scene = texture2D(tDiffuse, vUv);
        float z = texture2D(tDepth, vUv).x;
        vec4 ndc = vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
        vec4 vp = uProjInv * ndc;
        vp.xyz /= vp.w;
        float dist = length(vp.xyz);
        vec3 wp = (uCamWorld * vec4(vp.xyz, 1.0)).xyz;
        vec3 rd = normalize(wp - uCamPos);
        bool sky = z > 0.99995;
        if (sky) {
            dist = uSkyCap;
            wp = uCamPos + rd * dist;
        }
        // analytic exponential height-fog integral along the view ray
        float hf = max(uHeightFalloff, 1e-3);
        float ryd = rd.y;
        if (abs(ryd) < 1e-3) ryd = 1e-3;
        float relH = max(uCamPos.y - uHeightFloor, 0.0);
        float fogAmount = uDensity * exp(-relH * hf)
                        * (1.0 - exp(-dist * ryd * hf)) / (ryd * hf);
        // animated density breakup (wind-driven, low frequency)
        vec2 np = wp.xz * uNoiseScale + uWind * uTime * uNoiseSpeed * 0.02;
        float n = vnoise(np) * 0.65 + vnoise(np * 2.7 + 13.1) * 0.35;
        fogAmount *= 0.65 + 0.7 * n;
        // IGN dither — breaks up banding in the smooth fog gradient
        fogAmount += (ign(gl_FragCoord.xy) - 0.5) * 0.03;
        fogAmount = clamp(fogAmount, 0.0, 0.94);
        // scattering: fog glows toward the dominant light
        float s = pow(max(dot(rd, uSunDir), 0.0), 8.0) * uScatter;
        vec3 fogCol = mix(uFogColor, uSunColor, clamp(s, 0.0, 1.0));
        vec3 col = mix(scene.rgb, fogCol, fogAmount);
        // ---- depth-gated snow veil (mid/far field only) ----
        float gate = smoothstep(5.0, 16.0, dist);
        if (uVeilSnow > 0.001 && gate > 0.001) {
            float sv = snowVeil(vUv, uTime) * uVeilSnow * gate;
            vec3 snowCol = mix(vec3(0.93, 0.95, 0.99), uSunColor, clamp(s * 0.4, 0.0, 1.0));
            col = mix(col, snowCol, clamp(sv, 0.0, 0.85));
        }
        gl_FragColor = vec4(col, scene.a);
    }
`;

const VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export class WeatherFogPass extends Pass {
    constructor(camera) {
        super();
        this.camera = camera;
        this.enabled = false; // gated per-frame by the weather system
        this.uniforms = {
            tDiffuse: { value: null },
            tDepth: { value: null },
            uProjInv: { value: new THREE.Matrix4() },
            uCamWorld: { value: new THREE.Matrix4() },
            uCamPos: { value: new THREE.Vector3() },
            uTime: { value: 0 },
            uDensity: { value: 0.0 },
            uHeightFloor: { value: 0 },
            uHeightFalloff: { value: 0.16 },
            uNoiseScale: { value: 0.05 },
            uNoiseSpeed: { value: 1 },
            uWind: { value: new THREE.Vector2(1, 0) },
            uFogColor: { value: new THREE.Color(0.62, 0.66, 0.72) },
            uSunDir: { value: new THREE.Vector3(0, 1, 0) },
            uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
            uScatter: { value: 0.7 },
            uSkyCap: { value: 90 },
            uVeilSnow: { value: 0 },
            uSlant: { value: 0 },
            uAspect: { value: 16 / 9 },
        };
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: this.uniforms,
            depthTest: false,
            depthWrite: false,
        });
        this.fsQuad = new FullScreenQuad(this.material);
    }

    // called per frame by the weather integration
    sync({ depthTexture, time, density, height, falloff, noiseScale, noiseSpeed, wind, fogColor, sunDir, sunColor, scatter, veilSnow, slant, aspect }) {
        const u = this.uniforms;
        u.tDepth.value = depthTexture;
        u.uTime.value = time;
        u.uDensity.value = density;
        if (height !== undefined) u.uHeightFloor.value = 0, u.uHeightFalloff.value = 1 / Math.max(height, 0.5);
        if (falloff !== undefined && falloff > 0) u.uHeightFalloff.value = falloff;
        if (noiseScale !== undefined) u.uNoiseScale.value = noiseScale;
        if (noiseSpeed !== undefined) u.uNoiseSpeed.value = noiseSpeed;
        if (wind) u.uWind.value.copy(wind);
        if (fogColor) u.uFogColor.value.copy(fogColor);
        if (sunDir) u.uSunDir.value.copy(sunDir);
        if (sunColor) u.uSunColor.value.copy(sunColor);
        if (scatter !== undefined) u.uScatter.value = scatter;
        if (veilSnow !== undefined) u.uVeilSnow.value = veilSnow;
        if (slant !== undefined) u.uSlant.value = slant;
        if (aspect !== undefined) u.uAspect.value = aspect;
        u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
        u.uCamWorld.value.copy(this.camera.matrixWorld);
        u.uCamPos.value.setFromMatrixPosition(this.camera.matrixWorld);
    }

    render(renderer, writeBuffer, readBuffer) {
        this.uniforms.tDiffuse.value = readBuffer.texture;
        if (this.renderToScreen) {
            renderer.setRenderTarget(null);
        } else {
            renderer.setRenderTarget(writeBuffer);
            if (this.clear) renderer.clear();
        }
        this.fsQuad.render(renderer);
    }

    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
    }
}
