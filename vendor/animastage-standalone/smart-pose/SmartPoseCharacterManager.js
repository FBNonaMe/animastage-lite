import { cloneSmartPoseSettings } from "./SmartPosePresets.js?v=sp15";
import { CharacterPoseOwnership } from "./CharacterPoseOwnership.js";

const DELEGATED_METHODS = [
  "attachTransformControls",
  "bakeToBoneKeys",
  "beginTransform",
  "clearLayer",
  "controllerIdFromObject",
  "copyPose",
  "endTransform",
  "isTransformTarget",
  "loadPosePreset",
  "mirrorPose",
  "pastePose",
  "pickFromEvent",
  "releaseControllerOwnership",
  "resetPose",
  "savePosePreset",
  "selectController",
  "setLegSolverMode",
  "setSpace",
  "setTransformMode",
  "updateHover",
  "updateTransform",
];

function validMesh(mesh) {
  return !!mesh && typeof mesh === "object" && !!mesh.skeleton?.bones?.length;
}

/**
 * Owns one SmartPoseController per character while presenting the same public
 * surface as the former active-character singleton to the existing UI.
 *
 * Only the active controller may be enabled. Its ownership token is bound to
 * its immutable mesh, so a stale controller or Auto Grip request cannot pose a
 * different character after active-character selection changes.
 */
export class SmartPoseCharacterManager {
  constructor(deps = {}) {
    this.deps = deps;
    this.createController = deps.createController;
    if (typeof this.createController !== "function") {
      throw new TypeError(
        "SmartPoseCharacterManager requires deps.createController(controllerDeps)",
      );
    }
    const scopedBridge = deps.setScopedPoseOwner;
    const compatibilityBridge = deps.setExternalPoseOwner;
    if (
      typeof compatibilityBridge === "function" &&
      typeof scopedBridge !== "function" &&
      compatibilityBridge.supportsMeshScope !== true
    ) {
      throw new TypeError(
        "SmartPoseCharacterManager rejects an unscoped setExternalPoseOwner bridge; " +
        "provide setScopedPoseOwner(enabled, mesh, token, policy)",
      );
    }
    this.forwardScopedOwnership = typeof scopedBridge === "function"
      ? scopedBridge
      : (typeof compatibilityBridge === "function" ? compatibilityBridge : null);
    this.ownership = deps.ownership || new CharacterPoseOwnership();
    this.entries = new Map();
    this.activeMesh = null;
    this.enabled = false;
    this.defaultSettings = cloneSmartPoseSettings();
    this.listeners = new Set();
    this.disposed = false;

    for (const method of DELEGATED_METHODS) {
      if (method in this) continue;
      this[method] = (...args) => this._delegate(method, args);
    }
  }

  get activeController() {
    return this.entries.get(this.activeMesh)?.controller || null;
  }

  get settings() {
    return this.activeController?.settings || this.defaultSettings;
  }

  get selectedId() {
    return this.activeController?.selectedId || null;
  }

  isEnabled() {
    return this.enabled;
  }

  onChange(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emitChange() {
    for (const listener of this.listeners) {
      try { listener(this); } catch (_) {}
    }
  }

  _assertLive() {
    if (this.disposed) throw new Error("SmartPoseCharacterManager is disposed");
  }

  _reportLifecycleError(stage, error, mesh) {
    try {
      this.deps.onLifecycleError?.({ stage, error, mesh });
    } catch (_) {}
  }

  _entryFor(mesh, create = false) {
    if (!mesh) return null;
    let entry = this.entries.get(mesh) || null;
    if (!entry && create) entry = this.register(mesh);
    return entry;
  }

  register(mesh) {
    this._assertLive();
    if (!validMesh(mesh)) {
      throw new TypeError("SmartPoseCharacterManager.register requires a skinned character mesh");
    }
    const existing = this.entries.get(mesh);
    if (existing) return existing;

    const token = Object.freeze({ kind: "smart-pose-owner", mesh });
    const entry = {
      mesh,
      token,
      controller: null,
      unsubscribe: null,
      forwardedOwnership: false,
      disposed: false,
    };

    const setScopedOwnership = (enabled, requestedMesh = mesh, _requestedToken = token, policy = {}) => {
      // The controller's mesh is immutable. Never trust a mesh supplied by a
      // stale caller: accepting it would reintroduce the singleton cross-write.
      if (requestedMesh && requestedMesh !== mesh) return false;
      const effectivePolicy = {
        suspendPhysics: policy?.suspendPhysics !== false,
        source: policy?.source || "smart-pose",
      };
      if (enabled) {
        this.ownership.acquire(mesh, token, effectivePolicy);
        try {
          if (this.forwardScopedOwnership) {
            this.forwardScopedOwnership(true, mesh, token, effectivePolicy);
            entry.forwardedOwnership = true;
          }
        } catch (error) {
          this.ownership.release(mesh, token);
          // A bridge can mutate its store and still throw. Compensate so a
          // half-applied token cannot keep this character's physics suspended.
          try {
            this.forwardScopedOwnership?.(false, mesh, token, effectivePolicy);
            entry.forwardedOwnership = false;
          } catch (rollbackError) {
            entry.forwardedOwnership = true;
            error.rollbackError = rollbackError;
          }
          throw error;
        }
      } else {
        try {
          if (this.forwardScopedOwnership && entry.forwardedOwnership) {
            this.forwardScopedOwnership(false, mesh, token, effectivePolicy);
          }
          entry.forwardedOwnership = false;
        } catch (error) {
          // Keep this set so disposeMesh performs an idempotent retry.
          entry.forwardedOwnership = true;
          throw error;
        } finally {
          this.ownership.release(mesh, token);
        }
      }
      return true;
    };

    const controllerDeps = {
      ...this.deps,
      // A controller can only ever resolve the mesh it was created for.
      getMesh: () => mesh,
      getTimelineBridge: () => this.deps.getTimelineBridge?.(mesh),
      isPlaybackActive: () => !!this.deps.isPlaybackActive?.(mesh),
      setExternalPoseOwner: setScopedOwnership,
      isPhysicsSuspended: (requestedMesh = mesh) =>
        requestedMesh === mesh && this.ownership.suspendsPhysics(mesh),
      applyRestPose: () => this.deps.applyRestPose?.(mesh),
      onSkeletonChanged: (requestedMesh, boneNames) => {
        if (requestedMesh && requestedMesh !== mesh) return false;
        return this.deps.onSkeletonChanged?.(mesh, boneNames);
      },
      requestAttachRefresh: () => {
        if (this.activeMesh === mesh) this.deps.requestAttachRefresh?.();
      },
    };

    try {
      entry.controller = this.createController(controllerDeps);
      if (!entry.controller || typeof entry.controller.setEnabled !== "function") {
        throw new TypeError("Smart Pose controller factory returned an invalid controller");
      }
      for (const [name, value] of Object.entries(this.defaultSettings)) {
        if (entry.controller.settings?.[name] !== value) {
          entry.controller.setSetting?.(name, value);
        }
      }
      entry.unsubscribe = entry.controller.onChange?.(() => {
        if (this.activeMesh === mesh) this._emitChange();
      }) || null;
      this.entries.set(mesh, entry);
      return entry;
    } catch (error) {
      this.ownership.releaseToken(token);
      entry.controller?.gizmos?.dispose?.();
      throw error;
    }
  }

  activate(mesh) {
    this._assertLive();
    if (mesh != null && !validMesh(mesh)) return false;
    if (mesh === this.activeMesh) return true;

    const previousMesh = this.activeMesh;
    const previous = this.activeController;
    const previousWasEnabled = !!previous?.isEnabled?.();
    let next = null;
    try {
      if (previousWasEnabled) previous.setEnabled(false);
      this.activeMesh = mesh || null;
      next = mesh ? this._entryFor(mesh, true)?.controller : null;
      if (next) {
        // SmartPoseController exposes the active logger through this method.
        // Reinstalling it on selection keeps diagnostics scoped to the UI model.
        next.installLogConsole?.();
        if (this.enabled && !next.isEnabled?.()) next.setEnabled(true);
      }
    } catch (error) {
      // Character switches are transactional: a failed controller factory or
      // ownership bridge must not strand the old character disabled, nor leave
      // a half-enabled new character owning its physics policy.
      try {
        if (next?.isEnabled?.()) next.setEnabled(false);
      } catch (_) {}
      this.activeMesh = previousMesh;
      try {
        if (previousWasEnabled && !previous?.isEnabled?.()) previous.setEnabled(true);
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
    this.deps.onActiveControllerChanged?.(next, previous, this.activeMesh);
    this.deps.requestAttachRefresh?.();
    this._emitChange();
    return true;
  }

  setEnabled(enabled) {
    this._assertLive();
    const next = !!enabled;
    if (this.enabled === next) return;
    const previous = this.enabled;
    this.enabled = next;
    let controller = null;
    try {
      controller = this.activeMesh
        ? this._entryFor(this.activeMesh, next)?.controller
        : null;
      if (controller && controller.isEnabled?.() !== next) controller.setEnabled(next);
    } catch (error) {
      this.enabled = previous;
      try {
        if (controller && controller.isEnabled?.() !== previous) {
          controller.setEnabled(previous);
        }
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    }
    this.deps.requestAttachRefresh?.();
    this._emitChange();
  }

  setSetting(name, value) {
    this._assertLive();
    const controller = this.activeController;
    if (controller) return controller.setSetting(name, value);
    if (name in this.defaultSettings) this.defaultSettings[name] = value;
    this._emitChange();
  }

  update() {
    if (!this.disposed && this.enabled) this.activeController?.update?.();
  }

  // Backward-compatible active-controller signature. Auto Grip already passes
  // options.mesh; that explicit mesh is validated instead of being discarded.
  solveControllerWorldPose(id, worldPosition, worldQuaternion = null, options = {}) {
    return this.solveControllerWorldPoseForMesh(
      options?.mesh || this.activeMesh,
      id,
      worldPosition,
      worldQuaternion,
      options,
    );
  }

  solveControllerWorldPoseForMesh(mesh, id, worldPosition, worldQuaternion = null, options = {}) {
    if (this.disposed || !this.enabled || mesh !== this.activeMesh) return false;
    const controller = this.activeController;
    if (!controller?.isEnabled?.()) return false;
    return !!controller.solveControllerWorldPose?.(
      id,
      worldPosition,
      worldQuaternion,
      { ...options, mesh },
    );
  }

  owns(mesh) {
    return this.ownership.owns(mesh);
  }

  suspendsPhysics(mesh) {
    return this.ownership.suspendsPhysics(mesh);
  }

  controllerFor(mesh) {
    return this.entries.get(mesh)?.controller || null;
  }

  _delegate(method, args) {
    if (this.disposed) return false;
    const target = this.activeController?.[method];
    return typeof target === "function"
      ? target.apply(this.activeController, args)
      : false;
  }

  disposeMesh(mesh) {
    const entry = this.entries.get(mesh);
    if (!entry) return false;
    const errors = [];
    const attempt = (stage, action) => {
      try { action(); } catch (error) { errors.push({ stage, error }); }
    };
    if (this.activeMesh === mesh) {
      this.activeMesh = null;
    }
    if (entry.controller?.isEnabled?.()) {
      attempt("disable-controller", () => entry.controller.setEnabled(false));
    }
    attempt("unsubscribe-controller", () => entry.unsubscribe?.());
    if (entry.forwardedOwnership) {
      attempt("release-scoped-owner", () => {
        this.forwardScopedOwnership?.(false, mesh, entry.token, {
          suspendPhysics: true,
          source: "smart-pose-dispose",
        });
        entry.forwardedOwnership = false;
      });
    }
    this.ownership.releaseToken(entry.token);
    attempt("dispose-gizmos", () => entry.controller?.gizmos?.dispose?.());
    entry.disposed = true;
    this.entries.delete(mesh);
    attempt("refresh-attachment", () => this.deps.requestAttachRefresh?.());
    this._emitChange();
    for (const { stage, error } of errors) {
      this._reportLifecycleError(stage, error, mesh);
    }
    return true;
  }

  dispose() {
    if (this.disposed) return;
    for (const mesh of [...this.entries.keys()]) this.disposeMesh(mesh);
    this.activeMesh = null;
    this.enabled = false;
    this.listeners.clear();
    this.disposed = true;
  }

  /** Stable adapter surface for the root application migration. */
  productionHooks() {
    return Object.freeze({
      uiController: this,
      setActiveMesh: (mesh) => this.activate(mesh),
      disposeMesh: (mesh) => this.disposeMesh(mesh),
      updateActive: () => this.update(),
      solveForMesh: (mesh, id, position, quaternion, options) =>
        this.solveControllerWorldPoseForMesh(mesh, id, position, quaternion, options),
      ownsMesh: (mesh) => this.owns(mesh),
      suspendsPhysicsForMesh: (mesh) => this.suspendsPhysics(mesh),
      ownershipSnapshot: () => this.ownership.snapshot(),
    });
  }
}

export function createSmartPoseCharacterManager(deps = {}) {
  return new SmartPoseCharacterManager(deps);
}
