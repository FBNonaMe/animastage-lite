import { createShaderSource } from "../compiler/ShaderSource.js";

const CATEGORY_TABS = Object.freeze([
  ["all", "All Effects"],
  ["favorites", "Favorites"],
  ["recent", "Recent"],
  ["materials", "Materials"],
  ["weather fx", "Weather FX"],
  ["post processing", "Post FX"],
  ["ray-mmd", "Ray-MMD"],
  ["imported", "Imported"],
]);
const WORKSPACE_VIEWS = Object.freeze([
  ["library", "Library"],
  ["stack", "Stack"],
  ["inspector", "Inspector"],
  ["graph", "Graph"],
  ["performance", "Performance"],
  ["previews", "Previews"],
  ["source", "Source"],
  ["diagnostics", "Diagnostics"],
]);

function node(tag, properties = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2), value);
    else if (key === "value") element.value = value ?? "";
    else if (key === "checked") element.checked = !!value;
    else if (key === "disabled") element.disabled = !!value;
    else if (key === "selected") element.selected = !!value;
    else if (value != null) element.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child != null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export class EffectsLibraryPanel {
  #query = "";
  #category = "all";
  #busy = false;
  #message = "";
  #selectedInstanceId = null;
  #selectedEffectKey = null;
  #view = "library";
  #thumbnailStates = new Map();
  #editorLanguage = "wgsl";
  #editorStage = "fragment";
  #editorText = `@fragment
fn main() -> @location(0) vec4f {
  return vec4f(0.52, 0.34, 1.0, 1.0);
}`;
  #editorAuto = false;
  #editorResult = null;
  #compileTimer = null;

  constructor({ registry, runtime, stack = null, adapter, compatibility = null, profiler = null, previews = null, compiler = null, sourceWorkbench = null }) {
    this.registry = registry;
    this.runtime = runtime;
    this.stack = stack;
    this.adapter = adapter;
    this.compatibility = compatibility;
    this.profiler = profiler;
    this.previews = previews;
    this.compiler = compiler;
    this.sourceWorkbench = sourceWorkbench;
  }

  render(container) {
    const shell = node("section", { class: "as-effects-library", "aria-label": "Effects Library" });
    const heading = node("div", { class: "as-effects-heading" },
      node("div", {},
        node("strong", { text: "Effects Library" }),
        node("span", { text: `${this.registry.size} indexed · transactional` }),
      ),
      node("span", { class: "as-effects-health", text: this.#busy ? "Applying…" : "Ready" }),
    );
    const workspaceNav = node("div", { class: "as-effects-workspace-nav", role: "tablist", "aria-label": "Shader Studio views" });
    for (const [id, label] of WORKSPACE_VIEWS) {
      workspaceNav.append(node("button", {
        type: "button",
        class: `as-effects-workspace-tab${this.#view === id ? " active" : ""}`,
        role: "tab",
        "aria-selected": this.#view === id,
        text: label,
        onclick: () => { this.#view = id; this.#rerender(container); },
      }));
    }
    const tabs = node("div", { class: "as-effects-tabs", role: "tablist", "aria-label": "Effect categories" });
    for (const [id, label] of CATEGORY_TABS) {
      tabs.append(node("button", {
        type: "button",
        class: `as-effects-tab${this.#category === id ? " active" : ""}`,
        role: "tab",
        "aria-selected": this.#category === id,
        text: label,
        onclick: () => { this.#category = id; this.#rerender(container); },
      }));
    }
    const search = node("input", {
      class: "as-effects-search",
      type: "search",
      value: this.#query,
      placeholder: "Search name, author, tag…",
      "aria-label": "Search effects",
      oninput: (event) => { this.#query = event.target.value; this.#rerender(container); },
    });

    const definitions = this.#category === "favorites"
      ? this.registry.list({ query: this.#query, favorites: true })
      : this.#category === "recent"
        ? this.registry.recent.filter((definition) => !this.#query || [definition.manifest.name, definition.manifest.id, ...definition.manifest.tags].some((value) => String(value).toLowerCase().includes(this.#query.toLowerCase())))
        : this.registry.list({ query: this.#query, category: this.#category === "all" ? null : this.#category });
    const grid = node("div", { class: "as-effects-grid" });
    for (const definition of definitions) grid.append(this.#card(definition, container));
    if (!definitions.length) {
      grid.append(node("div", { class: "as-effects-empty", text: "No indexed effects match this filter." }));
    }
    shell.append(heading, workspaceNav);
    const selected = this.#selectedInstanceId ? this.runtime.getInstance(this.#selectedInstanceId) : null;
    if (this.#view === "library") shell.append(tabs, search, grid);
    else if (this.#view === "stack" && this.stack) shell.append(this.#stackSection(container));
    else if (this.#view === "inspector") {
      if (selected?.state === "active") shell.append(this.#inspector(selected, container));
      else shell.append(node("div", { class: "as-effects-empty", text: "Select an active Effect Stack layer to edit its reflected parameters." }));
    } else if (this.#view === "graph") shell.append(this.#graphView());
    else if (this.#view === "performance") shell.append(this.#performanceView());
    else if (this.#view === "previews") shell.append(this.#previewView(container));
    else if (this.#view === "source") shell.append(this.#sourceView(selected, container));
    else if (this.#view === "diagnostics") shell.append(this.#diagnosticsView());
    if (this.#message) shell.append(node("div", { class: "as-effects-message", text: this.#message }));
    shell.append(node("div", {
      class: "as-effects-footnote",
      text: "Original archives stay immutable. Imported files are verified before adaptation.",
    }));
    container.append(shell);
  }

  #card(definition, container) {
    const manifest = definition.manifest;
    const favorite = this.registry.isFavorite(manifest.id);
    const target = this.adapter.getTarget?.(manifest) ?? null;
    const hasTarget = !!target;
    const stackEntry = this.stack?.entries.find((entry) =>
      entry.definition.key === definition.key && entry.target.kind === target?.kind && entry.target.id === target?.id && entry.enabled);
    const active = stackEntry?.instanceId
      ? this.runtime.getInstance(stackEntry.instanceId)
      : this.runtime.instances.find((instance) =>
          instance.definition.key === definition.key && instance.target.kind === target?.kind && instance.target.id === target?.id);
    const runnable = !!definition.implementation && [
      "ADAPTED", "RUNTIME_TESTED", "GPU_TESTED", "PRODUCTION_READY",
    ].includes(manifest.status);
    const compatibility = this.compatibility?.evaluate?.(definition) || { compatible: true, pending: false, reasons: [] };
    const usable = runnable && compatibility.compatible;
    const sourceUrl = manifest.provenance?.sourceUrl;
    const sourceLink = sourceUrl && !runnable
      ? node("a", {
          class: "as-effect-source-link",
          href: sourceUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          text: "Official source ↗",
          title: "Open the original author repository",
        })
      : null;
    return node("article", { class: "as-effect-card", "data-effect-id": manifest.id },
      node("button", {
        type: "button",
        class: `as-effect-favorite${favorite ? " active" : ""}`,
        title: favorite ? "Remove from favorites" : "Add to favorites",
        text: favorite ? "★" : "☆",
        onclick: () => {
          this.registry.setFavorite(manifest.id, !favorite);
          this.#rerender(container);
        },
      }),
      node("button", {
        type: "button",
        class: `as-effect-apply${active ? " active" : ""}`,
        disabled: this.#busy || !usable || !hasTarget,
        title: !hasTarget
          ? "Load and select a model before applying effects"
          : usable
            ? `Apply ${manifest.name}`
            : runnable && !compatibility.compatible
              ? `Renderer incompatible: ${compatibility.reasons.join(", ")}`
            : `${manifest.status.replaceAll("_", " ")} — adapter is not runtime-ready`,
        onclick: () => {
          this.#selectedEffectKey = definition.key;
          if (active) {
            this.#selectedInstanceId = active.instanceId;
            this.#view = "inspector";
            this.#message = `${manifest.name} is already active.`;
            this.#rerender(container);
            return;
          }
          this.#apply(definition, container);
        },
      },
        this.#previewThumbnail(definition, container),
        node("span", { class: "as-effect-kind", text: manifest.kind }),
        node("strong", { text: manifest.name }),
        node("small", { text: manifest.description }),
        node("span", { class: "as-effect-status", text: manifest.status.replaceAll("_", " ") }),
        compatibility.pending ? node("span", { class: "as-effect-compat pending", text: "GPU CHECK PENDING" })
          : !compatibility.compatible ? node("span", { class: "as-effect-compat blocked", text: "UNSUPPORTED ON THIS GPU" })
            : runnable ? node("span", { class: "as-effect-compat", text: "DEVICE READY" }) : null,
        active ? node("span", { class: "as-effect-active", text: "ACTIVE · EDIT BELOW" }) : null,
      ),
      sourceLink,
    );
  }

  #previewThumbnail(definition, container) {
    const manifest = definition.manifest;
    if (!manifest.preview?.enabled || !this.previews) {
      return node("span", { class: "as-effect-thumbnail unavailable", text: "PREVIEW UNAVAILABLE" });
    }
    let state = this.#thumbnailStates.get(definition.key);
    if (state?.status === "ready" && !this.previews.cache.get(state.record.key)) {
      this.#thumbnailStates.delete(definition.key);
      state = null;
    }
    if (state?.status === "ready" && state.record?.url) {
      return node("span", { class: "as-effect-thumbnail ready" },
        node("img", { src: state.record.url, alt: `${manifest.name} isolated preview`, loading: "lazy" }),
        node("span", { text: state.cacheHit ? "CACHED · ISOLATED" : "ISOLATED WEBGL2" }),
      );
    }
    if (state?.status === "error") {
      return node("span", { class: "as-effect-thumbnail error", text: "PREVIEW FAILED · EFFECT REMAINS SAFE" });
    }
    if (!state) {
      this.#thumbnailStates.set(definition.key, { status: "pending" });
      queueMicrotask(async () => {
        try {
          const result = await this.previews.render(definition);
          this.#thumbnailStates.set(definition.key, { status: "ready", record: result.record, cacheHit: result.cacheHit });
        } catch (error) {
          this.#thumbnailStates.set(definition.key, { status: "error", message: error?.message || String(error) });
        }
        if (container.isConnected) this.#rerender(container);
      });
    }
    return node("span", { class: "as-effect-thumbnail pending", text: "RENDERING ISOLATED PREVIEW…" });
  }

  #previewView(container) {
    const stats = this.previews?.stats || { entries: 0, bytes: 0, maxEntries: 0, maxBytes: 0 };
    const entries = this.previews?.cache?.entries || [];
    const previewable = this.registry.list().filter((definition) => definition.manifest.preview?.enabled);
    const formatBytes = (bytes) => bytes >= 1048576
      ? `${(bytes / 1048576).toFixed(1)} MiB`
      : `${Math.ceil(bytes / 1024)} KiB`;
    const actions = node("div", { class: "as-effect-preview-actions" },
      node("button", {
        type: "button",
        text: "Generate all",
        disabled: this.#busy || !previewable.length,
        onclick: async () => {
          if (this.#busy) return;
          this.#busy = true;
          this.#message = "Generating isolated previews…";
          this.#rerender(container);
          try {
            for (const definition of previewable) {
              const result = await this.previews.render(definition);
              this.#thumbnailStates.set(definition.key, { status: "ready", record: result.record, cacheHit: result.cacheHit });
            }
            this.#message = `${previewable.length} isolated preview${previewable.length === 1 ? "" : "s"} ready.`;
          } catch (error) {
            this.#message = error?.message || String(error);
          } finally {
            this.#busy = false;
            this.#rerender(container);
          }
        },
      }),
      node("button", {
        type: "button",
        text: "Clear cache",
        disabled: this.#busy || !stats.entries,
        onclick: () => {
          this.previews.clearCache();
          this.#thumbnailStates.clear();
          this.#message = "Preview cache cleared and object URLs released.";
          this.#rerender(container);
        },
      }),
    );
    const list = node("div", { class: "as-effect-preview-list" });
    for (const entry of entries) {
      list.append(node("article", { class: "as-effect-preview-row" },
        entry.url ? node("img", { src: entry.url, alt: `${entry.effectKey} preview` }) : null,
        node("div", {},
          node("strong", { text: entry.effectKey }),
          node("small", { text: `${entry.width}×${entry.height} · ${formatBytes(entry.bytes)} · ${entry.backend}` }),
          node("code", { text: entry.key }),
        ),
      ));
    }
    if (!entries.length) list.append(node("div", { class: "as-effects-empty", text: "Preview cache is empty. Open Library or generate all previews here." }));
    return node("section", { class: "as-effect-workspace-view" },
      node("header", {},
        node("div", {}, node("strong", { text: "Isolated Preview Cache" }), node("span", { text: `${stats.entries}/${stats.maxEntries} entries · ${formatBytes(stats.bytes)}/${formatBytes(stats.maxBytes)}` })),
        actions,
      ),
      list,
      node("p", { class: "as-effect-source-note", text: "Each thumbnail is rendered on its own WebGL canvas and composer. The active scene, camera, model, viewport and Effect Stack are never touched." }),
    );
  }

  async #apply(definition, container) {
    if (this.#busy) return;
    const target = this.adapter.getTarget?.(definition.manifest);
    if (!target) {
      this.#message = "Load and select a model first.";
      this.#rerender(container);
      return;
    }
    this.#busy = true;
    this.#message = "";
    this.#rerender(container);
    try {
      const stackEntry = this.stack
        ? await this.stack.add(definition, {
            owner: { kind: "editor", id: "shader-studio" },
            target,
            context: { source: "effects-library-ui" },
          })
        : null;
      const instance = stackEntry?.instanceId
        ? this.runtime.getInstance(stackEntry.instanceId)
        : await this.runtime.apply(definition, {
            owner: { kind: "editor", id: "shader-studio" },
            target,
            context: { source: "effects-library-ui" },
          });
      this.#selectedInstanceId = instance.instanceId;
      this.#selectedEffectKey = definition.key;
      this.#view = "inspector";
      this.#message = `${definition.manifest.name} applied to ${target.id}.`;
    } catch (error) {
      this.#message = error?.message || String(error);
    } finally {
      this.#busy = false;
      this.#rerender(container);
    }
  }

  #stackSection(container) {
    const entries = this.stack.entries;
    const run = async (operation) => {
      if (this.#busy) return;
      this.#busy = true;
      this.#rerender(container);
      try { await operation(); }
      catch (error) { this.#message = error?.message || String(error); }
      finally { this.#busy = false; this.#rerender(container); }
    };
    const toolbar = node("div", { class: "as-effect-stack-toolbar" },
      node("div", {},
        node("strong", { text: "Effect Stack" }),
        node("span", { text: `${entries.length} layer${entries.length === 1 ? "" : "s"} · ${this.stack.graph.order.length} pass${this.stack.graph.order.length === 1 ? "" : "es"}` }),
      ),
      node("div", { class: "as-effect-stack-actions" },
        node("button", {
          type: "button", text: "Export", disabled: !entries.length || this.#busy,
          onclick: () => {
            const preset = this.stack.createPreset({ name: "AnimeStage Effect Stack" });
            const blob = new Blob([`${JSON.stringify(preset, null, 2)}\n`], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "animestage-effect-stack.json";
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            this.#message = "Effect Stack preset exported.";
            this.#rerender(container);
          },
        }),
        node("button", {
          type: "button", text: "Import", disabled: this.#busy,
          onclick: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              await run(async () => {
                await this.stack.restore(JSON.parse(await file.text()), { missing: "skip", context: { source: "effects-preset-import" } });
                this.#selectedInstanceId = null;
                this.#message = "Effect Stack preset imported transactionally.";
              });
            };
            input.click();
          },
        }),
        node("button", {
          type: "button", text: "Clear", disabled: !entries.length || this.#busy,
          onclick: () => run(async () => {
            await this.stack.clear({ source: "effects-library-clear" });
            this.#selectedInstanceId = null;
            this.#message = "Effect Stack cleared.";
          }),
        }),
      ),
    );
    const list = node("div", { class: "as-effect-stack-list" });
    entries.forEach((entry, index) => {
      const manifest = entry.definition.manifest;
      const select = () => {
        if (entry.instanceId) this.#selectedInstanceId = entry.instanceId;
        this.#selectedEffectKey = entry.definition.key;
        this.#view = entry.enabled ? "inspector" : "stack";
        this.#message = entry.enabled ? `${manifest.name} selected.` : `${manifest.name} is disabled.`;
        this.#rerender(container);
      };
      const action = (callback) => (event) => { event.stopPropagation(); run(callback); };
      list.append(node("div", {
        class: `as-effect-stack-row${entry.instanceId === this.#selectedInstanceId ? " selected" : ""}${entry.enabled ? "" : " disabled"}`,
        role: "button", tabindex: "0", onclick: select,
      },
        node("span", { class: "as-effect-stack-index", text: String(index + 1).padStart(2, "0") }),
        node("div", { class: "as-effect-stack-name" },
          node("strong", { text: entry.label || manifest.name }),
          node("small", { text: `${manifest.kind} · ${manifest.status.replaceAll("_", " ")}` }),
        ),
        node("div", { class: "as-effect-stack-row-actions" },
          node("button", {
            type: "button", text: "↑", title: "Move effect earlier", disabled: index === 0 || this.#busy,
            onclick: action(() => this.stack.move(entry.stackEntryId, index - 1, { source: "effects-stack-ui" })),
          }),
          node("button", {
            type: "button", text: "↓", title: "Move effect later", disabled: index === entries.length - 1 || this.#busy,
            onclick: action(() => this.stack.move(entry.stackEntryId, index + 1, { source: "effects-stack-ui" })),
          }),
          node("button", {
            type: "button", text: "Duplicate", disabled: this.#busy,
            onclick: action(() => this.stack.duplicate(entry.stackEntryId, { context: { source: "effects-stack-ui" } })),
          }),
          node("button", {
            type: "button", text: entry.enabled ? "Disable" : "Enable", disabled: this.#busy,
            onclick: action(async () => {
              const changed = await this.stack.setEnabled(entry.stackEntryId, !entry.enabled, { source: "effects-stack-ui" });
              this.#selectedInstanceId = changed.instanceId;
            }),
          }),
          node("button", {
            type: "button", text: "Remove", disabled: this.#busy,
            onclick: action(async () => {
              await this.stack.remove(entry.stackEntryId, { source: "effects-stack-ui" });
              if (entry.instanceId === this.#selectedInstanceId) this.#selectedInstanceId = null;
            }),
          }),
        ),
      ));
    });
    if (!entries.length) list.append(node("div", { class: "as-effects-empty", text: "Apply an effect to build a deterministic stack." }));
    return node("section", { class: "as-effect-stack", "aria-label": "Effect Stack" }, toolbar, list);
  }

  #graphView() {
    if (!this.stack?.graph.nodes.length) {
      return node("div", { class: "as-effects-empty", text: "The graph will appear when an enabled effect contributes a renderer pass." });
    }
    const graph = this.stack.graph;
    const byId = new Map(graph.nodes.map((entry) => [entry.id, entry]));
    const edgeCount = new Map(graph.nodes.map((entry) => [entry.id, { in: 0, out: 0 }]));
    for (const edge of graph.edges) {
      if (edgeCount.has(edge.from)) edgeCount.get(edge.from).out++;
      if (edgeCount.has(edge.to)) edgeCount.get(edge.to).in++;
    }
    const flow = node("div", { class: "as-effect-graph-flow" });
    graph.order.forEach((id, index) => {
      const pass = byId.get(id);
      const counts = edgeCount.get(id);
      if (index) flow.append(node("span", { class: "as-effect-graph-arrow", text: "→" }));
      flow.append(node("article", { class: "as-effect-graph-node" },
        node("span", { text: String(index + 1).padStart(2, "0") }),
        node("strong", { text: pass.passId }),
        node("small", { text: pass.effectId }),
        node("code", { text: `${counts.in} in · ${counts.out} out` }),
        pass.reads.length ? node("p", { text: `reads: ${pass.reads.join(", ")}` }) : null,
        pass.writes.length ? node("p", { text: `writes: ${pass.writes.join(", ")}` }) : null,
      ));
    });
    return node("section", { class: "as-effect-workspace-view" },
      node("header", {}, node("strong", { text: "Effect Graph" }), node("span", { text: `${graph.nodes.length} passes · ${graph.edges.length} dependencies` })),
      flow,
    );
  }

  #sourceView(selectedInstance, container) {
    const definition = selectedInstance?.definition
      || this.stack?.entries.find((entry) => entry.definition.key === this.#selectedEffectKey)?.definition
      || this.registry.list().find((entry) => entry.key === this.#selectedEffectKey)
      || null;
    const workbench = this.#shaderWorkbench(container);
    if (!definition) return workbench;
    const manifest = definition.manifest;
    const permission = (value) => value === true ? "allowed" : value === false ? "not allowed" : "unknown";
    const fields = [
      ["Package", `${manifest.id}@${manifest.version}`],
      ["Author", manifest.author.name],
      ["Languages", manifest.languages.join(", ") || "native adapter"],
      ["Renderers", manifest.renderers.join(", ") || "not declared"],
      ["License", manifest.license.type],
      ["Redistribution", permission(manifest.license.redistributionAllowed)],
      ["Modification", permission(manifest.license.modificationAllowed)],
      ["Source", manifest.provenance.sourceUrl || definition.source],
      ["Entry points", Object.entries(manifest.entryPoints).map(([key, value]) => `${key}: ${value}`).join(" · ") || "adapter-owned"],
      ["GPU requirements", [
        ...manifest.requirements.features,
        ...Object.entries(manifest.requirements.limits).map(([name, value]) => `${name} ≥ ${value}`),
      ].join(" · ") || "no additional requirements"],
    ];
    const body = node("dl", { class: "as-effect-source-grid" });
    for (const [label, value] of fields) body.append(node("dt", { text: label }), node("dd", { text: value }));
    const passes = node("div", { class: "as-effect-source-passes" });
    for (const pass of manifest.passes) passes.append(node("code", { text: `${pass.id} · ${pass.kind}` }));
    const packageView = node("section", { class: "as-effect-workspace-view as-effect-package-source" },
      node("header", {}, node("strong", { text: manifest.name }), node("span", { text: manifest.status.replaceAll("_", " ") })),
      body,
      manifest.passes.length ? node("div", {}, node("h4", { text: "Declared passes" }), passes) : null,
      node("p", { class: "as-effect-source-note", text: definition.implementation
        ? "This package uses a reviewed AnimaStage adapter. Live replacement remains transactional: a failed apply keeps the previous renderer state."
        : "This source is indexed as metadata only and cannot execute until a reviewed backend adapter exists." }),
    );
    return node("div", { class: "as-effect-source-layout" }, workbench, packageView);
  }

  #shaderWorkbench(container) {
    if (!this.compiler || !this.sourceWorkbench) {
      return node("div", { class: "as-effects-empty", text: "Native shader compiler is not available in this build." });
    }
    const language = node("select", {
      onchange: (event) => {
        this.#editorLanguage = event.target.value;
        if (this.#editorLanguage === "glsl" && this.#editorStage === "compute") this.#editorStage = "fragment";
        this.#editorText = this.#editorTemplate(this.#editorLanguage, this.#editorStage);
        this.#editorResult = null;
        this.#rerender(container);
      },
    },
      node("option", { value: "wgsl", selected: this.#editorLanguage === "wgsl", text: "WGSL · WebGPU" }),
      node("option", { value: "glsl", selected: this.#editorLanguage === "glsl", text: "GLSL · WebGL2" }),
    );
    const stage = node("select", {
      onchange: (event) => {
        this.#editorStage = event.target.value;
        this.#editorText = this.#editorTemplate(this.#editorLanguage, this.#editorStage);
        this.#editorResult = null;
        this.#rerender(container);
      },
    },
      node("option", { value: "fragment", selected: this.#editorStage === "fragment", text: "Fragment" }),
      node("option", { value: "vertex", selected: this.#editorStage === "vertex", text: "Vertex" }),
      this.#editorLanguage === "wgsl" ? node("option", { value: "compute", selected: this.#editorStage === "compute", text: "Compute" }) : null,
    );
    const editor = node("textarea", {
      class: "as-shader-editor",
      value: this.#editorText,
      spellcheck: "false",
      "aria-label": "Shader source editor",
      oninput: (event) => {
        this.#editorText = event.target.value;
        if (this.#editorAuto) {
          clearTimeout(this.#compileTimer);
          this.#compileTimer = setTimeout(() => this.#compileEditor(container), 550);
        }
      },
    });
    const controls = node("div", { class: "as-shader-controls" }, language, stage,
      node("label", { class: "as-shader-auto" },
        node("input", { type: "checkbox", checked: this.#editorAuto, onchange: (event) => { this.#editorAuto = !!event.target.checked; } }),
        " Auto compile",
      ),
      node("button", { type: "button", disabled: this.#busy, text: this.#busy ? "Compiling…" : "Compile & stage", onclick: () => this.#compileEditor(container) }),
    );
    const result = this.#editorResult;
    const diagnostics = node("div", { class: "as-shader-diagnostics" });
    if (!result) diagnostics.append(node("p", { text: "The active shader stays untouched until this isolated compile succeeds." }));
    else if (result.committed) {
      const compilation = result.current.compilation;
      diagnostics.append(
        node("strong", { class: "ok", text: `Revision ${result.current.revision} ready · ${compilation.backend.toUpperCase()} · ${compilation.durationMs.toFixed(1)} ms${compilation.cacheHit ? " · cache" : ""}` }),
        node("p", { text: `${compilation.reflection.entryPoints.length} entry point(s) · ${compilation.reflection.bindings.length} binding(s) · ${compilation.reflection.parameters.length} reflected parameter(s)` }),
      );
      for (const item of compilation.diagnostics) diagnostics.append(node("code", { text: `${item.severity} ${item.line || "?"}:${item.column || "?"} · ${item.message}` }));
    } else {
      diagnostics.append(node("strong", { class: "error", text: `Compile failed · revision ${result.current?.revision || 0} preserved` }));
      const entries = result.error?.diagnostics?.length ? result.error.diagnostics : [{ message: result.error?.message || "Unknown compiler error", line: null, column: null }];
      for (const item of entries) diagnostics.append(node("code", { class: "error", text: `${item.line || "?"}:${item.column || "?"} · ${item.message}` }));
    }
    return node("section", { class: "as-effect-workspace-view as-shader-workbench" },
      node("header", {}, node("strong", { text: "Native Shader Workbench" }), node("span", { text: "isolated compile · atomic rollback" })),
      controls, editor, diagnostics,
    );
  }

  async #compileEditor(container) {
    if (this.#busy) return;
    this.#busy = true;
    this.#message = `Compiling ${this.#editorLanguage.toUpperCase()} in an isolated ${this.#editorLanguage === "wgsl" ? "WebGPU" : "WebGL2"} backend…`;
    this.#rerender(container);
    try {
      const source = createShaderSource({ id: `workbench/editor.${this.#editorLanguage}`, language: this.#editorLanguage, text: this.#editorText, entryPoint: "main" });
      this.#editorResult = await this.sourceWorkbench.stage(source, { stage: this.#editorStage, entryPoint: "main" });
      this.#message = this.#editorResult.committed
        ? `Shader revision ${this.#editorResult.current.revision} compiled and staged safely.`
        : `Compilation rejected. Revision ${this.#editorResult.current?.revision || 0} remains active.`;
    } catch (error) {
      this.#editorResult = { committed: false, current: this.sourceWorkbench.current, error };
      this.#message = error.message;
    } finally {
      this.#busy = false;
      this.#rerender(container);
    }
  }

  #editorTemplate(language, stage) {
    if (language === "glsl") {
      return stage === "vertex"
        ? `void main() {\n  float x = float((gl_VertexID << 1) & 2);\n  float y = float(gl_VertexID & 2);\n  gl_Position = vec4(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);\n}`
        : `out vec4 outColor;\nvoid main() {\n  outColor = vec4(0.52, 0.34, 1.0, 1.0);\n}`;
    }
    if (stage === "vertex") return `@vertex\nfn main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {\n  var p = array<vec2f, 3>(vec2f(-1.0,-1.0), vec2f(3.0,-1.0), vec2f(-1.0,3.0));\n  return vec4f(p[index], 0.0, 1.0);\n}`;
    if (stage === "compute") return `@compute @workgroup_size(1)\nfn main() {\n}`;
    return `@fragment\nfn main() -> @location(0) vec4f {\n  return vec4f(0.52, 0.34, 1.0, 1.0);\n}`;
  }

  #performanceView() {
    const compatibility = this.compatibility?.context || { available: false, backend: "pending", device: {}, features: [], limits: {} };
    const report = this.profiler?.getReport?.() || this.adapter.getPerformanceReport?.() || { passes: [], totalAverageMs: 0, frameBudgetMs: 0, budgetUse: 0 };
    const device = node("dl", { class: "as-effect-source-grid" },
      node("dt", { text: "GPU" }), node("dd", { text: compatibility.device?.renderer || "Renderer pending" }),
      node("dt", { text: "Backend" }), node("dd", { text: compatibility.backend || "pending" }),
      node("dt", { text: "Timer" }), node("dd", { text: compatibility.features?.includes("gpu-timer-query") ? "GPU query" : "CPU fallback" }),
      node("dt", { text: "Frame budget" }), node("dd", { text: `${Number(report.totalAverageMs || 0).toFixed(2)} / ${Number(report.frameBudgetMs || 0).toFixed(2)} ms` }),
    );
    const meter = node("div", { class: "as-effect-budget" },
      node("span", { style: `width:${Math.min(100, Math.max(0, Number(report.budgetUse || 0) * 100))}%` }),
    );
    const passes = node("div", { class: "as-effect-performance-list" });
    for (const pass of report.passes || []) {
      const timing = pass.timingSource === "gpu" ? pass.gpu : pass.cpu;
      passes.append(node("article", { class: `as-effect-performance-row${pass.overBudget ? " over" : ""}` },
        node("div", {}, node("strong", { text: pass.passId }), node("span", { text: `${pass.timingSource.toUpperCase()} · ${timing.samples} samples` })),
        node("code", { text: `${timing.averageMs.toFixed(2)} avg · ${timing.p95Ms.toFixed(2)} p95 · ${pass.budgetMs.toFixed(2)} budget` }),
      ));
    }
    if (!report.passes?.length) passes.append(node("div", { class: "as-effects-empty", text: "Enable a post effect to begin pass profiling." }));
    return node("section", { class: "as-effect-workspace-view" },
      node("header", {}, node("strong", { text: "Effect Performance" }), node("span", { text: `${report.instrumented || 0} instrumented passes` })),
      device,
      meter,
      passes,
      node("p", { class: "as-effect-source-note", text: "GPU timer queries are used when supported. Otherwise AnimaStage falls back to non-invasive CPU pass timing without changing the rendered frame." }),
    );
  }

  #diagnosticsView() {
    const events = this.runtime.diagnostics?.events?.slice(-100).reverse() || [];
    const list = node("div", { class: "as-effect-diagnostics-list" });
    for (const event of events) list.append(node("article", { class: `as-effect-diagnostic ${event.severity}` },
      node("div", {}, node("strong", { text: event.code }), node("span", { text: `#${event.sequence} · ${event.severity}` })),
      node("p", { text: event.message }),
      event.stageId != null ? node("code", { text: String(event.stageId) }) : null,
    ));
    if (!events.length) list.append(node("div", { class: "as-effects-empty", text: "No effect warnings or errors have been recorded." }));
    return node("section", { class: "as-effect-workspace-view" },
      node("header", {}, node("strong", { text: "Diagnostics" }), node("span", { text: `${events.length} recent events` })),
      list,
    );
  }

  #inspector(instance, container) {
    const manifest = instance.definition.manifest;
    const stackEntry = this.stack?.entries.find((entry) => entry.instanceId === instance.instanceId) || null;
    const body = node("div", { class: "as-effect-inspector-body" });
    for (const definition of manifest.parameters) {
      const value = instance.parameters[definition.id];
      const commit = async (nextValue) => {
        if (this.#busy) return;
        this.#busy = true;
        try {
          if (stackEntry) {
            await this.stack.updateParameters(stackEntry.stackEntryId, { [definition.id]: nextValue }, { source: "effects-library-parameter" });
          } else {
            await this.runtime.updateParameters(instance, { [definition.id]: nextValue }, { source: "effects-library-parameter" });
          }
          this.#message = `${definition.label} updated.`;
        } catch (error) {
          this.#message = error?.message || String(error);
        } finally {
          this.#busy = false;
          this.#rerender(container);
        }
      };
      let control;
      if (["float", "int", "angle"].includes(definition.type)) {
        control = node("div", { class: "as-effect-param-pair" },
          node("input", {
            type: "range",
            min: definition.min ?? 0,
            max: definition.max ?? 1,
            step: definition.step ?? (definition.type === "int" ? 1 : 0.01),
            value,
            disabled: this.#busy,
            onchange: (event) => commit(definition.type === "int" ? Math.round(Number(event.target.value)) : Number(event.target.value)),
          }),
          node("output", { text: Number(value).toFixed(definition.type === "int" ? 0 : 2) }),
        );
      } else if (definition.type === "enum") {
        const select = node("select", {
          disabled: this.#busy,
          onchange: (event) => {
            const option = definition.options[Number(event.target.selectedIndex)];
            if (option) commit(option.value);
          },
        });
        for (const option of definition.options) {
          select.append(node("option", { text: option.label, selected: Object.is(option.value, value) }));
        }
        control = select;
      } else if (definition.type === "bool") {
        control = node("input", {
          type: "checkbox",
          checked: value,
          disabled: this.#busy,
          onchange: (event) => commit(!!event.target.checked),
        });
      } else if (definition.type === "color") {
        control = node("input", {
          type: "color",
          value: typeof value === "string" ? value.slice(0, 7) : "#ffffff",
          disabled: this.#busy,
          onchange: (event) => commit(event.target.value),
        });
      } else {
        control = node("code", { text: JSON.stringify(value) });
      }
      body.append(node("label", { class: "as-effect-param" },
        node("span", { text: definition.label }),
        control,
      ));
    }
    return node("section", { class: "as-effect-inspector", "aria-label": `${manifest.name} parameters` },
      node("header", {},
        node("div", {}, node("strong", { text: manifest.name }), node("small", { text: `${manifest.parameters.length} reflected parameters` })),
        node("button", {
          type: "button",
          class: "as-effect-disable",
          text: "Disable",
          disabled: this.#busy,
          onclick: async () => {
            if (this.#busy) return;
            this.#busy = true;
            try {
              if (stackEntry) await this.stack.remove(stackEntry.stackEntryId, { source: "effects-library-ui" });
              else await this.runtime.disable(instance, { source: "effects-library-ui" });
              this.#selectedInstanceId = null;
              this.#message = `${manifest.name} disabled.`;
            } catch (error) {
              this.#message = error?.message || String(error);
            } finally {
              this.#busy = false;
              this.#rerender(container);
            }
          },
        }),
      ),
      body,
    );
  }

  #rerender(container) {
    const current = container.querySelector(":scope > .as-effects-library");
    if (current) current.remove();
    this.render(container);
    container.prepend(container.lastElementChild);
  }
}
