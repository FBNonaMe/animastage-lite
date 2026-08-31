/*
 * GLSL ES translation of StarRailNPRShader character shading.
 * Derived from Shaders/Character/Char*Core.hlsl and Shared/
 * CharRenderingHelpers.hlsl, Copyright (C) 2023 Stalo.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const animeNprVertexShader = /* glsl */`
varying vec2 vNprUv;
varying vec3 vNprNormalVS;
varying vec3 vNprViewPosition;
varying vec3 vNprWorldPosition;
uniform mat3 uUvTransform;

#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <fog_pars_vertex>

void main() {
    vNprUv = (uUvTransform * vec3(uv, 1.0)).xy;

    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>
    vNprNormalVS = normalize(transformedNormal);

    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <project_vertex>
    vNprViewPosition = -mvPosition.xyz;
    #include <worldpos_vertex>
    vNprWorldPosition = worldPosition.xyz;
    #include <shadowmap_vertex>
    #include <fog_vertex>
}
`;

export const animeNprFragmentShader = /* glsl */`
precision highp float;

uniform sampler2D uBaseMap;
uniform sampler2D uAlphaMap;
uniform sampler2D uLightMap;
uniform sampler2D uRampCool;
uniform sampler2D uRampWarm;
uniform sampler2D uFaceMap;
uniform sampler2D uExpressionMap;
uniform sampler2D uStockingsMap;
uniform sampler2D uToonMap;
uniform sampler2D uMatcapMap;
uniform sampler2D uHairDepthTexture;
uniform sampler2D uSelfShadowMap;
uniform float uHasBaseMap;
uniform float uHasAlphaMap;
uniform float uHasLightMap;
uniform float uHasRamp;
uniform float uHasFaceMap;
uniform float uHasExpressionMap;
uniform float uHasStockingsMap;
uniform float uHasToonMap;
uniform float uHasMatcapMap;
uniform float uMatcapMode;
uniform float uMatcapStrength;
uniform float uHasHairDepth;
uniform float uHasSelfShadowMap;
uniform vec3 uBaseColor;
uniform vec3 uMaterialAmbientColor;
uniform float uMaterialAmbientIntensity;
uniform float uColorSaturation;
uniform float uOpacity;
uniform float uAlphaTest;
uniform float uCategory;
uniform float uStrength;
uniform vec3 uLightDirVS;
uniform vec3 uLightColor;
uniform vec3 uAmbient;
uniform float uSceneShadow;
uniform vec3 uShadowColor;
uniform vec3 uEyeShadowColor;
uniform float uWarmMix;
uniform float uAoFallback;
uniform vec3 uSpecularColor;
uniform vec3 uMaterialSpecularColor;
uniform float uHasMaterialSpecular;
uniform float uMaterialShininess;
uniform float uSpecularShininess;
uniform float uSpecularIntensity;
uniform float uSpecularRoughness;
uniform vec3 uRimColor;
uniform float uRimIntensity;
uniform float uRimSoftness;
uniform vec3 uRimShadowColor;
uniform float uRimShadowIntensity;
uniform vec3 uEmissionColor;
uniform float uEmissionIntensity;
uniform float uEmissionThreshold;
uniform vec3 uHeadForwardVS;
uniform vec3 uHeadRightVS;
uniform vec3 uHeadUpVS;
uniform float uFaceThreshold;
uniform float uFaceSoftness;
uniform float uEyeAlwaysLit;
uniform float uNosePower;
uniform float uNoseIntensity;
uniform vec3 uExCheekColor;
uniform vec3 uExShyColor;
uniform vec3 uExShadowColor;
uniform vec3 uExEyeColor;
uniform float uExCheekIntensity;
uniform float uExShyIntensity;
uniform float uExShadowIntensity;
uniform float uFrontHairAlpha;
uniform float uHairShadowDistance;
uniform float uHairShadowBias;
uniform float uHairShadowSoftness;
uniform float uMaxEyeHairDistance;
uniform vec2 uNprResolution;
uniform vec2 uCameraNearFar;
uniform mat4 uSelfShadowMatrix;
uniform vec4 uSelfShadowRect;
uniform vec2 uSelfShadowTexelSize;
uniform float uSelfShadowBias;
uniform float uStockingsPower;
uniform float uStockingsDarkWidth;
uniform vec3 uStockingsColor;
uniform vec3 uStockingsDarkColor;
uniform float uStockingsLightWidth;
uniform float uStockingsLightIntensity;
uniform float uStockingsRoughness;
uniform float uWetness;
uniform float uSnow;
uniform float uBloomIntensity;
uniform vec3 uBloomColor;
uniform float uDebug;

varying vec2 vNprUv;
varying vec3 vNprNormalVS;
varying vec3 vNprViewPosition;
varying vec3 vNprWorldPosition;

#include <common>
#include <packing>
#include <lights_pars_begin>
#include <fog_pars_fragment>

// Anime NPR only consumes the primary directional shadow. Pulling Three.js'
// complete shadowmap_pars_fragment also compiles its 9/17-tap PCF loops and
// triggers ANGLE/D3D warning X3595 (implicit texture gradients in a varying
// loop). Keep the renderer-owned uniform layout, but declare only what this
// shader actually samples.
#if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
struct DirectionalLightShadow {
    float shadowIntensity;
    float shadowBias;
    float shadowNormalBias;
    float shadowRadius;
    vec2 shadowMapSize;
};
uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];

float nprShadowCompare(sampler2D depthMap, vec2 uv, float receiverDepth) {
    return step(receiverDepth, unpackRGBAToDepth(texture2D(depthMap, uv)));
}
#endif

float nprSaturate(float x) { return clamp(x, 0.0, 1.0); }

float nprLinearEyeDepth(float depth01) {
    float nearPlane = uCameraNearFar.x;
    float farPlane = uCameraNearFar.y;
    float z = depth01 * 2.0 - 1.0;
    return (2.0 * nearPlane * farPlane)
        / max(0.00001, farPlane + nearPlane - z * (farPlane - nearPlane));
}

// Port of GetHairShadow in CharFaceCore.hlsl. The source offsets the hair
// depth lookup along the main-light direction and compares linear eye depth.
float nprHairShadow(vec3 lightVS) {
    if (uHasHairDepth < 0.5) return 1.0;
    vec2 screenUv = gl_FragCoord.xy / max(uNprResolution, vec2(1.0));
    float eyeDepth = nprLinearEyeDepth(gl_FragCoord.z);
    float perspectiveScale = 1.0 / max(eyeDepth, 0.05);
    vec2 offsetUv = lightVS.xy * uHairShadowDistance * 0.04 * perspectiveScale;
    float packedHairDepth = unpackRGBAToDepth(
        texture2D(
            uHairDepthTexture,
            clamp(screenUv + offsetUv, 0.0, 1.0)
        )
    );
    // The clear value means that no front hair was written at this pixel.
    if (packedHairDepth >= 0.99999) return 1.0;
    float hairDepth = nprLinearEyeDepth(packedHairDepth);
    float depthDelta = hairDepth + uHairShadowBias - eyeDepth;
    float softness = max(uHairShadowSoftness, eyeDepth * 0.0002);
    return smoothstep(-softness, softness, depthDelta);
}

float nprSelfShadow() {
    if (uHasSelfShadowMap < 0.5) return 1.0;
    vec4 coord = uSelfShadowMatrix * vec4(vNprWorldPosition, 1.0);
    vec3 shadowCoord = coord.xyz / max(coord.w, 0.00001);
    if (
        shadowCoord.x <= uSelfShadowRect.x ||
        shadowCoord.y <= uSelfShadowRect.y ||
        shadowCoord.x >= uSelfShadowRect.z ||
        shadowCoord.y >= uSelfShadowRect.w ||
        shadowCoord.z <= 0.0 ||
        shadowCoord.z >= 1.0
    ) return 1.0;
    vec2 texel = uSelfShadowTexelSize * 0.75;
    float receiver = shadowCoord.z - uSelfShadowBias;
    float lit =
        step(receiver, unpackRGBAToDepth(texture2D(uSelfShadowMap, shadowCoord.xy + vec2(-texel.x, -texel.y)))) +
        step(receiver, unpackRGBAToDepth(texture2D(uSelfShadowMap, shadowCoord.xy + vec2( texel.x, -texel.y)))) +
        step(receiver, unpackRGBAToDepth(texture2D(uSelfShadowMap, shadowCoord.xy + vec2(-texel.x,  texel.y)))) +
        step(receiver, unpackRGBAToDepth(texture2D(uSelfShadowMap, shadowCoord.xy + vec2( texel.x,  texel.y))));
    return lit * 0.25;
}

// Explicit fixed taps keep the anime boundary stable and soften staircase
// artifacts without bringing back Three.js' loop-based PCF implementation.
float nprMainSceneShadow() {
    #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    vec4 shadowCoord = vDirectionalShadowCoord[0];
    shadowCoord.xyz /= max(shadowCoord.w, 0.000001);
    shadowCoord.z += directionalLightShadows[0].shadowBias;
    bool inFrustum =
        shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 &&
        shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 &&
        shadowCoord.z <= 1.0;
    if (!inFrustum) return 1.0;
    vec2 texel = max(directionalLightShadows[0].shadowRadius, 0.75)
        / max(directionalLightShadows[0].shadowMapSize, vec2(1.0));
    float filteredShadow = (
        nprShadowCompare(directionalShadowMap[0], shadowCoord.xy + vec2(-texel.x, -texel.y), shadowCoord.z) +
        nprShadowCompare(directionalShadowMap[0], shadowCoord.xy + vec2( texel.x, -texel.y), shadowCoord.z) +
        nprShadowCompare(directionalShadowMap[0], shadowCoord.xy + vec2(-texel.x,  texel.y), shadowCoord.z) +
        nprShadowCompare(directionalShadowMap[0], shadowCoord.xy + vec2( texel.x,  texel.y), shadowCoord.z)
    ) * 0.25;
    return mix(1.0, filteredShadow, directionalLightShadows[0].shadowIntensity);
    #else
    return 1.0;
    #endif
}

vec3 nprApplyExpression(vec3 base, vec4 faceMap) {
    if (uHasExpressionMap < 0.5) return base;
    vec4 expression = texture2D(uExpressionMap, vNprUv);
    vec3 cheek = mix(base, base * uExCheekColor, expression.r);
    base = mix(base, cheek, uExCheekIntensity);
    vec3 shy = mix(base, base * uExShyColor, expression.g);
    base = mix(base, shy, uExShyIntensity);
    vec3 faceShadow = mix(base, base * uExShadowColor, expression.b);
    base = mix(base, faceShadow, uExShadowIntensity);
    vec3 eyeShadow = mix(base, base * uExEyeColor, faceMap.r);
    return mix(base, eyeShadow, uExShadowIntensity);
}

// Direct port of GetRampUV in CharRenderingHelpers.hlsl.
vec2 nprGetRampUV(float NoL, bool singleMaterial, vec4 lightMap, float shadowAttenuation) {
    float ao = lightMap.g;
    float materialId = singleMaterial ? 0.0 : lightMap.a;
    float NoL01 = NoL * 0.5 + 0.5;
    float shadow = min(1.0, dot(vec2(NoL01), vec2(2.0 * ao)));
    shadow = max(0.001, shadow) * 0.75 + 0.25;
    shadow = shadow > 1.0 ? 0.99 : shadow;
    shadow = mix(0.20, shadow, nprSaturate(shadowAttenuation + 0.001));
    shadow = mix(0.0, shadow, step(0.05, ao));
    shadow = mix(1.0, shadow, step(ao, 0.95));
    return vec2(shadow, materialId + 0.05);
}

vec3 nprRampDiffuse(float NoL, bool singleMaterial, vec3 base, vec4 lightMap, float shadowAttenuation) {
    vec2 rampUV = nprGetRampUV(NoL, singleMaterial, lightMap, shadowAttenuation);
    float authoredToon = uHasToonMap > 0.5
        ? texture2D(uToonMap, vec2(rampUV.x, 0.0)).r
        : smoothstep(0.25, 1.0, rampUV.x);
    vec3 cool = uHasRamp > 0.5 ? texture2D(uRampCool, rampUV).rgb : mix(uShadowColor, vec3(1.0), authoredToon);
    vec3 warm = uHasRamp > 0.5 ? texture2D(uRampWarm, rampUV).rgb : mix(uShadowColor * vec3(1.10, 0.92, 0.86), vec3(1.0), authoredToon);
    return mix(cool, warm, uWarmMix) * base * uLightColor;
}

// Direct port of GetSpecular.
vec3 nprSpecular(float NoH, vec3 base, vec4 lightMap, float shadowAttenuation) {
    float materialWeight = uHasMaterialSpecular > 0.5 ? 0.72 : 0.0;
    float shininess = mix(
        max(1.0, uSpecularShininess),
        max(1.0, uMaterialShininess),
        materialWeight
    );
    vec3 materialSpecular = mix(vec3(1.0), uMaterialSpecularColor, materialWeight);
    float bp = pow(max(0.01, NoH), shininess) * shadowAttenuation;
    float threshold = 1.03 - lightMap.b;
    float value = smoothstep(threshold - uSpecularRoughness, threshold + uSpecularRoughness, bp);
    value *= lightMap.r * uSpecularIntensity;
    return uSpecularColor * materialSpecular * base * uLightColor * value;
}

vec3 nprApplyMatcap(vec3 color, vec3 N, vec3 V) {
    if (uHasMatcapMap < 0.5 || uMatcapStrength <= 0.0) return color;
    vec3 xAxis = normalize(vec3(V.z, 0.0, -V.x));
    vec3 yAxis = cross(V, xAxis);
    vec2 matcapUv = vec2(dot(xAxis, N), dot(yAxis, N)) * 0.495 + 0.5;
    vec3 sphere = texture2D(uMatcapMap, clamp(matcapUv, 0.0, 1.0)).rgb;
    if (uMatcapMode < 1.5) {
        return color * mix(vec3(1.0), sphere, clamp(uMatcapStrength, 0.0, 1.0));
    }
    return color + sphere * max(0.0, uMatcapStrength);
}

vec3 nprRimShadow(vec3 N, vec3 V) {
    float rim = nprSaturate(dot(normalize(V), N));
    float s = nprSaturate(pow(max(1.0 - rim, 0.001), 1.2) * 2.5);
    s = smoothstep(0.3, 1.0, s) * uRimShadowIntensity * 0.25;
    return mix(vec3(1.0), uRimShadowColor * 2.0, max(s, 0.0));
}

vec3 nprFaceDiffuse(vec3 L, vec3 base, vec4 faceMap, float shadowAttenuation) {
    vec3 projected = normalize(L - dot(L, uHeadUpVS) * uHeadUpVS);
    bool rightSide = dot(projected, uHeadRightVS) > 0.0;
    vec2 sdfUv = rightSide ? vec2(1.0 - vNprUv.x, vNprUv.y) : vNprUv;
    float threshold = uHasFaceMap > 0.5 ? texture2D(uFaceMap, sdfUv).a : uFaceThreshold;
    float FoL01 = dot(uHeadForwardVS, projected) * 0.5 + 0.5;
    float edge = smoothstep(1.0 - threshold - uFaceSoftness, 1.0 - threshold + uFaceSoftness, FoL01);
    vec3 faceShadow = mix(uShadowColor, vec3(1.0), edge * shadowAttenuation);
    vec3 eyeShadow = mix(uEyeShadowColor, vec3(1.0), smoothstep(0.3, 0.5, FoL01) * shadowAttenuation);
    float eyeMask = step(0.1, faceMap.r) - step(0.8, faceMap.r);
    return base * mix(mix(faceShadow, eyeShadow, faceMap.r), vec3(1.0), eyeMask * uEyeAlwaysLit);
}

vec3 nprApplyStockings(vec3 base, float NoV) {
    if (uHasStockingsMap < 0.5) return base;
    vec4 sm = texture2D(uStockingsMap, vNprUv);
    float power = max(0.04, uStockingsPower);
    float darkWidth = max(0.0, uStockingsDarkWidth * power);
    float darkIntensity = nprSaturate((nprSaturate(NoV) - power) / max(darkWidth - power, -0.001)) * sm.r;
    vec3 darkColor = mix(vec3(1.0), uStockingsDarkColor, darkIntensity);
    darkColor = mix(vec3(1.0), darkColor * base, darkIntensity) * base;
    float lightIntensity = mix(0.5, 1.0, sm.b * uStockingsRoughness) * sm.g * uStockingsLightIntensity;
    lightIntensity *= max(0.004, pow(nprSaturate(NoV), uStockingsLightWidth));
    return mix(base, lightIntensity * (darkColor + uStockingsColor) + darkColor, step(0.01, sm.r));
}

void main() {
    vec4 texel = uHasBaseMap > 0.5 ? texture2D(uBaseMap, vNprUv) : vec4(1.0);
    vec4 baseSample = vec4(texel.rgb * uBaseColor, texel.a * uOpacity);
    if (uHasAlphaMap > 0.5) {
        baseSample.a *= texture2D(uAlphaMap, vNprUv).g;
    }
    if (baseSample.a < uAlphaTest) discard;

    int category = int(uCategory + 0.5);
    bool face = category == 1;
    bool skin = category == 2;
    bool hair = category == 3 || category == 4;
    bool frontHair = category == 4;
    bool eye = category == 5 || category == 6;
    bool stocking = category == 11;
    bool metal = category == 12;
    bool emissive = category == 15;

    vec3 N = normalize(vNprNormalVS);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vNprViewPosition);
    vec3 L = normalize(uLightDirVS);
    vec3 H = normalize(V + L);
    float NoL = dot(N, L);
    float NoV = dot(N, V);
    float shadow = nprSaturate(uSceneShadow * nprMainSceneShadow());
    // Ordinary PMX materials do not carry Star Rail's packed light map. A
    // white R fallback made every such material fully specular and washed out
    // skin/hair. Use conservative category-aware defaults instead.
    float fallbackSpecular = metal ? 0.82 : hair ? 0.16 : skin ? 0.05 : stocking ? 0.18 : 0.10;
    float fallbackThreshold = metal ? 0.52 : hair ? 0.66 : 0.40;
    vec4 fallbackLightMap = vec4(
        fallbackSpecular,
        uAoFallback,
        fallbackThreshold,
        0.0
    );
    vec4 lightMap = uHasLightMap > 0.5
        ? texture2D(uLightMap, vNprUv)
        : fallbackLightMap;
    vec4 faceMap = uHasFaceMap > 0.5 ? texture2D(uFaceMap, vNprUv) : vec4(0.0);
    vec3 base = stocking ? nprApplyStockings(baseSample.rgb, NoV) : baseSample.rgb;
    if (face) base = nprApplyExpression(base, faceMap);

    // Equivalent of the source eye stencil depth rejection: an eye belonging
    // to a more distant character cannot leak through a foreground hair pass.
    if (eye && uHasHairDepth > 0.5) {
        vec2 screenUv = gl_FragCoord.xy / max(uNprResolution, vec2(1.0));
        float fragmentDepth = nprLinearEyeDepth(gl_FragCoord.z);
        float closestHair = nprLinearEyeDepth(
            unpackRGBAToDepth(texture2D(uHairDepthTexture, screenUv))
        );
        if (fragmentDepth - closestHair > uMaxEyeHairDistance) discard;
    }

    shadow = min(shadow, nprSelfShadow());
    if (face) shadow = min(shadow, nprHairShadow(L));

    // Face SDF is an opt-in authored asset. A correctly named PMX face with
    // no matching SDF must still render safely through the ordinary NPR ramp.
    bool useFaceSdf = face && uHasFaceMap > 0.5;
    vec3 diffuse = (useFaceSdf || eye)
        ? nprFaceDiffuse(L, base, faceMap, shadow)
        : nprRampDiffuse(NoL, hair, base, lightMap, shadow);
    // MMDLoader stores authored PMX ambient in its emissive field (already reduced to
    // 20% when a base texture exists). Restore that native MMD contribution
    // independently from Anime NPR's scene fill. Without it, materials whose
    // diffuse is intentionally dark lose texture/detail and become black.
    // Modulate PMX ambient by the authored texture. Adding a flat ambient
    // colour erased hair/cloth detail and lifted every shadow into a pastel
    // wash; textured modulation restores the native MMD palette and contrast.
    diffuse += texel.rgb * uMaterialAmbientColor * max(0.0, uMaterialAmbientIntensity);
    // Scene fill is separate from the PMX-authored material ambient.
    diffuse += base * uAmbient * 0.55;

    float specInput = hair ? NoV * step(0.0, NoL) : max(dot(N, H), 0.0);
    vec3 spec = (face || eye) ? vec3(0.0) : nprSpecular(specInput, base, lightMap, shadow);
    spec *= metal ? 2.2 : skin ? 0.3 : hair ? 1.4 : stocking ? 0.6 : 1.0;
    spec *= 1.0 + uWetness * 1.5;

    float fresnel = pow(max(1.0 - NoV, 0.01), max(uRimSoftness, 0.01));
    vec3 rim = eye ? vec3(0.0) : uRimColor * uLightColor * fresnel
        * mix(0.2, 1.0, nprSaturate(NoL * shadow)) * uRimIntensity;
    rim *= hair ? 1.4 : 1.0;

    // PMX texture alpha is transparency, never an emission mask. Emission is
    // enabled only for a material explicitly classified as emissive.
    float emissionMask = emissive ? 1.0 : 0.0;
    vec3 emission = uEmissionColor * base * max(0.0, emissionMask * uEmissionIntensity);
    vec3 color = (diffuse + spec + rim + emission) * ((face || eye) ? vec3(1.0) : nprRimShadow(N, V));
    color = nprApplyMatcap(color, N, V);
    if (emissive || category == 6) {
        color *= 1.0 + max(0.0, uBloomIntensity) * uBloomColor;
    }
    color = mix(color, vec3(1.0), uSnow * (hair ? 0.35 : stocking ? 0.08 : metal ? 0.15 : 0.25));

    if (face && uNoseIntensity > 0.0) {
        float fv = pow(abs(dot(uHeadForwardVS, V)), max(0.01, uNosePower));
        color *= mix(1.0, 0.76, step(0.92, fv) * uNoseIntensity);
    }

    int debugMode = int(uDebug + 0.5);
    if (debugMode == 1) color = vec3(NoL * 0.5 + 0.5);
    else if (debugMode == 2) color = vec3(nprGetRampUV(NoL, hair, lightMap, shadow).x);
    else if (debugMode == 3) color = vec3(lightMap.g);
    else if (debugMode == 4) color = vec3(lightMap.a);
    else if (debugMode == 5) color = N * 0.5 + 0.5;
    else if (debugMode == 6) color = vec3(float(category) / 15.0, 0.35, 1.0 - float(category) / 15.0);

    float alpha = baseSample.a;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luma), color, max(0.0, uColorSaturation));
    color = mix(baseSample.rgb, color, clamp(uStrength, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
    #include <fog_fragment>
}
`;
