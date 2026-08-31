/**
 * Per-character ownership registry for editor pose layers.
 *
 * A token may own at most one mesh at a time. Re-acquiring it on another mesh
 * is therefore an atomic transfer, which is exactly what the active-character
 * Smart Pose controller needs when the user changes selection.
 */
export class CharacterPoseOwnership {
  constructor() {
    this._ownersByMesh = new Map();
    this._meshByToken = new Map();
  }

  acquire(mesh, token, policy = {}) {
    if (!mesh || (typeof mesh !== "object" && typeof mesh !== "function")) {
      throw new TypeError("CharacterPoseOwnership.acquire requires a mesh object");
    }
    if (token == null) {
      throw new TypeError("CharacterPoseOwnership.acquire requires an owner token");
    }

    const previousMesh = this._meshByToken.get(token) || null;
    if (previousMesh && previousMesh !== mesh) this.release(previousMesh, token);

    let owners = this._ownersByMesh.get(mesh);
    if (!owners) {
      owners = new Map();
      this._ownersByMesh.set(mesh, owners);
    }
    const nextPolicy = Object.freeze({
      suspendPhysics: policy?.suspendPhysics !== false,
      source: String(policy?.source || "external-pose"),
    });
    const previousPolicy = owners.get(token);
    owners.set(token, nextPolicy);
    this._meshByToken.set(token, mesh);
    return previousMesh !== mesh
      || !previousPolicy
      || previousPolicy.suspendPhysics !== nextPolicy.suspendPhysics
      || previousPolicy.source !== nextPolicy.source;
  }

  release(mesh, token) {
    if (!mesh || token == null) return false;
    const owners = this._ownersByMesh.get(mesh);
    if (!owners?.delete(token)) return false;
    if (owners.size === 0) this._ownersByMesh.delete(mesh);
    if (this._meshByToken.get(token) === mesh) this._meshByToken.delete(token);
    return true;
  }

  releaseToken(token) {
    const mesh = this._meshByToken.get(token);
    return mesh ? this.release(mesh, token) : false;
  }

  clearMesh(mesh) {
    const owners = this._ownersByMesh.get(mesh);
    if (!owners) return 0;
    const count = owners.size;
    for (const token of owners.keys()) {
      if (this._meshByToken.get(token) === mesh) this._meshByToken.delete(token);
    }
    this._ownersByMesh.delete(mesh);
    return count;
  }

  owns(mesh, token = null) {
    const owners = mesh ? this._ownersByMesh.get(mesh) : null;
    return token == null ? !!owners?.size : !!owners?.has(token);
  }

  suspendsPhysics(mesh) {
    const owners = mesh ? this._ownersByMesh.get(mesh) : null;
    if (!owners) return false;
    for (const policy of owners.values()) {
      if (policy.suspendPhysics) return true;
    }
    return false;
  }

  meshForToken(token) {
    return this._meshByToken.get(token) || null;
  }

  ownerCount(mesh) {
    return this._ownersByMesh.get(mesh)?.size || 0;
  }

  get meshCount() {
    return this._ownersByMesh.size;
  }

  snapshot(labelOf = (mesh) => mesh?.name || mesh?.uuid || "(unnamed)") {
    return [...this._ownersByMesh.entries()].map(([mesh, owners]) => ({
      mesh: labelOf(mesh),
      owners: owners.size,
      suspendPhysics: [...owners.values()].some((policy) => policy.suspendPhysics),
      sources: [...new Set([...owners.values()].map((policy) => policy.source))],
    }));
  }
}
