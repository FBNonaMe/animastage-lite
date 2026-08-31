const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

function updateHash(hash, token) {
  const text = String(token);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = (hash * FNV_PRIME_64) & UINT64_MASK;
  }
  return hash;
}

function normalizedNumber(value, precision) {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return '+Inf';
  if (value === -Infinity) return '-Inf';
  if (Object.is(value, -0)) return '0';
  if (!Number.isFinite(value)) return String(value);
  const quantized = Math.round(value / precision) * precision;
  return Object.is(quantized, -0) ? '0' : quantized.toPrecision(15);
}

/**
 * Produces a deterministic 64-bit fingerprint from pose-like data.
 * Object keys and Map/Set entries are sorted, while numeric values are
 * quantized to avoid false changes from insignificant floating point noise.
 */
export function fingerprintPose(value, options = {}) {
  const precision = options.precision ?? 1e-6;
  if (!Number.isFinite(precision) || precision <= 0) {
    throw new RangeError('Pose fingerprint precision must be a positive finite number');
  }

  const activeObjects = new WeakSet();
  let hash = FNV_OFFSET_64;

  const append = (token) => {
    hash = updateHash(hash, token);
    hash = updateHash(hash, '|');
  };

  const visit = (item) => {
    if (item === null) {
      append('null');
      return;
    }

    const type = typeof item;
    if (type === 'number') {
      append(`n:${normalizedNumber(item, precision)}`);
      return;
    }
    if (type === 'string') {
      append(`s:${item.length}:${item}`);
      return;
    }
    if (type === 'boolean') {
      append(item ? 'b:1' : 'b:0');
      return;
    }
    if (type === 'bigint') {
      append(`i:${item}`);
      return;
    }
    if (type === 'undefined') {
      append('undefined');
      return;
    }
    if (type !== 'object') {
      throw new TypeError(`Unsupported pose value: ${type}`);
    }

    if (activeObjects.has(item)) throw new TypeError('Pose data must not contain cycles');
    activeObjects.add(item);
    try {
      if (ArrayBuffer.isView(item)) {
        append(`typed:${item.constructor.name}:${item.length}`);
        for (const entry of item) visit(entry);
        return;
      }
      if (item instanceof ArrayBuffer) {
        const bytes = new Uint8Array(item);
        append(`buffer:${bytes.length}`);
        for (const byte of bytes) append(byte);
        return;
      }
      if (Array.isArray(item)) {
        append(`array:${item.length}`);
        for (const entry of item) visit(entry);
        return;
      }
      if (item instanceof Map) {
        const entries = [...item.entries()].map(([key, entry]) => [String(key), entry]);
        entries.sort(([left], [right]) => left.localeCompare(right));
        append(`map:${entries.length}`);
        for (const [key, entry] of entries) {
          visit(key);
          visit(entry);
        }
        return;
      }
      if (item instanceof Set) {
        const entries = [...item].map((entry) => String(entry)).sort();
        append(`set:${entries.length}`);
        for (const entry of entries) visit(entry);
        return;
      }

      const keys = Object.keys(item).sort();
      append(`object:${keys.length}`);
      for (const key of keys) {
        visit(key);
        visit(item[key]);
      }
    } finally {
      activeObjects.delete(item);
    }
  };

  visit(value);
  return hash.toString(16).padStart(16, '0');
}

export function isPoseFingerprint(value) {
  return typeof value === 'string' && /^[0-9a-f]{16}$/i.test(value);
}
