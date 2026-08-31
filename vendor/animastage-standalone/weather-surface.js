// weather-surface.js — AnimeStage Surface Weather Response (v2)
//
// Makes the WORLD react to weather instead of only drawing particles:
//
//   FLOOR   : procedural puddles (fbm mask) that reveal the REAL planar
//             Reflector under the painted floor (true reflections, zero new
//             passes), rain ripple normals (damped expanding rings),
//             wet darkening + roughness drop, snow cover with glints.
//   MODELS  : every MMDToon / Standard / Phong material gets a wetness patch
//             via onBeforeCompile with THREE visible components:
//               1. DROPLET BEADS (Arknights: Endfield-style) — a procedural
//                  cellular field of water beads anchored in OBJECT SPACE
//                  (they stick to the character while it moves), each bead
//                  perturbs the surface normal like a spherical cap BEFORE
//                  lighting, so every bead catches its own specular glint
//                  from the actual scene lights. Beads grow/fade on slow
//                  per-cell life cycles.
//               2. DRIP STREAKS — gravity columns in world space flowing
//                  down steep surfaces (skinning-aware).
//               3. WET BASE — albedo darkening + glossy sheen
//                  (shininess boost, specular floor).
//
// All patched materials share ONE uniform set — per-frame cost is a handful
// of scalar writes, zero allocation. Effects scale to zero when dry.
// Deterministic: time comes from the weather clock (timeline time offline).
//
// Techniques implemented independently from public descriptions (grid-cell
// ripples/beads, exp height fog, drip columns) — no external code copied.

import * as THREE from "three";

const GLSL_COMMON = /* glsl */ `
    uniform float uAswWetness;
    uniform float uAswPuddle;
    uniform float uAswRain;
    uniform float uAswSnow;
    uniform float uAswTime;
    uniform float uAswDrops;      // bead amount 0..1
    uniform float uAswDropSize;   // bead size multiplier
    float aswHash(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
    }
    float aswNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(aswHash(i), aswHash(i + vec2(1, 0)), f.x),
            mix(aswHash(i + vec2(0, 1)), aswHash(i + vec2(1, 1)), f.x),
            f.y);
    }
    float aswFbm(vec2 p) {
        return aswNoise(p) * 0.6 + aswNoise(p * 2.13 + 7.7) * 0.4;
    }
`;

const GLSL_FLOOR = /* glsl */ `
    // puddle mask: soft-edged fbm threshold, more/larger puddles with amount
    float aswPuddleMask(vec2 p) {
        float n = aswFbm(p * 0.16);
        float th = mix(0.78, 0.35, clamp(uAswPuddle, 0.0, 1.0));
        return smoothstep(th, th + 0.14, n);
    }
    // expanding damped rain rings on two offset grids
    vec2 aswRippleGrad(vec2 p, float t) {
        vec2 g = vec2(0.0);
        for (int i = 0; i < 2; i++) {
            float fi = float(i);
            vec2 sp = p * (2.0 + fi * 0.73) + fi * 17.13;
            vec2 cell = floor(sp);
            vec2 f = fract(sp) - 0.5;
            float h = aswHash(cell + fi * 3.7);
            float cyc = t * (0.7 + h * 0.9) + h * 11.0;
            float ph = fract(cyc);
            float ci = floor(cyc);
            vec2 off = vec2(aswHash(cell + ci * 0.31 + 3.1),
                            aswHash(cell + ci * 0.47 + 5.7)) - 0.5;
            vec2 d = f - off * 0.5;
            float r = length(d) + 1e-4;
            float ring = r - ph * 0.55;
            float w = cos(ring * 42.0) * exp(-r * 4.5)
                    * (1.0 - ph) * smoothstep(0.0, 0.08, ph);
            g += (d / r) * w;
        }
        return g;
    }
    float aswSparkle(vec2 p, float t) {
        float n = aswHash(floor(p * 14.0));
        float tw = sin(t * (3.0 + n * 6.0) + n * 40.0) * 0.5 + 0.5;
        return pow(n * tw, 24.0) * 3.0;
    }
`;

const GLSL_DRIP = /* glsl */ `
    // gravity drip streaks: thin world-space columns with droplet pulses
    // running DOWN over time; masked to steep surfaces by the caller.
    // Motion math: a feature sits where fract(wp.y*k + t*s) = c, i.e.
    // wp.y = (c - t*s)/k — its world Y DECREASES as t grows ⇒ the drop
    // falls. (A -wp.y sign here made drips crawl UP — fixed.)
    float aswDrip(vec3 wp, float t) {
        float u = wp.x * 2.9 + wp.z * 2.3;
        float col = floor(u * 4.0);
        float h = aswHash(vec2(col, 7.0));
        float line = smoothstep(0.86, 0.985, fract(u * 4.0 + h));
        float v = wp.y * 1.3 + t * (0.35 + h * 0.55) + h * 13.0;
        float g = fract(v);
        // g increases UP the column: sharp droplet front at the bottom
        // (g≈0.6), water trail fading upward behind it
        float head = smoothstep(0.52, 0.62, g);
        float decay = 1.0 - smoothstep(0.62, 1.0, g);
        return line * head * mix(0.18, 1.0, decay);
    }
`;

// Endfield-style water beads. Anchored in OBJECT space (op) so they stick to
// the moving character. Projection plane picked by the dominant axis of the
// object-space normal. Returns bead coverage; outGrad = 2D normal gradient
// (spherical-cap slope) for specular glints.
const GLSL_BEADS = /* glsl */ `
    float aswBeadLayer(vec2 p, float t, float scale, float seed, out vec2 grad) {
        p = p * scale + seed;
        vec2 cell = floor(p);
        vec2 f = fract(p) - 0.5;
        float h = aswHash(cell + seed);
        // density gate: more beads with uAswDrops
        float exist = step(h, clamp(uAswDrops, 0.0, 1.0) * 0.75 + 0.05);
        // slow life cycle: appear → sit → fade; new offset each cycle
        float cyc = t * (0.10 + h * 0.16) + h * 9.0;
        float ph = fract(cyc);
        float ci = floor(cyc);
        vec2 off = (vec2(aswHash(cell + ci * 0.37 + 1.3),
                         aswHash(cell + ci * 0.53 + 2.7)) - 0.5) * 0.55;
        vec2 d = f - off;
        float r = length(d);
        float size = (0.14 + h * 0.2) * uAswDropSize
                   * (0.55 + 0.45 * sin(ph * 3.14159));
        float m = smoothstep(size, size * 0.45, r) * exist;
        // spherical-cap slope: strongest at bead rim, zero at center
        float rim = smoothstep(0.0, size, r) * m;
        grad = (r > 1e-4 ? d / r : vec2(0.0)) * rim;
        return m;
    }
    float aswBeads(vec3 op, vec3 onrm, float t, out vec2 gradSum) {
        vec3 an = abs(onrm) + 1e-4;
        vec2 p = (an.y >= an.x && an.y >= an.z) ? op.xz
               : (an.x >= an.z) ? op.zy : op.xy;
        vec2 g1, g2;
        // two overlapping layers → varied sizes, no visible grid
        float m1 = aswBeadLayer(p, t, 7.0, 3.1, g1);
        float m2 = aswBeadLayer(p, t, 11.7, 27.7, g2);
        gradSum = g1 + g2 * 0.7;
        return max(m1, m2 * 0.85);
    }
`;

export function createWeatherSurface({ scene, floorMesh = null }) {
    const U = {
        uAswWetness: { value: 0 },
        uAswPuddle: { value: 0.5 },
        uAswRain: { value: 0 },
        uAswSnow: { value: 0 },
        uAswTime: { value: 0 },
        uAswDrops: { value: 0.7 },
        uAswDropSize: { value: 1 },
    };
    const patched = new WeakSet();
    const diag = { floorPatched: false, materialsPatched: 0, lastScan: 0 };

    function bindShared(shader) {
        for (const k in U) shader.uniforms[k] = U[k];
    }

    /* -------------------- floor (MeshStandardMaterial) --------------- */
    function patchFloor() {
        const mat = floorMesh && floorMesh.material;
        if (!mat || !mat.isMeshStandardMaterial || patched.has(mat)) return;
        patched.add(mat);
        mat.onBeforeCompile = (shader) => {
            bindShared(shader);
            shader.vertexShader = shader.vertexShader
                .replace(
                    "#include <common>",
                    "#include <common>\nvarying vec3 vAswPos;",
                )
                .replace(
                    "#include <project_vertex>",
                    "#include <project_vertex>\nvAswPos = (modelMatrix * vec4(transformed, 1.0)).xyz;",
                );
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>\nvarying vec3 vAswPos;\n${GLSL_COMMON}\n${GLSL_FLOOR}`,
                )
                .replace(
                    "#include <map_fragment>",
                    /* glsl */ `#include <map_fragment>
    float aswWet = clamp(uAswWetness, 0.0, 1.0);
    float aswPd = aswPuddleMask(vAswPos.xz) * aswWet;
    diffuseColor.rgb *= 1.0 - (0.3 * aswWet + 0.3 * aswPd);
    diffuseColor.a = mix(diffuseColor.a, min(diffuseColor.a, 0.1), aswPd);
    float aswSnowM = clamp(uAswSnow * (0.45 + 0.55 * aswFbm(vAswPos.xz * 0.3)), 0.0, 1.0);
    if (aswSnowM > 0.001) {
        vec3 snowCol = vec3(0.9, 0.93, 0.98) * (0.85 + 0.15 * aswNoise(vAswPos.xz * 2.0));
        snowCol += vec3(aswSparkle(vAswPos.xz, uAswTime)) * 0.6;
        diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, aswSnowM);
        diffuseColor.a = mix(diffuseColor.a, 0.98, aswSnowM);
    }`,
                )
                .replace(
                    "#include <roughnessmap_fragment>",
                    /* glsl */ `#include <roughnessmap_fragment>
    roughnessFactor = mix(roughnessFactor, 0.04, max(aswPd, aswWet * 0.55));
    roughnessFactor = mix(roughnessFactor, 0.85, aswSnowM);`,
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    /* glsl */ `#include <normal_fragment_maps>
    {
        float aswRipAmt = uAswRain * (0.4 + 0.6 * aswPd) * aswWet;
        if (aswRipAmt > 0.001) {
            vec2 aswG = aswRippleGrad(vAswPos.xz, uAswTime) * aswRipAmt;
            vec3 aswNW = normalize(vec3(aswG.x, 1.0, aswG.y));
            vec3 aswNV = normalize((viewMatrix * vec4(aswNW, 0.0)).xyz);
            normal = normalize(mix(normal, aswNV, clamp(aswRipAmt * 3.0, 0.0, 1.0)));
        }
    }`,
                );
        };
        mat.needsUpdate = true;
        diag.floorPatched = true;
    }

    /* ---- shared vertex injection for models (object + world anchors) --- */
    function injectModelVertex(vs) {
        return vs
            .replace(
                "#include <common>",
                "#include <common>\nvarying vec3 vAswPos;\nvarying vec3 vAswOPos;\nvarying vec3 vAswON;\nvarying float vAswNY;",
            )
            .replace(
                "#include <defaultnormal_vertex>",
                "#include <defaultnormal_vertex>\nvAswON = normalize(objectNormal);\nvAswNY = normalize(mat3(modelMatrix) * objectNormal).y;",
            )
            .replace(
                "#include <project_vertex>",
                /* glsl */ `#include <project_vertex>
    vAswPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vAswOPos = transformed;`,
            );
    }

    const MODEL_FRAG_DECL = () =>
        `varying vec3 vAswPos;\nvarying vec3 vAswOPos;\nvarying vec3 vAswON;\nvarying float vAswNY;\n${GLSL_COMMON}\n${GLSL_DRIP}\n${GLSL_BEADS}`;

    // computed at map_fragment, consumed by later chunks
    const MODEL_WET_LOCALS = /* glsl */ `
    float aswW = clamp(uAswWetness, 0.0, 1.0);
    float aswNY = vAswNY;
    float aswBeadM = 0.0;
    vec2 aswBeadG = vec2(0.0);
    float aswD = 0.0;
    if (aswW > 0.001) {
        aswD = aswDrip(vAswPos, uAswTime) * clamp(1.0 - abs(aswNY), 0.0, 1.0) * aswW;
        aswBeadM = aswBeads(vAswOPos, vAswON, uAswTime, aswBeadG) * aswW;
    }
    diffuseColor.rgb *= 1.0 - 0.24 * aswW;
    // subtle darkening under each bead reads as water volume
    diffuseColor.rgb *= 1.0 - aswBeadM * 0.12;`;

    // per-bead normal perturbation BEFORE lighting → every bead catches its
    // own specular glint from real scene lights (the Endfield look)
    const MODEL_NORMAL_INJ = /* glsl */ `
    if (aswBeadM > 0.001 || aswD > 0.001) {
        vec2 aswNG = aswBeadG * 1.6 + vec2(aswD * 0.5, 0.0);
        normal = normalize(normal + vec3(aswNG, 0.0));
    }`;

    /* ------------- characters (MMDToon / Phong) ----------------------- */
    function patchToonOrPhong(mat) {
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
            // chain: Shader Studio / Anime Toon may already own this hook
            if (typeof prev === "function") prev.call(mat, shader, renderer);
            bindShared(shader);
            // idempotent: another chain link may have already injected us
            if (shader.fragmentShader.includes("aswBeads")) return;
            shader.vertexShader = injectModelVertex(shader.vertexShader);
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>\n${MODEL_FRAG_DECL()}`,
                )
                .replace(
                    "#include <map_fragment>",
                    `#include <map_fragment>\n${MODEL_WET_LOCALS}`,
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    `#include <normal_fragment_maps>\n${MODEL_NORMAL_INJ}`,
                )
                .replace(
                    "#include <lights_phong_fragment>",
                    /* glsl */ `#include <lights_phong_fragment>
    {
        material.specularShininess = mix(material.specularShininess, 110.0, aswW * 0.75);
        // beads get tight bright highlights; drips add running glints
        material.specularShininess = mix(material.specularShininess, 240.0, aswBeadM);
        material.specularColor = max(material.specularColor,
            vec3(0.018 + 0.13 * aswW + 0.55 * aswD + 0.85 * aswBeadM * aswW));
    }`,
                );
        };
        mat.needsUpdate = true;
    }

    /* ------------- props (MeshStandardMaterial) ------------------------ */
    function patchStandardProp(mat) {
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
            if (typeof prev === "function") prev.call(mat, shader, renderer);
            bindShared(shader);
            if (shader.fragmentShader.includes("aswBeads")) return;
            shader.vertexShader = injectModelVertex(shader.vertexShader);
            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>\n${MODEL_FRAG_DECL()}`,
                )
                .replace(
                    "#include <map_fragment>",
                    /* glsl */ `#include <map_fragment>\n${MODEL_WET_LOCALS}
    float aswUp = clamp(aswNY, 0.0, 1.0);
    float aswSnowM = clamp(uAswSnow * aswUp * (0.5 + 0.5 * aswNoise(vAswPos.xz * 1.7)), 0.0, 1.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.94, 0.98), aswSnowM);`,
                )
                .replace(
                    "#include <normal_fragment_maps>",
                    `#include <normal_fragment_maps>\n${MODEL_NORMAL_INJ}`,
                )
                .replace(
                    "#include <roughnessmap_fragment>",
                    /* glsl */ `#include <roughnessmap_fragment>
    roughnessFactor = mix(roughnessFactor, 0.12, aswW * 0.6 + aswD * 0.4);
    roughnessFactor = mix(roughnessFactor, 0.05, aswBeadM);`,
                );
        };
        mat.needsUpdate = true;
    }

    function eligible(obj) {
        if (!obj.isMesh || !obj.material) return false;
        if (obj === floorMesh) return false;
        if (obj.userData && obj.userData.aswSkip) return false;
        if (obj.material.isShaderMaterial && !obj.material.isMMDToonMaterial)
            return false;
        return true;
    }

    function registerScene(root = scene) {
        let added = 0;
        root.traverse((obj) => {
            if (!eligible(obj)) return;
            const mats = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];
            for (const m of mats) {
                if (!m) continue;
                // Shader Studio modes ("Original", "MMD 2.0") swap materials
                // and assign their OWN onBeforeCompile, wiping our droplet
                // patch. Detect that (our stored fn is no longer the hook)
                // and re-apply — chained on top of theirs, so both survive.
                // shared _fxHook marker: re-patch only when the CURRENT hook
                // isn't the last FX-chained one (i.e. Shader Studio replaced
                // it). Sibling FX systems update _fxHook too, so they don't
                // flag each other stale — that was the redefinition ping-pong.
                const stale =
                    patched.has(m) && m.userData?._fxHook !== m.onBeforeCompile;
                if (patched.has(m) && !stale) continue;
                try {
                    let did = false;
                    if (m.isMMDToonMaterial || m.isMeshPhongMaterial) {
                        patchToonOrPhong(m);
                        did = true;
                    } else if (m.isMeshStandardMaterial) {
                        patchStandardProp(m);
                        did = true;
                    }
                    if (did) {
                        patched.add(m);
                        if (!m.userData) m.userData = {};
                        m.userData._fxHook = m.onBeforeCompile;
                        m.needsUpdate = true;
                        added++;
                    }
                } catch (e) {
                    console.warn("[WeatherSurface] patch skipped:", e);
                }
            }
        });
        diag.materialsPatched += added;
        return added;
    }

    /* ---------------------------- runtime ----------------------------- */
    function update(
        time,
        {
            wetness = 0,
            puddles = 0.5,
            rainRate = 0,
            snowCover = 0,
            droplets = 0.7,
            dropletSize = 1,
        } = {},
    ) {
        U.uAswTime.value = time;
        U.uAswWetness.value = wetness;
        U.uAswPuddle.value = puddles;
        U.uAswRain.value = Math.min(1.5, rainRate);
        U.uAswSnow.value = snowCover;
        U.uAswDrops.value = droplets;
        U.uAswDropSize.value = dropletSize;
    }

    patchFloor();

    return {
        uniforms: U,
        registerScene,
        update,
        getDiagnostics: () => ({ ...diag }),
    };
}
