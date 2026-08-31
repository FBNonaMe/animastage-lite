// anime-toon.js — AnimeStage "Anime Toon" render mode.
//
// Toon lighting math ADAPTED from (MIT License, attribution preserved):
//   UnityURPToonLitShaderExample, Copyright (c) 2020 ColinLeung-NiloCat
//   https://github.com/ColinLeung-NiloCat/UnityURPToonLitShaderExample
//   Local copy: ./UnityURPToonLitShaderExample-master (LICENSE: MIT)
// Adapted pieces (HLSL→GLSL, Unity URP→three.js, marked NILO below):
//   - cel band:        smoothstep(mid-soft, mid+soft, NoL)
//   - face rule:       face never darker than half-lit  lerp(0.5, 1, band)
//   - tinted shadows:  lerp(shadowColor, 1, band)  (never black)
//   - composite:       albedo * max(indirect, direct)  (anti-overbright)
//   - outline width:   width × |viewZ| × fovFactor (screen-constant, via
//                      OutlineEffect integration; Nilo math informs scaling)
// Everything else (classification, MMD integration, wetness) is original.
//
// ARCHITECTURE: materials are NOT replaced. Each MMDToon material gets a
// CHAINED onBeforeCompile injection (composes with the weather-surface
// patch) adding an anime branch gated by uAnimeOn. Toggling the mode is a
// uniform flip — zero recompiles, skinning/morphs/sphere-maps/alpha all
// preserved because the original material keeps rendering; only the final
// outgoingLight is re-composed. Eyes keep most of their original look
// (catBlend 0.35) per anime-eye convention.

import * as THREE from "three";

// material categories
export const ACAT = { GENERIC: 0, FACE: 1, SKIN: 2, HAIR: 3, EYES: 4, BROW: 5, CLOTH: 6, METAL: 7 };

// Keyword corpus merged with reze-studio's taxonomy (lib/materials.ts):
// their Chinese PMX names (眼睛/脸/头发/皮肤/袜子/衣服/裙子…) + our JP/EN set.
const KEYS = [
    // BROW before EYES: "eyebrow"/"eyelash" must not match the "eye" key
    [ACAT.BROW, ["眉", "まつ", "mayu", "brow", "lash", "matsuge", "睫", "眉毛"]],
    [ACAT.EYES, ["瞳", "目", "eye", "hitomi", "iris", "pupil", "sirome", "白目", "眼睛", "眼白", "目白"]],
    [ACAT.FACE, ["顔", "kao", "face", "頬", "cheek", "口", "mouth", "kuchi", "歯", "teeth", "舌", "脸"]],
    [ACAT.SKIN, ["肌", "hada", "skin", "body", "素体", "leg", "arm", "hand", "neck", "皮肤", "stocking", "tights", "pantyhose", "袜子"]],
    [ACAT.HAIR, ["髪", "kami", "hair", "前髪", "後髪", "ヘア", "bang", "ponytail", "twin", "头发", "发饰"]],
    [ACAT.METAL, ["金属", "metal", "armor", "sword", "武器", "weapon", "鎧", "chain", "buckle", "earring"]],
    [ACAT.CLOTH, ["服", "fuku", "cloth", "dress", "skirt", "スカート", "shirt", "jacket", "coat", "ribbon", "リボン", "socks", "shoes", "靴", "衣服", "裙子", "外套", "裤子", "鞋子", "shorts", "pants"]],
];

export function classifyAnimeMaterial(name = "") {
    const n = String(name).toLowerCase();
    for (const [cat, keys] of KEYS)
        for (const k of keys) if (n.includes(k)) return cat;
    return ACAT.GENERIC;
}

export function createAnimeToonSystem({ scene }) {
    const U = {
        uAnimeOn: { value: 0 },
        uAStrength: { value: 1 },
        uAMid: { value: 0.12 },       // NILO _CelShadeMidPoint
        uASoft: { value: 0.08 },      // NILO _CelShadeSoftness
        uAShadowCol: { value: new THREE.Color(0.62, 0.58, 0.7) },   // NILO _ShadowMapColor idea
        uASkinShadowCol: { value: new THREE.Color(0.95, 0.7, 0.68) }, // warm anime skin shadow
        uAAmbient: { value: new THREE.Color(0.42, 0.42, 0.47) },    // NILO indirect min color
        uALightDir: { value: new THREE.Vector3(0.3, 0.8, 0.3) },    // VIEW space
        uALightCol: { value: new THREE.Color(1, 1, 1) },
        uARimCol: { value: new THREE.Color(0.85, 0.9, 1.0) },
        uARimPow: { value: 3.5 },
        uARimInt: { value: 0.35 },
        uASpecInt: { value: 0.35 },
        uASpecPow: { value: 42 },
        uAHairInt: { value: 0.6 },
        uAHairTh: { value: 0.28 },
        uAFaceSoften: { value: 0.65 },
        uAShadowAmt: { value: 0.85 }, // NILO _ReceiveShadowMappingAmount
        uAWet: { value: 0 },
        // "illustration flat" look (GF2/VTuber-style): albedo shown almost
        // directly, lighting only dips into tinted shadow where needed
        uAFlat: { value: 0.85 },      // legacy (kept for state compat)
        uAShadowStr: { value: 0.35 },
        uAFlatBright: { value: 1.22 },
        // WuWa model (Three-js-Anime-Shader adaptation)
        uALightTint: { value: new THREE.Color(1, 0.98, 0.95) },
        uAAmbTint: { value: new THREE.Color(0.9, 0.92, 1.0) },
        uARimTint: { value: new THREE.Color(1, 1, 1) },
        uATintSat: { value: 1.0 },
        uABandMix: { value: 0.25 },   // 0 = smooth WuWa NdotL, 1 = hard cel
        uARimLightTh: { value: 0.35 },// pow(NdotL) gate for rim
        uARimTh: { value: 0.22 },     // rim hard threshold
        uAExposure: { value: 1.35 },
        uAInvGamma: { value: 0.9 },   // <1 brightens midtones
        uASat: { value: 1.08 },
        uAHairSat: { value: 1.15 },
        uAHairShine: { value: 0.55 },
        // Reze "Deep Space" NPR stack blend (reze-engine M_Face port)
        uARezeMix: { value: 0 },

        // ── 1. FACE-AWARE SHADING ──
        uAFaceTh: { value: -0.1 },     // dedicated face shadow threshold
        uAFaceSoft: { value: 0.22 },   // softer cheek terminator
        uAFaceNose: { value: 0.6 },    // nose-shadow suppression
        uAFaceLightOff: { value: 0.0 },// light yaw offset for the face (rad)
        uAHeadFwd: { value: new THREE.Vector3(0, 0, 1) },  // view-space
        uAHeadRight: { value: new THREE.Vector3(1, 0, 0) },
        // ── 2. HAIR ──
        uAHairStyle: { value: 1 },     // 0 off · 1 aniso band · 2 circular
        uAHairWidth: { value: 0.35 },
        uAHairShift: { value: 0.15 },
        uAHair2Int: { value: 0.35 },   // secondary highlight
        uAHairRim: { value: 0.4 },
        uAHairShadowCol: { value: new THREE.Color(0.55, 0.5, 0.72) },
        // ── 3. RAMP SHADOWS ──
        uARampMode: { value: 1 },      // 0 two-band · 1 three-band · 2 soft
        uAMidTh: { value: 0.3 },
        uAMidWidth: { value: 0.14 },
        uADeepStr: { value: 0.35 },
        uAShSat: { value: 1.25 },      // shadow saturation
        uAShHue: { value: 0.0 },       // shadow hue shift
        // ── 4. EYES ──
        uAEyeLight: { value: 0.35 },   // base light response (0 = unlit)
        uAEyeCatch: { value: 0.6 },
        uAEyeCatchSize: { value: 0.35 },
        uAEyeEmis: { value: 0.12 },
        uAEyePupil: { value: 0.25 },   // pupil darkness
        uAEyeSclera: { value: 1.08 },
        uAEyeShSup: { value: 0.8 },    // shadow suppression
        // ── 6. STYLIZED SPECULAR ──
        uASpecStyle: { value: 2 },     // 0 off·1 soft·2 hard·3 circular·4 aniso
        // ── 8. RIM ──
        uARimMode: { value: 1 },       // 0 silhouette · 1 light-facing · 2 shadow-only
        uARimSoft: { value: 0.08 },
    };
    const patched = new WeakSet();
    const diag = { materials: 0, byCat: {} };
    const modelHeadScopes = new WeakMap();
    const meshHeadScopes = new WeakMap();
    const modelHeadRoots = new Set();
    const meshDrawHooks = new WeakMap();
    const DRAW_DISPATCHER_PROPERTY = "_animeStageDrawDispatcher";
    const TOON_DRAW_HANDLER = Symbol.for("AnimeStage.LegacyAnimeDraw");

    const FRAG_DECL = /* glsl */ `
        uniform float uAnimeOn, uAStrength, uAMid, uASoft, uARimPow, uARimInt;
        uniform float uASpecInt, uASpecPow, uAHairInt, uAHairTh, uAFaceSoften, uAShadowAmt, uAWet;
        uniform vec3 uAShadowCol, uASkinShadowCol, uAAmbient, uALightDir, uALightCol, uARimCol;
        uniform float uACat, uACatBlend;
        // WuWa-model controls (adapted from Three-js-Anime-Shader)
        uniform vec3 uALightTint, uAAmbTint, uARimTint;
        uniform float uATintSat, uABandMix, uARimLightTh, uARimTh;
        uniform float uAExposure, uAInvGamma, uASat, uAHairSat, uAHairShine;
        const vec3 A_LUM = vec3(0.2126, 0.7152, 0.0722);
        vec3 aAdjSat(vec3 c, float s) { return mix(vec3(dot(c, A_LUM)), c, s); }
        // GT Tonemap (Gran Turismo curve — the clean anime highlight rolloff)
        float aGTT(float x) {
            float S1 = 0.532; float C2 = 2.13675; float S0 = 0.532;
            float S_x = 1.0 - (1.0 - S1) * exp(-C2 * (x - S0));
            float L_x = 0.22 + (x - 0.22);
            float w2 = step(0.62, x);
            float w0 = 1.0 - smoothstep(0.0, 0.22, x);
            float w1 = 1.0 - w0 - w2;
            float T_x = 0.22 * pow(x * 4.54545, 1.33);
            return T_x * w0 + L_x * w1 + S_x * w2;
        }
        vec3 aGTT3(vec3 c) { return vec3(aGTT(c.r), aGTT(c.g), aGTT(c.b)); }

        // ═══ Reze "Deep Space" (仿深空之眼) node helpers — faithful port of
        //     reze-engine face.ts / nodes.ts (MIT © 2026 Amyang). ═══
        uniform float uARezeMix;
        vec3 aR2H(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.);
            vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
            vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
            float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x); }
        vec3 aH2R(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.);
            vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
        // Blender Hue/Saturation/Value node (fac = 1)
        vec3 aHueSat(vec3 col, float hue, float sat, float val){
            vec3 h=aR2H(col); h.x=fract(h.x+hue-0.5); h.y=clamp(h.y*sat,0.,1.); h.z*=val; return aH2R(h); }
        // ramp_constant_edge_aa: their version uses fwidth() for AA, but the
        // MMDToon program compiles without the derivatives extension enabled
        // (fwidth → "shader not compiled"). Fixed-width smoothstep is
        // derivative-free and visually equivalent for this band.
        float aRampAA(float f, float edge){ return smoothstep(edge-0.03, edge+0.03, f); }
        // ramp_cardinal (2 stops → smoothstep)
        vec3 aRampCard(float f,float p0,vec3 c0,float p1,vec3 c1){
            float t=clamp((f-p0)/max(p1-p0,1e-6),0.,1.); return mix(c0,c1,t*t*(3.-2.*t)); }
        vec3 aBrightContrast(vec3 c,float b,float ct){ float a=1.+ct; return max(vec3(0.),c*a+vec3(b-ct*0.5)); }
        float aFres(float ior,float ndv){ float r=(ior-1.)/(ior+1.); float f0=r*r;
            float m=1.-clamp(ndv,0.,1.); return f0+(1.-f0)*m*m*m*m*m; }
        float aLWFacing(float blend,float ndv){ float f=abs(ndv); float b=clamp(blend,0.,0.99999);
            if(b!=0.5){ float e=b>=0.5?0.5/(1.-b):2.*b; f=pow(f,e);} return 1.-f; }
        float aLWFres(float blend,float ndv){ float eta=max(1.-blend,1e-4);
            float r=(1.-eta)/(1.+eta); float f0=r*r; float m=1.-abs(clamp(ndv,0.,1.));
            return clamp((f0+(1.-f0)*m*m*m*m*m-f0)/max(1.-f0,1e-4),0.,1.); }

        // ── extended anime uniforms ──
        uniform float uAFaceTh, uAFaceSoft, uAFaceNose, uAFaceLightOff;
        uniform vec3  uAHeadFwd, uAHeadRight;
        uniform float uAHairStyle, uAHairWidth, uAHairShift, uAHair2Int, uAHairRim;
        uniform vec3  uAHairShadowCol;
        uniform float uARampMode, uAMidTh, uAMidWidth, uADeepStr, uAShSat, uAShHue;
        uniform float uAEyeLight, uAEyeCatch, uAEyeCatchSize, uAEyeEmis;
        uniform float uAEyePupil, uAEyeSclera, uAEyeShSup;
        uniform float uASpecStyle, uARimMode, uARimSoft;

        // shadow tint grading: hue shift + saturation (keeps skin shadow warm
        // / cloth shadow cool instead of dead grey)
        vec3 aShadeTint(vec3 c, float hueShift, float sat){
            vec3 h = aR2H(c); h.x = fract(h.x + hueShift);
            h.y = clamp(h.y * sat, 0.0, 1.0); return aH2R(h); }
        // Kajiya-Kay anisotropic strand highlight (shifted tangent)
        float aHairAniso(vec3 T, vec3 N, vec3 H, float shift, float expo){
            vec3 Tb = normalize(T + N * shift);
            float dotTH = dot(Tb, H);
            float sinTH = sqrt(max(1.0 - dotTH * dotTH, 0.0));
            float atten = smoothstep(-1.0, 0.0, dotTH);
            return atten * pow(sinTH, expo); }
    `;

    // Injected right before <opaque_fragment>: `normal`, `diffuseColor`,
    // `vViewPosition`, `outgoingLight`, `totalEmissiveRadiance` are in scope.
    // Lighting model adapted from Three-js-Anime-Shader (WuWa-style):
    // smooth NdotL + Schlick-fresnel Blinn spec + hard-threshold light-driven
    // rim + shadow-tint multiply + in-shader grading (exposure → GT tonemap
    // → gamma → saturation).
    const FRAG_BODY = /* glsl */ `
    if (uAnimeOn > 0.5) {
        vec3 aN = normalize(normal);
        if (uACat == 1.0) aN = normalize(vec3(aN.x, aN.y * (1.0 - uAFaceSoften), aN.z));
        vec3 aV = normalize(vViewPosition);
        vec3 aL = normalize(uALightDir);
        float aNoV = max(dot(aN, aV), 0.0);
        float aFacing = 1.0 - aNoV;
        // shadow map (main directional light)
        float aShadow = 1.0;
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
        aShadow = getShadow(directionalShadowMap[0],
            directionalLightShadows[0].shadowMapSize,
            directionalLightShadows[0].shadowIntensity,
            directionalLightShadows[0].shadowBias,
            directionalLightShadows[0].shadowRadius,
            vDirectionalShadowCoord[0]);
        aShadow = mix(1.0, aShadow, uAShadowAmt);
        #endif
        bool aIsFace = (uACat == 1.0);
        bool aIsEye  = (uACat == 4.0);
        bool aIsHair = (uACat == 3.0);
        bool aIsSkin = (uACat == 2.0);
        // ── FACE-AWARE SHADING ──
        // nose-shadow suppression: bend the face normal toward the head
        // forward axis so small nose/lip geometry stops carving hard shadows
        if (aIsFace) aN = normalize(mix(aN, uAHeadFwd, uAFaceNose * 0.55));
        // face light offset: rotate L around the head up axis
        vec3 aLf = aL;
        if (aIsFace && abs(uAFaceLightOff) > 0.001) {
            float cs = cos(uAFaceLightOff), sn = sin(uAFaceLightOff);
            vec3 up = normalize(cross(uAHeadRight, uAHeadFwd));
            aLf = normalize(aL * cs + cross(up, aL) * sn
                          + up * dot(up, aL) * (1.0 - cs));
        }
        float aNdlS = dot(aN, aLf);              // signed N·L
        float aNoLraw = max(aNdlS, 0.0);
        // per-category threshold/softness (face gets its own, softer band)
        float aTh   = aIsFace ? uAFaceTh   : uAMid;
        float aSoft = aIsFace ? uAFaceSoft : uASoft;
        float aCel = smoothstep(aTh - aSoft, aTh + aSoft, aNdlS);
        float aNoL = mix(aNoLraw, aCel, uABandMix);
        if (aIsFace || aIsEye) aNoL = mix(0.5, 1.0, aNoL); // never below half-lit
        float aShEff = aIsEye ? mix(1.0, aShadow, 1.0 - uAEyeShSup) : aShadow;
        float aLightI = aNoL * aShEff;
        vec3 aLCol = clamp(uALightCol, 0.0, 1.5);
        vec3 aDirect = aLightI * aLCol * aAdjSat(uALightTint, uATintSat);
        // ── RAMP: light / midtone / shadow / deep shadow ──
        vec3 aShBase = aIsSkin || aIsFace ? uASkinShadowCol
                     : aIsHair ? uAHairShadowCol : uAShadowCol;
        aShBase = aShadeTint(aShBase, uAShHue, uAShSat);
        float aLitF  = smoothstep(aTh - aSoft, aTh + aSoft, aNdlS) * aShEff;
        float aMidF  = smoothstep(uAMidTh - uAMidWidth, uAMidTh + uAMidWidth, aNdlS);
        float aDeepF = 1.0 - smoothstep(aTh - aSoft - 0.35, aTh - aSoft, aNdlS);
        vec3 aRamp;
        if (uARampMode < 0.5) {                       // two-band
            aRamp = mix(aShBase, vec3(1.0), aLitF);
        } else if (uARampMode < 1.5) {                // three-band
            vec3 midT = mix(aShBase, vec3(1.0), 0.55);
            aRamp = mix(aShBase, midT, aMidF);
            aRamp = mix(aRamp, vec3(1.0), aLitF);
        } else {                                      // soft ramp
            aRamp = mix(aShBase, vec3(1.0), smoothstep(-0.25, 1.0, aNdlS * aShEff));
        }
        aRamp *= mix(1.0, 1.0 - clamp(uADeepStr, 0.0, 0.9), aDeepF);
        // lighting = ramp × light color, plus ambient
        vec3 aFinal = aRamp * aLCol * aAdjSat(uALightTint, uATintSat);
        aFinal += uAAmbient * aAdjSat(uAAmbTint, uATintSat);
        vec3 aH = normalize(aLf + aV);
        // ── STYLIZED SPECULAR (per style, per category) ──
        if (uASpecStyle > 0.5 && !aIsEye) {
            float aNdH = max(dot(aN, aH), 0.0);
            float aSp = 0.0;
            if (uASpecStyle < 1.5) {                 // soft
                aSp = pow(aNdH, uASpecPow);
            } else if (uASpecStyle < 2.5) {          // hard toon
                aSp = step(0.5, pow(aNdH, uASpecPow));
            } else if (uASpecStyle < 3.5) {          // circular
                aSp = smoothstep(0.48, 0.52, pow(aNdH, uASpecPow * 0.6));
            } else {                                 // anisotropic
                vec3 T = normalize(cross(aN, vec3(0.0, 1.0, 0.0)) + vec3(1e-4));
                aSp = aHairAniso(T, aN, aH, uAHairShift, uASpecPow);
            }
            // skin barely shines, metal shines hard, cloth in between
            float aSpCat = uACat == 7.0 ? 2.2 : aIsSkin || aIsFace ? 0.28
                         : aIsHair ? 1.3 : 1.0;
            vec3 aF = vec3(0.04) + 0.96 * pow(1.0 - aNoV, 5.0);
            aFinal += aSp * aSpCat * uASpecInt * aLightI * aF * aLCol * 6.0
                    * (1.0 + uAWet * 1.5);
        }
        // ── RIM (mode-driven) ──
        if (!aIsEye && uARimInt > 0.001) {
            float aRimI = aFacing;
            if (uARimMode < 0.5) {                   // pure silhouette
                aRimI = pow(aFacing, uARimPow);
            } else if (uARimMode < 1.5) {            // light-facing
                aRimI = aFacing * pow(aNoLraw, uARimLightTh);
            } else {                                 // shadow-only
                aRimI = aFacing * (1.0 - aLitF);
            }
            aRimI = smoothstep(uARimTh - uARimSoft, uARimTh + uARimSoft, aRimI);
            float aRimCat = aIsHair ? (1.0 + uAHairRim) : 1.0;
            aFinal += aRimI * uARimInt * aRimCat * aLCol
                    * aAdjSat(uARimTint, uATintSat) * (1.0 + uAWet * 0.5);
        }
        vec3 aBase = diffuseColor.rgb;
        // ── HAIR: anisotropic band + secondary highlight ──
        if (aIsHair && uAHairStyle > 0.5) {
            vec3 T = normalize(cross(aN, uAHeadRight) + vec3(1e-4));
            float expo = mix(90.0, 12.0, clamp(uAHairWidth, 0.0, 1.0));
            float h1;
            if (uAHairStyle < 1.5) {
                h1 = aHairAniso(T, aN, aH, uAHairShift, expo);
                h1 = smoothstep(uAHairTh, uAHairTh + 0.12, h1); // banded
            } else {                                  // circular
                h1 = smoothstep(uAHairTh, uAHairTh + 0.1,
                     pow(max(dot(reflect(-aLf, aN), aV), 0.0), 18.0));
            }
            // secondary, shifted the other way and tinted toward the base
            float h2 = aHairAniso(T, aN, aH, -uAHairShift * 1.8, expo * 0.45);
            h2 = smoothstep(uAHairTh * 0.8, uAHairTh * 0.8 + 0.2, h2);
            vec3 hi = aLCol * (h1 * uAHairInt + h2 * uAHair2Int * 0.6);
            aBase += min(hi * (0.4 + 0.6 * aLightI), vec3(uAHairShine * 2.0));
        }
        // ── EYES: unlit-ish base, catchlight, iris/sclera shaping ──
        if (aIsEye) {
            float lum = dot(aBase, A_LUM);
            aBase *= mix(1.0, uAEyeSclera, smoothstep(0.5, 0.85, lum));   // sclera lift
            aBase *= mix(1.0 - uAEyePupil, 1.0, smoothstep(0.02, 0.3, lum)); // pupil
            aBase += aBase * uAEyeEmis;                                    // iris glow
            float catch_ = pow(max(dot(reflect(-aLf, aN), aV), 0.0),
                               mix(120.0, 12.0, clamp(uAEyeCatchSize, 0.0, 1.0)));
            aBase += aLCol * smoothstep(0.35, 0.6, catch_) * uAEyeCatch;
            aFinal = mix(vec3(1.0), aFinal, uAEyeLight); // mostly unlit
        }
        vec3 aToon = aBase * aFinal;
        // ═══ Reze "Deep Space" NPR stack — faithful reze-engine face.ts port
        //     (M_Face "仿深空之眼渲染预设v1.0_by_小绿毛猫"). ═══
        if (uARezeMix > 0.001) {
            // shader_to_rgb_diffuse: Eevee lit-diffuse luminance
            vec3 rgb = aLCol * (aNoLraw * aShadow / 3.14159265) + uAAmbient;
            float ndotl_raw = dot(rgb, A_LUM);
            // ramp_constant_edge_aa at 0.2966
            float toon = aRampAA(ndotl_raw, 0.2966);
            if (uACat == 1.0 || uACat == 4.0) toon = mix(0.5, 1.0, toon); // face rule
            // HSV shadow/lit tints of the albedo (M_Face hue 0.46)
            vec3 shadow_tint = aHueSat(aBase, 0.46, 2.0, 0.35);
            vec3 lit_tint = aHueSat(aBase, 0.46, 1.6, 1.5);
            vec3 toon_color = mix(shadow_tint, lit_tint, toon);
            vec3 bc = aBrightContrast(toon_color, 0.05, 0.15);
            // their pipeline feeds emission ×2.5 into an HDR bloom+tonemap
            // chain; here the base color is bc directly (our exposure/GT
            // grading below does the rolloff — ×2.5 blew everything white).
            vec3 emission3 = bc;
            // warm cardinal-ramp accent (subtle)
            float warm_input = clamp(toon * 0.5 + 0.5, 0.0, 1.0);
            vec3 warm_color = aRampCard(warm_input, 0.2409,
                vec3(0.2426, 0.068, 0.0588), 0.4663, vec3(0.6677, 0.5024, 0.5126));
            vec3 warm_emission = warm_color * 0.12;
            // dual fresnel rim (tamed)
            float rim1_str = aFres(2.0, aNoV) * aLWFacing(0.24, aNoV);
            vec3 rim1 = vec3(0.9842, 0.6110, 0.5736) * rim1_str * 0.5;
            float rim2_raw = aFres(1.45, aNoV) * aLWFres(0.61, aNoV);
            float rim2_fac = pow(max(rim2_raw, 0.0), 0.63) * 0.4;
            vec3 rim2_mixed = mix(emission3, vec3(1.0, 0.4685, 0.3699), rim2_fac);
            // bright-tex gate: only genuine near-white accents, faint glow
            float tex_gate = step(0.965, dot(aBase, vec3(0.299, 0.587, 0.114)));
            vec3 bright_emit = vec3(tex_gate) * 0.4;
            vec3 npr_stack = rim2_mixed + rim1 + bright_emit + warm_emission;
            aToon = mix(aToon, npr_stack, uARezeMix * 0.85);
        }
        // grading: exposure → GT tonemap → gamma → saturation
        aToon *= uAExposure;
        aToon = aGTT3(aToon);
        aToon = pow(max(aToon, 0.0), vec3(uAInvGamma));
        aToon = aAdjSat(aToon, uACat == 3.0 ? uASat * uAHairSat : uASat);
        aToon += totalEmissiveRadiance;
        outgoingLight = mix(outgoingLight, aToon, uAStrength * uACatBlend);
    }
    `;

    function syncMaterialHeadForDraw(mat, object, camera, renderer) {
        const shaderSet = mat?.userData?._animeToonShaders;
        if (!mat?.userData) return;
        const scope = resolveHeadScopeForDraw(
            object,
            camera,
            renderer?.info?.render?.frame,
        );
        const forward = scope?.headForward || U.uAHeadFwd.value;
        const right = scope?.headRight || U.uAHeadRight.value;
        const pending = mat.userData._animeToonPendingHead;
        pending?.forward?.copy?.(forward);
        pending?.right?.copy?.(right);
        if (!shaderSet?.size) return;
        for (const shader of shaderSet) {
            shader?.uniforms?.uAHeadFwd?.value?.copy?.(forward);
            shader?.uniforms?.uAHeadRight?.value?.copy?.(right);
        }
    }

    function installMeshDrawHook(mesh) {
        if (!mesh.userData) mesh.userData = {};
        let dispatcherState = mesh.userData[DRAW_DISPATCHER_PROPERTY];
        if (!dispatcherState || dispatcherState.dispatcher !== mesh.onBeforeRender) {
            const previous = mesh.onBeforeRender;
            const handlers = dispatcherState?.handlers || new Map();
            const dispatcher = function (...args) {
                if (typeof previous === "function") previous.apply(this, args);
                for (const handler of handlers.values())
                    handler.apply(this, args);
            };
            dispatcherState = { dispatcher, previous, handlers };
            Object.defineProperty(mesh.userData, DRAW_DISPATCHER_PROPERTY, {
                value: dispatcherState,
                configurable: true,
            });
            mesh.onBeforeRender = dispatcher;
        }
        let handler = meshDrawHooks.get(mesh);
        if (
            handler &&
            dispatcherState.handlers.get(TOON_DRAW_HANDLER) === handler
        ) return;
        handler = function (
            renderer,
            drawScene,
            camera,
            geometry,
            material,
            group,
        ) {
            syncMaterialHeadForDraw(material, this, camera, renderer);
        };
        meshDrawHooks.set(mesh, handler);
        dispatcherState.handlers.set(TOON_DRAW_HANDLER, handler);
    }

    function patchMaterial(mat, meshName = "") {
        if (!mat || !mat.isMMDToonMaterial) return false;
        if (!mat.userData) mat.userData = {};
        if (!mat.userData._animeToonShaders) {
            Object.defineProperty(mat.userData, "_animeToonShaders", {
                value: new Set(),
                configurable: true,
            });
        }
        if (!mat.userData._animeToonPendingHead) {
            Object.defineProperty(mat.userData, "_animeToonPendingHead", {
                value: {
                    forward: U.uAHeadFwd.value.clone(),
                    right: U.uAHeadRight.value.clone(),
                },
                configurable: true,
            });
        }
        // Shader Studio ("Original" / "MMD 2.0") replaces onBeforeCompile —
        // re-patch when our stored hook is no longer installed.
        const stale = patched.has(mat) && mat.userData?._fxHook !== mat.onBeforeCompile;
        if (patched.has(mat) && !stale) return false;
        patched.add(mat);
        const cat = classifyAnimeMaterial(mat.name || meshName);
        diag.byCat[cat] = (diag.byCat[cat] || 0) + 1;
        const catBlend = cat === ACAT.EYES ? 0.35 : cat === ACAT.BROW ? 0.7 : 1.0;
        const prev = mat.onBeforeCompile;
        mat.onBeforeCompile = (shader, renderer) => {
            if (typeof prev === "function") prev.call(mat, shader, renderer);
            for (const k in U) shader.uniforms[k] = U[k];
            // Head axes are draw-scoped. Keep their uniform holders private to
            // this program so rendering character B cannot mutate the global
            // values used by character A (or vice versa).
            const pending = mat.userData._animeToonPendingHead;
            shader.uniforms.uAHeadFwd = {
                value: (pending?.forward || U.uAHeadFwd.value).clone(),
            };
            shader.uniforms.uAHeadRight = {
                value: (pending?.right || U.uAHeadRight.value).clone(),
            };
            shader.uniforms.uACat = { value: cat };
            shader.uniforms.uACatBlend = { value: catBlend };
            mat.userData?._animeToonShaders?.add(shader);
            // idempotent: a sibling chain link may have already injected us
            if (shader.fragmentShader.includes("uAnimeOn")) return;
            shader.fragmentShader = shader.fragmentShader
                .replace("#include <common>", `#include <common>\n${FRAG_DECL}`)
                .replace(
                    "#include <opaque_fragment>",
                    `${FRAG_BODY}\n#include <opaque_fragment>`,
                );
        };
        mat.userData._fxHook = mat.onBeforeCompile;
        mat.customProgramCacheKey = () => "animeToon1" + (mat.userData?._aswPatched ? "w" : "");
        mat.needsUpdate = true;
        diag.materials++;
        return true;
    }

    function registerScene(root = scene) {
        let n = 0;
        root.traverse((o) => {
            if (!o.isMesh || !o.material) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            let hasAnimeMaterial = false;
            for (const m of mats) {
                try {
                    if (m?.isMMDToonMaterial) hasAnimeMaterial = true;
                    if (patchMaterial(m, o.name)) n++;
                } catch (e) {
                    console.warn("[AnimeToon] patch skipped:", e);
                }
            }
            if (hasAnimeMaterial) installMeshDrawHook(o);
        });
        return n;
    }

    function registerModel(root, { headBone = null } = {}) {
        if (!root) return 0;
        let scope = modelHeadScopes.get(root);
        if (!scope) {
            scope = {
                model: root,
                headBone: null,
                headForward: U.uAHeadFwd.value.clone(),
                headRight: U.uAHeadRight.value.clone(),
                lastDrawFrame: null,
                lastDrawCamera: null,
            };
            modelHeadScopes.set(root, scope);
            modelHeadRoots.add(root);
        }
        if (headBone) {
            scope.headBone = headBone;
            scope.lastDrawFrame = null;
            scope.lastDrawCamera = null;
        }
        root.traverse?.((object) => {
            if (object?.isMesh) meshHeadScopes.set(object, scope);
        });
        if (root.isMesh) meshHeadScopes.set(root, scope);
        return registerScene(root);
    }

    function refreshModel(root) {
        const scope = modelHeadScopes.get(root);
        if (!scope) return registerModel(root);
        root.traverse?.((object) => {
            if (object?.isMesh) meshHeadScopes.set(object, scope);
        });
        if (root.isMesh) meshHeadScopes.set(root, scope);
        return registerScene(root);
    }

    function unregisterModel(root) {
        const scope = modelHeadScopes.get(root);
        if (!scope) return false;
        root.traverse?.((object) => {
            if (object?.isMesh && meshHeadScopes.get(object) === scope) {
                meshHeadScopes.delete(object);
                const state = object.userData?.[DRAW_DISPATCHER_PROPERTY];
                state?.handlers?.delete(TOON_DRAW_HANDLER);
                if (
                    state &&
                    !state.handlers.size &&
                    object.onBeforeRender === state.dispatcher
                ) {
                    object.onBeforeRender = state.previous;
                    delete object.userData[DRAW_DISPATCHER_PROPERTY];
                }
            }
        });
        if (root.isMesh && meshHeadScopes.get(root) === scope) {
            meshHeadScopes.delete(root);
            const state = root.userData?.[DRAW_DISPATCHER_PROPERTY];
            state?.handlers?.delete(TOON_DRAW_HANDLER);
            if (
                state &&
                !state.handlers.size &&
                root.onBeforeRender === state.dispatcher
            ) {
                root.onBeforeRender = state.previous;
                delete root.userData[DRAW_DISPATCHER_PROPERTY];
            }
        }
        modelHeadScopes.delete(root);
        modelHeadRoots.delete(root);
        return true;
    }

    function findHeadScope(object) {
        if (!object) return null;
        const direct = meshHeadScopes.get(object) || modelHeadScopes.get(object);
        if (direct) return direct;
        let cursor = object.parent;
        while (cursor) {
            const scope = modelHeadScopes.get(cursor);
            if (scope) {
                if (object.isMesh) meshHeadScopes.set(object, scope);
                return scope;
            }
            cursor = cursor.parent;
        }
        return null;
    }

    /* presets (NILO-inspired parameterizations; editable after apply) */
    const PRESETS = {
        classic:   { uARezeMix: 0, uAMid: 0.0,  uASoft: 0.03, uABandMix: 0.9,  uARimInt: 0.15, uASpecInt: 0.2,  uAHairInt: 0.35, uAFaceSoften: 0.4,  uAExposure: 1.1,  uAInvGamma: 1.0,  uASat: 1.0,  uAHairSat: 1.0,  uARimTh: 0.3,  strength: 0.95 },
        clean:     { uARezeMix: 0, uAMid: 0.1,  uASoft: 0.1,  uABandMix: 0.25, uARimInt: 0.35, uASpecInt: 0.3,  uAHairInt: 0.5,  uAFaceSoften: 0.7,  uAExposure: 1.35, uAInvGamma: 0.9,  uASat: 1.08, uAHairSat: 1.1,  uARimTh: 0.22, strength: 1.0 },
        gacha:     { uARezeMix: 0, uAMid: 0.12, uASoft: 0.12, uABandMix: 0.15, uARimInt: 0.55, uASpecInt: 0.45, uAHairInt: 0.85, uAFaceSoften: 0.8,  uAExposure: 1.45, uAInvGamma: 0.85, uASat: 1.15, uAHairSat: 1.2,  uARimTh: 0.18, strength: 1.0 },
        dramatic:  { uARezeMix: 0, uAMid: 0.25, uASoft: 0.04, uABandMix: 0.8,  uARimInt: 0.7,  uASpecInt: 0.6,  uAHairInt: 0.7,  uAFaceSoften: 0.55, uAExposure: 1.25, uAInvGamma: 0.95, uASat: 1.05, uAHairSat: 1.1,  uARimTh: 0.15, strength: 1.0 },
        cinematic: { uARezeMix: 0, uAMid: 0.08, uASoft: 0.18, uABandMix: 0.35, uARimInt: 0.4,  uASpecInt: 0.35, uAHairInt: 0.55, uAFaceSoften: 0.75, uAExposure: 1.3,  uAInvGamma: 0.92, uASat: 1.05, uAHairSat: 1.08, uARimTh: 0.2,  strength: 0.97 },
        // Deep Space theme: reze-engine M_Face NPR stack ON (HSV shadow/lit
        // tints + dual warm fresnel rim), soft near-flat body base
        reze:      { uARezeMix: 0.8, uAMid: 0.05, uASoft: 0.16, uABandMix: 0.12, uARimInt: 0.3,  uASpecInt: 0.22, uAHairInt: 0.4,  uAFaceSoften: 0.85, uAExposure: 1.05, uAInvGamma: 0.95, uASat: 1.08, uAHairSat: 1.1,  uARimTh: 0.24, strength: 1.0 },
        // ── new full-feature presets ──
        pastel:    { uARezeMix: 0, uAMid: 0.0,  uASoft: 0.26, uABandMix: 0.3,  uARampMode: 2, uAMidTh: 0.25, uADeepStr: 0.15, uAShSat: 1.1,  uAShHue: 0.02,  uARimInt: 0.25, uARimMode: 0, uASpecStyle: 1, uASpecInt: 0.2,  uAHairStyle: 1, uAHairInt: 0.45, uAHairWidth: 0.5,  uAFaceTh: -0.15, uAFaceSoft: 0.3,  uAFaceNose: 0.7, uAEyeLight: 0.4,  uAExposure: 1.3,  uAInvGamma: 0.88, uASat: 0.95, uAHairSat: 1.0,  strength: 1.0 },
        neon:      { uARezeMix: 0, uAMid: 0.18, uASoft: 0.06, uABandMix: 0.7,  uARampMode: 1, uAMidTh: 0.35, uADeepStr: 0.5,  uAShSat: 1.5,  uAShHue: 0.72,  uARimInt: 0.85, uARimMode: 1, uASpecStyle: 2, uASpecInt: 0.55, uAHairStyle: 1, uAHairInt: 0.9,  uAHairWidth: 0.3,  uAFaceTh: -0.05, uAFaceSoft: 0.2,  uAFaceNose: 0.6, uAEyeLight: 0.3,  uAEyeCatch: 0.9, uAExposure: 1.2,  uAInvGamma: 0.95, uASat: 1.25, uAHairSat: 1.2,  uARimTh: 0.15, strength: 1.0 },
        wet:       { uARezeMix: 0, uAMid: 0.1,  uASoft: 0.12, uABandMix: 0.35, uARampMode: 1, uAMidTh: 0.3,  uADeepStr: 0.4,  uAShSat: 1.3,  uAShHue: 0.0,   uARimInt: 0.5,  uARimMode: 1, uASpecStyle: 3, uASpecInt: 0.7,  uAHairStyle: 1, uAHairInt: 1.0,  uAHairWidth: 0.25, uAFaceTh: -0.1,  uAFaceSoft: 0.22, uAFaceNose: 0.6, uAEyeLight: 0.35, uAEyeCatch: 0.8, uAExposure: 1.15, uAInvGamma: 0.95, uASat: 1.1,  uAHairSat: 1.15, strength: 1.0 },
    };
    function applyPreset(name) {
        const p = PRESETS[name];
        if (!p) return false;
        for (const k in p) {
            if (k === "strength") U.uAStrength.value = p.strength;
            else if (U[k]) U[k].value = p[k];
        }
        state.preset = name;
        return true;
    }

    const state = { enabled: false, preset: "clean", version: 1 };
    const _d = new THREE.Vector3();
    const _hm = new THREE.Matrix4();
    const _hf = new THREE.Vector3();
    const _hr = new THREE.Vector3();

    function updateHeadScope(scope, headBone, camera) {
        if (!scope || !camera) return false;
        if (headBone) scope.headBone = headBone;
        const bone = scope.headBone;
        if (!bone?.matrixWorld) return false;
        bone.updateWorldMatrix?.(true, false);
        _hm.extractRotation(bone.matrixWorld);
        _hf.set(0, 0, 1).applyMatrix4(_hm).normalize()
           .transformDirection(camera.matrixWorldInverse);
        _hr.set(1, 0, 0).applyMatrix4(_hm).normalize()
           .transformDirection(camera.matrixWorldInverse);
        scope.headForward.copy(_hf);
        scope.headRight.copy(_hr);
        return true;
    }

    function resolveHeadScopeForDraw(object, camera, frameToken = null) {
        const scope = findHeadScope(object);
        if (scope?.headBone && camera) {
            const canReuse =
                frameToken != null &&
                scope.lastDrawFrame === frameToken &&
                scope.lastDrawCamera === camera;
            if (!canReuse) {
                updateHeadScope(scope, scope.headBone, camera);
                scope.lastDrawFrame = frameToken;
                scope.lastDrawCamera = camera;
            }
        }
        return scope;
    }

    function setHeadBoneForModel(modelOrMesh, headBone) {
        const scope = findHeadScope(modelOrMesh);
        if (!scope) return false;
        scope.headBone = headBone || null;
        scope.lastDrawFrame = null;
        scope.lastDrawCamera = null;
        return true;
    }

    function updateHeadBoneForModel(modelOrMesh, headBone, camera) {
        const scope = findHeadScope(modelOrMesh);
        return updateHeadScope(scope, headBone, camera);
    }

    // ---- anime sky dome: 2-tone gradient + stepped cel clouds ----
    const skyU = {
        uT: { value: 0 },
        uTop: { value: new THREE.Color(0x3a7bd5) },
        uBot: { value: new THREE.Color(0xcfe8ff) },
        uCloud: { value: 0.55 },
        uNight: { value: 0 },
        uMoonDir: { value: new THREE.Vector3(0.4, 0.55, -0.6) },
    };
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
        uniforms: skyU,
        vertexShader: `varying vec3 vP; void main(){ vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `precision highp float;
            uniform float uT, uCloud, uNight; uniform vec3 uTop, uBot, uMoonDir;
            varying vec3 vP;
            float h(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
            float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
                return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
            void main(){
                vec3 d = normalize(vP);
                // day ↔ anime night gradient
                vec3 dayS = mix(uBot, uTop, clamp(d.y*1.4+0.25, 0.0, 1.0));
                vec3 nightS = mix(vec3(0.10,0.11,0.22), vec3(0.015,0.02,0.07),
                                  clamp(d.y*1.2+0.2, 0.0, 1.0));
                vec3 sky = mix(dayS, nightS, uNight);
                // twinkling stars (hash cells, per-star phase/freq)
                if (uNight > 0.05 && d.y > -0.05) {
                    vec2 sp = d.xz/(0.3+abs(d.y))*28.0;
                    vec2 cell = floor(sp);
                    float sh = h(cell);
                    vec2 off = vec2(h(cell+1.7), h(cell+3.9)) - 0.5;
                    float sd = length(fract(sp)-0.5-off*0.6);
                    float tw = 0.55+0.45*sin(uT*(1.5+sh*4.0)+sh*40.0);
                    float star = smoothstep(0.06+sh*0.05, 0.0, sd)
                               * step(0.82, sh) * tw;
                    sky += vec3(0.9,0.95,1.0) * star * uNight;
                }
                // anime moon: crisp disc + soft halo
                if (uNight > 0.05) {
                    float md = distance(d, normalize(uMoonDir));
                    float disc = smoothstep(0.062, 0.055, md);
                    float halo = smoothstep(0.32, 0.06, md) * 0.22;
                    // subtle crater tone inside the disc
                    float cr = n2(d.xz*40.0+13.0)*0.12;
                    sky += (vec3(0.98,0.97,0.88)*(1.0-cr)*disc
                          + vec3(0.75,0.8,1.0)*halo) * uNight;
                }
                // cel clouds: 2 stepped tones, slow drift; darker at night
                vec2 cuv = d.xz/(0.25+abs(d.y))*0.7 + vec2(uT*0.008, 0.0);
                float c = n2(cuv)*0.6 + n2(cuv*2.3+7.0)*0.4;
                float m1 = smoothstep(1.0-uCloud, 1.02-uCloud, c);
                float m2 = smoothstep(1.06-uCloud, 1.08-uCloud, c);
                vec3 c1 = mix(vec3(0.86,0.9,0.97), vec3(0.10,0.12,0.20), uNight);
                vec3 c2 = mix(vec3(1.0), vec3(0.16,0.18,0.28), uNight);
                sky = mix(sky, c1, m1*step(0.02,d.y));
                sky = mix(sky, c2, m2*step(0.02,d.y));
                gl_FragColor = vec4(sky, 1.0);
            }`,
    });
    // radius must stay INSIDE the camera far plane (app far ≈ 200) or the
    // dome gets projection-clipped in the main view (it showed only in the
    // Reflector, which renders with different clipping). depthTest:false +
    // renderOrder -999 draws it first, behind everything, at any distance.
    // Drawn LAST among opaque (renderOrder 9999) with depthTest ON and no
    // depth write: fills only empty background pixels, wins over the app's
    // own Sky (which writes no depth), never covers geometry; transparent
    // objects (hair/weather) still draw after it correctly.
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), skyMat);
    skyMesh.name = "AnimeSky";
    skyMesh.visible = false;
    skyMesh.renderOrder = 9999;
    skyMesh.frustumCulled = false;
    skyMesh.userData.aswSkip = true;
    // never outline the sky dome (OutlineEffect honors this flag)
    skyMat.userData.outlineParameters = { visible: false, thickness: 0 };
    scene.add(skyMesh);

    return {
        uniforms: U,
        state,
        registerScene,
        registerModel,
        refreshModel,
        unregisterModel,
        applyPreset,
        presets: Object.keys(PRESETS),
        setEnabled(on) {
            state.enabled = !!on;
            U.uAnimeOn.value = on ? 1 : 0;
            skyMesh.visible = !!on && state.sky !== false;
        },
        skyUniforms: skyU,
        setSky(on) {
            state.sky = !!on;
            skyMesh.visible = state.enabled && !!on;
        },
        // per-frame: dominant light + ambient + wetness (deterministic feed)
        // Feed the head bone so face shading knows which way the face points
        // (nose suppression + face light offset work in head space).
        updateHeadBone(headBone, camera) {
            if (!headBone || !camera) return;
            const scope = findHeadScope(headBone);
            if (scope) {
                updateHeadScope(scope, headBone, camera);
                return;
            }
            headBone.updateWorldMatrix(true, false);
            _hm.extractRotation(headBone.matrixWorld);
            _hf.set(0, 0, 1).applyMatrix4(_hm).normalize()
               .transformDirection(camera.matrixWorldInverse);
            _hr.set(1, 0, 0).applyMatrix4(_hm).normalize()
               .transformDirection(camera.matrixWorldInverse);
            U.uAHeadFwd.value.copy(_hf);
            U.uAHeadRight.value.copy(_hr);
        },
        setHeadBoneForModel,
        updateHeadBoneForModel,
        updateHeadBoneForMesh: updateHeadBoneForModel,
        updateLight({ camera, lightObj, ambientIntensity = 0.4, wetness = 0, night = 0, moonObj = null }) {
            skyU.uNight.value = Math.max(0, Math.min(1, night));
            if (moonObj) {
                skyU.uMoonDir.value
                    .copy(moonObj.position)
                    .sub(moonObj.target ? moonObj.target.position : skyMesh.position)
                    .normalize();
            }
            if (lightObj) {
                _d.copy(lightObj.position);
                if (lightObj.target) _d.sub(lightObj.target.position);
                _d.normalize().transformDirection(camera.matrixWorldInverse);
                U.uALightDir.value.copy(_d);
                U.uALightCol.value
                    .copy(lightObj.color)
                    .multiplyScalar(Math.min(2, lightObj.intensity));
            }
            const a = Math.min(0.75, 0.3 + ambientIntensity * 0.35);
            U.uAAmbient.value.setRGB(a, a, a * 1.06);
            U.uAWet.value = wetness;
            skyU.uT.value += 1 / 60; // slow cloud drift
            if (camera) skyMesh.position.copy(camera.position);
        },
        serialize() {
            const o = { version: 1, enabled: state.enabled, preset: state.preset, u: {} };
            for (const k in U) {
                const v = U[k].value;
                o.u[k] = v && v.isColor ? "#" + v.getHexString() : v && v.isVector3 ? undefined : v;
            }
            return o;
        },
        deserialize(d) {
            if (!d || d.version !== 1) return false;
            state.preset = d.preset || "clean";
            for (const k in d.u || {}) {
                if (!U[k] || d.u[k] === undefined) continue;
                if (U[k].value && U[k].value.isColor) U[k].value.set(d.u[k]);
                else if (typeof d.u[k] === "number") U[k].value = d.u[k];
            }
            this.setEnabled(!!d.enabled);
            return true;
        },
        disposeCharacterScopes() {
            for (const root of [...modelHeadRoots]) unregisterModel(root);
        },
        getDiagnostics: () => ({ ...diag }),
    };
}
