/**
 * GLSL helpers ported from Unity Box Projected Cubemap Reflections
 * (frostbone25 Improved Box Projected Reflections — box project + contact hardening).
 * https://github.com/frostbone25/Unity-Improved-Box-Projected-Reflections
 */

/** Shared uniforms injected into MeshStandard / MeshPhysical materials. */
export const BOX_REFLECTION_UNIFORMS = /* glsl */ `
uniform vec3 bpBoxMin;
uniform vec3 bpBoxMax;
uniform vec3 bpProbePos;
uniform float bpIntensity;
uniform float bpRoughnessInfluence;
uniform float bpContactHardening;
uniform float bpEnabled;
`;

/**
 * Box-project a world-space reflection vector onto the probe AABB.
 * Returns projected direction + intersection distance (for contact hardening).
 */
export const BOX_PROJECT_FN = /* glsl */ `
vec4 boxProjectCubemapDirection(vec3 worldPos, vec3 worldRefl) {
  vec3 firstPlane = (bpBoxMax - worldPos) / worldRefl;
  vec3 secondPlane = (bpBoxMin - worldPos) / worldRefl;
  vec3 furthest = max(firstPlane, secondPlane);
  float dist = min(min(furthest.x, furthest.y), furthest.z);
  dist = max(dist, 0.001);
  vec3 intersect = worldPos + worldRefl * dist;
  vec3 dir = normalize(intersect - bpProbePos);
  return vec4(dir, dist);
}

float boxContactHardeningMip(
  float intersectionDistance,
  float perceptualRoughness,
  vec3 normal,
  vec3 viewDir
) {
  float fresnelTerm = 1.0 - clamp(dot(normal, viewDir), 0.0, 1.0);
  fresnelTerm = fresnelTerm * fresnelTerm * fresnelTerm * fresnelTerm;
  float reflectionRoughness = clamp(intersectionDistance / 8.0, 0.0, 1.0);
  reflectionRoughness *= (1.0 - fresnelTerm);
  reflectionRoughness += (1.0 - fresnelTerm) * perceptualRoughness;
  reflectionRoughness = clamp(reflectionRoughness, 0.0, 1.0);
  float mipMin = (perceptualRoughness * perceptualRoughness) * 8.0;
  float mip = mix(mipMin, reflectionRoughness * 8.0, bpContactHardening);
  return mip * bpRoughnessInfluence;
}
`;
