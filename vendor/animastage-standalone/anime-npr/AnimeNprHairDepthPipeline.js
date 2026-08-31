/*
 * WebGL port of HairDepthOnlyPass.cs and CharHairDepthTexture.hlsl.
 * StarRailNPRShader Copyright (C) 2023 Stalo <stalowork@163.com>.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as THREE from "three";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { AnimeNprCategory } from "./AnimeNprMaterialClassifier.js";

const HAIR = new Set([
    AnimeNprCategory.HAIR,
    AnimeNprCategory.FRONT_HAIR,
]);

export class AnimeNprHairDepthPipeline {
    constructor({ scene, registry, uniforms, downscale = 2 }) {
        this.scene = scene;
        this.registry = registry;
        this.uniforms = uniforms;
        this.downscale = Math.max(1, downscale | 0);
        this.enabled = true;
        this._width = 1;
        this._height = 1;
        this._savedMeshes = [];
        this._depthMaterials = new Map();
        this._hiddenMaterial = new THREE.MeshDepthMaterial();
        this._hiddenMaterial.visible = false;
        this._clearColor = new THREE.Color();
        this._warnedRenderFailure = false;

        this.target = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: true,
            stencilBuffer: false,
        });
        // Store sampled depth in the RGBA color attachment. A separately
        // attached DepthTexture can retain the old DPR size for one frame
        // while the composer is resizing, which makes Chromium reject the
        // entire framebuffer as incomplete.
        this.target.texture.name = "AnimeNprHairDepthPacked";
        this.target.texture.generateMipmaps = false;
        this.target.texture.colorSpace = THREE.NoColorSpace;
        this.uniforms.uHairDepthTexture.value = this.target.texture;
    }

    setSize(width, height) {
        const w = Math.max(1, Math.floor(width / this.downscale));
        const h = Math.max(1, Math.floor(height / this.downscale));
        if (w === this._width && h === this._height) return;
        this._width = w;
        this._height = h;
        this.target.setSize(w, h);
    }

    _depthMaterial(source) {
        const key = source?.uuid || "fallback";
        let material = this._depthMaterials.get(key);
        if (material) return material;
        material = new THREE.MeshDepthMaterial({
            depthPacking: THREE.RGBADepthPacking,
            map: source?.map || null,
            alphaMap: source?.alphaMap || null,
            alphaTest: Math.max(0, source?.alphaTest || 0),
            side: source?.side ?? THREE.FrontSide,
        });
        material.name = `${source?.name || "Hair"} · NPR hair depth`;
        material.colorWrite = true;
        this._depthMaterials.set(key, material);
        return material;
    }

    _replaceForHair(mesh) {
        const sources = mesh.userData?.animeNprOriginalMaterials;
        if (!sources?.length) return false;
        const depthMaterials = sources.map((source) => {
            const entry = this.registry.entries.get(source?.uuid);
            return HAIR.has(entry?.category)
                ? this._depthMaterial(source)
                : this._hiddenMaterial;
        });
        if (!depthMaterials.some((material) => material !== this._hiddenMaterial))
            return false;
        this._savedMeshes.push({
            mesh,
            material: mesh.material,
            visible: mesh.visible,
        });
        mesh.visible = true;
        mesh.material =
            Array.isArray(mesh.material) || depthMaterials.length > 1
                ? depthMaterials
                : depthMaterials[0];
        return true;
    }

    render(renderer, camera) {
        if (!this.enabled || !this.registry.enabled || !camera) {
            this.uniforms.uHasHairDepth.value = 0;
            return;
        }
        this.setSize(renderer.domElement.width, renderer.domElement.height);
        this._savedMeshes.length = 0;
        const allMeshes = [];
        this.scene.traverse((object) => {
            if (!object?.isMesh) return;
            allMeshes.push({ mesh: object, visible: object.visible });
            object.visible = false;
        });

        let hairCount = 0;
        for (const mesh of this.registry.meshes) {
            if (this._replaceForHair(mesh)) hairCount++;
        }
        if (!hairCount) {
            for (const saved of allMeshes) saved.mesh.visible = saved.visible;
            this.uniforms.uHasHairDepth.value = 0;
            return;
        }

        const previousTarget = renderer.getRenderTarget();
        const previousAutoClear = renderer.autoClear;
        const previousOverride = this.scene.overrideMaterial;
        const previousClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this._clearColor);
        this.uniforms.uHasHairDepth.value = 0;
        try {
            renderer.autoClear = true;
            this.scene.overrideMaterial = null;
            renderer.setRenderTarget(this.target);
            renderer.setClearColor(0xffffff, 1);
            renderer.clear(true, true, false);
            renderer.render(this.scene, camera);
            this.uniforms.uHairDepthTexture.value = this.target.texture;
            this.uniforms.uHasHairDepth.value = 1;
            this.uniforms.uNprResolution.value.set(
                renderer.domElement.width,
                renderer.domElement.height,
            );
            this.uniforms.uCameraNearFar.value.set(camera.near, camera.far);
            this._warnedRenderFailure = false;
        } catch (error) {
            this.uniforms.uHasHairDepth.value = 0;
            if (!this._warnedRenderFailure) {
                console.warn(
                    "[AnimeNPR] hair-depth prepass disabled after render failure:",
                    error,
                );
                this._warnedRenderFailure = true;
            }
        } finally {
            for (const saved of this._savedMeshes) {
                saved.mesh.material = saved.material;
                saved.mesh.visible = saved.visible;
            }
            for (const saved of allMeshes) saved.mesh.visible = saved.visible;
            this.scene.overrideMaterial = previousOverride;
            renderer.autoClear = previousAutoClear;
            renderer.setClearColor(this._clearColor, previousClearAlpha);
            renderer.setRenderTarget(previousTarget);
        }
    }

    dispose() {
        this.target.dispose();
        this._hiddenMaterial.dispose();
        for (const material of this._depthMaterials.values()) material.dispose();
        this._depthMaterials.clear();
    }
}

export class AnimeNprHairDepthPass extends Pass {
    constructor(pipeline, camera) {
        super();
        this.pipeline = pipeline;
        this.camera = camera;
        this.needsSwap = false;
        this.enabled = true;
        // Hair depth is temporally stable enough for half-rate refresh. The
        // texture remains bound on skipped frames; this halves the extra
        // skinned draw cost without affecting the primary character pass.
        this.frameInterval = 2;
        this._frame = 0;
    }

    setSize(width, height) {
        this.pipeline?.setSize(width, height);
    }

    render(renderer) {
        this._frame++;
        if (
            this.pipeline?.uniforms?.uHasHairDepth?.value > 0.5 &&
            this._frame % this.frameInterval !== 0
        )
            return;
        this.pipeline?.render(renderer, this.camera);
    }

    dispose() {
        this.pipeline?.dispose();
    }
}
