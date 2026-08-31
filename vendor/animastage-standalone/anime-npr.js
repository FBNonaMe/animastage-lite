/*
 * AnimeStage Star Rail NPR Engine entry point.
 *
 * Modified source port of StarRailNPRShader:
 * https://github.com/stalomeow/StarRailNPRShader
 * Copyright (C) 2023 Stalo <stalowork@163.com>
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Unlike Legacy Anime, this mode swaps every registered character material to
 * a dedicated ShaderMaterial variant. It does not patch or reuse the Raster
 * lighting equation.
 */

export {
    AnimeNprController,
    NCAT,
} from "./anime-npr/AnimeNprController.js?v=n20";
export {
    AnimeNprCategory,
    AnimeNprMaterialClassifier,
    classifyNprMaterial,
} from "./anime-npr/AnimeNprMaterialClassifier.js?v=n20";

import { AnimeNprController } from "./anime-npr/AnimeNprController.js?v=n20";

export function createAnimeNprSystem(options) {
    return new AnimeNprController(options);
}
