import type * as THREE from 'three';
import type { MMDAnimationHelper, MMDPhysics } from 'three-stdlib';

export interface PhysicsModelRegistration {
  sceneModelId: string;
  mesh: THREE.SkinnedMesh;
  helper: MMDAnimationHelper;
  visible: boolean;
  contentHash: string;
  /** Collision group bit for duplicate isolation (1–15). */
  collisionGroupBit: number;
  getPhysics: () => MMDPhysics | undefined;
  syncSkeleton: () => void;
  /** Full physics rebuild fallback (destroys/recreates Bullet state). */
  restartPhysicsFull?: () => void;
  /** Re-enable helper physics flag after soft reset. */
  ensurePhysicsEnabled?: () => void;
}

const registry = new Map<string, PhysicsModelRegistration>();
let nextCollisionGroupBit = 1;

export function allocateCollisionGroupBit(): number {
  const bit = nextCollisionGroupBit;
  nextCollisionGroupBit = nextCollisionGroupBit >= 15 ? 1 : nextCollisionGroupBit + 1;
  return bit;
}

export function registerPhysicsModel(entry: PhysicsModelRegistration): void {
  registry.set(entry.sceneModelId, entry);
}

export function unregisterPhysicsModel(sceneModelId: string): void {
  registry.delete(sceneModelId);
}

export function updatePhysicsModelVisibility(sceneModelId: string, visible: boolean): void {
  const entry = registry.get(sceneModelId);
  if (entry) entry.visible = visible;
}

export function getAllPhysicsModels(): PhysicsModelRegistration[] {
  return Array.from(registry.values());
}

export function findDuplicateHashGroups(): Map<string, PhysicsModelRegistration[]> {
  const byHash = new Map<string, PhysicsModelRegistration[]>();
  for (const entry of registry.values()) {
    if (!entry.contentHash) continue;
    const list = byHash.get(entry.contentHash) ?? [];
    list.push(entry);
    byHash.set(entry.contentHash, list);
  }
  for (const [hash, list] of byHash) {
    if (list.length < 2) byHash.delete(hash);
  }
  return byHash;
}
