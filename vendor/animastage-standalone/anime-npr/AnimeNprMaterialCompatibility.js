/*
 * Compatibility rules between ordinary Three.js / MMDToonMaterial state and
 * the Anime NPR ShaderMaterial variant.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const finiteOpacity = (value) => {
    const opacity = Number(value);
    return Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1;
};

export function isMmdAmbientMaterial(material) {
    return material?.isMMDToonMaterial === true || material?.type === "MMDToonMaterial";
}

export function resolveAnimeNprAlphaPolicy(
    source = {},
    category,
    { hairCategory = 3, frontHairCategory = 4, glassCategory = 13 } = {},
) {
    const opacity = finiteOpacity(source.opacity);
    const hair = category === hairCategory || category === frontHairCategory;
    const glassBlend = category === glassCategory;
    // The original HSR renderer can fade a dedicated front-hair pass so eyes
    // remain readable. Generic PMX models do not author that pass convention:
    // their ordinary fringe material was therefore turned into a translucent
    // veil. Keep the feature strictly opt-in for models/materials that declare
    // it, and treat ordinary alpha-haired textures as opaque cutouts.
    const frontHairBlend =
        category === frontHairCategory &&
        source?.userData?.animeNprFrontHairTransparency === true;
    const categoryBlend = glassBlend || frontHairBlend;
    const opaqueHairCutout =
        hair && !frontHairBlend && opacity >= 0.999 && source.transparent === true;
    const transparent =
        categoryBlend ||
        opacity < 0.999 ||
        (!opaqueHairCutout && source.transparent === true);

    // MMD materials commonly keep depthWrite=true even when their texture or
    // an opacity morph requires blending. Forcing it off makes layered hair,
    // eyelashes and clothes show through one another. Only the dedicated
    // front-hair/glass NPR passes intentionally opt out of depth writes.
    const depthWrite = categoryBlend ? false : source.depthWrite !== false;
    const authoredAlphaTest = Math.max(0, Number(source.alphaTest) || 0);
    const alphaTest = opaqueHairCutout
        ? Math.max(authoredAlphaTest, 0.04)
        : authoredAlphaTest;

    return {
        opacity,
        transparent,
        depthWrite,
        alphaTest,
        alphaToCoverage: source.alphaToCoverage === true,
        opaqueHairCutout,
        frontHairBlend,
    };
}

export function resolveAnimeNprEmission(source = {}, category, emissiveCategory = 15) {
    if (category !== emissiveCategory) return 0;
    const authored = Number(source.emissiveIntensity);
    if (isMmdAmbientMaterial(source)) return Number.isFinite(authored) ? authored : 1;
    return Number.isFinite(authored) ? Math.max(0, authored) : 1;
}

/**
 * MMDLoader stores PMX/PMD ambient colour in MMDToonMaterial.emissive. It has
 * already applied its 0.2 compensation when a diffuse texture is present, so
 * Anime NPR must add the value exactly once. Treating it as glow only for an
 * "emissive" category drops authored ambient from ordinary hair and clothes
 * and turns dark-diffuse materials into featureless black silhouettes.
 */
export function resolveAnimeNprMaterialAmbient(source = {}) {
    if (!isMmdAmbientMaterial(source) || !source?.emissive?.isColor) {
        return { enabled: false, intensity: 0 };
    }
    const authored = Number(source.emissiveIntensity);
    return {
        enabled: true,
        intensity: Number.isFinite(authored) ? Math.max(0, authored) : 1,
    };
}
