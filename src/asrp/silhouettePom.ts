/**
 * Silhouette POM — WebGL port adapted from SkyeShark/threejs-silhouette-pom (TSL).
 * https://github.com/SkyeShark/threejs-silhouette-pom
 *
 * Built into ASRP via MeshStandardMaterial.onBeforeCompile — not a post-FX / plugin.
 */
import * as THREE from 'three';
import type { AsrpMaterialProfile, AsrpQualityProfile } from './types';

const PATCH_FLAG = 'asSilhouettePom';

export const POM_UNIFORMS = /* glsl */ `
uniform sampler2D asrpHeightMap;
uniform float asrpEnabled;
uniform float asrpHeightScale;
uniform float asrpMinLayers;
uniform float asrpMaxLayers;
uniform float asrpMinViewZ;
uniform float asrpSilhouette;
uniform float asrpSoftSilhouette;
uniform float asrpNormalBlend;
uniform float asrpFade;
`;

export const POM_FUNCTIONS = /* glsl */ `
vec3 asrpSilhouettePom( vec2 uv0, vec3 viewDirTS ) {
  float layers = mix( asrpMaxLayers, asrpMinLayers, clamp( abs( viewDirTS.z ), 0.0, 1.0 ) );
  layers = max( layers, 1.0 );
  float layerDepth = 1.0 / layers;
  vec2 shift = viewDirTS.xy / max( abs( viewDirTS.z ), asrpMinViewZ ) * asrpHeightScale;
  vec2 deltaUV = shift / layers;

  vec2 currentUV = uv0;
  float currentLayerDepth = 0.0;
  float currentDepth = 1.0 - texture2D( asrpHeightMap, currentUV ).r;

  for ( int i = 0; i < 64; i++ ) {
    if ( float( i ) >= layers ) break;
    if ( currentLayerDepth >= currentDepth ) break;
    currentUV -= deltaUV;
    currentLayerDepth += layerDepth;
    currentDepth = 1.0 - texture2D( asrpHeightMap, currentUV ).r;
  }

  vec2 previousUV = currentUV + deltaUV;
  float after = currentLayerDepth - currentDepth;
  float beforeDepth = 1.0 - texture2D( asrpHeightMap, previousUV ).r;
  float before = beforeDepth - ( currentLayerDepth - layerDepth );
  float weight = clamp( after / max( after + before, 1e-4 ), 0.0, 1.0 );
  vec2 finalUV = mix( currentUV, previousUV, weight );
  float miss = currentDepth - currentLayerDepth;
  return vec3( finalUV, miss );
}

float asrpSilhouetteCoverage( vec2 uvHit ) {
  float feather = mix( 0.012, 0.045, asrpSoftSilhouette );
  float overU = max( 0.0 - uvHit.x, uvHit.x - 1.0 );
  float overV = max( 0.0 - uvHit.y, uvHit.y - 1.0 );
  float over = max( overU, overV );
  return clamp( 1.0 - over / feather, 0.0, 1.0 );
}
`;

export interface PomUniformBag {
  enabled: number;
  heightScale: number;
  minLayers: number;
  maxLayers: number;
  minViewZ: number;
  silhouette: number;
  softSilhouette: number;
  normalBlend: number;
  fade: number;
  heightMap: THREE.Texture | null;
}

function ensurePomUniforms(
  shader: { uniforms: Record<string, { value: unknown }> },
  heightMap: THREE.Texture
): void {
  const u = shader.uniforms;
  if (!u.asrpHeightMap) u.asrpHeightMap = { value: heightMap };
  else u.asrpHeightMap.value = heightMap;
  if (!u.asrpEnabled) u.asrpEnabled = { value: 1 };
  if (!u.asrpHeightScale) u.asrpHeightScale = { value: 0.03 };
  if (!u.asrpMinLayers) u.asrpMinLayers = { value: 8 };
  if (!u.asrpMaxLayers) u.asrpMaxLayers = { value: 24 };
  if (!u.asrpMinViewZ) u.asrpMinViewZ = { value: 0.05 };
  if (!u.asrpSilhouette) u.asrpSilhouette = { value: 1 };
  if (!u.asrpSoftSilhouette) u.asrpSoftSilhouette = { value: 1 };
  if (!u.asrpNormalBlend) u.asrpNormalBlend = { value: 1 };
  if (!u.asrpFade) u.asrpFade = { value: 1 };
}

/**
 * Patch MeshStandardMaterial with Silhouette POM (UV offset + optional silhouette).
 * Chains with existing onBeforeCompile (box reflections etc.).
 */
export function patchMaterialSilhouettePom(
  material: THREE.MeshStandardMaterial,
  heightMap: THREE.Texture,
  profile: AsrpMaterialProfile,
  quality: AsrpQualityProfile,
  global: {
    depthStrength: number;
    silhouetteWidth: number;
    normalBlend: number;
    animePreserve: boolean;
  }
): void {
  if (material.userData[PATCH_FLAG]) {
    material.userData.asrpProfile = profile;
    material.userData.asrpQuality = quality;
    material.userData.asrpHeightMap = heightMap;
    return;
  }

  material.userData[PATCH_FLAG] = true;
  material.userData.asrpProfile = profile;
  material.userData.asrpQuality = quality;
  material.userData.asrpHeightMap = heightMap;

  const useSilhouette =
    quality.silhouette &&
    profile.silhouetteWidth * global.silhouetteWidth > 0.05 &&
    !global.animePreserve
      ? true
      : quality.silhouette &&
        profile.silhouetteWidth * global.silhouetteWidth > 0.2 &&
        profile.softSilhouette;

  // Anime preserve: soft alpha only on hair/cloth, never hard discard on skin/eyes
  if (
    useSilhouette &&
    profile.softSilhouette &&
    (profile.kind === 'hair' || profile.kind === 'cloth' || profile.kind === 'fabric')
  ) {
    material.transparent = true;
    material.alphaTest = 0.12;
    material.depthWrite = true;
  }

  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer);
    ensurePomUniforms(shader, heightMap);

    if (!shader.vertexShader.includes('asrpViewDirTS')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 asrpViewDirTS;
varying float asrpViewDist;`
      );
      // After normals/tangents are in view space
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
asrpViewDist = length( mvPosition.xyz );
#ifdef USE_TANGENT
  {
    vec3 asrpT = normalize( transformedTangent );
    vec3 asrpN = normalize( transformedNormal );
    vec3 asrpB = normalize( cross( asrpN, asrpT ) * tangent.w );
    vec3 asrpV = normalize( -mvPosition.xyz );
    asrpViewDirTS = normalize( vec3( dot( asrpV, asrpT ), dot( asrpV, asrpB ), dot( asrpV, asrpN ) ) );
  }
#else
  asrpViewDirTS = vec3( 0.0, 0.0, 1.0 );
#endif`
      );
    }

    if (!shader.fragmentShader.includes('asrpSilhouettePom')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 asrpViewDirTS;
varying float asrpViewDist;
${POM_UNIFORMS}
${POM_FUNCTIONS}
vec2 asrpUv;
float asrpCoverage;`
      );
    }

    // Compute offset UV, then sample map at asrpUv
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `
asrpCoverage = 1.0;
#if defined( USE_MAP )
  asrpUv = vMapUv;
#elif defined( USE_NORMALMAP )
  asrpUv = vNormalMapUv;
#else
  asrpUv = vec2( 0.0 );
#endif
#if defined( USE_MAP ) || defined( USE_NORMALMAP )
  if ( asrpEnabled > 0.5 && asrpFade > 0.001 ) {
    vec3 pom = asrpSilhouettePom( asrpUv, normalize( asrpViewDirTS ) );
    asrpUv = mix( asrpUv, pom.xy, asrpFade );
    if ( asrpSilhouette > 0.5 ) {
      asrpCoverage = asrpSilhouetteCoverage( pom.xy );
      if ( asrpSoftSilhouette < 0.5 && asrpCoverage < 0.45 ) discard;
    }
  }
#endif
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, asrpUv );
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
#ifdef USE_NORMALMAP_OBJECTSPACE
  normal = texture2D( normalMap, asrpEnabled > 0.5 ? asrpUv : vNormalMapUv ).xyz * 2.0 - 1.0;
  #ifdef FLIP_SIDED
    normal = - normal;
  #endif
  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif
  normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
  vec3 mapN = texture2D( normalMap, asrpEnabled > 0.5 ? asrpUv : vNormalMapUv ).xyz * 2.0 - 1.0;
  #if defined( USE_PACKED_NORMALMAP )
    mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
  #endif
  mapN.xy *= normalScale * asrpNormalBlend;
  normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <alphamap_fragment>',
      `#include <alphamap_fragment>
if ( asrpEnabled > 0.5 && asrpSilhouette > 0.5 ) {
  diffuseColor.a *= mix( 1.0, asrpCoverage, asrpFade * 0.85 );
}
`
    );

    material.userData.asrpShader = shader;
  };

  material.customProgramCacheKey = () =>
    `${material.uuid}-spom-v2-${profile.kind}-${quality.tier}`;
  material.needsUpdate = true;
}

export function syncSilhouettePomUniforms(
  root: THREE.Object3D,
  bag: PomUniformBag
): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat?.userData?.[PATCH_FLAG]) continue;
      const shader = mat.userData.asrpShader as
        | { uniforms: Record<string, { value: unknown }> }
        | undefined;
      if (!shader?.uniforms) continue;
      const profile = mat.userData.asrpProfile as AsrpMaterialProfile | undefined;
      const scale = (profile?.heightScale ?? 0.02) * bag.heightScale;
      shader.uniforms.asrpEnabled.value = bag.enabled;
      shader.uniforms.asrpHeightScale.value = scale;
      shader.uniforms.asrpMinLayers.value = Math.max(
        4,
        Math.min(bag.minLayers, profile?.minLayers ?? bag.minLayers)
      );
      shader.uniforms.asrpMaxLayers.value = Math.min(
        64,
        Math.max(bag.maxLayers, profile?.maxLayers ?? bag.maxLayers)
      );
      shader.uniforms.asrpMinViewZ.value = bag.minViewZ;
      const sil =
        bag.silhouette * (profile?.silhouetteWidth ?? 1) > 0.05 ? 1 : 0;
      shader.uniforms.asrpSilhouette.value = sil;
      shader.uniforms.asrpSoftSilhouette.value =
        profile?.softSilhouette || bag.softSilhouette ? 1 : 0;
      shader.uniforms.asrpNormalBlend.value =
        bag.normalBlend * (profile?.normalBlend ?? 1);
      shader.uniforms.asrpFade.value = bag.fade;
      const hm =
        (mat.userData.asrpHeightMap as THREE.Texture | undefined) ?? bag.heightMap;
      if (hm) shader.uniforms.asrpHeightMap.value = hm;
    }
  });
}
