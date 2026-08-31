// SmartPoseLogger.js — deep tracing for the Smart Pose system.
//
// EVERYTHING the system does is recorded into a ring buffer (default 3000
// events) with timestamps, categories and structured data — even when the
// console stays quiet. Console verbosity is a separate dial, so per-frame
// noise never floods the console but is always available for forensics.
//
// Console API (installed as window.__smartPoseLog):
//   __smartPoseLog.report()        — aggregated health report + state snapshot
//   __smartPoseLog.dump(n?, cat?)  — console.table of the last n events
//   __smartPoseLog.errors()        — only warnings/errors
//   __smartPoseLog.save()          — download the FULL buffer as a JSON file
//   __smartPoseLog.level("debug"|"info"|"warn"|"off")  — console verbosity
//   __smartPoseLog.clear()
//
// Categories: lifecycle, rig, select, drag, solve, ik, settings, timeline,
//             bake, pose, watchdog, error

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, off: 99 };

export class SmartPoseLogger {
  constructor({ capacity = 3000, consoleLevel = "info", tag = "[SmartPose]" } = {}) {
    this.capacity = capacity;
    this.tag = tag;
    this.buffer = [];
    this.seq = 0;
    this.consoleLevel = LEVELS[consoleLevel] != null ? consoleLevel : "info";
    this.counts = new Map();       // "cat" -> count
    this.lastByKey = new Map();    // throttle keys -> { t, count }
    this.t0 = this.now();
  }

  now() {
    try { return performance.now(); } catch (_) { return Date.now(); }
  }

  setLevel(level) {
    if (LEVELS[level] != null) this.consoleLevel = level;
    return this.consoleLevel;
  }

  /** Core write. data must be JSON-safe (use summarize helpers below). */
  log(level, cat, msg, data = null, opts = {}) {
    const entry = {
      seq: this.seq++,
      t: +(this.now() - this.t0).toFixed(1),
      level,
      cat,
      msg,
      data,
    };
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    this.counts.set(cat, (this.counts.get(cat) || 0) + 1);

    // Console side: honor verbosity + optional throttling for per-frame spam.
    if (LEVELS[level] < LEVELS[this.consoleLevel]) return entry;
    if (opts.throttleKey) {
      const th = this.lastByKey.get(opts.throttleKey) || { t: -1e9, count: 0 };
      th.count++;
      const interval = opts.throttleMs ?? 500;
      if (entry.t - th.t < interval) {
        this.lastByKey.set(opts.throttleKey, th);
        return entry;
      }
      msg = th.count > 1 ? `${msg} (×${th.count} since last print)` : msg;
      this.lastByKey.set(opts.throttleKey, { t: entry.t, count: 0 });
    }
    const line = `${this.tag} ${cat} · ${msg}`;
    try {
      if (level === "error") console.error(line, data ?? "");
      else if (level === "warn") console.warn(line, data ?? "");
      else console.info(line, data ?? "");
    } catch (_) {}
    return entry;
  }

  debug(cat, msg, data, opts) { return this.log("debug", cat, msg, data, opts); }
  info(cat, msg, data, opts) { return this.log("info", cat, msg, data, opts); }
  warn(cat, msg, data, opts) { return this.log("warn", cat, msg, data, opts); }
  error(cat, msg, data, opts) { return this.log("error", cat, msg, data, opts); }

  /** Wrap a function: exceptions are logged with stack and rethrown. */
  guard(cat, label, fn) {
    try {
      return fn();
    } catch (e) {
      this.error("error", `${label} threw: ${e?.message || e}`, { stack: String(e?.stack || "").split("\n").slice(0, 6) });
      throw e;
    }
  }

  dump(n = 40, cat = null) {
    const rows = this.buffer
      .filter((e) => !cat || e.cat === cat)
      .slice(-n)
      .map((e) => ({ t: e.t, lvl: e.level, cat: e.cat, msg: e.msg, data: e.data ? JSON.stringify(e.data).slice(0, 140) : "" }));
    try { console.table(rows); } catch (_) { console.log(rows); }
    return rows.length;
  }

  errors(n = 40) {
    const rows = this.buffer.filter((e) => e.level === "warn" || e.level === "error").slice(-n);
    try { console.table(rows.map((e) => ({ t: e.t, lvl: e.level, cat: e.cat, msg: e.msg }))); } catch (_) {}
    return rows;
  }

  /** Aggregated health report; stateFn is supplied by the controller. */
  report(stateFn = null) {
    const byCat = Object.fromEntries([...this.counts.entries()].sort((a, b) => b[1] - a[1]));
    const errs = this.buffer.filter((e) => e.level === "error").slice(-5);
    const warns = this.buffer.filter((e) => e.level === "warn").slice(-5);
    const out = {
      events: this.seq,
      buffered: this.buffer.length,
      byCategory: byCat,
      lastErrors: errs.map((e) => `${e.t}ms ${e.msg}`),
      lastWarnings: warns.map((e) => `${e.t}ms ${e.msg}`),
      state: null,
    };
    try { out.state = stateFn ? stateFn() : null; } catch (e) { out.state = { stateError: String(e?.message || e) }; }
    try {
      console.info(`${this.tag} ===== REPORT =====`);
      console.info(`${this.tag} events: ${out.events}, categories:`, byCat);
      if (out.lastErrors.length) console.error(`${this.tag} last errors:`, out.lastErrors);
      if (out.lastWarnings.length) console.warn(`${this.tag} last warnings:`, out.lastWarnings);
      if (out.state) console.info(`${this.tag} state:`, out.state);
    } catch (_) {}
    return out;
  }

  /** Download the full buffer + state snapshot as a JSON file. */
  save(stateFn = null, filename = null) {
    const payload = {
      exportedAt: new Date().toISOString(),
      consoleLevel: this.consoleLevel,
      report: this.report(stateFn),
      events: this.buffer,
    };
    const json = JSON.stringify(payload, null, 1);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || `smart-pose-log-${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (_) { /* headless — return payload only */ }
    return payload;
  }

  clear() {
    this.buffer.length = 0;
    this.counts.clear();
    this.lastByKey.clear();
  }
}

/* ---------- JSON-safe summarize helpers for hot-path data ---------- */

export function v3(v) {
  return v ? [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)] : null;
}

export function quat(q) {
  return q ? [+q.x.toFixed(3), +q.y.toFixed(3), +q.z.toFixed(3), +q.w.toFixed(3)] : null;
}

export function solveResult(r) {
  if (!r) return { solved: false, reason: "no result" };
  return {
    solved: !!r.solved,
    error: Number.isFinite(r.error) ? +r.error.toFixed(4) : "inf",
    affected: (r.affected || []).length,
    bones: (r.affected || []).slice(0, 8),
    reason: r.reason || undefined,
    clamped: r.clamped || undefined,
  };
}
