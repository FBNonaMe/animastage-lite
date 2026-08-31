/*
 * AnimeStage adaptation of StarRailNPRShader material presets.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const PRESETS = Object.freeze({
    starrail: Object.freeze({
        label: "Star Rail NPR",
        strength: 1,
        warmMix: 0.35,
        shadowSoftness: 0.02,
        specularIntensity: 0.5,
        shininess: 20,
        specularRoughness: 0.08,
        rimIntensity: 0.5,
        rimSoftness: 3,
        outlineWidth: 1,
        bloomIntensity: 0.55,
        colorSaturation: 1.08,
    }),
    soft: Object.freeze({
        label: "Soft Character",
        strength: 1,
        warmMix: 0.5,
        shadowSoftness: 0.05,
        specularIntensity: 0.32,
        shininess: 14,
        specularRoughness: 0.14,
        rimIntensity: 0.32,
        rimSoftness: 4,
        outlineWidth: 0.8,
        bloomIntensity: 0.35,
        colorSaturation: 1.02,
    }),
    dramatic: Object.freeze({
        label: "Dramatic NPR",
        strength: 1,
        warmMix: 0.18,
        shadowSoftness: 0.012,
        specularIntensity: 0.72,
        shininess: 40,
        specularRoughness: 0.04,
        rimIntensity: 0.82,
        rimSoftness: 2,
        outlineWidth: 1.15,
        bloomIntensity: 0.72,
        colorSaturation: 1.16,
    }),
});

export class AnimeNprPresetRegistry {
    names() { return Object.keys(PRESETS); }
    get(name) { return PRESETS[name] ? { ...PRESETS[name] } : null; }
    has(name) { return !!PRESETS[name]; }
}
