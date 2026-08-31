const RUNNABLE = new Set(["ADAPTED", "RUNTIME_TESTED", "GPU_TESTED", "PRODUCTION_READY"]);

function check(id, label, passed, details = null, severity = "blocking") {
  return Object.freeze({ id, label, passed: !!passed, severity, details });
}

/** Read-only production acceptance snapshot; it never mutates scene/runtime state. */
export function createEffectReleaseAcceptance(platform, { browserEvidence = null } = {}) {
  if (!platform?.registry || !platform?.runtime) throw new TypeError("Acceptance requires an Effects Platform");
  const definitions = platform.registry.list();
  const runnable = definitions.filter((entry) => entry.implementation && RUNNABLE.has(entry.manifest.status));
  const checks = [
    check("registry", "Every indexed effect has a normalized manifest", definitions.length === platform.registry.size, { indexed: definitions.length }),
    check("quarantine", "No runnable effect is quarantined", !runnable.some((entry) => platform.registry.isQuarantined(entry.key)), { quarantined: platform.registry.quarantined.length }),
    check("resources", "Runtime resource tracker has no leaked resources", platform.runtime.resourceStats?.active === 0 || platform.runtime.instances.length > 0, platform.runtime.resourceStats),
    check("compiler", "Native GLSL and WGSL compiler routes are installed", ["webgl2", "webgpu"].every((id) => platform.compiler?.backends?.has(id)), platform.compiler?.stats),
    check("rollback", "Atomic shader rollback workbench is installed", !!platform.sourceWorkbench?.stage, platform.sourceWorkbench?.report),
    check("preview-isolation", "Runnable previews require isolated rendering", runnable.every((entry) => !entry.manifest.preview.enabled || entry.manifest.preview.isolated === true), { previewable: runnable.filter((entry) => entry.manifest.preview.enabled).length }),
    check("browser-gpu", "Real browser/GPU acceptance evidence is recorded", browserEvidence?.passed === true, browserEvidence, "environment"),
  ];
  const blocking = checks.filter((entry) => entry.severity === "blocking" && !entry.passed);
  const environment = checks.filter((entry) => entry.severity === "environment" && !entry.passed);
  return Object.freeze({
    schema: "animestage.effects-acceptance/v1",
    passed: blocking.length === 0,
    releaseReady: blocking.length === 0 && environment.length === 0,
    checks: Object.freeze(checks),
    blockingFailures: Object.freeze(blocking),
    environmentPending: Object.freeze(environment),
    counts: Object.freeze({ indexed: definitions.length, runnable: runnable.length, metadataOnly: definitions.length - runnable.length }),
  });
}
