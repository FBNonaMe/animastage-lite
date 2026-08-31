/**
 * Two-phase Session v3 import boundary for the legacy AnimeStage shell.
 *
 * This module deliberately knows nothing about DOM, Three.js, PMX, VMD or the
 * Performance System. The composition root supplies narrow callbacks which
 * allocate/load invisible staging characters, restore their dependent layers,
 * atomically promote the completed set, and dispose/restore on failure.
 */

import { normalizeEffectStackSnapshot } from "../effects/presets/EffectPresets.js";

export const SESSION_IMPORT_STATES = Object.freeze({
  IDLE: "idle",
  VALIDATING: "validating",
  PREFLIGHT: "preflight",
  CAPTURING: "capturing",
  STAGING: "staging",
  READY: "ready",
  COMMITTING: "committing",
  COMMITTED: "committed",
  ROLLING_BACK: "rolling-back",
  ROLLED_BACK: "rolled-back",
  FAILED: "failed",
});

export const SESSION_IMPORT_LAYER_KINDS = Object.freeze({
  SOURCES: "sources",
  GENERATED: "generated",
  LEGACY_VMD: "legacy-vmd",
});

export class SessionImportError extends Error {
  constructor(message, { code = "SESSION_IMPORT_ERROR", phase = null, cause, details } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SessionImportError";
    this.code = code;
    this.phase = phase;
    this.details = details ?? null;
  }
}

export class SessionImportValidationError extends SessionImportError {
  constructor(message, details = null) {
    super(message, {
      code: "SESSION_IMPORT_INVALID",
      phase: SESSION_IMPORT_STATES.VALIDATING,
      details,
    });
    this.name = "SessionImportValidationError";
  }
}

export class SessionImportConfigurationError extends SessionImportError {
  constructor(message, details = null) {
    super(message, {
      code: "SESSION_IMPORT_CONFIGURATION",
      phase: "configuration",
      details,
    });
    this.name = "SessionImportConfigurationError";
  }
}

export class SessionImportStageError extends SessionImportError {
  constructor(message, { phase = SESSION_IMPORT_STATES.STAGING, cause, details } = {}) {
    super(message, {
      code: "SESSION_IMPORT_STAGE_FAILED",
      phase,
      cause,
      details,
    });
    this.name = "SessionImportStageError";
  }
}

export class SessionImportCancelledError extends SessionImportError {
  constructor(message = "Session import cancelled", { phase = null, cause, details } = {}) {
    super(message, {
      code: "SESSION_IMPORT_CANCELLED",
      phase,
      cause,
      details,
    });
    this.name = "SessionImportCancelledError";
  }
}

export function isSessionImportCancelled(error) {
  return error instanceof SessionImportCancelledError
    || error?.code === "SESSION_IMPORT_CANCELLED"
    || error?.name === "AbortError"
    || error?.code === "ABORT_ERR";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObjectOrNull(value, path) {
  if (value != null && !isObject(value)) {
    throw new SessionImportValidationError(`${path} must be an object or null`, { path });
  }
}

function normalizeString(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new SessionImportValidationError(`${path} must be a non-empty string`, { path });
  }
  return value.trim();
}

function normalizeStringArray(value, path, { optional = true } = {}) {
  if (value == null && optional) return Object.freeze([]);
  if (!Array.isArray(value)) {
    throw new SessionImportValidationError(`${path} must be an array`, { path });
  }
  const result = value.map((entry, index) => normalizeString(entry, `${path}[${index}]`));
  return Object.freeze(result);
}

function optionalFiniteNumber(value, path, fallback) {
  if (value == null) return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new SessionImportValidationError(`${path} must be a finite number`, { path });
  }
  return numeric;
}

function optionalBoolean(value, path, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "boolean") {
    throw new SessionImportValidationError(`${path} must be a boolean`, { path });
  }
  return value;
}

function normalizeLayer(layer, characterIndex, layerIndex) {
  const path = `characters[${characterIndex}].animationLayers[${layerIndex}]`;
  if (!isObject(layer)) {
    throw new SessionImportValidationError(`${path} must be an object`, { path });
  }
  const sourceNames = normalizeStringArray(layer.sourceNames, `${path}.sourceNames`);
  const hasGeneratedClip = layer.clipData != null;
  if (hasGeneratedClip && !isObject(layer.clipData)) {
    throw new SessionImportValidationError(`${path}.clipData must be an object or null`, {
      path: `${path}.clipData`,
    });
  }
  if (sourceNames.length === 0 && !hasGeneratedClip) {
    throw new SessionImportValidationError(
      `${path} must contain sourceNames or clipData`,
      { path },
    );
  }
  const metadata = Object.freeze({ ...layer, sourceNames });
  return Object.freeze({
    index: layerIndex,
    kind: sourceNames.length > 0
      ? SESSION_IMPORT_LAYER_KINDS.SOURCES
      : SESSION_IMPORT_LAYER_KINDS.GENERATED,
    name: typeof layer.name === "string" ? layer.name : "",
    sourceNames,
    clipData: hasGeneratedClip ? layer.clipData : null,
    metadata,
  });
}

function normalizeLegacyLayers(loadedVmdNames) {
  return Object.freeze(loadedVmdNames.map((name, index) => Object.freeze({
    index,
    kind: SESSION_IMPORT_LAYER_KINDS.LEGACY_VMD,
    name,
    sourceNames: Object.freeze([name]),
    clipData: null,
    metadata: Object.freeze({
      name,
      sourceNames: Object.freeze([name]),
      kind: "vmd",
    }),
  })));
}

function freezeCharacterDescriptor(source, index, id, version) {
  const path = `characters[${index}]`;
  const modelFileName = normalizeString(source.modelFileName, `${path}.modelFileName`);
  const loadedVmdNames = normalizeStringArray(source.loadedVmdNames, `${path}.loadedVmdNames`);
  if (source.animationLayers != null && !Array.isArray(source.animationLayers)) {
    throw new SessionImportValidationError(`${path}.animationLayers must be an array`, {
      path: `${path}.animationLayers`,
    });
  }
  const layers = Array.isArray(source.animationLayers)
    ? Object.freeze(source.animationLayers.map((layer, layerIndex) => (
      normalizeLayer(layer, index, layerIndex)
    )))
    : normalizeLegacyLayers(loadedVmdNames);

  assertObjectOrNull(source.transform, `${path}.transform`);
  assertObjectOrNull(source.performanceSystem, `${path}.performanceSystem`);
  assertObjectOrNull(source.manualBoneLayer, `${path}.manualBoneLayer`);

  const activeAnimIdx = optionalFiniteNumber(source.activeAnimIdx, `${path}.activeAnimIdx`, -1);
  if (!Number.isInteger(activeAnimIdx) || activeAnimIdx < -1 || activeAnimIdx >= layers.length) {
    throw new SessionImportValidationError(
      `${path}.activeAnimIdx must be -1 or an existing animation-layer index`,
      { path: `${path}.activeAnimIdx`, value: activeAnimIdx, layerCount: layers.length },
    );
  }

  return Object.freeze({
    index,
    id,
    modelFileName,
    transform: source.transform ?? null,
    activeAnimIdx,
    animPlaying: optionalBoolean(source.animPlaying, `${path}.animPlaying`, false),
    animTime: optionalFiniteNumber(source.animTime, `${path}.animTime`, 0),
    loopIn: optionalFiniteNumber(source.loopIn, `${path}.loopIn`, 0),
    loopOut: optionalFiniteNumber(source.loopOut, `${path}.loopOut`, 0),
    loadedVmdNames,
    animationLayers: layers,
    performanceSystem: source.performanceSystem ?? null,
    manualBoneLayer: source.manualBoneLayer ?? null,
    sessionVersion: version,
  });
}

/**
 * Synchronous, mutation-free Session validation and normalization.
 *
 * `resolveCharacterId` exists only for explicit legacy migration. Session v3
 * callers should keep the strict default and persist a stable non-empty id.
 */
export function validateLegacySessionImport(data, options = {}) {
  if (!isObject(data)) {
    throw new SessionImportValidationError("Session must be an object", { path: "$" });
  }
  const supportedVersions = options.supportedVersions ?? [3];
  const versions = new Set(Array.from(supportedVersions, Number));
  const version = Number(data.version);
  if (!Number.isInteger(version) || !versions.has(version)) {
    throw new SessionImportValidationError(
      `Unsupported session version: ${String(data.version)}`,
      { path: "version", supportedVersions: Object.freeze([...versions]) },
    );
  }
  if (!Array.isArray(data.characters)) {
    throw new SessionImportValidationError("characters must be an array", {
      path: "characters",
    });
  }

  const resolveCharacterId = options.resolveCharacterId ?? ((source) => source.id);
  if (typeof resolveCharacterId !== "function") {
    throw new SessionImportConfigurationError("resolveCharacterId must be a function");
  }
  const seenIds = new Set();
  const characters = data.characters.map((source, index) => {
    const path = `characters[${index}]`;
    if (!isObject(source)) {
      throw new SessionImportValidationError(`${path} must be an object`, { path });
    }
    const id = normalizeString(resolveCharacterId(source, index, data), `${path}.id`);
    if (seenIds.has(id)) {
      throw new SessionImportValidationError(`Duplicate character id: ${id}`, {
        path: `${path}.id`,
        characterId: id,
      });
    }
    seenIds.add(id);
    return freezeCharacterDescriptor(source, index, id, version);
  });

  const activeCharacterId = data.activeCharacterId == null
    ? null
    : normalizeString(data.activeCharacterId, "activeCharacterId");
  if (activeCharacterId !== null && !seenIds.has(activeCharacterId)) {
    throw new SessionImportValidationError(
      `activeCharacterId does not reference a session character: ${activeCharacterId}`,
      { path: "activeCharacterId", activeCharacterId },
    );
  }

  const globalVmdFileNames = normalizeStringArray(
    data.globalVmdFileNames,
    "globalVmdFileNames",
  );
  let effectStack = null;
  if (data.effectStack != null) {
    try {
      effectStack = normalizeEffectStackSnapshot(data.effectStack);
    } catch (cause) {
      throw new SessionImportValidationError(
        `effectStack is invalid: ${cause?.message || cause}`,
        { path: "effectStack", cause },
      );
    }
  }
  const dependencyNames = new Set(globalVmdFileNames);
  for (const character of characters) {
    dependencyNames.add(character.modelFileName);
    for (const layer of character.animationLayers) {
      for (const name of layer.sourceNames) dependencyNames.add(name);
    }
  }

  return Object.freeze({
    version,
    activeCharacterId,
    characters: Object.freeze(characters),
    globalVmdFileNames,
    effectStack,
    dependencyNames: Object.freeze([...dependencyNames]),
  });
}

function requiredCallback(configuration, name) {
  const callback = configuration?.[name];
  if (typeof callback !== "function") {
    throw new SessionImportConfigurationError(`${name} must be a function`, { callback: name });
  }
  return callback;
}

function optionalCallback(configuration, name) {
  const callback = configuration?.[name];
  if (callback == null) return null;
  if (typeof callback !== "function") {
    throw new SessionImportConfigurationError(`${name} must be a function`, { callback: name });
  }
  return callback;
}

function callbackFailed(result, { allowNull = false } = {}) {
  return result === false
    || (!allowNull && result == null)
    || (isObject(result) && result.ok === false);
}

function cancellationError(signal, phase, details) {
  const reason = signal?.reason;
  if (reason instanceof SessionImportCancelledError) return reason;
  return new SessionImportCancelledError(
    reason instanceof Error && reason.message
      ? reason.message
      : typeof reason === "string" && reason
        ? reason
        : "Session import cancelled",
    {
      phase,
      cause: reason instanceof Error ? reason : undefined,
      details,
    },
  );
}

function throwIfCancelled(signal, phase, details) {
  if (signal?.aborted) throw cancellationError(signal, phase, details);
}

function attachFailureMetadata(error, phase, details) {
  if (!(error instanceof Error)) {
    return new SessionImportStageError(String(error), { phase, details });
  }
  try {
    if (!("sessionImportPhase" in error)) {
      Object.defineProperty(error, "sessionImportPhase", {
        configurable: true,
        enumerable: false,
        value: phase,
      });
    }
    if (!("sessionImportDetails" in error)) {
      Object.defineProperty(error, "sessionImportDetails", {
        configurable: true,
        enumerable: false,
        value: details ?? null,
      });
    }
  } catch {
    // Frozen third-party errors remain authoritative even without metadata.
  }
  return error;
}

function attachCleanupError(primary, cleanupError) {
  if (!(primary instanceof Error)) return;
  try {
    Object.defineProperty(primary, "sessionImportCleanupError", {
      configurable: true,
      enumerable: false,
      value: cleanupError,
    });
  } catch {
    // Do not replace a frozen primary error with a cleanup error.
  }
}

let nextTransactionId = 1;

/**
 * Reusable two-phase transaction for legacy session restore.
 *
 * Required callbacks:
 *   captureScene(context) -> opaque snapshot
 *   createStagedCharacter(context) -> immediately registered staging handle
 *   loadStagedCharacter(context) -> model load result
 *   commitScene(context) -> atomically promote the completed staging set
 *   disposeStagedCharacter(context)
 *   restoreScene(context)
 *
 * Optional callbacks:
 *   preflightSession(context), stageAnimationLayer(context),
 *   stagePerformance(context), finalizeStagedCharacter(context), onEvent(event)
 *
 * Every callback may be synchronous or async. A model/layer callback returning
 * null, false or { ok:false } is a failure. Performance/finalize/commit callbacks
 * may be void; they signal failure by throwing, returning false or { ok:false }.
 */
export class LegacySessionImportTransaction {
  #callbacks;
  #validationOptions;
  #state = SESSION_IMPORT_STATES.IDLE;
  #runPromise = null;

  constructor(configuration = {}) {
    this.#callbacks = Object.freeze({
      captureScene: requiredCallback(configuration, "captureScene"),
      createStagedCharacter: requiredCallback(configuration, "createStagedCharacter"),
      loadStagedCharacter: requiredCallback(configuration, "loadStagedCharacter"),
      commitScene: requiredCallback(configuration, "commitScene"),
      disposeStagedCharacter: requiredCallback(configuration, "disposeStagedCharacter"),
      restoreScene: requiredCallback(configuration, "restoreScene"),
      preflightSession: optionalCallback(configuration, "preflightSession"),
      stageAnimationLayer: optionalCallback(configuration, "stageAnimationLayer"),
      stagePerformance: optionalCallback(configuration, "stagePerformance"),
      finalizeStagedCharacter: optionalCallback(configuration, "finalizeStagedCharacter"),
      onEvent: optionalCallback(configuration, "onEvent"),
    });
    this.#validationOptions = Object.freeze({
      supportedVersions: configuration.supportedVersions ?? [3],
      resolveCharacterId: configuration.resolveCharacterId,
    });
  }

  get state() {
    return this.#state;
  }

  get active() {
    return this.#state !== SESSION_IMPORT_STATES.IDLE
      && this.#state !== SESSION_IMPORT_STATES.COMMITTED
      && this.#state !== SESSION_IMPORT_STATES.ROLLED_BACK
      && this.#state !== SESSION_IMPORT_STATES.FAILED;
  }

  run(data, options = {}) {
    if (this.#runPromise) return this.#runPromise;
    this.#runPromise = this.#execute(data, options);
    return this.#runPromise;
  }

  async #execute(data, options) {
    const transactionId = `session-import-${nextTransactionId++}`;
    const signal = options?.signal ?? null;
    let session = null;
    let sceneSnapshot;
    let sceneCaptured = false;
    const stagedEntries = [];

    try {
      this.#setState(SESSION_IMPORT_STATES.VALIDATING, transactionId);
      throwIfCancelled(signal, this.#state);
      session = validateLegacySessionImport(data, this.#validationOptions);
      throwIfCancelled(signal, this.#state);

      this.#setState(SESSION_IMPORT_STATES.PREFLIGHT, transactionId, {
        characterCount: session.characters.length,
      });
      if (this.#callbacks.preflightSession) {
        const result = await this.#callbacks.preflightSession(Object.freeze({
          transactionId,
          session,
          signal,
        }));
        if (callbackFailed(result, { allowNull: true })) {
          throw new SessionImportStageError("Session dependency preflight failed", {
            phase: SESSION_IMPORT_STATES.PREFLIGHT,
          });
        }
      }
      throwIfCancelled(signal, this.#state);

      this.#setState(SESSION_IMPORT_STATES.CAPTURING, transactionId);
      sceneSnapshot = await this.#callbacks.captureScene(Object.freeze({
        transactionId,
        session,
        signal,
      }));
      sceneCaptured = true;
      throwIfCancelled(signal, this.#state);

      this.#setState(SESSION_IMPORT_STATES.STAGING, transactionId);
      for (const character of session.characters) {
        throwIfCancelled(signal, this.#state, { characterId: character.id });
        const baseContext = {
          transactionId,
          session,
          character,
          characterIndex: character.index,
          signal,
          sceneSnapshot,
        };
        const stagedCharacter = await this.#callbacks.createStagedCharacter(
          Object.freeze(baseContext),
        );
        if (callbackFailed(stagedCharacter)) {
          throw new SessionImportStageError(
            `Could not allocate staging character ${character.id}`,
            { details: { characterId: character.id, characterIndex: character.index } },
          );
        }
        const entry = {
          character,
          stagedCharacter,
          layerResults: [],
          performanceResult: undefined,
          finalizeResult: undefined,
        };
        stagedEntries.push(entry);
        const characterContext = () => Object.freeze({
          ...baseContext,
          stagedCharacter,
          stagedCharacters: Object.freeze(stagedEntries.map((item) => item.stagedCharacter)),
        });

        throwIfCancelled(signal, this.#state, { characterId: character.id });
        const modelResult = await this.#callbacks.loadStagedCharacter(characterContext());
        if (callbackFailed(modelResult)) {
          throw new SessionImportStageError(`Model load failed for ${character.id}`, {
            details: {
              characterId: character.id,
              characterIndex: character.index,
              modelFileName: character.modelFileName,
            },
          });
        }
        throwIfCancelled(signal, this.#state, { characterId: character.id });

        for (const layer of character.animationLayers) {
          if (!this.#callbacks.stageAnimationLayer) {
            throw new SessionImportConfigurationError(
              "stageAnimationLayer is required when a session contains animation layers",
              { characterId: character.id, layerIndex: layer.index },
            );
          }
          const result = await this.#callbacks.stageAnimationLayer(Object.freeze({
            ...characterContext(),
            layer,
            layerIndex: layer.index,
          }));
          if (callbackFailed(result)) {
            throw new SessionImportStageError(
              `${layer.kind} animation layer failed for ${character.id}`,
              {
                details: {
                  characterId: character.id,
                  characterIndex: character.index,
                  layerIndex: layer.index,
                  layerKind: layer.kind,
                  layerName: layer.name,
                  sourceNames: layer.sourceNames,
                },
              },
            );
          }
          entry.layerResults.push(result);
          throwIfCancelled(signal, this.#state, {
            characterId: character.id,
            layerIndex: layer.index,
          });
        }

        if (character.performanceSystem != null) {
          if (!this.#callbacks.stagePerformance) {
            throw new SessionImportConfigurationError(
              "stagePerformance is required when a session contains performance state",
              { characterId: character.id },
            );
          }
          entry.performanceResult = await this.#callbacks.stagePerformance(Object.freeze({
            ...characterContext(),
            performance: character.performanceSystem,
          }));
          if (callbackFailed(entry.performanceResult, { allowNull: true })) {
            throw new SessionImportStageError(
              `Performance restore failed for ${character.id}`,
              { details: { characterId: character.id, characterIndex: character.index } },
            );
          }
          throwIfCancelled(signal, this.#state, { characterId: character.id });
        }

        if (this.#callbacks.finalizeStagedCharacter) {
          entry.finalizeResult = await this.#callbacks.finalizeStagedCharacter(Object.freeze({
            ...characterContext(),
            layerResults: Object.freeze(entry.layerResults.slice()),
            performanceResult: entry.performanceResult,
          }));
          if (callbackFailed(entry.finalizeResult, { allowNull: true })) {
            throw new SessionImportStageError(
              `Final staging step failed for ${character.id}`,
              { details: { characterId: character.id, characterIndex: character.index } },
            );
          }
          throwIfCancelled(signal, this.#state, { characterId: character.id });
        }
      }

      this.#setState(SESSION_IMPORT_STATES.READY, transactionId, {
        characterCount: stagedEntries.length,
      });
      throwIfCancelled(signal, this.#state);
      this.#setState(SESSION_IMPORT_STATES.COMMITTING, transactionId);
      const commitResult = await this.#callbacks.commitScene(Object.freeze({
        transactionId,
        session,
        signal,
        sceneSnapshot,
        stagedCharacters: Object.freeze(stagedEntries.map((entry) => entry.stagedCharacter)),
        stagedEntries: Object.freeze(stagedEntries.map((entry) => Object.freeze({
          character: entry.character,
          stagedCharacter: entry.stagedCharacter,
          layerResults: Object.freeze(entry.layerResults.slice()),
          performanceResult: entry.performanceResult,
          finalizeResult: entry.finalizeResult,
        }))),
      }));
      if (callbackFailed(commitResult, { allowNull: true })) {
        throw new SessionImportStageError("Session commit failed", {
          phase: SESSION_IMPORT_STATES.COMMITTING,
        });
      }
      throwIfCancelled(signal, this.#state);
      this.#state = SESSION_IMPORT_STATES.COMMITTED;
      this.#emit({ type: "state", state: this.#state, transactionId });
      return Object.freeze({
        status: SESSION_IMPORT_STATES.COMMITTED,
        transactionId,
        characterCount: stagedEntries.length,
        activeCharacterId: session.activeCharacterId,
        commitResult,
      });
    } catch (caught) {
      const error = attachFailureMetadata(caught, this.#state, {
        transactionId,
        stagedCharacterCount: stagedEntries.length,
      });
      if (!sceneCaptured) {
        this.#state = SESSION_IMPORT_STATES.FAILED;
        this.#emit({ type: "state", state: this.#state, transactionId, error });
        throw error;
      }
      this.#state = SESSION_IMPORT_STATES.ROLLING_BACK;
      this.#emit({ type: "state", state: this.#state, transactionId, error });
      const cleanupErrors = [];
      for (let index = stagedEntries.length - 1; index >= 0; index -= 1) {
        const entry = stagedEntries[index];
        try {
          await this.#callbacks.disposeStagedCharacter(Object.freeze({
            transactionId,
            session,
            signal,
            sceneSnapshot,
            cause: error,
            character: entry.character,
            characterIndex: entry.character.index,
            stagedCharacter: entry.stagedCharacter,
          }));
        } catch (cleanupError) {
          cleanupErrors.push(new SessionImportStageError(
            `Could not dispose staged character ${entry.character.id}`,
            {
              phase: SESSION_IMPORT_STATES.ROLLING_BACK,
              cause: cleanupError,
              details: { characterId: entry.character.id },
            },
          ));
        }
      }
      try {
        await this.#callbacks.restoreScene(Object.freeze({
          transactionId,
          session,
          signal,
          sceneSnapshot,
          cause: error,
          stagedCharacters: Object.freeze(stagedEntries.map((entry) => entry.stagedCharacter)),
        }));
      } catch (cleanupError) {
        cleanupErrors.push(new SessionImportStageError("Could not restore the previous scene", {
          phase: SESSION_IMPORT_STATES.ROLLING_BACK,
          cause: cleanupError,
        }));
      }
      if (cleanupErrors.length) {
        attachCleanupError(error, new AggregateError(
          cleanupErrors,
          `Session import rollback completed with ${cleanupErrors.length} error(s)`,
        ));
      }
      this.#state = SESSION_IMPORT_STATES.ROLLED_BACK;
      this.#emit({ type: "state", state: this.#state, transactionId, error });
      throw error;
    }
  }

  #setState(state, transactionId, details = null) {
    this.#state = state;
    this.#emit({ type: "state", state, transactionId, details });
  }

  #emit(event) {
    if (!this.#callbacks.onEvent) return;
    try {
      const result = this.#callbacks.onEvent(Object.freeze(event));
      if (result && typeof result.then === "function") {
        result.catch(() => {});
      }
    } catch {
      // Diagnostics must never decide whether scene data commits or rolls back.
    }
  }
}
