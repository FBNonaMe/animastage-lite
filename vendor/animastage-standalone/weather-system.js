// weather-system.js — AnimeStage Weather & Atmosphere System (v2 core)
//
// Replaces the legacy PointsMaterial precipitation with a layered, GPU-clock,
// fully deterministic particle system:
//
//   RAIN  : 3 layers (near/mid/far) of velocity-aligned instanced streak quads.
//           Wind + per-drop turbulence, speed/length/opacity variation, taper,
//           soft edges, lighting tint, manual fog blend, near-camera fade.
//   SNOW  : 3 layers of rotating billboard flakes, 4 procedural sprite
//           variants, desynchronized sinusoidal drift, gust response.
//   SPLASH: deterministic ground-collision ripple rings around the camera
//           (plane collision at groundY — no raycasts, zero CPU cost).
//
// DETERMINISM: particle position is a *pure function* of (per-instance seed,
// uTime, wind uniforms). There are no CPU position updates and no per-frame
// buffer uploads. Seeking, reverse seeking and offline video export reproduce
// frames exactly: drive update(dt, timeSec) with the timeline time and the
// same frame renders twice identically. Interactive mode accumulates dt.
// The seed for instance attributes comes from state.seed via mulberry32.
//
// CAMERA-RELATIVE VOLUME: XZ wraps in a tile centered on the camera, Y spans
// [groundY, groundY + spawnHeight]. Drops are world-stable between wraps —
// they are NOT locked to the camera, there is no visible boundary wall and no
// repeating cube at normal intensities.
//
// Technique references (independently implemented, no code copied):
//   - three.js official webgpu_compute_particles_rain / _snow examples (MIT)
//   - NewKrok/three-particles emitter/lifetime architecture (MIT)
//
// License: part of AnimeStage. No new runtime dependencies.

import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ------------------------------------------------------------------ */
/* shared GLSL                                                         */
/* ------------------------------------------------------------------ */
const GLSL_FOG = /* glsl */ `
    uniform vec3  uFogColor;
    uniform float uFogDensity;
    vec3 applyWeatherFog(vec3 col, float dist) {
        float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        return mix(col, uFogColor, clamp(f, 0.0, 1.0));
    }
`;

// World-stable wrapped position inside a camera-centered XZ tile.
// sim  = unbounded simulated position, anchor = camera XZ / ground Y.
const GLSL_WRAP = /* glsl */ `
    vec3 wrapVolume(vec3 sim, vec3 camPos, float groundY, float size, float height) {
        vec3 lo = vec3(camPos.x - size * 0.5, groundY, camPos.z - size * 0.5);
        return vec3(
            lo.x + mod(sim.x - lo.x, size),
            lo.y + mod(sim.y - lo.y, height),
            lo.z + mod(sim.z - lo.z, size)
        );
    }
`;

/* ------------------------------------------------------------------ */
/* RAIN layer — photometric procedural streak (v2)                     */
/*                                                                     */
/* Width and length are SCREEN-SPACE:                                  */
/*   uProjScale = bufferHeightPx / (2·tan(fov/2))  → px per world unit */
/*   at viewZ = 1. Quad width = clamped pixel width converted back to  */
/*   world units at the drop's distance; streak length = |velocity| ·  */
/*   shutter, projected to pixels and clamped per layer. Result: rain  */
/*   stays a ~1 px water filament at every camera distance — never a   */
/*   world-space smear.                                                */
/*                                                                     */
/* Shading is a lightweight water optical model: analytic cylinder     */
/* normal across the streak, fresnel environment tint, Blinn specular  */
/* from the dominant scene light (fragment), up to 2 local-light       */
/* glints (vertex), per-drop brightness hash + rare flash drops.       */
/* Unlit rain is nearly invisible; backlit rain flashes.               */
/* ------------------------------------------------------------------ */
const RAIN_VERT = /* glsl */ `
    attribute vec4 aSeed;         // xyz: spawn hash, w: variation hash
    uniform float uTime;
    uniform vec3  uCamPos;
    uniform float uGroundY;
    uniform float uSize;          // XZ tile size
    uniform float uHeight;        // spawn height above ground
    uniform vec2  uWindVec;       // world XZ wind (units/s)
    uniform float uTurb;          // turbulence amplitude
    uniform float uSpeed;         // base fall speed
    uniform float uSpeedVar;      // 0..1
    uniform float uProjScale;    // px per world unit at viewZ = 1
    uniform float uShutter;      // virtual shutter (s)
    uniform float uLenScale;     // user length multiplier
    uniform float uMinLenPx;
    uniform float uMaxLenPx;
    uniform float uCorePx;       // core width (px), pre-clamped on CPU
    uniform float uHaloMul;      // halo width multiplier
    uniform float uNearFade;     // fade-in start distance
    uniform float uFarFade;      // fade-out end distance
    uniform vec3  uLocalPos0;    // local light glints (color premultiplied
    uniform vec3  uLocalCol0;    //  with intensity; black = disabled)
    uniform vec3  uLocalPos1;
    uniform vec3  uLocalCol1;
    varying vec2  vUv;
    varying float vFade;
    varying float vDist;
    varying float vHalfWPx;      // half quad width in px
    varying float vBright;       // per-drop brightness variation
    varying vec3  vSide;
    varying vec3  vView;         // surface → camera
    varying vec3  vLocalSpec;
    ${GLSL_WRAP}
    void main() {
        vUv = uv;
        float spd = uSpeed * (1.0 + (aSeed.w - 0.5) * 2.0 * uSpeedVar);
        // unbounded simulation — pure function of seed + time
        float ph  = aSeed.x * 39.17 + aSeed.z * 87.31;
        vec2 turb = uTurb * vec2(
            sin(uTime * (1.7 + aSeed.y * 1.3) + ph),
            cos(uTime * (1.3 + aSeed.x * 1.1) + ph * 1.61)
        );
        vec3 sim = vec3(
            aSeed.x * uSize + uWindVec.x * uTime + turb.x,
            aSeed.y * uHeight - spd * uTime,
            aSeed.z * uSize + uWindVec.y * uTime + turb.y
        );
        vec3 world = wrapVolume(sim, uCamPos, uGroundY, uSize, uHeight);

        vec3 vel = vec3(uWindVec.x, -spd, uWindVec.y);
        float velMag = max(length(vel), 1e-4);
        vec3 dir = vel / velMag;
        vec3 toCam = world - cameraPosition;
        float dist = max(length(toCam), 0.05);
        vec3 viewDir = toCam / dist;
        float pxPerUnit = uProjScale / dist;

        // ---- screen-space width: quad wide enough for core + halo + AA
        float halfQuadPx = max(uCorePx * uHaloMul * 2.2, 1.6);
        float halfW = halfQuadPx / pxPerUnit;

        // ---- projected shutter length, clamped in pixels per layer
        float lenWorld = velMag * uShutter * uLenScale;
        float perp = length(dir - viewDir * dot(dir, viewDir));
        float lenPx = clamp(lenWorld * max(perp, 0.15) * pxPerUnit,
                            uMinLenPx, uMaxLenPx);
        float lenW = lenPx / pxPerUnit / max(perp, 0.3);

        vec3 side = normalize(cross(viewDir, dir));
        vec3 p = world + dir * (uv.y - 0.5) * lenW
                       + side * (uv.x - 0.5) * 2.0 * halfW;

        // per-drop brightness hash + ~3% flash drops
        float b = 0.45 + fract(aSeed.x * 91.7 + aSeed.w * 47.3) * 0.8;
        if (fract(aSeed.z * 113.1 + aSeed.y * 71.3) > 0.97) b *= 2.2;

        // local-light glints (per-drop; cylinder-center normal ≈ V)
        vec3 V = -viewDir;
        vec3 spec = vec3(0.0);
        {
            vec3 Ld = uLocalPos0 - world;
            float d2 = max(dot(Ld, Ld), 1e-4);
            vec3 H = normalize(V + Ld * inversesqrt(d2));
            spec += uLocalCol0 * pow(max(dot(V, H), 0.0), 24.0)
                  / (1.0 + 0.08 * d2);
        }
        {
            vec3 Ld = uLocalPos1 - world;
            float d2 = max(dot(Ld, Ld), 1e-4);
            vec3 H = normalize(V + Ld * inversesqrt(d2));
            spec += uLocalCol1 * pow(max(dot(V, H), 0.0), 24.0)
                  / (1.0 + 0.08 * d2);
        }

        vBright = b;
        vHalfWPx = halfQuadPx;
        vSide = side;
        vView = V;
        vLocalSpec = spec;
        vDist = dist;
        vFade = smoothstep(uNearFade * 0.35, uNearFade, dist)
              * (1.0 - smoothstep(uFarFade * 0.7, uFarFade, dist));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const RAIN_FRAG = /* glsl */ `
    precision highp float;
    uniform float uCorePx;       // core width in px
    uniform float uHaloMul;      // halo sigma multiplier
    uniform float uHaloStr;      // halo strength
    uniform float uOpacity;
    uniform vec3  uAmbTint;      // ambient/atmosphere tint
    uniform float uAmbStr;
    uniform vec3  uEnvColor;     // sky/environment color
    uniform float uEnvStr;
    uniform vec3  uLightDir;     // dominant light dir (to light, normalized)
    uniform vec3  uLightColor;   // color × intensity × exposure (black = none)
    uniform float uSpecStr;
    uniform float uSpecPow;
    varying vec2  vUv;
    varying float vFade;
    varying float vDist;
    varying float vHalfWPx;
    varying float vBright;
    varying vec3  vSide;
    varying vec3  vView;
    varying vec3  vLocalSpec;
    ${GLSL_FOG}
    void main() {
        // signed pixel offset across the streak
        float xPx = (vUv.x - 0.5) * 2.0 * vHalfWPx;

        // analytic px-space double gaussian: sharp water core + dim halo.
        // Sub-pixel cores widen to ~0.55 px with energy-conserving
        // amplitude (sigma/sigmaE) — resolution-aware AA, no flicker.
        float sigma  = max(uCorePx * 0.5, 0.02);
        float sigmaE = max(sigma, 0.55);
        float core = exp(-pow(xPx / sigmaE, 2.0)) * (sigma / sigmaE);
        float sigmaH = max(sigmaE * uHaloMul * 2.0, 1.0);
        float halo = exp(-pow(xPx / sigmaH, 2.0)) * uHaloStr;

        // asymmetric longitudinal profile: h = 0 at the falling head
        float h = 1.0 - vUv.y;
        float headIn = smoothstep(0.0, 0.06, h);          // sharp head tip
        float tail   = 1.0 - smoothstep(0.4, 1.0, h);     // long tail taper
        float headGlow = smoothstep(0.0, 0.05, h)
                       * (1.0 - smoothstep(0.05, 0.25, h));
        // subtle micro-breakup so streaks are not perfectly uniform
        float breakup = 0.85 + 0.15 * sin(vUv.y * 60.0 + vBright * 40.0);
        float coverage = (core + halo) * headIn * tail * breakup;
        if (coverage < 0.004) discard;

        // ---- water optical model: analytic cylinder normal
        float xN = clamp(xPx / max(sigmaE * 2.0, 0.6), -1.0, 1.0);
        vec3 V = normalize(vView);
        vec3 N = normalize(vSide * xN + V * sqrt(max(1.0 - xN * xN, 0.0)));
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        vec3 H = normalize(V + uLightDir);
        float spec = pow(max(dot(N, H), 0.0), uSpecPow);

        vec3 col = uAmbTint * uAmbStr
                 + uEnvColor * fres * uEnvStr
                 + uLightColor * spec * uSpecStr
                 + vLocalSpec * uSpecStr;
        col *= vBright;
        col += col * headGlow * 0.6;

        // body alpha low (weak transmission look); specular boosts alpha
        // so backlit streaks flash while unlit rain stays near-invisible
        float lum = dot(uLightColor, vec3(0.2126, 0.7152, 0.0722));
        float specA = clamp(spec * min(lum, 1.5) * uSpecStr * 0.35
                          + dot(vLocalSpec, vec3(0.33)) * 0.5, 0.0, 0.6);
        float a = coverage * vFade
                * (uOpacity * (0.55 + 0.45 * vBright) + specA);
        a = min(a, 0.85);
        if (a < 0.004) discard;
        col = applyWeatherFog(col, vDist);
        gl_FragColor = vec4(col, a);
    }
`;

/* ------------------------------------------------------------------ */
/* SNOW layer — procedural realistic flakes (v2)                       */
/*                                                                     */
/* No sprite atlas: every flake gets a UNIQUE irregular silhouette     */
/* from two angular harmonics of its seed (real distant snowflakes    */
/* are irregular clumps, not star clip-art). Motion is a leaf-fall     */
/* FLUTTER: flakes rock side to side, slip laterally as they rock and  */
/* bob vertically — not a uniform linear spin. Lighting: forward-      */
/* scattering glow when backlit by the dominant light + rare rotating  */
/* ice-crystal glints. Deterministic — pure function of seed + time.   */
/* ------------------------------------------------------------------ */
const SNOW_VERT = /* glsl */ `
    attribute vec4 aSeed;
    uniform float uTime;
    uniform vec3  uCamPos;
    uniform float uGroundY;
    uniform float uSize;
    uniform float uHeight;
    uniform vec2  uWindVec;
    uniform float uTurb;
    uniform float uSpeed;         // slow fall
    uniform float uDrift;         // flutter/drift amplitude
    uniform float uFlakeSize;
    uniform float uRotSpeed;
    uniform float uNearFade;
    uniform float uFarFade;
    uniform vec3  uLightDir;      // dominant light (to light)
    varying vec2  vUv;
    varying float vFade;
    varying float vDist;
    varying float vBrightS;
    varying vec4  vFlake;         // per-flake shape seeds
    varying float vScatter;       // backlit forward-scattering
    ${GLSL_WRAP}
    void main() {
        float spd = uSpeed * (0.6 + aSeed.w * 0.8);
        // leaf-fall flutter: rocking phase drives lateral slip + bob
        float rockPh = uTime * (0.9 + aSeed.x * 0.9) + aSeed.z * 6.2832;
        float rock = sin(rockPh);
        // desynchronized drift + rocking side-slip
        float f1 = 0.5 + aSeed.x * 0.9;
        float f2 = 0.4 + aSeed.z * 0.8;
        float p1 = aSeed.x * 42.7;
        float p2 = aSeed.z * 91.3;
        vec2 drift = uDrift * vec2(
            sin(uTime * f1 + p1) + 0.5 * sin(uTime * f2 * 1.7 + p2)
                + rock * 0.45,
            cos(uTime * f2 + p2) + 0.5 * cos(uTime * f1 * 1.3 + p1)
                + cos(rockPh * 0.7) * 0.3
        );
        vec2 turb = uTurb * vec2(sin(uTime * 0.9 + p2), cos(uTime * 0.7 + p1));
        float bob = cos(rockPh) * 0.12 * uDrift;
        vec3 sim = vec3(
            aSeed.x * uSize + uWindVec.x * uTime + drift.x + turb.x,
            aSeed.y * uHeight - spd * uTime + bob,
            aSeed.z * uSize + uWindVec.y * uTime + drift.y + turb.y
        );
        vec3 world = wrapVolume(sim, uCamPos, uGroundY, uSize, uHeight);
        // per-flake brightness variation (kills the uniform-white look)
        vBrightS = 0.55 + fract(aSeed.x * 73.1 + aSeed.w * 37.7) * 0.7;
        vFlake = vec4(
            fract(aSeed.x * 7.13), fract(aSeed.y * 11.71),
            fract(aSeed.z * 5.77), fract(aSeed.w * 9.31)
        );
        // rocking + slow spin (some flakes barely spin — seed-mixed)
        float ang = aSeed.w * 6.2832
                  + uTime * uRotSpeed * (aSeed.y - 0.5)
                  + rock * (0.45 + aSeed.w * 0.4);
        float ca = cos(ang), sa = sin(ang);
        vec2 c = (uv - 0.5) * uFlakeSize * (0.6 + aSeed.z * 0.8);
        vec2 rc = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 p = world + camRight * rc.x + camUp * rc.y;
        vec3 toC = world - cameraPosition;
        float dist = length(toC);
        // forward scattering: flakes between camera and light glow
        vScatter = pow(max(dot(toC / max(dist, 1e-4), uLightDir), 0.0), 4.0);
        vFade = smoothstep(uNearFade * 0.3, uNearFade, dist)
              * (1.0 - smoothstep(uFarFade * 0.7, uFarFade, dist));
        vDist = dist;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const SNOW_FRAG = /* glsl */ `
    precision highp float;
    uniform vec3  uColor;
    uniform vec3  uLight;
    uniform vec3  uLightColor;    // dominant light color × intensity
    uniform float uOpacity;
    uniform float uTime;
    varying vec2  vUv;
    varying float vFade;
    varying float vDist;
    varying float vBrightS;
    varying vec4  vFlake;
    varying float vScatter;
    ${GLSL_FOG}
    void main() {
        vec2 q = vUv * 2.0 - 1.0;
        float r = length(q);
        if (r > 1.0) discard;
        float ang = atan(q.y, q.x);
        // unique irregular silhouette: two angular harmonics per flake
        float wob = 0.7
            + 0.16 * sin(ang * (3.0 + floor(vFlake.x * 3.0)) + vFlake.y * 6.2832)
            + 0.12 * sin(ang * (6.0 + floor(vFlake.z * 4.0)) + vFlake.w * 6.2832);
        float body = smoothstep(wob, wob * 0.3, r);
        float core = smoothstep(0.45, 0.0, r);
        float m = body * (0.55 + 0.45 * core);
        if (m < 0.01) discard;
        // rare ice-crystal glints while the flake rotates
        float glint = 0.0;
        if (vFlake.x > 0.78) {
            glint = pow(max(sin(uTime * (2.0 + vFlake.y * 4.0)
                                + vFlake.z * 40.0), 0.0), 24.0);
        }
        vec3 col = uColor * uLight * vBrightS * (0.75 + 0.25 * core);
        col += uLightColor * (vScatter * 0.5 * m + glint * 0.9);
        float a = m * uOpacity * vFade * (0.6 + 0.4 * vBrightS);
        if (a < 0.004) discard;
        col = applyWeatherFog(col, vDist);
        gl_FragColor = vec4(col, a);
    }
`;

/* ------------------------------------------------------------------ */
/* SPLASH (ground-plane collision ripples)                             */
/* ------------------------------------------------------------------ */
const SPLASH_VERT = /* glsl */ `
    attribute vec4 aSeed;
    uniform float uTime;
    uniform vec3  uCamPos;
    uniform float uGroundY;
    uniform float uRadius;        // scatter radius around camera
    uniform float uRate;          // cycles per second
    uniform float uSizeMax;
    varying vec2  vUv;
    varying float vPhase;
    varying float vSeed;
    varying float vDist;
    // per-cycle position re-hash — a splash never repeats in place
    vec2 hash22(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.xx + p3.yz) * p3.zy);
    }
    void main() {
        float cyc = uTime * uRate * (0.7 + aSeed.w * 0.6) + aSeed.x * 17.0;
        float ci = floor(cyc);
        float ph = fract(cyc);
        vec2 rnd = hash22(aSeed.yz * 71.7 + vec2(ci * 0.618, ci * 0.414));
        vec2 xz = vec2(uCamPos.x, uCamPos.z) + (rnd - 0.5) * uRadius * 2.0;
        float s = mix(0.06, uSizeMax, ph);
        vec3 world = vec3(xz.x + (uv.x - 0.5) * s, uGroundY + 0.02, xz.y + (uv.y - 0.5) * s);
        vPhase = ph;
        vSeed = fract(aSeed.w + ci * 0.7548);
        vDist = length(world - cameraPosition);
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
    }
`;

// v2 splash: derivative-antialiased thin expanding ring + 2-3 tiny rising
// droplets. Separate material from rain streaks; no thick white circles.
const SPLASH_FRAG = /* glsl */ `
    precision highp float;
    uniform vec3  uColor;
    uniform vec3  uLight;
    uniform float uOpacity;
    varying vec2  vUv;
    varying float vPhase;
    varying float vSeed;
    varying float vDist;
    ${GLSL_FOG}
    void main() {
        vec2 q = vUv * 2.0 - 1.0;
        float r = length(q);
        float aa = fwidth(r) * 1.5 + 0.01;
        // thin expanding crown ring
        float re = 0.12 + vPhase * 0.82;
        float ring = smoothstep(aa + 0.02, 0.0, abs(r - re));
        // 2-3 tiny droplets arcing up-and-out from the impact
        float drops = 0.0;
        for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float ang = 6.2832 * (fi / 3.0 + vSeed);
            float rise = vPhase * (0.5 + fract(vSeed * 7.31 + fi) * 0.4);
            vec2 c = vec2(cos(ang), sin(ang)) * (0.15 + re * 0.45);
            c.y += rise;                      // pseudo-vertical arc
            drops += smoothstep(0.05 + aa, 0.0, length(q - c));
        }
        float fade = (1.0 - vPhase) * (1.0 - vPhase);
        float a = (ring * 0.7 + drops * 0.9) * fade * uOpacity;
        // distance cull — splashes only read close-up
        a *= 1.0 - smoothstep(10.0, 22.0, vDist);
        if (a < 0.004) discard;
        vec3 col = uColor * uLight;
        col = applyWeatherFog(col, vDist);
        gl_FragColor = vec4(col, a);
    }
`;

/* ------------------------------------------------------------------ */
/* instanced quad factory                                              */
/* ------------------------------------------------------------------ */
function makeInstancedQuad(maxCount, rng) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    // ZERO base positions: our shaders build vertices purely from `uv`, and
    // zero positions make the quads DEGENERATE for any scene.overrideMaterial
    // pass (SSAO normals/depth, shadow depth) — weather never pollutes
    // depth-based passes with phantom quads at the origin.
    geo.attributes.position = new THREE.BufferAttribute(
        new Float32Array(base.attributes.position.count * 3),
        3,
    );
    geo.attributes.uv = base.attributes.uv;
    const seeds = new Float32Array(maxCount * 4);
    for (let i = 0; i < maxCount * 4; i++) seeds[i] = rng();
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = maxCount;
    return geo;
}

/* ------------------------------------------------------------------ */
/* quality presets                                                     */
/* ------------------------------------------------------------------ */
const QUALITY = {
    lite:      { rainNear: 0,   rainMid: 900,  rainFar: 1200, snowNear: 0,   snowMid: 700,  snowFar: 900,  splash: 0,   turbMul: 0 },
    balanced:  { rainNear: 120, rainMid: 2600, rainFar: 3200, snowNear: 90,  snowMid: 1800, snowFar: 2400, splash: 160, turbMul: 1 },
    high:      { rainNear: 220, rainMid: 4200, rainFar: 5200, snowNear: 160, snowMid: 2800, snowFar: 3600, splash: 260, turbMul: 1 },
    cinematic: { rainNear: 320, rainMid: 6000, rainFar: 8000, snowNear: 240, snowMid: 4000, snowFar: 5000, splash: 400, turbMul: 1 },
};
const MAX = QUALITY.cinematic;

export const WEATHER_STATE_VERSION = 2;

export function defaultWeatherState() {
    return {
        version: WEATHER_STATE_VERSION,
        enabled: false,
        type: "none",          // none | rain | snow
        intensity: 1.0,        // 0..2
        quality: "balanced",   // lite | balanced | high | cinematic
        seed: 1337,
        wind: { direction: 35, speed: 5, turbulence: 0.5 },
        rain: {
            speed: 26, speedVar: 0.35, streakLength: 1.6, width: 0.035,
            opacity: 0.7, splash: 0.6, spawnHeight: 42, tileSize: 70,
            // v2 photometric streak controls
            shutter: 1 / 60,      // virtual shutter (s) → streak length
            coreWidth: 1.0,       // core px multiplier (clamped per layer)
            lightResponse: 1.0,   // specular / light glint multiplier
            style: "natural",     // active Rain Style preset name
        },
        snow: {
            fallSpeed: 1.8, drift: 0.9, rotation: 1.2, size: 0.42,
            opacity: 0.9, spawnHeight: 34, tileSize: 60,
        },
        surface: {
            puddles: 0.5,          // puddle amount on the floor
            droplets: 0.7,         // body droplet-bead amount on models
            dropletSize: 1.0,      // bead size multiplier
        },
        fog: {
            amount: 0,             // atmospheric fog pass strength
            height: 7,             // world units — fog layer thickness
            noiseScale: 0.05,
            speed: 1,
            scatter: 0.7,          // glow toward dominant light
            veil: 0.5,             // storm veil (screen-space rain/snow wall)
        },
        fogLink: true,
    };
}

/* ------------------------------------------------------------------ */
/* factory                                                             */
/* ------------------------------------------------------------------ */
export function createWeatherSystem({ scene, camera, layer = null, groundY = 0, getPixelHeight = null }) {
    const state = defaultWeatherState();
    const group = new THREE.Group();
    group.name = "AnimeStageWeather";
    group.visible = false;
    scene.add(group);

    let time = 0;                    // authoritative weather clock (seconds)
    const rng = mulberry32(state.seed);

    /* ---- shared uniform helpers ---- */
    const fogColor = new THREE.Color(0.62, 0.66, 0.72);
    const light = new THREE.Color(1, 1, 1);

    function baseUniforms() {
        return {
            uTime: { value: 0 },
            uCamPos: { value: new THREE.Vector3() },
            uGroundY: { value: groundY },
            uWindVec: { value: new THREE.Vector2() },
            uTurb: { value: 0 },
            uLight: { value: light },       // shared reference
            uFogColor: { value: fogColor }, // shared reference
            uFogDensity: { value: 0.0 },
        };
    }

    function makeMaterial(vert, frag, uniforms, blending = THREE.NormalBlending) {
        return new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending,
            side: THREE.DoubleSide,
        });
    }

    /* ---- rain layers (v2: screen-space px budgets per layer) ---- */
    // near: rare, slightly softer, stronger optics; mid: main water volume,
    // sharp and narrow; far: fine dim filaments blended into fog.
    const rainLayerDefs = [
        { key: "rainNear", size: 12,  heightMul: 0.6, corePx: 1.7, minWPx: 1.0,  maxWPx: 2.4,  haloMul: 2.5, haloStr: 0.45, minLenPx: 16, maxLenPx: 46, opMul: 0.6,  specMul: 1.2,  nearFade: 0.7, farCut: 7 },
        { key: "rainMid",  size: 46,  heightMul: 1.0, corePx: 1.0, minWPx: 0.55, maxWPx: 1.5,  haloMul: 1.8, haloStr: 0.32, minLenPx: 9,  maxLenPx: 30, opMul: 1.0,  specMul: 1.0,  nearFade: 1.4, farCut: 26 },
        { key: "rainFar",  size: 110, heightMul: 1.2, corePx: 0.5, minWPx: 0.25, maxWPx: 0.85, haloMul: 1.5, haloStr: 0.22, minLenPx: 3,  maxLenPx: 14, opMul: 0.7,  specMul: 0.45, nearFade: 14,  farCut: 60 },
    ];
    // shared photometric uniform objects (one CPU update feeds all layers)
    const ambTint = new THREE.Color(0.5, 0.54, 0.6);
    const envColor = new THREE.Color(0.55, 0.6, 0.7);
    const lightDir = new THREE.Vector3(0.3, 0.8, 0.2).normalize();
    const lightColor = new THREE.Color(0, 0, 0);
    const localPos = [new THREE.Vector3(), new THREE.Vector3()];
    const localCol = [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)];
    const rainLayers = rainLayerDefs.map((def) => {
        const uniforms = Object.assign(baseUniforms(), {
            uSize: { value: def.size },
            uHeight: { value: 40 },
            uSpeed: { value: 26 },
            uSpeedVar: { value: 0.35 },
            uProjScale: { value: 1713 },
            uShutter: { value: 1 / 60 },
            uLenScale: { value: 1.6 },
            uMinLenPx: { value: def.minLenPx },
            uMaxLenPx: { value: def.maxLenPx },
            uCorePx: { value: def.corePx },
            uHaloMul: { value: def.haloMul },
            uHaloStr: { value: def.haloStr },
            uOpacity: { value: 0.5 * def.opMul },
            uAmbTint: { value: ambTint },
            uAmbStr: { value: 0.35 },
            uEnvColor: { value: envColor },
            uEnvStr: { value: 0.5 },
            uLightDir: { value: lightDir },
            uLightColor: { value: lightColor },
            uSpecStr: { value: def.specMul },
            uSpecPow: { value: 60 },
            uLocalPos0: { value: localPos[0] },
            uLocalCol0: { value: localCol[0] },
            uLocalPos1: { value: localPos[1] },
            uLocalCol1: { value: localCol[1] },
            uNearFade: { value: def.nearFade },
            uFarFade: { value: def.farCut },
        });
        const geo = makeInstancedQuad(MAX[def.key] || 1, rng);
        const mesh = new THREE.Mesh(geo, makeMaterial(RAIN_VERT, RAIN_FRAG, uniforms));
        mesh.frustumCulled = false;
        mesh.renderOrder = 20;
        group.add(mesh);
        return { def, uniforms, geo, mesh };
    });

    /* ---- snow layers (procedural flakes — no atlas) ---- */
    const snowLayerDefs = [
        { key: "snowNear", size: 10, sizeMul: 2.4, opMul: 0.55, nearFade: 0.6, farCut: 6 },
        { key: "snowMid",  size: 40, sizeMul: 1.0, opMul: 1.0,  nearFade: 1.2, farCut: 24 },
        { key: "snowFar",  size: 90, sizeMul: 0.7, opMul: 0.6,  nearFade: 12,  farCut: 50 },
    ];
    const snowLayers = snowLayerDefs.map((def) => {
        const uniforms = Object.assign(baseUniforms(), {
            uSize: { value: def.size },
            uHeight: { value: 34 },
            uSpeed: { value: 1.8 },
            uDrift: { value: 0.9 },
            uFlakeSize: { value: 0.34 * def.sizeMul },
            uRotSpeed: { value: 1.2 },
            uOpacity: { value: 0.85 * def.opMul },
            uColor: { value: new THREE.Color(0.96, 0.97, 1.0) },
            uLightDir: { value: lightDir },     // shared photometric feed
            uLightColor: { value: lightColor },
            uNearFade: { value: def.nearFade },
            uFarFade: { value: def.farCut },
        });
        const geo = makeInstancedQuad(MAX[def.key] || 1, rng);
        const mesh = new THREE.Mesh(geo, makeMaterial(SNOW_VERT, SNOW_FRAG, uniforms));
        mesh.frustumCulled = false;
        mesh.renderOrder = 20;
        group.add(mesh);
        return { def, uniforms, geo, mesh };
    });

    /* ---- splash ---- */
    const splashUniforms = Object.assign(baseUniforms(), {
        uRadius: { value: 14 },
        uRate: { value: 1.1 },
        uSizeMax: { value: 0.85 },
        uOpacity: { value: 0.4 },
        uColor: { value: new THREE.Color(0.8, 0.86, 0.95) },
    });
    const splashGeo = makeInstancedQuad(MAX.splash, rng);
    const splashMesh = new THREE.Mesh(
        splashGeo,
        makeMaterial(SPLASH_VERT, SPLASH_FRAG, splashUniforms),
    );
    splashMesh.frustumCulled = false;
    splashMesh.renderOrder = 19;
    group.add(splashMesh);

    if (layer !== null) {
        group.traverse((o) => o.layers && o.layers.set(layer));
    }

    /* ---- diagnostics ---- */
    const diag = {
        backend: "webgl2-gpu-clock",
        activeParticles: 0,
        drawCalls: 0,
        splashCount: 0,
        quality: state.quality,
        seed: state.seed,
        clock: "interactive",
    };

    /* ------------------------------------------------------------- */
    /* apply state → uniforms / visibility                            */
    /* ------------------------------------------------------------- */
    function apply() {
        const q = QUALITY[state.quality] || QUALITY.balanced;
        const isRain = state.enabled && state.type === "rain" && state.intensity > 0.01;
        const isSnow = state.enabled && state.type === "snow" && state.intensity > 0.01;
        group.visible = isRain || isSnow;
        const dens = Math.min(2, Math.max(0, state.intensity));
        const densN = Math.min(1, dens); // opacity uses saturating curve
        diag.activeParticles = 0;
        diag.drawCalls = 0;

        rainLayers.forEach((L) => {
            const max = MAX[L.def.key] || 1;
            const n = Math.min(max, Math.round((q[L.def.key] ?? 0) * dens));
            L.geo.instanceCount = isRain ? Math.max(0, n) : 0;
            L.mesh.visible = isRain && n > 0;
            if (L.mesh.visible) {
                diag.activeParticles += n;
                diag.drawCalls++;
            }
            const u = L.uniforms;
            u.uHeight.value = state.rain.spawnHeight * L.def.heightMul;
            u.uSpeed.value = state.rain.speed;
            u.uSpeedVar.value = state.rain.speedVar;
            u.uShutter.value = Math.max(1 / 500, state.rain.shutter ?? 1 / 60);
            u.uLenScale.value = state.rain.streakLength;
            // core width: user multiplier, clamped to the layer's px range
            u.uCorePx.value = Math.min(
                L.def.maxWPx,
                Math.max(L.def.minWPx, L.def.corePx * (state.rain.coreWidth ?? 1)),
            );
            u.uSpecStr.value = L.def.specMul * (state.rain.lightResponse ?? 1);
            u.uOpacity.value = state.rain.opacity * L.def.opMul * (0.55 + densN * 0.45);
        });

        snowLayers.forEach((L) => {
            const max = MAX[L.def.key] || 1;
            const n = Math.min(max, Math.round((q[L.def.key] ?? 0) * dens));
            L.geo.instanceCount = isSnow ? Math.max(0, n) : 0;
            L.mesh.visible = isSnow && n > 0;
            if (L.mesh.visible) {
                diag.activeParticles += n;
                diag.drawCalls++;
            }
            const u = L.uniforms;
            u.uHeight.value = state.snow.spawnHeight;
            u.uSpeed.value = state.snow.fallSpeed;
            u.uDrift.value = state.snow.drift;
            u.uRotSpeed.value = state.snow.rotation;
            u.uFlakeSize.value = state.snow.size * L.def.sizeMul;
            u.uOpacity.value = state.snow.opacity * L.def.opMul * (0.6 + densN * 0.4);
        });

        const splashes = isRain ? Math.round(q.splash * Math.min(1.5, dens) * state.rain.splash) : 0;
        splashGeo.instanceCount = splashes;
        splashMesh.visible = splashes > 0;
        if (splashMesh.visible) diag.drawCalls++;
        diag.splashCount = splashes;
        splashUniforms.uOpacity.value = 0.42 * Math.min(1, state.rain.splash + 0.2);
        splashUniforms.uRate.value = 0.8 + dens * 0.6;

        diag.quality = state.quality;
        diag.seed = state.seed;
    }

    /* ------------------------------------------------------------- */
    /* per-frame                                                      */
    /* ------------------------------------------------------------- */
    const windVec = new THREE.Vector2();
    function update(dt, timeSec = null) {
        if (timeSec !== null && Number.isFinite(timeSec)) {
            time = timeSec;
            diag.clock = "timeline";
        } else {
            time += Math.min(dt || 0, 0.1);
            diag.clock = "interactive";
        }
        if (!group.visible) return;
        const dirRad = (state.wind.direction * Math.PI) / 180;
        windVec.set(Math.cos(dirRad), Math.sin(dirRad)).multiplyScalar(state.wind.speed);
        const q = QUALITY[state.quality] || QUALITY.balanced;
        const turb = state.wind.turbulence * (q.turbMul ?? 1);
        // screen-space projection scale: px per world unit at viewZ = 1
        const hPx = (getPixelHeight && getPixelHeight()) || 1080;
        const projScale =
            hPx / (2 * Math.tan(((camera.fov || 35) * Math.PI) / 360));
        const all = [...rainLayers, ...snowLayers].map((L) => L.uniforms);
        all.push(splashUniforms);
        for (const u of all) {
            u.uTime.value = time;
            u.uCamPos.value.copy(camera.position);
            u.uWindVec.value.copy(windVec);
            u.uTurb.value = turb * (u.uDrift ? 0.4 : 1.0); // snow gets gentler turbulence
            u.uGroundY.value = groundY;
            if (u.uProjScale) u.uProjScale.value = projScale;
        }
    }

    /* env feed: lighting response + fog link (called per frame, cheap).
       v2: also drives the photometric rain model — dominant light
       direction/color, environment tint and up to 2 local light glints.
       All values land in SHARED uniform objects (zero allocation). */
    const _c = new THREE.Color();
    function updateEnv({
        sunColor,
        sunIntensity = 1,
        ambient = 0.4,
        exposure = 1,
        fogColor: fc,
        fogDensity = 0,
        night = 0,
        lightDir: ld = null,          // THREE.Vector3 (to light, normalized)
        lightColor: lc = null,        // THREE.Color
        lightIntensity = null,        // number (dominant light intensity)
        envColor: ec = null,          // THREE.Color sky/environment tint
        localLights = null,           // [{position:Vector3, color:Color, intensity}]
    } = {}) {
        const expF = Math.max(0.3, Math.min(1.8, exposure));
        // legacy tint (snow + splash body): ambient base + sun contribution
        const sunI = Math.min(2.5, Math.max(0, sunIntensity));
        _c.set(1, 1, 1);
        if (sunColor) _c.copy(sunColor);
        const l = Math.min(1.6, Math.max(0.18, ambient * 0.7 + sunI * 0.45)) * expF;
        light.setRGB(
            (0.35 + _c.r * 0.65) * l,
            (0.35 + _c.g * 0.65) * l,
            (0.35 + _c.b * 0.65) * l,
        );
        if (night > 0.4) light.multiplyScalar(0.75);

        // ---- photometric rain feed ----
        // ambient tint: atmosphere the water sits in (fog color when linked)
        ambTint.copy(fc || _c).multiplyScalar(Math.max(0.15, ambient) * expF);
        if (ec) envColor.copy(ec).multiplyScalar(expF);
        else envColor.copy(ambTint).multiplyScalar(1.2);
        if (ld) lightDir.copy(ld);
        const domI = lightIntensity !== null ? lightIntensity : sunI;
        if (lc) lightColor.copy(lc).multiplyScalar(Math.min(3, domI) * expF);
        else lightColor.copy(_c).multiplyScalar(Math.min(3, domI) * expF * 0.8);
        for (let i = 0; i < 2; i++) {
            const src = localLights && localLights[i];
            if (src && src.position && src.color) {
                localPos[i].copy(src.position);
                localCol[i]
                    .copy(src.color)
                    .multiplyScalar(Math.min(6, src.intensity ?? 1) * expF);
            } else {
                localCol[i].setRGB(0, 0, 0);
            }
        }

        if (state.fogLink && fc) fogColor.copy(fc);
        const fd = state.fogLink ? fogDensity : 0;
        for (const L of [...rainLayers, ...snowLayers]) L.uniforms.uFogDensity.value = fd;
        splashUniforms.uFogDensity.value = fd;
    }

    /* ---- Rain Style presets (safe values, remain editable) ---- */
    const RAIN_STYLES = {
        light:   { intensity: 0.35, wind: { speed: 3,  turbulence: 0.3 },  shutter: 1 / 60, coreWidth: 0.9,  lightResponse: 0.9, opacity: 0.55 },
        natural: { intensity: 0.8,  wind: { speed: 6,  turbulence: 0.45 }, shutter: 1 / 60, coreWidth: 1.0,  lightResponse: 1.0, opacity: 0.68 },
        heavy:   { intensity: 1.4,  wind: { speed: 9,  turbulence: 0.6 },  shutter: 1 / 48, coreWidth: 1.15, lightResponse: 1.0, opacity: 0.78 },
        storm:   { intensity: 1.8,  wind: { speed: 16, turbulence: 0.9 },  shutter: 1 / 40, coreWidth: 1.25, lightResponse: 1.1, opacity: 0.85 },
        backlit: { intensity: 0.9,  wind: { speed: 7,  turbulence: 0.5 },  shutter: 1 / 30, coreWidth: 0.9,  lightResponse: 1.8, opacity: 0.6 },
        anime:   { intensity: 1.1,  wind: { speed: 8,  turbulence: 0.4 },  shutter: 1 / 30, coreWidth: 1.6,  lightResponse: 0.7, opacity: 0.9 },
    };
    function applyRainStyle(name) {
        const p = RAIN_STYLES[name];
        if (!p) return false;
        state.rain.style = name;
        state.intensity = p.intensity;
        Object.assign(state.wind, p.wind);
        state.rain.shutter = p.shutter;
        state.rain.coreWidth = p.coreWidth;
        state.rain.lightResponse = p.lightResponse;
        state.rain.opacity = p.opacity;
        apply();
        return true;
    }

    /* ------------------------------------------------------------- */
    /* serialization (versioned) + migration                          */
    /* ------------------------------------------------------------- */
    // Refill all aSeed instance attributes from state.seed. Iteration order
    // matches construction order exactly, so "fresh build with seed X" and
    // "reseed(X)" produce identical particle fields (offline determinism).
    function reseed() {
        const r2 = mulberry32(state.seed);
        const geos = [
            ...rainLayers.map((L) => L.geo),
            ...snowLayers.map((L) => L.geo),
            splashGeo,
        ];
        for (const g of geos) {
            const a = g.getAttribute("aSeed");
            for (let i = 0; i < a.array.length; i++) a.array[i] = r2();
            a.needsUpdate = true;
        }
    }
    function serialize() {
        return JSON.parse(JSON.stringify(state));
    }
    function deserialize(data) {
        if (!data || typeof data !== "object") return false;
        if (data.version === WEATHER_STATE_VERSION) {
            const d = defaultWeatherState();
            Object.assign(d.wind, data.wind);
            Object.assign(d.rain, data.rain);
            Object.assign(d.snow, data.snow);
            if (data.surface) Object.assign(d.surface, data.surface);
            if (data.fog) Object.assign(d.fog, data.fog);
            for (const k of ["enabled", "type", "intensity", "quality", "seed", "fogLink"]) {
                if (data[k] !== undefined) d[k] = data[k];
            }
            const seedChanged = d.seed !== state.seed;
            Object.assign(state, d);
            if (seedChanged) reseed();
            apply();
            return true;
        }
        return migrateLegacy(data);
    }
    // migration from the v1 system (preset name + intensity from S)
    function migrateLegacy({ weather, precipType, precipIntensity } = {}) {
        const type = precipType === 1 ? "rain" : precipType === 2 ? "snow" : "none";
        state.enabled = type !== "none";
        state.type = type;
        state.intensity = Math.min(2, precipIntensity ?? 1);
        if (weather === "storm") {
            state.wind.speed = 14;
            state.wind.turbulence = 0.9;
        }
        apply();
        return true;
    }

    apply();

    return {
        state,
        group,
        update,
        updateEnv,
        apply,
        serialize,
        deserialize,
        migrateLegacy,
        reseed,
        applyRainStyle,
        rainStyles: Object.keys(RAIN_STYLES),
        isActive: () => group.visible,
        getTime: () => time,
        getDiagnostics: () => ({ ...diag }),
        setGroundY: (y) => { groundY = y; },
        dispose() {
            scene.remove(group);
            group.traverse((o) => {
                o.geometry?.dispose?.();
                o.material?.dispose?.();
            });
        },
    };
}
