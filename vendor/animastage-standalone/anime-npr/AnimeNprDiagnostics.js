/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export class AnimeNprDiagnostics {
    constructor(registry) { this.registry = registry; this.compileErrors = []; }
    snapshot() {
        const list = this.registry.list();
        const byCategory = {};
        for (const item of list) byCategory[item.category] = (byCategory[item.category] || 0) + 1;
        return {
            engine: "AnimeStage Star Rail NPR Engine",
            independentShaderMaterials: list.filter((x) => x.variants?.animeNpr?.isShaderMaterial).length,
            materials: list.length,
            byCategory,
            safeFallbacks: list.filter((item) => item.safeFallback).length,
            manualOverrides: list.filter((item) => item.manual).length,
            lowConfidence: list
                .filter((item) => !item.manual && item.confidence < 0.7)
                .map((item) => ({
                    name: item.name,
                    confidence: item.confidence,
                    reason: item.classificationReason,
                })),
            compileErrors: [...this.compileErrors],
        };
    }
}
