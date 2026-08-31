import { ensureDiagnosticCollector } from "../core/Diagnostics.js";

export const PHYSICS_STATE_ROLLBACK_STATES = Object.freeze({
  CAPTURED: "captured",
  RESTORING: "restoring",
  RESTORED: "restored",
  RESTORE_FAILED: "restore-failed",
});

function normalizeError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function isObjectLike(value) {
  return value != null && (typeof value === "object" || typeof value === "function");
}

function requiredFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(`${name} must be a function`);
  return value;
}

function optionalFunction(value, name, fallback) {
  if (value == null) return fallback;
  return requiredFunction(value, name);
}

function isThenable(value) {
  return isObjectLike(value) && typeof value.then === "function";
}

function assertSynchronous(value, label) {
  if (!isThenable(value)) return value;
  try { Promise.resolve(value).catch(() => undefined); } catch { /* malformed thenable */ }
  throw new LegacyPhysicsStateAsyncCallbackError(label);
}

function toArray(value, label) {
  if (value == null || typeof value === "string" || typeof value[Symbol.iterator] !== "function") {
    throw new TypeError(`${label} must be an iterable`);
  }
  return Array.from(value);
}

function targetObject(value, label) {
  if (!isObjectLike(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function readComponent(value, key, label) {
  const component = value?.[key];
  return finiteNumber(
    typeof component === "function" ? component.call(value) : component,
    `${label}.${key}`,
  );
}

function readVector3(value, label) {
  if (value == null) throw new TypeError(`${label} is unavailable`);
  return Object.freeze({
    x: readComponent(value, "x", label),
    y: readComponent(value, "y", label),
    z: readComponent(value, "z", label),
  });
}

function readQuaternion(value, label) {
  if (value == null) throw new TypeError(`${label} is unavailable`);
  return Object.freeze({
    x: readComponent(value, "x", label),
    y: readComponent(value, "y", label),
    z: readComponent(value, "z", label),
    w: readComponent(value, "w", label),
  });
}

function writeVectorLike(target, value, label) {
  if (target == null) throw new TypeError(`${label} target is unavailable`);
  if (typeof target.setValue === "function") {
    target.setValue(value.x, value.y, value.z);
    return target;
  }
  if (typeof target.set === "function") {
    target.set(value.x, value.y, value.z);
    return target;
  }
  if (!isObjectLike(target)) throw new TypeError(`${label} target is not writable`);
  target.x = value.x;
  target.y = value.y;
  target.z = value.z;
  return target;
}

function writeQuaternionLike(target, value, label) {
  if (target == null) throw new TypeError(`${label} target is unavailable`);
  if (typeof target.setValue === "function") {
    target.setValue(value.x, value.y, value.z, value.w);
    return target;
  }
  if (typeof target.set === "function") {
    target.set(value.x, value.y, value.z, value.w);
    return target;
  }
  if (!isObjectLike(target)) throw new TypeError(`${label} target is not writable`);
  target.x = value.x;
  target.y = value.y;
  target.z = value.z;
  target.w = value.w;
  return target;
}

function transformOrigin(transform) {
  return transform?.getOrigin?.() ?? transform?.origin ?? null;
}

function transformRotation(transform) {
  return transform?.getRotation?.() ?? transform?.rotation ?? null;
}

function defaultGetPhysics(target) {
  return target?.physics ?? target?.helperObjects?.physics ?? target?.objects?.physics ?? null;
}

function defaultGetBodies(physics) {
  return physics?.bodies ?? physics?.rigidBodies ?? [];
}

function defaultUnwrapBody(wrapper) {
  if (isObjectLike(wrapper) && "body" in wrapper) return wrapper.body;
  if (isObjectLike(wrapper) && "rigidBody" in wrapper) return wrapper.rigidBody;
  return wrapper;
}

function normalizeAdapter(adapter, index, prefix) {
  targetObject(adapter, `${prefix}[${index}]`);
  const capture = adapter.captureState ?? adapter.capture;
  const restore = adapter.restoreState ?? adapter.restore;
  return Object.freeze({
    id: String(adapter.id ?? adapter.name ?? `${prefix}-${index}`),
    kind: prefix,
    captureState: requiredFunction(capture, `${prefix}[${index}].captureState`).bind(adapter),
    restoreState: requiredFunction(restore, `${prefix}[${index}].restoreState`).bind(adapter),
  });
}

function normalizeAdapterList(value, prefix) {
  return Object.freeze(toArray(value ?? [], prefix)
    .map((adapter, index) => normalizeAdapter(adapter, index, prefix)));
}

function captureDefaultTransform(body) {
  if (typeof body?.translation === "function" || typeof body?.rotation === "function") {
    if (typeof body.translation !== "function" || typeof body.rotation !== "function" ||
        typeof body.setTranslation !== "function" || typeof body.setRotation !== "function") {
      throw new TypeError("body translation/rotation accessors require matching setters");
    }
    return Object.freeze({
      mode: "translation-rotation",
      position: readVector3(body.translation(), "body.translation"),
      rotation: readQuaternion(body.rotation(), "body.rotation"),
    });
  }

  if (body?.position != null || body?.quaternion != null) {
    if (body.position == null || body.quaternion == null) {
      throw new TypeError("body position/quaternion pair is incomplete");
    }
    return Object.freeze({
      mode: "properties",
      position: readVector3(body.position, "body.position"),
      rotation: readQuaternion(body.quaternion, "body.quaternion"),
    });
  }

  let getter = null;
  let setter = null;
  if (typeof body?.getCenterOfMassTransform === "function") {
    getter = "getCenterOfMassTransform";
    setter = typeof body.setCenterOfMassTransform === "function"
      ? "setCenterOfMassTransform"
      : typeof body.setWorldTransform === "function" ? "setWorldTransform" : null;
  } else if (typeof body?.getWorldTransform === "function") {
    getter = "getWorldTransform";
    setter = typeof body.setWorldTransform === "function"
      ? "setWorldTransform"
      : typeof body.setCenterOfMassTransform === "function" ? "setCenterOfMassTransform" : null;
  }
  if (!getter || !setter) throw new TypeError("body world-transform getter/setter pair is unavailable");
  const transform = body[getter]();
  return Object.freeze({
    mode: "world-transform",
    getter,
    setter,
    position: readVector3(transformOrigin(transform), "body.worldTransform.origin"),
    rotation: readQuaternion(transformRotation(transform), "body.worldTransform.rotation"),
  });
}

function captureInterpolationTransform(body) {
  if (typeof body?.getInterpolationWorldTransform !== "function" &&
      typeof body?.setInterpolationWorldTransform !== "function") return null;
  if (typeof body.getInterpolationWorldTransform !== "function" ||
      typeof body.setInterpolationWorldTransform !== "function") {
    throw new TypeError("body interpolation transform requires a getter/setter pair");
  }
  const transform = body.getInterpolationWorldTransform();
  return Object.freeze({
    position: readVector3(transformOrigin(transform), "body.interpolationTransform.origin"),
    rotation: readQuaternion(transformRotation(transform), "body.interpolationTransform.rotation"),
  });
}

function captureDefaultVelocity(body, kind) {
  const label = kind === "linear" ? "linearVelocity" : "angularVelocity";
  const nativeGetter = kind === "linear" ? "linvel" : "angvel";
  const nativeSetter = kind === "linear" ? "setLinvel" : "setAngvel";
  const objectGetter = kind === "linear" ? "getLinearVelocity" : "getAngularVelocity";
  const objectSetter = kind === "linear" ? "setLinearVelocity" : "setAngularVelocity";
  const property = kind === "linear" ? "linearVelocity" : "angularVelocity";

  if (typeof body?.[nativeGetter] === "function" || typeof body?.[nativeSetter] === "function") {
    if (typeof body[nativeGetter] !== "function" || typeof body[nativeSetter] !== "function") {
      throw new TypeError(`body.${nativeGetter}/${nativeSetter} pair is incomplete`);
    }
    return Object.freeze({
      mode: "native",
      value: readVector3(body[nativeGetter](), `body.${nativeGetter}`),
    });
  }
  if (typeof body?.[objectGetter] === "function" || typeof body?.[objectSetter] === "function") {
    if (typeof body[objectGetter] !== "function" || typeof body[objectSetter] !== "function") {
      throw new TypeError(`body.${objectGetter}/${objectSetter} pair is incomplete`);
    }
    return Object.freeze({
      mode: "object",
      value: readVector3(body[objectGetter](), `body.${label}`),
    });
  }
  if (body?.[property] != null) {
    return Object.freeze({
      mode: "property",
      value: readVector3(body[property], `body.${property}`),
    });
  }
  throw new TypeError(`body ${label} getter/setter pair is unavailable`);
}

function canWake(body) {
  return typeof body?.wakeUp === "function" || typeof body?.activate === "function" ||
    typeof body?.setActive === "function";
}

function canSleep(body) {
  return typeof body?.sleep === "function" || typeof body?.deactivate === "function" ||
    typeof body?.setActive === "function";
}

function captureDefaultActivation(body) {
  if (typeof body?.getActivationState === "function") {
    if (typeof body.forceActivationState !== "function" && typeof body.setActivationState !== "function") {
      throw new TypeError("numeric activation state has no matching setter");
    }
    return Object.freeze({
      mode: "numeric",
      value: finiteNumber(body.getActivationState(), "body.activationState"),
    });
  }
  if (typeof body?.isSleeping === "function") {
    const sleeping = !!body.isSleeping();
    if ((sleeping && !canSleep(body)) || (!sleeping && !canWake(body))) {
      throw new TypeError(`body cannot restore its ${sleeping ? "sleeping" : "awake"} state`);
    }
    return Object.freeze({ mode: "sleeping", value: sleeping });
  }
  if (typeof body?.isActive === "function") {
    const active = !!body.isActive();
    if ((active && !canWake(body)) || (!active && !canSleep(body))) {
      throw new TypeError(`body cannot restore its ${active ? "active" : "inactive"} state`);
    }
    return Object.freeze({ mode: "active", value: active });
  }
  throw new TypeError("body activation/sleep state is unavailable");
}

function createTransformTarget(body, snapshot, factories) {
  let transform = snapshot.getter && typeof body?.[snapshot.getter] === "function"
    ? body[snapshot.getter]()
    : null;
  if (transform == null) transform = factories.createTransform?.(snapshot, body) ?? null;
  if (transform == null) throw new TypeError("body transform cannot be restored");

  let origin = transformOrigin(transform);
  if (origin == null) origin = factories.createVector3?.(snapshot.position, body) ?? null;
  let rotation = transformRotation(transform);
  if (rotation == null) rotation = factories.createQuaternion?.(snapshot.rotation, body) ?? null;
  writeVectorLike(origin, snapshot.position, "body.worldTransform.origin");
  writeQuaternionLike(rotation, snapshot.rotation, "body.worldTransform.rotation");
  if (typeof transform.setOrigin === "function") transform.setOrigin(origin);
  else transform.origin = origin;
  if (typeof transform.setRotation === "function") transform.setRotation(rotation);
  else transform.rotation = rotation;
  return transform;
}

function restoreDefaultTransform(body, snapshot, factories) {
  if (snapshot.mode === "translation-rotation") {
    if (typeof body?.setTranslation !== "function" || typeof body?.setRotation !== "function") {
      throw new TypeError("body translation/rotation setters are unavailable");
    }
    body.setTranslation(snapshot.position, true);
    body.setRotation(snapshot.rotation, true);
    return;
  }
  if (snapshot.mode === "properties") {
    writeVectorLike(body?.position, snapshot.position, "body.position");
    writeQuaternionLike(body?.quaternion, snapshot.rotation, "body.quaternion");
    return;
  }
  if (snapshot.mode !== "world-transform") throw new TypeError("body transform snapshot is malformed");
  const transform = createTransformTarget(body, snapshot, factories);
  const setter = typeof body?.[snapshot.setter] === "function"
    ? snapshot.setter
    : typeof body?.setWorldTransform === "function"
      ? "setWorldTransform"
      : typeof body?.setCenterOfMassTransform === "function" ? "setCenterOfMassTransform" : null;
  if (!setter) throw new TypeError("body world-transform setter is unavailable");
  body[setter](transform);
  body.getMotionState?.()?.setWorldTransform?.(transform);
  body.updateInertiaTensor?.();
}

function restoreInterpolationTransform(body, snapshot, factories) {
  if (!snapshot) return;
  if (typeof body?.setInterpolationWorldTransform !== "function") {
    throw new TypeError("body interpolation-transform setter is unavailable");
  }
  const source = {
    ...snapshot,
    getter: "getInterpolationWorldTransform",
  };
  body.setInterpolationWorldTransform(createTransformTarget(body, source, factories));
}

function restoreDefaultVelocity(body, snapshot, kind, factories) {
  const nativeSetter = kind === "linear" ? "setLinvel" : "setAngvel";
  const objectGetter = kind === "linear" ? "getLinearVelocity" : "getAngularVelocity";
  const objectSetter = kind === "linear" ? "setLinearVelocity" : "setAngularVelocity";
  const property = kind === "linear" ? "linearVelocity" : "angularVelocity";
  const label = kind === "linear" ? "linearVelocity" : "angularVelocity";
  if (snapshot.mode === "native") {
    if (typeof body?.[nativeSetter] !== "function") throw new TypeError(`body.${nativeSetter} is unavailable`);
    body[nativeSetter](snapshot.value, true);
    return;
  }
  if (snapshot.mode === "property") {
    writeVectorLike(body?.[property], snapshot.value, `body.${property}`);
    return;
  }
  if (snapshot.mode !== "object" || typeof body?.[objectSetter] !== "function") {
    throw new TypeError(`body.${objectSetter} is unavailable`);
  }
  const vector = body[objectGetter]?.() ?? factories.createVector3?.(snapshot.value, body) ?? null;
  writeVectorLike(vector, snapshot.value, `body.${label}`);
  body[objectSetter](vector);
}

function wakeBody(body) {
  if (typeof body?.wakeUp === "function") body.wakeUp();
  else if (typeof body?.activate === "function") body.activate(true);
  else if (typeof body?.setActive === "function") body.setActive(true);
  else throw new TypeError("body cannot be awakened");
}

function sleepBody(body) {
  if (typeof body?.sleep === "function") body.sleep();
  else if (typeof body?.deactivate === "function") body.deactivate();
  else if (typeof body?.setActive === "function") body.setActive(false);
  else throw new TypeError("body cannot be put to sleep");
}

function restoreDefaultActivation(body, snapshot) {
  if (snapshot.mode === "numeric") {
    if (typeof body?.forceActivationState === "function") body.forceActivationState(snapshot.value);
    else if (typeof body?.setActivationState === "function") body.setActivationState(snapshot.value);
    else throw new TypeError("numeric activation-state setter is unavailable");
    return;
  }
  if (snapshot.mode === "sleeping") {
    if (snapshot.value) sleepBody(body);
    else wakeBody(body);
    return;
  }
  if (snapshot.mode === "active") {
    if (snapshot.value) wakeBody(body);
    else sleepBody(body);
    return;
  }
  throw new TypeError("body activation snapshot is malformed");
}

function clearTransientForces(body) {
  if (typeof body?.clearForces === "function") body.clearForces();
  else {
    body?.resetForces?.(true);
    body?.resetTorques?.(true);
  }
}

function captureDefaultBody(body, warn) {
  const state = {};
  const capture = (component, task) => {
    try { state[component] = task(); }
    catch (error) { warn(component, normalizeError(error)); }
  };
  capture("transform", () => captureDefaultTransform(body));
  try {
    const interpolationTransform = captureInterpolationTransform(body);
    if (interpolationTransform) state.interpolationTransform = interpolationTransform;
  } catch (error) {
    warn("interpolation-transform", normalizeError(error));
  }
  capture("linearVelocity", () => captureDefaultVelocity(body, "linear"));
  capture("angularVelocity", () => captureDefaultVelocity(body, "angular"));
  capture("activation", () => captureDefaultActivation(body));
  return Object.freeze(state);
}

function restoreEveryDefaultBodyField(body, state, factories, attach) {
  if (state.transform) attach("transform", () => restoreDefaultTransform(body, state.transform, factories));
  if (state.interpolationTransform) {
    attach("interpolation-transform", () => restoreInterpolationTransform(body, state.interpolationTransform, factories));
  }
  if (state.linearVelocity) {
    attach("linear-velocity", () => restoreDefaultVelocity(body, state.linearVelocity, "linear", factories));
  }
  if (state.angularVelocity) {
    attach("angular-velocity", () => restoreDefaultVelocity(body, state.angularVelocity, "angular", factories));
  }
  if (state.activation) attach("activation-state", () => restoreDefaultActivation(body, state.activation));
}

function publicScope(targetSnapshots) {
  const worlds = targetSnapshots.map((targetSnapshot) => Object.freeze({
    target: targetSnapshot.target,
    physics: targetSnapshot.physics,
    bodies: Object.freeze(targetSnapshot.bodies.map(({ body }) => body)),
    wrappers: Object.freeze(targetSnapshot.bodies.map(({ wrapper }) => wrapper)),
  }));
  return Object.freeze({
    targets: Object.freeze(targetSnapshots.map(({ target }) => target)),
    worlds: Object.freeze(worlds),
  });
}

export class LegacyPhysicsStateRollbackError extends Error {
  constructor(message, { code = "LEGACY_PHYSICS_STATE_ROLLBACK_ERROR", cause, details = null } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class LegacyPhysicsStateAsyncCallbackError extends LegacyPhysicsStateRollbackError {
  constructor(callbackName) {
    super(`Physics-state callback "${callbackName}" returned a Promise; rollback is synchronous`, {
      code: "LEGACY_PHYSICS_STATE_ASYNC_CALLBACK",
      details: { callbackName },
    });
    this.callbackName = callbackName;
  }
}

export class LegacyPhysicsStateSnapshotError extends LegacyPhysicsStateRollbackError {
  constructor(message = "Physics-state snapshot is invalid or belongs to another rollback seam") {
    super(message, { code: "LEGACY_PHYSICS_STATE_INVALID_SNAPSHOT" });
  }
}

export class LegacyPhysicsStateCaptureError extends LegacyPhysicsStateRollbackError {
  constructor(component, cause, { targetIndex = null, bodyIndex = null } = {}) {
    const error = normalizeError(cause);
    super(`Physics-state capture failed at ${component}: ${error.message}`, {
      code: "LEGACY_PHYSICS_STATE_CAPTURE_FAILED",
      cause: error,
      details: { component, targetIndex, bodyIndex },
    });
    this.component = component;
    this.targetIndex = targetIndex;
    this.bodyIndex = bodyIndex;
  }
}

export class LegacyPhysicsStateRestoreError extends LegacyPhysicsStateRollbackError {
  constructor(failures) {
    const normalized = Object.freeze(failures.map((failure) => Object.freeze({
      ...failure,
      error: normalizeError(failure.error),
    })));
    const cause = normalized.length === 1
      ? normalized[0].error
      : new AggregateError(normalized.map(({ error }) => error), "Multiple physics states failed to restore");
    super(`Physics-state restoration failed in ${normalized.length} operation(s)`, {
      code: "LEGACY_PHYSICS_STATE_RESTORE_FAILED",
      cause,
      details: {
        failures: normalized.map(({ targetIndex, bodyIndex, component, adapterId }) => ({
          targetIndex,
          bodyIndex,
          component,
          adapterId: adapterId ?? null,
        })),
      },
    });
    this.failures = normalized;
  }
}

/**
 * Synchronous one-shot rollback for rigid-body state and the private clocks,
 * runtime values and pending-reset membership which feed the next physics step.
 * Default body support is capability-based; no rendering or physics package is
 * imported. Explicit adapters cover backend-owned world state and closures.
 */
export class LegacyPhysicsStateRollback {
  #configuration;
  #records = new WeakMap();
  #sequence = 0;

  constructor(configuration = {}) {
    if (!configuration || typeof configuration !== "object") {
      throw new TypeError("LegacyPhysicsStateRollback expects a configuration object");
    }
    const clockAdapters = configuration.clockAdapter == null
      ? []
      : [normalizeAdapter(configuration.clockAdapter, 0, "clock")];
    const runtimeAdapters = normalizeAdapterList(configuration.runtimeAdapters, "runtime");
    const pendingResetAdapters = normalizeAdapterList(
      configuration.pendingResetAdapters,
      "pending-reset",
    );
    const bodyAdapter = configuration.bodyAdapter == null
      ? null
      : normalizeAdapter(configuration.bodyAdapter, 0, "body");
    const worldAdapter = configuration.worldAdapter == null
      ? null
      : normalizeAdapter(configuration.worldAdapter, 0, "world");

    this.#configuration = Object.freeze({
      listTargets: requiredFunction(configuration.listTargets, "listTargets").bind(configuration),
      getPhysics: optionalFunction(configuration.getPhysics, "getPhysics", defaultGetPhysics).bind(configuration),
      getBodies: optionalFunction(configuration.getBodies, "getBodies", defaultGetBodies).bind(configuration),
      unwrapBody: optionalFunction(configuration.unwrapBody, "unwrapBody", defaultUnwrapBody).bind(configuration),
      bodyAdapter,
      worldAdapter,
      externalAdapters: Object.freeze([
        ...clockAdapters,
        ...runtimeAdapters,
        ...pendingResetAdapters,
      ]),
      clearTransientForces: configuration.clearTransientForces !== false,
      afterRestore: optionalFunction(configuration.afterRestore, "afterRestore", () => undefined)
        .bind(configuration),
      factories: Object.freeze({
        createTransform: optionalFunction(configuration.createTransform, "createTransform", null)?.bind(configuration) ?? null,
        createVector3: optionalFunction(configuration.createVector3, "createVector3", null)?.bind(configuration) ?? null,
        createQuaternion: optionalFunction(configuration.createQuaternion, "createQuaternion", null)?.bind(configuration) ?? null,
      }),
    });
    this.id = String(configuration.id ?? "physics-hidden-state");
    this.label = String(configuration.label ?? "legacy-physics-state");
    this.diagnostics = ensureDiagnosticCollector(configuration.diagnostics);
    this.coordinatorCallbacks = Object.freeze({
      captureState: (context) => this.captureState(context),
      restoreState: (snapshot, context, cause) => this.restoreState(snapshot, context, cause),
    });
    Object.freeze(this);
  }

  /** Captures targets returned by listTargets(context). */
  captureState(context = null) {
    let targets;
    try {
      targets = assertSynchronous(this.#configuration.listTargets(context), "listTargets");
    } catch (cause) {
      throw this.#captureFailure("listTargets", cause, context);
    }
    return this.captureTargets(targets, context);
  }

  /** Explicit-target variant for tests and offline composition roots. */
  captureTargets(explicitTargets, context = null) {
    let listedTargets;
    try { listedTargets = toArray(explicitTargets, "physics targets"); }
    catch (cause) { throw this.#captureFailure("targets", cause, context); }

    const targets = [];
    const seenTargets = new Set();
    for (let index = 0; index < listedTargets.length; index += 1) {
      try { targetObject(listedTargets[index], `target[${index}]`); }
      catch (cause) {
        throw this.#captureFailure(`target[${index}]`, cause, context, { targetIndex: index });
      }
      if (seenTargets.has(listedTargets[index])) continue;
      seenTargets.add(listedTargets[index]);
      targets.push(listedTargets[index]);
    }

    const warned = new Set();
    const warnUnsupported = (targetIndex, bodyIndex, capability, cause) => {
      const key = `${targetIndex}:${bodyIndex}:${capability}`;
      if (warned.has(key)) return;
      warned.add(key);
      const error = normalizeError(cause);
      this.diagnostics.emit({
        severity: "warning",
        code: "PHYSICS_STATE_CAPABILITY_UNSUPPORTED",
        message: `Physics body ${bodyIndex} cannot snapshot ${capability}.`,
        frameId: context?.frameId ?? null,
        details: { targetIndex, bodyIndex, capability, reason: error.message },
      });
    };

    const seenBodies = new Set();
    const targetSnapshots = [];
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const target = targets[targetIndex];
      try {
        const physics = assertSynchronous(
          this.#configuration.getPhysics(target, context, targetIndex),
          "getPhysics",
        );
        if (physics != null) targetObject(physics, `target[${targetIndex}].physics`);
        const wrappers = physics == null
          ? []
          : toArray(
            assertSynchronous(
              this.#configuration.getBodies(physics, target, context, targetIndex),
              "getBodies",
            ),
            `target[${targetIndex}].bodies`,
          );
        const bodies = [];
        for (let bodyIndex = 0; bodyIndex < wrappers.length; bodyIndex += 1) {
          const wrapper = wrappers[bodyIndex];
          const body = assertSynchronous(
            this.#configuration.unwrapBody(wrapper, physics, target, context, bodyIndex, targetIndex),
            "unwrapBody",
          );
          if (body == null) {
            warnUnsupported(targetIndex, bodyIndex, "body", new Error("wrapper has no rigid body"));
            continue;
          }
          targetObject(body, `target[${targetIndex}].body[${bodyIndex}]`);
          if (seenBodies.has(body)) continue;
          seenBodies.add(body);
          const bodyScope = Object.freeze({
            body,
            wrapper,
            physics,
            target,
            targetIndex,
            bodyIndex,
          });
          const state = this.#configuration.bodyAdapter
            ? assertSynchronous(
              this.#configuration.bodyAdapter.captureState(bodyScope, context),
              `${this.#configuration.bodyAdapter.id}:captureState`,
            )
            : captureDefaultBody(
              body,
              (capability, cause) => warnUnsupported(targetIndex, bodyIndex, capability, cause),
            );
          bodies.push(Object.freeze({ ...bodyScope, state }));
        }

        const worldScope = Object.freeze({
          target,
          physics,
          targetIndex,
          bodies: Object.freeze(bodies.map(({ body }) => body)),
          wrappers: Object.freeze(bodies.map(({ wrapper }) => wrapper)),
        });
        const worldState = physics != null && this.#configuration.worldAdapter
          ? assertSynchronous(
            this.#configuration.worldAdapter.captureState(worldScope, context),
            `${this.#configuration.worldAdapter.id}:captureState`,
          )
          : null;
        targetSnapshots.push(Object.freeze({
          target,
          physics,
          targetIndex,
          bodies: Object.freeze(bodies),
          worldScope,
          worldState,
        }));
      } catch (cause) {
        throw this.#captureFailure(`target[${targetIndex}]`, cause, context, { targetIndex });
      }
    }

    const scope = publicScope(targetSnapshots);
    const adapterSnapshots = [];
    for (const adapter of this.#configuration.externalAdapters) {
      try {
        adapterSnapshots.push(Object.freeze({
          adapter,
          state: assertSynchronous(
            adapter.captureState(scope, context),
            `${adapter.id}:captureState`,
          ),
        }));
      } catch (cause) {
        throw this.#captureFailure(`${adapter.kind}:${adapter.id}`, cause, context);
      }
    }

    if (!this.#configuration.externalAdapters.some(({ kind }) => kind === "clock")) {
      this.diagnostics.emit({
        severity: "warning",
        code: "PHYSICS_CLOCK_ROLLBACK_UNCONFIGURED",
        message: "Rigid-body state is protected, but the fixed-step clock has no rollback adapter.",
        frameId: context?.frameId ?? null,
      });
    }

    const sequence = this.#sequence++;
    const token = Object.freeze(Object.create(null));
    const bodyCount = targetSnapshots.reduce((count, item) => count + item.bodies.length, 0);
    const worldCount = targetSnapshots.reduce((count, item) => count + (item.physics == null ? 0 : 1), 0);
    this.#records.set(token, {
      state: PHYSICS_STATE_ROLLBACK_STATES.CAPTURED,
      sequence,
      targetSnapshots: Object.freeze(targetSnapshots),
      scope,
      adapterSnapshots: Object.freeze(adapterSnapshots),
      bodyCount,
      worldCount,
      settlement: null,
      failure: null,
    });
    this.diagnostics.emit({
      severity: "debug",
      code: "PHYSICS_STATE_CAPTURED",
      message: `Captured hidden physics state for ${bodyCount} rigid body/bodies.`,
      frameId: context?.frameId ?? null,
      details: {
        sequence,
        targetCount: targetSnapshots.length,
        worldCount,
        bodyCount,
        adapterIds: adapterSnapshots.map(({ adapter }) => adapter.id),
      },
    });
    return token;
  }

  restoreState(token, context = null, cause = null) {
    if (!isObjectLike(token)) throw new LegacyPhysicsStateSnapshotError();
    const record = this.#records.get(token);
    if (!record) throw new LegacyPhysicsStateSnapshotError();
    if (record.state === PHYSICS_STATE_ROLLBACK_STATES.RESTORING) {
      throw new LegacyPhysicsStateSnapshotError("Physics-state snapshot is already being restored");
    }
    if (record.state === PHYSICS_STATE_ROLLBACK_STATES.RESTORED) return record.settlement;
    if (record.state === PHYSICS_STATE_ROLLBACK_STATES.RESTORE_FAILED) throw record.failure;

    record.state = PHYSICS_STATE_ROLLBACK_STATES.RESTORING;
    const failures = [];
    const attach = (component, task, {
      targetIndex = null,
      bodyIndex = null,
      adapterId = null,
    } = {}) => {
      try { assertSynchronous(task(), component); }
      catch (error) {
        failures.push(Object.freeze({
          targetIndex,
          bodyIndex,
          component,
          adapterId,
          error: normalizeError(error),
        }));
      }
    };

    for (let index = record.adapterSnapshots.length - 1; index >= 0; index -= 1) {
      const { adapter, state } = record.adapterSnapshots[index];
      attach(
        `${adapter.kind}:${adapter.id}`,
        () => adapter.restoreState(state, record.scope, context, cause),
        { adapterId: adapter.id },
      );
    }

    for (let targetIndex = record.targetSnapshots.length - 1; targetIndex >= 0; targetIndex -= 1) {
      const targetSnapshot = record.targetSnapshots[targetIndex];
      const savedTargetIndex = targetSnapshot.targetIndex;
      if (targetSnapshot.physics != null && this.#configuration.worldAdapter) {
        attach(
          `world:${this.#configuration.worldAdapter.id}`,
          () => this.#configuration.worldAdapter.restoreState(
            targetSnapshot.worldState,
            targetSnapshot.worldScope,
            context,
            cause,
          ),
          { targetIndex: savedTargetIndex, adapterId: this.#configuration.worldAdapter.id },
        );
      }

      for (let index = targetSnapshot.bodies.length - 1; index >= 0; index -= 1) {
        const bodySnapshot = targetSnapshot.bodies[index];
        const location = {
          targetIndex: bodySnapshot.targetIndex,
          bodyIndex: bodySnapshot.bodyIndex,
        };
        if (this.#configuration.clearTransientForces) {
          attach("clear-forces", () => clearTransientForces(bodySnapshot.body), location);
        }
        if (this.#configuration.bodyAdapter) {
          attach(
            `body:${this.#configuration.bodyAdapter.id}`,
            () => this.#configuration.bodyAdapter.restoreState(
              bodySnapshot.state,
              Object.freeze({
                body: bodySnapshot.body,
                wrapper: bodySnapshot.wrapper,
                physics: bodySnapshot.physics,
                target: bodySnapshot.target,
                targetIndex: bodySnapshot.targetIndex,
                bodyIndex: bodySnapshot.bodyIndex,
              }),
              context,
              cause,
            ),
            { ...location, adapterId: this.#configuration.bodyAdapter.id },
          );
        } else {
          restoreEveryDefaultBodyField(
            bodySnapshot.body,
            bodySnapshot.state,
            this.#configuration.factories,
            (component, task) => attach(component, task, location),
          );
        }
      }

      if (targetSnapshot.physics != null) {
        attach(
          "after-restore",
          () => this.#configuration.afterRestore(
            targetSnapshot.target,
            targetSnapshot.physics,
            context,
            cause,
          ),
          { targetIndex: savedTargetIndex },
        );
      }
    }

    if (failures.length > 0) {
      const failure = new LegacyPhysicsStateRestoreError(failures);
      record.state = PHYSICS_STATE_ROLLBACK_STATES.RESTORE_FAILED;
      record.failure = failure;
      this.diagnostics.emit({
        severity: "error",
        code: failure.code,
        message: failure.message,
        frameId: context?.frameId ?? null,
        details: { sequence: record.sequence, failures: failure.details.failures },
      });
      throw failure;
    }

    const settlement = Object.freeze({
      status: PHYSICS_STATE_ROLLBACK_STATES.RESTORED,
      sequence: record.sequence,
      targetCount: record.targetSnapshots.length,
      worldCount: record.worldCount,
      bodyCount: record.bodyCount,
      adapterCount: record.adapterSnapshots.length,
    });
    record.state = PHYSICS_STATE_ROLLBACK_STATES.RESTORED;
    record.settlement = settlement;
    this.diagnostics.emit({
      severity: "info",
      code: "PHYSICS_STATE_RESTORED",
      message: `Restored hidden physics state for ${record.bodyCount} rigid body/bodies.`,
      frameId: context?.frameId ?? null,
      details: { sequence: record.sequence, causeCode: cause?.code ?? null, ...settlement },
    });
    return settlement;
  }

  stateOf(token) {
    return isObjectLike(token) ? this.#records.get(token)?.state ?? null : null;
  }

  #captureFailure(component, cause, context, location = {}) {
    const failure = cause instanceof LegacyPhysicsStateCaptureError
      ? cause
      : new LegacyPhysicsStateCaptureError(component, cause, location);
    this.diagnostics.emit({
      severity: "error",
      code: failure.code,
      message: failure.message,
      frameId: context?.frameId ?? null,
      details: failure.details,
    });
    return failure;
  }
}

/**
 * Adapts Set/WeakSet-style pending-reset membership to the physics rollback
 * adapter contract. getKey lets production key membership by target.mesh while
 * the rollback itself remains unaware of character or engine classes.
 */
export function createPhysicsPendingResetRollbackAdapter(configuration = {}) {
  if (!configuration || typeof configuration !== "object") {
    throw new TypeError("Pending-reset rollback adapter expects a configuration object");
  }
  const getKey = optionalFunction(configuration.getKey, "getKey", (target) => target)
    .bind(configuration);
  const isPending = requiredFunction(configuration.isPending, "isPending").bind(configuration);
  const setPending = requiredFunction(configuration.setPending, "setPending").bind(configuration);
  const id = String(configuration.id ?? "physics-pending-reset");
  return Object.freeze({
    id,
    captureState(scope, context) {
      if (!scope || !Array.isArray(scope.targets)) throw new TypeError("physics rollback scope is malformed");
      const entries = [];
      const seen = new Set();
      for (let index = 0; index < scope.targets.length; index += 1) {
        const target = scope.targets[index];
        const key = assertSynchronous(getKey(target, context, index), `${id}:getKey`);
        if (key == null || seen.has(key)) continue;
        targetObject(key, `pending-reset key[${index}]`);
        seen.add(key);
        const pending = assertSynchronous(
          isPending(key, target, context, index),
          `${id}:isPending`,
        );
        if (typeof pending !== "boolean") {
          throw new TypeError(`${id}:isPending must return a boolean`);
        }
        entries.push(Object.freeze({ key, target, pending }));
      }
      return Object.freeze(entries);
    },
    restoreState(snapshot, _scope, context, cause) {
      if (!Array.isArray(snapshot)) throw new TypeError("pending-reset snapshot is malformed");
      const failures = [];
      for (let index = snapshot.length - 1; index >= 0; index -= 1) {
        const entry = snapshot[index];
        try {
          if (!entry || !isObjectLike(entry.key) || typeof entry.pending !== "boolean") {
            throw new TypeError(`pending-reset entry[${index}] is malformed`);
          }
          assertSynchronous(
            setPending(entry.key, entry.pending, entry.target, context, cause, index),
            `${id}:setPending`,
          );
        } catch (error) { failures.push(normalizeError(error)); }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) {
        throw new AggregateError(failures, `${id} failed to restore pending-reset membership`);
      }
    },
  });
}

/** Returns a LegacyLiveFrameRollback-compatible facade and its owned seam. */
export function createLegacyPhysicsStateRollbackAdapter(configuration) {
  const rollback = new LegacyPhysicsStateRollback(configuration);
  return Object.freeze({
    id: rollback.id,
    rollback,
    captureState: (context) => rollback.captureState(context),
    restoreState: (snapshot, context, cause) => rollback.restoreState(snapshot, context, cause),
  });
}
