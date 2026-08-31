/*
 * WebGL port of the StarRail per-object self-shadow atlas.
 * Derived from Runtime/PerObjectShadow/* and PerObjectShadow.hlsl.
 * StarRailNPRShader Copyright (C) 2023 Stalo <stalowork@163.com>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";

const BIAS_MATRIX = new THREE.Matrix4().set(
    0.5, 0, 0, 0.5,
    0, 0.5, 0, 0.5,
    0, 0, 0.5, 0.5,
    0, 0, 0, 1,
);

export class AnimeNprShadowManager {
    constructor(uniforms, registry = null, scene = null) {
        this.uniforms = uniforms;
        this.registry = registry;
        this.scene = scene;
        this.enabled = true;
        this.maxCasters = 16;
        // 4x4 atlas: 256 px per caster at 1024. This matches the source
        // priority/capacity model while avoiding a 2048-depth clear and large
        // skinned redraw every viewport frame.
        this.atlasSize = 1024;
        this._lightDirection = new THREE.Vector3(0.3, 0.8, 0.4).normalize();
        this._box = new THREE.Box3();
        this._center = new THREE.Vector3();
        this._size = new THREE.Vector3();
        this._tileMatrix = new THREE.Matrix4();
        this._viewProjection = new THREE.Matrix4();
        this._shadowMatrix = new THREE.Matrix4();
        this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
        this._depthMaterial = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            side: THREE.DoubleSide,
        });
        this._depthMaterial.colorWrite = true;
        this._clearColor = new THREE.Color();
        this._warnedRenderFailure = false;

        this.target = new THREE.WebGLRenderTarget(this.atlasSize, this.atlasSize, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: true,
            stencilBuffer: false,
        });
        // Packed color depth avoids a separately sized DepthTexture attachment
        // and remains valid through viewport/DPR changes.
        this.target.texture.name = "AnimeNprSelfShadowAtlasPacked";
        this.target.texture.generateMipmaps = false;
        this.target.texture.colorSpace = THREE.NoColorSpace;
        this.uniforms.uSelfShadowMap.value = this.target.texture;
        this.uniforms.uSelfShadowTexelSize.value.set(
            1 / this.atlasSize,
            1 / this.atlasSize,
        );
    }

    setSceneAttenuation(value) {
        this.uniforms.uSceneShadow.value = Math.max(
            0,
            Math.min(1, Number(value) || 0),
        );
    }

    configureMesh(mesh) {
        if (!mesh?.isMesh) return;
        mesh.castShadow = mesh.castShadow !== false;
        mesh.receiveShadow = mesh.receiveShadow !== false;
    }

    updateLight(lightObj) {
        if (!lightObj) return;
        this._lightDirection.copy(lightObj.position);
        if (lightObj.target) {
            lightObj.target.updateWorldMatrix?.(true, false);
            this._lightDirection.sub(
                lightObj.target.getWorldPosition(new THREE.Vector3()),
            );
        }
        if (this._lightDirection.lengthSq() > 1e-8)
            this._lightDirection.normalize();
    }

    _characterRoots() {
        const roots = new Map();
        for (const mesh of this.registry?.meshes || []) {
            if (!mesh?.parent) continue;
            let root = mesh;
            while (root.parent && root.parent !== this.scene) root = root.parent;
            if (!roots.has(root)) roots.set(root, []);
            roots.get(root).push(mesh);
        }
        const cameraPosition = this._camera.position;
        return [...roots.entries()]
            .map(([root, meshes]) => {
                this._box.setFromObject(root, true);
                const center = this._box.getCenter(new THREE.Vector3());
                return {
                    root,
                    meshes,
                    center,
                    distance: center.distanceToSquared(cameraPosition),
                };
            })
            .filter((entry) => Number.isFinite(entry.center.x))
            .slice(0, this.maxCasters);
    }

    _fitCamera(root) {
        this._box.setFromObject(root, true);
        this._box.getCenter(this._center);
        this._box.getSize(this._size);
        const radius = Math.max(0.1, this._size.length() * 0.55);
        this._camera.position
            .copy(this._center)
            .addScaledVector(this._lightDirection, radius * 2.5);
        this._camera.up.set(0, 1, 0);
        if (Math.abs(this._lightDirection.y) > 0.97)
            this._camera.up.set(0, 0, 1);
        this._camera.lookAt(this._center);
        this._camera.left = -radius;
        this._camera.right = radius;
        this._camera.top = radius;
        this._camera.bottom = -radius;
        this._camera.near = 0.01;
        this._camera.far = radius * 6;
        this._camera.updateProjectionMatrix();
        this._camera.updateMatrixWorld(true);
    }

    _matrixForTile(tileX, tileY) {
        const scale = 0.25;
        this._tileMatrix.set(
            scale, 0, 0, tileX * scale,
            0, scale, 0, tileY * scale,
            0, 0, 1, 0,
            0, 0, 0, 1,
        );
        this._viewProjection
            .multiplyMatrices(this._camera.projectionMatrix, this._camera.matrixWorldInverse);
        this._shadowMatrix
            .multiplyMatrices(this._tileMatrix, BIAS_MATRIX)
            .multiply(this._viewProjection);
        return this._shadowMatrix;
    }

    _assignShadow(meshes, matrix, tileX, tileY) {
        const rect = new THREE.Vector4(
            tileX * 0.25,
            tileY * 0.25,
            (tileX + 1) * 0.25,
            (tileY + 1) * 0.25,
        );
        for (const mesh of meshes) {
            const materials = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
            for (const material of materials) {
                const uniforms = material?.uniforms;
                if (!uniforms?.uSelfShadowMatrix) continue;
                uniforms.uSelfShadowMatrix.value.copy(matrix);
                uniforms.uSelfShadowRect.value.copy(rect);
            }
        }
    }

    render(renderer) {
        if (!this.enabled || !this.registry?.enabled || !this.scene) {
            this.uniforms.uHasSelfShadowMap.value = 0;
            return;
        }
        const casters = this._characterRoots();
        if (!casters.length) {
            this.uniforms.uHasSelfShadowMap.value = 0;
            return;
        }

        const meshVisibility = [];
        this.scene.traverse((object) => {
            if (!object?.isMesh) return;
            meshVisibility.push([object, object.visible]);
            object.visible = false;
        });
        const previousTarget = renderer.getRenderTarget();
        const previousOverride = this.scene.overrideMaterial;
        const previousAutoClear = renderer.autoClear;
        const previousScissorTest = renderer.getScissorTest();
        const previousClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this._clearColor);
        const viewport = renderer.getViewport(new THREE.Vector4());
        const scissor = renderer.getScissor(new THREE.Vector4());
        const tileSize = this.atlasSize / 4;

        this.uniforms.uHasSelfShadowMap.value = 0;
        try {
            renderer.autoClear = false;
            renderer.setRenderTarget(this.target);
            renderer.setScissorTest(false);
            renderer.setClearColor(0xffffff, 1);
            renderer.clear(true, true, false);
            renderer.setScissorTest(true);
            this.scene.overrideMaterial = this._depthMaterial;

            for (let i = 0; i < casters.length; i++) {
                const { root, meshes } = casters[i];
                for (const mesh of meshes) mesh.visible = true;
                this._fitCamera(root);
                const tileX = i % 4;
                const tileY = 3 - Math.floor(i / 4);
                const x = tileX * tileSize;
                const y = tileY * tileSize;
                renderer.setViewport(x, y, tileSize, tileSize);
                renderer.setScissor(x, y, tileSize, tileSize);
                renderer.clear(false, true, false);
                renderer.render(this.scene, this._camera);
                this._assignShadow(
                    meshes,
                    this._matrixForTile(tileX, tileY),
                    tileX,
                    tileY,
                );
                for (const mesh of meshes) mesh.visible = false;
            }
            this.uniforms.uSelfShadowMap.value = this.target.texture;
            this.uniforms.uHasSelfShadowMap.value = 1;
            this._warnedRenderFailure = false;
        } catch (error) {
            this.uniforms.uHasSelfShadowMap.value = 0;
            if (!this._warnedRenderFailure) {
                console.warn(
                    "[AnimeNPR] self-shadow prepass disabled after render failure:",
                    error,
                );
                this._warnedRenderFailure = true;
            }
        } finally {
            for (const [mesh, visible] of meshVisibility) mesh.visible = visible;
            this.scene.overrideMaterial = previousOverride;
            renderer.autoClear = previousAutoClear;
            renderer.setScissorTest(previousScissorTest);
            renderer.setViewport(viewport);
            renderer.setScissor(scissor);
            renderer.setClearColor(this._clearColor, previousClearAlpha);
            renderer.setRenderTarget(previousTarget);
        }
    }

    dispose() {
        this.target.dispose();
        this._depthMaterial.dispose();
    }
}

export class AnimeNprShadowPass extends Pass {
    constructor(manager) {
        super();
        this.manager = manager;
        this.needsSwap = false;
        this.enabled = true;
        // Self shadows are cached and refreshed at 15 Hz on a 60 Hz viewport.
        // Camera rendering and character shading continue every frame.
        this.frameInterval = 4;
        this._frame = 0;
    }

    render(renderer) {
        this._frame++;
        if (
            this.manager?.uniforms?.uHasSelfShadowMap?.value > 0.5 &&
            this._frame % this.frameInterval !== 0
        )
            return;
        this.manager?.render(renderer);
    }

    dispose() {
        this.manager?.dispose();
    }
}
