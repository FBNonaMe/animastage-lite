/*
 * Independent Three.js ShaderMaterial factory for the AnimeStage Star Rail
 * NPR Engine. Modified source port of StarRailNPRShader 2.10.3.
 * Copyright (C) 2023 Stalo <stalowork@163.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { AnimeNprCategory } from "./AnimeNprMaterialClassifier.js";
import {
    animeNprVertexShader,
    animeNprFragmentShader,
} from "./shaders/star-rail-character.glsl.js";
import {
    resolveAnimeNprAlphaPolicy,
    resolveAnimeNprEmission,
    resolveAnimeNprMaterialAmbient,
} from "./AnimeNprMaterialCompatibility.js";

const onePixel = (rgba, colorSpace = THREE.NoColorSpace) => {
    const texture = new THREE.DataTexture(new Uint8Array(rgba), 1, 1, THREE.RGBAFormat);
    texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    return texture;
};

const WHITE = onePixel([255, 255, 255, 255], THREE.SRGBColorSpace);
const LIGHTMAP = onePixel([255, 128, 128, 0]);
const FACE = onePixel([0, 0, 0, 128]);
const STOCKINGS = onePixel([0, 0, 0, 255]);

// TextureLoader still returns a THREE.Texture when the underlying PMX asset is
// missing. Sampling that incomplete texture can turn an otherwise valid
// material black. Only bind textures that reached a usable image/source.
const usableTexture = (texture) => {
    if (!texture?.isTexture) return false;
    const data = texture.source?.data || texture.image;
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    const width = Number(data.videoWidth ?? data.naturalWidth ?? data.width);
    const height = Number(data.videoHeight ?? data.naturalHeight ?? data.height);
    // Compressed/cube sources do not always expose dimensions on the wrapper;
    // for ordinary PMX image textures, zero dimensions reliably mean a failed
    // toon/base/sphere file load.
    if (Number.isFinite(width) || Number.isFinite(height)) {
        return width > 0 && height > 0;
    }
    return true;
};

const colorValue = (value, fallback) => {
    const color = new THREE.Color(fallback);
    if (value?.isColor) color.copy(value);
    return color;
};

export function createAnimeNprUniforms() {
    return {
        uBaseMap: { value: WHITE },
        uUvTransform: { value: new THREE.Matrix3() },
        uLightMap: { value: LIGHTMAP },
        uRampCool: { value: WHITE },
        uRampWarm: { value: WHITE },
        uFaceMap: { value: FACE },
        uExpressionMap: { value: FACE },
        uStockingsMap: { value: STOCKINGS },
        uToonMap: { value: WHITE },
        uMatcapMap: { value: WHITE },
        uHairDepthTexture: { value: WHITE },
        uSelfShadowMap: { value: WHITE },
        uHasBaseMap: { value: 0 },
        uHasLightMap: { value: 0 },
        uHasRamp: { value: 0 },
        uHasFaceMap: { value: 0 },
        uHasExpressionMap: { value: 0 },
        uHasStockingsMap: { value: 0 },
        uHasToonMap: { value: 0 },
        uHasMatcapMap: { value: 0 },
        uMatcapMode: { value: 2 },
        uMatcapStrength: { value: 1 },
        uHasHairDepth: { value: 0 },
        uHasSelfShadowMap: { value: 0 },
        uBaseColor: { value: new THREE.Color(1, 1, 1) },
        uMaterialAmbientColor: { value: new THREE.Color(0, 0, 0) },
        uMaterialAmbientIntensity: { value: 0 },
        uColorSaturation: { value: 1.06 },
        uOpacity: { value: 1 },
        uAlphaTest: { value: 0 },
        uCategory: { value: AnimeNprCategory.GENERIC },
        uStrength: { value: 1 },
        uLightDirVS: { value: new THREE.Vector3(0.3, 0.7, 0.4).normalize() },
        uLightColor: { value: new THREE.Color(1, 1, 1) },
        uAmbient: { value: new THREE.Color(0.32, 0.33, 0.36) },
        uSceneShadow: { value: 1 },
        uShadowColor: { value: new THREE.Color(0.6, 0.62, 0.78) },
        uEyeShadowColor: { value: new THREE.Color(0.7, 0.6, 0.62) },
        uWarmMix: { value: 0.35 },
        uAoFallback: { value: 0.5 },
        uSpecularColor: { value: new THREE.Color(1, 1, 1) },
        uMaterialSpecularColor: { value: new THREE.Color(1, 1, 1) },
        uHasMaterialSpecular: { value: 0 },
        uMaterialShininess: { value: 20 },
        uSpecularShininess: { value: 20 },
        uSpecularIntensity: { value: 0.5 },
        uSpecularRoughness: { value: 0.08 },
        uRimColor: { value: new THREE.Color(0.9, 0.94, 1) },
        uRimIntensity: { value: 0.5 },
        uRimSoftness: { value: 3 },
        uRimShadowColor: { value: new THREE.Color(0.5, 0.55, 0.72) },
        uRimShadowIntensity: { value: 0.5 },
        uEmissionColor: { value: new THREE.Color(1, 1, 1) },
        uEmissionIntensity: { value: 0 },
        uEmissionThreshold: { value: 0.95 },
        uHeadForwardVS: { value: new THREE.Vector3(0, 0, 1) },
        uHeadRightVS: { value: new THREE.Vector3(1, 0, 0) },
        uHeadUpVS: { value: new THREE.Vector3(0, 1, 0) },
        uFaceThreshold: { value: 0.5 },
        uFaceSoftness: { value: 0.02 },
        uEyeAlwaysLit: { value: 0.5 },
        uNosePower: { value: 8 },
        uNoseIntensity: { value: 0.4 },
        uExCheekColor: { value: new THREE.Color(1, 0.62, 0.68) },
        uExShyColor: { value: new THREE.Color(1, 0.74, 0.78) },
        uExShadowColor: { value: new THREE.Color(0.72, 0.62, 0.74) },
        uExEyeColor: { value: new THREE.Color(0.72, 0.7, 0.86) },
        uExCheekIntensity: { value: 0.55 },
        uExShyIntensity: { value: 0.45 },
        uExShadowIntensity: { value: 0.5 },
        uFrontHairAlpha: { value: 0.35 },
        uHairShadowDistance: { value: 0.2 },
        uHairShadowBias: { value: 0.001 },
        uHairShadowSoftness: { value: 0.0025 },
        uMaxEyeHairDistance: { value: 0.2 },
        uNprResolution: { value: new THREE.Vector2(1, 1) },
        uCameraNearFar: { value: new THREE.Vector2(0.1, 1000) },
        uSelfShadowTexelSize: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
        uSelfShadowBias: { value: 0.0012 },
        uStockingsPower: { value: 1 },
        uStockingsDarkWidth: { value: 0.5 },
        uStockingsColor: { value: new THREE.Color(0.9, 0.9, 0.95) },
        uStockingsDarkColor: { value: new THREE.Color(0.38, 0.34, 0.45) },
        uStockingsLightWidth: { value: 2 },
        uStockingsLightIntensity: { value: 0.35 },
        uStockingsRoughness: { value: 0.5 },
        uWetness: { value: 0 },
        uSnow: { value: 0 },
        uBloomIntensity: { value: 0.45 },
        uBloomColor: { value: new THREE.Color(1, 0.88, 0.94) },
        uDebug: { value: 0 },
    };
}

// These uniforms describe character-authored lookup data and head space. They
// must not share mutable uniform objects between characters: two PMX models
// can use different Star Rail lookup maps and can face different directions
// in the same frame. Global lighting/style uniforms intentionally remain
// shared so the inspector can still grade the whole shot at once.
export const ANIME_NPR_CHARACTER_UNIFORM_KEYS = Object.freeze([
    "uLightMap",
    "uHasLightMap",
    "uRampCool",
    "uRampWarm",
    "uHasRamp",
    "uFaceMap",
    "uHasFaceMap",
    "uExpressionMap",
    "uHasExpressionMap",
    "uStockingsMap",
    "uHasStockingsMap",
    "uHeadForwardVS",
    "uHeadRightVS",
    "uHeadUpVS",
]);

const cloneCharacterValue = (value) => {
    // Texture identity is significant and Texture.clone() would allocate a
    // different GPU resource. Math objects, on the other hand, must be owned
    // by the character/material draw scope.
    if (value?.isTexture) return value;
    if (value?.clone) return value.clone();
    return value;
};

export function createAnimeNprCharacterUniforms(sourceUniforms) {
    const result = {};
    for (const key of ANIME_NPR_CHARACTER_UNIFORM_KEYS) {
        const uniform = sourceUniforms?.[key];
        if (!uniform) continue;
        result[key] = { value: cloneCharacterValue(uniform.value) };
    }
    return result;
}

export function applyAnimeNprCharacterUniforms(targetUniforms, sourceUniforms) {
    if (!targetUniforms || !sourceUniforms) return false;
    for (const key of ANIME_NPR_CHARACTER_UNIFORM_KEYS) {
        const target = targetUniforms[key];
        const source = sourceUniforms[key];
        if (!target || !source) continue;
        const next = source.value;
        if (
            target.value &&
            next &&
            !next.isTexture &&
            typeof target.value.copy === "function"
        ) {
            target.value.copy(next);
        } else {
            target.value = next;
        }
    }
    return true;
}

const FRONT_HAIR = AnimeNprCategory.FRONT_HAIR;
const GLASS = AnimeNprCategory.GLASS;

export class AnimeNprMaterialFactory {
    constructor(sharedUniforms, logger = null) {
        this.sharedUniforms = sharedUniforms || createAnimeNprUniforms();
        this.logger = logger;
        this.drawScopeResolver = null;
    }

    setDrawScopeResolver(resolver) {
        this.drawScopeResolver = typeof resolver === "function" ? resolver : null;
    }

    prepareMaterialForDraw(material, object, camera, renderer = null) {
        return (
            material?.userData?._animeNprPrepareDraw?.(
                object,
                camera,
                renderer,
            ) || false
        );
    }

    create(source, category) {
        const baseMap = usableTexture(source?.map) ? source.map : null;
        const alphaMap = usableTexture(source?.alphaMap) ? source.alphaMap : null;
        const toonMap = usableTexture(source?.gradientMap)
            ? source.gradientMap
            : null;
        const matcapMap = usableTexture(source?.matcap) ? source.matcap : null;
        baseMap?.updateMatrix?.();
        const alphaPolicy = resolveAnimeNprAlphaPolicy(source, category, {
            hairCategory: AnimeNprCategory.HAIR,
            frontHairCategory: FRONT_HAIR,
            glassCategory: GLASS,
        });
        const emissionIntensity = resolveAnimeNprEmission(
            source,
            category,
            AnimeNprCategory.EMISSIVE,
        );
        const materialAmbient = resolveAnimeNprMaterialAmbient(source);
        const uniforms = {
            ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
            ...this.sharedUniforms,
            // Per-material uniform holders are updated for the actual object
            // immediately before its draw. This also covers the uncommon but
            // valid case where two character meshes reuse one material.
            ...createAnimeNprCharacterUniforms(this.sharedUniforms),
            uBaseMap: { value: baseMap || WHITE },
            uAlphaMap: { value: alphaMap || WHITE },
            uToonMap: { value: toonMap || WHITE },
            uMatcapMap: { value: matcapMap || WHITE },
            uUvTransform: {
                value: baseMap?.matrix?.clone?.() || new THREE.Matrix3(),
            },
            uHasBaseMap: { value: baseMap ? 1 : 0 },
            uHasAlphaMap: { value: alphaMap ? 1 : 0 },
            uHasToonMap: { value: toonMap ? 1 : 0 },
            uHasMatcapMap: { value: matcapMap ? 1 : 0 },
            uMatcapMode: {
                value:
                    source?.matcapCombine === THREE.MultiplyOperation ? 1 : 2,
            },
            uMatcapStrength: {
                value: Number.isFinite(source?.userData?.animeNprMatcapStrength)
                    ? Math.max(0, source.userData.animeNprMatcapStrength)
                    : 1,
            },
            uBaseColor: { value: colorValue(source?.color, 0xffffff) },
            uMaterialAmbientColor: {
                value: colorValue(source?.emissive, 0x000000),
            },
            uMaterialAmbientIntensity: { value: materialAmbient.intensity },
            uOpacity: { value: alphaPolicy.opacity },
            uAlphaTest: { value: alphaPolicy.alphaTest },
            uCategory: { value: category },
            uEmissionColor: { value: colorValue(source?.emissive, 0xffffff) },
            uEmissionIntensity: { value: emissionIntensity },
            uMaterialSpecularColor: {
                value: colorValue(source?.specular, 0xffffff),
            },
            uHasMaterialSpecular: { value: source?.specular?.isColor ? 1 : 0 },
            uMaterialShininess: {
                value: Number.isFinite(Number(source?.shininess))
                    ? Math.max(1, Number(source.shininess))
                    : 20,
            },
            // Per-object atlas coordinates differ per character draw, while the
            // atlas sampler and texel size remain shared.
            uSelfShadowMatrix: { value: new THREE.Matrix4() },
            uSelfShadowRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        };

        const material = new THREE.ShaderMaterial({
            name: `${source?.name || "Material"} · Anime NPR`,
            uniforms,
            vertexShader: animeNprVertexShader,
            fragmentShader: animeNprFragmentShader,
            lights: true,
            transparent: alphaPolicy.transparent,
            depthWrite: alphaPolicy.depthWrite,
            depthTest: source?.depthTest !== false,
            side: source?.side ?? THREE.FrontSide,
            blending: source?.blending ?? THREE.NormalBlending,
            blendSrc: source?.blendSrc ?? THREE.SrcAlphaFactor,
            blendDst: source?.blendDst ?? THREE.OneMinusSrcAlphaFactor,
            blendEquation: source?.blendEquation ?? THREE.AddEquation,
            blendSrcAlpha: source?.blendSrcAlpha ?? null,
            blendDstAlpha: source?.blendDstAlpha ?? null,
            blendEquationAlpha: source?.blendEquationAlpha ?? null,
            blendColor: colorValue(source?.blendColor, 0x000000),
            blendAlpha: Number(source?.blendAlpha) || 0,
            alphaToCoverage: alphaPolicy.alphaToCoverage,
            premultipliedAlpha: !!source?.premultipliedAlpha,
            dithering: !!source?.dithering,
            polygonOffset: !!source?.polygonOffset,
            polygonOffsetFactor: source?.polygonOffsetFactor || 0,
            polygonOffsetUnits: source?.polygonOffsetUnits || 0,
            clipping: !!source?.clipping,
            alphaHash: !!source?.alphaHash,
            forceSinglePass: !!source?.forceSinglePass,
            colorWrite: source?.colorWrite !== false,
            depthFunc: source?.depthFunc ?? THREE.LessEqualDepth,
            fog: true,
        });
        material.toneMapped = source?.toneMapped !== false;
        material.visible = source?.visible !== false;
        material.defines = { ...(source?.defines || {}) };
        material.userData = {
            ...(source?.userData || {}),
            animeNpr: true,
            animeNprSourceUuid: source?.uuid || null,
            animeNprCategory: category,
            animeNprAlphaPolicy: { ...alphaPolicy },
            animeNprTexturePolicy: {
                base: !!baseMap,
                alpha: !!alphaMap,
                toon: !!toonMap,
                matcap: !!matcapMap,
            },
            outlineParameters: source?.userData?.outlineParameters
                ? { ...source.userData.outlineParameters }
                : undefined,
        };
        // PMX material morphs update the source material while the NPR
        // variant is installed on the mesh. Mirror the dynamic values before
        // every draw so opacity and colour animation remain identical.
        const prepareDraw = (object, camera, renderer) => {
            let drawUniforms = this.sharedUniforms;
            try {
                const resolved = this.drawScopeResolver?.(
                    object,
                    camera,
                    material,
                    source,
                    renderer,
                );
                if (resolved) drawUniforms = resolved.uniforms || resolved;
            } catch (error) {
                this.logger?.sample(
                    "warn",
                    "character-scope",
                    "failed to resolve character draw scope; using global defaults",
                    { message: error?.message || String(error) },
                    `draw-scope:${source?.uuid || "unknown"}`,
                    5000,
                );
            }
            applyAnimeNprCharacterUniforms(uniforms, drawUniforms);
            // PMX textures are loaded asynchronously. A variant can be created
            // before the image reaches the Texture object; bind it as soon as
            // it becomes usable, while failed/missing files keep safe 1px
            // fallbacks instead of sampling black.
            const liveBaseMap = usableTexture(source?.map) ? source.map : null;
            const liveAlphaMap = usableTexture(source?.alphaMap)
                ? source.alphaMap
                : null;
            const liveToonMap = usableTexture(source?.gradientMap)
                ? source.gradientMap
                : null;
            const liveMatcapMap = usableTexture(source?.matcap)
                ? source.matcap
                : null;
            liveBaseMap?.updateMatrix?.();
            uniforms.uBaseMap.value = liveBaseMap || WHITE;
            uniforms.uAlphaMap.value = liveAlphaMap || WHITE;
            uniforms.uToonMap.value = liveToonMap || WHITE;
            uniforms.uMatcapMap.value = liveMatcapMap || WHITE;
            uniforms.uHasBaseMap.value = liveBaseMap ? 1 : 0;
            uniforms.uHasAlphaMap.value = liveAlphaMap ? 1 : 0;
            uniforms.uHasToonMap.value = liveToonMap ? 1 : 0;
            uniforms.uHasMatcapMap.value = liveMatcapMap ? 1 : 0;
            uniforms.uMatcapMode.value =
                source?.matcapCombine === THREE.MultiplyOperation ? 1 : 2;
            if (liveBaseMap?.matrix) {
                uniforms.uUvTransform.value.copy(liveBaseMap.matrix);
            } else {
                uniforms.uUvTransform.value.identity();
            }
            const sourceOpacity = Number(source?.opacity);
            uniforms.uOpacity.value = Number.isFinite(sourceOpacity)
                ? Math.min(1, Math.max(0, sourceOpacity))
                : 1;
            const liveCategory = Math.round(Number(uniforms.uCategory.value) || 0);
            const liveAlphaPolicy = resolveAnimeNprAlphaPolicy(
                source,
                liveCategory,
                {
                    hairCategory: AnimeNprCategory.HAIR,
                    frontHairCategory: FRONT_HAIR,
                    glassCategory: GLASS,
                },
            );
            const transparencyChanged =
                material.transparent !== liveAlphaPolicy.transparent;
            material.transparent = liveAlphaPolicy.transparent;
            material.depthWrite = liveAlphaPolicy.depthWrite;
            material.alphaToCoverage = liveAlphaPolicy.alphaToCoverage;
            uniforms.uAlphaTest.value = liveAlphaPolicy.alphaTest;
            material.userData.animeNprAlphaPolicy = { ...liveAlphaPolicy };
            if (transparencyChanged) material.needsUpdate = true;
            if (source?.color?.isColor) uniforms.uBaseColor.value.copy(source.color);
            if (source?.specular?.isColor) {
                uniforms.uMaterialSpecularColor.value.copy(source.specular);
            }
            const liveShininess = Number(source?.shininess);
            if (Number.isFinite(liveShininess)) {
                uniforms.uMaterialShininess.value = Math.max(1, liveShininess);
            }
            if (source?.emissive?.isColor) {
                uniforms.uEmissionColor.value.copy(source.emissive);
                uniforms.uMaterialAmbientColor.value.copy(source.emissive);
            }
            const liveAmbient = resolveAnimeNprMaterialAmbient(source);
            uniforms.uMaterialAmbientIntensity.value = liveAmbient.intensity;
            uniforms.uEmissionIntensity.value = resolveAnimeNprEmission(
                source,
                liveCategory,
                AnimeNprCategory.EMISSIVE,
            );
            // Low-frequency forensic sampling: records texture arrival,
            // opacity morphs, blend-path changes and outline state changes
            // without putting per-frame noise into the ring buffer.
            this.logger?.monitorMaterial(
                material.userData._animeNprLogEntry || {
                    source,
                    animeNpr: material,
                    category: liveCategory,
                    meshName: null,
                    explanation: null,
                    contexts: [],
                },
            );
            return true;
        };
        // Modern Three.js (r166+) invokes Object3D.onBeforeRender, not the
        // deprecated Material callback. AnimeNprMaterialRegistry installs the
        // object hook and dispatches here with the exact material draw/group.
        Object.defineProperty(material.userData, "_animeNprPrepareDraw", {
            value: prepareDraw,
            configurable: true,
        });
        material.customProgramCacheKey = () =>
            `AnimeStageStarRailNpr:n16:${material.transparent ? 1 : 0}`;
        return material;
    }

    applyCategory(material, source, category) {
        if (!material?.uniforms) return;
        const alphaPolicy = resolveAnimeNprAlphaPolicy(source, category, {
            hairCategory: AnimeNprCategory.HAIR,
            frontHairCategory: FRONT_HAIR,
            glassCategory: GLASS,
        });
        const transparencyChanged = material.transparent !== alphaPolicy.transparent;
        material.uniforms.uCategory.value = category;
        material.uniforms.uEmissionIntensity.value = resolveAnimeNprEmission(
            source,
            category,
            AnimeNprCategory.EMISSIVE,
        );
        material.transparent = alphaPolicy.transparent;
        material.depthWrite = alphaPolicy.depthWrite;
        material.alphaToCoverage = alphaPolicy.alphaToCoverage;
        material.userData.animeNprCategory = category;
        material.userData.animeNprAlphaPolicy = { ...alphaPolicy };
        if (transparencyChanged) material.needsUpdate = true;
    }
}
