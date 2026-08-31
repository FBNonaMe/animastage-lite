"use strict";

export const RTX_PIPELINE_MODES = Object.freeze({
  RASTER: "raster",
  RTX_VIEWPORT: "rtxViewport",
  RTX_OFFLINE: "rtxOffline",
});

const VALID_MODES = new Set(Object.values(RTX_PIPELINE_MODES));

/**
 * Small transaction used by still/video export. Every mutation registers its
 * inverse immediately, so failure, cancellation and success share one cleanup
 * path. restore() is deliberately idempotent.
 */
export class RenderStateTransaction {
  constructor(label = "render-session") {
    this.label = label;
    this._restorers = [];
    this.restored = false;
    this.restoreErrors = [];
  }

  defer(label, restore) {
    if (this.restored) throw new Error(`${this.label} is already restored`);
    if (typeof restore !== "function") throw new TypeError("restore must be a function");
    this._restorers.push({ label, restore });
    return this;
  }

  set(target, key, value, label = String(key)) {
    if (!target) throw new TypeError(`Cannot set ${label} on an empty target`);
    const previous = target[key];
    this.defer(label, () => { target[key] = previous; });
    target[key] = value;
    return previous;
  }

  capture(label, getter, setter) {
    const previous = getter();
    this.defer(label, () => setter(previous));
    return previous;
  }

  restore() {
    if (this.restored) return { ok: this.restoreErrors.length === 0, errors: this.restoreErrors };
    this.restored = true;
    for (let i = this._restorers.length - 1; i >= 0; i--) {
      const entry = this._restorers[i];
      try {
        entry.restore();
      } catch (error) {
        this.restoreErrors.push({ label: entry.label, error });
      }
    }
    this._restorers.length = 0;
    return { ok: this.restoreErrors.length === 0, errors: this.restoreErrors };
  }
}

/** One owner for Raster/RTX pass policy, frame lens sync and lifecycle. */
export class RenderPipelineController {
  constructor(options = {}) {
    this.passes = options.passes || {};
    this.rtxPass = options.rtxPass || this.passes.patchRtxPass || null;
    this.lensSystem = options.lensSystem || null;
    this.renderer = options.renderer || null;
    this.camera = options.camera || null;
    this.scene = options.scene || null;
    this.mode = RTX_PIPELINE_MODES.RASTER;
    this.settings = {};
    this.rendererGeneration = 0;
    this.passGeneration = 0;
    this.lastInvariantError = null;
    this._lastPassSignature = "";
    this._onDiagnostic = options.onDiagnostic || (() => {});
  }

  setMode(mode, settings = this.settings) {
    const next = VALID_MODES.has(mode) ? mode : RTX_PIPELINE_MODES.RASTER;
    const changed = next !== this.mode;
    this.mode = next;
    this.applyPassPolicy(settings);
    if (changed && this.rtxPass && next !== RTX_PIPELINE_MODES.RASTER) {
      this.rtxPass.resetAccumulation?.(true);
    }
    return changed;
  }

  applyPassPolicy(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    const s = this.settings;
    const rtx = this.mode !== RTX_PIPELINE_MODES.RASTER;
    const animeNpr = !rtx && !!s.animeNprOn;
    const p = this.passes;
    if (p.renderPass) p.renderPass.enabled = !rtx && !s.taa;
    if (p.taaPass) p.taaPass.enabled = !rtx && !!s.taa;
    if (p.ssaoPass) p.ssaoPass.enabled = !rtx && !!s.ssaoOn;
    if (p.bokehPass) p.bokehPass.enabled = !rtx && !!s.dofOn;
    if (p.volLightPass) p.volLightPass.enabled = !rtx && !!s.volOn;
    // StarRail NPR owns its selective 4-mip bloom. Running UnrealBloomPass
    // too doubled the full-screen cost and over-bloomed the image.
    if (p.bloomPass) p.bloomPass.enabled = !!s.bloomOn && !animeNpr;
    if (p.animeNprShadowPass) p.animeNprShadowPass.enabled = animeNpr;
    if (p.animeNprHairDepthPass) p.animeNprHairDepthPass.enabled = animeNpr;
    if (p.animeNprPost) p.animeNprPost.enabled = animeNpr;
    if (p.finalFxPass) p.finalFxPass.enabled = true;
    // FXAA remains a compatibility fallback only: it softens high-frequency
    // MMD detail. SMAA owns raster edge cleanup; RTX uses stochastic jitter.
    if (p.fxaaPass) p.fxaaPass.enabled = false;
    if (p.smaaPass) p.smaaPass.enabled = !rtx;
    if (p.outputPass) p.outputPass.enabled = true;
    if (this.rtxPass) this.rtxPass.enabled = rtx;
    if (p.rtxOverlayPass) {
      // Weather overlay draws the precipitation layer on top in EVERY
      // viewport mode (raster / anime / path-tracer / rtx) so rain & snow
      // are mode-independent. Only skipped for RTX offline export, which
      // composites weather through its own path. The pass itself early-outs
      // when no weather is active, so this is free when it's off.
      p.rtxOverlayPass.enabled = this.mode !== RTX_PIPELINE_MODES.RTX_OFFLINE;
    }
    const signature = [this.mode, !!s.taa, !!s.ssaoOn, !!s.dofOn, !!s.volOn, !!s.bloomOn, animeNpr].join("|");
    if (this._lastPassSignature && signature !== this._lastPassSignature && rtx) {
      this.rtxPass?.resetAccumulation?.();
    }
    this._lastPassSignature = signature;
    return this.assertInvariants();
  }

  beginFrame(context = {}) {
    if (this.mode === RTX_PIPELINE_MODES.RASTER) return { ok: true, skipped: "raster" };
    const update = this.lensSystem?.updateFromCamera?.(
      context.camera || this.camera,
      context.scene || this.scene,
      context.timelineTime || 0,
      context,
    );
    const invariant = this.assertInvariants();
    return { ok: invariant.ok && update?.ok !== false, lens: update, invariant };
  }

  handleResize(width, height, pixelRatio = 1) {
    const w = Math.max(2, Math.round(Number(width) * Number(pixelRatio || 1)));
    const h = Math.max(2, Math.round(Number(height) * Number(pixelRatio || 1)));
    this.rtxPass?.setSize?.(w, h);
    this.rtxPass?.resetAccumulation?.(true);
    return { width: w, height: h };
  }

  handleContextRestored(renderer = this.renderer) {
    this.renderer = renderer;
    this.rendererGeneration++;
    this.lensSystem?.markRendererReinitialized?.(this.rendererGeneration);
    this.rtxPass?.resetAccumulation?.(true);
  }

  handleRtxPassRecreated(pass) {
    this.rtxPass = pass;
    this.passes.patchRtxPass = pass;
    this.passGeneration++;
    pass?.setLensSystem?.(this.lensSystem);
    this.lensSystem?.bindPass?.(pass, this.passGeneration);
    this.applyPassPolicy();
  }

  beginExport({ rtx = false } = {}) {
    const transaction = new RenderStateTransaction("offline-export");
    const previousMode = this.mode;
    transaction.defer("pipeline-mode", () => this.setMode(previousMode, this.settings));
    this.setMode(rtx ? RTX_PIPELINE_MODES.RTX_OFFLINE : RTX_PIPELINE_MODES.RASTER, this.settings);
    return transaction;
  }

  assertInvariants() {
    const p = this.passes;
    const rtx = this.mode !== RTX_PIPELINE_MODES.RASTER;
    let error = null;
    if (rtx && p.bokehPass?.enabled) error = "Raster BokehPass cannot run in RTX mode";
    else if (rtx && p.renderPass?.enabled) error = "RenderPass cannot run under the RTX beauty pass";
    else if (rtx && !this.rtxPass?.enabled) error = "RTX mode selected but RTX pass is disabled";
    else if (!rtx && this.rtxPass?.enabled) error = "Raster mode selected but RTX pass is enabled";
    this.lastInvariantError = error;
    const result = { ok: !error, error, mode: this.mode };
    if (error) {
      try { this._onDiagnostic(result); } catch (_) {}
    }
    return result;
  }

  getDiagnostics() {
    return {
      mode: this.mode,
      rendererGeneration: this.rendererGeneration,
      passGeneration: this.passGeneration,
      invariant: this.assertInvariants(),
      lens: this.lensSystem?.getDiagnostics?.() || null,
    };
  }
}
