/*
 * Deep material forensics for AnimeStage Anime NPR.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Console API (installed by AnimeNprController as window.__animeNprLog):
 *   report()                 aggregate health report
 *   materials()              table of every PMX material and active variant
 *   material(nameOrUuid)     full inspection of one material
 *   audit()                  current warnings grouped by material
 *   dump(n?, category?)      recent event ring buffer
 *   errors(n?)               warnings and errors only
 *   save()                   download complete JSON forensic report
 *   level("debug"|"info"|"warn"|"off")
 *   clear()
 */

import { AnimeNprCategory, AnimeNprCategoryLabel } from "./AnimeNprMaterialClassifier.js";

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, off: 99 });
const HAIR = new Set([AnimeNprCategory.HAIR, AnimeNprCategory.FRONT_HAIR]);

const finite = (value, digits = 4) => {
    const number = Number(value);
    return Number.isFinite(number) ? +number.toFixed(digits) : null;
};

const colorSnapshot = (color) => {
    if (!color?.isColor) return null;
    return {
        hex: `#${color.getHexString()}`,
        rgb: [finite(color.r), finite(color.g), finite(color.b)],
        luminance: finite(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722),
    };
};

const textureSnapshot = (texture) => {
    if (!texture?.isTexture) return null;
    const image = texture.source?.data || texture.image || null;
    const width = Number(image?.videoWidth ?? image?.naturalWidth ?? image?.width);
    const height = Number(image?.videoHeight ?? image?.naturalHeight ?? image?.height);
    const dimensionsKnown = Number.isFinite(width) || Number.isFinite(height);
    const source = String(
        image?.currentSrc ||
        image?.src ||
        texture.userData?.url ||
        "",
    );
    return {
        uuid: texture.uuid || null,
        name: texture.name || null,
        ready: !!image && (!dimensionsKnown || (width > 0 && height > 0)),
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        source: source ? source.slice(-240) : null,
        colorSpace: texture.colorSpace || null,
        flipY: texture.flipY,
        format: texture.format ?? null,
        type: texture.type ?? null,
        channel: texture.channel ?? null,
        wrapS: texture.wrapS ?? null,
        wrapT: texture.wrapT ?? null,
    };
};

const outlineSnapshot = (material) => {
    const outline = material?.userData?.outlineParameters;
    if (!outline) return null;
    return {
        thickness: finite(outline.thickness, 6),
        visible: outline.visible !== false,
        alpha: finite(outline.alpha),
        color: Array.isArray(outline.color)
            ? outline.color.slice(0, 4).map((value) => finite(value))
            : outline.color || null,
        authoredBase: finite(
            material.userData?._animeNprOutlineBase ??
            material.userData?._pmxOutlineBase,
            6,
        ),
        authoredVisible:
            material.userData?._animeNprOutlineAuthoredVisible ??
            material.userData?._pmxOutlineAuthoredVisible ??
            null,
    };
};

const uniformSnapshot = (variant) => {
    const uniforms = variant?.uniforms || {};
    const number = (name) => finite(uniforms[name]?.value);
    return {
        category: number("uCategory"),
        hasBaseMap: number("uHasBaseMap"),
        hasAlphaMap: number("uHasAlphaMap"),
        hasToonMap: number("uHasToonMap"),
        hasMatcapMap: number("uHasMatcapMap"),
        opacity: number("uOpacity"),
        alphaTest: number("uAlphaTest"),
        materialAmbientIntensity: number("uMaterialAmbientIntensity"),
        materialAmbientColor: colorSnapshot(uniforms.uMaterialAmbientColor?.value),
        emissionIntensity: number("uEmissionIntensity"),
        strength: number("uStrength"),
        saturation: number("uColorSaturation"),
        aoFallback: number("uAoFallback"),
        warmMix: number("uWarmMix"),
        debug: number("uDebug"),
    };
};

const sourceSnapshot = (source) => ({
    uuid: source?.uuid || null,
    name: source?.name || "(unnamed)",
    type: source?.type || null,
    isMMDToonMaterial: source?.isMMDToonMaterial === true,
    color: colorSnapshot(source?.color),
    emissive: colorSnapshot(source?.emissive),
    emissiveIntensity: finite(source?.emissiveIntensity),
    specular: colorSnapshot(source?.specular),
    shininess: finite(source?.shininess),
    opacity: finite(source?.opacity),
    transparent: source?.transparent === true,
    alphaTest: finite(source?.alphaTest),
    depthWrite: source?.depthWrite !== false,
    depthTest: source?.depthTest !== false,
    side: source?.side ?? null,
    blending: source?.blending ?? null,
    visible: source?.visible !== false,
    outline: outlineSnapshot(source),
    textures: {
        map: textureSnapshot(source?.map),
        alphaMap: textureSnapshot(source?.alphaMap),
        toonMap: textureSnapshot(source?.gradientMap),
        matcap: textureSnapshot(source?.matcap),
        normalMap: textureSnapshot(source?.normalMap),
        emissiveMap: textureSnapshot(source?.emissiveMap),
    },
    mmd: source?.userData?.MMD
        ? {
            mapFileName: source.userData.MMD.mapFileName || null,
            matcapFileName: source.userData.MMD.matcapFileName || null,
        }
        : null,
});

const variantSnapshot = (variant) => ({
    uuid: variant?.uuid || null,
    name: variant?.name || null,
    type: variant?.type || null,
    shaderMaterial: variant?.isShaderMaterial === true,
    transparent: variant?.transparent === true,
    opacity: finite(variant?.opacity),
    depthWrite: variant?.depthWrite !== false,
    depthTest: variant?.depthTest !== false,
    alphaToCoverage: variant?.alphaToCoverage === true,
    side: variant?.side ?? null,
    visible: variant?.visible !== false,
    alphaPolicy: variant?.userData?.animeNprAlphaPolicy || null,
    texturePolicy: variant?.userData?.animeNprTexturePolicy || null,
    outline: outlineSnapshot(variant),
    uniforms: uniformSnapshot(variant),
});

const materialIssues = (snapshot) => {
    const issues = [];
    const source = snapshot.source;
    const variant = snapshot.variant;
    const explanation = snapshot.classification;
    const category = snapshot.category;
    if (explanation.safeFallback) {
        issues.push({ code: "classification-fallback", severity: "warn", detail: explanation.reason });
    }
    if (source.textures.map && !source.textures.map.ready) {
        issues.push({ code: "base-texture-not-ready", severity: "error", detail: source.textures.map.source });
    }
    if (source.mapExpected && !source.textures.map) {
        issues.push({ code: "pmx-base-texture-missing", severity: "error", detail: source.mapExpected });
    }
    if (source.textures.map?.ready && variant.uniforms.hasBaseMap === 0) {
        issues.push({ code: "loaded-texture-not-bound", severity: "error", detail: source.textures.map.name });
    }
    if (
        category === AnimeNprCategory.GLASS &&
        (source.opacity ?? 1) >= 0.95 &&
        !source.transparent
    ) {
        issues.push({ code: "opaque-material-classified-as-glass", severity: "warn", detail: explanation.reason });
    }
    if (
        category === AnimeNprCategory.GLASS &&
        String(explanation.reason || "").startsWith("opacity:")
    ) {
        issues.push({ code: "glass-classified-from-opacity-only", severity: "warn", detail: explanation.reason });
    }
    if (
        HAIR.has(category) &&
        (source.opacity ?? 1) >= 0.999 &&
        (variant.transparent || !variant.depthWrite)
    ) {
        issues.push({ code: "opaque-hair-entered-blend-path", severity: "error", detail: variant.alphaPolicy });
    }
    if ((variant.outline?.thickness || 0) > 0.012001) {
        issues.push({ code: "outline-over-safe-limit", severity: "error", detail: variant.outline });
    }
    const baseLuma = source.color?.luminance ?? 0;
    const ambientLuma = source.emissive?.luminance ?? 0;
    if (!source.textures.map && baseLuma > 0.75 && ambientLuma > 0.45) {
        issues.push({ code: "flat-bright-material-wash-risk", severity: "warn", detail: { baseLuma, ambientLuma } });
    }
    if (ambientLuma > Math.max(0.08, baseLuma * 1.75)) {
        issues.push({ code: "ambient-dominates-diffuse", severity: "warn", detail: { baseLuma, ambientLuma } });
    }
    return issues;
};

export function animeNprMaterialSnapshot(entry) {
    const source = sourceSnapshot(entry?.source);
    source.mapExpected =
        source.mmd?.mapFileName ||
        entry?.source?.userData?.mapFileName ||
        null;
    const snapshot = {
        uuid: entry?.source?.uuid || null,
        name:
            entry?.source?.name ||
            entry?.contexts?.find((context) => context.mmdName)?.mmdName ||
            entry?.contexts?.find((context) => context.mmdEnglishName)?.mmdEnglishName ||
            "(unnamed)",
        mesh: entry?.meshName || null,
        category: entry?.category ?? AnimeNprCategory.GENERIC,
        categoryLabel:
            AnimeNprCategoryLabel[entry?.category ?? AnimeNprCategory.GENERIC] ||
            "Unknown",
        classification: {
            confidence: finite(entry?.explanation?.confidence),
            reason: entry?.explanation?.reason || "unknown",
            proposedCategory: entry?.explanation?.proposedCategory ?? null,
            proposedLabel:
                AnimeNprCategoryLabel[entry?.explanation?.proposedCategory] || null,
            safeFallback: !!entry?.explanation?.safeFallback,
            manual: !!entry?.explanation?.manual,
            input: entry?.explanation?.input || null,
            candidates: entry?.explanation?.candidates || [],
        },
        contexts: (entry?.contexts || []).map((context) => ({
            materialIndex: context.materialIndex ?? null,
            materialCount: context.materialCount ?? null,
            mmdName: context.mmdName || null,
            mmdEnglishName: context.mmdEnglishName || null,
            normalizedHeight: finite(context.normalizedHeight),
        })),
        source,
        variant: variantSnapshot(entry?.animeNpr),
    };
    snapshot.issues = materialIssues(snapshot);
    return snapshot;
}

export class AnimeNprLogger {
    constructor({ capacity = 8000, consoleLevel = "info", tag = "[AnimeNPR]" } = {}) {
        this.capacity = capacity;
        this.consoleLevel = LEVELS[consoleLevel] != null ? consoleLevel : "info";
        this.tag = tag;
        this.buffer = [];
        this.counts = new Map();
        this.seq = 0;
        this.t0 = this.now();
        this._lastSample = new Map();
        this._materialSignatures = new WeakMap();
        this._programSignatures = new WeakMap();
        this._controller = null;
    }

    now() {
        try { return performance.now(); } catch (_) { return Date.now(); }
    }

    attach(controller) { this._controller = controller; return this; }

    setLevel(level) {
        if (LEVELS[level] != null) this.consoleLevel = level;
        return this.consoleLevel;
    }

    log(level, category, message, data = null) {
        const event = {
            seq: this.seq++,
            t: finite(this.now() - this.t0, 1),
            level,
            category,
            message,
            data,
        };
        this.buffer.push(event);
        if (this.buffer.length > this.capacity) this.buffer.shift();
        this.counts.set(category, (this.counts.get(category) || 0) + 1);
        if (LEVELS[level] >= LEVELS[this.consoleLevel]) {
            const line = `${this.tag} ${category} :: ${message}`;
            try {
                if (level === "error") console.error(line, data ?? "");
                else if (level === "warn") console.warn(line, data ?? "");
                else console.info(line, data ?? "");
            } catch (_) {}
        }
        return event;
    }

    debug(category, message, data) { return this.log("debug", category, message, data); }
    info(category, message, data) { return this.log("info", category, message, data); }
    warn(category, message, data) { return this.log("warn", category, message, data); }
    error(category, message, data) { return this.log("error", category, message, data); }

    sample(level, category, message, data, key, intervalMs = 1000) {
        const now = this.now();
        const last = this._lastSample.get(key) ?? -Infinity;
        if (now - last < intervalMs) return null;
        this._lastSample.set(key, now);
        return this.log(level, category, message, data);
    }

    monitorMaterial(entry) {
        if (!entry?.source || !entry?.animeNpr) return;
        const now = this.now();
        const previous = this._materialSignatures.get(entry.source);
        if (previous && now - previous.checkedAt < 750) return;
        const snapshot = animeNprMaterialSnapshot(entry);
        const signature = JSON.stringify({
            category: snapshot.category,
            source: {
                color: snapshot.source.color?.hex,
                emissive: snapshot.source.emissive?.hex,
                opacity: snapshot.source.opacity,
                transparent: snapshot.source.transparent,
                textures: Object.fromEntries(
                    Object.entries(snapshot.source.textures).map(([key, value]) => [
                        key,
                        value ? `${value.uuid}:${value.ready}:${value.width}x${value.height}` : null,
                    ]),
                ),
            },
            variant: {
                transparent: snapshot.variant.transparent,
                depthWrite: snapshot.variant.depthWrite,
                alphaTest: snapshot.variant.uniforms.alphaTest,
                texturePolicy: snapshot.variant.texturePolicy,
                outline: snapshot.variant.outline,
            },
        });
        this._materialSignatures.set(entry.source, { signature, checkedAt: now });
        if (!previous || previous.signature !== signature) {
            this.debug("runtime", `material state changed: ${snapshot.name}`, snapshot);
            for (const issue of snapshot.issues) {
                this[issue.severity === "error" ? "error" : "warn"](
                    "audit",
                    `${snapshot.name}: ${issue.code}`,
                    issue.detail,
                );
            }
        }
    }

    monitorRenderer(renderer) {
        if (!renderer?.info?.programs) return;
        const now = this.now();
        const last = this._lastSample.get("renderer-program-scan") ?? -Infinity;
        if (now - last < 1000) return;
        this._lastSample.set("renderer-program-scan", now);
        for (const program of renderer.info.programs) {
            const diagnostics = program?.diagnostics;
            if (!diagnostics) continue;
            const data = {
                name: program.name || null,
                type: program.type || null,
                runnable: diagnostics.runnable !== false,
                programLog: diagnostics.programLog || "",
                vertexLog: diagnostics.vertexShader?.log || "",
                fragmentLog: diagnostics.fragmentShader?.log || "",
                vertexPrefix: diagnostics.runnable === false
                    ? String(diagnostics.vertexShader?.prefix || "").slice(-12000)
                    : "",
                fragmentPrefix: diagnostics.runnable === false
                    ? String(diagnostics.fragmentShader?.prefix || "").slice(-12000)
                    : "",
            };
            const signature = JSON.stringify(data);
            if (this._programSignatures.get(program) === signature) continue;
            this._programSignatures.set(program, signature);
            const hasLog = data.programLog || data.vertexLog || data.fragmentLog;
            if (!data.runnable) {
                this.error("shader", `WebGL program failed: ${data.name || "unnamed"}`, data);
            } else if (hasLog) {
                this.warn("shader", `WebGL program diagnostics: ${data.name || "unnamed"}`, data);
            } else {
                this.debug("shader", `WebGL program compiled: ${data.name || "unnamed"}`, data);
            }
        }
    }

    snapshots() {
        return [...(this._controller?.registry?.entries?.values?.() || [])].map(
            animeNprMaterialSnapshot,
        );
    }

    audit() {
        const materials = this.snapshots();
        const issues = materials.flatMap((material) =>
            material.issues.map((issue) => ({
                material: material.name,
                uuid: material.uuid,
                category: material.categoryLabel,
                ...issue,
            })),
        );
        try { console.table(issues); } catch (_) {}
        return issues;
    }

    materials() {
        const snapshots = this.snapshots();
        const rows = snapshots.map((material) => ({
            name: material.name,
            category: material.categoryLabel,
            confidence: material.classification.confidence,
            reason: material.classification.reason,
            map: material.source.textures.map?.name || material.source.mapExpected || "-",
            mapReady: material.source.textures.map?.ready ?? false,
            opacity: material.source.opacity,
            srcBlend: material.source.transparent,
            nprBlend: material.variant.transparent,
            depthWrite: material.variant.depthWrite,
            alphaTest: material.variant.uniforms.alphaTest,
            ambient: material.source.emissive?.hex || "-",
            outline: material.variant.outline?.thickness ?? 0,
            issues: material.issues.map((issue) => issue.code).join(", "),
        }));
        try { console.table(rows); } catch (_) {}
        return rows;
    }

    material(nameOrUuid) {
        const query = String(nameOrUuid || "").toLocaleLowerCase();
        const matches = this.snapshots().filter((material) =>
            !query ||
            material.uuid === nameOrUuid ||
            material.name.toLocaleLowerCase().includes(query),
        );
        try {
            if (matches.length === 1) console.info(`${this.tag} material`, matches[0]);
            else console.info(`${this.tag} material matches`, matches);
        } catch (_) {}
        return matches.length === 1 ? matches[0] : matches;
    }

    state() {
        const controller = this._controller;
        const uniforms = controller?.uniforms || {};
        const rendererInfo = controller?.renderer?.info;
        return {
            enabled: !!controller?.state?.enabled,
            preset: controller?.state?.preset || null,
            selfShadows: !!controller?.state?.selfShadows,
            hairDepth: controller?.state?.hairDepth !== false,
            registeredMeshes: controller?.registry?.meshes?.size || 0,
            registeredMaterials: controller?.registry?.entries?.size || 0,
            outline: {
                enabled: !!controller?.outlinePipeline?.enabled,
                width: finite(controller?.outlinePipeline?.width),
            },
            renderer: rendererInfo
                ? {
                    programs: rendererInfo.programs?.length || 0,
                    calls: rendererInfo.render?.calls || 0,
                    triangles: rendererInfo.render?.triangles || 0,
                    lines: rendererInfo.render?.lines || 0,
                    points: rendererInfo.render?.points || 0,
                    geometries: rendererInfo.memory?.geometries || 0,
                    textures: rendererInfo.memory?.textures || 0,
                }
                : null,
            uniforms: {
                strength: finite(uniforms.uNprStrength?.value),
                ao: finite(uniforms.uNprAO?.value),
                warmMix: finite(uniforms.uNprRampWarmMix?.value),
                specular: finite(uniforms.uNprSpecInt?.value),
                saturation: finite(uniforms.uColorSaturation?.value),
                ambient: colorSnapshot(uniforms.uAmbient?.value),
                shadowColor: colorSnapshot(uniforms.uNprShadowColor?.value),
                debug: finite(uniforms.uDebug?.value),
            },
        };
    }

    report() {
        const materials = this.snapshots();
        const issues = materials.flatMap((material) => material.issues);
        const byCategory = {};
        for (const material of materials) {
            byCategory[material.categoryLabel] = (byCategory[material.categoryLabel] || 0) + 1;
        }
        const output = {
            build: "AnimeNPR-18-material-forensics",
            events: this.seq,
            buffered: this.buffer.length,
            byEventCategory: Object.fromEntries(this.counts),
            state: this.state(),
            materials: materials.length,
            byCategory,
            issueCount: issues.length,
            errorCount: issues.filter((issue) => issue.severity === "error").length,
            warningCount: issues.filter((issue) => issue.severity === "warn").length,
            issuesByCode: Object.fromEntries(
                [...new Set(issues.map((issue) => issue.code))].map((code) => [
                    code,
                    issues.filter((issue) => issue.code === code).length,
                ]),
            ),
            recentWarnings: this.buffer
                .filter((event) => event.level === "warn" || event.level === "error")
                .slice(-20),
        };
        try {
            console.info(`${this.tag} ===== MATERIAL HEALTH REPORT =====`, output);
            this.materials();
            if (issues.length) this.audit();
        } catch (_) {}
        return output;
    }

    dump(count = 80, category = null) {
        const rows = this.buffer
            .filter((event) => !category || event.category === category)
            .slice(-Math.max(1, Number(count) || 80));
        try { console.table(rows); } catch (_) {}
        return rows;
    }

    errors(count = 80) {
        const rows = this.buffer
            .filter((event) => event.level === "warn" || event.level === "error")
            .slice(-Math.max(1, Number(count) || 80));
        try { console.table(rows); } catch (_) {}
        return rows;
    }

    save(filename = null) {
        const payload = {
            exportedAt: new Date().toISOString(),
            report: this.report(),
            state: this.state(),
            materials: this.snapshots(),
            events: this.buffer,
        };
        try {
            const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
            });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename || `anime-npr-log-${Date.now()}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 5000);
        } catch (_) {}
        return payload;
    }

    clear() {
        this.buffer.length = 0;
        this.counts.clear();
        this._lastSample.clear();
        this._materialSignatures = new WeakMap();
        this._programSignatures = new WeakMap();
    }
}
