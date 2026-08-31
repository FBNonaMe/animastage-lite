const SMALL_KANA = Object.freeze({
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
  "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "っ": "つ",
});

const ROMAJI_REPLACEMENTS = Object.freeze([
  [/oyayubi|oya_yubi/g, "thumb"],
  [/hitosashiyubi|hitosashi_yubi|hito_yubi/g, "index"],
  [/nakayubi|naka_yubi/g, "middle"],
  [/kusuriyubi|kusuri_yubi/g, "ring"],
  [/koyubi|ko_yubi|pinky/g, "little"],
  [/tekubi|te_kubi/g, "wrist"],
  [/mabataki/g, "blink"],
  [/wink(u)?/g, "wink"],
  [/mayu/g, "brow"],
]);

/** Normalize human-authored PMX names without discarding Japanese characters. */
export function normalizePerformanceName(value) {
  let text = String(value ?? "").normalize("NFKC").trim();
  text = text.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  text = text.replace(/[ぁぃぅぇぉゃゅょっ]/g, (c) => SMALL_KANA[c] || c);
  text = text.replace(/[\s\-.:/\\|()[\]{}]+/g, "_");
  text = text.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  for (const [pattern, replacement] of ROMAJI_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function compactPerformanceName(value) {
  return normalizePerformanceName(value).replace(/_/g, "");
}

export function classifyNameSide(value) {
  const raw = String(value ?? "").normalize("NFKC");
  const n = normalizePerformanceName(raw);
  const left = /左/.test(raw)
    || /(?:^|_)(?:l|left)(?:_|$)/i.test(n)
    || /(?:\.l|_l|left)$/i.test(raw);
  const right = /右/.test(raw)
    || /(?:^|_)(?:r|right)(?:_|$)/i.test(n)
    || /(?:\.r|_r|right)$/i.test(raw);
  if (left !== right) return left ? "left" : "right";
  return null;
}

export function stripSideTokens(value) {
  return normalizePerformanceName(value)
    .replace(/左|右/g, "")
    .replace(/(?:^|_)(?:left|right|l|r)(?=_|$)/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function detectFingerName(value) {
  const raw = String(value ?? "").normalize("NFKC");
  const n = compactPerformanceName(raw);
  if (/親指|拇指/.test(raw) || /(thumb|oyayubi)/i.test(n)) return "thumb";
  if (/人差指|人指|示指/.test(raw) || /(index|forefinger|hitosashi)/i.test(n)) return "index";
  if (/中指/.test(raw) || /(middle|nakayubi)/i.test(n)) return "middle";
  if (/薬指|藥指/.test(raw) || /(ring|kusuriyubi)/i.test(n)) return "ring";
  if (/小指/.test(raw) || /(little|pinky|pinkie|koyubi)/i.test(n)) return "little";
  return null;
}

export function detectJointOrdinal(value) {
  const raw = String(value ?? "").normalize("NFKC");
  const n = normalizePerformanceName(raw);
  if (/(?:proximal|metacarpal|根元|付根|基節)/i.test(raw + "_" + n)) return 0;
  if (/(?:intermediate|middle|中節)/i.test(raw + "_" + n)) return 1;
  if (/(?:distal|tip|末節|先)/i.test(raw + "_" + n)) return 2;
  const matches = [...n.matchAll(/(?:^|_)([0-4])(?:_|$)/g)];
  if (matches.length) {
    const valueNumber = Number(matches[matches.length - 1][1]);
    return Math.max(0, valueNumber - (valueNumber > 0 ? 1 : 0));
  }
  const jp = raw.match(/[０-４0-4一二三四]$/);
  if (!jp) return null;
  const table = { "０": 0, "0": 0, "一": 0, "１": 0, "1": 0, "二": 1, "２": 1, "2": 1, "三": 2, "３": 2, "3": 2, "四": 3, "４": 3, "4": 3 };
  return table[jp[0]] ?? null;
}
