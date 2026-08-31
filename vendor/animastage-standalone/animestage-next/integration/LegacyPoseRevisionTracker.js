const UINT32_MAX = 0xffffffff;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const SECONDARY_OFFSET = 0x9e3779b9;
const SECONDARY_PRIME = 0x85ebca6b;
const NUMBER_BITS = new DataView(new ArrayBuffer(8));

const TAG = Object.freeze({
  mesh: 0x4d455348,
  localTransform: 0x4c4f434c,
  worldTransform: 0x574f524c,
  bones: 0x424f4e45,
  bone: 0x424f4e31,
  morphs: 0x4d4f5250,
  vector: 0x56454333,
  quaternion: 0x51554154,
  matrix: 0x4d415434,
  missing: 0x4d495353,
});

export const DEFAULT_LEGACY_POSE_QUANTIZATION = Object.freeze({
  position: 1e-5,
  quaternion: 1e-6,
  scale: 1e-5,
  morph: 1e-5,
  matrix: 1e-5,
});

function positiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(1 / value)) {
    throw new RangeError(`${name} must be a finite number greater than 0`);
  }
  return value;
}

function normalizeQuantization(value) {
  if (value == null) return DEFAULT_LEGACY_POSE_QUANTIZATION;
  if (typeof value === "number") {
    const quantum = positiveFinite(value, "quantization");
    return Object.freeze({
      position: quantum,
      quaternion: quantum,
      scale: quantum,
      morph: quantum,
      matrix: quantum,
    });
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("quantization must be a positive number or an options object");
  }
  return Object.freeze({
    position: positiveFinite(value.position ?? DEFAULT_LEGACY_POSE_QUANTIZATION.position, "quantization.position"),
    quaternion: positiveFinite(value.quaternion ?? DEFAULT_LEGACY_POSE_QUANTIZATION.quaternion, "quantization.quaternion"),
    scale: positiveFinite(value.scale ?? DEFAULT_LEGACY_POSE_QUANTIZATION.scale, "quantization.scale"),
    morph: positiveFinite(value.morph ?? DEFAULT_LEGACY_POSE_QUANTIZATION.morph, "quantization.morph"),
    matrix: positiveFinite(value.matrix ?? DEFAULT_LEGACY_POSE_QUANTIZATION.matrix, "quantization.matrix"),
  });
}

function avalanche(value) {
  let result = value >>> 0;
  result ^= result >>> 16;
  result = Math.imul(result, 0x7feb352d);
  result ^= result >>> 15;
  result = Math.imul(result, 0x846ca68b);
  result ^= result >>> 16;
  return result >>> 0;
}

function hex32(value) {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function resolveMesh(entry) {
  if (entry == null || (typeof entry !== "object" && typeof entry !== "function")) return null;
  if ("mesh" in entry) {
    const candidate = entry.mesh;
    return candidate != null && (typeof candidate === "object" || typeof candidate === "function")
      ? candidate
      : null;
  }
  return entry;
}

/** Reusable dual 32-bit accumulator; hashing a bone never allocates an object. */
class PoseHashAccumulator {
  constructor() {
    this.first = FNV_OFFSET;
    this.second = SECONDARY_OFFSET;
  }

  reset() {
    this.first = FNV_OFFSET;
    this.second = SECONDARY_OFFSET;
  }

  word(value) {
    const word = value >>> 0;
    this.first = Math.imul((this.first ^ word) >>> 0, FNV_PRIME) >>> 0;
    this.second = Math.imul((this.second ^ ((word + 0x9e3779b9) >>> 0)) >>> 0, SECONDARY_PRIME) >>> 0;
    this.second = (this.second ^ (this.first >>> 13)) >>> 0;
  }

  string(value) {
    const text = typeof value === "string" ? value : "";
    this.word(text.length);
    for (let index = 0; index < text.length; index += 1) this.word(text.charCodeAt(index));
  }

  quantized(value, inverseQuantum) {
    const numeric = Number(value);
    const quantized = Number.isFinite(numeric) ? Math.round(numeric * inverseQuantum) : numeric;
    // Float64 bits preserve separate sentinels for NaN and infinities while
    // retaining the exact integer bucket selected by quantization.
    NUMBER_BITS.setFloat64(0, Object.is(quantized, -0) ? 0 : quantized, true);
    this.word(NUMBER_BITS.getUint32(0, true));
    this.word(NUMBER_BITS.getUint32(4, true));
  }

  finish() {
    this.first = avalanche(this.first);
    this.second = avalanche(this.second ^ this.first);
  }
}

function hashVector(accumulator, tag, vector, inverseQuantum, components) {
  accumulator.word(tag);
  if (vector == null) {
    accumulator.word(TAG.missing);
    return;
  }
  accumulator.word(components);
  accumulator.quantized(vector.x ?? vector[0], inverseQuantum);
  accumulator.quantized(vector.y ?? vector[1], inverseQuantum);
  accumulator.quantized(vector.z ?? vector[2], inverseQuantum);
  if (components === 4) accumulator.quantized(vector.w ?? vector[3], inverseQuantum);
}

function hashArray(accumulator, tag, values, inverseQuantum) {
  accumulator.word(tag);
  const length = Number.isSafeInteger(values?.length) && values.length >= 0 ? values.length : -1;
  if (length < 0) {
    accumulator.word(TAG.missing);
    return;
  }
  accumulator.word(length);
  for (let index = 0; index < length; index += 1) {
    accumulator.quantized(values[index], inverseQuantum);
  }
}

function hashTransform(accumulator, object, quantization) {
  hashVector(accumulator, TAG.vector, object?.position, 1 / quantization.position, 3);
  hashVector(accumulator, TAG.quaternion, object?.quaternion, 1 / quantization.quaternion, 4);
  hashVector(accumulator, TAG.vector, object?.scale, 1 / quantization.scale, 3);
}

function hashMesh(accumulator, mesh, quantization) {
  accumulator.reset();
  accumulator.word(TAG.mesh);

  accumulator.word(TAG.localTransform);
  hashTransform(accumulator, mesh, quantization);

  accumulator.word(TAG.worldTransform);
  hashArray(accumulator, TAG.matrix, mesh?.matrixWorld?.elements, 1 / quantization.matrix);

  accumulator.word(TAG.bones);
  const bones = mesh?.skeleton?.bones;
  const boneCount = Number.isSafeInteger(bones?.length) && bones.length >= 0 ? bones.length : 0;
  accumulator.word(boneCount);
  for (let index = 0; index < boneCount; index += 1) {
    const bone = bones[index];
    accumulator.word(TAG.bone);
    accumulator.word(index);
    accumulator.string(bone?.name);
    hashTransform(accumulator, bone, quantization);
  }

  accumulator.word(TAG.morphs);
  hashArray(accumulator, TAG.morphs, mesh?.morphTargetInfluences, 1 / quantization.morph);
  accumulator.finish();
}

/**
 * Tracks the last fully committed pose of every supplied legacy character.
 *
 * `commit()` is synchronous and renderer-independent. It accepts legacy state
 * objects (`{ mesh }`), meshes directly, or any iterable containing either.
 * Call it only after skeleton and world matrices have been finalized.
 */
export class LegacyPoseRevisionTracker {
  #records = new WeakMap();
  #active = new Set();
  #scratchActive = new Set();
  #accumulator = new PoseHashAccumulator();
  #epoch = 0;
  #initialized = false;
  #revision = 0;
  #hash = "0000000000000000";
  #changed = false;
  #characterCount = 0;

  constructor({ quantization = DEFAULT_LEGACY_POSE_QUANTIZATION } = {}) {
    this.quantization = normalizeQuantization(quantization);
    Object.freeze(this);
  }

  get revision() { return this.#revision; }
  get hash() { return this.#hash; }
  get changed() { return this.#changed; }
  get characterCount() { return this.#characterCount; }
  get initialized() { return this.#initialized; }

  commit(states = []) {
    this.#epoch += 1;
    if (!Number.isSafeInteger(this.#epoch)) this.#epoch = 1;
    const epoch = this.#epoch;
    const nextActive = this.#scratchActive;
    nextActive.clear();

    let changed = !this.#initialized;
    let aggregateFirst = FNV_OFFSET;
    let aggregateSecond = SECONDARY_OFFSET;
    let characterCount = 0;

    const visit = (entry) => {
      const mesh = resolveMesh(entry);
      if (!mesh) return;
      let record = this.#records.get(mesh);
      if (!record) {
        record = {
          first: 0,
          second: 0,
          initialized: false,
          seenEpoch: 0,
        };
        this.#records.set(mesh, record);
      }
      if (record.seenEpoch === epoch) return;
      record.seenEpoch = epoch;
      nextActive.add(mesh);
      characterCount += 1;

      hashMesh(this.#accumulator, mesh, this.quantization);
      const first = this.#accumulator.first;
      const second = this.#accumulator.second;
      if (!record.initialized || record.first !== first || record.second !== second) changed = true;
      record.first = first;
      record.second = second;
      record.initialized = true;

      // Both accumulators use commutative addition over the mesh pose digest.
      // This makes the scene hash deterministic even when two independent
      // callers initially supply their character arrays in different orders.
      // Addition also retains multiplicity for visually identical meshes.
      const contributionFirst = avalanche(first ^ Math.imul(second, FNV_PRIME));
      const contributionSecond = avalanche(second ^ Math.imul(first, SECONDARY_PRIME));
      aggregateFirst = (aggregateFirst + contributionFirst) >>> 0;
      aggregateSecond = (aggregateSecond + contributionSecond) >>> 0;
    };

    if (states == null) {
      // Null is a convenient representation of an empty legacy scene.
    } else if (typeof states !== "string" && typeof states?.[Symbol.iterator] === "function") {
      for (const entry of states) visit(entry);
    } else if (typeof states === "object" || typeof states === "function") {
      visit(states);
    } else {
      throw new TypeError("states must be a legacy state, mesh, iterable, null, or undefined");
    }

    if (this.#active.size !== nextActive.size) changed = true;
    if (!changed) {
      for (const mesh of this.#active) {
        if (!nextActive.has(mesh)) {
          changed = true;
          break;
        }
      }
    }

    aggregateFirst = avalanche(aggregateFirst ^ characterCount);
    aggregateSecond = avalanche(aggregateSecond ^ Math.imul(characterCount, SECONDARY_PRIME));
    const nextHash = `${hex32(aggregateFirst)}${hex32(aggregateSecond)}`;
    if (this.#initialized && nextHash !== this.#hash) changed = true;

    const previousActive = this.#active;
    this.#active = nextActive;
    this.#scratchActive = previousActive;
    this.#scratchActive.clear();

    if (changed) {
      if (this.#revision >= Number.MAX_SAFE_INTEGER) {
        throw new RangeError("pose revision exhausted the safe integer range");
      }
      this.#revision += 1;
    }
    this.#initialized = true;
    this.#changed = changed;
    this.#hash = nextHash;
    this.#characterCount = characterCount;

    return Object.freeze({
      changed,
      revision: this.#revision,
      hash: nextHash,
      characterCount,
    });
  }

  /** Force the next committed pose to create a revision without rewinding it. */
  invalidate() {
    this.#initialized = false;
    this.#changed = false;
    this.#active.clear();
    this.#scratchActive.clear();
    return this;
  }
}
