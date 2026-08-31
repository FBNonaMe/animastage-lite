const now = () => globalThis.performance?.now?.() ?? Date.now();

export class OfflineRenderLogger {
  constructor({ capacity = 12000 } = {}) {
    this.capacity = Math.max(500, Number(capacity) || 12000);
    this.events = [];
    this.session = null;
    this.sequence = 0;
  }

  begin(meta = {}) {
    this.events.length = 0;
    this.sequence = 0;
    this.session = { id: `render-${Date.now()}`, startedAt: now(), ...meta };
    this.event("session", "BEGIN", meta);
    return this.session;
  }

  event(category, message, data = {}) {
    const entry = {
      seq: ++this.sequence,
      ms: this.session ? now() - this.session.startedAt : 0,
      category,
      message,
      data,
    };
    this.events.push(entry);
    if (this.events.length > this.capacity) this.events.shift();
    return entry;
  }

  frame(index, timelineTime, phase, data = {}) {
    return this.event("frame", phase, { index, timelineTime, ...data });
  }

  error(error, data = {}) {
    const payload = {
      name: error?.name || "Error",
      message: error?.message || String(error),
      stack: error?.stack || "",
      ...data,
    };
    console.error("[RenderLog]", payload);
    return this.event("error", "FAILED", payload);
  }

  warning(message, data = {}) {
    console.warn("[RenderLog]", message, data);
    return this.event("warning", message, data);
  }

  report() {
    const categories = {};
    for (const event of this.events)
      categories[event.category] = (categories[event.category] || 0) + 1;
    const report = { session: this.session, events: this.events.length, categories };
    console.info("[RenderLog] report", report);
    console.table(this.events.slice(-30));
    return report;
  }

  dump() { return structuredClone({ session: this.session, events: this.events }); }
  errors() { return this.events.filter((event) => event.category === "error"); }
  save() {
    const blob = new Blob([JSON.stringify(this.dump(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${this.session?.id || "render-log"}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
