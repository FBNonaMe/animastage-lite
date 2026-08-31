import * as THREE from 'three';
import {
  RezePhysics,
  RigidbodyShape,
  RigidbodyType,
  Vec3,
  Quat,
  Mat4,
} from './dist/physics/index.js';

export const REZE_ENGINE_ID = 'reze';
export const REZE_ENGINE_NAME = 'Reze Physics';
export const REZE_ENGINE_VERSION = '0.19.0-animestage';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _parentInverse = new THREE.Matrix4();

function finite(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function vec3(value, fallback = 0) {
  return new Vec3(
    finite(value?.[0] ?? value?.x, fallback),
    finite(value?.[1] ?? value?.y, fallback),
    finite(value?.[2] ?? value?.z, fallback),
  );
}

function quat(value) {
  return new Quat(
    finite(value?.x), finite(value?.y), finite(value?.z), finite(value?.w, 1),
  );
}

function runtimeEulerQuaternion(rotation) {
  const euler = new THREE.Euler(
    finite(rotation?.[0] ?? rotation?.x),
    finite(rotation?.[1] ?? rotation?.y),
    finite(rotation?.[2] ?? rotation?.z),
    'XYZ',
  );
  return new THREE.Quaternion().setFromEuler(euler).normalize();
}

function convertRigidBody(mesh, params, index) {
  const boneIndex = Number.isInteger(params?.boneIndex) ? params.boneIndex : -1;
  const bone = boneIndex >= 0 ? mesh.skeleton?.bones?.[boneIndex] : null;
  const localPosition = new THREE.Vector3(
    finite(params?.position?.[0]),
    finite(params?.position?.[1]),
    finite(params?.position?.[2]),
  );
  const shapePosition = bone
    ? bone.getWorldPosition(new THREE.Vector3()).add(localPosition)
    : localPosition;
  const shapeQuaternion = runtimeEulerQuaternion(params?.rotation);
  const rawType = Math.max(0, Math.min(2, Math.round(finite(params?.type))));

  return {
    name: String(params?.name ?? `RigidBody ${index}`),
    englishName: String(params?.englishName ?? params?.name ?? `RigidBody ${index}`),
    boneIndex,
    group: Math.max(0, Math.min(15, Math.round(finite(params?.groupIndex ?? params?.group)))),
    collisionMask: Math.round(finite(params?.groupTarget ?? params?.collisionMask, 0xffff)) & 0xffff,
    shape: Math.max(0, Math.min(2, Math.round(finite(params?.shapeType ?? params?.shape)))) ?? RigidbodyShape.Sphere,
    size: new Vec3(
      Math.max(0.0001, finite(params?.width ?? params?.size?.[0], 0.1)),
      Math.max(0.0001, finite(params?.height ?? params?.size?.[1], 0.1)),
      Math.max(0.0001, finite(params?.depth ?? params?.size?.[2], 0.1)),
    ),
    shapePosition: new Vec3(shapePosition.x, shapePosition.y, shapePosition.z),
    shapeRotation: vec3(params?.rotation),
    shapeQuaternion: quat(shapeQuaternion),
    mass: Math.max(0, finite(params?.weight ?? params?.mass)),
    linearDamping: THREE.MathUtils.clamp(finite(params?.positionDamping ?? params?.linearDamping), 0, 1),
    angularDamping: THREE.MathUtils.clamp(finite(params?.rotationDamping ?? params?.angularDamping), 0, 1),
    restitution: THREE.MathUtils.clamp(finite(params?.restitution), 0, 1),
    friction: Math.max(0, finite(params?.friction, 0.5)),
    type: rawType === 0 ? RigidbodyType.Static : RigidbodyType.Dynamic,
    aligned: rawType === 2,
    bodyOffsetMatrixInverse: Mat4.identity(),
  };
}

function convertJoint(params, index) {
  const rotationQuaternion = runtimeEulerQuaternion(params?.rotation);
  return {
    name: String(params?.name ?? `Joint ${index}`),
    englishName: String(params?.englishName ?? params?.name ?? `Joint ${index}`),
    type: Math.round(finite(params?.type)),
    rigidbodyIndexA: Math.round(finite(params?.rigidBodyIndex1 ?? params?.rigidbodyIndexA, -1)),
    rigidbodyIndexB: Math.round(finite(params?.rigidBodyIndex2 ?? params?.rigidbodyIndexB, -1)),
    position: vec3(params?.position),
    rotation: vec3(params?.rotation),
    rotationQuaternion: quat(rotationQuaternion),
    positionMin: vec3(params?.translationLimitation1 ?? params?.positionMin),
    positionMax: vec3(params?.translationLimitation2 ?? params?.positionMax),
    rotationMin: vec3(params?.rotationLimitation1 ?? params?.rotationMin),
    rotationMax: vec3(params?.rotationLimitation2 ?? params?.rotationMax),
    springPosition: vec3(params?.springPosition),
    springRotation: vec3(params?.springRotation),
  };
}

class RezeBodyHandle {
  constructor(owner, index) {
    this.owner = owner;
    this.index = index;
  }

  _store() { return this.owner.core.getStore(); }
  translation() {
    const a = this._store().positions; const i = this.index * 3;
    return { x: a[i], y: a[i + 1], z: a[i + 2] };
  }
  rotation() {
    const a = this._store().orientations; const i = this.index * 4;
    return { x: a[i], y: a[i + 1], z: a[i + 2], w: a[i + 3] };
  }
  linvel() {
    const a = this._store().linearVelocities; const i = this.index * 3;
    return { x: a[i], y: a[i + 1], z: a[i + 2] };
  }
  angvel() {
    const a = this._store().angularVelocities; const i = this.index * 3;
    return { x: a[i], y: a[i + 1], z: a[i + 2] };
  }
  setTranslation(v) {
    const a = this._store().positions; const i = this.index * 3;
    a[i] = finite(v?.x); a[i + 1] = finite(v?.y); a[i + 2] = finite(v?.z);
  }
  setRotation(v) {
    const a = this._store().orientations; const i = this.index * 4;
    let x = finite(v?.x), y = finite(v?.y), z = finite(v?.z), w = finite(v?.w, 1);
    const inv = 1 / (Math.hypot(x, y, z, w) || 1);
    a[i] = x * inv; a[i + 1] = y * inv; a[i + 2] = z * inv; a[i + 3] = w * inv;
  }
  setLinvel(v) {
    const a = this._store().linearVelocities; const i = this.index * 3;
    a[i] = finite(v?.x); a[i + 1] = finite(v?.y); a[i + 2] = finite(v?.z);
  }
  setAngvel(v) {
    const a = this._store().angularVelocities; const i = this.index * 3;
    a[i] = finite(v?.x); a[i + 1] = finite(v?.y); a[i + 2] = finite(v?.z);
  }
  addForce(v) {
    const a = this.owner._forces; const i = this.index * 3;
    a[i] += finite(v?.x); a[i + 1] += finite(v?.y); a[i + 2] += finite(v?.z);
  }
  setLinearDamping(value) { this._store().linearDamping[this.index] = THREE.MathUtils.clamp(finite(value), 0, 1); }
  setAngularDamping(value) { this._store().angularDamping[this.index] = THREE.MathUtils.clamp(finite(value), 0, 1); }
  setDamping(linear, angular) { this.setLinearDamping(linear); this.setAngularDamping(angular); }
  wakeUp() {}
  isSleeping() { return false; }
  isActive() { return true; }
  makeKinematic() {
    const store = this._store();
    store.type[this.index] = RigidbodyType.Kinematic;
    store.invMass[this.index] = 0;
  }
}

class RezeBodyBridge {
  constructor(owner, params, index) {
    this.owner = owner;
    this.params = params;
    this.index = index;
    this.body = new RezeBodyHandle(owner, index);
    this.rigidBody = this.body;
  }
  reset() { this.owner.resetBody(this.index); return this; }
  updateFromBone() { return this; }
  updateBone() { this.owner.syncBonesFromPhysics(); return this; }
  setCollisionMask(mask) {
    const store = this.owner.core.getStore();
    store.willCollideMask[this.index] = Math.round(finite(mask)) & 0xffff;
    store.collisionPairs = null;
  }
  makeKinematic() { this.body.makeKinematic(); return this; }
  dispose() { this.body = null; this.rigidBody = null; }
}

export class MMDPhysics {
  constructor(mesh, rigidBodyParams = [], constraintParams = [], params = {}) {
    if (!mesh?.skeleton) throw new Error('Reze Physics requires a skinned MMD mesh');
    this.engineId = REZE_ENGINE_ID;
    this.engineName = REZE_ENGINE_NAME;
    this.engineVersion = REZE_ENGINE_VERSION;
    this.mesh = mesh;
    this.unitStep = finite(params.unitStep, 1 / 65);
    this.maxStepNum = Math.max(1, Math.round(finite(params.maxStepNum, 4)));
    this.gravity = new THREE.Vector3(0, -98, 0);
    if (params.gravity) this.gravity.copy(params.gravity);
    this._disposed = false;
    this._initialized = false;
    this._lastStepDt = this.unitStep;
    this._helpers = new Set();

    this._prepareBindPose();
    this.rigidbodies = rigidBodyParams.map((p, i) => convertRigidBody(mesh, p, i));
    this.joints = constraintParams.map(convertJoint);
    this.core = new RezePhysics(this.rigidbodies, this.joints, {
      fixedTimeStep: this.unitStep,
      maxSubSteps: this.maxStepNum,
      solverIterations: finite(params.solverIterations, 12),
    });
    this.core.setGravity(new Vec3(this.gravity.x, this.gravity.y, this.gravity.z));
    this._store = this.core.getStore();
    this._forces = new Float32Array(this._store.count * 3);
    this._boneMatrices = mesh.skeleton.bones.map(() => Mat4.identity());
    this._inverseBind = new Float32Array(mesh.skeleton.bones.length * 16);
    this._dynamicBones = this._collectDynamicBones();
    this._copyInverseBindMatrices();
    this.bodies = rigidBodyParams.map((p, i) => new RezeBodyBridge(this, p, i));
    this.constraints = this.joints;
    this.world = {
      engine: REZE_ENGINE_ID,
      integrationParameters: {},
      updateSingleAabb() {},
    };
    Object.defineProperty(this.world.integrationParameters, 'numSolverIterations', {
      get: () => this.core.getDiagnostics().solverIterations,
      set: (value) => this.setSolverIterations(value),
    });
    this.diagnostics = this.core.getDiagnostics();
    console.info(`[Reze] ${REZE_ENGINE_NAME} ${REZE_ENGINE_VERSION}: ${this.bodies.length} bodies, ${this.constraints.length} joints`);
  }

  _prepareBindPose() {
    this.mesh.updateMatrixWorld(true);
    this.mesh.skeleton.update();
  }

  _collectDynamicBones() {
    const bones = new Set();
    for (let i = 0; i < this._store.count; i++) {
      if (this._store.type[i] !== RigidbodyType.Dynamic) continue;
      const index = this._store.boneIndex[i];
      if (index >= 0 && index < this.mesh.skeleton.bones.length) bones.add(index);
    }
    return [...bones].sort((a, b) => this._boneDepth(a) - this._boneDepth(b));
  }

  _boneDepth(index) {
    let depth = 0;
    let bone = this.mesh.skeleton.bones[index];
    while (bone?.parent?.isBone) { depth++; bone = bone.parent; }
    return depth;
  }

  _copyInverseBindMatrices() {
    const inverses = this.mesh.skeleton.boneInverses || [];
    for (let i = 0; i < this.mesh.skeleton.bones.length; i++) {
      const source = inverses[i]?.elements;
      const target = this._inverseBind.subarray(i * 16, i * 16 + 16);
      if (source) target.set(source);
      else target.set(new THREE.Matrix4().copy(this.mesh.skeleton.bones[i].matrixWorld).invert().elements);
    }
  }

  _copyBoneMatrices() {
    this.mesh.updateMatrixWorld(true);
    this.mesh.skeleton.update();
    for (let i = 0; i < this._boneMatrices.length; i++) {
      this._boneMatrices[i].values.set(this.mesh.skeleton.bones[i].matrixWorld.elements);
    }
  }

  _applyBoneMatrices() {
    const bones = this.mesh.skeleton.bones;
    for (const index of this._dynamicBones) {
      const bone = bones[index];
      if (!bone) continue;
      _m.fromArray(this._boneMatrices[index].values);
      if (bone.parent) {
        _parentInverse.copy(bone.parent.matrixWorld).invert();
        _local.multiplyMatrices(_parentInverse, _m);
      } else {
        _local.copy(_m);
      }
      _local.decompose(_p, _q, _s);
      if (![..._p.toArray(), ..._q.toArray(), ..._s.toArray()].every(Number.isFinite)) continue;
      bone.position.copy(_p);
      bone.quaternion.copy(_q).normalize();
      bone.scale.copy(_s);
      bone.updateMatrix();
      bone.updateMatrixWorld(true);
    }
    this.mesh.skeleton.update();
    this.mesh.updateMatrixWorld(true);
  }

  _applyForces(dt) {
    const invMass = this._store.invMass;
    const velocity = this._store.linearVelocities;
    const h = Math.min(0.05, Math.max(0, dt));
    for (let i = 0; i < this._store.count; i++) {
      if (invMass[i] <= 0) continue;
      const i3 = i * 3;
      velocity[i3] += this._forces[i3] * invMass[i] * h;
      velocity[i3 + 1] += this._forces[i3 + 1] * invMass[i] * h;
      velocity[i3 + 2] += this._forces[i3 + 2] * invMass[i] * h;
    }
    this._forces.fill(0);
  }

  update(delta) {
    if (this._disposed) return this;
    let dt = finite(delta, this.unitStep);
    if (dt <= 0) return this.syncBonesFromPhysics();
    dt = Math.min(dt, this.unitStep * this.maxStepNum);
    this._lastStepDt = dt;
    this._copyBoneMatrices();
    this._applyForces(dt);
    this.core.step(dt, this._boneMatrices, this._inverseBind);
    this._initialized = true;
    this._applyBoneMatrices();
    this._syncHelpers();
    this.diagnostics = this.core.getDiagnostics();
    return this;
  }

  syncBonesFromPhysics() {
    if (this._disposed || !this._initialized) return this;
    this._copyBoneMatrices();
    this.core.syncBones(this._boneMatrices);
    this._applyBoneMatrices();
    this._syncHelpers();
    return this;
  }

  reset() {
    if (this._disposed) return this;
    this._copyBoneMatrices();
    if (!this._initialized) {
      this.core.step(this.unitStep, this._boneMatrices, this._inverseBind);
      this._initialized = true;
    } else {
      this.core.reset(this._boneMatrices);
    }
    this._applyBoneMatrices();
    this._forces.fill(0);
    return this;
  }

  resetBody(index) {
    if (!this._initialized || !this._store.isBoneOffsetsReady()) return this.reset();
    const boneIndex = this._store.boneIndex[index];
    if (boneIndex < 0 || !this.mesh.skeleton.bones[boneIndex]) return this;
    this._copyBoneMatrices();
    const offset = new THREE.Matrix4().fromArray(this._store.bodyOffsetMatrix, index * 16);
    _m.fromArray(this._boneMatrices[boneIndex].values).multiply(offset).decompose(_p, _q, _s);
    this.bodies[index].body.setTranslation(_p);
    this.bodies[index].body.setRotation(_q);
    this.bodies[index].body.setLinvel({ x: 0, y: 0, z: 0 });
    this.bodies[index].body.setAngvel({ x: 0, y: 0, z: 0 });
    return this;
  }

  warmup(cycles = 30) {
    const count = Math.max(0, Math.min(120, Math.round(finite(cycles, 30))));
    for (let i = 0; i < count; i++) this.update(this.unitStep);
    return this;
  }

  setGravity(gravity) {
    this.gravity.copy(gravity);
    this.core.setGravity(new Vec3(gravity.x, gravity.y, gravity.z));
    return this;
  }

  setFixedTimeStep(seconds) {
    this.unitStep = THREE.MathUtils.clamp(finite(seconds, this.unitStep), 1 / 240, 1 / 15);
    this.core.setFixedTimeStep(this.unitStep);
    return this;
  }

  setMaxSubSteps(count) {
    this.maxStepNum = Math.max(1, Math.min(32, Math.round(finite(count, this.maxStepNum))));
    this.core.setMaxSubSteps(this.maxStepNum);
    return this;
  }

  setSolverIterations(count) {
    this.core.setSolverIterations(count);
    this.diagnostics = this.core.getDiagnostics();
    return this;
  }

  createHelper() { return new MMDPhysicsHelper(this.mesh, this); }

  _syncHelpers() { for (const helper of this._helpers) helper.update(); }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    for (const helper of this._helpers) helper.dispose();
    this._helpers.clear();
    for (const body of this.bodies) body.dispose();
    this.bodies.length = 0;
    this.constraints.length = 0;
    this.world = null;
    this.core = null;
    this.mesh = null;
  }
}

export class MMDPhysicsHelper extends THREE.Group {
  constructor(mesh, physics) {
    super();
    this.type = 'RezeMMDPhysicsHelper';
    this.matrixAutoUpdate = false;
    this.physics = physics;
    this._items = [];
    const material = new THREE.MeshBasicMaterial({
      color: 0x00d9ff,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
    });
    for (let i = 0; i < physics.rigidbodies.length; i++) {
      const rb = physics.rigidbodies[i];
      let geometry;
      if (rb.shape === RigidbodyShape.Box) geometry = new THREE.BoxGeometry(rb.size.x * 2, rb.size.y * 2, rb.size.z * 2);
      else if (rb.shape === RigidbodyShape.Capsule) geometry = new THREE.CapsuleGeometry(rb.size.x, rb.size.y, 4, 8);
      else geometry = new THREE.SphereGeometry(rb.size.x, 8, 6);
      const item = new THREE.Mesh(geometry, material);
      item.renderOrder = 999;
      this.add(item);
      this._items.push(item);
    }
    physics._helpers.add(this);
    this.update();
  }

  update() {
    const store = this.physics?._store;
    if (!store) return this;
    for (let i = 0; i < this._items.length; i++) {
      const i3 = i * 3; const i4 = i * 4;
      this._items[i].position.set(store.positions[i3], store.positions[i3 + 1], store.positions[i3 + 2]);
      this._items[i].quaternion.set(store.orientations[i4], store.orientations[i4 + 1], store.orientations[i4 + 2], store.orientations[i4 + 3]);
      this._items[i].updateMatrix();
    }
    return this;
  }

  dispose() {
    this.physics?._helpers?.delete(this);
    for (const item of this._items) item.geometry.dispose();
    this._items[0]?.material?.dispose();
    this._items.length = 0;
    this.physics = null;
  }
}
