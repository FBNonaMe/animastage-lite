"use strict";

export const RTX_LENS_STATE_VERSION = 2;

export const RTX_FOCUS_MODES = Object.freeze({
  MANUAL: "manualDistance",
  TARGET_OBJECT: "targetObject",
  TARGET_BONE: "targetBone",
  CAMERA_TARGET: "cameraTarget",
  CENTER_RAY: "centerRay",
  TIMELINE: "timelineAnimated",
  DISABLED: "disabled",
});

const VALID_FOCUS_MODES = new Set(Object.values(RTX_FOCUS_MODES));
const EPS = 1e-6;

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance3(a, b) {
  if (!a || !b) return NaN;
  return Math.hypot(
    finite(a.x, 0) - finite(b.x, 0),
    finite(a.y, 0) - finite(b.y, 0),
    finite(a.z, 0) - finite(b.z, 0),
  );
}

function clonePoint(value) {
  if (!value) return null;
  const x = Number(value.x), y = Number(value.y), z = Number(value.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

export function focalLengthMmToVerticalFovDeg(focalLengthMm, sensorHeightMm) {
  const focal = Math.max(EPS, finite(focalLengthMm, 50));
  const sensor = Math.max(EPS, finite(sensorHeightMm, 24));
  return (2 * Math.atan(sensor / (2 * focal)) * 180) / Math.PI;
}

export function verticalFovDegToFocalLengthMm(verticalFovDeg, sensorHeightMm) {
  const fov = clamp(finite(verticalFovDeg, 35), 0.1, 179);
  const sensor = Math.max(EPS, finite(sensorHeightMm, 24));
  return sensor / (2 * Math.tan((fov * Math.PI) / 360));
}

export function sensorHeightFromWidthMm(sensorWidthMm, aspect) {
  const width = Math.max(EPS, finite(sensorWidthMm, 36));
  const safeAspect = Math.max(EPS, finite(aspect, 1.5));
  return width / safeAspect;
}

export function fStopToApertureRadiusWorld(
  focalLengthMm,
  fStop,
  worldUnitsPerMeter = 10,
) {
  const focal = Math.max(EPS, finite(focalLengthMm, 50));
  const stop = Math.max(0.1, finite(fStop, 2.8));
  const unitsPerMeter = Math.max(EPS, finite(worldUnitsPerMeter, 10));
  const radiusMm = focal / stop / 2;
  return (radiusMm / 1000) * unitsPerMeter;
}

export function apertureRadiusWorldToFStop(
  focalLengthMm,
  apertureRadiusWorld,
  worldUnitsPerMeter = 10,
) {
  const focal = Math.max(EPS, finite(focalLengthMm, 50));
  const unitsPerMeter = Math.max(EPS, finite(worldUnitsPerMeter, 10));
  const radiusMm = (Math.max(EPS, finite(apertureRadiusWorld, 0.1)) / unitsPerMeter) * 1000;
  return focal / (radiusMm * 2);
}

export function exponentialSmoothingAlpha(speedPerSecond, deltaSeconds) {
  const speed = Math.max(0, finite(speedPerSecond, 0));
  const dt = Math.max(0, finite(deltaSeconds, 0));
  return 1 - Math.exp(-speed * dt);
}

function defaultPersistentState() {
  return {
    version: RTX_LENS_STATE_VERSION,
    enabled: false,
    focusMode: RTX_FOCUS_MODES.CAMERA_TARGET,
    focusDistance: 12,
    focusTargetId: null,
    focusTargetBone: null,
    focusOffset: 0,
    focusSmoothing: 7,
    focalMode: "cameraFov",
    focalLengthMm: 50,
    sensorWidthMm: 36,
    sensorHeightMm: 24,
    fStop: 1.8,
    apertureRadiusWorld: 0.35,
    apertureSource: "worldRadius",
    worldUnitsPerMeter: 10,
    bladeCount: 6,
    bladeRotation: 0.3,
    anamorphicRatio: 1,
    catEye: 0,
  };
}

/**
 * The only authoritative owner of RTX physical-lens state.
 *
 * Persistent values are serializable. Runtime values are derived once per
 * frame. GPU bindings are generation-checked so a recreated pass cannot keep
 * stale uniform references.
 */
export class RtxLensSystem {
  constructor(options = {}) {
    this.state = defaultPersistentState();
    this.runtime = {
      effectiveFocusDistance: this.state.focusDistance,
      requestedFocusDistance: this.state.focusDistance,
      apertureRadiusWorld: 0,
      focalLengthMm: this.state.focalLengthMm,
      sensorHeightMm: this.state.sensorHeightMm,
      focusTargetPoint: null,
      timelineTime: 0,
    };
    this.camera = null;
    this.pass = null;
    this.uniforms = null;
    this.rendererGeneration = 0;
    this.passGeneration = 0;
    this.bindingGeneration = -1;
    this._boundPassGeneration = -1;
    this._lastGpuSignature = "";
    this._lastValidCenterRayDistance = null;
    this._onInvalidate = options.onInvalidate || (() => {});
    this._onDiagnostic = options.onDiagnostic || (() => {});
    this.diagnostics = {
      status: "RTX DOF Camera Not Bound",
      bindingStatus: "unbound",
      lastResetReason: "initialization",
      lastUpdateTime: 0,
      lastError: null,
      rendererGeneration: 0,
      passGeneration: 0,
      bindingGeneration: -1,
    };
    if (options.state) this.deserialize(options.state, { invalidate: false });
  }

  bindCamera(camera) {
    if (camera === this.camera) return false;
    this.camera = camera || null;
    this.invalidate(camera ? "camera-bound" : "camera-unbound");
    return true;
  }

  bindPass(pass, generation = this.passGeneration + 1) {
    this.pass = pass || null;
    this.passGeneration = Math.max(0, Math.floor(finite(generation, this.passGeneration + 1)));
    this.uniforms = null;
    this._boundPassGeneration = -1;
    this.bindingGeneration = -1;
    this._lastGpuSignature = "";
    this.diagnostics.passGeneration = this.passGeneration;
    this.diagnostics.bindingStatus = "rebind-required";
    this.invalidate(pass ? "rtx-pass-bound" : "rtx-pass-unbound");
    return !!pass;
  }

  markRendererReinitialized(generation = this.rendererGeneration + 1) {
    this.rendererGeneration = Math.max(0, Math.floor(finite(generation, this.rendererGeneration + 1)));
    this.diagnostics.rendererGeneration = this.rendererGeneration;
    this.bindingGeneration = -1;
    this.diagnostics.bindingStatus = "renderer-rebind-required";
    this.invalidate("renderer-reinitialized");
  }

  setEnabled(value) { return this._set("enabled", !!value, "lens-enabled"); }

  setFocusMode(mode) {
    const next = VALID_FOCUS_MODES.has(mode) ? mode : RTX_FOCUS_MODES.MANUAL;
    return this._set("focusMode", next, "focus-mode");
  }

  setFocusDistance(value) {
    return this._set("focusDistance", clamp(finite(value, this.state.focusDistance), 0.001, 1e6), "focus-distance");
  }

  setFocusTarget(targetOrPosition, options = {}) {
    if (typeof targetOrPosition === "string") {
      this.state.focusTargetId = targetOrPosition;
      this.state.focusTargetBone = options.boneName || null;
      this.runtime.focusTargetPoint = null;
    } else {
      this.state.focusTargetId = options.id || null;
      this.state.focusTargetBone = options.boneName || null;
      this.runtime.focusTargetPoint = clonePoint(targetOrPosition);
    }
    this.invalidate("focus-target");
  }

  setFocusOffset(value) { return this._set("focusOffset", finite(value, 0), "focus-offset"); }

  setAperture(valueWorld) {
    const changed = this._set(
      "apertureRadiusWorld",
      clamp(finite(valueWorld, this.state.apertureRadiusWorld), 0, 100),
      "aperture-radius",
      false,
    );
    this.state.apertureSource = "worldRadius";
    this.state.fStop = apertureRadiusWorldToFStop(
      this.state.focalLengthMm,
      Math.max(this.state.apertureRadiusWorld, EPS),
      this.state.worldUnitsPerMeter,
    );
    if (changed) this.invalidate("aperture-radius");
    return changed;
  }

  setFStop(value) {
    const changed = this._set("fStop", clamp(finite(value, this.state.fStop), 0.1, 128), "f-stop", false);
    this.state.apertureSource = "fStop";
    if (changed) this.invalidate("f-stop");
    return changed;
  }

  setFocalLengthMm(value, options = {}) {
    const changed = this._set(
      "focalLengthMm",
      clamp(finite(value, this.state.focalLengthMm), 1, 2000),
      "focal-length",
      false,
    );
    if (options.lockToPhysical !== false) this.state.focalMode = "physical";
    if (changed) this.invalidate("focal-length");
    return changed;
  }

  setSensorWidthMm(value) {
    return this._set("sensorWidthMm", clamp(finite(value, this.state.sensorWidthMm), 1, 200), "sensor-width");
  }

  setSensorHeightMm(value) {
    return this._set("sensorHeightMm", clamp(finite(value, this.state.sensorHeightMm), 1, 200), "sensor-height");
  }

  setBladeCount(value) {
    return this._set("bladeCount", clamp(Math.round(finite(value, this.state.bladeCount)), 0, 16), "blade-count");
  }

  setBladeRotation(value) { return this._set("bladeRotation", finite(value, this.state.bladeRotation), "blade-rotation"); }

  setAnamorphicRatio(value) {
    return this._set("anamorphicRatio", clamp(finite(value, this.state.anamorphicRatio), 0.25, 4), "anamorphic-ratio");
  }

  setWorldUnitsPerMeter(value) {
    return this._set("worldUnitsPerMeter", clamp(finite(value, this.state.worldUnitsPerMeter), 0.001, 1e5), "world-scale");
  }

  _set(key, value, reason, invalidate = true) {
    if (Object.is(this.state[key], value)) return false;
    this.state[key] = value;
    if (invalidate) this.invalidate(reason);
    return true;
  }

  invalidate(reason = "lens-state") {
    this.diagnostics.lastResetReason = reason;
    try { this._onInvalidate(reason, this); } catch (_) {}
  }

  _resolveTargetPoint(context) {
    if (this.runtime.focusTargetPoint) return this.runtime.focusTargetPoint;
    if (!this.state.focusTargetId) return null;
    try {
      const point = context.resolveFocusTarget?.({
        id: this.state.focusTargetId,
        boneName: this.state.focusTargetBone,
        mode: this.state.focusMode,
      });
      return clonePoint(point);
    } catch (error) {
      this._setError("Focus target resolution failed: " + (error?.message || error));
      return null;
    }
  }

  updateFromCamera(camera = this.camera, _scene = null, timelineTime = 0, context = {}) {
    if (camera && camera !== this.camera) this.bindCamera(camera);
    const validation = this.validate({ requireUniforms: false });
    if (!validation.ok) return validation;

    const aspect = Math.max(EPS, finite(camera.aspect, 1.5));
    const sensorHeight = this.state.sensorHeightMm > 0
      ? this.state.sensorHeightMm
      : sensorHeightFromWidthMm(this.state.sensorWidthMm, aspect);

    let focalLength = this.state.focalLengthMm;
    if (this.state.focalMode === "cameraFov") {
      focalLength = verticalFovDegToFocalLengthMm(camera.fov, sensorHeight);
    } else if (context.applyPhysicalFov !== false) {
      const nextFov = focalLengthMmToVerticalFovDeg(focalLength, sensorHeight);
      if (Math.abs(finite(camera.fov, nextFov) - nextFov) > 1e-5) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix?.();
      }
    }

    let requested = this.state.focusDistance;
    let targetPoint = null;
    const mode = this.state.enabled ? this.state.focusMode : RTX_FOCUS_MODES.DISABLED;
    if (mode === RTX_FOCUS_MODES.CAMERA_TARGET) {
      targetPoint = clonePoint(context.cameraTarget);
      if (targetPoint) requested = distance3(camera.position, targetPoint);
    } else if (mode === RTX_FOCUS_MODES.TARGET_OBJECT || mode === RTX_FOCUS_MODES.TARGET_BONE) {
      targetPoint = this._resolveTargetPoint(context);
      if (targetPoint) requested = distance3(camera.position, targetPoint);
      else {
        const fallback = clonePoint(context.cameraTarget);
        if (fallback) {
          targetPoint = fallback;
          requested = distance3(camera.position, fallback);
          this.diagnostics.status = "RTX DOF Focus Target Missing — Camera Target Fallback";
        }
      }
    } else if (mode === RTX_FOCUS_MODES.CENTER_RAY) {
      const rayDistance = finite(context.centerRayDistance, NaN);
      if (Number.isFinite(rayDistance) && rayDistance > 0) {
        requested = rayDistance;
        this._lastValidCenterRayDistance = rayDistance;
      } else if (this._lastValidCenterRayDistance != null) {
        requested = this._lastValidCenterRayDistance;
      }
    } else if (mode === RTX_FOCUS_MODES.TIMELINE) {
      requested = finite(context.timelineFocusDistance, this.state.focusDistance);
    }
    requested = clamp(finite(requested, this.state.focusDistance) + this.state.focusOffset, 0.001, 1e6);

    const offline = !!context.offline;
    const current = finite(this.runtime.effectiveFocusDistance, requested);
    const alpha = offline
      ? 1
      : exponentialSmoothingAlpha(this.state.focusSmoothing, context.deltaTime ?? 0);
    const effective = context.forceFocus || !Number.isFinite(current)
      ? requested
      : current + (requested - current) * alpha;

    let apertureRadius = 0;
    if (this.state.enabled && mode !== RTX_FOCUS_MODES.DISABLED) {
      apertureRadius = this.state.apertureSource === "fStop"
        ? fStopToApertureRadiusWorld(focalLength, this.state.fStop, this.state.worldUnitsPerMeter)
        : this.state.apertureRadiusWorld;
    }

    this.runtime.requestedFocusDistance = requested;
    this.runtime.effectiveFocusDistance = clamp(finite(effective, requested), 0.001, 1e6);
    this.runtime.apertureRadiusWorld = clamp(finite(apertureRadius, 0), 0, 100);
    this.runtime.focalLengthMm = focalLength;
    this.runtime.sensorHeightMm = sensorHeight;
    this.runtime.focusTargetPoint = targetPoint;
    this.runtime.timelineTime = finite(timelineTime, 0);
    this.diagnostics.lastUpdateTime = Date.now();
    this._updateStatus();
    return { ok: true, runtime: this.runtime };
  }

  _uniformSetIsValid(uniforms) {
    return !!(
      uniforms?.uAperture &&
      uniforms?.uFocusDist &&
      uniforms?.uBlades &&
      uniforms?.uBladeRot &&
      uniforms?.uAnamorphic
    );
  }

  _ensureBinding() {
    if (!this.pass?.traceUniforms) {
      this.uniforms = null;
      this.diagnostics.bindingStatus = "pass-unavailable";
      return false;
    }
    const mustRebind =
      this.uniforms !== this.pass.traceUniforms ||
      this._boundPassGeneration !== this.passGeneration ||
      this.bindingGeneration !== this.rendererGeneration;
    if (mustRebind) {
      this.uniforms = this.pass.traceUniforms;
      this._boundPassGeneration = this.passGeneration;
      this.bindingGeneration = this.rendererGeneration;
      this.diagnostics.bindingGeneration = this.bindingGeneration;
      this.diagnostics.bindingStatus = this._uniformSetIsValid(this.uniforms)
        ? "bound"
        : "uniforms-missing";
      if (!this._uniformSetIsValid(this.uniforms)) return false;
      this.invalidate("lens-uniforms-rebound");
    }
    return this._uniformSetIsValid(this.uniforms);
  }

  writeUniforms(targetUniforms = null) {
    if (targetUniforms && targetUniforms !== this.uniforms) {
      this.uniforms = targetUniforms;
      this._boundPassGeneration = this.passGeneration;
      this.bindingGeneration = this.rendererGeneration;
    } else if (!this._ensureBinding()) {
      this._setError("RTX DOF Uniform Binding Lost");
      return { ok: false, reason: "uniform-binding-lost" };
    }
    const validation = this.validate({ requireUniforms: true });
    if (!validation.ok) return validation;

    const u = this.uniforms;
    u.uAperture.value = this.runtime.apertureRadiusWorld;
    u.uFocusDist.value = this.runtime.effectiveFocusDistance;
    u.uBlades.value = this.state.bladeCount;
    u.uBladeRot.value = this.state.bladeRotation;
    u.uAnamorphic.value = this.state.anamorphicRatio;

    const signature = [
      this.state.enabled ? 1 : 0,
      this.runtime.apertureRadiusWorld.toFixed(6),
      this.runtime.effectiveFocusDistance.toFixed(5),
      this.runtime.focalLengthMm.toFixed(4),
      this.state.bladeCount,
      this.state.bladeRotation.toFixed(5),
      this.state.anamorphicRatio.toFixed(5),
    ].join("|");
    if (this._lastGpuSignature && signature !== this._lastGpuSignature) {
      this.invalidate("lens-gpu-state-changed");
    }
    this._lastGpuSignature = signature;
    this.diagnostics.bindingStatus = "bound";
    this.diagnostics.lastError = null;
    this._updateStatus();
    return { ok: true, signature };
  }

  validate(options = {}) {
    if (!this.camera) return this._invalid("camera-not-bound", "RTX DOF Camera Not Bound");
    if (!Number.isFinite(this.state.focalLengthMm) || this.state.focalLengthMm <= 0)
      return this._invalid("invalid-focal-length", "RTX DOF Invalid Focal Length");
    if (!Number.isFinite(this.state.sensorWidthMm) || this.state.sensorWidthMm <= 0)
      return this._invalid("invalid-sensor", "RTX DOF Invalid Sensor Size");
    if (!Number.isFinite(this.runtime.effectiveFocusDistance) || this.runtime.effectiveFocusDistance <= 0)
      return this._invalid("invalid-focus", "RTX DOF Invalid Focus Distance");
    if (!Number.isFinite(this.runtime.apertureRadiusWorld) || this.runtime.apertureRadiusWorld < 0)
      return this._invalid("invalid-aperture", "RTX DOF Invalid Aperture");
    if (options.requireUniforms && !this._uniformSetIsValid(this.uniforms))
      return this._invalid("uniform-binding-lost", "RTX DOF Uniform Binding Lost");
    return { ok: true };
  }

  _invalid(reason, status) {
    this.diagnostics.status = status;
    this.diagnostics.lastError = status;
    try { this._onDiagnostic(this.getDiagnostics()); } catch (_) {}
    return { ok: false, reason };
  }

  _setError(message) {
    this.diagnostics.lastError = message;
    this.diagnostics.status = message;
    try { this._onDiagnostic(this.getDiagnostics()); } catch (_) {}
  }

  _updateStatus() {
    if (!this.state.enabled || this.state.focusMode === RTX_FOCUS_MODES.DISABLED) {
      this.diagnostics.status = "RTX DOF Disabled by User";
    } else if (this.runtime.apertureRadiusWorld <= 1e-5) {
      this.diagnostics.status = "RTX DOF Aperture Too Small";
    } else if (this.diagnostics.bindingStatus !== "bound") {
      this.diagnostics.status = "RTX DOF Uniform Binding Lost";
    } else {
      this.diagnostics.status = "RTX DOF Active";
    }
    try { this._onDiagnostic(this.getDiagnostics()); } catch (_) {}
  }

  serialize() {
    return { ...this.state, version: RTX_LENS_STATE_VERSION };
  }

  deserialize(data, options = {}) {
    if (!data || typeof data !== "object") return false;
    const next = defaultPersistentState();
    const legacy = data.version == null || data.version < RTX_LENS_STATE_VERSION;

    if (legacy) {
      next.enabled = !!(data.enabled ?? data.dofOn);
      next.focusMode = data.focusMode || (finite(data.focusDist, 0) > 0
        ? RTX_FOCUS_MODES.MANUAL
        : RTX_FOCUS_MODES.CAMERA_TARGET);
      next.focusDistance = finite(data.focusDistance ?? data.focusDist ?? data.dofFocus, next.focusDistance);
      next.focalLengthMm = finite(data.focalLengthMm ?? data.dofFocalMm, next.focalLengthMm);
      next.apertureRadiusWorld = finite(data.apertureRadiusWorld ?? data.lensAperture ?? data.aperture, next.apertureRadiusWorld);
      next.apertureSource = "worldRadius";
      next.bladeCount = Math.round(finite(data.bladeCount ?? data.blades ?? data.dofBlades, next.bladeCount));
      next.bladeRotation = finite(data.bladeRotation ?? data.bladeRot ?? data.dofBladeRot, next.bladeRotation);
    } else {
      Object.assign(next, data);
    }

    next.version = RTX_LENS_STATE_VERSION;
    next.focusMode = VALID_FOCUS_MODES.has(next.focusMode) ? next.focusMode : RTX_FOCUS_MODES.MANUAL;
    next.focusDistance = clamp(finite(next.focusDistance, 12), 0.001, 1e6);
    next.focalLengthMm = clamp(finite(next.focalLengthMm, 50), 1, 2000);
    next.sensorWidthMm = clamp(finite(next.sensorWidthMm, 36), 1, 200);
    next.sensorHeightMm = clamp(finite(next.sensorHeightMm, 24), 1, 200);
    next.fStop = clamp(finite(next.fStop, 1.8), 0.1, 128);
    next.apertureRadiusWorld = clamp(finite(next.apertureRadiusWorld, 0.35), 0, 100);
    next.worldUnitsPerMeter = clamp(finite(next.worldUnitsPerMeter, 10), 0.001, 1e5);
    next.bladeCount = clamp(Math.round(finite(next.bladeCount, 6)), 0, 16);
    next.bladeRotation = finite(next.bladeRotation, 0.3);
    next.anamorphicRatio = clamp(finite(next.anamorphicRatio, 1), 0.25, 4);
    this.state = next;
    this.runtime.requestedFocusDistance = next.focusDistance;
    this.runtime.effectiveFocusDistance = next.focusDistance;
    this._lastGpuSignature = "";
    if (options.invalidate !== false) this.invalidate(legacy ? "legacy-lens-migrated" : "lens-deserialized");
    return true;
  }

  getDiagnostics() {
    return {
      ...this.diagnostics,
      enabled: this.state.enabled,
      focusMode: this.state.focusMode,
      requestedFocusDistance: this.runtime.requestedFocusDistance,
      effectiveFocusDistance: this.runtime.effectiveFocusDistance,
      apertureRadiusWorld: this.runtime.apertureRadiusWorld,
      fStop: this.state.fStop,
      focalLengthMm: this.runtime.focalLengthMm,
      sensorWidthMm: this.state.sensorWidthMm,
      focusTargetId: this.state.focusTargetId,
      rendererGeneration: this.rendererGeneration,
      passGeneration: this.passGeneration,
      bindingGeneration: this.bindingGeneration,
    };
  }
}

