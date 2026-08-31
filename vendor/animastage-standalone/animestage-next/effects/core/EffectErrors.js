export class EffectPlatformError extends Error {
  constructor(message, { code = "EFFECT_PLATFORM_ERROR", details = null, cause } = {}) {
    super(String(message), cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class EffectManifestError extends EffectPlatformError {
  constructor(message, details = null) {
    super(message, { code: "EFFECT_MANIFEST_INVALID", details });
  }
}

export class EffectDependencyError extends EffectPlatformError {
  constructor(message, details = null) {
    super(message, { code: "EFFECT_DEPENDENCY_ERROR", details });
  }
}

export class EffectOwnershipError extends EffectPlatformError {
  constructor(message, details = null) {
    super(message, { code: "EFFECT_OWNERSHIP_ERROR", details });
  }
}

export class EffectApplyError extends EffectPlatformError {
  constructor(effectId, cause, details = null) {
    super(`Effect "${effectId}" failed and the previous state was restored: ${cause?.message || cause}`, {
      code: "EFFECT_APPLY_FAILED",
      details: { effectId, ...(details || {}) },
      cause,
    });
    this.effectId = effectId;
  }
}

export class EffectPackageSecurityError extends EffectPlatformError {
  constructor(message, details = null) {
    super(message, { code: "EFFECT_PACKAGE_SECURITY", details });
  }
}

export class ShaderCompilationError extends EffectPlatformError {
  constructor(message, { diagnostics = [], backend = "unknown", sourceId = null, stage = null, cause } = {}) {
    super(message, {
      code: "SHADER_COMPILATION_FAILED",
      details: { backend, sourceId, stage, diagnostics },
      cause,
    });
    this.backend = backend;
    this.sourceId = sourceId;
    this.stage = stage;
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}

export class ShaderBackendUnavailableError extends EffectPlatformError {
  constructor(backend, message, details = null) {
    super(message || `Shader backend "${backend}" is unavailable`, {
      code: "SHADER_BACKEND_UNAVAILABLE",
      details: { backend, ...(details || {}) },
    });
    this.backend = backend;
  }
}
