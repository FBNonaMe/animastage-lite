/**
 * Anime material shading — kind-aware MeshStandard patches (skin wrap, hair aniso, eye sparkle).
 */
import * as THREE from 'three';
import type { AsrpMaterialKind } from '../types';
import { classifyAsrpMaterial } from '../materialKinds';
import type { AsrpMaterialShadingMode } from './types';

const PATCHED = 'asrpV2MaterialShading';

function injectAfter(shader: { fragmentShader: string }, token: string, chunk: string): void {
  if (!shader.fragmentShader.includes(token)) return;
  if (shader.fragmentShader.includes('asrpShadeStrength')) return;
  shader.fragmentShader = shader.fragmentShader.replace(token, `${token}\n${chunk}`);
}

export function patchAnimeMaterialShading(
  material: THREE.MeshStandardMaterial,
  kind: AsrpMaterialKind,
  opts: {
    mode: AsrpMaterialShadingMode;
    strength: number;
  }
): void {
  if (material.userData[PATCHED] === `${kind}:${opts.mode}:${opts.strength.toFixed(2)}`) {
    return;
  }
  material.userData[PATCHED] = `${kind}:${opts.mode}:${opts.strength.toFixed(2)}`;
  material.userData.asrpMaterialKind = kind;

  const strength = Math.max(0, Math.min(1, opts.strength));
  const mode = opts.mode;

  if (kind === 'metal') {
    material.metalness = Math.max(material.metalness, 0.85);
    material.roughness = Math.min(material.roughness, 0.35);
  } else if (kind === 'glass') {
    material.transparent = true;
    material.opacity = Math.min(material.opacity, 0.55);
    material.roughness = Math.min(material.roughness, 0.12);
    material.metalness = Math.min(material.metalness, 0.05);
    material.envMapIntensity = Math.max(material.envMapIntensity, 1.4);
  } else if (kind === 'water') {
    material.roughness = Math.min(material.roughness, 0.18);
    material.metalness = Math.min(material.metalness, 0.1);
    material.envMapIntensity = Math.max(material.envMapIntensity, 1.2);
  } else if (kind === 'skin') {
    material.roughness = THREE.MathUtils.clamp(material.roughness * 0.85 + 0.25, 0.35, 0.75);
    material.metalness = Math.min(material.metalness, 0.05);
  } else if (kind === 'eye') {
    material.roughness = Math.min(material.roughness, 0.22);
    material.metalness = Math.min(material.metalness, 0.08);
    material.envMapIntensity = Math.max(material.envMapIntensity, 1.35);
  } else if (kind === 'hair') {
    material.roughness = THREE.MathUtils.clamp(material.roughness, 0.28, 0.65);
    material.metalness = Math.min(material.metalness, 0.15);
  }

  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer);
    shader.uniforms.asrpShadeStrength = { value: strength };
    shader.uniforms.asrpShadeMode = {
      value: mode === 'classic_toon' ? 0 : mode === 'pbr_detail' ? 2 : 1,
    };
    shader.uniforms.asrpKind = {
      value:
        kind === 'skin'
          ? 1
          : kind === 'hair'
            ? 2
            : kind === 'eye'
              ? 3
              : kind === 'cloth' || kind === 'fabric'
                ? 4
                : 0,
    };

    if (!shader.fragmentShader.includes('uniform float asrpShadeStrength')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float asrpShadeStrength;
uniform float asrpShadeMode;
uniform float asrpKind;`
      );
    }

    injectAfter(
      shader,
      '#include <output_fragment>',
      `
{
  float s = clamp(asrpShadeStrength, 0.0, 1.0);
  if (s > 0.001) {
    vec3 col = gl_FragColor.rgb;
    if (asrpShadeMode < 1.5) {
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      float steps = asrpShadeMode < 0.5 ? 4.0 : 6.0;
      float q = floor(luma * steps + 0.5) / steps;
      col = mix(col, col * (q / max(luma, 0.001)), s * (asrpShadeMode < 0.5 ? 0.55 : 0.28));
    }
    if (asrpKind > 0.5 && asrpKind < 1.5) {
      vec3 wrap = col * vec3(1.05, 0.92, 0.88);
      col = mix(col, wrap, 0.35 * s);
      col += vec3(0.04, 0.015, 0.01) * s;
    }
    if (asrpKind > 1.5 && asrpKind < 2.5) {
      float spec = pow(max(col.r, max(col.g, col.b)), 4.0);
      col += vec3(spec * 0.22 * s);
    }
    if (asrpKind > 2.5 && asrpKind < 3.5) {
      float spark = pow(max(col.r, max(col.g, col.b)), 8.0);
      col += vec3(spark * 0.45 * s);
      col = mix(col, col * vec3(1.05, 1.08, 1.12), 0.2 * s);
    }
    if (asrpKind > 3.5) {
      col = mix(col, col * 1.04, 0.15 * s);
    }
    gl_FragColor.rgb = col;
  }
}
`
    );
  };
  material.needsUpdate = true;
}

export function applyAsrpMaterialShadingToObject(
  root: THREE.Object3D,
  opts: {
    mode: AsrpMaterialShadingMode;
    strength: number;
  }
): number {
  let count = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const kind = classifyAsrpMaterial(mat.name || '', mesh.name || '');
      patchAnimeMaterialShading(mat, kind, opts);
      count += 1;
    }
  });
  return count;
}
