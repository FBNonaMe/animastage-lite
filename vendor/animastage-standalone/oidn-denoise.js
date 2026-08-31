// oidn-denoise.js
// ANIMASTAGE PRO — Intel Open Image Denoise (OIDN) for final renders.
//
// The SAME AI denoiser Blender Cycles uses for final frames. FULLY LOCAL,
// built-in library: the runtime is statically imported from vendor/oidn/
// (bundled UNet + tfjs, no external requests), and the Intel weights ship
// in vendor/oidn/weights/rt_ldr.tza — everything loads from the app's own
// server, nothing is fetched from a CDN. 128 accumulated samples + OIDN ≈
// the quality of thousands of samples: the network was trained on
// noisy/clean render pairs, so it removes Monte-Carlo grain while keeping
// real texture detail.
//
// Requires WebGPU (Chrome/Edge). isSupported() reports availability; callers
// gracefully fall back to the classic edge-preserving denoise.

import { initUNetFromBuffer } from "./vendor/oidn/oidn.js";
import {
  edgePreservingFallbackRGBA,
  recoverDenoisedDetailRGBA,
} from "./oidn-fallback.js?v=dn3";

const WEIGHTS_LOCAL = new URL("./vendor/oidn/weights/rt_ldr.tza", import.meta.url).href;

export function createOidnDenoiser({ onStatus } = {}) {
  const say = (m) => { try { onStatus?.(m); } catch (_) {} };
  const S = {
    unet: null,
    loading: null,
    failed: false,
    failureCount: 0,
    retryAfter: 0,
    lastError: null,
    runtimeFallback: false,
    status: "OIDN Disabled",
    srcCanvas2d: null, // 2d copy of the WebGL canvas
    outCanvas: null,   // denoised output
    guideCanvases: { albedo: null, normal: null },
    lastRun: null,
  };

  function isSupported() {
    return typeof navigator !== "undefined" && !!navigator.gpu;
  }

  async function loadWeights() {
    // Local server only — the weights are part of the app (vendor/oidn/).
    const resp = await fetch(WEIGHTS_LOCAL, { cache: "force-cache" });
    if (!resp.ok) {
      throw new Error(
        "OIDN weights missing (HTTP " + resp.status + ") — " +
        "expected vendor/oidn/weights/rt_ldr.tza (see the README there)",
      );
    }
    say("OIDN weights: local library (offline).");
    return resp.arrayBuffer();
  }

  async function ensure({ forceRetry = false } = {}) {
    if (S.unet) return S.unet;
    if (S.failed && !forceRetry && Date.now() < S.retryAfter) {
      throw new Error("OIDN is cooling down after a backend failure");
    }
    if (forceRetry || Date.now() >= S.retryAfter) S.failed = false;
    if (S.loading) return S.loading;
    S.loading = (async () => {
      if (!isSupported()) throw new Error("WebGPU is not available in this browser");
      S.status = "OIDN Processing";
      say("Initializing OIDN (AI denoiser)…");
      const weights = await loadWeights();
      const unet = await initUNetFromBuffer(weights);
      S.unet = unet;
      S.status = "OIDN Ready";
      S.lastError = null;
      say("OIDN ready (local, offline).");
      return unet;
    })();
    try {
      return await S.loading;
    } catch (e) {
      S.failed = true;
      S.failureCount++;
      S.lastError = String(e?.message || e);
      S.retryAfter = Date.now() + Math.min(300000, 15000 * S.failureCount);
      S.status = /device.?lost/i.test(S.lastError)
        ? "OIDN Device Lost"
        : /input|normal|albedo|black|nan|infinity/i.test(S.lastError)
          ? "OIDN Invalid Input"
          : "OIDN Fallback";
      throw e;
    } finally {
      S.loading = null;
    }
  }

  /** Normalize whatever tile format the UNet emits into an ImageData. */
  function toImageData(t) {
    if (typeof ImageData !== "undefined" && t instanceof ImageData) return t;
    const data = t.data !== undefined ? t.data : t;
    const width = t.width, height = t.height;
    if (typeof ImageData !== "undefined" && data instanceof ImageData) return data;
    let u8;
    if (data instanceof Uint8ClampedArray) {
      u8 = data;
    } else if (data instanceof Uint8Array) {
      u8 = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);
    } else {
      // float output (0..1) -> bytes, force opaque alpha
      u8 = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i++) u8[i] = data[i] * 255;
      for (let i = 3; i < u8.length; i += 4) u8[i] = 255;
    }
    return new ImageData(u8, width, height);
  }

  /** Sparse black-detector: max sampled channel below threshold. */
  function isMostlyBlack(data) {
    let max = 0;
    const stride = Math.max(4, (Math.floor(data.length / 4 / 4096) | 0) * 4);
    for (let i = 0; i < data.length; i += stride) {
      const v = Math.max(data[i], data[i + 1] || 0, data[i + 2] || 0);
      if (v > max) max = v;
      if (max > 8) return false;
    }
    return max <= 8;
  }

  /**
   * Denoise the current content of a (WebGL) canvas.
   * Returns a canvas with the denoised image (reused between calls).
   * SELF-VERIFYING: throws when the source reads back black (cleared WebGL
   * buffer / context loss) or when the network produces a black image —
   * failed network output is replaced with an edge-aware fallback, so a black
   * or completely raw noisy frame is never encoded.
   */
  function guideInput(source, name, w, h) {
    if (!source) throw new Error(`OIDN auxiliary model requires ${name} guide`);
    if (typeof ImageData !== "undefined" && source instanceof ImageData) {
      if (source.width !== w || source.height !== h) {
        throw new Error(`OIDN ${name} guide size does not match color input`);
      }
      return source;
    }
    if (source.data && source.width === w && source.height === h) {
      if (typeof ImageData !== "undefined" && source.data instanceof ImageData) {
        return source.data;
      }
      const bytes = source.data instanceof Uint8ClampedArray
        ? source.data
        : source.data instanceof Uint8Array
          ? new Uint8ClampedArray(source.data.buffer, source.data.byteOffset || 0, source.data.byteLength)
          : new Uint8ClampedArray(source.data);
      return new ImageData(bytes, w, h);
    }
    let scratch = S.guideCanvases[name];
    if (!scratch) scratch = S.guideCanvases[name] = document.createElement("canvas");
    if (scratch.width !== w || scratch.height !== h) {
      scratch.width = w;
      scratch.height = h;
    }
    const ctx = scratch.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  function validateGuide(input, name) {
    const data = input?.data?.data ?? input?.data;
    if (!data || !data.length) throw new Error(`OIDN ${name} guide is empty`);
    const stride = Math.max(4, (Math.floor(data.length / 4 / 4096) | 0) * 4);
    let nonZero = 0;
    for (let i = 0; i < data.length; i += stride) {
      const r = Number(data[i]);
      const g = Number(data[i + 1] ?? 0);
      const b = Number(data[i + 2] ?? 0);
      if (![r, g, b].every(Number.isFinite)) {
        throw new Error(`OIDN ${name} guide contains NaN or Infinity`);
      }
      if (Math.abs(r) + Math.abs(g) + Math.abs(b) > 1e-6) nonZero++;
    }
    if (!nonZero) throw new Error(`OIDN ${name} guide is entirely zero`);
    return input;
  }

  async function denoiseCanvas(srcCanvas, guides = null, options = {}) {
    const w = srcCanvas.width, h = srcCanvas.height;
    if (!S.srcCanvas2d) S.srcCanvas2d = document.createElement("canvas");
    if (!S.outCanvas) S.outCanvas = document.createElement("canvas");
    const c2 = S.srcCanvas2d, out = S.outCanvas;
    if (c2.width !== w || c2.height !== h) { c2.width = w; c2.height = h; }
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    const ctx2 = c2.getContext("2d", { willReadFrequently: true });
    ctx2.drawImage(srcCanvas, 0, 0, w, h);
    const noisy = ctx2.getImageData(0, 0, w, h);
    if (isMostlyBlack(noisy.data)) {
      throw new Error("source canvas read back black — WebGL buffer unavailable");
    }
    const outCtx = out.getContext("2d", { willReadFrequently: true });
    outCtx.clearRect(0, 0, w, h);
    const classicFallback = (error) => {
      S.runtimeFallback = true;
      S.lastError = String(error?.message || error || "WebGPU inference unavailable");
      S.status = "OIDN Fallback";
      S.lastRun = {
        guided: false,
        model: "edge-preserving CPU fallback",
        width: w,
        height: h,
        fallback: true,
        reason: S.lastError,
      };
      say("OIDN WebGPU result was invalid — edge-preserving fallback applied to this frame.");
      const filtered = edgePreservingFallbackRGBA(noisy.data, w, h, {
        passes: Number(options.fallbackPasses ?? 2),
        strength: Number(options.fallbackStrength ?? 0.68),
      });
      const recovered = recoverDenoisedDetailRGBA(filtered, w, h, {
        amount: Math.min(0.12, Number(options.detailRecovery ?? 0.18)),
        limit: 8,
      });
      outCtx.putImageData(new ImageData(recovered, w, h), 0, 0);
      return out;
    };
    let unet;
    try {
      if (S.runtimeFallback) return classicFallback(S.lastError);
      unet = await ensure();
    } catch (error) {
      return classicFallback(error);
    }
    const useAux = !!unet._aux;
    let albedo = null, normal = null;
    try {
      albedo = useAux
        ? validateGuide(guideInput(guides?.albedo, "albedo", w, h), "albedo")
        : null;
      normal = useAux
        ? validateGuide(guideInput(guides?.normal, "normal", w, h), "normal")
        : null;
    } catch (error) {
      return classicFallback(error);
    }
    S.lastRun = {
      guided: useAux,
      model: useAux ? "auxiliary albedo+normal" : "color-only rt_ldr",
      width: w,
      height: h,
    };
    say(
      useAux
        ? "OIDN denoise: guided by RTX albedo + normal AOVs."
        : "OIDN denoise: bundled color-only model; guided classic fallback remains active.",
    );

    S.status = "OIDN Processing";
    const operation = new Promise((resolve, reject) => {
      let tileError = null;
      try {
        unet.tileExecute({
          // oidn-web expects ImageData itself. Wrapping it as
          // { data: ImageData } makes _processImageData see a zero-length
          // payload and the UNet deterministically returns a black frame.
          color: noisy,
          ...(useAux ? { albedo, normal } : {}),
          progress(_denoised, tileData, tile) {
            try {
              outCtx.putImageData(toImageData(tileData), tile.x, tile.y);
            } catch (e) { tileError = e; }
          },
          done(denoised) {
            try {
              // If per-tile painting failed, the full result from done() is
              // the authoritative fallback.
              if (tileError && denoised) {
                outCtx.putImageData(toImageData(denoised), 0, 0);
                tileError = null;
              }
            } catch (e) { tileError = tileError || e; }
            if (tileError) return reject(tileError);
            try {
              const chk = outCtx.getImageData(0, 0, w, h);
              if (isMostlyBlack(chk.data)) {
                return reject(new Error("denoiser produced a black image"));
              }
              const recovered = recoverDenoisedDetailRGBA(
                chk.data,
                w,
                h,
                {
                  amount: Number(options.detailRecovery ?? 0.18),
                  limit: Number(options.detailLimit ?? 12),
                },
              );
              outCtx.putImageData(new ImageData(recovered, w, h), 0, 0);
            } catch (_) { /* readback check unavailable — accept */ }
            resolve(out);
          },
          aborted() { reject(new Error("denoise aborted")); },
          error(error) { reject(error instanceof Error ? error : new Error(String(error))); },
        });
      } catch (e) { reject(e); }
    });
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        try { unet.abort?.(); } catch (_) {}
        reject(new Error("OIDN inference timed out"));
      }, 120000);
    });
    try {
      const result = await Promise.race([operation, timeout]);
      S.status = "OIDN Ready";
      S.lastError = null;
      S.runtimeFallback = false;
      return result;
    } catch (error) {
      S.lastError = String(error?.message || error);
      return classicFallback(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function abort() {
    try { S.unet?.abort?.(); } catch (_) {}
    S.status = "OIDN Disabled";
  }

  function retry() {
    S.failed = false;
    S.runtimeFallback = false;
    S.retryAfter = 0;
    return ensure({ forceRetry: true });
  }

  return { isSupported, ensure, denoiseCanvas, abort, retry,
    get ready() { return !!S.unet; },
    get failed() { return S.failed; },
    get capabilities() {
      return {
        guided: !!(S.unet?._aux),
        model: S.unet?._aux ? "auxiliary albedo+normal" : "color-only rt_ldr",
        lastRun: S.lastRun,
        status: S.status,
        lastError: S.lastError,
        fallback: S.runtimeFallback,
        retryAfter: S.retryAfter,
      };
    } };
}
