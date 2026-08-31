/*
 * Per-character draw state for Anime NPR.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { createAnimeNprCharacterUniforms } from "./AnimeNprMaterialFactory.js";

const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object || {}, key);

export class AnimeNprCharacterScopeRegistry {
    constructor(defaultUniforms) {
        this.defaultUniforms = defaultUniforms;
        this._modelScopes = new WeakMap();
        this._meshScopes = new WeakMap();
        this._roots = new Set();
        this._rotation = new THREE.Matrix4();
        this._forward = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3();
    }

    _createScope(model) {
        return {
            model,
            headBone: null,
            uniforms: createAnimeNprCharacterUniforms(this.defaultUniforms),
            revision: 0,
            lastDrawFrame: null,
            lastDrawCamera: null,
        };
    }

    registerModel(model, { headBone = null, maps = null } = {}) {
        if (!model || (typeof model !== "object" && typeof model !== "function"))
            return null;
        let scope = this._modelScopes.get(model);
        if (!scope) {
            scope = this._createScope(model);
            this._modelScopes.set(model, scope);
            this._roots.add(model);
        }
        if (headBone) {
            scope.headBone = headBone;
            scope.lastDrawFrame = null;
            scope.lastDrawCamera = null;
        }
        model.traverse?.((object) => {
            if (object?.isMesh) this._meshScopes.set(object, scope);
        });
        if (model.isMesh) this._meshScopes.set(model, scope);
        if (maps) this.setMaps(model, maps);
        scope.revision++;
        return scope;
    }

    refreshModel(model) {
        const scope = this._modelScopes.get(model);
        if (!scope) return this.registerModel(model);
        model.traverse?.((object) => {
            if (object?.isMesh) this._meshScopes.set(object, scope);
        });
        if (model.isMesh) this._meshScopes.set(model, scope);
        scope.revision++;
        return scope;
    }

    unregisterModel(model) {
        const scope = this._modelScopes.get(model);
        if (!scope) return false;
        model.traverse?.((object) => {
            if (object?.isMesh && this._meshScopes.get(object) === scope)
                this._meshScopes.delete(object);
        });
        if (model.isMesh && this._meshScopes.get(model) === scope)
            this._meshScopes.delete(model);
        this._modelScopes.delete(model);
        this._roots.delete(model);
        return true;
    }

    findScope(object) {
        if (!object) return null;
        const direct = this._meshScopes.get(object) || this._modelScopes.get(object);
        if (direct) return direct;
        let cursor = object.parent;
        while (cursor) {
            const scope = this._modelScopes.get(cursor);
            if (scope) {
                if (object.isMesh) this._meshScopes.set(object, scope);
                return scope;
            }
            cursor = cursor.parent;
        }
        return null;
    }

    getScope(modelOrMesh) {
        return this.findScope(modelOrMesh);
    }

    setHeadBone(modelOrMesh, headBone) {
        const scope = this.findScope(modelOrMesh);
        if (!scope) return false;
        scope.headBone = headBone || null;
        scope.lastDrawFrame = null;
        scope.lastDrawCamera = null;
        scope.revision++;
        return true;
    }

    _assignTexture(scope, uniformName, flagName, texture, colorSpace) {
        const uniforms = scope?.uniforms;
        if (!uniforms?.[uniformName] || !uniforms?.[flagName]) return;
        if (texture) {
            texture.colorSpace = colorSpace;
            texture.flipY = false;
            texture.needsUpdate = true;
            uniforms[uniformName].value = texture;
        }
        uniforms[flagName].value = texture ? 1 : 0;
    }

    setMaps(modelOrMesh, maps = {}) {
        const scope = this.findScope(modelOrMesh);
        if (!scope) return false;
        if (hasOwn(maps, "lightMap"))
            this._assignTexture(
                scope,
                "uLightMap",
                "uHasLightMap",
                maps.lightMap,
                THREE.NoColorSpace,
            );
        if (hasOwn(maps, "faceMap"))
            this._assignTexture(
                scope,
                "uFaceMap",
                "uHasFaceMap",
                maps.faceMap,
                THREE.NoColorSpace,
            );
        if (hasOwn(maps, "expressionMap"))
            this._assignTexture(
                scope,
                "uExpressionMap",
                "uHasExpressionMap",
                maps.expressionMap,
                THREE.NoColorSpace,
            );
        if (hasOwn(maps, "stockingsMap"))
            this._assignTexture(
                scope,
                "uStockingsMap",
                "uHasStockingsMap",
                maps.stockingsMap,
                THREE.NoColorSpace,
            );
        if (hasOwn(maps, "rampCool") || hasOwn(maps, "rampWarm")) {
            const cool = maps.rampCool;
            const warm = maps.rampWarm;
            for (const texture of [cool, warm]) {
                if (!texture) continue;
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false;
                texture.needsUpdate = true;
            }
            if (hasOwn(maps, "rampCool") && cool)
                scope.uniforms.uRampCool.value = cool;
            if (hasOwn(maps, "rampWarm")) {
                const texture = warm || cool;
                if (texture) scope.uniforms.uRampWarm.value = texture;
            }
            scope.uniforms.uHasRamp.value = cool || warm ? 1 : 0;
        }
        scope.revision++;
        return true;
    }

    updateHead(modelOrMesh, headBone, camera) {
        const scope = this.findScope(modelOrMesh);
        if (!scope || !camera) return false;
        if (headBone) scope.headBone = headBone;
        const bone = scope.headBone;
        if (!bone?.matrixWorld) return false;
        bone.updateWorldMatrix?.(true, false);
        this._rotation.extractRotation(bone.matrixWorld);
        this._forward
            .set(0, 0, 1)
            .applyMatrix4(this._rotation)
            .normalize()
            .transformDirection(camera.matrixWorldInverse);
        this._right
            .set(1, 0, 0)
            .applyMatrix4(this._rotation)
            .normalize()
            .transformDirection(camera.matrixWorldInverse);
        this._up
            .set(0, 1, 0)
            .applyMatrix4(this._rotation)
            .normalize()
            .transformDirection(camera.matrixWorldInverse);
        scope.uniforms.uHeadForwardVS.value.copy(this._forward);
        scope.uniforms.uHeadRightVS.value.copy(this._right);
        scope.uniforms.uHeadUpVS.value.copy(this._up);
        scope.revision++;
        return true;
    }

    resolveForDraw(object, camera, frameToken = null) {
        const scope = this.findScope(object);
        if (!scope) return null;
        if (scope.headBone && camera) {
            const canReuse =
                frameToken != null &&
                scope.lastDrawFrame === frameToken &&
                scope.lastDrawCamera === camera;
            if (!canReuse) {
                this.updateHead(object, scope.headBone, camera);
                scope.lastDrawFrame = frameToken;
                scope.lastDrawCamera = camera;
            }
        }
        return scope;
    }

    dispose() {
        this._roots.clear();
        this._modelScopes = new WeakMap();
        this._meshScopes = new WeakMap();
    }
}
