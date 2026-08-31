/*
 * Outline policy port for the HSR inverted-hull outline passes. Three.js'
 * OutlineEffect performs the hull draw; this class owns NPR classification,
 * authored PMX edge data, category scaling and state.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AnimeNprCategory } from "./AnimeNprMaterialClassifier.js";

const CATEGORY_SCALE = Object.freeze({
    [AnimeNprCategory.FACE]: 0.55,
    [AnimeNprCategory.EYES]: 0,
    [AnimeNprCategory.EYE_HIGHLIGHT]: 0,
    [AnimeNprCategory.EYEBROWS]: 0.45,
    [AnimeNprCategory.EYELASHES]: 0.7,
    [AnimeNprCategory.MOUTH]: 0.45,
    [AnimeNprCategory.HAIR]: 1,
    // Inverted hulls on alpha hair cards expand across the whole fringe and
    // can cover it with a black polygon when Outline W is raised. The regular
    // opaque hair shell still receives an outline; dedicated fringe/glass
    // cards rely on their authored texture edge instead.
    [AnimeNprCategory.FRONT_HAIR]: 0,
    [AnimeNprCategory.GLASS]: 0,
    [AnimeNprCategory.EMISSIVE]: 0.65,
});

export class AnimeNprOutlinePipeline {
    constructor(registry) {
        this.registry = registry;
        this.logger = registry?.logger || null;
        this.enabled = true;
        this.width = 1;
    }

    configure({ enabled = this.enabled, width = this.width } = {}) {
        this.enabled = !!enabled;
        this.width = Math.max(0, Number(width) || 0);
        this.apply();
    }

    apply() {
        for (const entry of this.registry.entries.values()) {
            const source = entry.source;
            const variant = entry.animeNpr;
            const authoredRaw =
                source.userData?._animeNprOutlineBase ??
                source.userData?.outlineParameters?.thickness ??
                0.003;
            const authored = Math.min(0.006, Math.max(0, Number(authoredRaw) || 0));
            if ((Number(authoredRaw) || 0) > 0.006) {
                this.logger?.sample(
                    "warn",
                    "outline",
                    `outline base clamped: ${source.name || "(unnamed)"}`,
                    { authored: Number(authoredRaw), clamped: authored },
                    `outline-clamp:${source.uuid}`,
                    5000,
                );
            }
            source.userData._animeNprOutlineBase = authored;
            if (source.userData._animeNprOutlineAuthoredVisible === undefined) {
                const authoredVisible =
                    source.userData?.outlineParameters?.visible;
                source.userData._animeNprOutlineAuthoredVisible =
                    typeof authoredVisible === "boolean"
                        ? authoredVisible
                        : authored > 0;
            }
            const scale = CATEGORY_SCALE[entry.category] ?? 1;
            const visible =
                source.userData._animeNprOutlineAuthoredVisible &&
                this.enabled &&
                this.width > 0.005 &&
                scale > 0;
            const current = source.userData?.outlineParameters || {};
            const outline = {
                ...current,
                thickness: Math.min(0.012, authored * this.width * scale),
                visible,
                alpha: current.alpha ?? 1,
                color: current.color ?? [0.05, 0.035, 0.08],
            };
            source.userData.outlineParameters = outline;
            variant.userData.outlineParameters = { ...outline };
            const signature = `${visible}:${outline.thickness.toFixed(6)}:${scale}`;
            if (variant.userData._animeNprLoggedOutline !== signature) {
                variant.userData._animeNprLoggedOutline = signature;
                this.logger?.debug("outline", `outline policy: ${source.name || "(unnamed)"}`, {
                    category: entry.category,
                    authored,
                    width: this.width,
                    scale,
                    visible,
                    thickness: outline.thickness,
                });
            }
        }
    }
}
