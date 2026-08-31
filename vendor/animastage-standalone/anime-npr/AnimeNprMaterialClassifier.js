/*
 * Confidence-scored material classifier for the AnimeStage Star Rail NPR port.
 * Uses PMX/PMD metadata, texture names and conservative material properties.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const AnimeNprCategory = Object.freeze({
    GENERIC: 0,
    FACE: 1,
    SKIN: 2,
    HAIR: 3,
    FRONT_HAIR: 4,
    EYES: 5,
    EYE_HIGHLIGHT: 6,
    EYEBROWS: 7,
    EYELASHES: 8,
    MOUTH: 9,
    CLOTH: 10,
    STOCKINGS: 11,
    METAL: 12,
    GLASS: 13,
    ACCESSORY: 14,
    EMISSIVE: 15,
});

export const AnimeNprCategoryLabel = Object.freeze([
    "Generic",
    "Face",
    "Skin",
    "Hair",
    "Front Hair",
    "Eyes",
    "Eye Highlight",
    "Eyebrows",
    "Eyelashes",
    "Mouth",
    "Cloth",
    "Stockings",
    "Metal",
    "Glass",
    "Accessory",
    "Emissive",
]);

// Specific categories intentionally come before broad categories. Token length
// and field quality still decide the result, so e.g. 眼鏡 beats the single 眼
// eye token and 髪飾り beats the single 髪 hair token.
const RULES = Object.freeze([
    {
        category: AnimeNprCategory.FRONT_HAIR,
        tokens: [
            "前髪", "前发", "前髮", "前发丝", "앞머리",
            "front hair", "fronthair", "front_hair", "hair_front",
            "bangs", "fringe", "maegami",
        ],
    },
    {
        category: AnimeNprCategory.EYE_HIGHLIGHT,
        tokens: [
            "目ハイライト", "瞳ハイライト", "目ハイ", "瞳ハイ",
            "目hl", "瞳hl", "眼hl", "目 hl", "瞳 hl", "眼 hl",
            "目光", "眼神光", "高光", "눈 하이라이트",
            "eye highlight", "eyehighlight", "eye_highlight", "catchlight",
            "eye light", "eyelight", "highlight eye",
        ],
    },
    {
        category: AnimeNprCategory.EYELASHES,
        tokens: [
            "まつげ", "睫毛", "睫眉", "睫", "속눈썹", "eyelashes", "eyelash",
            "eye lash", "matsuge",
        ],
    },
    {
        category: AnimeNprCategory.EYEBROWS,
        tokens: [
            "眉毛", "眉", "눈썹", "eyebrows", "eyebrow", "eye brow", "brow", "mayu",
        ],
    },
    {
        category: AnimeNprCategory.MOUTH,
        tokens: [
            "口内", "口", "嘴", "唇", "歯", "牙", "舌", "입", "이빨",
            "mouth", "lips", "lip", "teeth", "tooth", "tongue", "kuchi",
        ],
    },
    {
        category: AnimeNprCategory.EYES,
        tokens: [
            "白目", "目白", "眼白", "目影", "眼影", "黒目", "瞳", "虹彩", "目", "眼", "눈",
            "eyes", "eye", "iris", "pupil", "sclera", "hitomi", "sirome",
        ],
    },
    {
        category: AnimeNprCategory.FACE,
        tokens: [
            "顔", "脸", "臉", "面部", "얼굴",
            "face", "facial", "cheek", "kao",
        ],
    },
    {
        category: AnimeNprCategory.STOCKINGS,
        tokens: [
            "ストッキング", "タイツ", "ニーハイ", "靴下", "袜", "襪", "스타킹",
            "stockings", "stocking", "tights", "pantyhose", "socks", "sock",
            "kneehigh", "knee high",
        ],
    },
    {
        category: AnimeNprCategory.ACCESSORY,
        tokens: [
            "髪飾り", "发饰", "髮飾", "装飾", "飾り", "饰品", "飾品", "アクセサリ",
            "accessory", "accessories", "ornament", "decoration", "earring",
            "jewel", "jewelry", "hairpin", "hair clip", "ribbon accessory",
        ],
    },
    {
        category: AnimeNprCategory.GLASS,
        tokens: [
            "眼鏡", "メガネ", "ガラス", "透明", "玻璃", "镜片", "鏡片", "유리",
            "glasses", "glass", "lens", "visor", "transparent", "window",
        ],
    },
    {
        category: AnimeNprCategory.HAIR,
        tokens: [
            "後髪", "後ろ髪", "横髪", "髪影", "发影", "髮影", "髪", "发", "髮", "头发", "頭髮", "ヘア", "머리카락",
            "hair", "ponytail", "twintail", "twin tail", "pigtail", "kami",
        ],
    },
    {
        category: AnimeNprCategory.METAL,
        tokens: [
            "金属", "金屬", "メタル", "金具", "금속",
            "metal", "metallic", "armor", "armour", "weapon", "sword",
            "chain", "buckle", "zipper", "zip",
        ],
    },
    {
        category: AnimeNprCategory.EMISSIVE,
        tokens: [
            "発光", "發光", "发光", "光る", "自发光", "自發光", "발광",
            "emissive", "emission", "glow", "luminous", "light effect",
        ],
    },
    {
        category: AnimeNprCategory.CLOTH,
        tokens: [
            "服", "衣装", "衣服", "裙", "スカート", "シャツ", "コート", "옷",
            "cloth", "clothes", "clothing", "dress", "skirt", "shirt",
            "jacket", "coat", "sleeve", "pants", "trousers", "shoe", "boots",
        ],
    },
    {
        category: AnimeNprCategory.SKIN,
        tokens: [
            "肌", "皮膚", "皮肤", "素体", "身体", "피부",
            "skin", "body", "hada", "neck", "hand", "arm", "leg",
        ],
    },
]);

const MIN_CONFIDENCE = Object.freeze({
    [AnimeNprCategory.FACE]: 0.78,
    [AnimeNprCategory.EYES]: 0.74,
    [AnimeNprCategory.EYE_HIGHLIGHT]: 0.76,
    [AnimeNprCategory.EYEBROWS]: 0.72,
    [AnimeNprCategory.EYELASHES]: 0.72,
    [AnimeNprCategory.MOUTH]: 0.72,
    [AnimeNprCategory.FRONT_HAIR]: 0.74,
    [AnimeNprCategory.GLASS]: 0.70,
    default: 0.68,
});

const normalizeText = (value) =>
    String(value || "")
        .normalize("NFKC")
        .replace(/\\/g, "/")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLocaleLowerCase()
        .replace(/\.[a-z0-9]{2,5}(?=$|[?#])/g, " ")
        .replace(/[_./()[\]{}+\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const isCjkToken = (token) =>
    /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(token);

const includesToken = (text, token) => {
    const normalizedToken = normalizeText(token);
    if (!normalizedToken || !text) return false;
    if (isCjkToken(normalizedToken)) return text.includes(normalizedToken);
    return ` ${text} `.includes(` ${normalizedToken} `);
};

const tokenSpecificity = (token) => {
    const compact = normalizeText(token).replace(/\s/g, "");
    if (isCjkToken(compact)) {
        if (compact.length >= 3) return 1;
        if (compact.length === 2) return 0.94;
        return 0.80;
    }
    if (compact.length >= 8) return 1;
    if (compact.length >= 5) return 0.94;
    if (compact.length >= 3) return 0.86;
    return 0.76;
};

const isMmdAmbientMaterial = (material) =>
    material?.isMMDToonMaterial === true || material?.type === "MMDToonMaterial";

const hasVisibleEmission = (material) => {
    const color = material?.emissive;
    const energy = color?.isColor
        ? Math.max(Number(color.r) || 0, Number(color.g) || 0, Number(color.b) || 0)
        : 0;
    return (Number(material?.emissiveIntensity) || 0) > 0.05 && energy > 0.001;
};

const addField = (fields, kind, value, weight) => {
    const text = normalizeText(value);
    if (!text || fields.some((field) => field.kind === kind && field.text === text)) return;
    fields.push({ kind, text, weight });
};

const buildFields = (material, meshName, context = {}) => {
    const fields = [];
    addField(fields, "pmx-name", context.mmdName, 1.08);
    addField(fields, "material-name", material?.name, 1.04);
    addField(fields, "pmx-english-name", context.mmdEnglishName, 1.02);
    addField(fields, "pmx-texture", material?.userData?.MMD?.mapFileName, 0.94);
    addField(fields, "pmx-matcap", material?.userData?.MMD?.matcapFileName, 0.72);
    addField(fields, "texture-name", material?.map?.name, 0.90);
    addField(fields, "alpha-texture", material?.alphaMap?.name, 0.78);
    addField(fields, "toon-texture", material?.gradientMap?.name, 0.42);
    // A single-material skinned mesh commonly carries the semantic name in
    // the mesh. A monolithic MMD mesh does not: its mesh name would otherwise
    // contaminate every material with the same category.
    const meshWeight = context.allowMeshNameHints === true ? 0.96 : 0.18;
    addField(fields, "mesh-name", meshName, meshWeight);
    return fields;
};

const propertyCandidates = (material) => {
    const candidates = [];
    const opacity = Number(material?.opacity);
    if (
        material?.transparent === true &&
        Number.isFinite(opacity) &&
        opacity < 0.8
    ) {
        candidates.push({
            category: AnimeNprCategory.GLASS,
            score: Math.min(0.88, 0.70 + (0.8 - opacity) * 0.5),
            reason: `opacity:${opacity.toFixed(2)}`,
        });
    }
    if (!isMmdAmbientMaterial(material) && hasVisibleEmission(material)) {
        candidates.push({
            category: AnimeNprCategory.EMISSIVE,
            score: 0.82,
            reason: "authored-emission",
        });
    }
    const metalness = Number(material?.metalness) || 0;
    const envMapIntensity = Number(material?.envMapIntensity) || 0;
    if (metalness > 0.55 || envMapIntensity > 1.8) {
        candidates.push({
            category: AnimeNprCategory.METAL,
            score: Math.min(0.84, 0.70 + metalness * 0.16),
            reason: "metal-response",
        });
    }
    return candidates;
};

const categoryThreshold = (category) =>
    MIN_CONFIDENCE[category] ?? MIN_CONFIDENCE.default;

export class AnimeNprMaterialClassifier {
    explain(material, meshName = "", manualOverride, context = {}) {
        if (Number.isInteger(manualOverride)) {
            return {
                category: manualOverride,
                proposedCategory: manualOverride,
                confidence: 1,
                manual: true,
                safeFallback: false,
                reason: "manual-override",
                input: normalizeText(material?.name),
                candidates: [],
            };
        }

        const fields = buildFields(material, meshName, context);
        const scored = new Map();
        const record = (category, score, reason) => {
            const previous = scored.get(category);
            if (!previous || score > previous.score) {
                scored.set(category, { category, score, reason });
            }
        };

        for (const rule of RULES) {
            for (const field of fields) {
                for (const token of rule.tokens) {
                    if (!includesToken(field.text, token)) continue;
                    let score = field.weight * tokenSpecificity(token);
                    const y = Number(context.normalizedHeight);
                    if (Number.isFinite(y)) {
                        if (
                            y >= 0.68 &&
                            [
                                AnimeNprCategory.FACE,
                                AnimeNprCategory.EYES,
                                AnimeNprCategory.EYE_HIGHLIGHT,
                                AnimeNprCategory.EYEBROWS,
                                AnimeNprCategory.EYELASHES,
                                AnimeNprCategory.MOUTH,
                                AnimeNprCategory.HAIR,
                                AnimeNprCategory.FRONT_HAIR,
                            ].includes(rule.category)
                        ) {
                            score += 0.04;
                        }
                    }
                    record(
                        rule.category,
                        Math.min(1, Math.max(0, score)),
                        `${field.kind}:${normalizeText(token)}`,
                    );
                }
            }
        }

        for (const candidate of propertyCandidates(material)) {
            record(candidate.category, candidate.score, candidate.reason);
        }

        const candidates = [...scored.values()].sort((a, b) => b.score - a.score);
        const top = candidates[0];
        const second = candidates[1];
        if (!top) {
            return {
                category: AnimeNprCategory.GENERIC,
                proposedCategory: AnimeNprCategory.GENERIC,
                confidence: 0,
                manual: false,
                safeFallback: true,
                reason: "no-reliable-semantic-signal",
                input: fields.map((field) => field.text).join(" | "),
                candidates,
            };
        }

        const threshold = categoryThreshold(top.category);
        const margin = top.score - (second?.score || 0);
        const ambiguous = second && margin < 0.07 && top.score < 0.95;
        const accepted = top.score >= threshold && !ambiguous;
        return {
            category: accepted ? top.category : AnimeNprCategory.GENERIC,
            proposedCategory: top.category,
            confidence: Number(top.score.toFixed(3)),
            manual: false,
            safeFallback: !accepted,
            reason: accepted
                ? top.reason
                : ambiguous
                  ? `ambiguous:${top.reason}/${second.reason}`
                  : `low-confidence:${top.reason}`,
            input: fields.map((field) => field.text).join(" | "),
            candidates: candidates.slice(0, 4).map((candidate) => ({
                ...candidate,
                score: Number(candidate.score.toFixed(3)),
            })),
        };
    }

    classify(material, meshName = "", manualOverride, context = {}) {
        return this.explain(material, meshName, manualOverride, context).category;
    }
}

export function classifyNprMaterial(name = "") {
    return new AnimeNprMaterialClassifier().classify({ name });
}
