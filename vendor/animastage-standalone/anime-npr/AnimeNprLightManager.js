/*
 * Three.js replacement for StarRailRendererFeature light binding.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import * as THREE from "three";

export class AnimeNprLightManager {
    constructor(uniforms) {
        this.uniforms = uniforms;
        this._direction = new THREE.Vector3();
    }

    update({ camera, lightObj, ambientIntensity = 0.4, night = 0, shadow = 1 }) {
        if (camera && lightObj) {
            this._direction.copy(lightObj.position);
            if (lightObj.target) this._direction.sub(lightObj.target.getWorldPosition(new THREE.Vector3()));
            this._direction.normalize().transformDirection(camera.matrixWorldInverse);
            this.uniforms.uLightDirVS.value.copy(this._direction);
            // Star Rail's character shader expects a normalized main light.
            // Feeding the application's physically-authored directional-light
            // intensity linearly (often 4-12) pushed pale PMX albedo above 2.0
            // before bloom and washed out skin/hair. Keep scene response while
            // compressing it into the NPR shader's expected energy range.
            const rawIntensity = Math.max(
                0,
                Number(lightObj.intensity) || 0,
            );
            const nprIntensity = Math.min(
                1.25,
                0.55 + Math.log2(1 + rawIntensity) * 0.18,
            );
            this.uniforms.uLightColor.value
                .copy(lightObj.color)
                .multiplyScalar(nprIntensity);
        }
        const a = Math.min(
            0.42,
            0.16 + Math.max(0, Number(ambientIntensity) || 0) * 0.18,
        );
        this.uniforms.uAmbient.value.setRGB(a, a, a * 1.05);
        this.uniforms.uWarmMix.value = 1 - Math.min(1, Math.max(0, night));
        this.uniforms.uSceneShadow.value = shadow;
    }
}
