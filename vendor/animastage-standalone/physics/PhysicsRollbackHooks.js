const CLOCK_SNAPSHOT_KIND = "animestage/physics-clock-rollback-v1";
const WORLD_SNAPSHOT_KIND = "animestage/reze-world-rollback-v1";
const RUNTIME_SNAPSHOT_KIND = "animestage/physics-runtime-rollback-v1";

const CLOCK_FIELDS = Object.freeze([
  "rate",
  "fixedStep",
  "maxCatchUpSteps",
  "maxBacklogSeconds",
  "accumulator",
  "offlineAccumulator",
  "workerPending",
  "workerReady",
  "running",
  "lastPulseAt",
]);

function objectValue(value, label) {
  if (value == null || (typeof value !== "object" && typeof value !== "function")) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function booleanValue(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean`);
  return value;
}

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

function iterable(value, label) {
  if (value == null || typeof value === "string" || typeof value[Symbol.iterator] !== "function") {
    throw new TypeError(`${label} must be an iterable`);
  }
  return Array.from(value);
}

function normalizeError(value) {
  return value instanceof Error ? value : new Error(String(value));
}

function clonePrimitiveRecord(source, label) {
  objectValue(source, label);
  const values = Object.create(null);
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (value == null || ["number", "string", "boolean", "bigint", "undefined"].includes(typeof value)) {
      values[key] = value;
    }
  }
  return Object.freeze(values);
}

function restorePrimitiveRecord(target, values, { deleteAdded = true } = {}) {
  objectValue(target, "primitive record target");
  if (deleteAdded) {
    for (const key of Object.keys(target)) {
      const value = target[key];
      const primitive = value == null ||
        ["number", "string", "boolean", "bigint", "undefined"].includes(typeof value);
      if (primitive && !Object.prototype.hasOwnProperty.call(values, key)) delete target[key];
    }
  }
  for (const key of Object.keys(values)) target[key] = values[key];
}

function captureViewFields(target, label) {
  if (target == null) return Object.freeze([]);
  objectValue(target, label);
  const entries = [];
  for (const key of Object.keys(target)) {
    const reference = target[key];
    if (!ArrayBuffer.isView(reference) || reference instanceof DataView) continue;
    entries.push(Object.freeze({
      key,
      reference,
      values: new reference.constructor(reference),
    }));
  }
  return Object.freeze(entries);
}

function restoreViewFields(target, entries, label) {
  objectValue(target, label);
  for (const entry of entries) {
    if (target[entry.key] !== entry.reference) target[entry.key] = entry.reference;
    if (entry.reference.length !== entry.values.length || typeof entry.reference.set !== "function") {
      throw new RangeError(`${label}.${entry.key} changed shape since capture`);
    }
    entry.reference.set(entry.values);
  }
}

function captureLayer(target, label) {
  if (target == null) return null;
  objectValue(target, label);
  return Object.freeze({
    target,
    primitives: clonePrimitiveRecord(target, label),
    views: captureViewFields(target, label),
  });
}

function restoreLayer(layer, expectedTarget, label) {
  if (layer == null) {
    if (expectedTarget != null) throw new TypeError(`${label} appeared after capture`);
    return;
  }
  if (expectedTarget !== layer.target) throw new TypeError(`${label} identity changed since capture`);
  restorePrimitiveRecord(layer.target, layer.primitives);
  restoreViewFields(layer.target, layer.views, label);
}

function captureObjectFields(value, label) {
  objectValue(value, label);
  return Object.freeze({ reference: value, values: clonePrimitiveRecord(value, label) });
}

function restoreObjectFields(snapshot, label) {
  objectValue(snapshot?.reference, label);
  restorePrimitiveRecord(snapshot.reference, snapshot.values);
  return snapshot.reference;
}

function captureObjectArray(array, label) {
  if (!Array.isArray(array)) throw new TypeError(`${label} must be an array`);
  return Object.freeze({
    reference: array,
    entries: Object.freeze(array.map((entry, index) =>
      captureObjectFields(entry, `${label}[${index}]`))),
  });
}

function restoreObjectArray(snapshot, label) {
  const array = snapshot?.reference;
  if (!Array.isArray(array) || !Array.isArray(snapshot.entries)) {
    throw new TypeError(`${label} snapshot is malformed`);
  }
  array.length = snapshot.entries.length;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    array[index] = restoreObjectFields(entry, `${label}[${index}]`);
  }
  return array;
}

function captureMatrices(matrices) {
  if (!Array.isArray(matrices)) return null;
  return Object.freeze({
    reference: matrices,
    entries: Object.freeze(matrices.map((matrix, index) => {
      const values = matrix?.values;
      if (!ArrayBuffer.isView(values) || values instanceof DataView) {
        throw new TypeError(`physics._boneMatrices[${index}].values must be a typed array`);
      }
      return Object.freeze({
        reference: matrix,
        valuesReference: values,
        values: new values.constructor(values),
      });
    })),
  });
}

function restoreMatrices(snapshot, physics) {
  if (snapshot == null) return;
  if (physics._boneMatrices !== snapshot.reference) physics._boneMatrices = snapshot.reference;
  snapshot.reference.length = snapshot.entries.length;
  for (let index = 0; index < snapshot.entries.length; index += 1) {
    const entry = snapshot.entries[index];
    snapshot.reference[index] = entry.reference;
    if (entry.reference.values !== entry.valuesReference) entry.reference.values = entry.valuesReference;
    if (entry.valuesReference.length !== entry.values.length) {
      throw new RangeError(`physics._boneMatrices[${index}] changed shape since capture`);
    }
    entry.valuesReference.set(entry.values);
  }
}

function captureManifolds(manifolds) {
  if (manifolds == null) return null;
  objectValue(manifolds, "physics world manifolds");
  if (!(manifolds.pairs instanceof Map) || !(manifolds.touched instanceof Set)) {
    throw new TypeError("physics world manifold cache is malformed");
  }
  const pairs = [];
  for (const [key, points] of manifolds.pairs) {
    pairs.push(Object.freeze({ key, points: captureObjectArray(points, `manifold[${String(key)}]`) }));
  }
  return Object.freeze({
    reference: manifolds,
    pairsReference: manifolds.pairs,
    touchedReference: manifolds.touched,
    pairs: Object.freeze(pairs),
    touched: Object.freeze(Array.from(manifolds.touched)),
  });
}

function restoreManifolds(snapshot, world) {
  if (snapshot == null) return;
  if (world.manifolds !== snapshot.reference) world.manifolds = snapshot.reference;
  const manifolds = snapshot.reference;
  if (manifolds.pairs !== snapshot.pairsReference) manifolds.pairs = snapshot.pairsReference;
  if (manifolds.touched !== snapshot.touchedReference) manifolds.touched = snapshot.touchedReference;
  snapshot.pairsReference.clear();
  for (const entry of snapshot.pairs) {
    snapshot.pairsReference.set(entry.key, restoreObjectArray(entry.points, `manifold[${String(entry.key)}]`));
  }
  snapshot.touchedReference.clear();
  for (const key of snapshot.touched) snapshot.touchedReference.add(key);
}

function restoreAll(tasks, label) {
  const failures = [];
  for (const task of tasks) {
    try { task(); } catch (error) { failures.push(normalizeError(error)); }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, `${label} restoration failed`);
}

export function capturePhysicsClockRollbackState(clock) {
  objectValue(clock, "physics clock");
  const fields = Object.create(null);
  for (const key of CLOCK_FIELDS) {
    const value = clock[key];
    if (key === "workerReady" || key === "running") {
      if (typeof value !== "boolean") throw new TypeError(`physicsClock.${key} must be boolean`);
      fields[key] = value;
    } else {
      fields[key] = finite(value, `physicsClock.${key}`);
    }
  }
  const stats = objectValue(clock.stats, "physicsClock.stats");
  return Object.freeze({
    kind: CLOCK_SNAPSHOT_KIND,
    clock,
    fields: Object.freeze(fields),
    statsReference: stats,
    stats: clonePrimitiveRecord(stats, "physicsClock.stats"),
  });
}

export function restorePhysicsClockRollbackState(clock, snapshot) {
  objectValue(clock, "physics clock");
  if (snapshot?.kind !== CLOCK_SNAPSHOT_KIND || snapshot.clock !== clock) {
    throw new TypeError("physics clock rollback snapshot is invalid or foreign");
  }
  for (const key of CLOCK_FIELDS) clock[key] = snapshot.fields[key];
  if (clock.stats !== snapshot.statsReference) clock.stats = snapshot.statsReference;
  restorePrimitiveRecord(snapshot.statsReference, snapshot.stats);
  return clock;
}

export function capturePhysicsWorldRollbackState(physics) {
  objectValue(physics, "physics world");
  const core = objectValue(physics.core, "physics.core");
  const store = objectValue(core.getStore?.(), "physics.core store");
  if (physics._disposed === true) throw new TypeError("disposed physics world cannot be captured");
  const coreWorld = objectValue(core.world, "physics.core.world");
  const solverCache = objectValue(core.solverCache, "physics.core.solverCache");
  const contacts = objectValue(core.contacts, "physics.core.contacts");
  if (!Array.isArray(contacts.pool)) throw new TypeError("physics contact pool is malformed");
  const diagnostics = physics.diagnostics == null
    ? null
    : captureObjectFields(physics.diagnostics, "physics.diagnostics");

  return Object.freeze({
    kind: WORLD_SNAPSHOT_KIND,
    physics,
    core,
    store,
    coreWorld,
    solverCache,
    contacts,
    layers: Object.freeze({
      physics: captureLayer(physics, "physics"),
      core: captureLayer(core, "physics.core"),
      store: captureLayer(store, "physics.core.store"),
      coreWorld: captureLayer(coreWorld, "physics.core.world"),
      solverCache: captureLayer(solverCache, "physics.core.solverCache"),
      contacts: captureLayer(contacts, "physics.core.contacts"),
    }),
    boneMatrices: captureMatrices(physics._boneMatrices),
    contactPool: captureObjectArray(contacts.pool, "physics.core.contacts.pool"),
    manifolds: captureManifolds(coreWorld.manifolds),
    gravity: physics.gravity == null ? null : captureObjectFields(physics.gravity, "physics.gravity"),
    coreGravity: coreWorld.gravity == null ? null : captureObjectFields(coreWorld.gravity, "physics.core.world.gravity"),
    diagnostics,
  });
}

export function restorePhysicsWorldRollbackState(physics, snapshot) {
  objectValue(physics, "physics world");
  if (snapshot?.kind !== WORLD_SNAPSHOT_KIND || snapshot.physics !== physics) {
    throw new TypeError("physics world rollback snapshot is invalid or foreign");
  }
  if (physics.core !== snapshot.core || physics.core?.getStore?.() !== snapshot.store ||
      physics.core?.world !== snapshot.coreWorld || physics.core?.solverCache !== snapshot.solverCache ||
      physics.core?.contacts !== snapshot.contacts) {
    throw new TypeError("physics world identity changed since capture");
  }

  restoreAll([
    () => restoreLayer(snapshot.layers.physics, physics, "physics"),
    () => restoreLayer(snapshot.layers.core, snapshot.core, "physics.core"),
    () => restoreLayer(snapshot.layers.store, snapshot.store, "physics.core.store"),
    () => restoreLayer(snapshot.layers.coreWorld, snapshot.coreWorld, "physics.core.world"),
    () => restoreLayer(snapshot.layers.solverCache, snapshot.solverCache, "physics.core.solverCache"),
    () => restoreLayer(snapshot.layers.contacts, snapshot.contacts, "physics.core.contacts"),
    () => restoreMatrices(snapshot.boneMatrices, physics),
    () => {
      if (snapshot.contacts.pool !== snapshot.contactPool.reference) {
        snapshot.contacts.pool = snapshot.contactPool.reference;
      }
      restoreObjectArray(snapshot.contactPool, "physics.core.contacts.pool");
    },
    () => restoreManifolds(snapshot.manifolds, snapshot.coreWorld),
    () => {
      if (snapshot.gravity) {
        if (physics.gravity !== snapshot.gravity.reference) physics.gravity = snapshot.gravity.reference;
        restoreObjectFields(snapshot.gravity, "physics.gravity");
      }
    },
    () => {
      if (snapshot.coreGravity) {
        if (snapshot.coreWorld.gravity !== snapshot.coreGravity.reference) {
          snapshot.coreWorld.gravity = snapshot.coreGravity.reference;
        }
        restoreObjectFields(snapshot.coreGravity, "physics.core.world.gravity");
      }
    },
    () => {
      if (snapshot.diagnostics) {
        physics.diagnostics = snapshot.diagnostics.reference;
        restoreObjectFields(snapshot.diagnostics, "physics.diagnostics");
      } else {
        physics.diagnostics = snapshot.core.getDiagnostics?.() ?? null;
      }
    },
  ], "physics world");
  return physics;
}

function runtimeFunction(runtime, name) {
  if (typeof runtime?.[name] !== "function") throw new TypeError(`physics runtime.${name} must be a function`);
  return runtime[name].bind(runtime);
}

function uniqueMeshes(values) {
  const meshes = [];
  const seen = new Set();
  for (const value of iterable(values ?? [], "physics runtime targets")) {
    const mesh = value?.mesh ?? value;
    if (mesh == null || seen.has(mesh)) continue;
    objectValue(mesh, "physics runtime mesh");
    seen.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

function captureWeakMapEntries(map, meshes, label, captureValue = (value) => value) {
  if (!(map instanceof WeakMap)) throw new TypeError(`${label} must be a WeakMap`);
  return Object.freeze(meshes.map((mesh) => {
    const present = map.has(mesh);
    return Object.freeze({
      mesh,
      present,
      value: present ? captureValue(map.get(mesh), mesh) : undefined,
    });
  }));
}

function restoreWeakMapEntries(map, entries, restoreValue = (value) => value) {
  for (const entry of entries) {
    if (entry.present) map.set(entry.mesh, restoreValue(entry.value, entry.mesh));
    else map.delete(entry.mesh);
  }
}

function captureRepairValue(value) {
  if (value == null) return Object.freeze({ reference: value, values: null });
  return captureObjectFields(value, "physics repair state");
}

function restoreRepairValue(snapshot) {
  if (snapshot.reference == null) return snapshot.reference;
  return restoreObjectFields(snapshot, "physics repair state");
}

export function capturePhysicsRuntimeRollbackState(runtime, targets = []) {
  objectValue(runtime, "physics runtime");
  const deterministicWind = objectValue(runtime.deterministicWind, "deterministic wind field");
  if (typeof deterministicWind.snapshot !== "function" || typeof deterministicWind.restore !== "function") {
    throw new TypeError("deterministic wind field must expose snapshot/restore");
  }
  const meshes = uniqueMeshes(targets);
  const getRealtime = runtimeFunction(runtime, "getRealtimeWindEvaluationTime");
  const getOffline = runtimeFunction(runtime, "getOfflineWindEvaluationTime");
  const getSerial = runtimeFunction(runtime, "getWindCharacterSerial");
  const getStats = runtimeFunction(runtime, "getLastPhysicsRuntimeStats");
  const windCharacterIds = runtime.windCharacterIds;
  const physicsRepairState = runtime.physicsRepairState;
  return Object.freeze({
    kind: RUNTIME_SNAPSHOT_KIND,
    runtime,
    meshes: Object.freeze(meshes),
    realtimeWindEvaluationTime: finite(getRealtime(), "realtime wind evaluation time"),
    offlineWindEvaluationTime: finite(getOffline(), "offline wind evaluation time"),
    windCharacterSerial: finite(getSerial(), "wind character serial"),
    wind: deterministicWind.snapshot(),
    lastPhysicsRuntimeStats: clonePrimitiveRecord(getStats(), "last physics runtime stats"),
    windCharacterIds: captureWeakMapEntries(windCharacterIds, meshes, "windCharacterIds"),
    physicsRepairState: captureWeakMapEntries(
      physicsRepairState,
      meshes,
      "physicsRepairState",
      captureRepairValue,
    ),
  });
}

export function restorePhysicsRuntimeRollbackState(runtime, snapshot) {
  objectValue(runtime, "physics runtime");
  if (snapshot?.kind !== RUNTIME_SNAPSHOT_KIND || snapshot.runtime !== runtime) {
    throw new TypeError("physics runtime rollback snapshot is invalid or foreign");
  }
  const setRealtime = runtimeFunction(runtime, "setRealtimeWindEvaluationTime");
  const setOffline = runtimeFunction(runtime, "setOfflineWindEvaluationTime");
  const setSerial = runtimeFunction(runtime, "setWindCharacterSerial");
  const setStats = runtimeFunction(runtime, "setLastPhysicsRuntimeStats");
  restoreAll([
    () => runtime.deterministicWind.restore(snapshot.wind),
    () => setRealtime(snapshot.realtimeWindEvaluationTime),
    () => setOffline(snapshot.offlineWindEvaluationTime),
    () => setSerial(snapshot.windCharacterSerial),
    () => setStats({ ...snapshot.lastPhysicsRuntimeStats }),
    () => restoreWeakMapEntries(runtime.windCharacterIds, snapshot.windCharacterIds),
    () => restoreWeakMapEntries(
      runtime.physicsRepairState,
      snapshot.physicsRepairState,
      restoreRepairValue,
    ),
  ], "physics runtime");
  return runtime;
}

export function isPhysicsRollbackPending(pendingSet, target, label = "physics pending target") {
  if (!(pendingSet instanceof WeakSet)) throw new TypeError("physics pending state must be a WeakSet");
  return pendingSet.has(objectValue(target, label));
}

export function setPhysicsRollbackPending(
  pendingSet,
  target,
  pending,
  label = "physics pending target",
) {
  if (!(pendingSet instanceof WeakSet)) throw new TypeError("physics pending state must be a WeakSet");
  const key = objectValue(target, label);
  const value = booleanValue(pending, `${label} membership`);
  if (value) pendingSet.add(key);
  else pendingSet.delete(key);
  return value;
}
