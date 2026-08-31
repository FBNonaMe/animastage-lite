/**
 * Patch RTX — full-scene GPU path tracer inside EffectComposer.
 *
 * Rebuilt to be safe with very large scenes (500K+ triangles, deep BVH).
 * Major changes vs the original:
 *   - BVH traversal stack bumped from 32 to 64 entries; this comfortably
 *     covers SAH trees up to ~1.5M triangles.
 *   - Triangle & material sampling tightened (no out-of-bounds reads).
 *   - Multi-page BVH (up to 4 pages) is plumbed through uniforms; the
 *     shader tests all pages and keeps the closest hit.
 *   - Optional map-light sphere primitives (kept from original) for NEE.
 *   - Per-frame `syncFromScene` no longer over-invalidates the accumulator
 *     on every camera change; we use a slightly relaxed signature so small
 *     camera drifts don't reset the noise-free accumulation.
 *   - `dispose()` is robust to partial initialization.
 */
"use strict";

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { RTXEngine } from "./rtx-engine.js";
import { RtxLightSampler } from "./rtx-light-sampler.js";
import {
  cloneQualityPreset,
  computeAdaptiveDenoiseStrength,
  estimateRtxVramBytes,
} from "./rtx-render-quality.js?v=rq3";

const MAX_MAP_LIGHTS = 8;
const MAX_BVH_DEPTH = 64; // traversal stack depth in shader
const MAX_PAGES = 4; // mirror of rtx-engine MAX_PAGES
const LEAF_TRI_GUARD = 32; // mirror of rtx-engine LEAF_SIZE * 4 (max leaf size)

// Load marker — if you do NOT see this in the console after reloading, the
// browser is serving a CACHED patch-rtx-renderer.js and none of the shader
// fixes are running. Hard-reload (Ctrl+Shift+R) or DevTools > Network > Disable cache.
try { console.info("%c[RTX patch] build shaderStudio-2026-07-02 loaded", "color:#6cf;font-weight:bold"); } catch (_e) {}

const VERT = `
precision highp float;
in vec3 position;
out vec2 vUv;
void main(){
  vUv = vec2(position.x * 0.5 + 0.5, position.y * 0.5 + 0.5);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// IMPORTANT: WebGL2/GLSL3 only supports fixed-size local arrays. We use
// `int stack[64]` instead of the old 32.
const TRACE = `
precision highp float;
precision highp sampler2DArray;  // GLSL ES 3.0 requires explicit precision for array samplers
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAlbedo;
layout(location = 2) out vec4 outNormalDepth;
layout(location = 3) out vec4 outMoments;

uniform vec2  uRes;
uniform int   uFrame;
uniform sampler2D uPrev;
uniform sampler2D uPrevAlbedo;
uniform sampler2D uPrevNormalDepth;
uniform sampler2D uPrevMoments;
uniform float uCameraNear;
uniform float uCameraFar;
uniform vec3  uCamPos;
uniform vec3  uCamTarget;
uniform float uFov;
uniform float uAperture;
uniform float uFocusDist; // manual focus distance (world units); <=0 = auto (orbit target)
uniform float uBlades;    // aperture blade count; <3 = perfect circle
uniform float uBladeRot;  // blade rotation (radians)
uniform float uAnamorphic; // iris squeeze ratio; 1 = spherical lens
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uSunWeight;
uniform float uSunSoft;     // shadow-softness cone for sun NEE
uniform vec3  uRimDir;
uniform vec3  uRimColor;
uniform float uRimWeight;
uniform vec3  uFillDir;
uniform vec3  uFillColor;
uniform float uFillWeight;
// Scene-driven sky / weather (fed from the raster viewer every frame so the
// path tracer matches whatever weather + time-of-day the user picked).
uniform vec3  uSkyTop;      // upper-sky / zenith colour
uniform vec3  uSkyBot;      // horizon colour
uniform vec3  uSkyGround;   // colour below the horizon
uniform float uSkyStrength; // overall sky brightness (env/night driven)
uniform float uSkyFlat;     // 1.0 = flat background colour (sky dome off)
uniform vec3  uSkyFlatColor;
uniform vec3  uFogColor;    // weather haze colour
uniform float uFogAmt;      // 0..1 horizon haze strength
// Temporal accumulation: minimum blend weight for the newest sample. 0 lets a
// static frame converge to zero noise; a small positive value while the scene
// is changing keeps the image adapting instead of resetting to a black frame.
uniform float uMinBlend;
uniform int   uAdaptiveSampling;
uniform float uAdaptiveMinSamples;
uniform float uAdaptiveThreshold;
uniform float uAdaptiveStrength;
uniform int   uBounces;
// 1 while the user is navigating: Cycles-style fast preview (low res is set
// on the JS side, bounce budget capped here, history fully replaced).
uniform int   uInteractive;
uniform int   uMapLightCount;
uniform vec3  uMapLightPos[8];
uniform vec3  uMapLightEmit[8];
uniform float uMapLightRad[8];
uniform float uMapLightCdf[8];
uniform float uMapLightSelectPdf[8];
uniform float uDirectSunPdf;
uniform float uMaxRadiance;
uniform float uRoughnessFloor;

uniform int   uSceneReady;
uniform int   uPageCount;
uniform sampler2D uTriData;
uniform sampler2D uMatData;
uniform sampler2D uBvhNodes;
uniform sampler2DArray uAtlas;  // one native-res layer per unique texture
uniform float uTexLod;   // mip LOD bias — higher = softer (anti-alias)
uniform float uDebugMode; // diagnostic views: 0=off 1=shading normal 2=UV (tests barycentric)
uniform float uNoSphere;  // 1 = disable sphere/matcap (diagnostic: is the sheen the facets?)
uniform float uNoShadow;  // 1 = disable NEE shadow occlusion (diagnostic: is it shadow acne?)
uniform float uFlatLod;   // 1 = force base-level texture LOD (diagnostic: is it the mip LOD?)
uniform float uSmoothGI;  // 1 = orient diffuse bounce by the SMOOTH normal (slide below-horizon samples) instead of reflecting off the flat face — kills low-poly GI facets
uniform float uTexSize;  // texture-array layer size in texels (for LOD calc)
uniform int   uTriCount;
uniform int   uNodeCount;
uniform int   uMatCount;
uniform vec2  uTriTexSize;
uniform vec2  uBvhTexSize;
uniform vec2  uMatTexSize;

// Multi-page samplers (only used when uPageCount > 1).
uniform sampler2D uTriDataPages[4];
uniform sampler2D uBvhNodesPages[4];
uniform vec2  uTriTexSizePages[4];
uniform vec2  uBvhTexSizePages[4];
uniform int   uTriCountPages[4];
uniform int   uNodeCountPages[4];

in vec2 vUv;

#define PI 3.14159265359
#define INF 1e9
#define DIFFUSE 0
#define METAL   1
#define GLASS   2
#define LIGHT   3
// Compile-time ceiling on the bounce loop. The GLSL->HLSL (ANGLE/D3D) backend
// UNROLLS the bounce loop and inlines the whole intersectScene body (BVH
// traversal + per-leaf triangle loop x pages) into EACH iteration. With a
// constant bound of 32 that produced a ~9s cold shader compile on weaker GPUs
// (the "BVH ready in 8792ms" freeze) and tripped the driver watchdog ->
// CONTEXT_LOST. The UI never offers more than 8 bounces (selRtxBounces: 2/4/6/8),
// so 8 is a correctness-preserving ceiling that shrinks the unrolled shader ~4x.
// The runtime check (b >= maxB) below still honours the user selection.
#define MAX_BOUNCES 8

struct Hit {
  float t;
  vec3 p;
  vec3 n;    // SHADING (smooth) normal — used for lighting
  vec3 gn;   // GEOMETRIC (true face) normal, oriented to the ray — used to OFFSET
             // ray origins. Offsetting along the smooth normal on a faceted mesh
             // lands the origin below neighbouring triangles near edges -> the
             // shadow/bounce ray self-hits -> per-triangle "acne" facets (the
             // pattern seen on the smooth, matcap-free legs). The geometric
             // normal always lifts cleanly off the actual triangle plane.
  bool front;
  int mat;
  vec3 albedo;
  float fuzz;
  vec3 emit;
  vec2 uv;
  float es;  // local triangle scale (longest edge). Drives a SCALE-RELATIVE ray
             // offset epsilon below: a fixed world-space offset (0.003-0.004) is
             // tuned for a ~2-unit VRM and is far too small on a ~20-40-unit MMD
             // model, so secondary rays start below neighbouring triangles ->
             // per-triangle self-shadow "acne" (the random-blocks look on legs).
  bool sphL;   // hit one of the analytic map-light spheres
  int sphIndex; // analytic map-light index; required for BSDF/light MIS
  int matId;   // material index of the hit (-1 = analytic sphere / none) —
               // lets shading fetch the flexible-shader texel (coat/rim/sss)
};

uint rngState;
// Camera basis (right/up/forward), set once per pixel in main(). Used to project
// hit normals into view space for MMD sphere-map (matcap) sampling.
vec3 gCamR = vec3(1.0, 0.0, 0.0);
vec3 gCamU = vec3(0.0, 1.0, 0.0);
vec3 gCamF = vec3(0.0, 0.0, -1.0);
// World units covered by one screen pixel at unit distance (set in main()).
// Used to pick a mip LOD from the ray footprint so dense textures (tights
// houndstooth, plaid) don't alias into noise when minified.
float gConeW = 0.001;

// Texture LOD from the ray-cone footprint and the material's average texel
// density (texels per world unit, computed once per material on the CPU). Using
// a PER-MATERIAL density keeps the LOD continuous across the surface. The old
// code derived density from EACH triangle's own UV/area ratio, so neighbouring
// triangles picked different mip levels -> the mesh printed as facets (sharp vs
// blurred triangles). density already folds in UV repeat and texture size.
float texLOD(float density, float t){
  if (uFlatLod > 0.5) return uTexLod; // diagnostic: force base level (no auto-LOD)
  float footprint = max(1.0, t * gConeW * density); // texels per pixel
  return uTexLod + log2(footprint);
}

uint wangHash(uint s){
  s = (s ^ 61u) ^ (s >> 16);
  s *= 9u;
  s = s ^ (s >> 4);
  s *= 0x27d4eb2du;
  s = s ^ (s >> 15);
  return s;
}
void seedRng(uvec2 px){
  // Properly decorrelated seed (the old linear combo produced visible
  // diagonal noise patterns that the accumulator "baked in").
  rngState = wangHash(px.x * 1973u + px.y * 9277u + uint(uFrame) * 26699u) | 1u;
}
float rnd(){
  rngState = rngState*747796405u + 2891336453u;
  uint w = ((rngState>>((rngState>>28u)+4u))^rngState)*277803737u;
  return float((w>>22u)^w)/4294967295.0;
}
vec3 cosineHemisphere(vec3 n){
  float r1 = rnd(), r2 = rnd();
  float phi = 2.0*PI*r1;
  float sq = sqrt(r2);
  vec3 w = n;
  vec3 a = abs(w.x)>0.9 ? vec3(0,1,0) : vec3(1,0,0);
  vec3 u = normalize(cross(a,w));
  vec3 v = cross(w,u);
  return normalize(u*cos(phi)*sq + v*sin(phi)*sq + w*sqrt(1.0-r2));
}
vec3 randUnit(){
  float z = rnd()*2.0-1.0;
  float a = rnd()*2.0*PI;
  float r = sqrt(1.0-z*z);
  return vec3(r*cos(a), r*sin(a), z);
}
vec2 randDisk(){
  float r = sqrt(rnd()); float a = 2.0*PI*rnd();
  return vec2(r*cos(a), r*sin(a));
}
// Uniform sample inside a regular N-gon (real lens iris): pick one blade
// wedge, sample its triangle. Gives polygonal bokeh discs like a physical
// aperture — hexagons/pentagons instead of perfect circles.
vec2 randPolygon(float n, float rot){
  float seg = 6.28318530718 / n;
  float a0 = rot + floor(rnd() * n) * seg;
  vec2 p0 = vec2(cos(a0), sin(a0));
  vec2 p1 = vec2(cos(a0 + seg), sin(a0 + seg));
  float u = rnd(), v = rnd();
  if (u + v > 1.0) { u = 1.0 - u; v = 1.0 - v; }
  return p0 * u + p1 * v;
}

vec4 fetchTriPix(int idx, sampler2D tex, vec2 tsize){
  float x = mod(float(idx), tsize.x);
  float y = floor(float(idx) / tsize.x);
  return textureLod(tex, (vec2(x, y) + 0.5) / tsize, 0.0);
}
vec4 fetchBvhPix(int idx, sampler2D tex, vec2 bsize){
  float x = mod(float(idx), bsize.x);
  float y = floor(float(idx) / bsize.x);
  return textureLod(tex, (vec2(x, y) + 0.5) / bsize, 0.0);
}
vec4 fetchMatPix(int idx){
  float x = mod(float(idx), uMatTexSize.x);
  float y = floor(float(idx) / uMatTexSize.x);
  return textureLod(uMatData, (vec2(x, y) + 0.5) / uMatTexSize, 0.0);
}

vec4 fetchTriPixPage(int pg, int idx){
  if (pg == 0) return fetchTriPix(idx, uTriData, uTriTexSize);
  else if (pg == 1) return fetchTriPix(idx, uTriDataPages[1], uTriTexSizePages[1]);
  else if (pg == 2) return fetchTriPix(idx, uTriDataPages[2], uTriTexSizePages[2]);
  else return fetchTriPix(idx, uTriDataPages[3], uTriTexSizePages[3]);
}

vec4 fetchBvhPixPage(int pg, int idx){
  if (pg == 0) return fetchBvhPix(idx, uBvhNodes, uBvhTexSize);
  else if (pg == 1) return fetchBvhPix(idx, uBvhNodesPages[1], uBvhTexSizePages[1]);
  else if (pg == 2) return fetchBvhPix(idx, uBvhNodesPages[2], uBvhTexSizePages[2]);
  else return fetchBvhPix(idx, uBvhNodesPages[3], uBvhTexSizePages[3]);
}

void fetchTriangle(int triIdx, sampler2D triTex, vec2 tsize,
                   out vec3 v0, out vec3 v1, out vec3 v2,
                   out vec2 uv0, out vec2 uv1, out vec2 uv2, out int matId,
                   out vec3 n0, out vec3 n1, out vec3 n2){
  int base = triIdx * 9;
  vec4 a = fetchTriPix(base,     triTex, tsize);
  vec4 b = fetchTriPix(base + 1, triTex, tsize);
  vec4 c = fetchTriPix(base + 2, triTex, tsize);
  vec4 d = fetchTriPix(base + 3, triTex, tsize);
  vec4 e = fetchTriPix(base + 4, triTex, tsize);
  vec4 f = fetchTriPix(base + 5, triTex, tsize);
  vec4 t6 = fetchTriPix(base + 6, triTex, tsize);
  vec4 t7 = fetchTriPix(base + 7, triTex, tsize);
  vec4 t8 = fetchTriPix(base + 8, triTex, tsize);
  v0 = a.xyz; v1 = b.xyz; v2 = c.xyz;
  uv0 = d.xy; uv1 = e.xy; uv2 = f.xy;
  n0 = t6.xyz; n1 = t7.xyz; n2 = t8.xyz;
  matId = int(a.w + 0.5);
}

void fetchTrianglePage(int pg, int triIdx,
                   out vec3 v0, out vec3 v1, out vec3 v2,
                   out vec2 uv0, out vec2 uv1, out vec2 uv2, out int matId,
                   out vec3 n0, out vec3 n1, out vec3 n2){
  int base = triIdx * 9;
  vec4 a = fetchTriPixPage(pg, base);
  vec4 b = fetchTriPixPage(pg, base + 1);
  vec4 c = fetchTriPixPage(pg, base + 2);
  vec4 d = fetchTriPixPage(pg, base + 3);
  vec4 e = fetchTriPixPage(pg, base + 4);
  vec4 f = fetchTriPixPage(pg, base + 5);
  vec4 t6 = fetchTriPixPage(pg, base + 6);
  vec4 t7 = fetchTriPixPage(pg, base + 7);
  vec4 t8 = fetchTriPixPage(pg, base + 8);
  v0 = a.xyz; v1 = b.xyz; v2 = c.xyz;
  uv0 = d.xy; uv1 = e.xy; uv2 = f.xy;
  n0 = t6.xyz; n1 = t7.xyz; n2 = t8.xyz;
  matId = int(a.w + 0.5);
}

void fetchMaterial(int matId,
                   out int matType, out vec3 albedo, out float fuzz, out vec3 emit, out int diffLayer, out int sphLayer, out int sphMode, out vec4 uvRO, out float uvRot, out float matAlpha, out float matDensity){
  int base = matId * 6; // stride 6: texel 5 = shader-system params (coat/rim/sss)
  vec4 m0 = fetchMatPix(base + 0);
  vec4 m1 = fetchMatPix(base + 1);
  vec4 m2 = fetchMatPix(base + 2); // x=diff layer, y=sph layer, z=sph mode, w=uv rotation
  vec4 m3 = fetchMatPix(base + 3); // xy=uv repeat, zw=uv offset (KHR_texture_transform)
  vec4 m4 = fetchMatPix(base + 4); // x=material alpha, y=texel density (per material)
  albedo = m0.xyz;
  matType = int(m0.w + 0.5);
  emit = m1.xyz;
  fuzz = m1.w;
  // floor(x+0.5) rounds correctly for negatives too (-1 = "no texture").
  diffLayer = int(floor(m2.x + 0.5));
  sphLayer  = int(floor(m2.y + 0.5));
  sphMode   = int(floor(m2.z + 0.5));
  uvRot = m2.w;
  uvRO = m3;
  matAlpha = m4.x;
  matDensity = m4.y;
}

// Apply a texture's UV transform (repeat/offset/rotation) — glTF/Sketchfab
// models use KHR_texture_transform; MMD leaves it identity. Matches three.js's
// Texture.matrix (center = 0): rotate, then scale by repeat, then add offset.
vec2 xformUV(vec2 uv, vec4 ro, float rot){
  vec2 r = uv;
  if (rot != 0.0) {
    float c = cos(rot), s = sin(rot);
    r = vec2(c * uv.x + s * uv.y, -s * uv.x + c * uv.y);
  }
  return r * ro.xy + ro.zw;
}

// Sample a material's MMD sphere map (matcap) by the hit's view-space normal and
// composite it. sphLayer < 0 = none. sphMode 1 = additive (.spa), else multiply (.sph).
void applySphere(int sphLayer, int sphMode, vec3 n, inout vec3 albedo, inout vec3 emit){
  if (sphLayer < 0 || uNoSphere > 0.5) return;
  vec3 vn = normalize(n);
  // matcap UV from the normal projected onto the camera right/up axes.
  vec2 mUV = vec2(dot(vn, gCamR), dot(vn, gCamU)) * 0.5 + 0.5;
  vec3 sph = textureLod(uAtlas, vec3(mUV.x, 1.0 - mUV.y, float(sphLayer)), uTexLod).rgb;
  if (sphMode == 1) emit += sph; else albedo *= sph;
}

// Alpha-cutout test: MMD hair/foliage/accessory textures rely on alpha. A hit
// on a texel with alpha < 0.5 is treated as a miss (both for camera rays and
// shadow rays) — without this the path tracer renders the cutout quads as
// solid slabs (big black/grey card artifacts around hair and leaves).
bool alphaCut(int matId, vec2 uv){
  int base = matId * 6; // stride 6 (see fetchMaterial)
  vec4 m2 = fetchMatPix(base + 2);
  float matAlpha = fetchMatPix(base + 4).x; // overlay fade (1 = opaque)
  int diffLayer = int(floor(m2.x + 0.5));
  if (diffLayer < 0) return matAlpha < 0.5; // untextured -> opaque unless faded out
  vec2 suv = fract(xformUV(uv, fetchMatPix(base + 3), m2.w));
  // HARD alpha test (like the raster engine), NOT stochastic. Stochastic alpha
  // over the VRM's many coincident semi-transparent skirt layers produced a
  // noisy, z-fighting albedo that read as triangular facets. A hard cutout makes
  // each layer deterministically solid (alpha >= 0.5) or cut, so the closest
  // layer wins consistently — no per-ray noise, no facets.
  return textureLod(uAtlas, vec3(suv, float(diffLayer)), uTexLod).a * matAlpha < 0.5;
}

// Division-safe reciprocal of the ray direction — computed ONCE per ray
// instead of per AABB test (the old code rebuilt it for every node visit).
vec3 safeInvDir(vec3 d){
  vec3 s = vec3(
    abs(d.x) > 1e-9 ? d.x : (d.x >= 0.0 ? 1e-9 : -1e-9),
    abs(d.y) > 1e-9 ? d.y : (d.y >= 0.0 ? 1e-9 : -1e-9),
    abs(d.z) > 1e-9 ? d.z : (d.z >= 0.0 ? 1e-9 : -1e-9));
  return 1.0 / s;
}

// Slab test returning the entry distance (>= 0) or -1.0 on miss. The entry
// distance drives near-child-first ordered traversal.
float boxHitT(vec3 ro, vec3 invD, vec3 bmin, vec3 bmax, float tMax){
  vec3 t0s = (bmin - ro) * invD;
  vec3 t1s = (bmax - ro) * invD;
  vec3 tsm = min(t0s, t1s);
  vec3 tbg = max(t0s, t1s);
  float tNear = max(max(tsm.x, tsm.y), tsm.z);
  float tFar  = min(min(tbg.x, tbg.y), tbg.z);
  if (tFar < tNear || tFar < 0.001 || tNear > tMax) return -1.0;
  return max(tNear, 0.001);
}

bool hitTri(vec3 ro, vec3 rd, vec3 v0, vec3 v1, vec3 v2, vec3 n0, vec3 n1, vec3 n2, vec2 uv0, vec2 uv1, vec2 uv2, float tmax, inout Hit h){
  vec3 e1 = v1 - v0;
  vec3 e2 = v2 - v0;
  vec3 pvec = cross(rd, e2);
  float det = dot(e1, pvec);
  if (abs(det) < 1e-8) return false;
  float invDet = 1.0 / det;
  vec3 tvec = ro - v0;
  float u = dot(tvec, pvec) * invDet;
  if (u < 0.0 || u > 1.0) return false;
  vec3 qvec = cross(tvec, e1);
  float v = dot(rd, qvec) * invDet;
  if (v < 0.0 || u + v > 1.0) return false;
  float tt = dot(e2, qvec) * invDet;
  if (tt < 0.001 || tt > tmax) return false;
  h.t = tt;
  h.es = sqrt(max(dot(e1, e1), dot(e2, e2))); // longest-edge proxy for local scale
  h.p = ro + rd * tt;
  float w = 1.0 - u - v;
  vec3 gn = cross(e1, e2);                  // geometric (face) normal — fallback only
  vec3 sn = n0 * w + n1 * u + n2 * v;        // interpolated SMOOTH (authored) normal
  vec3 nn = dot(sn, sn) > 1e-12 ? normalize(sn) : normalize(gn); // fall back if absent
  // Orient by the SMOOTH normal, NOT the geometric winding. VRM/MMD transparent
  // double-sided cloth is routinely modelled with INCONSISTENT triangle winding
  // (raster renders it DoubleSide, so the modeller never fixes it). Deciding
  // front/back from cross(e1,e2) then flips the shading normal on random
  // triangles -> the faceted light/dark pattern on the sheer skirt. The authored
  // normal is consistent across the surface, so trusting it keeps shading smooth
  // no matter how the faces are wound.
  h.front = dot(rd, nn) < 0.0;
  h.n = h.front ? nn : -nn;
  // Geometric normal oriented to the same (incoming-ray) side as the shading
  // normal, for self-intersection-free ray offsets.
  vec3 gnn = normalize(gn);
  h.gn = (dot(gnn, h.n) < 0.0) ? -gnn : gnn;
  h.uv = uv0 * w + uv1 * u + uv2 * v;
  return true;
}

bool hitSphere(vec3 c, float r, int mat, vec3 albedo, float fuzz, vec3 emit, vec3 ro, vec3 rd, float tmax, out Hit h){
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r*r;
  float disc = b*b - cc;
  if (disc < 0.0) return false;
  float sq = sqrt(disc);
  float t = -b - sq;
  if (t < 0.001) t = -b + sq;
  if (t < 0.001 || t > tmax) return false;
  h.t = t; h.p = ro + rd*t; h.es = r; // sphere: radius is its local scale
  vec3 on = (h.p - c)/r;
  h.front = dot(rd, on) < 0.0;
  h.n = h.front ? on : -on;
  h.gn = h.n; // sphere: geometric == shading normal
  h.mat = mat; h.albedo = albedo; h.fuzz = fuzz; h.emit = emit;
  h.sphL = false;
  h.sphIndex = -1;
  h.matId = -1;
  h.uv = vec2(0.0);
  return true;
}

// Visibility check (any hit before tmax) over BVH pages + map lights.
// Alpha-cutout texels do NOT occlude.
int occluded(vec3 ro, vec3 rd, float tmax){
  int result = 0;
  vec3 invD = safeInvDir(rd);
  // Page 0
  if (uSceneReady != 0 && uTriCount > 0) {
    int stack[64];
    int sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      int nodeIdx = stack[--sp];
      int base = nodeIdx * 3;
      vec4 n0 = fetchBvhPix(base,     uBvhNodes, uBvhTexSize);
      vec4 n1 = fetchBvhPix(base + 1, uBvhNodes, uBvhTexSize);
      vec4 n2 = fetchBvhPix(base + 2, uBvhNodes, uBvhTexSize);
      if (boxHitT(ro, invD, n0.xyz, n1.xyz, tmax) < 0.0) continue;
      if (n0.w > 0.5) {
        int start = int(n2.x + 0.5);
        int count = int(n2.y + 0.5);
        for (int i = 0; i < count; i++) {
          int triIdx = start + i;
          vec3 v0, v1, v2, n0, n1, n2; vec2 uv0, uv1, uv2; int matId;
          fetchTriangle(triIdx, uTriData, uTriTexSize, v0, v1, v2, uv0, uv1, uv2, matId, n0, n1, n2);
          Hit tmp;
          tmp.mat = 0; tmp.albedo = vec3(1.0); tmp.fuzz = 0.0; tmp.emit = vec3(0.0); tmp.sphL = false; tmp.es = 0.0; tmp.matId = -1;
          if (hitTri(ro, rd, v0, v1, v2, n0, n1, n2, uv0, uv1, uv2, tmax, tmp)) {
            if (!alphaCut(matId, tmp.uv)) { result = 1; return result; }
          }
        }
      } else {
        int left = int(n2.x + 0.5);
        int right = int(n2.y + 0.5);
        if (sp + 2 < 64) { stack[sp++] = right; stack[sp++] = left; }
      }
    }
  }
  // Additional pages
  for (int pg = 1; pg < 4; pg++) {
    if (pg >= uPageCount) break;
    int tcount = uTriCountPages[pg];
    if (tcount <= 0) continue;
    int stack[64];
    int sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      int nodeIdx = stack[--sp];
      int base = nodeIdx * 3;
      vec4 n0 = fetchBvhPixPage(pg, base);
      vec4 n1 = fetchBvhPixPage(pg, base + 1);
      vec4 n2 = fetchBvhPixPage(pg, base + 2);
      if (boxHitT(ro, invD, n0.xyz, n1.xyz, tmax) < 0.0) continue;
      if (n0.w > 0.5) {
        int start = int(n2.x + 0.5);
        int count = int(n2.y + 0.5);
        for (int i = 0; i < count; i++) {
          int triIdx = start + i;
          vec3 v0, v1, v2, n0, n1, n2; vec2 uv0, uv1, uv2; int matId;
          fetchTrianglePage(pg, triIdx, v0, v1, v2, uv0, uv1, uv2, matId, n0, n1, n2);
          Hit tmp;
          tmp.mat = 0; tmp.albedo = vec3(1.0); tmp.fuzz = 0.0; tmp.emit = vec3(0.0); tmp.sphL = false; tmp.es = 0.0; tmp.matId = -1;
          if (hitTri(ro, rd, v0, v1, v2, n0, n1, n2, uv0, uv1, uv2, tmax, tmp)) {
            if (!alphaCut(matId, tmp.uv)) { result = 1; return result; }
          }
        }
      } else {
        int left = int(n2.x + 0.5);
        int right = int(n2.y + 0.5);
        if (sp + 2 < 64) { stack[sp++] = right; stack[sp++] = left; }
      }
    }
  }
  // Map light spheres also occlude
  for (int i = 0; i < 8; i++) {
    if (i >= uMapLightCount) break;
    Hit tmp;
    if (hitSphere(uMapLightPos[i], uMapLightRad[i], LIGHT, vec3(0.0), 0.0, uMapLightEmit[i], ro, rd, tmax, tmp)) { result = 1; return result; }
  }
  return result;
}

bool intersectScene(vec3 ro, vec3 rd, out Hit h){
  bool found = false;
  float tmax = INF;
  h.sphL = false;
  h.sphIndex = -1;

  vec3 invD = safeInvDir(rd);

  // ---- Page 0 — ordered traversal (near child first) ----------------------
  // Children are AABB-tested BEFORE being pushed and visited nearest-first,
  // so tmax shrinks as early as possible. Compared to the old push-everything
  // scheme this cuts node visits/texel fetches roughly in half on big scenes.
  if (uSceneReady != 0 && uTriCount > 0) {
    int stack[64];
    int sp = 0;
    int node = 0;
    while (node > -1) {
      int base = node * 3;
      vec4 n0 = fetchBvhPix(base,     uBvhNodes, uBvhTexSize);
      vec4 n2 = fetchBvhPix(base + 2, uBvhNodes, uBvhTexSize);

      if (n0.w > 0.5) {
        int start = int(n2.x + 0.5);
        int count = int(n2.y + 0.5);
        for (int i = 0; i < count; i++) {
          int triIdx = start + i;
          vec3 v0, v1, v2, n0, n1, n2; vec2 uv0, uv1, uv2; int matId;
          fetchTriangle(triIdx, uTriData, uTriTexSize, v0, v1, v2, uv0, uv1, uv2, matId, n0, n1, n2);
          Hit tmp;
          tmp.mat = 0; tmp.albedo = vec3(1.0); tmp.fuzz = 0.0; tmp.emit = vec3(0.0); tmp.sphL = false; tmp.es = 0.0; tmp.matId = -1;
          if (hitTri(ro, rd, v0, v1, v2, n0, n1, n2, uv0, uv1, uv2, tmax, tmp)) {
            int matType; int diffLayer; int sphLayer; int sphMode; vec4 uvRO; float uvRot; float matAlpha; float matDensity;
            fetchMaterial(matId, matType, tmp.albedo, tmp.fuzz, tmp.emit, diffLayer, sphLayer, sphMode, uvRO, uvRot, matAlpha, matDensity);
            bool cut = false;
            if (diffLayer >= 0) {
              vec2 suv = fract(xformUV(tmp.uv, uvRO, uvRot));
              float lod = texLOD(matDensity, tmp.t);
              vec4 texCol = textureLod(uAtlas, vec3(suv, float(diffLayer)), lod);
              if (texCol.a * matAlpha < 0.5) cut = true; // HARD alpha test (like raster) — no stochastic noise
              else tmp.albedo *= texCol.rgb;
            } else if (matAlpha < 0.5) {
              cut = true; // untextured, faded fully out
            }
            if (!cut) {
              applySphere(sphLayer, sphMode, tmp.n, tmp.albedo, tmp.emit); // MMD sphere/matcap
              tmp.mat = matType;
              tmp.matId = matId;
              h = tmp;
              tmax = tmp.t;
              found = true;
            }
          }
        }
        node = (sp > 0) ? stack[--sp] : -1;
      } else {
        int li = int(n2.x + 0.5);
        int ri = int(n2.y + 0.5);
        vec4 l0 = fetchBvhPix(li * 3,     uBvhNodes, uBvhTexSize);
        vec4 l1 = fetchBvhPix(li * 3 + 1, uBvhNodes, uBvhTexSize);
        vec4 r0 = fetchBvhPix(ri * 3,     uBvhNodes, uBvhTexSize);
        vec4 r1 = fetchBvhPix(ri * 3 + 1, uBvhNodes, uBvhTexSize);
        float tL = boxHitT(ro, invD, l0.xyz, l1.xyz, tmax);
        float tR = boxHitT(ro, invD, r0.xyz, r1.xyz, tmax);
        if (tL >= 0.0 && tR >= 0.0) {
          int nearI = li, farI = ri;
          if (tR < tL) { nearI = ri; farI = li; }
          if (sp < 64) stack[sp++] = farI;
          node = nearI;
        } else if (tL >= 0.0) {
          node = li;
        } else if (tR >= 0.0) {
          node = ri;
        } else {
          node = (sp > 0) ? stack[--sp] : -1;
        }
      }
    }
  }

  // ---- Additional pages ----
  for (int pg = 1; pg < 4; pg++) {
    if (pg >= uPageCount) break;
    int tcount = uTriCountPages[pg];
    if (tcount <= 0) continue;
    int stack[64];
    int sp = 0;
    int node = 0;
    while (node > -1) {
      int base = node * 3;
      vec4 n0 = fetchBvhPixPage(pg, base);
      vec4 n2 = fetchBvhPixPage(pg, base + 2);
      if (n0.w > 0.5) {
        int start = int(n2.x + 0.5);
        int count = int(n2.y + 0.5);
        for (int i = 0; i < count; i++) {
          int triIdx = start + i;
          vec3 v0, v1, v2, n0, n1, n2; vec2 uv0, uv1, uv2; int matId;
          fetchTrianglePage(pg, triIdx, v0, v1, v2, uv0, uv1, uv2, matId, n0, n1, n2);
          Hit tmp;
          tmp.mat = 0; tmp.albedo = vec3(1.0); tmp.fuzz = 0.0; tmp.emit = vec3(0.0); tmp.sphL = false; tmp.es = 0.0; tmp.matId = -1;
          if (hitTri(ro, rd, v0, v1, v2, n0, n1, n2, uv0, uv1, uv2, tmax, tmp)) {
            int matType; int diffLayer; int sphLayer; int sphMode; vec4 uvRO; float uvRot; float matAlpha; float matDensity;
            fetchMaterial(matId, matType, tmp.albedo, tmp.fuzz, tmp.emit, diffLayer, sphLayer, sphMode, uvRO, uvRot, matAlpha, matDensity);
            bool cut = false;
            if (diffLayer >= 0) {
              vec2 suv = fract(xformUV(tmp.uv, uvRO, uvRot));
              float lod = texLOD(matDensity, tmp.t);
              vec4 texCol = textureLod(uAtlas, vec3(suv, float(diffLayer)), lod);
              if (texCol.a * matAlpha < 0.5) cut = true; // HARD alpha test (like raster) — no stochastic noise
              else tmp.albedo *= texCol.rgb;
            } else if (matAlpha < 0.5) {
              cut = true; // untextured, faded fully out
            }
            if (!cut) {
              applySphere(sphLayer, sphMode, tmp.n, tmp.albedo, tmp.emit); // MMD sphere/matcap
              tmp.mat = matType;
              tmp.matId = matId;
              h = tmp;
              tmax = tmp.t;
              found = true;
            }
          }
        }
        node = (sp > 0) ? stack[--sp] : -1;
      } else {
        int li = int(n2.x + 0.5);
        int ri = int(n2.y + 0.5);
        vec4 l0 = fetchBvhPixPage(pg, li * 3);
        vec4 l1 = fetchBvhPixPage(pg, li * 3 + 1);
        vec4 r0 = fetchBvhPixPage(pg, ri * 3);
        vec4 r1 = fetchBvhPixPage(pg, ri * 3 + 1);
        float tL = boxHitT(ro, invD, l0.xyz, l1.xyz, tmax);
        float tR = boxHitT(ro, invD, r0.xyz, r1.xyz, tmax);
        if (tL >= 0.0 && tR >= 0.0) {
          int nearI = li, farI = ri;
          if (tR < tL) { nearI = ri; farI = li; }
          if (sp < 64) stack[sp++] = farI;
          node = nearI;
        } else if (tL >= 0.0) {
          node = li;
        } else if (tR >= 0.0) {
          node = ri;
        } else {
          node = (sp > 0) ? stack[--sp] : -1;
        }
      }
    }
  }

  // Map light spheres
  for (int i = 0; i < 8; i++) {
    if (i >= uMapLightCount) break;
    Hit tmp;
    if (hitSphere(uMapLightPos[i], uMapLightRad[i], LIGHT, vec3(0.0), 0.0, uMapLightEmit[i], ro, rd, tmax, tmp)) {
      tmp.sphL = true;
      tmp.sphIndex = i;
      h = tmp;
      tmax = tmp.t;
      found = true;
    }
  }

  return found;
}

// afterDiffuse = the ray left a diffuse surface whose direct sun light was
// already added via NEE — skip the sharp sun disk to avoid double counting
// (the broad glow terms stay: they model scattered sky light, not the disk).
vec3 sky(vec3 d, bool afterDiffuse){
  vec3 col;
  if (uSkyFlat > 0.5) {
    // Sky dome disabled in the viewer -> match its flat background colour.
    col = uSkyFlatColor;
  } else {
    float up = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    if (d.y < 0.0) {
      col = mix(uSkyBot, uSkyGround, clamp(-d.y * 1.5, 0.0, 1.0));
    } else {
      col = mix(uSkyBot, uSkyTop, pow(up, 0.6));
    }
    // Weather haze pulls the band near the horizon toward the fog colour.
    float horizonBand = pow(1.0 - clamp(d.y, 0.0, 1.0), 3.0);
    col = mix(col, uFogColor, uFogAmt * horizonBand);
  }
  col *= uSkyStrength;
  // Sun glow (broad, low energy) for all rays; the sharp disk only for rays
  // that did NOT get sun NEE (camera + specular chains).
  float sunDot = max(dot(d, uSunDir), 0.0);
  col += uSunColor * pow(sunDot, 6.0) * 0.4 * uSunWeight;
  if (!afterDiffuse) {
    col += uSunColor * smoothstep(0.9985, 0.99965, sunDot) * 60.0 * uSunWeight;
  }
  float rimDot = max(dot(d, uRimDir), 0.0);
  col += uRimColor * pow(rimDot, 4.0) * 0.25 * uRimWeight;
  float fillDot = max(dot(d, uFillDir), 0.0);
  col += uFillColor * pow(fillDot, 3.0) * 0.18 * uFillWeight;
  return max(col, vec3(0.0));
}

float schlick(float cosT, float ri){
  float r0 = (1.0-ri)/(1.0+ri); r0 *= r0;
  return r0 + (1.0-r0)*pow(1.0-cosT, 5.0);
}

float powerHeuristic(float a, float b){
  float aa = a * a;
  float bb = b * b;
  return aa / max(aa + bb, 1e-12);
}

// Hue-preserving firefly safety net.  The previous per-channel hard min()
// clipped saturated highlights and hid bad PDFs.  This only rolls luminance
// into a soft knee near the configured ceiling; valid low/mid energy is exact.
vec3 softLuminanceLimit(vec3 c){
  c = max(c, vec3(0.0));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float knee = max(1e-4, uMaxRadiance * 0.75);
  if (lum <= knee) return c;
  float shoulder = max(1e-4, uMaxRadiance - knee);
  float mapped = knee + shoulder * (1.0 - exp(-(lum - knee) / shoulder));
  return c * (mapped / max(lum, 1e-6));
}

// Next-event estimation toward the sun (or moon at night — the viewer feeds
// whichever is the key light). One soft-cone shadow ray per diffuse hit kills
// most of the old salt-and-pepper noise: the sun used to be reachable only by
// random bounce rays grazing the tiny 60x bright disk -> fireflies.
vec3 sunNEE(vec3 p, vec3 gn, vec3 n, vec3 albedo, float es, float strategyPdf){
  if (uSunWeight <= 0.0) return vec3(0.0);
  float peak = max(uSunColor.r, max(uSunColor.g, uSunColor.b));
  if (peak < 0.004) return vec3(0.0);
  vec3 sd = normalize(uSunDir + randUnit() * uSunSoft);
  float cosN = dot(n, sd);
  if (cosN <= 0.0) return vec3(0.0);
  // Offset the shadow origin along the GEOMETRIC normal so it lifts cleanly off
  // the actual triangle plane (offsetting along the smooth normal lands below
  // neighbouring triangles near edges -> self-shadow "acne" facets).
  if (uNoShadow < 0.5 && occluded(p + gn * clamp(es * 0.05, 0.004, 0.06), sd, INF) != 0) return vec3(0.0);
  // Match the raster engine's directional term: Lo = light * cos * albedo/PI.
  vec3 c = uSunColor * uSunWeight * (cosN / PI) * albedo;
  return softLuminanceLimit(c / max(strategyPdf, 1e-5));
}

float mapLightPdfW(vec3 p, vec3 lp, int li, float strategyPdf){
  vec3 ldir = lp - p;
  float dist2 = dot(ldir, ldir);
  float dist = sqrt(max(dist2, 1e-8));
  ldir /= dist;
  vec3 outward = normalize(lp - uMapLightPos[li]);
  float cosL = dot(outward, -ldir);
  if (cosL <= 1e-4) return 0.0;
  float lr = max(uMapLightRad[li], 1e-4);
  float pdfA = 1.0 / (2.0 * PI * lr * lr);
  return pdfA * dist2 / cosL
    * max(uMapLightSelectPdf[li], 1e-6)
    * max(strategyPdf, 1e-6);
}

vec3 sampleMapLightNEE(vec3 p, vec3 gn, vec3 n, vec3 albedo, float es, float strategyPdf){
  if (uMapLightCount <= 0) return vec3(0.0);
  float choose = rnd();
  int li = 0;
  for (int i = 0; i < 8; i++) {
    if (i >= uMapLightCount) break;
    li = i;
    if (choose <= uMapLightCdf[i]) break;
  }
  vec3 lc = uMapLightPos[li];
  float lr = uMapLightRad[li];
  vec3 le = uMapLightEmit[li];

  vec3 toL = lc - p;
  if (dot(toL, toL) <= lr * lr * 1.21) return vec3(0.0); // inside the bulb

  // Sample only the hemisphere of the sphere FACING the shading point.
  // The old full-sphere sampling wasted half the rays and clamped the
  // back-face cosine to 1e-4 -> enormous 1/pdf spikes (fireflies).
  vec3 dirToP = normalize(-toL);
  vec3 u = randUnit();
  if (dot(u, dirToP) < 0.0) u = -u;
  vec3 lp = lc + u * lr;
  vec3 ldir = lp - p;
  float dist2 = dot(ldir, ldir);
  float dist = sqrt(dist2);
  ldir /= max(dist, 1e-4);

  float cosN = dot(n, ldir);
  if (cosN <= 1e-4) return vec3(0.0);
  float cosL = dot(u, -ldir);
  if (cosL <= 1e-3) return vec3(0.0); // grazing — reject instead of spiking

  if (uNoShadow < 0.5 && occluded(p + gn * clamp(es * 0.05, 0.004, 0.06), ldir, dist - max(lr * 0.5, 1e-3)) != 0) return vec3(0.0);

  float pdfW = mapLightPdfW(p, lp, li, strategyPdf);
  vec3 brdf = albedo * (1.0 / PI);
  vec3 contrib = le * brdf * cosN / max(pdfW, 1e-4);
  float bsdfPdf = cosN / PI;
  contrib *= powerHeuristic(pdfW, bsdfPdf);
  return softLuminanceLimit(contrib);
}

vec3 trace(
  vec3 ro,
  vec3 rd,
  out vec3 primaryAlbedo,
  out vec3 primaryNormal,
  out float primaryDepth,
  out float primaryRoughness
){
  vec3 tp = vec3(1.0);
  vec3 rad = vec3(0.0);
  bool afterDiffuse = false;
  vec3 prevDiffuseP = vec3(0.0);
  float prevBsdfPdf = 0.0;
  primaryAlbedo = vec3(0.0);
  primaryNormal = vec3(0.0);
  primaryDepth = 0.0;
  primaryRoughness = 1.0;
  // Cycles-style viewport budget: while navigating, 2 bounces are plenty for
  // the fast preview; the full budget applies once the camera settles.
  int maxB = uInteractive == 1 ? min(uBounces, 2) : min(uBounces, MAX_BOUNCES);
  // DYNAMIC bound: maxB is uniform-derived, so ANGLE/D3D emits a real runtime
  // loop instead of UNROLLING the whole intersect+shade body MAX_BOUNCES times.
  // Together with the dynamic leaf loops + textureLod fetches, this shrinks the
  // compiled trace shader from ~1024 inlined triangle-intersect bodies (8 bounce
  // x 4 page x 32 leaf) to ~4 — small enough to link and run on weak/integrated
  // GPUs. The unrolled version is what tripped the cold-compile freeze and
  // CONTEXT_LOST. (MAX_BOUNCES is kept only as the clamp on maxB above.)
  for (int b = 0; b < maxB; b++) {
    Hit h;
    h.sphL = false;
    if (!intersectScene(ro, rd, h)) { rad += tp * sky(rd, afterDiffuse); break; }
    if (b == 0) {
      primaryAlbedo = max(h.albedo, vec3(0.0));
      primaryNormal = normalize(h.n);
      primaryDepth = max(h.t, 0.0);
      primaryRoughness = clamp(h.fuzz, 0.0, 1.0);
    }
    // Sphere map-lights were already importance-sampled by NEE on the
    // previous diffuse bounce — adding their emission again here would
    // double count (bright halos around every bulb).
    if (h.sphL && afterDiffuse && h.sphIndex >= 0) {
      float mapStrategyPdf = max(1.0 - uDirectSunPdf, 1e-6);
      float lightPdf = mapLightPdfW(prevDiffuseP, h.p, h.sphIndex, mapStrategyPdf);
      float wBsdf = powerHeuristic(prevBsdfPdf, lightPdf);
      rad += tp * h.emit * wBsdf;
    } else {
      rad += tp * h.emit;
    }
    if (h.mat == DIFFUSE) {
      // ---- Flexible shader system (per-material texel 5) ----------------
      // x = clearcoat strength, y = clearcoat roughness, z = rim, w = sss.
      vec4 fxp = (h.matId >= 0) ? fetchMatPix(h.matId * 6 + 5) : vec4(0.0, 0.15, 0.0, 0.0);
      vec3 vdir = normalize(rd);
      if (b == 0 && (fxp.z > 0.001 || fxp.w > 0.001)) {
        // Stylized additions on the primary hit only:
        //  - rim: grazing-angle highlight (figure/anime edge light)
        //  - sss: flat fill that softens skin shadow contrast (fake scatter)
        float rimT = pow(clamp(1.0 + dot(vdir, h.n), 0.0, 1.0), 3.0);
        rad += tp * h.albedo * (fxp.z * rimT * 0.9 + fxp.w * 0.12);
      }
      bool coatBounce = false;
      if (fxp.x > 0.001) {
        // Clearcoat lobe (PVC-figure / latex gloss): a fresnel-weighted
        // mirror bounce over the diffuse base. White coat keeps throughput.
        float Fc = schlick(clamp(dot(-vdir, h.n), 0.0, 1.0), 1.0 / 1.5);
        float pCoat = clamp(fxp.x * (0.08 + 0.92 * Fc), 0.0, 0.85);
        if (rnd() < pCoat) {
          // VARIANCE GUARD: never mirror-sharp. A near-zero coat roughness
          // makes the lobe catch the raw sun disk on single samples —
          // permanent white firefly blocks in the accumulation when the
          // model is backlit. A small floor spreads that energy over many
          // samples so it converges to a clean glossy highlight instead.
          float coatRSafe = max(fxp.y, max(0.15, uRoughnessFloor));
          rd = normalize(reflect(vdir, h.n) + coatRSafe * 0.4 * randUnit());
          float gdc = dot(rd, h.gn);
          if (gdc <= 0.0) rd = normalize(rd - h.gn * (gdc - 1e-3));
          ro = h.p + h.gn * clamp(h.es * 0.05, 0.003, 0.06);
          afterDiffuse = false;
          coatBounce = true;
        }
      }
      if (!coatBounce) {
      // Pick ONE light strategy per bounce (sun/moon vs map lights) and
      // compensate by 1/probability — halves the shadow-ray cost for the
      // same expected result.
      float sunPeak = max(uSunColor.r, max(uSunColor.g, uSunColor.b)) * uSunWeight;
      bool haveSun = sunPeak > 0.004;
      bool haveMap = uMapLightCount > 0;
      if (haveSun && haveMap) {
        float sunPdf = clamp(uDirectSunPdf, 0.05, 0.95);
        float mapPdf = 1.0 - sunPdf;
        if (rnd() < sunPdf) rad += tp * sunNEE(h.p, h.gn, h.n, h.albedo, h.es, sunPdf);
        else rad += tp * sampleMapLightNEE(h.p, h.gn, h.n, h.albedo, h.es, mapPdf);
      } else if (haveSun) {
        rad += tp * sunNEE(h.p, h.gn, h.n, h.albedo, h.es, 1.0);
      } else if (haveMap) {
        rad += tp * sampleMapLightNEE(h.p, h.gn, h.n, h.albedo, h.es, 1.0);
      }
      rd = cosineHemisphere(h.n);
      // The cosine sample is built around the SMOOTH normal. If it dips below the
      // GEOMETRIC surface, the old code reflected it off h.gn — but a reflect is
      // per-flat-triangle, so on low-poly cloth (the skirt) it prints the facets
      // into the ambient/GI even though the shading normal is smooth. Instead
      // SLIDE the stray sample onto the geometric tangent plane (+a tiny lift) so
      // the bounce keeps following the smooth normal => smooth low-poly shading,
      // while still never diving back into the surface (acne-safe with the offset
      // below). uSmoothGI=0 restores the old reflect for comparison.
      float gd = dot(rd, h.gn);
      if (gd <= 0.0) {
        rd = (uSmoothGI > 0.5)
          ? normalize(rd - h.gn * (gd - 1e-3))
          : reflect(rd, h.gn);
      }
      prevDiffuseP = h.p;
      prevBsdfPdf = max(dot(h.n, rd), 0.0) / PI;
      tp *= h.albedo;
      ro = h.p + h.gn * clamp(h.es * 0.05, 0.003, 0.06);
      afterDiffuse = true;
      } // !coatBounce
    } else if (h.mat == METAL) {
      vec3 r = reflect(normalize(rd), h.n);
      rd = normalize(r + max(h.fuzz, uRoughnessFloor) * randUnit());
      if (dot(rd, h.n) <= 0.0) break;
      tp *= h.albedo;
      ro = h.p + h.gn * clamp(h.es * 0.05, 0.003, 0.06);
      afterDiffuse = false;
    } else if (h.mat == GLASS) {
      float ri = h.front ? (1.0/1.5) : 1.5;
      vec3 ud = normalize(rd);
      float cosT = min(dot(-ud, h.n), 1.0);
      float sinT = sqrt(max(0.0, 1.0 - cosT*cosT));
      bool cannot = ri * sinT > 1.0;
      if (cannot || schlick(cosT, ri) > rnd())
        rd = reflect(ud, h.n);
      else
        rd = refract(ud, h.n, ri);
      ro = h.p + rd * clamp(h.es * 0.012, 0.0008, 0.02);
      afterDiffuse = false;
    } else {
      break;
    }
    if (b > 3) {
      float q = max(tp.r, max(tp.g, tp.b));
      if (rnd() > q) break;
      tp /= max(q, 1e-4);
    }
  }
  // NaN scrub: one poisoned sample would permanently stain its accumulation
  // tile as a solid white block — drop it instead.
  if (isnan(rad.x + rad.y + rad.z)) rad = vec3(0.0);
  return softLuminanceLimit(rad);
}

void main(){
  uvec2 px = uvec2(vUv * uRes);
  seedRng(px);

  vec3 fwd = normalize(uCamTarget - uCamPos);
  // Guard the basis when looking straight up/down (cross with Y degenerates).
  vec3 upRef = abs(fwd.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, upRef));
  vec3 up = cross(right, fwd);
  // Expose the camera basis to the trace/shading code for sphere-map (matcap)
  // normal projection.
  gCamR = right; gCamU = up; gCamF = fwd;
  // Real-lens focus: manual distance wins; otherwise focus on the orbit target.
  float focus = uFocusDist > 0.001 ? uFocusDist : length(uCamTarget - uCamPos);
  float tanH = tan(radians(uFov)*0.5);
  // World units per screen pixel at unit distance — drives texture mip LOD.
  gConeW = 2.0 * tanH / max(1.0, uRes.y);

  // LOW-DISCREPANCY pixel jitter: R2 quasi-random sequence over the frame
  // index with a per-pixel Cranley-Patterson rotation. Successive samples
  // cover the pixel footprint evenly instead of clumping like white noise,
  // so anti-aliasing / DOF edges / soft shadows converge visibly faster at
  // the same sample count than with pure RNG jitter.
  vec2 cpRot = vec2(
    float(wangHash(px.x * 1973u + px.y * 9277u + 71u)) / 4294967295.0,
    float(wangHash(px.x * 6151u + px.y * 4177u + 173u)) / 4294967295.0);
  vec2 jit = fract(vec2(0.7548776662467, 0.5698402909980) * float(uFrame) + cpRot);
  vec2 puv = (vUv * uRes + jit) / uRes * 2.0 - 1.0;
  puv.x *= uRes.x/uRes.y;
  vec3 dir = normalize(fwd + puv.x*tanH*right + puv.y*tanH*up);
  vec3 ro = uCamPos;
  if (uAperture > 0.0) {
    // Physical thin-lens: sample the iris (polygonal blades like a real
    // camera, or a perfect circle when uBlades < 3) and refocus on the
    // focal plane — genuine path-traced bokeh.
    vec2 lens = (uBlades >= 3.0 ? randPolygon(uBlades, uBladeRot) : randDisk()) * uAperture;
    // Keep iris area stable while applying an anamorphic squeeze.
    float squeeze = sqrt(max(0.01, uAnamorphic));
    lens *= vec2(squeeze, 1.0 / squeeze);
    // Focus distance is measured along the optical axis. Intersect the
    // primary ray with that focal plane instead of focusing on a sphere.
    float focalT = focus / max(0.0001, dot(dir, fwd));
    vec3 focal = uCamPos + dir * focalT;
    ro = uCamPos + right * lens.x + up * lens.y;
    dir = normalize(focal - ro);
  }

  // Diagnostic views. Mode 1 paints the first-hit SHADING normal; mode 2 paints
  // the barycentric-interpolated UV. A SMOOTH gradient means that attribute is
  // fine; solid-colour facets mean it's the culprit. This settles "normals vs
  // UV/barycentric" by eye instead of by argument.
  if (uDebugMode > 0.5) {
    Hit dh; dh.sphL = false;
    vec3 c = vec3(0.04);
    if (intersectScene(ro, dir, dh)) {
      int dmode = int(uDebugMode + 0.5);
      if (dmode == 2) c = vec3(fract(dh.uv), 0.0);   // UV  (smooth => barycentric OK)
      else if (dmode == 3) c = dh.albedo;            // texture/albedo ONLY, no lighting
      else            c = normalize(dh.n) * 0.5 + 0.5; // shading normal
    }
    outColor = vec4(c, 1.0);
    outAlbedo = vec4(c, 1.0);
    outNormalDepth = vec4(c, 0.0);
    outMoments = vec4(0.0);
    return;
  }

  vec3 prev = textureLod(uPrev, vUv, 0.0).rgb;
  vec4 prevAlbedo = textureLod(uPrevAlbedo, vUv, 0.0);
  vec4 prevNormalDepth = textureLod(uPrevNormalDepth, vUv, 0.0);
  vec4 prevMoments = textureLod(uPrevMoments, vUv, 0.0);

  // Offline adaptive sampling. Converged pixels keep their complete history,
  // while a small deterministic probe rate remains active so rare light paths
  // can still invalidate an apparently stable dark pixel.
  if (
    uAdaptiveSampling != 0 &&
    float(uFrame) >= uAdaptiveMinSamples &&
    prevMoments.w >= uAdaptiveMinSamples
  ) {
    float relError = sqrt(max(prevMoments.z, 0.0) / max(prevMoments.w, 1.0)) /
      max(abs(prevMoments.x), 0.05);
    if (relError <= uAdaptiveThreshold) {
      uint probeHash = wangHash(px.x * 7411u + px.y * 9151u + uint(uFrame) * 1013u);
      float probe = float(probeHash) / 4294967295.0;
      float keepRate = max(0.03, 1.0 - uAdaptiveStrength);
      if (probe > keepRate) {
        outColor = vec4(prev, 1.0);
        outAlbedo = prevAlbedo;
        outNormalDepth = prevNormalDepth;
        outMoments = prevMoments;
        return;
      }
    }
  }

  vec3 primaryAlbedo;
  vec3 primaryNormal;
  float primaryDepth;
  float primaryRoughness;
  vec3 pt = trace(
    ro,
    dir,
    primaryAlbedo,
    primaryNormal,
    primaryDepth,
    primaryRoughness
  );
  pt = max(pt, vec3(0.0));

  float f = float(uFrame);
  // Blend weight for the new sample: 1/(f+1) gives a true average that
  // converges to zero noise when static. uMinBlend floors it while the scene
  // is changing so the image keeps adapting (and never resets to one black
  // sample) instead of snapping to frame 0.
  // CRITICAL (offline noise bug): resetAccumulation() only zeroes the FRAME
  // counter — the GPU history targets keep the old viewport image, and frame 0
  // (alpha = 1) is what overwrites them. prevMoments.w is the PER-PIXEL sample
  // count, so on frame 0 it is STALE history (e.g. 512 after a converged
  // viewport). Carrying it into sampleCount made every offline sample blend at
  // 1/(stale+1) ≈ 1/500 — "Render still"/video stayed a 1-sample image while
  // the spp counter happily reached its target. Restart the per-pixel count
  // from zero on frame 0.
  float histCount = (uFrame == 0) ? 0.0 : prevMoments.w;
  float sampleCount = uAdaptiveSampling != 0 ? histCount + 1.0 : f + 1.0;
  float alpha = (uFrame == 0) ? 1.0 : max(1.0 / max(sampleCount, 1.0), uMinBlend);
  vec3 acc = mix(prev, pt, alpha);
  outColor = vec4(acc, 1.0);
  vec4 currentAlbedo = vec4(primaryAlbedo, primaryRoughness);
  vec4 currentNormalDepth = vec4(primaryNormal * 0.5 + 0.5, primaryDepth);
  outAlbedo = mix(prevAlbedo, currentAlbedo, alpha);
  outNormalDepth = mix(prevNormalDepth, currentNormalDepth, alpha);
  float lum = dot(pt, vec3(0.2126, 0.7152, 0.0722));
  float meanLum = mix(prevMoments.x, lum, alpha);
  float meanLum2 = mix(prevMoments.y, lum * lum, alpha);
  float variance = max(0.0, meanLum2 - meanLum * meanLum);
  outMoments = vec4(meanLum, meanLum2, variance, min(sampleCount, 65504.0));
}`;

const SHOW = `
precision highp float;
out vec4 outColor;
uniform sampler2D uAcc;
uniform sampler2D uAlbedo;
uniform sampler2D uNormalDepth;
uniform sampler2D uMoments;
uniform vec2 uRes;
uniform float uExposure;
uniform float uSharpen;
uniform float uSharpenLimit;
uniform float uEdgeProtection;
uniform float uNoiseProtection;
uniform int uAovMode;
uniform float uAdaptiveThreshold;
// Edge-preserving viewport denoise strength (0..1). Driven from JS: strong at
// low sample counts / while navigating, fades to 0 as the image converges —
// the same idea as the Cycles viewport denoiser.
uniform float uDenoise;
in vec2 vUv;
void main(){
  vec3 c = texture(uAcc, vUv).rgb;
  if (uAovMode == 1) {
    outColor = vec4(texture(uAlbedo, vUv).rgb, 1.0);
    return;
  }
  if (uAovMode == 2) {
    outColor = vec4(texture(uNormalDepth, vUv).rgb, 1.0);
    return;
  }
  if (uAovMode == 3) {
    float d = texture(uNormalDepth, vUv).a;
    float mapped = d > 0.0 ? 1.0 - exp(-d * 0.05) : 0.0;
    outColor = vec4(vec3(mapped), 1.0);
    return;
  }
  if (uAovMode == 4) {
    float variance = texture(uMoments, vUv).z;
    outColor = vec4(vec3(clamp(sqrt(max(variance, 0.0)), 0.0, 1.0)), 1.0);
    return;
  }
  if (uAovMode == 5) {
    float samples = texture(uMoments, vUv).w;
    outColor = vec4(vec3(1.0 - exp(-samples / 64.0)), 1.0);
    return;
  }
  if (uAovMode == 6) {
    vec4 m = texture(uMoments, vUv);
    float relError = sqrt(max(m.z, 0.0) / max(m.w, 1.0)) / max(abs(m.x), 0.05);
    float converged = relError <= uAdaptiveThreshold ? 1.0 : 0.0;
    outColor = vec4(1.0 - converged, converged, 0.0, 1.0);
    return;
  }
  if (uDenoise > 0.001) {
    vec2 px = 1.0 / uRes;
    float lc = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 sum = c;
    float wsum = 1.0;
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        if (dx == 0 && dy == 0) continue;
        vec2 off = vec2(float(dx), float(dy));
        vec3 s = texture(uAcc, vUv + off * px).rgb;
        float ls = dot(s, vec3(0.299, 0.587, 0.114));
        // Luminance-bilateral: blur noise, keep edges/highlights.
        float wl = exp(-abs(ls - lc) * 6.0);
        float wd = exp(-dot(off, off) * 0.28);
        float w = wl * wd;
        sum += s * w;
        wsum += w;
      }
    }
    c = mix(c, sum / wsum, uDenoise);
  }
  if (uSharpen > 0.001) {
    vec2 px = 1.0 / uRes;
    vec3 n0 = texture(uAcc, vUv + vec2(px.x, 0.0)).rgb;
    vec3 n1 = texture(uAcc, vUv - vec2(px.x, 0.0)).rgb;
    vec3 n2 = texture(uAcc, vUv + vec2(0.0, px.y)).rgb;
    vec3 n3 = texture(uAcc, vUv - vec2(0.0, px.y)).rgb;
    vec3 blur4 = (n0 + n1 + n2 + n3) * 0.25;
    vec3 lo = min(c, min(min(n0, n1), min(n2, n3)));
    vec3 hi = max(c, max(max(n0, n1), max(n2, n3)));
    float lLo = dot(lo, vec3(0.2126, 0.7152, 0.0722));
    float lHi = dot(hi, vec3(0.2126, 0.7152, 0.0722));
    float localContrast = (lHi - lLo) / max(lHi + lLo, 0.05);
    vec4 moments = texture(uMoments, vUv);
    float relativeNoise = sqrt(max(moments.z, 0.0)) / max(abs(moments.x), 0.05);
    float edgeGuard = 1.0 / (1.0 + localContrast * max(0.0, uEdgeProtection));
    float noiseGuard = 1.0 - clamp(relativeNoise * max(0.0, uNoiseProtection), 0.0, 1.0);
    vec3 range = max(hi - lo, vec3(0.001));
    vec3 correction = clamp(
      (c - blur4) * uSharpen * edgeGuard * noiseGuard,
      -range * uSharpenLimit,
      range * uSharpenLimit
    );
    c = clamp(c + correction, lo - range * 0.03, hi + range * 0.03);
  }
  c *= uExposure;
  outColor = vec4(c, 1.0);
}`;

// Edge-aware À-TROUS wavelet iteration (Dammertz et al. 2010) — the spatial
// core of SVGF. A 5x5 B3-spline kernel "with holes": uStep doubles each
// iteration (1 -> 2 -> 4), so three passes cover a 17x17 footprint at a
// constant 25 taps/pass. The luminance edge-stop keeps silhouettes, texture
// edges and highlights intact while the noise between them is averaged away.
const ATROUS = `
precision highp float;
out vec4 outColor;
uniform sampler2D uTex;
uniform sampler2D uAlbedo;
uniform sampler2D uNormalDepth;
uniform sampler2D uMoments;
uniform vec2 uRes;
uniform float uStep;
uniform float uSigma;
uniform float uStrength;
uniform float uNormalSensitivity;
uniform float uDepthSensitivity;
uniform float uAlbedoSensitivity;
uniform float uDetailPreservation;
in vec2 vUv;
void main(){
  vec2 px = uStep / uRes;
  vec3 c = texture(uTex, vUv).rgb;
  vec4 ac = texture(uAlbedo, vUv);
  vec4 ndc = texture(uNormalDepth, vUv);
  vec3 nc = normalize(ndc.rgb * 2.0 - 1.0);
  float dc = ndc.a;
  vec4 mc = texture(uMoments, vUv);
  float lc = dot(c, vec3(0.299, 0.587, 0.114));
  float k[3] = float[3](0.375, 0.25, 0.0625); // B3-spline 1D weights
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 uv = clamp(vUv + vec2(float(dx), float(dy)) * px, vec2(0.001), vec2(0.999));
      vec3 s = texture(uTex, uv).rgb;
      vec4 as = texture(uAlbedo, uv);
      vec4 nds = texture(uNormalDepth, uv);
      vec3 ns = normalize(nds.rgb * 2.0 - 1.0);
      float ds = nds.a;
      float ls = dot(s, vec3(0.299, 0.587, 0.114));
      float wk = k[dx < 0 ? -dx : dx] * k[dy < 0 ? -dy : dy];
      float noise = sqrt(max(mc.z, 0.0));
      float lumSigma = max(uSigma, noise * 1.5 + 0.01);
      float wl = exp(-abs(ls - lc) / lumSigma);
      float wn = dc <= 0.0 || ds <= 0.0
        ? (abs(dc - ds) < 1e-4 ? 1.0 : 0.0)
        : exp(-max(0.0, 1.0 - dot(nc, ns)) * uNormalSensitivity);
      float depthScale = max(0.015, max(dc, ds) * 0.012 * max(1.0, uStep)) /
        max(0.1, uDepthSensitivity);
      float wd = dc <= 0.0 || ds <= 0.0
        ? (abs(dc - ds) < 1e-4 ? 1.0 : 0.0)
        : exp(-abs(ds - dc) / depthScale);
      float wa = exp(-length(as.rgb - ac.rgb) * uAlbedoSensitivity);
      // Glossy/specular surfaces need a stricter normal stop than rough ones.
      float roughGuide = mix(0.55, 1.0, clamp(ac.a, 0.0, 1.0));
      float guide = wn * wd * wa;
      float w = wk * wl * mix(1.0, guide, roughGuide * uDetailPreservation);
      sum += s * w;
      wsum += w;
    }
  }
  float relativeNoise = sqrt(max(mc.z, 0.0)) / max(abs(mc.x), 0.05);
  float adaptive = clamp(relativeNoise * 1.8 + 0.15, 0.0, 1.0) * uStrength;
  outColor = vec4(mix(c, sum / max(wsum, 1e-6), adaptive), 1.0);
}`;

function makeFloatTarget(w, h, attachmentCount = 1) {
  // LinearFilter so the SHOW pass can cheaply upscale a lower internal
  // render resolution to the display size. During ping-pong accumulation the
  // two targets are identical in size and sampled at exact texel centres, so
  // linear filtering returns the same value as nearest there (no drift).
  //
  // HalfFloat (RGBA16F), НЕ Float (RGBA32F): рендер у RGBA32F + лінійна
  // фільтрація вимагає OES_texture_float_linear, якого на слабших/інтегрованих
  // GPU немає або він украй повільний → зависання trace-кадру довше за
  // GPU-вотчдог → краш контексту (падали обидва контексти = краш GPU-процесу).
  // RGBA16F вдвічі легший за пропускною здатністю, а лінійна фільтрація half-
  // float гарантована ядром WebGL2. Точності 16F досить для прев'ю-акумуляції.
  const target = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    count: Math.max(1, attachmentCount),
  });
  const names = ["beauty", "albedoRoughness", "normalDepth", "moments"];
  target.textures.forEach((texture, index) => {
    texture.name = `PatchRTX.${names[index] || `aov${index}`}`;
  });
  return target;
}

// Plain pass-through copy used to seed a freshly allocated accumulation
// buffer from the previous one, so a resolution change never flashes black.
const COPY = `
precision highp float;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAlbedo;
layout(location = 2) out vec4 outNormalDepth;
layout(location = 3) out vec4 outMoments;
uniform sampler2D uSrc;
uniform sampler2D uSrcAlbedo;
uniform sampler2D uSrcNormalDepth;
uniform sampler2D uSrcMoments;
in vec2 vUv;
void main(){
  outColor = texture(uSrc, vUv);
  outAlbedo = texture(uSrcAlbedo, vUv);
  outNormalDepth = texture(uSrcNormalDepth, vUv);
  outMoments = texture(uSrcMoments, vUv);
}`;

// Single-attachment bridge used only when an auxiliary-guide OIDN model is
// available. WebGLRenderer cannot select an MRT attachment in
// readRenderTargetPixels(), so albedo and normal are blitted one at a time to
// an RGBA8 target and read back without disturbing the visible framebuffer.
const AOV_READBACK = `
precision highp float;
out vec4 outColor;
uniform sampler2D uSource;
in vec2 vUv;
void main(){ outColor = vec4(clamp(texture(uSource, vUv).rgb, 0.0, 1.0), 1.0); }
`;

export class PatchRtxPass extends Pass {
  static isSupported(renderer) {
    return !!(
      renderer?.capabilities?.isWebGL2 &&
      renderer.extensions.has("EXT_color_buffer_float")
    );
  }

  constructor(scene, camera, skyMeshes = []) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.skyMeshes = Array.isArray(skyMeshes) ? skyMeshes : [skyMeshes];
    this.enabled = false;
    this.needsSwap = true;
    this.clear = true;

    this.frame = 0;
    this.bounces = 8;
    this.exposure = 1.0;
    // RtxLensSystem is the authoritative owner. These fields remain only as
    // a safe compatibility fallback until a lens system is bound.
    this.lensSystem = null;
    // Real-lens (bokeh) controls — driven by the RTX Lens UI panel.
    this.lensAperture = 0;
    this.focusDist = 12;
    this.blades = 6;          // aperture blade count (0/1/2 = circle)
    this.bladeRot = 0.3;      // blade rotation, radians
    this.anamorphic = 1.0;
    this._lastSig = "";
    this._supported = false;
    this._buildInFlight = false;
    this._pendingRebuild = false;
    this.engine = new RTXEngine(null);
    this._renderer = null;

    // ---- Temporal-accumulation soft reset ----------------------------------
    // Instead of snapping the accumulator to a black frame 0 on every scene
    // change, we hold a short "dirty" window during which the newest sample is
    // floored to DIRTY_BLEND. The image fades to the new state over a handful
    // of frames; once static again it converges fully (alpha -> 0).
    this._dirtyFrames = 0;

    // ---- Cycles-style interactive navigation --------------------------------
    // While the camera (or any light/sky setting) is changing we render a fast
    // preview: half internal resolution, 2 bounces, NO history blending — the
    // image follows instantly with zero ghosting. Once the camera settles, the
    // viewport behaves like Blender/Cycles: full bounce budget, stable history,
    // and a true 1/(sample+1) progressive average.
    this._interactive = false;
    this._motionUntil = 0;
    this._lastCamState = null;
    this._lastCamSig = "";
    this._settleDelayMs = 360;
    this.viewportAccumulate = true;
    this._viewportMaxSamples = 512;
    this._viewportPassesPerFrame = 4;
    this._interactiveScale = 0.5;

    // Edge-preserving viewport denoise (strong at low sample counts, fades
    // out as the image converges). Toggleable from the UI.
    this.denoise = true;
    // User-tunable denoise strength multiplier (RTX engine panel). 1.0 = the
    // default Cycles-style curve; <1 keeps more detail/noise, >1 blurs harder.
    this.denoiseStrength = 1.0;

    // ---- "Reset only on camera" accumulation policy -------------------------
    // With physics running, hair/skirt micro-sway changed the pose hash EVERY
    // frame -> updateDynamic() refit -> frame capped to 8 -> the viewport
    // NEVER converged. When this flag is on (default), the host skips dynamic
    // geometry refits while the camera is settled and nothing is playing:
    // the geometry snapshot freezes and samples build to a clean image, like
    // pausing the viewport in Blender. Camera motion resumes live refits.
    this.freezeSceneWhileStill = true;

    // ---- Final-frame denoise for offline video/stills -----------------------
    // The viewport denoise curve fades to 0 as samples grow, so a 128 spp
    // video frame got NO denoising and kept residual grain. During offline
    // rendering the edge-preserving filter runs at this fixed strength on the
    // final converged frame instead.
    this.renderingVideo = false;
    this.finalDenoise = 0.4;
    this.denoiseBackend = "guided-classic";
    this.normalSensitivity = 48;
    this.depthSensitivity = 1;
    this.albedoSensitivity = 10;
    this.detailPreservation = 0.75;
    this.sharpen = 0.2;
    this.sharpenLimit = 0.35;
    this.edgeProtection = 2.0;
    this.noiseProtection = 1.5;
    this.aovMode = 0;
    this.adaptiveSampling = true;
    this.adaptiveMinSamples = 24;
    this.adaptiveThreshold = 0.04;
    this.adaptiveStrength = 0.82;
    this.roughnessFloor = 0.04;

    // ---- RTX-internal adaptive resolution (its own optimiser) --------------
    // Path tracing cost scales with the accumulation buffer size, so on slow
    // hardware we render the trace at a fraction of the display size and let
    // the SHOW pass upscale. This is decoupled from the global perf-governor
    // DPR (which must NOT churn while RTX is on, or it resets accumulation).
    this.dynScale = 1.0;
    this._dynAuto = true;
    this._dynMin = 0.4;
    this._dynLowFps = 28;
    this._dynHighFps = 52;
    this._dynLast = 0;
    this.rW = 2;
    this.rH = 2;

    // ---- Per-draw-call budget (анти-TDR / анти-CONTEXT_LOST) ----------------
    // Трасування цілого кадру одним draw call на слабкому/інтегрованому GPU
    // перевищує GPU-вотчдог (~2 с на Windows) → драйвер скидається → втрата
    // контексту. Рішення: у converged-режимі кадр трасується ГОРИЗОНТАЛЬНИМИ
    // СМУГАМИ — одна смуга за кадр (scissor), решта зберігається копією з
    // попереднього буфера. Так вартість ОДНОГО draw call обмежена незалежно
    // від роздільності й потужності GPU. В interactive-режимі кадр рендериться
    // цілком, але внутрішня роздільність обмежується тим самим бюджетом.
    this._maxDrawPixels = 100000; // ~400×250 px на один trace-виклик (запас під слабкий GPU; тюниться)
    this._tileIndex = 0;
    this._viewportTileFrameBudget = 240000;

    // ---- Async shader pre-warm (анти-фриз / анти-CONTEXT_LOST) --------------
    // Компіляція trace-шейдера — найдорожча GL-операція в пасі. Якщо робити її
    // ліниво на ПЕРШОМУ кадрі RTX, головний потік зависає на секунди (а на
    // слабкому драйвері перший важкий кадр + свіжолінкована програма перевищує
    // GPU-вотчдог → CONTEXT_LOST). Тому програму компілюємо заздалегідь через
    // renderer.compileAsync (KHR_parallel_shader_compile) у фоні під час
    // завантаження сцени — перший кадр RTX уже бере готову залінковану програму.
    this._shadersReady = false;
    this._prewarming = false;

    this._camPos = new THREE.Vector3();
    this._camTarget = new THREE.Vector3();
    this._sunDir = new THREE.Vector3(0, 1, 0);
    this._sunColor = new THREE.Color(1, 1, 1);
    this._rimDir = new THREE.Vector3(-1, 0, 0);
    this._rimColor = new THREE.Color(0.37, 0.66, 1);
    this._fillDir = new THREE.Vector3(0, 0, 1);
    this._fillColor = new THREE.Color(1, 0.64, 0.42);
    this._tmpCol = new THREE.Color();
    // Scene-driven sky colours (computed each frame from the viewer's sky).
    this._skyTop = new THREE.Color(0.18, 0.34, 0.72);
    this._skyBot = new THREE.Color(0.78, 0.84, 0.96);
    this._skyGround = new THREE.Color(0.2, 0.18, 0.16);
    this._skyFlatColor = new THREE.Color(0.12, 0.12, 0.16);
    this._fogColor = new THREE.Color(0.8, 0.8, 0.82);
    this._skyTmp = new THREE.Color();
    this._mapLightPos = Array.from(
      { length: MAX_MAP_LIGHTS },
      () => new THREE.Vector3(),
    );
    this._mapLightEmit = Array.from(
      { length: MAX_MAP_LIGHTS },
      () => new THREE.Vector3(),
    );
    this._mapLightRad = new Float32Array(MAX_MAP_LIGHTS);
    this.lightSampler = new RtxLightSampler(MAX_MAP_LIGHTS);
    this._mapLightCdf = this.lightSampler.cdf;
    this._mapLightSelectPdf = this.lightSampler.pdf;

    this.traceUniforms = {
      uRes: { value: new THREE.Vector2(2, 2) },
      uFrame: { value: 0 },
      uPrev: { value: null },
      uPrevAlbedo: { value: null },
      uPrevNormalDepth: { value: null },
      uPrevMoments: { value: null },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 200 },
      uCamPos: { value: this._camPos },
      uCamTarget: { value: this._camTarget },
      uFov: { value: 35 },
      uAperture: { value: 0.06 },
      uFocusDist: { value: 0 },
      uBlades: { value: 6 },
      uBladeRot: { value: 0.3 },
      uAnamorphic: { value: 1.0 },
      uSunDir: { value: this._sunDir },
      uSunColor: { value: this._sunColor },
      uSunWeight: { value: 1 },
      uSunSoft: { value: 0.03 },
      uRimDir: { value: this._rimDir },
      uRimColor: { value: this._rimColor },
      uRimWeight: { value: 0.75 },
      uFillDir: { value: this._fillDir },
      uFillColor: { value: this._fillColor },
      uFillWeight: { value: 0.35 },
      uSkyTop: { value: this._skyTop },
      uSkyBot: { value: this._skyBot },
      uSkyGround: { value: this._skyGround },
      uSkyStrength: { value: 1.0 },
      uSkyFlat: { value: 0.0 },
      uSkyFlatColor: { value: this._skyFlatColor },
      uFogColor: { value: this._fogColor },
      uFogAmt: { value: 0.0 },
      uMinBlend: { value: 0.0 },
      uAdaptiveSampling: { value: 0 },
      uAdaptiveMinSamples: { value: 24 },
      uAdaptiveThreshold: { value: 0.04 },
      uAdaptiveStrength: { value: 0.82 },
      uInteractive: { value: 0 },
      uBounces: { value: 8 },
      uMapLightCount: { value: 0 },
      uMapLightPos: { value: this._mapLightPos.map((v) => v.clone()) },
      uMapLightEmit: { value: this._mapLightEmit.map((v) => v.clone()) },
      uMapLightRad: { value: this._mapLightRad },
      uMapLightCdf: { value: this._mapLightCdf },
      uMapLightSelectPdf: { value: this._mapLightSelectPdf },
      uDirectSunPdf: { value: 1.0 },
      uMaxRadiance: { value: 18.0 },
      uRoughnessFloor: { value: 0.04 },
      uSceneReady: { value: 0 },
      uPageCount: { value: 0 },
      uTriData: { value: null },
      uMatData: { value: null },
      uBvhNodes: { value: null },
      uAtlas: { value: null },
      uTexLod: { value: 0.0 },
      uDebugMode: { value: 0.0 },
      uNoSphere: { value: 0.0 },
      uNoShadow: { value: 0.0 },
      uFlatLod: { value: 0.0 },
      uSmoothGI: { value: 1.0 },
      uTexSize: { value: 1024 },
      uTriCount: { value: 0 },
      uNodeCount: { value: 0 },
      uMatCount: { value: 0 },
      uTriTexSize: { value: new THREE.Vector2(1, 1) },
      uBvhTexSize: { value: new THREE.Vector2(1, 1) },
      uMatTexSize: { value: new THREE.Vector2(1, 1) },
      // Multi-page (filled in bindUniforms when pages > 1)
      uTriDataPages: { value: [null, null, null, null] },
      uBvhNodesPages: { value: [null, null, null, null] },
      uTriTexSizePages: {
        value: Array.from({ length: 4 }, () => new THREE.Vector2(1, 1)),
      },
      uBvhTexSizePages: {
        value: Array.from({ length: 4 }, () => new THREE.Vector2(1, 1)),
      },
      uTriCountPages: { value: [0, 0, 0, 0] },
      uNodeCountPages: { value: [0, 0, 0, 0] },
    };

    this.showUniforms = {
      uAcc: { value: null },
      uAlbedo: { value: null },
      uNormalDepth: { value: null },
      uMoments: { value: null },
      uRes: { value: new THREE.Vector2(2, 2) },
      uExposure: { value: 1 },
      uDenoise: { value: 0 },
      uSharpen: { value: 0.2 },
      uSharpenLimit: { value: 0.35 },
      uEdgeProtection: { value: 2.0 },
      uNoiseProtection: { value: 1.5 },
      uAovMode: { value: 0 },
      uAdaptiveThreshold: { value: 0.04 },
    };

    this.traceMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.traceUniforms,
      vertexShader: VERT,
      fragmentShader: TRACE,
      depthTest: false,
      depthWrite: false,
    });
    this.showMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.showUniforms,
      vertexShader: VERT,
      fragmentShader: SHOW,
      depthTest: false,
      depthWrite: false,
    });
    this.traceQuad = new FullScreenQuad(this.traceMat);
    this.showQuad = new FullScreenQuad(this.showMat);
    this.copyUniforms = {
      uSrc: { value: null },
      uSrcAlbedo: { value: null },
      uSrcNormalDepth: { value: null },
      uSrcMoments: { value: null },
    };
    this.copyMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.copyUniforms,
      vertexShader: VERT,
      fragmentShader: COPY,
      depthTest: false,
      depthWrite: false,
    });
    this.copyQuad = new FullScreenQuad(this.copyMat);

    this._aovReadbackUniforms = { uSource: { value: null } };
    this._aovReadbackMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this._aovReadbackUniforms,
      vertexShader: VERT,
      fragmentShader: AOV_READBACK,
      depthTest: false,
      depthWrite: false,
    });
    this._aovReadbackQuad = new FullScreenQuad(this._aovReadbackMat);
    this._aovReadbackTarget = null;
    this._aovGuideCanvases = { albedo: null, normal: null };

    // À-trous (SVGF-lite) viewport denoiser: ping-pong targets + material.
    this.atrousUniforms = {
      uTex: { value: null },
      uAlbedo: { value: null },
      uNormalDepth: { value: null },
      uMoments: { value: null },
      uRes: { value: new THREE.Vector2(2, 2) },
      uStep: { value: 1 },
      uSigma: { value: 0.3 },
      uStrength: { value: 1.0 },
      uNormalSensitivity: { value: 48 },
      uDepthSensitivity: { value: 1 },
      uAlbedoSensitivity: { value: 10 },
      uDetailPreservation: { value: 0.75 },
    };
    this.atrousMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.atrousUniforms,
      vertexShader: VERT,
      fragmentShader: ATROUS,
      depthTest: false,
      depthWrite: false,
    });
    this.atrousQuad = new FullScreenQuad(this.atrousMat);
    this._dnA = null;
    this._dnB = null;

    this.accA = null;
    this.accB = null;
    this.W = 2;
    this.H = 2;
  }

  init(renderer) {
    this._supported = PatchRtxPass.isSupported(renderer);
    this.engine.renderer = renderer;
    this._renderer = renderer;
    this.lensSystem?.markRendererReinitialized?.();
    if (this._supported) {
      this.setSize(renderer.domElement.width, renderer.domElement.height);
      // Compile the (expensive) trace program ahead of time, off the critical
      // path, so toggling RTX later never stalls the main thread or trips the
      // GPU watchdog with a cold compile. Deferred a tick so it can never delay
      // the first paint of the raster scene.
      setTimeout(() => this.prewarm(), 0);
    }
    return this._supported;
  }

  /**
   * Pre-compile the trace / show / copy programs without blocking the main
   * thread. Uses renderer.compileAsync (which polls KHR_parallel_shader_compile
   * when present) so the cold trace-shader compile happens on driver threads and
   * resolves only once the program is fully linked. Safe to call before the BVH
   * exists — program compilation does not depend on texture contents.
   * @returns {Promise<void>}
   */
  async prewarm() {
    if (this._shadersReady || this._prewarming) return;
    if (!this._supported || !this._renderer) return;
    this._prewarming = true;
    const tmp = new THREE.Scene();
    // Compile every material that can be reached by the first RTX frame.  The
    // guided A-trous program used to remain cold until denoise first became
    // active, causing a visible hitch (or a watchdog reset on weak drivers).
    const meshes = [
      this.traceQuad,
      this.showQuad,
      this.copyQuad,
      this.atrousQuad,
      this._aovReadbackQuad,
    ]
      .map((q) => q && q._mesh)
      .filter(Boolean);
    try {
      for (const m of meshes) tmp.add(m);
      if (typeof this._renderer.compileAsync === "function") {
        await this._renderer.compileAsync(tmp, this.camera);
      } else {
        this._renderer.compile(tmp, this.camera);
      }
    } catch (_e) {
      // Non-fatal: the first render() will compile synchronously instead.
    } finally {
      // Detach the quads so FullScreenQuad keeps owning/rendering them.
      for (const m of meshes) {
        try {
          tmp.remove(m);
        } catch (_e2) {}
      }
      this._shadersReady = true;
      this._prewarming = false;
    }
  }

  get supported() {
    return this._supported;
  }
  get samples() {
    return this.frame;
  }

  applyQualityPreset(id) {
    const preset = cloneQualityPreset(id);
    this.qualityPreset = preset.id;
    this.bounces = preset.bounces;
    this.finalDenoise = preset.denoiseStrength;
    this.denoiseBackend = preset.denoiseBackend;
    this.detailPreservation = preset.detailPreservation;
    this.sharpen = preset.sharpen;
    this.adaptiveSampling = preset.adaptive;
    this.adaptiveThreshold = preset.varianceThreshold;
    this._dynAuto = preset.adaptiveResolution;
    if (preset.normalSensitivity != null) this.normalSensitivity = preset.normalSensitivity;
    if (preset.depthSensitivity != null) this.depthSensitivity = preset.depthSensitivity;
    if (preset.albedoSensitivity != null) this.albedoSensitivity = preset.albedoSensitivity;
    if (preset.roughnessFloor != null) this.roughnessFloor = preset.roughnessFloor;
    this.resetAccumulation(true);
    return preset;
  }

  getDiagnostics() {
    return {
      supported: this._supported,
      samples: this.frame,
      internalResolution: [this.rW, this.rH],
      displayResolution: [this.W, this.H],
      aovCount: this.accB?.textures?.length || 0,
      denoiseBackend: this.denoiseBackend,
      adaptiveSampling: this.renderingVideo && this.adaptiveSampling,
      adaptiveThreshold: this.adaptiveThreshold,
      lightSampler: this.lightSampler.snapshot(),
      lens: this.lensSystem?.getDiagnostics?.() || null,
      memory: estimateRtxVramBytes(this.rW, this.rH, {
        denoise: this.denoise,
        oidnGuides: this.denoiseBackend === "oidn-auto",
      }),
    };
  }

  setLensSystem(lensSystem) {
    this.lensSystem = lensSystem || null;
    if (this.lensSystem) {
      this.lensSystem.bindCamera?.(this.camera);
      this.lensSystem.bindPass?.(this);
      if (this._renderer) this.lensSystem.markRendererReinitialized?.();
    }
    this.resetAccumulation(true);
    return this.lensSystem;
  }

  /**
   * Rebuild BVH + GPU buffers from the current Three.js scene.
   * Safe to call from the main thread: BVH build runs in chunks via
   * `setTimeout(0)` to avoid blocking the UI for huge scenes.
   * @param {(obj:THREE.Object3D)=>boolean} [extraExclude]
   */
  rebuildScene(extraExclude) {
    if (this._buildInFlight) {
      this._pendingRebuild = true;
      return false;
    }
    this._buildInFlight = true;
    const doBuild = () => {
      try {
        const ok = this.engine.rebuildFromScene(this.scene, {
          excludeRoots: this.skyMeshes,
          extraExclude,
        });
        if (ok) {
          this.engine.bindUniforms(this.traceUniforms);
          this.resetAccumulation();
        } else {
          console.warn(
            "[RTX] Scene BVH build produced no geometry — leaving previous state.",
          );
        }
      } catch (err) {
        console.error("[RTX] Scene BVH build failed:", err);
      } finally {
        this._buildInFlight = false;
        if (this._pendingRebuild) {
          this._pendingRebuild = false;
          // Re-trigger on next tick.
          setTimeout(() => this.rebuildScene(extraExclude), 0);
        }
      }
    };
    // Defer to next event-loop tick so the UI doesn't freeze.
    setTimeout(doBuild, 0);
    return false;
  }

  /** Rebuild if dirty; returns true when geometry uploaded. */
  rebuildIfDirty(extraExclude) {
    const changed = this.engine.rebuildIfNeeded(this.scene, {
      excludeRoots: this.skyMeshes,
      extraExclude,
    });
    if (changed) {
      this.engine.bindUniforms(this.traceUniforms);
      this.resetAccumulation();
    }
    return changed;
  }

  /** Update skinned/animated pose without full BVH rebuild. */
  updateDynamic(extraExclude) {
    try {
      const ok = this.engine.updateDynamic(this.scene, {
        excludeRoots: this.skyMeshes,
        extraExclude,
      });
      if (ok) {
        this.engine.bindUniforms(this.traceUniforms);
        // Geometry actually moved (dancing character, dragged prop): open a
        // short adaptation window so the moving mesh doesn't smear long
        // trails into the converged history.
        this._dirtyFrames = Math.max(this._dirtyFrames, 12);
        this.frame = Math.min(this.frame, 8);
      }
      return ok;
    } catch (err) {
      console.error(
        "[RTX] Dynamic update failed, falling back to full rebuild:",
        err,
      );
      return this.rebuildScene(extraExclude);
    }
  }

  _allocateAcc(w, h) {
    const W = Math.max(2, w);
    const H = Math.max(2, h);
    if (W === this.W && H === this.H && this.accA) return;
    this.W = W;
    this.H = H;
    this._reallocRender(false);
  }

  /** Lazily (re)allocate the à-trous ping-pong targets at the render size. */
  _ensureDnTargets() {
    if (this._dnA && this._dnA.width === this.rW && this._dnA.height === this.rH) return;
    this._dnA?.dispose();
    this._dnB?.dispose();
    this._dnA = makeFloatTarget(this.rW, this.rH);
    this._dnB = makeFloatTarget(this.rW, this.rH);
  }

  /**
   * (Re)allocate the accumulation targets at the current internal render
   * resolution (display size * dynScale). Seeds the new "previous" buffer
   * from the old one via a cheap copy so a resolution change never shows a
   * black frame.
   * @param {boolean} seedFromOld
   */
  /** Internal render scale: perf-governor scale x interactive preview scale. */
  _effScale() {
    return this.dynScale * (this._interactive ? this._interactiveScale : 1.0);
  }

  _reallocRender(seedFromOld = true) {
    const eff = this._effScale();
    let rW = Math.max(2, Math.round(this.W * eff));
    let rH = Math.max(2, Math.round(this.H * eff));
    // Стеля внутрішньої роздільності. У converged-режимі кадр б'ється на смуги
    // (render()), тож повна роздільність дозволена до загального бюджету
    // _maxTracePixels. В interactive кадр рендериться ЦІЛКОМ одним викликом,
    // тому його роздільність обмежуємо бюджетом одного draw call (_maxDrawPixels),
    // щоб не перевищити GPU-вотчдог. SHOW-пас масштабує до екрана.
    const cap = this._interactive
      ? this._maxDrawPixels || 150000
      : this._maxTracePixels || 1300000;
    const px = rW * rH;
    if (px > cap) {
      const k = Math.sqrt(cap / px);
      rW = Math.max(2, Math.round(rW * k));
      rH = Math.max(2, Math.round(rH * k));
    }
    if (rW === this.rW && rH === this.rH && this.accA) return;

    const oldB = this.accB; // last accumulated result (the "prev" buffer)
    const newA = makeFloatTarget(rW, rH, 4);
    const newB = makeFloatTarget(rW, rH, 4);

    if (seedFromOld && oldB && this._renderer) {
      try {
        const prevTarget = this._renderer.getRenderTarget();
        this.copyUniforms.uSrc.value = oldB.textures[0];
        this.copyUniforms.uSrcAlbedo.value = oldB.textures[1];
        this.copyUniforms.uSrcNormalDepth.value = oldB.textures[2];
        this.copyUniforms.uSrcMoments.value = oldB.textures[3];
        this._renderer.setRenderTarget(newB);
        this.copyQuad.render(this._renderer);
        this._renderer.setRenderTarget(prevTarget);
      } catch (_e) {}
    }

    this.accA?.dispose();
    this.accB?.dispose();
    this.accA = newA;
    this.accB = newB;
    // denoise ping-pong targets follow the render size lazily
    this._dnA?.dispose();
    this._dnB?.dispose();
    this._dnA = null;
    this._dnB = null;
    this.rW = rW;
    this.rH = rH;
    this.traceUniforms.uRes.value.set(rW, rH);
    this.showUniforms.uRes.value.set(rW, rH);
    // We seeded a valid image into accB, so don't snap to a black frame 0 —
    // continue accumulating with a short adaptation window instead.
    if (seedFromOld && oldB) {
      this.frame = Math.max(1, this.frame);
      this._dirtyFrames = 24;
    } else {
      this.frame = 0;
    }
    this._lastSig = "";
  }

  /** GPU-resident AOV handles for diagnostics and downstream render stages. */
  getAovTextures() {
    const rt = this.accB;
    return rt
      ? {
          beauty: rt.textures[0],
          albedoRoughness: rt.textures[1],
          normalDepth: rt.textures[2],
          moments: rt.textures[3],
          width: this.rW,
          height: this.rH,
          samples: this.frame,
        }
      : null;
  }

  /**
   * Read only the auxiliary OIDN guides. The beauty input remains the fully
   * composed renderer canvas, preserving the existing export/post chain.
   * Returned canvases are reused, vertically corrected, and exactly match the
   * requested output dimensions.
   */
  readDenoiseGuides(renderer = this._renderer, width, height) {
    if (!renderer || !this.accB || typeof document === "undefined") return null;
    const w = Math.max(2, Math.floor(width || renderer.domElement?.width || this.rW));
    const h = Math.max(2, Math.floor(height || renderer.domElement?.height || this.rH));
    if (
      !this._aovReadbackTarget ||
      this._aovReadbackTarget.width !== w ||
      this._aovReadbackTarget.height !== h
    ) {
      this._aovReadbackTarget?.dispose();
      this._aovReadbackTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.UnsignedByteType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      });
      this._aovReadbackTarget.texture.name = "PatchRTX.oidnGuideReadback";
    }

    const previousTarget = renderer.getRenderTarget();
    const hadScissor = renderer.getScissorTest?.() || false;
    const bytes = new Uint8Array(w * h * 4);
    const renderGuide = (name, texture) => {
      let canvas = this._aovGuideCanvases[name];
      if (!canvas) canvas = this._aovGuideCanvases[name] = document.createElement("canvas");
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      this._aovReadbackUniforms.uSource.value = texture;
      renderer.setScissorTest(false);
      renderer.setRenderTarget(this._aovReadbackTarget);
      this._aovReadbackQuad.render(renderer);
      renderer.readRenderTargetPixels(this._aovReadbackTarget, 0, 0, w, h, bytes);
      const flipped = new Uint8ClampedArray(bytes.length);
      const row = w * 4;
      for (let y = 0; y < h; y++) {
        flipped.set(bytes.subarray((h - 1 - y) * row, (h - y) * row), y * row);
      }
      canvas
        .getContext("2d", { willReadFrequently: true })
        .putImageData(new ImageData(flipped, w, h), 0, 0);
      return canvas;
    };

    try {
      return {
        albedo: renderGuide("albedo", this.accB.textures[1]),
        normal: renderGuide("normal", this.accB.textures[2]),
        width: w,
        height: h,
        samples: this.frame,
      };
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.setScissorTest(hadScissor);
    }
  }

  setSize(width, height) {
    if (!this._supported) return;
    const W = Math.max(2, Math.floor(width));
    const H = Math.max(2, Math.floor(height));
    this._allocateAcc(W, H);
  }

  /**
   * RTX's own performance optimiser. Called with the measured FPS; adjusts the
   * internal render scale with strong hysteresis + a long cooldown so it
   * settles instead of oscillating (which is what made the global DPR governor
   * flash the screen). Lowering scale keeps accumulation alive — no reset to
   * black — because the new buffer is seeded from the old one.
   */
  reportPerf(fps, now = performance.now()) {
    if (!this._dynAuto || !this._supported || !this.accA) return;
    // The interactive preview renders at half scale with 2 bounces — its FPS
    // says nothing about the converged-mode cost, so don't tune on it.
    if (this._interactive) return;
    if (now - this._dynLast < 1400) return;
    let s = this.dynScale;
    if (fps < this._dynLowFps && s > this._dynMin) {
      s = Math.max(this._dynMin, s - 0.15);
    } else if (fps > this._dynHighFps && s < 1.0) {
      s = Math.min(1.0, s + 0.15);
    }
    s = Math.round(s * 100) / 100;
    if (Math.abs(s - this.dynScale) > 0.001) {
      this.dynScale = s;
      this._dynLast = now;
      this._reallocRender(true);
    }
  }

  setAdaptive(on) {
    this._dynAuto = !!on;
    if (!on && this.dynScale !== 1.0) {
      this.dynScale = 1.0;
      this._reallocRender(true);
    }
  }

  resetAccumulation(hard = false) {
    this.frame = 0;
    this._tileIndex = 0;
    // hard=true: TRUE 1/(N+1) average from sample 0 with NO min-blend floor.
    // The soft window (uMinBlend 0.12 for 24 frames) is right for the live
    // viewport, but during per-frame video accumulation it kept ~12% of the
    // PREVIOUS video frame in the first 24 samples — ghost trails AND a
    // permanently noisier average (the floor never lets early samples form a
    // clean mean). Offline rendering must always use the hard reset.
    this._dirtyFrames = hard ? 0 : 24;
    this._lastSig = "";
  }

  /**
   * Flexible shader system: re-read `userData.rtx` overrides from every source
   * material and repack ONLY the material textures (no BVH/atlas rebuild), then
   * restart accumulation. Near-instant — safe to call from UI slider events.
   */
  updateMaterials() {
    if (!this.engine?.ready) return false;
    const ok = this.engine.updateMaterialsOnly();
    if (ok) this.resetAccumulation();
    return ok;
  }

  /**
   * Re-allocate the accumulation targets after a resolution / quality setting
   * was changed from the RTX engine panel (dynScale, _dynMin, _maxTracePixels,
   * _interactiveScale). _allocateAcc re-derives the internal render size from
   * the current caps and only reallocates if it actually changed. NOTE:
   * _maxDrawPixels alone needs no realloc — render() reads it every frame.
   */
  applyQuality() {
    if (!this._supported) return;
    this._allocateAcc(this.W, this.H);
    this.resetAccumulation();
  }

  setSettings({ bounces, exposure } = {}) {
    let dirty = false;
    if (bounces != null && bounces !== this.bounces) {
      this.bounces = bounces;
      dirty = true;
    }
    if (exposure != null) this.exposure = exposure;
    if (dirty) this.resetAccumulation();
  }

  syncFromScene({
    camera,
    target,
    sun,
    rimLight,
    fillLight,
    moonLight,
    nightFactor = 0,
    mapLights = [],
    bounces,
    exposure,
    sky = null,
  }) {
    if (!camera || !target) return;

    // Camera motion detector. Tiny OrbitControls damping drift used to keep
    // RTX in preview forever, so the live viewport never had time to build
    // samples. Use a small deadband: real camera moves still restart preview,
    // sub-pixel drift is treated as settled and can converge like Blender.
    const cam = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      tx: target.x,
      ty: target.y,
      tz: target.z,
      fov: camera.fov,
    };
    const prevCam = this._lastCamState;
    const moved =
      !prevCam ||
      Math.hypot(cam.px - prevCam.px, cam.py - prevCam.py, cam.pz - prevCam.pz) > 0.012 ||
      Math.hypot(cam.tx - prevCam.tx, cam.ty - prevCam.ty, cam.tz - prevCam.tz) > 0.012 ||
      Math.abs(cam.fov - prevCam.fov) > 0.03;
    const rawSig = [
      cam.px.toFixed(2),
      cam.py.toFixed(2),
      cam.pz.toFixed(2),
      cam.tx.toFixed(2),
      cam.ty.toFixed(2),
      cam.tz.toFixed(2),
      cam.fov.toFixed(1),
    ].join("|");
    const nowMs = performance.now();
    let sig = rawSig;
    if (moved) {
      this._lastCamState = cam;
      this._lastCamSig = rawSig;
      this._motionUntil = nowMs + this._settleDelayMs;
    } else {
      sig = this._lastCamSig || rawSig;
    }

    this._camPos.copy(camera.position);
    this._camTarget.copy(target);

    // "Reset only on camera": while the camera is settled and the freeze
    // policy is on, NON-CAMERA scene-state drift (animated sun/sky cycle,
    // physics-swayed map lights, auto exposure) must not touch the light
    // uniforms or the state signature — each tiny change used to re-open
    // the adaptation window every frame, so the viewport reset forever.
    // Skip the whole non-camera sync: the converged image keeps the frozen
    // lighting until the camera moves or the user explicitly resets.
    if (
      !moved &&
      this.freezeSceneWhileStill &&
      this.viewportAccumulate &&
      !this._interactive &&
      nowMs >= this._motionUntil
    ) {
      return;
    }

    // DirectionalLights in three.js aim via position -> target.position; the
    // light object itself is never rotated, so getWorldDirection() returned a
    // CONSTANT axis — the path-traced sun ignored the time of day entirely
    // (one of the "preset shows the wrong time" bugs). Compute the real
    // direction TOWARD the light instead.
    const dirTowardLight = (light, out) => {
      out.copy(light.position);
      if (light.target?.position) out.sub(light.target.position);
      if (out.lengthSq() < 1e-8) out.set(0, 1, 0);
      return out.normalize();
    };

    const keyLight = nightFactor > 0.45 && moonLight ? moonLight : sun;
    if (keyLight) {
      dirTowardLight(keyLight, this._sunDir);
      this._tmpCol
        .copy(keyLight.color)
        .multiplyScalar(Math.max(keyLight.intensity, 0.01));
      this._sunColor.copy(this._tmpCol);
      this.traceUniforms.uSunWeight.value = keyLight.intensity > 0.001 ? 1 : 0;
    }
    if (rimLight) {
      dirTowardLight(rimLight, this._rimDir);
      this._tmpCol
        .copy(rimLight.color)
        .multiplyScalar(Math.max(rimLight.intensity, 0) * 0.08);
      this._rimColor.copy(this._tmpCol);
      this.traceUniforms.uRimWeight.value = rimLight.intensity > 0 ? 1 : 0;
    }
    if (fillLight) {
      dirTowardLight(fillLight, this._fillDir);
      this._tmpCol
        .copy(fillLight.color)
        .multiplyScalar(Math.max(fillLight.intensity, 0) * 0.12);
      this._fillColor.copy(this._tmpCol);
      this.traceUniforms.uFillWeight.value = fillLight.intensity > 0 ? 1 : 0;
    }

    let lightCount = 0;
    let lightSig = "";
    for (let i = 0; i < mapLights.length && lightCount < MAX_MAP_LIGHTS; i++) {
      const light = mapLights[i]?.light;
      if (!light || light.intensity <= 0) continue;
      light.getWorldPosition(this._mapLightPos[lightCount]);
      this._tmpCol.copy(light.color).multiplyScalar(light.intensity * 3.5);
      this._mapLightEmit[lightCount].set(
        this._tmpCol.r,
        this._tmpCol.g,
        this._tmpCol.b,
      );
      this._mapLightRad[lightCount] = light.isPointLight ? 0.25 : 0.35;
      lightSig +=
        `|L${lightCount}:${this._mapLightPos[lightCount].x.toFixed(1)},` +
        `${this._mapLightPos[lightCount].y.toFixed(1)},` +
        `${this._mapLightPos[lightCount].z.toFixed(1)},` +
        `${this._mapLightEmit[lightCount].x.toFixed(1)}`;
      lightCount++;
    }

    // Power-weighted discrete light distribution. Geometry and solid-angle
    // terms remain in the integrator; RtxLightSampler owns P(select light).
    this.lightSampler.rebuild(
      Array.from({ length: lightCount }, (_, i) => ({
        emission: this._mapLightEmit[i],
        effectiveArea: 4 * Math.PI * this._mapLightRad[i] * this._mapLightRad[i],
      })),
    );

    const sunLum = Math.max(
      0,
      this._sunColor.r * 0.2126 +
        this._sunColor.g * 0.7152 +
        this._sunColor.b * 0.0722,
    ) * this.traceUniforms.uSunWeight.value;
    this.traceUniforms.uDirectSunPdf.value =
      this.lightSampler.strategyPdfs(sunLum > 0.004 ? sunLum : 0).sun;
    this.traceUniforms.uMapLightCount.value = lightCount;
    for (let i = 0; i < MAX_MAP_LIGHTS; i++) {
      this.traceUniforms.uMapLightPos.value[i].copy(this._mapLightPos[i]);
      this.traceUniforms.uMapLightEmit.value[i].copy(this._mapLightEmit[i]);
    }

    if (bounces != null) this.bounces = bounces;
    if (exposure != null) this.exposure = exposure;
    // ---- Scene-driven sky / weather ---------------------------------------
    // Mirror whatever the raster viewer is showing (time of day, weather,
    // ambient, flat background, fog) into the path tracer's environment.
    let skySig = "";
    if (sky) {
      const tu = this.traceUniforms;
      const skyInt = sky.skyIntensity != null ? sky.skyIntensity : 0.3;
      const amb = sky.ambient != null ? sky.ambient : 0.3;
      const env = sky.envInt != null ? sky.envInt : 1.0;
      const night = sky.night != null ? sky.night : nightFactor;
      // Brightness so the sky acts as a sensible area light without blowing out.
      const topMul = Math.min(1.6, 0.35 + skyInt * 1.3 + amb * 0.4);
      const botMul = Math.min(1.8, 0.55 + skyInt * 1.2 + amb * 0.6);

      if (sky.skyColor) {
        this._skyTop.copy(sky.skyColor).multiplyScalar(topMul);
      }
      if (sky.skyColor) {
        // Horizon = sky colour lightened toward white / fog, then brightened.
        this._skyBot.copy(sky.skyColor);
        if (sky.fogColor) this._skyBot.lerp(sky.fogColor, 0.45);
        else this._skyBot.lerp(this._skyTmp.setRGB(1, 1, 1), 0.35);
        this._skyBot.multiplyScalar(botMul);
      }
      if (sky.groundColor) {
        this._skyGround.copy(sky.groundColor).multiplyScalar(0.3 + amb * 0.7);
      }
      const strength = Math.max(0.04, env * (1.0 - night * 0.55));
      tu.uSkyStrength.value = strength;

      const isFlat = !!sky.flat && !!sky.flatColor;
      tu.uSkyFlat.value = isFlat ? 1.0 : 0.0;
      if (isFlat) {
        this._skyFlatColor
          .copy(sky.flatColor)
          .multiplyScalar(Math.max(0.05, 0.6 + amb * 0.8));
      }

      if (sky.fogColor) this._fogColor.copy(sky.fogColor);
      tu.uFogAmt.value = Math.max(0, Math.min(1, sky.fogAmt || 0));

      skySig =
        `|sk${this._skyTop.getHex()}` +
        `${this._skyBot.getHex()}${strength.toFixed(2)}` +
        `${tu.uSkyFlat.value}${tu.uFogAmt.value.toFixed(2)}`;
    }

    // Key/rim/fill directions + colours MUST be part of the signature:
    // without them, clicking a Sun&Sky preset changed the lighting uniforms
    // but never re-opened the adaptation window, so the accumulated image
    // kept showing the OLD time of day almost forever.
    const dirSig =
      `|sd${this._sunDir.x.toFixed(2)},${this._sunDir.y.toFixed(2)},${this._sunDir.z.toFixed(2)}` +
      `|sc${this._sunColor.r.toFixed(2)},${this._sunColor.g.toFixed(2)},${this._sunColor.b.toFixed(2)}` +
      `|rd${this._rimDir.x.toFixed(2)},${this._rimDir.y.toFixed(2)},${this._rimDir.z.toFixed(2)}` +
      `|rc${this._rimColor.r.toFixed(2)},${this._rimColor.g.toFixed(2)},${this._rimColor.b.toFixed(2)}` +
      `|fd${this._fillDir.x.toFixed(2)},${this._fillDir.y.toFixed(2)},${this._fillDir.z.toFixed(2)}` +
      `|fc${this._fillColor.r.toFixed(2)},${this._fillColor.g.toFixed(2)},${this._fillColor.b.toFixed(2)}` +
      `|sw${this.traceUniforms.uSunWeight.value}`;

    const fullSig =
      sig +
      lightSig +
      skySig +
      dirSig +
      `|b${this.bounces}|e${this.exposure.toFixed(2)}` +
      `|lc${lightCount}|sc${this.engine.triCount}`;
    if (fullSig !== this._lastSig) {
      this._lastSig = fullSig;
      // Soft reset: keep the converged history, just open a short adaptation
      // window so the image fades to the new state instead of flashing black.
      this._dirtyFrames = 24;
      // Also cap the frame counter: after the window closes, 1/(f+1) must
      // keep meaningful weight, otherwise ~5% of the OLD lighting stays
      // baked into the average for thousands of frames (ghost sun/ghost
      // geometry after every preset click).
      this.frame = Math.min(this.frame, 8);
      // Any scene-state change (dragging a light, sky preset, slider) also
      // drops into the fast preview for instant feedback, Cycles-style.
      this._motionUntil = Math.max(this._motionUntil, nowMs + this._settleDelayMs);
    }

    // ---- Interactive-mode transitions --------------------------------------
    const interactive = this.viewportAccumulate ? nowMs < this._motionUntil : true;
    if (interactive !== this._interactive) {
      this._interactive = interactive;
      // Swap between preview and full internal resolution. Seeding keeps the
      // last image up during the switch (no black flash)...
      this._reallocRender(true);
      // ...but sampling restarts cleanly: in preview every frame stands on
      // its own (zero ghosting), and on exit the converged accumulation begins
      // again from sample 0 at full resolution, then keeps growing.
      this.frame = 0;
      this._tileIndex = 0;
      if (!interactive) this._dirtyFrames = 0;
    }
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!this.enabled || !this._supported || !this.accA) return;
    if (!this.engine.ready) return;

    this.engine.bindUniforms(this.traceUniforms);

    const tu = this.traceUniforms;
    if (this._interactive) {
      // Navigation preview: every frame is a fresh sample (alpha = 1 in the
      // accumulator), so the image tracks the camera with ZERO ghosting.
      this.frame = 0;
    }
    tu.uInteractive.value = this._interactive ? 1 : 0;
    if (tu.uDebugMode)
      tu.uDebugMode.value =
        typeof window !== "undefined" && window.__rtxDbg ? window.__rtxDbg : 0;
    if (tu.uNoSphere)
      tu.uNoSphere.value =
        typeof window !== "undefined" && window.__rtxNoSphere ? 1 : 0;
    if (tu.uNoShadow)
      tu.uNoShadow.value =
        typeof window !== "undefined" && window.__rtxNoShadow ? 1 : 0;
    if (tu.uFlatLod)
      tu.uFlatLod.value =
        typeof window !== "undefined" && window.__rtxFlatLod ? 1 : 0;
    if (tu.uSmoothGI)
      tu.uSmoothGI.value =
        typeof window !== "undefined" && window.__rtxSmoothGI === false ? 0 : 1;
    tu.uFrame.value = this.frame;
    tu.uAdaptiveSampling.value =
      this.renderingVideo && this.adaptiveSampling && !this._interactive ? 1 : 0;
    tu.uAdaptiveMinSamples.value = Math.max(1, this.adaptiveMinSamples);
    tu.uAdaptiveThreshold.value = Math.max(0.001, this.adaptiveThreshold);
    tu.uAdaptiveStrength.value = Math.min(1, Math.max(0, this.adaptiveStrength));
    tu.uPrev.value = this.accB.textures[0];
    tu.uPrevAlbedo.value = this.accB.textures[1];
    tu.uPrevNormalDepth.value = this.accB.textures[2];
    tu.uPrevMoments.value = this.accB.textures[3];
    tu.uFov.value = this.camera.fov;
    if (this.lensSystem) {
      const lensWrite = this.lensSystem.writeUniforms?.(tu);
      if (lensWrite && lensWrite.ok === false) {
        // Fail safe: a lost/recreated binding must never leave stale DOF on.
        tu.uAperture.value = 0;
      }
    } else {
      tu.uAperture.value = this.lensAperture;
      tu.uFocusDist.value = this.focusDist;
      tu.uBlades.value = this.blades;
      tu.uBladeRot.value = this.bladeRot;
      tu.uAnamorphic.value = this.anamorphic;
    }
    tu.uBounces.value = this.bounces;
    tu.uRoughnessFloor.value = Math.min(0.25, Math.max(0, this.roughnessFloor));
    // While recently changed, floor the new-sample weight so the image adapts
    // smoothly; once settled, allow full convergence to zero noise.
    tu.uMinBlend.value = this._dirtyFrames > 0 ? 0.12 : 0.0;
    if (this._dirtyFrames > 0) this._dirtyFrames--;
    this.showUniforms.uSharpenLimit.value = this.sharpenLimit;
    this.showUniforms.uEdgeProtection.value = this.edgeProtection;
    this.showUniforms.uNoiseProtection.value = this.noiseProtection;

    const maxViewportSamples = Math.max(0, this._viewportMaxSamples || 0);
    const sampleLimitReached =
      !this._interactive &&
      this.viewportAccumulate &&
      maxViewportSamples > 0 &&
      this.frame >= maxViewportSamples;
    if (sampleLimitReached) {
      this.showUniforms.uAcc.value = this.accB.textures[0];
      this.showUniforms.uAlbedo.value = this.accB.textures[1];
      this.showUniforms.uNormalDepth.value = this.accB.textures[2];
      this.showUniforms.uMoments.value = this.accB.textures[3];
      this.showUniforms.uAovMode.value = this.aovMode | 0;
      this.showUniforms.uAdaptiveThreshold.value = this.adaptiveThreshold;
      this.showUniforms.uSharpen.value = this.sharpen;
      this.showUniforms.uExposure.value = this.exposure;
      this.showUniforms.uDenoise.value = 0;

      if (this.renderToScreen) renderer.setRenderTarget(null);
      else {
        renderer.setRenderTarget(writeBuffer);
        if (this.clear) renderer.clear();
      }
      this.showQuad.render(renderer);
      return;
    }

    // ---- TRACE (у converged-режимі — посмугово, щоб обмежити час 1 draw call) ----
    renderer.setRenderTarget(this.accA);
    if (this._interactive) {
      // Цілий свіжий кадр; внутрішня роздільність уже обмежена _maxDrawPixels.
      renderer.clear();
      this.traceQuad.render(renderer);
    } else {
      const budget = this._maxDrawPixels || 150000;
      const stripH = Math.max(1, Math.floor(budget / this.rW));
      if (stripH >= this.rH) {
        // Кадр і так вкладається в бюджет — без розбиття.
        renderer.clear();
        this.traceQuad.render(renderer);
        this._tileIndex = 0;
        this.frame++;
      } else {
        const numStrips = Math.ceil(this.rH / stripH);
        const requestedPasses = Math.max(0, Math.round(this._viewportPassesPerFrame || 0));
        const drawsPerFrame = this.viewportAccumulate
          ? Math.max(
              1,
              Math.min(
                16,
                requestedPasses || Math.ceil(numStrips / 12),
                Math.max(
                  1,
                  Math.floor(
                    (this._viewportTileFrameBudget || 240000) /
                      Math.max(1, budget),
                  ),
                ),
              ),
            )
          : 1;
        // 1) Переносимо попередній повний кадр у accA, щоб нетрасовані смуги
        //    збереглися.
        this.copyUniforms.uSrc.value = this.accB.textures[0];
        this.copyUniforms.uSrcAlbedo.value = this.accB.textures[1];
        this.copyUniforms.uSrcNormalDepth.value = this.accB.textures[2];
        this.copyUniforms.uSrcMoments.value = this.accB.textures[3];
        this.copyQuad.render(renderer);
        // 2) Трасуємо кілька горизонтальних смуг за viewport-кадр. Це дає
        //    справжній Cycles-style viewport accumulation навіть із малим
        //    Draw budget: повний sample-pass завершується за ~12 кадрів,
        //    а не за сотні.
        renderer.setScissorTest(true);
        for (let d = 0; d < drawsPerFrame; d++) {
          const idx = this._tileIndex % numStrips;
          const y0 = idx * stripH;
          const h = Math.min(stripH, this.rH - y0);
          renderer.setScissor(0, y0, this.rW, h);
          this.traceQuad.render(renderer);
          this._tileIndex = idx + 1;
          if (this._tileIndex >= numStrips) {
            this._tileIndex = 0;
            this.frame++;
          }
        }
        renderer.setScissorTest(false);
        // 3) Повний семпл акумуляції зараховуємо лише після повного проходу
        //    зверху донизу.
      }
    }

    // Viewport denoise: strong while previewing / at low sample counts,
    // fades to zero as the accumulation converges (keeps detail).
    let dn = 0;
    if (this.renderingVideo) {
      // Offline strength follows both requested quality and SPP. Per-pixel
      // variance from the moments AOV performs the final adaptive gating.
      dn = computeAdaptiveDenoiseStrength({
        samples: this.frame,
        userBaseStrength: this.finalDenoise,
      });
    } else if (this.denoise) {
      dn = this._interactive
        ? 0.85
        : 0.75 * Math.max(0, 1 - this.frame / 96);
      // User multiplier from the RTX engine panel (clamped to the shader's 0..1).
      dn = Math.min(1.0, Math.max(0, dn * this.denoiseStrength));
    }
    // À-trous multi-iteration denoise (SVGF-lite): 1-3 edge-aware wavelet
    // passes replace the old single 5x5 bilateral — a 17x17 effective
    // footprint at high strength with far better edge preservation.
    let showTex = this.accA.textures[0];
    if (dn > 0.02) {
      const iters = dn > 0.7 ? 3 : dn > 0.35 ? 2 : 1;
      const sigma = 0.05 + dn * 0.45;
      this._ensureDnTargets();
      const prevRT = renderer.getRenderTarget();
      let src = showTex;
      for (let i = 0; i < iters; i++) {
        const dst = i % 2 === 0 ? this._dnA : this._dnB;
        this.atrousUniforms.uTex.value = src;
        this.atrousUniforms.uAlbedo.value = this.accA.textures[1];
        this.atrousUniforms.uNormalDepth.value = this.accA.textures[2];
        this.atrousUniforms.uMoments.value = this.accA.textures[3];
        this.atrousUniforms.uStep.value = 1 << i; // 1, 2, 4 (à-trous holes)
        this.atrousUniforms.uSigma.value = sigma;
        this.atrousUniforms.uStrength.value = dn;
        this.atrousUniforms.uNormalSensitivity.value = this.normalSensitivity;
        this.atrousUniforms.uDepthSensitivity.value = this.depthSensitivity;
        this.atrousUniforms.uAlbedoSensitivity.value = this.albedoSensitivity;
        this.atrousUniforms.uDetailPreservation.value = this.detailPreservation;
        this.atrousUniforms.uRes.value.set(this.rW, this.rH);
        renderer.setRenderTarget(dst);
        this.atrousQuad.render(renderer);
        src = dst.texture;
      }
      renderer.setRenderTarget(prevRT);
      showTex = src;
    }
    this.showUniforms.uAcc.value = showTex;
    this.showUniforms.uAlbedo.value = this.accA.textures[1];
    this.showUniforms.uNormalDepth.value = this.accA.textures[2];
    this.showUniforms.uMoments.value = this.accA.textures[3];
    this.showUniforms.uExposure.value = this.exposure;
    this.showUniforms.uDenoise.value = 0; // inline bilateral superseded
    this.showUniforms.uSharpen.value = dn > 0.02 ? this.sharpen : 0;
    this.showUniforms.uAovMode.value = this.aovMode | 0;
    this.showUniforms.uAdaptiveThreshold.value = this.adaptiveThreshold;

    if (this.renderToScreen) renderer.setRenderTarget(null);
    else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.showQuad.render(renderer);

    const tt = this.accA;
    this.accA = this.accB;
    this.accB = tt;
  }

  dispose() {
    try {
      this.accA?.dispose();
    } catch (_e) {}
    try {
      this.accB?.dispose();
    } catch (_e) {}
    try {
      this.engine.dispose();
    } catch (_e) {}
    try {
      this.traceMat.dispose();
    } catch (_e) {}
    try {
      this.showMat.dispose();
    } catch (_e) {}
    try {
      this.traceQuad.dispose();
    } catch (_e) {}
    try {
      this.showQuad.dispose();
    } catch (_e) {}
    try {
      this.copyMat.dispose();
    } catch (_e) {}
    try {
      this.copyQuad.dispose();
    } catch (_e) {}
    try {
      this._aovReadbackTarget?.dispose();
    } catch (_e) {}
    try {
      this._aovReadbackMat.dispose();
    } catch (_e) {}
    try {
      this._aovReadbackQuad.dispose();
    } catch (_e) {}
    try {
      this._dnA?.dispose();
    } catch (_e) {}
    try {
      this._dnB?.dispose();
    } catch (_e) {}
    try {
      this.atrousMat.dispose();
    } catch (_e) {}
    try {
      this.atrousQuad.dispose();
    } catch (_e) {}
  }
}
