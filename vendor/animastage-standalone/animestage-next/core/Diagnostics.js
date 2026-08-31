import { FrameValidationError } from "./errors.js";

export const DIAGNOSTIC_SEVERITIES = Object.freeze(["debug", "info", "warning", "error"]);

function cloneDetails(details) {
  if (details == null || typeof details !== "object") return details ?? null;
  if (typeof structuredClone === "function") {
    try { return structuredClone(details); } catch { /* fall through */ }
  }
  if (Array.isArray(details)) return details.slice();
  return { ...details };
}

function deepFreeze(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  // ECMAScript rejects Object.freeze() on non-empty typed arrays. The cloned
  // view is still isolated from the producer, so retain it as an opaque value.
  if (ArrayBuffer.isView(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

/**
 * Bounded deterministic diagnostic journal. Sequence numbers are local to the
 * collector; wall-clock timestamps are intentionally omitted from core events.
 */
export class DiagnosticCollector {
  #events = [];
  #sequence = 0;
  #listeners = new Set();

  constructor({ capacity = 1000, onEvent = null } = {}) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new FrameValidationError("Diagnostic capacity must be a positive safe integer.", { capacity });
    }
    this.capacity = capacity;
    if (onEvent != null) this.subscribe(onEvent);
    Object.freeze(this);
  }

  emit({ severity = "info", code, message, stageId = null, frameId = null, details = null }) {
    if (!DIAGNOSTIC_SEVERITIES.includes(severity)) {
      throw new FrameValidationError(`Unknown diagnostic severity "${severity}".`, { severity });
    }
    if (typeof code !== "string" || !code) {
      throw new FrameValidationError("Diagnostic code must be a non-empty string.", { code });
    }
    const event = Object.freeze({
      sequence: this.#sequence++,
      severity,
      code,
      message: String(message ?? code),
      stageId,
      frameId,
      details: deepFreeze(cloneDetails(details)),
    });
    this.#events.push(event);
    if (this.#events.length > this.capacity) this.#events.splice(0, this.#events.length - this.capacity);
    for (const listener of this.#listeners) {
      try { listener(event); } catch { /* diagnostics must never break evaluation */ }
    }
    return event;
  }

  subscribe(listener) {
    if (typeof listener !== "function") {
      throw new FrameValidationError("Diagnostic listener must be a function.");
    }
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get events() { return this.#events.slice(); }

  query({ severity = null, code = null, stageId = null, frameId = null } = {}) {
    return this.#events.filter((event) =>
      (severity == null || event.severity === severity) &&
      (code == null || event.code === code) &&
      (stageId == null || event.stageId === stageId) &&
      (frameId == null || event.frameId === frameId));
  }

  clear() { this.#events.length = 0; }
}

export function ensureDiagnosticCollector(value) {
  if (value == null) return new DiagnosticCollector();
  if (!(value instanceof DiagnosticCollector)) {
    throw new FrameValidationError("diagnostics must be a DiagnosticCollector instance.");
  }
  return value;
}
