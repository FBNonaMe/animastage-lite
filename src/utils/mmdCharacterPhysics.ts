/**
 * MMD Bullet physics helpers — ported from mmd_rtx / mmd-character-motion.js
 * (IK fix, arm/torso collision groups, wind, stable MMDPhysics tuning).
 */
import * as THREE from 'three';
import type { MMDAnimationHelper, MMDPhysics } from 'three-stdlib';

export interface MmdPhysicsRigidBodyParams {
  name?: string;
  englishName?: string;
  boneIndex?: number;
  groupIndex: number;
  groupTarget: number;
  type: number;
  shapeType: number;
  mass?: number;
  positionDamping?: number;
  rotationDamping?: number;
}

export interface MmdPhysicsBodyWrapper {
  params: MmdPhysicsRigidBodyParams;
  body: {
    setDamping: (lin: number, ang: number) => void;
    setMassProps: (mass: number, inertia: unknown) => void;
    updateInertiaTensor: () => void;
  clearForces?: () => void;
    setLinearVelocity: (v: unknown) => void;
    setAngularVelocity: (v: unknown) => void;
    getLinearVelocity: () => { x: () => number; y: () => number; z: () => number };
    getAngularVelocity: () => { x: () => number; y: () => number; z: () => number };
    setCollisionFlags: (flags: number) => void;
    setActivationState: (state: number) => void;
    applyCentralForce: (v: unknown) => void;
    activate: (force?: boolean) => void;
  } | null;
  bone?: THREE.Bone;
  updateFromBone?: () => void;
}

export interface MmdPhysicsSettings {
  stablePhys: boolean;
  physicsRate: number;
  physicsSubsteps: number;
  physicsGravity: number;
  physicsWarmup: number;
  physicsSwing: number;
  physicsWind: number;
}

export const DEFAULT_MMD_PHYSICS_SETTINGS: MmdPhysicsSettings = {
  stablePhys: true,
  physicsRate: 65,
  physicsSubsteps: 3,
  physicsGravity: 1.0,
  physicsWarmup: 60,
  physicsSwing: 0,
  physicsWind: 0,
};

export const mmdPhysicsSettings: MmdPhysicsSettings = { ...DEFAULT_MMD_PHYSICS_SETTINGS };

let ammoPhysicsBroken = false;
let physWindSmoothed = 0;

const PHYS_LIMITS = {
  rateMin: 50,
  rateMax: 80,
  subMin: 2,
  subMax: 20,
  swingMax: 0.55,
};

const TORSO_PHYSICS_NAME = /胸|乳|breast|bust|torso|上半身|abdomen|腹|鎖骨|锁骨/i;

type IkSolverLike = {
  iks: Array<{ active?: boolean; target: number; effector: number; links?: Array<{ index: number }> }>;
  updateOne: (ik: unknown) => unknown;
  update: () => unknown;
  _armIkFixPatched?: boolean;
};

type HelperMeshState = {
  physics?: MMDPhysics;
  ikSolver?: IkSolverLike;
};

type HelperWithObjects = MMDAnimationHelper & {
  objects: WeakMap<THREE.SkinnedMesh, HelperMeshState>;
  configuration: { pmxAnimation?: boolean };
};

export function isAmmoPhysicsBroken(): boolean {
  return ammoPhysicsBroken;
}

export function markAmmoPhysicsBroken(reason: unknown): void {
  if (ammoPhysicsBroken) return;
  ammoPhysicsBroken = true;
  console.warn('[MMD Physics] Bullet disabled for this session:', reason);
}

export function resetAmmoPhysicsBroken(): void {
  ammoPhysicsBroken = false;
}

const OOM_PATTERN =
  /out of memory|\bOOM\b|WebAssembly|wasm.*(fail|error|oom)|unreachable|RuntimeError/i;

/** Call once at app boot — disables physics after WASM OOM (mmd_rtx pattern). */
export function installAmmoCrashGuard(): () => void {
  const onError = (ev: ErrorEvent) => {
    const msg = String(ev.message || ev.error || '');
    if (OOM_PATTERN.test(msg)) markAmmoPhysicsBroken(msg);
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    const msg = String(ev.reason?.message || ev.reason || '');
    if (OOM_PATTERN.test(msg)) {
      markAmmoPhysicsBroken(msg);
      ev.preventDefault();
    }
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

function clampPhysRate(r: number): number {
  return Math.min(PHYS_LIMITS.rateMax, Math.max(PHYS_LIMITS.rateMin, Math.round(r)));
}

function clampPhysSub(s: number): number {
  return Math.min(PHYS_LIMITS.subMax, Math.max(PHYS_LIMITS.subMin, Math.round(s)));
}

function effectivePhysRate(s: MmdPhysicsSettings): number {
  return s.stablePhys ? 65 : clampPhysRate(s.physicsRate);
}

function effectivePhysSub(s: MmdPhysicsSettings): number {
  return s.stablePhys ? 3 : clampPhysSub(s.physicsSubsteps);
}

export function getPhysicsAddParams(
  physicsEnabled: boolean,
  settings: MmdPhysicsSettings = mmdPhysicsSettings,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const wantPhysics = physicsEnabled && !ammoPhysicsBroken;
  return {
    physics: wantPhysics,
    warmup: wantPhysics ? settings.physicsWarmup : 0,
    unitStep: 1 / effectivePhysRate(settings),
    maxStepNum: effectivePhysSub(settings),
    gravity: new THREE.Vector3(0, -98 * settings.physicsGravity, 0),
    ...extra,
  };
}

export function applyPhysicsLiveSettings(
  physics: MMDPhysics | undefined,
  settings: MmdPhysicsSettings = mmdPhysicsSettings
): void {
  if (!physics) return;
  physics.unitStep = 1 / effectivePhysRate(settings);
  physics.maxStepNum = effectivePhysSub(settings);
  physics.setGravity(new THREE.Vector3(0, -98 * settings.physicsGravity, 0));
  applySwing(physics, settings);
}

export function getAnimHelperObjects(
  helper: MMDAnimationHelper,
  mesh: THREE.SkinnedMesh
): HelperMeshState | undefined {
  const h = helper as HelperWithObjects;
  if (h.objects?.get) return h.objects.get(mesh) as unknown as HelperMeshState | undefined;
  const legacy = helper as MMDAnimationHelper & { get?: (m: THREE.SkinnedMesh) => unknown };
  if (typeof legacy.get === 'function') return legacy.get(mesh) as unknown as HelperMeshState | undefined;
  return undefined;
}

function patchIkSolverForArmFix(ikSolver: IkSolverLike): void {
  if (!ikSolver || ikSolver._armIkFixPatched) return;
  ikSolver._armIkFixPatched = true;
  const origUpdateOne = ikSolver.updateOne.bind(ikSolver);
  ikSolver.updateOne = function (ik) {
    const chain = ik as { active?: boolean };
    if (!chain || chain.active === false) return ikSolver;
    return origUpdateOne(ik);
  };
  ikSolver.update = function () {
    const iks = ikSolver.iks;
    for (let i = 0, il = iks.length; i < il; i++) {
      const ik = iks[i];
      if (ik.active !== false) origUpdateOne(ik);
    }
    return ikSolver;
  };
}

function getPhysicsBoneName(body: MmdPhysicsBodyWrapper, mesh: THREE.SkinnedMesh): string {
  return (
    body.bone?.name ?? mesh.skeleton?.bones?.[body.params.boneIndex ?? -1]?.name ?? ''
  );
}

function isAccessoryPhysicsBody(body: MmdPhysicsBodyWrapper): boolean {
  const rbName = `${body.params?.name || ''} ${body.params?.englishName || ''}`.toLowerCase();
  if (
    /skirt|penis|ribbon|chain|cape|wing|cloth|accessory|服|ペ|装飾|チェーン|リボン|羽|マフ|スカ|ボール|ball|jewel|宝石/.test(
      rbName
    )
  ) {
    return true;
  }
  if (body.params?.shapeType === 0 && body.params?.type !== 0) return true;
  return false;
}

function isMainArmLimbCollider(body: MmdPhysicsBodyWrapper, mesh: THREE.SkinnedMesh): boolean {
  if (isAccessoryPhysicsBody(body)) return false;

  const shapeType = body.params?.shapeType;
  if (shapeType !== 1 && shapeType !== 2) return false;

  const boneName = getPhysicsBoneName(body, mesh);
  const rbName = `${body.params?.name || ''} ${body.params?.englishName || ''}`.toLowerCase();

  if (/arm|elbow|forearm|upper.?arm|upperarm|lowerarm|ひじ|肘|上腕/.test(rbName)) return true;
  if (/[左右]?腕/.test(boneName) && !/捩/.test(boneName) && !/IK|ＩＫ/i.test(boneName)) return true;
  if (/ひじ|肘/.test(boneName)) return true;
  if (/上腕/.test(boneName)) return true;
  if (/arm|elbow|forearm|upperarm/i.test(boneName.toLowerCase())) return true;
  return false;
}

function updateRigidBodyCollisionFilter(
  physics: MMDPhysics,
  body: MmdPhysicsBodyWrapper,
  newTarget: number
): void {
  if (newTarget === body.params.groupTarget || !body.body) return;
  body.params.groupTarget = newTarget;
  const world = physics.world as {
    removeRigidBody: (b: unknown) => void;
    addRigidBody: (b: unknown, group: number, mask: number) => void;
  };
  world.removeRigidBody(body.body);
  world.addRigidBody(body.body, 1 << body.params.groupIndex, newTarget);
}

/** Prevent arm rigid bodies from colliding with torso — fixes poke-through during dance. */
export function configureArmPhysicsForAnimation(
  mesh: THREE.SkinnedMesh,
  helper: MMDAnimationHelper
): void {
  const mmdState = getAnimHelperObjects(helper, mesh);
  const physics = mmdState?.physics;
  if (!physics?.bodies?.length || !physics.world) return;

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  const torsoGroups = new Set<number>();
  const armGroups = new Set<number>();

  for (const body of bodies) {
    const boneName = getPhysicsBoneName(body, mesh);
    if (TORSO_PHYSICS_NAME.test(boneName)) torsoGroups.add(body.params.groupIndex);
    if (isMainArmLimbCollider(body, mesh)) armGroups.add(body.params.groupIndex);
  }

  if (torsoGroups.size === 0) torsoGroups.add(0);

  for (const body of bodies) {
    if (!isMainArmLimbCollider(body, mesh)) continue;
    let target = body.params.groupTarget;
    for (const g of torsoGroups) target &= ~(1 << g);
    updateRigidBodyCollisionFilter(physics, body, target);
  }

  for (const body of bodies) {
    const boneName = getPhysicsBoneName(body, mesh);
    if (!TORSO_PHYSICS_NAME.test(boneName)) continue;
    let target = body.params.groupTarget;
    for (const g of armGroups) target &= ~(1 << g);
    updateRigidBodyCollisionFilter(physics, body, target);
  }
}

/** IK patch + PMX animation flag — run after helper.add(mesh). */
export function applyIkFixOnly(mesh: THREE.SkinnedMesh, helper: MMDAnimationHelper): void {
  if (!mesh?.skeleton?.bones) return;

  const mmd = mesh.geometry?.userData?.MMD as { format?: string } | undefined;
  if (mmd?.format === 'pmx') {
    (helper as HelperWithObjects).configuration.pmxAnimation = true;
  }

  const objects = getAnimHelperObjects(helper, mesh);
  const ikSolver = objects?.ikSolver;

  if (ikSolver?.iks?.length) {
    patchIkSolverForArmFix(ikSolver);
    for (const ik of ikSolver.iks) {
      if (ik.active === undefined) ik.active = true;
    }
  }

  mesh.skeleton.update();
  mesh.updateMatrixWorld(true);
  configureArmPhysicsForAnimation(mesh, helper);
}

export function syncArmLimbCollidersFromBones(
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics | undefined
): void {
  if (!physics?.bodies?.length) return;

  mesh.skeleton?.update();
  mesh.updateMatrixWorld(true);

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  for (const body of bodies) {
    if (!isMainArmLimbCollider(body, mesh)) continue;
    body.updateFromBone?.();
  }
}

export function applySwing(
  physics: MMDPhysics,
  settings: MmdPhysicsSettings = mmdPhysicsSettings
): void {
  if (!physics?.bodies) return;
  const sw = Math.min(PHYS_LIMITS.swingMax, Math.max(0, settings.physicsSwing));
  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  for (const wrapper of bodies) {
    const p = wrapper.params;
    if (!p || !wrapper.body || p.type === 0) continue;
    const linOrig = p.positionDamping !== undefined ? p.positionDamping : 0.0;
    const angOrig = p.rotationDamping !== undefined ? p.rotationDamping : 0.0;
    const lin = Math.max(0.04, linOrig * (1 - sw));
    const ang = Math.max(0.04, angOrig * (1 - sw));
    wrapper.body.setDamping(lin, ang);
  }
}

export function applyWindForce(
  mesh: THREE.SkinnedMesh,
  physics: MMDPhysics | undefined,
  timeSec: number,
  settings: MmdPhysicsSettings = mmdPhysicsSettings
): void {
  if (!mesh || !physics?.bodies) return;

  physWindSmoothed += (settings.physicsWind - physWindSmoothed) * 0.05;
  if (physWindSmoothed <= 0.0001) return;

  const wBase = physWindSmoothed;
  const fx = wBase * (Math.sin(timeSec * 0.5) + 0.15 * Math.sin(timeSec * 2.0));
  const fz = wBase * (Math.cos(timeSec * 0.4) + 0.15 * Math.cos(timeSec * 1.8));

  const bodies = physics.bodies as unknown as MmdPhysicsBodyWrapper[];
  const Ammo = globalThis.Ammo as
    | { btVector3: new (x: number, y: number, z: number) => { destroy?: () => void } }
    | undefined;

  for (const wrapper of bodies) {
    if (!wrapper.params || wrapper.params.type === 0 || !wrapper.body) continue;
    const w = wBase * 0.15;
    const scale = w / Math.max(wBase, 0.001);
    if (Ammo?.btVector3) {
      const fv = new Ammo.btVector3(fx * scale, 0, fz * scale);
      wrapper.body.applyCentralForce(fv);
      fv.destroy?.();
      wrapper.body.activate(true);
    }
  }
}
