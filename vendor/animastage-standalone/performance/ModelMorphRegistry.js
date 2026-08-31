import { normalizePerformanceName } from "./PerformanceNameNormalizer.js";
import { createPerformanceRigFingerprint } from "./PerformanceRigFingerprint.js";

export const MORPH_CATEGORIES = Object.freeze(["eyes", "mouth", "brow", "other"]);

const PMX_PANEL_CATEGORY = Object.freeze({
  1: "brow",
  2: "eyes",
  3: "mouth",
  4: "other",
});

const PMD_CATEGORY = Object.freeze({
  1: "brow",
  2: "eyes",
  3: "mouth",
  4: "other",
});

const MORPH_TYPE_NAMES = Object.freeze({
  "-1": "base",
  0: "group",
  1: "vertex",
  2: "bone",
  3: "uv",
  4: "additional-uv1",
  5: "additional-uv2",
  6: "additional-uv3",
  7: "additional-uv4",
  8: "material",
  9: "flip",
  10: "impulse",
});

const FRIENDLY_LABELS = Object.freeze({
  まばたき: "Blink",
  瞬き: "Blink",
  ウィンク: "Wink",
  ウィンク右: "Right Wink",
  笑い: "Happy Eyes",
  びっくり: "Eye Wide",
  じと目: "Half-lidded Eyes",
  瞳小: "Small Pupils",
  瞳大: "Large Pupils",
  ハイライト: "Eye Highlight",
  ハイライト消: "Remove Eye Highlight",
  あ: "Mouth A",
  い: "Mouth I",
  う: "Mouth U",
  え: "Mouth E",
  お: "Mouth O",
  にやり: "Grin",
  舌: "Tongue",
  牙: "Fangs",
  真面目: "Serious Brow",
  困る: "Worried Brow",
  怒り: "Angry",
  上: "Brow Up",
  下: "Brow Down",
  涙: "Tears",
  赤面: "Blush",
  照れ: "Embarrassed",
  汗: "Sweat",
  青ざめ: "Pale Face",
  顔影: "Face Shadow",
  闇: "Dark Face",
});

const CATEGORY_RULES = Object.freeze({
  eyes: [
    /まばたき|瞬き|ウィンク|笑い|なごみ|じと目|細目|びっくり|驚き|見開き|瞳|虹彩|ハイライト|眼|目/,
    /\b(?:eye|eyes|blink|wink|pupil|iris|squint|wide|highlight|eyelid|lash)\b/i,
  ],
  mouth: [
    /^(?:あ|い|う|え|お|ア|イ|ウ|エ|オ)$/,
    /口|口角|にやり|への字|舌|牙|歯|唇/,
    /\b(?:mouth|lip|tongue|fang|teeth|smile|frown|phoneme|viseme|vowel|jaw)\b/i,
  ],
  brow: [
    /眉|真面目|困る|怒り|怒る/,
    /\b(?:brow|eyebrow|angry brow|sad brow|raised brow)\b/i,
  ],
  other: [
    /涙|泣|赤面|照れ|頬|汗|青ざめ|顔影|闇|血|影/,
    /\b(?:blush|tears?|sweat|cheek|face shadow|dark face|crying|embarrass|material effect|accessory effect)\b/i,
  ],
});

function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalized(value) {
  return normalizePerformanceName(String(value || "").normalize("NFKC"));
}

function typeName(type) {
  return MORPH_TYPE_NAMES[type] || `unknown-${type}`;
}

function nameSide(text) {
  const value = String(text || "").normalize("NFKC");
  const left = /左|(^|[^a-z])left([^a-z]|$)|(?:^|[_ .-])l(?:$|[_ .-])/i.test(value);
  const right = /右|(^|[^a-z])right([^a-z]|$)|(?:^|[_ .-])r(?:$|[_ .-])/i.test(value);
  if (left && !right) return "left";
  if (right && !left) return "right";
  return "bilateral";
}

function fallbackCategory(text) {
  for (const category of MORPH_CATEGORIES) {
    if (CATEGORY_RULES[category].some((rule) => rule.test(text))) return category;
  }
  return "other";
}

function fallbackClassification(text) {
  for (const category of MORPH_CATEGORIES) {
    if (CATEGORY_RULES[category].some((rule) => rule.test(text))) return { category, matched: true };
  }
  return { category: "other", matched: false };
}

function exactFriendlyLabel(name, englishName) {
  const source = String(name || "").replace(/[0-9０-９]+$/u, "");
  if (FRIENDLY_LABELS[name]) return FRIENDLY_LABELS[name];
  if (FRIENDLY_LABELS[source]) return FRIENDLY_LABELS[source];
  const english = String(englishName || "").trim();
  return english && !/^fac[_ .-]/i.test(english) ? english : "";
}

function dictionaryNamesByIndex(mesh, count) {
  const names = new Array(count).fill("");
  const attributes = mesh?.geometry?.morphAttributes?.position || [];
  for (let i = 0; i < Math.min(count, attributes.length); i++) {
    if (attributes[i]?.name) names[i] = String(attributes[i].name);
  }
  for (const [name, index] of Object.entries(mesh?.morphTargetDictionary || {})) {
    if (Number.isInteger(index) && index >= 0 && index < count && !names[index]) names[index] = name;
  }
  return names;
}

function categoryFromNative(format, morph, index) {
  if (format === "pmx") {
    const panel = Number(morph?.panel);
    if (PMX_PANEL_CATEGORY[panel]) return { category: PMX_PANEL_CATEGORY[panel], confidence: 1, source: "pmx-panel" };
    if (panel === 0) return { category: "system", confidence: 1, source: "pmx-panel" };
    return null;
  }
  if (format === "pmd") {
    const panel = Number(morph?.pmdCategory ?? morph?.panel);
    if (index === 0 || panel === 0) return { category: "system", confidence: 1, source: "pmd-category" };
    if (PMD_CATEGORY[panel]) return { category: PMD_CATEGORY[panel], confidence: 0.98, source: "pmd-category" };
  }
  return null;
}

function safeElements(morph) {
  return Array.isArray(morph?.elements) ? morph.elements : [];
}

export class ModelMorphRegistry {
  constructor(mesh, options = {}) {
    this.mesh = mesh;
    this.fingerprint = options.fingerprint || createPerformanceRigFingerprint(mesh);
    this.format = String(mesh?.geometry?.userData?.MMD?.format || "unknown").toLowerCase();
    this.listeners = new Set();
    this.settings = {
      categories: {},
      labels: {},
      favorites: {},
      hidden: {},
      limits: {},
      quickSets: {},
      ...(clone(options.settings) || {}),
    };
    for (const key of ["categories", "labels", "favorites", "hidden", "limits", "quickSets"]) {
      if (!this.settings[key] || typeof this.settings[key] !== "object") this.settings[key] = {};
    }
    this.records = [];
    this.byIndex = new Map();
    this.byName = new Map();
    this.scanWarnings = [];
    this.scan();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(reason, record = null) {
    for (const listener of this.listeners) {
      try { listener(reason, record, this); } catch (_) {}
    }
  }

  scan() {
    this.records.length = 0;
    this.byIndex.clear();
    this.byName.clear();
    this.scanWarnings.length = 0;
    const mmd = this.mesh?.geometry?.userData?.MMD || {};
    const metadata = Array.isArray(mmd.morphs) ? mmd.morphs : [];
    const influences = this.mesh?.morphTargetInfluences || [];
    const dictionary = this.mesh?.morphTargetDictionary || {};
    const attributes = this.mesh?.geometry?.morphAttributes?.position || [];
    const maxDictionaryIndex = Math.max(-1, ...Object.values(dictionary).filter(Number.isInteger));
    const count = Math.max(metadata.length, influences.length, attributes.length, maxDictionaryIndex + 1);
    const namesByIndex = dictionaryNamesByIndex(this.mesh, count);
    const duplicateCounts = new Map();
    for (let index = 0; index < count; index++) {
      const morph = metadata[index] || {};
      const originalName = String(morph.name ?? namesByIndex[index] ?? "");
      if (originalName) duplicateCounts.set(originalName, (duplicateCounts.get(originalName) || 0) + 1);
    }
    for (let index = 0; index < count; index++) {
      const morph = metadata[index] || {};
      const originalName = String(morph.name ?? namesByIndex[index] ?? "");
      const englishName = String(morph.englishName || "");
      const native = categoryFromNative(this.format, morph, index);
      const searchText = `${originalName} ${englishName} ${normalized(originalName)} ${normalized(englishName)}`;
      const fallback = fallbackClassification(searchText);
      const inferred = fallback.category;
      const userCategory = this.settings.categories[index];
      let category = userCategory || native?.category || inferred || "other";
      if (!MORPH_CATEGORIES.includes(category) && category !== "hidden" && category !== "system") category = "other";
      const type = Number.isInteger(Number(morph.type)) ? Number(morph.type) : 1;
      const elements = safeElements(morph);
      const dictionaryKey = Object.entries(dictionary).find(([, value]) => value === index)?.[0] || "";
      const targetInfluenceIndex = index < influences.length ? index : (Number.isInteger(dictionary[originalName]) ? dictionary[originalName] : -1);
      const warnings = [];
      if (!originalName) warnings.push("Blank morph name.");
      if ((duplicateCounts.get(originalName) || 0) > 1 && originalName) warnings.push("Duplicate morph name — bound by index.");
      if (!native && !userCategory && !fallback.matched) warnings.push("Unclassified — placed in Other.");
      if (this.format === "pmx" && ![0, 1, 2, 3, 4].includes(Number(morph.panel))) warnings.push("Missing or invalid PMX panel metadata.");
      const runtimeSupported = this.format === "pmd"
        ? index > 0 && targetInfluenceIndex >= 0
        : type === 1 && targetInfluenceIndex >= 0;
      if (!runtimeSupported && type !== 0) warnings.push(`${typeName(type)} morph is not evaluated by the current Three.js MMD renderer.`);
      const record = {
        index,
        name: originalName,
        originalName,
        englishName,
        displayLabel: String(this.settings.labels[index] || exactFriendlyLabel(originalName, englishName) || ""),
        normalizedName: normalized(originalName),
        panel: category,
        category,
        nativeCategory: native?.category || null,
        categorySource: userCategory ? "user-override" : (native?.source || (fallback.matched ? "name-alias" : "fallback")),
        pmxPanelValue: this.format === "pmx" ? Number(morph.panel) : null,
        pmdCategoryValue: this.format === "pmd" ? Number(morph.pmdCategory ?? morph.panel) : null,
        type,
        typeName: typeName(type),
        dictionaryKey,
        targetInfluenceIndex,
        isFacial: category !== "system",
        isHidden: category === "hidden" || !!this.settings.hidden[index],
        isSystem: category === "system",
        isGroup: type === 0,
        confidence: userCategory ? 1 : (native?.confidence ?? (fallback.matched ? 0.76 : 0.2)),
        semanticTags: [...new Set([category, typeName(type), normalized(originalName), normalized(englishName)].filter(Boolean))],
        userOverride: userCategory || null,
        favorite: !!this.settings.favorites[index],
        defaultValue: 0,
        minValue: Number(this.settings.limits[index]?.min ?? 0),
        maxValue: Number(this.settings.limits[index]?.max ?? 1),
        exportCompatible: targetInfluenceIndex >= 0 && !!originalName,
        runtimeSupported,
        groupReferences: type === 0 ? elements.map((element) => ({ index: Number(element.index), ratio: Number(element.ratio) || 0 })) : [],
        affectedVertexCount: [1, 3, 4, 5, 6, 7].includes(type) ? Number(morph.elementCount || elements.length) : 0,
        affectedBoneCount: type === 2 ? new Set(elements.map((element) => element.index)).size : 0,
        affectedMaterialCount: type === 8 ? new Set(elements.map((element) => element.index)).size : 0,
        side: nameSide(`${originalName} ${englishName}`),
        warnings,
        geometryAnalysis: null,
        rawMetadata: morph,
      };
      if (record.maxValue < record.minValue) [record.minValue, record.maxValue] = [record.maxValue, record.minValue];
      this.records.push(record);
      this.byIndex.set(index, record);
      const key = record.normalizedName;
      if (key) {
        if (!this.byName.has(key)) this.byName.set(key, []);
        this.byName.get(key).push(record);
      }
    }
    this._resolveGroups();
    this._analyzeTargetNames(mmd);
    return this;
  }

  _resolveGroups() {
    const visit = (record, path = new Set()) => {
      if (!record?.isGroup) return { supported: !!record?.runtimeSupported, categories: [] };
      if (path.has(record.index)) {
        record.warnings.push("Cyclic group morph reference.");
        return { supported: false, categories: [] };
      }
      const nextPath = new Set(path);
      nextPath.add(record.index);
      const categories = [];
      let supported = record.groupReferences.length > 0;
      for (const child of record.groupReferences) {
        const childRecord = this.byIndex.get(child.index);
        if (!childRecord) {
          record.warnings.push(`Invalid group reference: #${child.index}.`);
          supported = false;
          continue;
        }
        const result = visit(childRecord, nextPath);
        supported = supported && result.supported;
        categories.push({ category: childRecord.category, weight: Math.abs(child.ratio) });
        categories.push(...result.categories.map((item) => ({ category: item.category, weight: item.weight * Math.abs(child.ratio) })));
      }
      record.runtimeSupported = supported;
      if (!supported && !record.warnings.some((warning) => warning.includes("current Three.js"))) {
        record.warnings.push("Group contains targets unsupported by the current Three.js MMD renderer.");
      }
      if (!record.nativeCategory && !record.userOverride && categories.length) {
        const totals = new Map();
        for (const item of categories) if (MORPH_CATEGORIES.includes(item.category)) totals.set(item.category, (totals.get(item.category) || 0) + item.weight);
        const ranked = [...totals].sort((a, b) => b[1] - a[1]);
        if (ranked.length && (!ranked[1] || ranked[0][1] > ranked[1][1] * 1.35)) {
          record.category = record.panel = ranked[0][0];
          record.categorySource = "group-analysis";
          record.confidence = 0.68;
        }
      }
      return { supported, categories };
    };
    for (const record of this.records) if (record.isGroup) visit(record);
  }

  _analyzeTargetNames(mmd) {
    const materials = Array.isArray(mmd.materials) ? mmd.materials : [];
    const bones = Array.isArray(mmd.bones) ? mmd.bones : [];
    for (const record of this.records) {
      if (record.nativeCategory || record.userOverride || record.confidence >= 0.7) continue;
      const elements = safeElements(record.rawMetadata);
      let targetText = "";
      if (record.type === 8) {
        targetText = elements.map((element) => {
          if (element.index === -1) return "all materials";
          const material = materials[element.index];
          return `${material?.name || ""} ${material?.englishName || ""}`;
        }).join(" ");
      } else if (record.type === 2) {
        targetText = elements.map((element) => bones[element.index]?.name || "").join(" ");
      }
      if (!targetText) continue;
      const category = fallbackCategory(targetText);
      if (category !== "other") {
        record.category = record.panel = category;
        record.categorySource = record.type === 8 ? "material-analysis" : "bone-analysis";
        record.confidence = 0.58;
        record.semanticTags.push(normalized(targetText));
      }
    }
  }

  analyzeGeometry(index) {
    const record = this.get(index);
    if (!record || record.geometryAnalysis) return record?.geometryAnalysis || null;
    const base = this.mesh?.geometry?.attributes?.position;
    const target = this.mesh?.geometry?.morphAttributes?.position?.[record.targetInfluenceIndex];
    if (!base || !target || base.count !== target.count) return null;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let affected = 0, displacement = 0;
    const modelBox = { minY: Infinity, maxY: -Infinity, minX: Infinity, maxX: -Infinity };
    for (let i = 0; i < base.count; i++) {
      const x = base.getX(i), y = base.getY(i);
      modelBox.minX = Math.min(modelBox.minX, x); modelBox.maxX = Math.max(modelBox.maxX, x);
      modelBox.minY = Math.min(modelBox.minY, y); modelBox.maxY = Math.max(modelBox.maxY, y);
      const dx = target.getX(i) - x, dy = target.getY(i) - y, dz = target.getZ(i) - base.getZ(i);
      const length = Math.hypot(dx, dy, dz);
      if (length <= 1e-7) continue;
      affected++; displacement += length;
      minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, base.getZ(i));
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, base.getZ(i));
    }
    if (!affected) return null;
    const centerX = (minX + maxX) * 0.5;
    const modelCenterX = (modelBox.minX + modelBox.maxX) * 0.5;
    const width = Math.max(1e-6, modelBox.maxX - modelBox.minX);
    const height = Math.max(1e-6, modelBox.maxY - modelBox.minY);
    const normalizedY = ((minY + maxY) * 0.5 - modelBox.minY) / height;
    record.geometryAnalysis = {
      affectedVertexCount: affected,
      boundingBox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
      averageDisplacement: displacement / affected,
      likelyFaceRegion: normalizedY > 0.68,
      side: Math.abs(centerX - modelCenterX) < width * 0.08 ? "bilateral" : centerX < modelCenterX ? "left" : "right",
    };
    record.affectedVertexCount = affected;
    if (!record.nativeCategory && !record.userOverride && record.geometryAnalysis.likelyFaceRegion && record.confidence < 0.5) {
      const faceY = (normalizedY - 0.68) / 0.32;
      record.category = record.panel = faceY > 0.68 ? "brow" : faceY > 0.38 ? "eyes" : "mouth";
      record.categorySource = "geometry-analysis";
      record.confidence = 0.44;
    }
    return record.geometryAnalysis;
  }

  get(index) { return this.byIndex.get(Number(index)) || null; }
  all() { return this.records.slice(); }
  visible(category = null) {
    return this.records.filter((record) => !record.isHidden && !record.isSystem && (!category || record.category === category));
  }
  favorites() { return this.visible().filter((record) => record.favorite); }
  currentValue(index) {
    const record = this.get(index);
    return record && record.targetInfluenceIndex >= 0 ? Number(this.mesh?.morphTargetInfluences?.[record.targetInfluenceIndex]) || 0 : 0;
  }
  label(recordOrIndex) {
    const record = typeof recordOrIndex === "object" ? recordOrIndex : this.get(recordOrIndex);
    if (!record) return "";
    const duplicate = (this.byName.get(record.normalizedName)?.length || 0) > 1;
    return `${record.originalName || "Unnamed Morph"}${record.displayLabel ? ` / ${record.displayLabel}` : ""}${duplicate ? ` [${record.typeName} #${record.index}]` : ""}`;
  }
  search(query = "", filters = {}) {
    const needle = normalized(query);
    return this.records.filter((record) => {
      if (!filters.includeSystem && record.isSystem) return false;
      if (!filters.includeHidden && record.isHidden) return false;
      if (filters.category && record.category !== filters.category) return false;
      if (filters.type && record.typeName !== filters.type) return false;
      if (filters.favorites && !record.favorite) return false;
      if (filters.active && Math.abs(this.currentValue(record.index)) < 1e-6) return false;
      if (filters.animated && !filters.animated.has?.(record.index)) return false;
      if (filters.unknown && record.confidence >= 0.5) return false;
      if (filters.nonExportable && record.exportCompatible) return false;
      if (!needle) return true;
      return [record.originalName, record.englishName, record.displayLabel, ...record.semanticTags]
        .some((value) => normalized(value).includes(needle));
    });
  }
  resolveVmdName(name) {
    const matches = this.byName.get(normalized(name)) || [];
    return { record: matches[0] || null, matches: matches.slice(), ambiguous: matches.length > 1 };
  }
  groupChildren(index) {
    const record = this.get(index);
    if (!record?.isGroup) return [];
    return record.groupReferences.map((reference) => ({ ...reference, record: this.get(reference.index) })).filter((item) => item.record);
  }

  _setMapValue(mapName, index, value) {
    const record = this.get(index);
    if (!record) return false;
    if (value == null || value === false || value === "") delete this.settings[mapName][record.index];
    else this.settings[mapName][record.index] = value;
    this.scan();
    this._emit(mapName, this.get(index));
    return true;
  }
  setCategory(index, category) {
    if (![...MORPH_CATEGORIES, "hidden", "system", ""].includes(category)) return false;
    return this._setMapValue("categories", index, category);
  }
  setLabel(index, label) { return this._setMapValue("labels", index, String(label || "").trim()); }
  setFavorite(index, favorite) { return this._setMapValue("favorites", index, !!favorite); }
  setHidden(index, hidden) { return this._setMapValue("hidden", index, !!hidden); }
  setLimits(index, min, max) {
    min = Number(min); max = Number(max);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return false;
    return this._setMapValue("limits", index, { min: Math.min(min, max), max: Math.max(min, max) });
  }
  setQuickSet(name, indices) {
    const key = String(name || "").trim();
    if (!key) return false;
    this.settings.quickSets[key] = [...new Set((indices || []).map(Number).filter((index) => this.byIndex.has(index)))];
    this._emit("quickSets");
    return true;
  }

  toJSON() {
    return {
      version: 1,
      fingerprint: this.fingerprint,
      settings: clone(this.settings),
    };
  }
  restore(data) {
    if (!data || (data.fingerprint && data.fingerprint !== this.fingerprint)) return false;
    const incoming = data.settings || data;
    for (const key of ["categories", "labels", "favorites", "hidden", "limits", "quickSets"]) {
      if (incoming?.[key] && typeof incoming[key] === "object") this.settings[key] = clone(incoming[key]);
    }
    this.scan();
    this._emit("restore");
    return true;
  }

  diagnostics() {
    const byCategory = Object.fromEntries([...MORPH_CATEGORIES, "system", "hidden"].map((category) => [category, 0]));
    const byType = {};
    let supported = 0, exportable = 0, warnings = 0;
    for (const record of this.records) {
      byCategory[record.category] = (byCategory[record.category] || 0) + 1;
      byType[record.typeName] = (byType[record.typeName] || 0) + 1;
      if (record.runtimeSupported) supported++;
      if (record.exportCompatible) exportable++;
      warnings += record.warnings.length;
    }
    return { count: this.records.length, byCategory, byType, supported, exportable, warnings, scanWarnings: this.scanWarnings.slice() };
  }
}
