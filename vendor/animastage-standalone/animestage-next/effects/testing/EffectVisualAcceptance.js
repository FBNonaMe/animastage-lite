function assertFrame(frame, label) {
  if (!frame || !Number.isSafeInteger(frame.width) || frame.width < 1 || !Number.isSafeInteger(frame.height) || frame.height < 1) {
    throw new TypeError(`${label} requires positive integer width and height`);
  }
  const expected = frame.width * frame.height * 4;
  if (!ArrayBuffer.isView(frame.data) || frame.data.length !== expected) {
    throw new TypeError(`${label}.data must contain exactly ${expected} RGBA components`);
  }
  return frame;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function globalSsim(left, right) {
  const count = left.length;
  if (!count) return 1;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < count; i++) { meanA += left[i]; meanB += right[i]; }
  meanA /= count;
  meanB /= count;
  let varianceA = 0;
  let varianceB = 0;
  let covariance = 0;
  for (let i = 0; i < count; i++) {
    const a = left[i] - meanA;
    const b = right[i] - meanB;
    varianceA += a * a;
    varianceB += b * b;
    covariance += a * b;
  }
  const divisor = Math.max(1, count - 1);
  varianceA /= divisor;
  varianceB /= divisor;
  covariance /= divisor;
  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;
  const denominator = (meanA * meanA + meanB * meanB + c1) * (varianceA + varianceB + c2);
  return denominator ? ((2 * meanA * meanB + c1) * (2 * covariance + c2)) / denominator : 1;
}

/** Deterministic, dependency-free RGBA image comparison for release gates. */
export function compareEffectFrames(baselineInput, actualInput, {
  channelThreshold = 6,
  allowedMismatchRatio = 0.0025,
  minimumSsim = 0.985,
  includeAlpha = true,
  ignoreFullyTransparent = true,
  createDiff = false,
} = {}) {
  const baseline = assertFrame(baselineInput, "baseline");
  const actual = assertFrame(actualInput, "actual");
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    throw new RangeError(`Frame dimensions differ: ${baseline.width}x${baseline.height} vs ${actual.width}x${actual.height}`);
  }
  const threshold = Math.max(0, Math.min(255, finite(channelThreshold, 6)));
  const allowedRatio = Math.max(0, Math.min(1, finite(allowedMismatchRatio, 0.0025)));
  const requiredSsim = Math.max(-1, Math.min(1, finite(minimumSsim, 0.985)));
  let comparedPixels = 0;
  let mismatchedPixels = 0;
  let absoluteError = 0;
  let squaredError = 0;
  let maxChannelError = 0;
  const lumaA = [];
  const lumaB = [];
  const diff = createDiff ? new Uint8ClampedArray(baseline.data.length) : null;
  for (let offset = 0; offset < baseline.data.length; offset += 4) {
    if (ignoreFullyTransparent && baseline.data[offset + 3] === 0 && actual.data[offset + 3] === 0) {
      if (diff) diff[offset + 3] = 0;
      continue;
    }
    comparedPixels++;
    let pixelMismatch = false;
    const channels = includeAlpha ? 4 : 3;
    for (let channel = 0; channel < channels; channel++) {
      const error = Math.abs(Number(baseline.data[offset + channel]) - Number(actual.data[offset + channel]));
      absoluteError += error;
      squaredError += error * error;
      maxChannelError = Math.max(maxChannelError, error);
      if (error > threshold) pixelMismatch = true;
    }
    const a = baseline.data;
    const b = actual.data;
    lumaA.push(0.2126 * a[offset] + 0.7152 * a[offset + 1] + 0.0722 * a[offset + 2]);
    lumaB.push(0.2126 * b[offset] + 0.7152 * b[offset + 1] + 0.0722 * b[offset + 2]);
    if (pixelMismatch) mismatchedPixels++;
    if (diff) {
      const magnitude = Math.max(
        Math.abs(a[offset] - b[offset]),
        Math.abs(a[offset + 1] - b[offset + 1]),
        Math.abs(a[offset + 2] - b[offset + 2]),
      );
      diff[offset] = magnitude;
      diff[offset + 1] = pixelMismatch ? 32 : magnitude;
      diff[offset + 2] = pixelMismatch ? 180 : magnitude;
      diff[offset + 3] = 255;
    }
  }
  const componentCount = Math.max(1, comparedPixels * (includeAlpha ? 4 : 3));
  const meanAbsoluteError = absoluteError / componentCount;
  const rmse = Math.sqrt(squaredError / componentCount);
  const psnr = rmse === 0 ? Infinity : 20 * Math.log10(255 / rmse);
  const mismatchRatio = comparedPixels ? mismatchedPixels / comparedPixels : 0;
  const ssim = globalSsim(lumaA, lumaB);
  return Object.freeze({
    schema: "animestage.effect-image-diff/v1",
    width: baseline.width,
    height: baseline.height,
    comparedPixels,
    mismatchedPixels,
    mismatchRatio,
    meanAbsoluteError,
    rmse,
    psnr,
    ssim,
    maxChannelError,
    thresholds: Object.freeze({ channelThreshold: threshold, allowedMismatchRatio: allowedRatio, minimumSsim: requiredSsim }),
    passed: mismatchRatio <= allowedRatio && ssim >= requiredSsim,
    diff: diff ? Object.freeze({ width: baseline.width, height: baseline.height, data: diff }) : null,
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (key !== "signature" && key !== "digest") result[key] = stable(value[key]);
    }
    return result;
  }
  return Number.isFinite(value) ? value : String(value);
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value) {
  if (typeof atob === "function") return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export function createEffectAcceptanceReport({ effect, adapterVersion, sourceRevision = "", device, cases, notes = [] }) {
  if (!effect?.id || !effect?.version) throw new TypeError("Acceptance report requires effect id and version");
  if (!Array.isArray(cases) || !cases.length) throw new TypeError("Acceptance report requires at least one case");
  const normalizedCases = cases.map((entry, index) => Object.freeze({
    id: String(entry.id || `case-${index + 1}`),
    renderer: String(entry.renderer || "unknown"),
    resolution: String(entry.resolution || "unknown"),
    passed: entry.passed === true,
    metrics: Object.freeze({ ...(entry.metrics || {}) }),
  }));
  return Object.freeze({
    schema: "animestage.effect-acceptance/v1",
    effect: Object.freeze({ id: String(effect.id), version: String(effect.version) }),
    adapterVersion: String(adapterVersion || "unknown"),
    sourceRevision: String(sourceRevision || ""),
    device: Object.freeze({ vendor: String(device?.vendor || ""), renderer: String(device?.renderer || ""), backend: String(device?.backend || "") }),
    cases: Object.freeze(normalizedCases),
    notes: Object.freeze(notes.map(String)),
    passed: normalizedCases.every((entry) => entry.passed),
  });
}

export async function digestEffectAcceptanceReport(report, { cryptoApi = globalThis.crypto } = {}) {
  if (!cryptoApi?.subtle) throw new Error("Web Crypto is required to digest an acceptance report");
  const bytes = new TextEncoder().encode(JSON.stringify(stable(report)));
  const digest = new Uint8Array(await cryptoApi.subtle.digest("SHA-256", bytes));
  return bytesToHex(digest);
}

export async function signEffectAcceptanceReport(report, privateKey, { cryptoApi = globalThis.crypto } = {}) {
  if (!cryptoApi?.subtle || !privateKey) throw new Error("Web Crypto and a private key are required");
  const payload = new TextEncoder().encode(JSON.stringify(stable(report)));
  const digest = bytesToHex(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", payload)));
  const signature = new Uint8Array(await cryptoApi.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, payload));
  return Object.freeze({ ...report, digest: `sha256:${digest}`, signature: Object.freeze({ algorithm: "ECDSA-P256-SHA256", value: bytesToBase64(signature) }) });
}

export async function verifyEffectAcceptanceReport(report, publicKey, { cryptoApi = globalThis.crypto } = {}) {
  if (!cryptoApi?.subtle || !publicKey || !report?.signature?.value) return false;
  const unsigned = { ...report };
  delete unsigned.signature;
  delete unsigned.digest;
  const payload = new TextEncoder().encode(JSON.stringify(stable(unsigned)));
  const digest = `sha256:${bytesToHex(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", payload)))}`;
  if (digest !== report.digest) return false;
  return cryptoApi.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64ToBytes(report.signature.value),
    payload,
  );
}
