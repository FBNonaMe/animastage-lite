/*
 * Material variant registry and real scene swapper.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const DRAW_DISPATCHER_PROPERTY = "_animeStageDrawDispatcher";
const NPR_DRAW_HANDLER = Symbol.for("AnimeStage.AnimeNprDraw");

const ensureDrawDispatcher = (mesh) => {
    if (!mesh.userData) mesh.userData = {};
    let state = mesh.userData[DRAW_DISPATCHER_PROPERTY];
    if (state && state.dispatcher === mesh.onBeforeRender) return state;
    const previous = mesh.onBeforeRender;
    const handlers = state?.handlers || new Map();
    const dispatcher = function (...args) {
        if (typeof previous === "function") previous.apply(this, args);
        for (const handler of handlers.values()) handler.apply(this, args);
    };
    state = { dispatcher, previous, handlers };
    Object.defineProperty(mesh.userData, DRAW_DISPATCHER_PROPERTY, {
        value: state,
        configurable: true,
    });
    mesh.onBeforeRender = dispatcher;
    return state;
};

const removeDrawHandler = (mesh, key) => {
    const state = mesh?.userData?.[DRAW_DISPATCHER_PROPERTY];
    if (!state) return;
    state.handlers.delete(key);
    if (!state.handlers.size && mesh.onBeforeRender === state.dispatcher) {
        mesh.onBeforeRender = state.previous;
        delete mesh.userData[DRAW_DISPATCHER_PROPERTY];
    }
};

export class AnimeNprMaterialRegistry {
    constructor({ classifier, factory, logger = null }) {
        this.classifier = classifier;
        this.factory = factory;
        this.logger = logger;
        this.enabled = false;
        this.entries = new Map();
        this.meshes = new Set();
        this.overrides = new Map();
        this._geometryProfiles = new WeakMap();
        this._meshDrawHooks = new WeakMap();
    }

    _installMeshDrawHook(mesh) {
        if (!mesh?.isMesh) return;
        const state = ensureDrawDispatcher(mesh);
        let handler = this._meshDrawHooks.get(mesh);
        if (handler && state.handlers.get(NPR_DRAW_HANDLER) === handler) return;
        const registry = this;
        handler = function (
            renderer,
            scene,
            camera,
            geometry,
            material,
            group,
        ) {
            registry.factory.prepareMaterialForDraw?.(
                material,
                this,
                camera,
                renderer,
            );
        };
        this._meshDrawHooks.set(mesh, handler);
        state.handlers.set(NPR_DRAW_HANDLER, handler);
    }

    _source(material) {
        if (!material) return null;
        // Shader Studio and Anime NPR can both own the live material slot.
        // Always walk back to the canonical MMD source so a mode switch cannot
        // accidentally create NPR variants from a temporary PBR/MMD2 variant.
        let source = material;
        const visited = new Set();
        for (let depth = 0; source && depth < 6 && !visited.has(source); depth++) {
            visited.add(source);
            const next =
                source.userData?.animeNprSource ||
                source._shaderStudioSource ||
                null;
            if (!next || next === source) break;
            source = next;
        }
        return source;
    }

    _geometryProfile(geometry) {
        if (!geometry) return null;
        const cached = this._geometryProfiles.get(geometry);
        if (cached) return cached;
        const position = geometry.attributes?.position;
        if (!position?.count) return null;
        if (!geometry.boundingBox) geometry.computeBoundingBox?.();
        let minY = Number(geometry.boundingBox?.min?.y);
        let maxY = Number(geometry.boundingBox?.max?.y);
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            minY = Infinity;
            maxY = -Infinity;
            for (let index = 0; index < position.count; index++) {
                const y = position.getY(index);
                if (!Number.isFinite(y)) continue;
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
        const groupHeights = new Map();
        const indexArray = geometry.index?.array || null;
        for (const group of geometry.groups || []) {
            const start = Math.max(0, Math.floor(Number(group.start) || 0));
            const available = Math.max(0, (indexArray?.length || position.count) - start);
            const requested = Number.isFinite(Number(group.count))
                ? Math.max(0, Math.floor(Number(group.count)))
                : available;
            const count = Math.min(requested, available);
            const stride = Math.max(1, Math.ceil(count / 4096));
            let groupMin = Infinity;
            let groupMax = -Infinity;
            for (let offset = 0; offset < count; offset += stride) {
                const vertexIndex = indexArray ? indexArray[start + offset] : start + offset;
                if (vertexIndex == null || vertexIndex >= position.count) continue;
                const y = position.getY(vertexIndex);
                if (!Number.isFinite(y)) continue;
                groupMin = Math.min(groupMin, y);
                groupMax = Math.max(groupMax, y);
            }
            if (Number.isFinite(groupMin) && Number.isFinite(groupMax)) {
                const materialIndex = Number(group.materialIndex) || 0;
                const previous = groupHeights.get(materialIndex);
                groupHeights.set(materialIndex, {
                    min: Math.min(previous?.min ?? Infinity, groupMin),
                    max: Math.max(previous?.max ?? -Infinity, groupMax),
                });
            }
        }
        const profile = { minY, maxY, groupHeights };
        this._geometryProfiles.set(geometry, profile);
        return profile;
    }

    _classificationContext(mesh, materialIndex, materialCount) {
        const geometry = mesh?.geometry;
        const metadata = geometry?.userData?.MMD?.materials?.[materialIndex] || null;
        const profile = this._geometryProfile(geometry);
        const groupHeight = profile?.groupHeights?.get(materialIndex);
        const heightRange = (profile?.maxY || 0) - (profile?.minY || 0);
        const normalizedHeight =
            groupHeight && heightRange > 1e-6
                ? ((groupHeight.min + groupHeight.max) * 0.5 - profile.minY) / heightRange
                : null;
        return {
            materialIndex,
            materialCount,
            mmdName: metadata?.name || "",
            mmdEnglishName: metadata?.englishName || "",
            normalizedHeight,
            allowMeshNameHints: !metadata && materialCount <= 2,
        };
    }

    _applyCategory(entry, category, explanation) {
        const previous = entry.category;
        entry.category = category;
        entry.explanation = explanation;
        this.factory.applyCategory(entry.animeNpr, entry.source, category);
        if (previous !== category) {
            this.logger?.info("classification", `category changed: ${entry.source.name || "(unnamed)"}`, {
                uuid: entry.source.uuid,
                previous,
                category,
                confidence: explanation?.confidence ?? 0,
                reason: explanation?.reason || "unknown",
                candidates: explanation?.candidates || [],
            });
        }
    }

    _entry(source, meshName = "", context = {}) {
        if (!source) return null;
        let entry = this.entries.get(source.uuid);
        const override = this.overrides.get(source.uuid);
        const explanation = this.classifier.explain(source, meshName, override, context);
        if (entry) {
            entry.contexts.push(context);
            if (
                !Number.isInteger(override) &&
                explanation.category !== entry.category &&
                (
                    entry.explanation?.safeFallback ||
                    explanation.confidence > (entry.explanation?.confidence || 0) + 0.08
                )
            ) {
                this._applyCategory(entry, explanation.category, explanation);
            }
            return entry;
        }
        const category = explanation.category;
        const animeNpr = this.factory.create(source, category);
        animeNpr.userData.animeNprSource = source;
        const variants = source.userData.materialVariants || {};
        variants.raster = source;
        variants.animeNpr = animeNpr;
        variants.pathTracerProxy = variants.pathTracerProxy || source;
        source.userData.materialVariants = variants;
        entry = {
            source,
            animeNpr,
            category,
            meshName,
            explanation,
            contexts: [context],
        };
        // Non-enumerable runtime backlink gives the hot-path logger the full
        // live classification/context without polluting serialized userData or
        // creating a JSON cycle in diagnostic exports.
        Object.defineProperty(animeNpr.userData, "_animeNprLogEntry", {
            value: entry,
            configurable: true,
        });
        this.entries.set(source.uuid, entry);
        const eventData = {
            uuid: source.uuid,
            name: source.name || context.mmdName || context.mmdEnglishName || "(unnamed)",
            mesh: meshName || null,
            category,
            confidence: explanation.confidence,
            reason: explanation.reason,
            candidates: explanation.candidates,
            safeFallback: explanation.safeFallback,
            context,
        };
        if (explanation.safeFallback) {
            // Generic is the intentional safe rendering path, not a runtime
            // failure. Keep the condition visible in report()/audit()/save(),
            // but do not flood DevTools with warnings for unknown PMX names.
            this.logger?.info("classification", `safe fallback: ${eventData.name}`, eventData);
        } else {
            this.logger?.info("classification", `classified ${eventData.name}`, eventData);
        }
        return entry;
    }

    registerScene(root) {
        let created = 0;
        root?.traverse?.((mesh) => {
            if (!mesh?.isMesh || !mesh.material || mesh.userData?.animeNprOutlineClone) return;
            const current = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            // The NPR character pass must not replace floors, maps, weather,
            // camera helpers or other ordinary Raster scene materials.
            const characterMaterial =
                mesh.isSkinnedMesh ||
                mesh.userData?.animeNprCharacter === true ||
                current.some((material) => material?.isMMDToonMaterial);
            if (!characterMaterial) return;
            this._installMeshDrawHook(mesh);
            const sources = current.map((material) => this._source(material));
            if (sources.some((source) => !source)) return;
            const previousRestore = mesh.userData.animeNprRestoreMaterials;
            const restoreMaterials = current.map((material, materialIndex) =>
                material?.userData?.animeNprSource
                    ? previousRestore?.[materialIndex] || sources[materialIndex]
                    : material,
            );
            const variants = sources.map((source, materialIndex) => {
                const before = this.entries.size;
                const context = this._classificationContext(
                    mesh,
                    materialIndex,
                    sources.length,
                );
                const entry = this._entry(source, mesh.name, context);
                if (this.entries.size > before) created++;
                return entry?.animeNpr || source;
            });
            mesh.userData.animeNprOriginalMaterials = sources;
            // Preserve the exact live raster choice (Original, Figure PBR or
            // MMD 2.0) separately from the canonical PMX source used to build
            // NPR. Leaving Anime NPR must return to the user's selected mode.
            mesh.userData.animeNprRestoreMaterials = restoreMaterials;
            this.meshes.add(mesh);
            if (this.enabled) mesh.material = Array.isArray(mesh.material) ? variants : variants[0];
        });
        return created;
    }

    unregisterScene(root) {
        let removed = 0;
        root?.traverse?.((mesh) => {
            if (!mesh?.isMesh || !this.meshes.has(mesh)) return;
            removeDrawHandler(mesh, NPR_DRAW_HANDLER);
            this._meshDrawHooks.delete(mesh);
            this.meshes.delete(mesh);
            const restore = mesh.userData?.animeNprRestoreMaterials;
            if (restore?.length) {
                mesh.material =
                    Array.isArray(mesh.material) || restore.length > 1
                        ? restore
                        : restore[0];
            }
            removed++;
        });
        return removed;
    }

    setEnabled(on) {
        this.enabled = !!on;
        for (const mesh of this.meshes) {
            if (!mesh?.parent && !mesh?.isScene) continue;
            const sources = mesh.userData.animeNprOriginalMaterials;
            if (!sources?.length) continue;
            const next = this.enabled
                ? sources.map((source) => this._entry(source, mesh.name)?.animeNpr || source)
                : mesh.userData.animeNprRestoreMaterials || sources;
            mesh.material = Array.isArray(mesh.material) || next.length > 1 ? next : next[0];
        }
        this.logger?.info("ownership", `material slots switched to ${this.enabled ? "Anime NPR" : "raster restore"}`, {
            meshes: this.meshes.size,
            materials: this.entries.size,
        });
    }

    setCategory(sourceOrVariant, category) {
        const source = this._source(sourceOrVariant);
        if (!source) return;
        this.overrides.set(source.uuid, category);
        const entry = this._entry(source);
        const explanation = this.classifier.explain(
            source,
            entry.meshName,
            category,
            entry.contexts[0] || {},
        );
        this._applyCategory(entry, category, explanation);
    }

    clearCategory(sourceOrVariant) {
        const source = this._source(sourceOrVariant);
        const entry = source ? this.entries.get(source.uuid) : null;
        if (!source || !entry) return;
        this.overrides.delete(source.uuid);
        const explanations = entry.contexts.map((context) =>
            this.classifier.explain(source, entry.meshName, undefined, context),
        );
        explanations.sort((a, b) => b.confidence - a.confidence);
        const explanation = explanations[0] || this.classifier.explain(source, entry.meshName);
        this._applyCategory(entry, explanation.category, explanation);
    }

    reclassify({ clearOverrides = false } = {}) {
        if (clearOverrides) this.overrides.clear();
        for (const entry of this.entries.values()) {
            const override = this.overrides.get(entry.source.uuid);
            const explanations = entry.contexts.map((context) =>
                this.classifier.explain(
                    entry.source,
                    entry.meshName,
                    override,
                    context,
                ),
            );
            explanations.sort((a, b) => b.confidence - a.confidence);
            const explanation =
                explanations[0] ||
                this.classifier.explain(entry.source, entry.meshName, override);
            this._applyCategory(entry, explanation.category, explanation);
        }
        const result = this.list();
        this.logger?.info("classification", "full material reclassification complete", {
            clearOverrides,
            materials: result.length,
            safeFallbacks: result.filter((item) => item.safeFallback).length,
        });
        return result;
    }

    list() {
        return [...this.entries.values()].map((entry) => ({
            uuid: entry.source.uuid,
            name:
                entry.source.name ||
                entry.contexts.find((context) => context.mmdName)?.mmdName ||
                entry.contexts.find((context) => context.mmdEnglishName)?.mmdEnglishName ||
                "(unnamed)",
            category: entry.category,
            confidence: entry.explanation?.confidence ?? 0,
            classificationReason: entry.explanation?.reason || "unknown",
            proposedCategory: entry.explanation?.proposedCategory ?? entry.category,
            safeFallback: !!entry.explanation?.safeFallback,
            manual: !!entry.explanation?.manual,
            mat: entry.source,
            variants: entry.source.userData.materialVariants,
        }));
    }

    dispose() {
        for (const mesh of this.meshes) {
            removeDrawHandler(mesh, NPR_DRAW_HANDLER);
        }
        for (const entry of this.entries.values()) entry.animeNpr.dispose();
        this.entries.clear();
        this.meshes.clear();
        this._geometryProfiles = new WeakMap();
        this._meshDrawHooks = new WeakMap();
    }
}
