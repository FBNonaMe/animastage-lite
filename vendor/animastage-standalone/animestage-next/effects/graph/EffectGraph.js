import { EffectDependencyError, EffectPlatformError } from "../core/EffectErrors.js";

const DEFAULT_EXTERNAL_RESOURCES = Object.freeze([
  "scene-color",
  "scene-depth",
  "scene-normals",
  "camera",
  "lights",
  "environment",
  "time",
]);

function freezeDeep(value, seen = new Set()) {
  if (value == null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeDeep(child, seen);
  return Object.freeze(value);
}

function graphError(message, code, details) {
  return new EffectPlatformError(message, { code, details });
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) throw new TypeError("Effect graph entries must be an array");
  const seen = new Set();
  return entries.filter((entry) => entry?.enabled !== false).map((entry, index) => {
    const entryId = String(entry?.stackEntryId || entry?.id || "").trim();
    if (!entryId) throw graphError("Effect graph entry requires stackEntryId", "EFFECT_GRAPH_ENTRY_INVALID", { index });
    if (seen.has(entryId)) throw graphError(`Duplicate effect graph entry "${entryId}"`, "EFFECT_GRAPH_ENTRY_DUPLICATE", { entryId });
    if (!entry?.definition?.manifest) throw graphError(`Effect graph entry "${entryId}" has no definition`, "EFFECT_GRAPH_ENTRY_INVALID", { entryId });
    seen.add(entryId);
    return { entryId, definition: entry.definition, index };
  });
}

/**
 * Builds a renderer-independent pass graph from enabled Effect Stack entries.
 * Stable stack order is an explicit edge, while manifests may add resource and
 * before/after constraints. A failed build never mutates the live composer.
 */
export class EffectGraph {
  constructor(entries, { externalResources = DEFAULT_EXTERNAL_RESOURCES, requireActiveDependencies = false } = {}) {
    this.externalResources = Object.freeze([...new Set((externalResources || []).map(String))]);
    this.requireActiveDependencies = requireActiveDependencies === true;
    const built = this.#build(normalizeEntries(entries));
    this.nodes = built.nodes;
    this.edges = built.edges;
    this.order = built.order;
    Object.freeze(this);
  }

  #build(entries) {
    const nodes = [];
    const entryPasses = new Map();
    const byId = new Map();
    const byEffectId = new Map();
    for (const entry of entries) {
      const manifest = entry.definition.manifest;
      const declared = manifest.passes?.length ? manifest.passes : [{
        id: manifest.entryPoints?.postPass || manifest.slot || "main",
        kind: manifest.kind,
        reads: [], writes: [], after: [], before: [], optionalReads: [], allowSharedWrites: false,
      }];
      const passNodes = declared.map((pass, passIndex) => {
        const id = `${entry.entryId}/${pass.id}`;
        if (byId.has(id)) throw graphError(`Duplicate effect pass "${id}"`, "EFFECT_GRAPH_PASS_DUPLICATE", { id });
        const node = freezeDeep({
          id,
          entryId: entry.entryId,
          effectId: manifest.id,
          effectVersion: manifest.version,
          passId: pass.id,
          kind: pass.kind || manifest.kind,
          reads: [...(pass.reads || [])],
          writes: [...(pass.writes || [])],
          optionalReads: [...(pass.optionalReads || [])],
          after: [...(pass.after || [])],
          before: [...(pass.before || [])],
          allowSharedWrites: pass.allowSharedWrites === true,
          stableIndex: nodes.length,
        });
        nodes.push(node);
        byId.set(id, node);
        return node;
      });
      entryPasses.set(entry.entryId, passNodes);
      if (!byEffectId.has(manifest.id)) byEffectId.set(manifest.id, []);
      byEffectId.get(manifest.id).push(entry.entryId);
    }

    const outgoing = new Map(nodes.map((node) => [node.id, new Set()]));
    const indegree = new Map(nodes.map((node) => [node.id, 0]));
    const edgeRecords = [];
    const addEdge = (from, to, reason) => {
      if (!from || !to || from.id === to.id || outgoing.get(from.id).has(to.id)) return;
      outgoing.get(from.id).add(to.id);
      indegree.set(to.id, indegree.get(to.id) + 1);
      edgeRecords.push(freezeDeep({ from: from.id, to: to.id, reason }));
    };
    const first = (entryId) => entryPasses.get(entryId)?.[0] || null;
    const last = (entryId) => entryPasses.get(entryId)?.at(-1) || null;
    const resolvePass = (reference, entryId, edgeKind) => {
      const ref = String(reference || "");
      if (byId.has(ref)) return byId.get(ref);
      if (byId.has(`${entryId}/${ref}`)) return byId.get(`${entryId}/${ref}`);
      if (entryPasses.has(ref)) return edgeKind === "before" ? first(ref) : last(ref);
      const effectEntries = byEffectId.get(ref);
      if (effectEntries?.length === 1) return edgeKind === "before" ? first(effectEntries[0]) : last(effectEntries[0]);
      throw graphError(`Effect pass constraint "${ref}" cannot be resolved`, "EFFECT_GRAPH_CONSTRAINT_MISSING", {
        reference: ref, entryId, edgeKind,
      });
    };

    // The visual stack is the default deterministic execution order.
    for (let index = 1; index < entries.length; index++) {
      addEdge(last(entries[index - 1].entryId), first(entries[index].entryId), "stack-order");
    }
    // Package dependencies execute before dependants when both are instantiated.
    for (const entry of entries) {
      for (const dependency of entry.definition.manifest.dependencies || []) {
        const providers = byEffectId.get(dependency.id) || [];
        if (!providers.length) {
          if (this.requireActiveDependencies && !dependency.optional) {
            throw new EffectDependencyError(
              `Effect ${entry.definition.key} requires active dependency ${dependency.id}@${dependency.range}`,
              { effect: entry.definition.key, dependency },
            );
          }
          continue;
        }
        for (const provider of providers) addEdge(last(provider), first(entry.entryId), `dependency:${dependency.id}`);
      }
    }
    for (const node of nodes) {
      for (const reference of node.after) addEdge(resolvePass(reference, node.entryId, "after"), node, `after:${reference}`);
      for (const reference of node.before) addEdge(node, resolvePass(reference, node.entryId, "before"), `before:${reference}`);
    }

    const writers = new Map();
    for (const node of nodes) for (const resource of node.writes) {
      if (!writers.has(resource)) writers.set(resource, []);
      writers.get(resource).push(node);
    }
    for (const [resource, providers] of writers) {
      if (providers.length > 1 && !providers.every((node) => node.allowSharedWrites)) {
        throw graphError(`Effect resource "${resource}" has conflicting writers`, "EFFECT_GRAPH_WRITE_CONFLICT", {
          resource, writers: providers.map((node) => node.id),
        });
      }
    }
    const external = new Set(this.externalResources);
    for (const node of nodes) for (const resource of node.reads) {
      const providers = writers.get(resource) || [];
      if (!providers.length && !external.has(resource) && !node.optionalReads.includes(resource)) {
        throw graphError(`Effect pass ${node.id} requires unavailable resource "${resource}"`, "EFFECT_GRAPH_RESOURCE_MISSING", {
          pass: node.id, resource,
        });
      }
      for (const provider of providers) addEdge(provider, node, `resource:${resource}`);
    }

    const ready = nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.stableIndex - b.stableIndex);
    const ordered = [];
    while (ready.length) {
      const node = ready.shift();
      ordered.push(node);
      for (const childId of outgoing.get(node.id)) {
        indegree.set(childId, indegree.get(childId) - 1);
        if (indegree.get(childId) === 0) {
          ready.push(byId.get(childId));
          ready.sort((a, b) => a.stableIndex - b.stableIndex);
        }
      }
    }
    if (ordered.length !== nodes.length) {
      const blocked = nodes.filter((node) => indegree.get(node.id) > 0).map((node) => node.id);
      throw new EffectDependencyError(`Effect graph contains a cycle: ${blocked.join(" -> ")}`, { cycle: blocked });
    }
    return freezeDeep({ nodes, edges: edgeRecords, order: ordered.map((node) => node.id) });
  }

  get orderedNodes() {
    const byId = new Map(this.nodes.map((node) => [node.id, node]));
    return this.order.map((id) => byId.get(id));
  }

  toJSON() {
    return { schema: "animestage.effect-graph/v1", nodes: this.nodes, edges: this.edges, order: this.order };
  }
}

export { DEFAULT_EXTERNAL_RESOURCES };
