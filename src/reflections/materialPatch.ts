/**
 * Patches MeshStandard / MeshPhysical materials with Improved Box Projected Reflections.
 * Built-in engine feature — not an optional downloadable shader.
 * Targets Three.js CubeUV IBL (PMREM) path used by MeshStandardMaterial.
 */
import * as THREE from 'three';
import { BOX_PROJECT_FN, BOX_REFLECTION_UNIFORMS } from './glsl';

export type ReflectiveMaterialKind =
  | 'floor'
  | 'glass'
  | 'metal'
  | 'plastic'
  | 'water'
  | 'wet'
  | 'mirror'
  | 'prop'
  | 'hair'
  | 'eye'
  | 'cloth'
  | 'skin'
  | 'accessory'
  | 'default';

export interface BoxReflectionUniformBag {
  boxMin: THREE.Vector3;
  boxMax: THREE.Vector3;
  probePos: THREE.Vector3;
  intensity: number;
  roughnessInfluence: number;
  contactHardening: number;
  enabled: number;
}

const PATCH_FLAG = 'asBoxProjectedReflections';

const KIND_INTENSITY: Record<ReflectiveMaterialKind, number> = {
  floor: 1.15,
  mirror: 1.4,
  glass: 1.25,
  metal: 1.2,
  water: 1.3,
  wet: 1.15,
  plastic: 0.85,
  prop: 0.9,
  hair: 0.55,
  eye: 0.75,
  cloth: 0.4,
  skin: 0.28,
  accessory: 0.95,
  default: 0.65,
};

/** Replaces Three.js envmap_physical_pars_fragment with box-projected IBL. */
const PATCHED_ENVMAP_PHYSICAL = /* glsl */ `
varying vec3 bpWorldPos;

#ifdef USE_ENVMAP

${BOX_REFLECTION_UNIFORMS}
${BOX_PROJECT_FN}

	vec3 getIBLIrradiance( const in vec3 normal ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );

			return PI * envMapColor.rgb * envMapIntensity * mix( 1.0, bpIntensity, bpEnabled );

		#else

			return vec3( 0.0 );

		#endif

	}

	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 reflectVec = reflect( - viewDir, normal );

			// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
			float perceptualRoughness = roughness;
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );

			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );

			if ( bpEnabled > 0.5 ) {
				vec3 worldPos = bpWorldPos;
				vec4 bp = boxProjectCubemapDirection( worldPos, reflectVec );
				reflectVec = bp.xyz;
				float chMip = boxContactHardeningMip(
					bp.w,
					perceptualRoughness,
					inverseTransformDirection( normal, viewMatrix ),
					normalize( cameraPosition - worldPos )
				);
				float sampleRough = mix( perceptualRoughness, clamp( chMip / 8.0, 0.0, 1.0 ), bpContactHardening * 0.65 );
				sampleRough = mix( perceptualRoughness, sampleRough, bpRoughnessInfluence );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, sampleRough );
				return envMapColor.rgb * envMapIntensity * bpIntensity;
			}

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );

			return envMapColor.rgb * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	#ifdef USE_ANISOTROPY

		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

			#ifdef ENVMAP_TYPE_CUBE_UV

				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

				return getIBLRadiance( viewDir, bentNormal, roughness );

			#else

				return vec3( 0.0 );

			#endif

		}

	#endif

#endif
`;

export function classifyReflectiveMaterial(
  name: string,
  meshName = ''
): ReflectiveMaterialKind {
  const n = `${name} ${meshName}`.toLowerCase();
  if (/mirror|鏡/.test(n)) return 'mirror';
  if (/glass|窓|window|透明|acryl/.test(n)) return 'glass';
  if (/water|水面|pool|液/.test(n)) return 'water';
  if (/wet|雨|puddle/.test(n)) return 'wet';
  if (/floor|地面|床|stage.?floor|ground|plane/.test(n)) return 'floor';
  if (/金属|metal|chrome|steel|iron|zip|バックル|釦|ring|jewel|weapon|刀|剣|銃/.test(n))
    return 'metal';
  if (/plastic|プラ|pvc|rubber/.test(n)) return 'plastic';
  if (/髪|hair|前髪/.test(n)) return 'hair';
  if (/目|eye|瞳|まぶた|睫毛/.test(n)) return 'eye';
  if (/肌|skin|顔|face|体|body/.test(n)) return 'skin';
  if (/服|skirt|cloth|衣|pants|靴|shoe|sock|tie|リボン|accessory|アクセ|飾/.test(n))
    return /靴|shoe|access|jewel|飾|weapon|刀/.test(n) ? 'accessory' : 'cloth';
  if (/prop|小物|stage|セット/.test(n)) return 'prop';
  return 'default';
}

function ensureUniforms(shader: {
  uniforms: Record<string, { value: unknown }>;
}): void {
  const u = shader.uniforms;
  if (!u.bpBoxMin) u.bpBoxMin = { value: new THREE.Vector3(-12, -1, -12) };
  if (!u.bpBoxMax) u.bpBoxMax = { value: new THREE.Vector3(12, 15, 12) };
  if (!u.bpProbePos) u.bpProbePos = { value: new THREE.Vector3(0, 5, 0) };
  if (!u.bpIntensity) u.bpIntensity = { value: 1 };
  if (!u.bpRoughnessInfluence) u.bpRoughnessInfluence = { value: 1 };
  if (!u.bpContactHardening) u.bpContactHardening = { value: 1 };
  if (!u.bpEnabled) u.bpEnabled = { value: 1 };
}

/**
 * Inject box projection into Three.js physical envmap sampling.
 */
export function patchMaterialBoxProjection(
  material: THREE.Material,
  kind: ReflectiveMaterialKind = 'default',
  kindScale = 1
): void {
  if (
    !(material instanceof THREE.MeshStandardMaterial) &&
    !(material instanceof THREE.MeshPhysicalMaterial)
  ) {
    return;
  }
  if (material.userData[PATCH_FLAG]) {
    material.userData.bpKindScale = KIND_INTENSITY[kind] * kindScale;
    return;
  }

  material.userData[PATCH_FLAG] = true;
  material.userData.bpKindScale = KIND_INTENSITY[kind] * kindScale;
  material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, 0.85);

  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer);
    ensureUniforms(shader);

    if (!shader.vertexShader.includes('bpWorldPos')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 bpWorldPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
bpWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`
      );
    }

    if (shader.fragmentShader.includes('#include <envmap_physical_pars_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <envmap_physical_pars_fragment>',
        PATCHED_ENVMAP_PHYSICAL
      );
    }

    material.userData.bpShader = shader;
  };

  material.customProgramCacheKey = () => `${(material as THREE.Material).uuid}-iboxproj-v2`;
  material.needsUpdate = true;
}

/** Push live probe uniforms into all patched materials under a root. */
export function syncBoxReflectionUniforms(
  root: THREE.Object3D,
  bag: BoxReflectionUniformBag,
  globalIntensity = 1
): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat?.userData?.[PATCH_FLAG]) continue;
      const shader = mat.userData.bpShader as
        | { uniforms: Record<string, { value: unknown }> }
        | undefined;
      if (!shader?.uniforms) continue;
      const kindScale = (mat.userData.bpKindScale as number) ?? 1;
      shader.uniforms.bpBoxMin.value = bag.boxMin;
      shader.uniforms.bpBoxMax.value = bag.boxMax;
      shader.uniforms.bpProbePos.value = bag.probePos;
      shader.uniforms.bpIntensity.value = bag.intensity * kindScale * globalIntensity;
      shader.uniforms.bpRoughnessInfluence.value = bag.roughnessInfluence;
      shader.uniforms.bpContactHardening.value = bag.contactHardening;
      shader.uniforms.bpEnabled.value = bag.enabled;

      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.envMapIntensity = THREE.MathUtils.clamp(
          (bag.intensity * kindScale * globalIntensity) * 0.95,
          0.15,
          2.2
        );
      }
    }
  });
}

export function applyBoxReflectionsToObject(
  root: THREE.Object3D,
  opts: {
    character?: boolean;
    environment?: boolean;
    animeFriendly?: boolean;
  } = {}
): number {
  const character = opts.character !== false;
  const environment = opts.environment !== false;
  const anime = opts.animeFriendly !== false;
  let count = 0;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      if (!mat) return;
      const kind = classifyReflectiveMaterial(mat.name || '', mesh.name || '');
      const isChar =
        kind === 'hair' ||
        kind === 'eye' ||
        kind === 'skin' ||
        kind === 'cloth' ||
        kind === 'accessory';
      const isEnv =
        kind === 'floor' ||
        kind === 'glass' ||
        kind === 'metal' ||
        kind === 'plastic' ||
        kind === 'water' ||
        kind === 'wet' ||
        kind === 'mirror' ||
        kind === 'prop' ||
        kind === 'default';

      if (isChar && !character) return;
      if (isEnv && !isChar && !environment) return;

      const scale = anime && isChar ? (kind === 'skin' ? 0.85 : 1) : 1;
      patchMaterialBoxProjection(mat, kind, scale);
      count += 1;

      if (mat instanceof THREE.MeshStandardMaterial) {
        if (kind === 'eye') {
          mat.roughness = Math.min(mat.roughness, 0.28);
          mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.1);
        } else if (kind === 'metal' || kind === 'accessory') {
          mat.metalness = Math.max(mat.metalness, 0.55);
          mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.05);
        } else if (kind === 'hair') {
          mat.envMapIntensity = Math.max(mat.envMapIntensity, 0.75);
        } else if (kind === 'glass' || kind === 'mirror' || kind === 'water') {
          mat.metalness = Math.max(mat.metalness, 0.35);
          mat.roughness = Math.min(mat.roughness, 0.2);
          mat.envMapIntensity = Math.max(mat.envMapIntensity, 1.25);
        }
      }
    });
  });

  return count;
}
