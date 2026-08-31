// engine2-fx-pass.js
// Engine 2.0 cinematic post-FX pass — one full-screen pass with a large chain
// of individually tunable screen-space effects, driven by the E2 window:
//
//   COLOR GRADE : exposure, contrast, saturation, vibrance, temperature,
//                 tint G-M, gamma, lift (shadows), highlight roll-off,
//                 split-toning (shadows/highlights), hue shift, sepia,
//                 invert, levels (black/white point), RGB channel gains,
//                 3D LUT (.cube/.3dl files, trilinear atlas sampling)
//   LENS        : vignette (+shape), chromatic aberration, barrel/pincushion,
//                 letterbox
//   FOCUS/BLUR  : radial (zoom) blur (+center), directional motion blur
//                 (+angle), tilt-shift (+band pos/width), frosted glass
//   STYLIZATION : edge ink (+threshold), halftone dots (+size), duotone
//                 (+2 hues), emboss
//   GLITCH      : wave distortion (+freq/speed), digital glitch (+speed),
//                 screen shake (+speed), mirror X, swirl (+radius)
//   ATMOSPHERE  : god rays (+decay/center), light leaks, height fog
//                 (+height), frost on edges, rain on lens (+speed),
//                 dust & scratches
//   FILM        : animated grain (+size), scanlines, posterize, pixelate,
//                 sharpen
//
// SAFETY: with every parameter at neutral the pass DISABLES ITSELF — zero GPU
// cost, zero risk. It only transforms the composited image; materials and
// scene state are never touched. Branches are uniform-based (coherent).

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export const E2FX_DEFAULTS = Object.freeze({
  // --- color grade ---
  exposure: 0, contrast: 0, saturation: 0, vibrance: 0,
  temperature: 0, tintGM: 0, gamma: 1,
  lift: 0,            // -1..1 shadow lift
  rolloff: 0,         // 0..1 highlight soft roll-off
  splitShadows: 0,    // -1..1 cool..warm shadow toning
  splitHighs: 0,      // -1..1 cool..warm highlight toning
  hueShift: 0,        // -180..180 degrees
  sepia: 0,           // 0..1
  invert: 0,          // 0..1
  levelsBlack: 0,     // 0..0.5 black point
  levelsWhite: 1,     // 0.5..1 white point
  gainR: 1, gainG: 1, gainB: 1, // per-channel gain 0..2
  lutAmount: 0,       // 0..1 blend of the loaded 3D LUT (.cube/.3dl)
  // --- lens ---
  vignette: 0, vignetteRound: 0.5, chroma: 0, barrel: 0, letterbox: 0,
  // --- focus / blur ---
  radialBlur: 0, radialCX: 0.5, radialCY: 0.5,
  motionBlur: 0, motionAngle: 0,
  tiltShift: 0, tiltPos: 0.5, tiltWidth: 0.3,
  frost: 0,
  // --- stylization ---
  edge: 0, edgeThreshold: 0.2,
  halftone: 0, halftoneSize: 6,
  duotone: 0, duoHueA: 0.62, duoHueB: 0.08,
  emboss: 0,
  // --- glitch / distortion ---
  wave: 0, waveFreq: 12, waveSpeed: 1,
  glitch: 0, glitchSpeed: 1,
  shake: 0, shakeSpeed: 8,
  mirrorX: 0,
  swirl: 0, swirlRadius: 0.5,
  // --- atmosphere ---
  rays: 0, raysDecay: 0.92, raysCX: 0.5, raysCY: 0.25,
  raysAuto: 1,            // 1 = ray origin auto-tracks the REAL sun on screen
  leaks: 0,
  fog: 0, fogHeight: 0.5,
  frostEdge: 0,
  rain: 0, rainSpeed: 1,
  snow: 0, snowSpeed: 1, snowWind: 0,
  dust: 0,
  // --- film ---
  grain: 0, grainSize: 1.6, scanlines: 0, posterize: 0, pixelate: 0, sharpen: 0,
});

// Parameters that ACTIVATE the pass when they leave their neutral value.
// Secondary shape/speed/position params alone never wake it.
const PRIMARY = {
  exposure: 0, contrast: 0, saturation: 0, vibrance: 0, temperature: 0,
  tintGM: 0, gamma: 1, lift: 0, rolloff: 0, splitShadows: 0, splitHighs: 0,
  hueShift: 0, sepia: 0, invert: 0, levelsBlack: 0, levelsWhite: 1,
  gainR: 1, gainG: 1, gainB: 1, lutAmount: 0,
  vignette: 0, chroma: 0, barrel: 0, letterbox: 0,
  radialBlur: 0, motionBlur: 0, tiltShift: 0, frost: 0,
  edge: 0, halftone: 0, duotone: 0, emboss: 0,
  wave: 0, glitch: 0, shake: 0, mirrorX: 0, swirl: 0,
  rays: 0, leaks: 0, fog: 0, frostEdge: 0, rain: 0, snow: 0, dust: 0,
  grain: 0, scanlines: 0, sharpen: 0,
};

const FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2  uRes;
uniform float uTime;
uniform float uExposure, uContrast, uSaturation, uVibrance, uTemperature, uTintGM, uGamma;
uniform float uLift, uRolloff, uSplitShadows, uSplitHighs, uHueShift, uSepia, uInvert;
uniform float uLevelsBlack, uLevelsWhite, uGainR, uGainG, uGainB;
uniform sampler2D uLutTex;
uniform float uLutSize, uLutAmount;
uniform float uVignette, uVignetteRound, uChroma, uBarrel, uLetterbox;
uniform float uRadialBlur, uRadialCX, uRadialCY, uMotionBlur, uMotionAngle;
uniform float uTiltShift, uTiltPos, uTiltWidth, uFrost;
uniform float uEdge, uEdgeThreshold, uHalftone, uHalftoneSize;
uniform float uDuotone, uDuoHueA, uDuoHueB, uEmboss;
uniform float uWave, uWaveFreq, uWaveSpeed, uGlitch, uGlitchSpeed;
uniform float uShake, uShakeSpeed, uMirrorX, uSwirl, uSwirlRadius;
uniform float uRays, uRaysDecay, uRaysCX, uRaysCY, uRaysVis, uLeaks;
uniform float uFog, uFogHeight, uFrostEdge, uRain, uRainSpeed, uDust;
uniform float uSnow, uSnowSpeed, uSnowWind;
uniform float uGrain, uGrainSize, uScanlines, uPosterize, uPixelate, uSharpen;
varying vec2 vUv;

float hash21(vec2 p){
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 applySat(vec3 c, float s){
  return mix(vec3(luma(c)), c, 1.0 + s);
}
vec3 hsv2rgb(vec3 c){
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 tap(vec2 uv){ return texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb; }

/* 3D LUT color grade — .cube/.3dl parsed into a 2D atlas of N slices (N x N
   each) laid out horizontally, MMD_modoki lut-atlas style. Dual-slice
   trilinear interpolation by hand keeps it GLSL1/WebGL-safe. */
vec3 applyLut(vec3 c){
  float n = uLutSize;
  vec3 cc = clamp(c, 0.0, 1.0);
  float zs = cc.b * (n - 1.0);
  float z0 = floor(zs);
  float z1 = min(z0 + 1.0, n - 1.0);
  float x = (cc.r * (n - 1.0) + 0.5) / (n * n);
  float y = (cc.g * (n - 1.0) + 0.5) / n;
  vec3 a = texture2D(uLutTex, vec2(x + z0 / n, y)).rgb;
  vec3 b = texture2D(uLutTex, vec2(x + z1 / n, y)).rgb;
  return mix(a, b, zs - z0);
}

/* ===========================================================================
   Rain on glass — adapted from "Heartfelt" by Martijn Steinrucken aka
   BigWings (2017), https://www.shadertoy.com/view/ltffzl
   License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0.
   The reference rain-on-glass shader: falling drops with saw-tooth motion
   and wiggle, trails that carve through the fogged glass, static droplets
   that fade in and out. Ported here to drive REFRACTION + glass fog.
   ======================================================================== */
#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
  // from DAVE HOSKINS
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}
float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}
float Saw(float b, float t) {
  return S(0.0, b, t) * S(1.0, b, t);
}

vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;
  vec2 id = floor(uv * grid);
  float colShift = N(id.x);
  uv.y += colShift;
  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);

  float x = n.x - 0.5;
  float y = UV.y * 20.0;
  float wiggle = sin(y + sin(y));
  x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  float ti = fract(t + n.z);
  y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
  vec2 p = vec2(x, y);
  float d = length((st - p) * a.yx);
  float mainDrop = S(0.4, 0.0, d);

  float r = sqrt(S(1.0, y, st.y));
  float cd = abs(st.x - x);
  float trail = S(0.23 * r, 0.15 * r * r, cd);
  float trailFront = S(-0.02, 0.02, st.y - y);
  trail *= trailFront * r * r;

  y = UV.y;
  y = fract(y * 10.0) + (st.y - 0.5);
  float dd = length(st - vec2(x, y));
  float droplets = S(0.3, 0.0, dd);
  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 40.0;
  vec2 id = floor(uv);
  uv = fract(uv) - 0.5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - 0.5) * 0.7;
  float d = length(uv - p);
  float fade = Saw(0.025, fract(t + n.z));
  return S(0.3, 0.0, d) * fract(n.z * 10.0) * fade;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer2(uv, t) * l1;
  vec2 m2 = DropLayer2(uv * 1.85, t) * l2;
  float c = s + m1.x + m2.x;
  c = S(0.3, 1.0, c);
  return vec2(c, max(m1.y * l0, m2.y * l1));
}

/* ---- shared value-noise / fbm for the atmosphere suite ---- */
float vnoise21(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm4(vec2 p){
  float a = 0.5, r = 0.0;
  for (int i = 0; i < 4; i++) { r += a * vnoise21(p); p = p * 2.13 + 19.7; a *= 0.5; }
  return r;
}

void main(){
  vec2 uv = vUv;
  vec2 gRain = vec2(0.0);
  float gRainFog = 0.0;

  /* ================= geometric stage (changes WHERE we sample) ========== */
  if (uRain > 0.001) {
    // "Heartfelt" rain: drop field -> surface normals -> real refraction.
    // Trails (c.y) wipe the fog off the glass, sharp drops stay clear.
    float rt = uTime * uRainSpeed * 0.2;
    vec2 ruv = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    float staticDrops = S(-0.5, 1.0, uRain) * 2.0;
    float layer1 = S(0.25, 0.75, uRain);
    float layer2 = S(0.0, 0.5, uRain);
    vec2 c = Drops(ruv, rt, staticDrops, layer1, layer2);
    vec2 e = vec2(0.001, 0.0);
    float cx = Drops(ruv + e, rt, staticDrops, layer1, layer2).x;
    float cy = Drops(ruv + e.yx, rt, staticDrops, layer1, layer2).x;
    gRain = vec2(cx - c.x, cy - c.x);      // drop surface normal
    uv += gRain * 1.2;                     // refraction through the water
    // glass fog: grows with rain amount, carved away by drop trails,
    // and the drops themselves stay optically clear
    gRainFog = clamp(mix(0.25, 0.7, uRain) - c.y * 1.4 - S(0.1, 0.2, c.x) * 0.6, 0.0, 1.0);
  }
  if (uShake > 0.001) {
    float t = uTime * uShakeSpeed;
    uv += (vec2(hash21(vec2(floor(t*10.0), 1.0)), hash21(vec2(2.0, floor(t*10.0)))) - 0.5)
          * uShake * 0.03;
  }
  if (uMirrorX > 0.5) uv.x = uv.x < 0.5 ? uv.x : 1.0 - uv.x;
  if (uWave > 0.001) {
    uv.x += sin(uv.y * uWaveFreq + uTime * uWaveSpeed * 2.0) * uWave * 0.02;
    uv.y += cos(uv.x * uWaveFreq * 0.7 + uTime * uWaveSpeed * 1.3) * uWave * 0.012;
  }
  if (uSwirl > 0.001) {
    vec2 sc = uv - 0.5;
    float r = length(sc);
    if (r < uSwirlRadius) {
      float a = uSwirl * 3.0 * pow(1.0 - r / max(uSwirlRadius, 1e-3), 2.0);
      float cs = cos(a), sn = sin(a);
      uv = 0.5 + mat2(cs, -sn, sn, cs) * sc;
    }
  }
  float glitchAmt = 0.0;
  if (uGlitch > 0.001) {
    float t = floor(uTime * 12.0 * uGlitchSpeed);
    float row = floor(vUv.y * 24.0);
    float rnd1 = hash21(vec2(row, t));
    glitchAmt = step(1.0 - uGlitch * 0.35, rnd1);
    uv.x += glitchAmt * (hash21(vec2(t, row)) - 0.5) * 0.12 * uGlitch;
  }
  if (uPixelate > 1.5) {
    vec2 cell = vec2(uPixelate) / uRes;
    uv = (floor(uv / cell) + 0.5) * cell;
  }
  vec2 cc0 = uv - 0.5;
  uv = clamp(0.5 + cc0 * (1.0 + uBarrel * dot(cc0, cc0) * 2.0), 0.001, 0.999);

  /* ================= sampling stage ===================================== */
  vec3 col;
  float ca = uChroma * 0.02 + glitchAmt * 0.01;
  if (ca > 0.0005) {
    vec2 off = (uv - 0.5) * ca;
    col.r = tap(uv + off).r;
    col.g = tap(uv).g;
    col.b = tap(uv - off).b;
  } else {
    col = tap(uv);
  }
  if (uRadialBlur > 0.001) {
    vec2 c = vec2(uRadialCX, uRadialCY);
    vec3 acc = col;
    for (int i = 1; i <= 6; i++) {
      float f = 1.0 - uRadialBlur * 0.06 * float(i);
      acc += tap(c + (uv - c) * f);
    }
    col = acc / 7.0;
  }
  if (uMotionBlur > 0.001) {
    vec2 d = vec2(cos(uMotionAngle), sin(uMotionAngle)) * uMotionBlur * 0.02;
    col = (col + tap(uv + d) + tap(uv - d) + tap(uv + d * 2.0) + tap(uv - d * 2.0)) / 5.0;
  }
  if (uTiltShift > 0.001) {
    float band = abs(vUv.y - uTiltPos) / max(uTiltWidth, 0.02);
    float blur = clamp(band - 1.0, 0.0, 1.0) * uTiltShift * 0.012;
    if (blur > 0.0002) {
      col = (col
        + tap(uv + vec2(blur, 0.0)) + tap(uv - vec2(blur, 0.0))
        + tap(uv + vec2(0.0, blur)) + tap(uv - vec2(0.0, blur))
        + tap(uv + vec2(blur, blur) * 0.7) + tap(uv - vec2(blur, blur) * 0.7)) / 7.0;
    }
  }
  if (uFrost > 0.001) {
    float fr = uFrost * 0.02;
    vec3 acc = col;
    for (int i = 1; i <= 4; i++) {
      vec2 j = vec2(hash21(uv * float(i) * 17.0), hash21(uv.yx * float(i) * 29.0)) - 0.5;
      acc += tap(uv + j * fr);
    }
    col = acc / 5.0;
  }
  if (uSharpen > 0.001) {
    vec2 px = 1.0 / uRes;
    vec3 blur = (tap(uv + vec2(px.x, 0.0)) + tap(uv - vec2(px.x, 0.0))
               + tap(uv + vec2(0.0, px.y)) + tap(uv - vec2(0.0, px.y))) * 0.25;
    col += (col - blur) * uSharpen;
  }
  if (gRainFog > 0.004) {
    // fogged glass (Heartfelt): a soft smear + slight lift where the fog
    // sits; drop trails have already carved it away in gRainFog
    float fr = gRainFog * 0.004;
    vec3 fogC = (tap(uv + vec2(fr, 0.0)) + tap(uv - vec2(fr, 0.0))
               + tap(uv + vec2(0.0, fr)) + tap(uv - vec2(0.0, fr))
               + tap(uv + vec2(fr, fr) * 0.7) + tap(uv - vec2(fr, fr) * 0.7)) / 6.0;
    col = mix(col, fogC * 0.96 + vec3(0.035), gRainFog * 0.85);
  }

  /* ================= color grade ======================================== */
  col *= exp2(uExposure);
  col *= vec3(uGainR, uGainG, uGainB);
  col.r *= 1.0 + uTemperature * 0.25;
  col.b *= 1.0 - uTemperature * 0.25;
  col.g *= 1.0 + uTintGM * 0.2;
  // levels
  col = clamp((col - uLevelsBlack) / max(uLevelsWhite - uLevelsBlack, 0.05), 0.0, 4.0);
  // shadow lift + highlight roll-off
  col += uLift * 0.25 * (1.0 - col);
  col = mix(col, 1.0 - exp(-col * 1.6), uRolloff * clamp(col, 0.0, 1.0));
  col = (col - 0.5) * (1.0 + uContrast) + 0.5;
  // split toning (cool<->warm by luma)
  if (abs(uSplitShadows) > 0.005 || abs(uSplitHighs) > 0.005) {
    float l = clamp(luma(col), 0.0, 1.0);
    vec3 warm = vec3(0.1, 0.02, -0.08);
    col += warm * uSplitShadows * (1.0 - l) * 0.8;
    col += warm * uSplitHighs * l * 0.8;
  }
  if (abs(uHueShift) > 0.05) {
    vec3 hsv = rgb2hsv(clamp(col, 0.0, 1.0));
    hsv.x = fract(hsv.x + uHueShift / 360.0 + 1.0);
    col = hsv2rgb(hsv);
  }
  float mx = max(col.r, max(col.g, col.b));
  float mn = min(col.r, min(col.g, col.b));
  col = applySat(col, uSaturation + uVibrance * (1.0 - clamp(mx - mn, 0.0, 1.0)));
  if (uSepia > 0.005) {
    vec3 sep = vec3(dot(col, vec3(0.393, 0.769, 0.189)),
                    dot(col, vec3(0.349, 0.686, 0.168)),
                    dot(col, vec3(0.272, 0.534, 0.131)));
    col = mix(col, sep, uSepia);
  }
  if (uDuotone > 0.005) {
    float l = clamp(luma(col), 0.0, 1.0);
    vec3 a = hsv2rgb(vec3(uDuoHueA, 0.75, 0.35));
    vec3 b = hsv2rgb(vec3(uDuoHueB, 0.85, 0.95));
    col = mix(col, mix(a, b, l), uDuotone);
  }
  col = mix(col, 1.0 - col, uInvert);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(uGamma, 0.05)));
  if (uLutAmount > 0.001 && uLutSize > 1.5) {
    col = mix(col, applyLut(col), uLutAmount);
  }
  if (uPosterize > 1.5) col = floor(col * uPosterize + 0.5) / uPosterize;

  /* ================= stylization ======================================== */
  if (uEdge > 0.001) {
    vec2 px = 1.5 / uRes;
    float l0 = luma(tap(uv));
    float gx = luma(tap(uv + vec2(px.x, 0.0))) - luma(tap(uv - vec2(px.x, 0.0)));
    float gy = luma(tap(uv + vec2(0.0, px.y))) - luma(tap(uv - vec2(0.0, px.y)));
    float e = smoothstep(uEdgeThreshold * 0.25, uEdgeThreshold, length(vec2(gx, gy)));
    col = mix(col, col * (1.0 - e * 0.9), uEdge);
  }
  if (uEmboss > 0.001) {
    vec2 px = 2.0 / uRes;
    float d = luma(tap(uv - px)) - luma(tap(uv + px));
    col = mix(col, vec3(0.5 + d * 2.0), uEmboss * 0.7);
  }
  if (uHalftone > 0.001) {
    vec2 gp = gl_FragCoord.xy / max(uHalftoneSize, 2.0);
    vec2 f = fract(gp) - 0.5;
    float l = clamp(luma(col), 0.0, 1.0);
    float dotMask = smoothstep(sqrt(l) * 0.7, sqrt(l) * 0.7 - 0.15, length(f) * 1.3);
    col = mix(col, col * dotMask + vec3(0.02), uHalftone);
  }

  /* ================= atmosphere ========================================= */
  if (uRays > 0.001) {
    // GOD RAYS — "Volumetric Light Scattering as a Post-Process",
    // Kenny Mitchell, GPU Gems 3 ch.13 (the reference algorithm):
    // march from the pixel toward the light, accumulate bright-passed
    // samples attenuated by decay^i, per-pixel jitter kills banding.
    vec2 lightPos = vec2(uRaysCX, uRaysCY);
    vec2 delta = (vUv - lightPos) / 32.0;
    vec2 coord = vUv - delta * hash21(gl_FragCoord.xy * 0.7231);
    float illum = 1.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      coord -= delta;
      vec3 s = tap(coord);
      float b = smoothstep(0.7, 1.1, luma(s));
      acc += s * b * illum * (1.0 / 32.0);
      illum *= uRaysDecay;
    }
    // uRaysVis: sun visibility (host-fed) — rays fade out when the real sun
    // leaves the frame or goes behind the camera, like in games.
    col += acc * uRays * 3.0 * uRaysVis;
  }
  if (uLeaks > 0.001) {
    // LIGHT LEAKS — film-style: drifting fbm plumes in three emulsion hues
    // (amber / magenta / warm white), screen-blended from the frame edges.
    float t = uTime * 0.11;
    vec2 lu = vUv * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    float l1 = fbm4(lu * 1.6 + vec2(t * 0.35, -t * 0.22));
    float l2 = fbm4(lu * 2.3 - vec2(t * 0.27, t * 0.31) + 7.3);
    float side = max(smoothstep(0.55, 1.05, vUv.x + l1 * 0.35),
                     smoothstep(0.45, -0.05, vUv.x - l2 * 0.3));
    vec3 leak = vec3(1.0, 0.45, 0.18) * smoothstep(0.45, 0.85, l1)
              + vec3(1.0, 0.25, 0.45) * smoothstep(0.55, 0.95, l2) * 0.7
              + vec3(1.0, 0.75, 0.35) * smoothstep(0.60, 1.00, l1 * l2 * 2.2) * 0.5;
    leak = clamp(leak * side * uLeaks, 0.0, 1.0);
    col = 1.0 - (1.0 - col) * (1.0 - leak); // screen blend — film-like
  }
  if (uFog > 0.001) {
    // FOG 2.0 — DOMAIN-WARPED fbm (Inigo Quilez technique: fbm fed by fbm)
    // produces genuinely billowing, curling banks instead of a flat overlay.
    // Two parallax sheets + scattering: fog glows toward the light source
    // (shares the god-rays sun position, so it follows the real sun).
    float t = uTime * 0.045;
    vec2 fu = vUv * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    vec2 w1 = vec2(fbm4(fu * 1.7 + t), fbm4(fu * 1.7 + 3.7 - t));
    float f1 = fbm4(fu * 2.6 + w1 * 1.9 + vec2(t * 2.2, 0.0));
    vec2 w2 = vec2(fbm4(fu * 3.1 - t * 1.4), fbm4(fu * 3.1 + 9.1 + t));
    float f2 = fbm4(fu * 5.2 + w2 * 1.5 - vec2(t * 3.4, t * 0.4));
    float bank = smoothstep(0.28, 0.85, f1 * 0.62 + f2 * 0.38); // puffs, not haze
    float band = smoothstep(uFogHeight + 0.4, uFogHeight - 0.3, vUv.y);
    float dens = clamp(band * bank * uFog * 1.5, 0.0, 1.0);
    float toLight = 1.0 - clamp(distance(vUv, vec2(uRaysCX, uRaysCY)) * 1.2, 0.0, 1.0);
    vec3 fogCol = mix(vec3(0.55, 0.60, 0.70), vec3(0.95, 0.93, 0.88), toLight * toLight * 0.9);
    col = mix(col, fogCol, dens * 0.9);
  }
  if (uFrostEdge > 0.001) {
    // FROST — ridged-fbm ice crystals growing from the frame edges; frosted
    // areas diffuse the image (frosted glass) and sparkle.
    vec2 fc = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 1.5;
    float ring = smoothstep(0.35, 1.15, length(fc));
    float cry = 1.0 - abs(fbm4(vUv * 14.0) * 2.0 - 1.0); // ridged crystals
    cry = pow(cry, 2.2);
    float fmask = clamp(ring * (0.35 + cry * 0.9) * uFrostEdge * 1.6, 0.0, 1.0);
    if (fmask > 0.01) {
      float fr = fmask * 0.006;
      vec3 fro = (tap(uv + vec2(fr, 0.0)) + tap(uv - vec2(fr, 0.0))
                + tap(uv + vec2(0.0, fr)) + tap(uv - vec2(0.0, fr))) * 0.25;
      float sparkle = step(0.985, hash21(floor(vUv * uRes / 2.0))) * cry;
      col = mix(col, fro * vec3(0.92, 0.97, 1.08) + vec3(0.10, 0.13, 0.17) * cry, fmask * 0.8);
      col += vec3(1.0) * sparkle * fmask * 0.5;
    }
  }
  if (uRain > 0.001) {
    // subtle glass glint on the drop rims (from the refraction normal)
    float glint = smoothstep(0.03, 0.25, length(gRain));
    col += vec3(0.85, 0.92, 1.0) * glint * 0.12 * uRain;
  }
  if (uSnow > 0.001) {
    // SNOW — adapted from "Just Snow" by Andrew Baldwin (thndl.com),
    // https://www.shadertoy.com/view/ldsGDn, CC BY-NC-SA 3.0.
    // 12 parallax layers: near flakes big & soft (DOF), far flakes small and
    // slow; every layer has its own wind shear + global wind control.
    const mat3 pm = mat3(13.323122, 23.5112, 21.71123,
                         21.1212, 28.7312, 11.9312,
                         21.8112, 14.7212, 61.3934);
    float st = uTime * uSnowSpeed;
    vec2 suv = (vUv - 0.5) * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 3.2;
    float dof = 5.0 * sin(st * 0.1);
    float snowAcc = 0.0;
    for (int i = 0; i < 12; i++) {
      float fi = float(i);
      vec2 q = suv * (1.0 + fi);
      q += vec2(q.y * (0.8 * mod(abs(fi * 7.238917), 1.0) - 0.4)
                + uSnowWind * st * 0.8,
                st * 1.8 / (1.0 + fi * 0.03));
      vec3 n = vec3(floor(q), 31.189 + fi);
      vec3 m = floor(n) * 0.00001 + fract(n);
      vec3 mp = (31415.9 + m) / fract(pm * m);
      vec3 r = fract(mp);
      vec2 s = abs(mod(q, 1.0) - 0.5 + 0.9 * r.xy - 0.45);
      s += 0.01 * abs(2.0 * fract(10.0 * q.yx) - 1.0); // flake wobble
      float d = 0.6 * max(s.x - s.y, s.x + s.y) + max(s.x, s.y) - 0.01;
      float edge = 0.05 + 0.05 * min(0.5 * abs(fi - 5.0 - dof), 1.0);
      float gate = step(r.z, uSnow); // density follows the slider
      snowAcc += smoothstep(edge, -edge, d) * (r.x / (1.0 + 0.02 * fi)) * gate;
    }
    col = mix(col, vec3(0.93, 0.96, 1.0), clamp(snowAcc, 0.0, 1.0) * 0.9);
  }
  if (uDust > 0.001) {
    // DUST & SCRATCHES — projector-style film damage (Old Film technique):
    // 18fps cadence, luma flicker, wandering vertical scratches, fbm dirt
    // blotches, hair fibres as noise iso-lines, bright specks.
    float fr = floor(uTime * 18.0);
    col *= 1.0 + (hash21(vec2(fr, 3.7)) - 0.5) * 0.12 * uDust; // gate flicker
    float scr = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi2 = float(i);
      float life = hash21(vec2(fr + fi2 * 17.0, 9.1));
      float sx = hash21(vec2(floor(fr * 0.25) + fi2 * 31.0, 4.3))
               + (hash21(vec2(fr, fi2 + 6.6)) - 0.5) * 0.01; // frame jitter
      scr += smoothstep(0.0016, 0.0002, abs(vUv.x - sx)) * step(0.55, life);
    }
    col = mix(col, vec3(0.82), clamp(scr, 0.0, 1.0) * 0.45 * uDust);
    vec2 du = vUv * vec2(uRes.x / max(uRes.y, 1.0), 1.0);
    float blotch = smoothstep(0.82, 0.98, fbm4(du * 9.0 + fr * 7.13));
    float hairLine = smoothstep(0.006, 0.001,
      abs(fbm4(du * 6.0 + vec2(fr * 5.7, fr * 2.3)) - 0.5));
    float hairGate = step(0.72, hash21(vec2(fr, 12.3)));
    col = mix(col, vec3(0.06),
      clamp(blotch + hairLine * hairGate, 0.0, 1.0) * 0.6 * uDust);
    float speck = step(1.0 - 0.02 * uDust, hash21(floor(vUv * uRes / 2.0) + fr));
    col = mix(col, vec3(0.95), speck * 0.7 * uDust);
  }

  /* ================= film & frame ======================================= */
  if (uGrain > 0.001) {
    float g = hash21(floor(gl_FragCoord.xy / max(uGrainSize, 1.0))
                     + vec2(fract(uTime * 13.7) * 157.0, fract(uTime * 7.3) * 113.0)) - 0.5;
    col += g * uGrain * 0.22;
  }
  if (uScanlines > 0.001) {
    col *= 1.0 - uScanlines * 0.45 * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  }
  if (uVignette > 0.001) {
    vec2 vc = (vUv - 0.5) * vec2(mix(1.0, uRes.x / max(uRes.y, 1.0), uVignetteRound), 1.0);
    col *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(vc) * 1.4142);
  }
  if (uLetterbox > 0.001) {
    float bar = uLetterbox * 0.12;
    if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// uniform name for a param key: u + UpperFirst
const uName = (k) => "u" + k.charAt(0).toUpperCase() + k.slice(1);

export class Engine2FxPass extends Pass {
  constructor() {
    super();
    this.uniforms = {
      tDiffuse: { value: null },
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uTime: { value: 0 },
    };
    for (const k of Object.keys(E2FX_DEFAULTS)) {
      this.uniforms[uName(k)] = { value: E2FX_DEFAULTS[k] };
    }
    // host-fed sun visibility for auto-tracked god rays (not a user param)
    this.uniforms.uRaysVis = { value: 1 };
    // 3D LUT atlas (host-fed via setLut) — uLutSize 1 means "no LUT loaded"
    this.uniforms.uLutTex = { value: null };
    this.uniforms.uLutSize = { value: 1 };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
    this.enabled = false; // neutral by default — zero cost, zero risk
    this.needsSwap = true;
  }

  /** True when every ACTIVATOR parameter is at its neutral value. */
  static isNeutral(p) {
    const eps = 1e-4;
    for (const k of Object.keys(PRIMARY)) {
      const v = p[k] != null ? p[k] : E2FX_DEFAULTS[k];
      if (Math.abs(v - PRIMARY[k]) > eps) return false;
    }
    const post = p.posterize != null ? p.posterize : 0;
    const pix = p.pixelate != null ? p.pixelate : 0;
    if (post >= 1.5 || pix >= 1.5) return false;
    return true;
  }

  /** Apply a params object (E2FX_DEFAULTS shape). Auto-enables/disables. */
  setParams(p = {}) {
    for (const k of Object.keys(E2FX_DEFAULTS)) {
      const u = this.uniforms[uName(k)];
      if (u) u.value = p[k] != null ? p[k] : E2FX_DEFAULTS[k];
    }
    this.enabled = !Engine2FxPass.isNeutral(p);
    return this.enabled;
  }

  /** Bind a LUT atlas texture (see buildLutAtlasData). Pass null to clear. */
  setLut(texture, size) {
    this.uniforms.uLutTex.value = texture || null;
    this.uniforms.uLutSize.value = texture ? Math.max(2, size | 0) : 1;
  }

  setSize(w, h) {
    this.uniforms.uRes.value.set(Math.max(1, w), Math.max(1, h));
  }

  render(renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.uTime.value = performance.now() * 0.001;
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) renderer.clear();
    }
    this.fsQuad.render(renderer);
  }

  dispose() {
    try { this.material.dispose(); } catch (_) {}
    try { this.fsQuad.dispose(); } catch (_) {}
  }
}

/* ============================================================================
   LUT file parsing — .cube (Adobe/Resolve/IWLTBAP) and .3dl (Autodesk).
   Both return { size, data: Float32Array(size^3 * 3) } with values 0..1 and
   RED varying fastest (index = r + g*N + b*N*N). Throws on malformed input.
   ========================================================================= */

export function parseCubeLut(text) {
  let size = 0;
  let domMin = [0, 0, 0], domMax = [1, 1, 1];
  const vals = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const up = line.toUpperCase();
    if (up.startsWith("TITLE")) continue;
    if (up.startsWith("LUT_1D_SIZE")) throw new Error("1D LUTs are not supported — need a 3D .cube");
    if (up.startsWith("LUT_3D_SIZE")) { size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (up.startsWith("DOMAIN_MIN")) { domMin = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    if (up.startsWith("DOMAIN_MAX")) { domMax = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    const parts = line.split(/\s+/);
    if (parts.length < 3 || isNaN(Number(parts[0]))) continue; // unknown keyword
    vals.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }
  if (!(size >= 2)) throw new Error("LUT_3D_SIZE missing or invalid");
  if (vals.length !== size * size * size * 3) {
    throw new Error("LUT data length mismatch: got " + vals.length / 3 + " entries, expected " + size * size * size);
  }
  const data = new Float32Array(vals.length);
  for (let c = 0; c < 3; c++) {
    const lo = domMin[c] || 0, span = (domMax[c] - lo) || 1;
    for (let i = c; i < vals.length; i += 3) {
      data[i] = Math.min(1, Math.max(0, (vals[i] - lo) / span));
    }
  }
  return { size, data }; // .cube is already red-fastest
}

export function parse3dlLut(text) {
  const lines = String(text).split(/\r?\n/)
    .map((l) => l.replace(/[#;].*$/, "").trim())
    .filter((l) => l && !/^[A-Za-z]/.test(l)); // drop keywords (Mesh, etc.)
  if (!lines.length) throw new Error("empty .3dl");
  // first numeric line = the grid mesh (N ascending values)
  const mesh = lines[0].split(/\s+/).map(Number);
  const size = mesh.length;
  if (size < 2 || mesh.some(isNaN)) throw new Error(".3dl mesh line invalid");
  const raw = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(/\s+/).map(Number);
    if (p.length >= 3 && !p.some(isNaN)) raw.push(p[0], p[1], p[2]);
  }
  if (raw.length !== size * size * size * 3) {
    throw new Error(".3dl data length mismatch: got " + raw.length / 3 + " entries, expected " + size * size * size);
  }
  let mx = 0;
  for (const v of raw) mx = Math.max(mx, v);
  const scale = mx <= 255 ? 255 : mx <= 1023 ? 1023 : mx <= 4095 ? 4095 : 65535;
  // .3dl ordering: RED slowest, BLUE fastest -> remap to red-fastest
  const data = new Float32Array(raw.length);
  let i3 = 0;
  for (let r = 0; r < size; r++) {
    for (let g = 0; g < size; g++) {
      for (let b = 0; b < size; b++, i3 += 3) {
        const o = (r + g * size + b * size * size) * 3;
        data[o]     = Math.min(1, Math.max(0, raw[i3]     / scale));
        data[o + 1] = Math.min(1, Math.max(0, raw[i3 + 1] / scale));
        data[o + 2] = Math.min(1, Math.max(0, raw[i3 + 2] / scale));
      }
    }
  }
  return { size, data };
}

/** Auto-detect by content: .cube has LUT_3D_SIZE, .3dl starts with a mesh. */
export function parseLutText(text, fileName) {
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith(".cube") || /LUT_3D_SIZE/i.test(text)) return parseCubeLut(text);
  return parse3dlLut(text);
}

/**
 * Flatten a parsed LUT into a 2D RGBA atlas: N slices of N x N side by side
 * (width N*N, height N). Slice index = blue, in-slice x = red, y = green —
 * exactly what applyLut() in the shader expects.
 */
export function buildLutAtlasData(lut) {
  const n = lut.size, w = n * n, h = n;
  const out = new Uint8Array(w * h * 4);
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const src = (r + g * n + b * n * n) * 3;
        const dst = (g * w + b * n + r) * 4;
        out[dst]     = Math.round(lut.data[src]     * 255);
        out[dst + 1] = Math.round(lut.data[src + 1] * 255);
        out[dst + 2] = Math.round(lut.data[src + 2] * 255);
        out[dst + 3] = 255;
      }
    }
  }
  return { width: w, height: h, data: out };
}
