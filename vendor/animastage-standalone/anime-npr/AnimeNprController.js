/*
 * AnimeStage Star Rail NPR Engine controller.
 * Runtime rewrite of StarRailCharacterRenderingController.cs and
 * StarRailRendererFeature.cs, Copyright (C) 2023 Stalo.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { AnimeNprMaterialClassifier, AnimeNprCategory } from "./AnimeNprMaterialClassifier.js";
import { AnimeNprMaterialFactory, createAnimeNprUniforms } from "./AnimeNprMaterialFactory.js";
import { AnimeNprMaterialRegistry } from "./AnimeNprMaterialRegistry.js";
import { AnimeNprCharacterScopeRegistry } from "./AnimeNprCharacterScope.js";
import { AnimeNprPresetRegistry } from "./AnimeNprPresetRegistry.js";
import { AnimeNprLightManager } from "./AnimeNprLightManager.js";
import {
    AnimeNprShadowManager,
    AnimeNprShadowPass,
} from "./AnimeNprShadowManager.js";
import {
    AnimeNprHairDepthPipeline,
    AnimeNprHairDepthPass,
} from "./AnimeNprHairDepthPipeline.js";
import { AnimeNprOutlinePipeline } from "./AnimeNprOutlinePipeline.js";
import { AnimeNprSerializer } from "./AnimeNprSerializer.js";
import { AnimeNprDiagnostics } from "./AnimeNprDiagnostics.js";
import { AnimeNprLogger } from "./AnimeNprLogger.js";

export class AnimeNprController {
    constructor({ scene, renderer = null }) {
        this.scene = scene;
        this.renderer = renderer;
        this.shared = createAnimeNprUniforms();
        this.logger = new AnimeNprLogger({ tag: "[AnimeNPR]" });
        this.classifier = new AnimeNprMaterialClassifier();
        this.factory = new AnimeNprMaterialFactory(this.shared, this.logger);
        this.characterScopes = new AnimeNprCharacterScopeRegistry(this.shared);
        this.factory.setDrawScopeResolver((object, camera, _material, _source, renderer) =>
            this.characterScopes.resolveForDraw(
                object,
                camera,
                renderer?.info?.render?.frame,
            ),
        );
        this.registry = new AnimeNprMaterialRegistry({
            classifier: this.classifier,
            factory: this.factory,
            logger: this.logger,
        });
        this.lightManager = new AnimeNprLightManager(this.shared);
        this.shadowManager = new AnimeNprShadowManager(
            this.shared,
            this.registry,
            scene,
        );
        this.hairDepthPipeline = new AnimeNprHairDepthPipeline({
            scene,
            registry: this.registry,
            uniforms: this.shared,
        });
        this.outlinePipeline = new AnimeNprOutlinePipeline(this.registry);
        this.presetRegistry = new AnimeNprPresetRegistry();
        this.serializer = new AnimeNprSerializer();
        this.diagnostics = new AnimeNprDiagnostics(this.registry);
        this.logger.attach(this);
        this.state = {
            enabled: false,
            preset: "starrail",
            version: 2,
            // Directional scene shadows remain active. The extra per-object
            // atlas is opt-in because it redraws every skinned character.
            selfShadows: false,
            hairDepth: true,
        };
        this._headRotation = new THREE.Matrix4();
        this._headForward = new THREE.Vector3();
        this._headRight = new THREE.Vector3();
        this._headUp = new THREE.Vector3();

        // Compatibility aliases consumed by the existing inspector. They point
        // at the SAME uniform objects used by the independent ShaderMaterials.
        this.uniforms = {
            ...this.shared,
            uNprStrength: this.shared.uStrength,
            uNprFaceThresh: this.shared.uFaceThreshold,
            uNprAO: this.shared.uAoFallback,
            uNprRampWarmMix: this.shared.uWarmMix,
            uNprSpecInt: this.shared.uSpecularIntensity,
            uNprShininess: this.shared.uSpecularShininess,
            uNprRimInt: this.shared.uRimIntensity,
            uNprShadowColor: this.shared.uShadowColor,
            uNprEyeShadowColor: this.shared.uEyeShadowColor,
            uNprRimColor: this.shared.uRimColor,
        };
        this.installLogConsole();
    }

    installLogConsole() {
        try {
            const logger = this.logger;
            globalThis.__animeNprLog = {
                report: () => logger.report(),
                materials: () => logger.materials(),
                material: (nameOrUuid) => logger.material(nameOrUuid),
                audit: () => logger.audit(),
                dump: (count, category) => logger.dump(count, category),
                errors: (count) => logger.errors(count),
                save: (filename) => logger.save(filename),
                level: (level) => logger.setLevel(level),
                clear: () => logger.clear(),
                state: () => logger.state(),
            };
            logger.info(
                "lifecycle",
                "material forensics active (build NPR-18) :: __animeNprLog.report() / .materials() / .material(name) / .audit() / .dump() / .errors() / .save() / .level('debug')",
            );
        } catch (_) {}
    }

    registerScene(root = this.scene) {
        if (this.characterScopes.getScope(root))
            this.characterScopes.refreshModel(root);
        const created = this.registry.registerScene(root);
        root?.traverse?.((mesh) => this.shadowManager.configureMesh(mesh));
        this.outlinePipeline.apply();
        if (created > 0) {
            this.logger.info("scene", `registered ${created} new NPR material(s)`, {
                meshes: this.registry.meshes.size,
                materials: this.registry.entries.size,
            });
        }
        return created;
    }

    // Explicit character registration is the multi-model path. registerScene
    // remains available for old single-character integrations and for scene
    // props, while registered models receive independent head/map uniforms.
    registerModel(root, options = {}) {
        const scope = this.characterScopes.registerModel(root, options);
        if (!scope) return 0;
        return this.registerScene(root);
    }

    refreshModel(root) {
        if (!this.characterScopes.refreshModel(root)) return 0;
        return this.refreshMaterials(root);
    }

    unregisterModel(root) {
        const unregistered = this.characterScopes.unregisterModel(root);
        const removed = this.registry.unregisterScene(root);
        return unregistered || removed > 0;
    }

    refreshMaterials(root = this.scene) {
        const created = this.registerScene(root);
        // Shader Studio may just have put its own raster variants in the live
        // slots. Reassert NPR immediately instead of waiting for the periodic
        // scene scan (which caused visible black/incorrect material frames).
        if (this.state.enabled) this.registry.setEnabled(true);
        return created;
    }

    setEnabled(on) {
        this.state.enabled = !!on;
        if (on) {
            this.shared.uDebug.value = 0;
            this.registerScene(this.scene);
        }
        this.registry.setEnabled(on);
        this.shadowManager.enabled = !!on && this.state.selfShadows;
        this.hairDepthPipeline.enabled = !!on && this.state.hairDepth;
        if (!on) {
            this.shared.uHasHairDepth.value = 0;
            this.shared.uHasSelfShadowMap.value = 0;
        }
        this.logger.info("lifecycle", `Anime NPR ${on ? "ENABLED" : "DISABLED"}`, this.logger.state());
    }

    applyPreset(name) {
        const preset = this.presetRegistry.get(name);
        if (!preset) return false;
        this.shared.uStrength.value = preset.strength;
        this.shared.uWarmMix.value = preset.warmMix;
        this.shared.uFaceSoftness.value = preset.shadowSoftness;
        this.shared.uSpecularIntensity.value = preset.specularIntensity;
        this.shared.uSpecularShininess.value = preset.shininess;
        this.shared.uSpecularRoughness.value = preset.specularRoughness;
        this.shared.uRimIntensity.value = preset.rimIntensity;
        this.shared.uRimSoftness.value = preset.rimSoftness;
        this.shared.uBloomIntensity.value = preset.bloomIntensity ?? 0.45;
        this.shared.uColorSaturation.value = preset.colorSaturation ?? 1.06;
        this.outlinePipeline.configure({ width: preset.outlineWidth ?? 1 });
        this.state.preset = name;
        this.logger.info("preset", `preset applied: ${name}`, preset);
        return true;
    }

    get presets() { return this.presetRegistry.names(); }
    get NCAT() { return AnimeNprCategory; }
    listMaterials() { return this.registry.list(); }
    setCategory(material, category) {
        this.registry.setCategory(material, category);
        this.outlinePipeline.apply();
    }
    clearCategory(material) {
        this.registry.clearCategory(material);
        this.outlinePipeline.apply();
    }
    reclassifyMaterials(options) {
        const result = this.registry.reclassify(options);
        this.outlinePipeline.apply();
        return result;
    }
    setDebug(value) { this.shared.uDebug.value = Number(value) || 0; }

    _assignDataTexture(uniformName, flagName, texture, colorSpace) {
        if (texture) {
            texture.colorSpace = colorSpace;
            texture.flipY = false;
            texture.needsUpdate = true;
        }
        if (texture) this.shared[uniformName].value = texture;
        this.shared[flagName].value = texture ? 1 : 0;
    }

    setLightMap(texture) {
        this._assignDataTexture("uLightMap", "uHasLightMap", texture, THREE.NoColorSpace);
    }
    setFaceMap(texture) {
        this._assignDataTexture("uFaceMap", "uHasFaceMap", texture, THREE.NoColorSpace);
    }
    setExpressionMap(texture) {
        this._assignDataTexture("uExpressionMap", "uHasExpressionMap", texture, THREE.NoColorSpace);
    }
    setStockingsMap(texture) {
        this._assignDataTexture("uStockingsMap", "uHasStockingsMap", texture, THREE.NoColorSpace);
    }

    setMapsForModel(modelOrMesh, maps) {
        return this.characterScopes.setMaps(modelOrMesh, maps);
    }
    setMapsForMesh(mesh, maps) {
        return this.setMapsForModel(mesh, maps);
    }
    setLightMapForModel(modelOrMesh, texture) {
        return this.setMapsForModel(modelOrMesh, { lightMap: texture });
    }
    setFaceMapForModel(modelOrMesh, texture) {
        return this.setMapsForModel(modelOrMesh, { faceMap: texture });
    }
    setExpressionMapForModel(modelOrMesh, texture) {
        return this.setMapsForModel(modelOrMesh, { expressionMap: texture });
    }
    setStockingsMapForModel(modelOrMesh, texture) {
        return this.setMapsForModel(modelOrMesh, { stockingsMap: texture });
    }
    setRamps(cool, warm) {
        if (cool) {
            cool.colorSpace = THREE.SRGBColorSpace;
            cool.flipY = false;
            cool.needsUpdate = true;
            this.shared.uRampCool.value = cool;
        }
        if (warm || cool) {
            const texture = warm || cool;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            texture.needsUpdate = true;
            this.shared.uRampWarm.value = texture;
        }
        this.shared.uHasRamp.value = cool || warm ? 1 : 0;
    }
    setRampsForModel(modelOrMesh, cool, warm) {
        return this.setMapsForModel(modelOrMesh, {
            rampCool: cool,
            rampWarm: warm,
        });
    }
    setSingleMaterial(on) {
        // The original uses this to force ramp V=0.05. Hair already selects
        // single-material mode; retain the value for serialized compatibility.
        this.state.singleMaterial = !!on;
    }

    updateHeadBone(headBone, camera) {
        if (!headBone || !camera) return;
        const scope = this.characterScopes.getScope(headBone);
        if (scope) {
            this.characterScopes.updateHead(scope.model, headBone, camera);
            return;
        }
        headBone.updateWorldMatrix(true, false);
        this._headRotation.extractRotation(headBone.matrixWorld);
        this._headForward.set(0, 0, 1).applyMatrix4(this._headRotation).normalize().transformDirection(camera.matrixWorldInverse);
        this._headRight.set(1, 0, 0).applyMatrix4(this._headRotation).normalize().transformDirection(camera.matrixWorldInverse);
        this._headUp.set(0, 1, 0).applyMatrix4(this._headRotation).normalize().transformDirection(camera.matrixWorldInverse);
        this.shared.uHeadForwardVS.value.copy(this._headForward);
        this.shared.uHeadRightVS.value.copy(this._headRight);
        this.shared.uHeadUpVS.value.copy(this._headUp);
    }

    setHeadBoneForModel(modelOrMesh, headBone) {
        return this.characterScopes.setHeadBone(modelOrMesh, headBone);
    }

    updateHeadBoneForModel(modelOrMesh, headBone, camera) {
        return this.characterScopes.updateHead(modelOrMesh, headBone, camera);
    }

    updateHeadBoneForMesh(mesh, headBone, camera) {
        return this.updateHeadBoneForModel(mesh, headBone, camera);
    }

    updateLight(options) {
        this.lightManager.update(options);
        this.shadowManager.updateLight(options?.lightObj);
        this.shared.uWetness.value = Math.max(0, Number(options?.wetness) || 0);
        this.shared.uSnow.value = Math.max(0, Number(options?.snow) || 0);
        this.logger.sample(
            "debug",
            "light",
            "runtime light state",
            {
                light: options?.lightObj?.name || options?.lightObj?.type || null,
                intensity: Number(options?.lightObj?.intensity) || 0,
                ambientIntensity: Number(options?.ambientIntensity) || 0,
                wetness: this.shared.uWetness.value,
                snow: this.shared.uSnow.value,
                sceneShadow: this.shared.uSceneShadow.value,
            },
            "runtime-light",
            2000,
        );
        this.logger.monitorRenderer(this.renderer);
    }

    createPrepasses(camera) {
        return {
            shadow: new AnimeNprShadowPass(this.shadowManager),
            hairDepth: new AnimeNprHairDepthPass(
                this.hairDepthPipeline,
                camera,
            ),
        };
    }

    configureOutline(options) {
        this.outlinePipeline.configure(options);
    }

    setSelfShadows(on) {
        this.state.selfShadows = !!on;
        this.shadowManager.enabled = this.state.enabled && this.state.selfShadows;
        if (!this.shadowManager.enabled)
            this.shared.uHasSelfShadowMap.value = 0;
    }

    setHairDepth(on) {
        this.state.hairDepth = !!on;
        this.hairDepthPipeline.enabled = this.state.enabled && this.state.hairDepth;
        if (!this.hairDepthPipeline.enabled)
            this.shared.uHasHairDepth.value = 0;
    }

    updateDepthRim() {
        // The new engine does not borrow the Raster SSAO target. Three.js
        // shadow maps feed the NPR shader directly; screen-space rim is a
        // separate AnimeNprOutlinePipeline stage.
    }

    serialize() { return this.serializer.serialize(this); }
    deserialize(data) { return this.serializer.deserialize(this, data); }
    getDiagnostics() { return this.diagnostics.snapshot(); }
    dispose() {
        this.hairDepthPipeline.dispose();
        this.shadowManager.dispose();
        this.registry.dispose();
        this.characterScopes.dispose();
    }
}

export const NCAT = AnimeNprCategory;
