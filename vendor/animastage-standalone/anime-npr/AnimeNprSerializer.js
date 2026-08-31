/*
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export class AnimeNprSerializer {
    serialize(controller) {
        const U = controller.uniforms;
        const values = {};
        for (const [key, uniform] of Object.entries(U)) {
            // Diagnostics are deliberately session-only. Persisting uDebug
            // made the next launch look like a broken renderer (for example,
            // the Material ID mask replaced the actual character).
            if (key === "uDebug") continue;
            const value = uniform.value;
            if (typeof value === "number") values[key] = value;
            else if (value?.isColor) values[key] = `#${value.getHexString()}`;
        }
        return {
            version: 2,
            engine: "AnimeStageStarRailNpr",
            enabled: controller.state.enabled,
            preset: controller.state.preset,
            selfShadows: !!controller.state.selfShadows,
            hairDepth: controller.state.hairDepth !== false,
            uniforms: values,
            categories: Object.fromEntries(controller.registry.overrides),
        };
    }

    deserialize(controller, data) {
        if (!data || ![1, 2].includes(data.version)) return false;
        const values = data.uniforms || data.u || {};
        for (const [key, value] of Object.entries(values)) {
            const uniform = controller.uniforms[key];
            if (!uniform || value == null) continue;
            if (typeof uniform.value === "number" && typeof value === "number") uniform.value = value;
            else if (uniform.value?.isColor && typeof value === "string") uniform.value.set(value);
        }
        for (const [uuid, category] of Object.entries(data.categories || {})) {
            controller.registry.overrides.set(uuid, category);
        }
        // v1/v2 saves created before the contrast-preserving palette control
        // have no value for it. Migrate from the selected preset instead of
        // silently falling back to a washed-out neutral value.
        if (values.uColorSaturation == null) {
            const preset = controller.presetRegistry.get(data.preset || "starrail");
            controller.shared.uColorSaturation.value =
                preset?.colorSaturation ?? 1.06;
        }
        controller.shared.uDebug.value = 0;
        controller.state.selfShadows = !!data.selfShadows;
        controller.state.hairDepth = data.hairDepth !== false;
        controller.state.preset = data.preset || "starrail";
        controller.setEnabled(!!data.enabled);
        return true;
    }
}
