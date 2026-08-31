import { FINGER_NAMES, HAND_SIDES, clamp01, clampSigned } from "./PerformanceConstants.js";

const MASTER_KEYS = ["curl", "spread", "relax", "tension", "cup", "fan", "thumbOpposition", "thumbCurl", "palmArch", "wristBend", "wristTwist", "wristSideBend"];

export function createDefaultHandState() {
  const state = { symmetry: true, hands: {} };
  for (const side of HAND_SIDES) {
    const hand = { master: {}, fingers: {} };
    for (const key of MASTER_KEYS) hand.master[key] = 0;
    hand.master.relax = 0.18;
    for (const digit of FINGER_NAMES) {
      hand.fingers[digit] = { curl: 0, spread: 0, twist: 0, proximal: 0, middle: 0, distal: 0 };
    }
    state.hands[side] = hand;
  }
  return state;
}

function pose(master = {}, fingers = {}) { return { master, fingers }; }

export const BUILTIN_HAND_PRESETS = Object.freeze({
  relaxed: pose({ relax: 0.32, curl: 0.06 }, { middle: { curl: 0.05 }, ring: { curl: 0.1 }, little: { curl: 0.16 } }),
  open_palm: pose({ relax: 0, curl: 0, spread: 0.22, tension: 0.25, fan: 0.2 }, { thumb: { spread: 0.25 } }),
  fist: pose({ curl: 0.92, tension: 0.72, cup: 0.34, thumbOpposition: 0.55, thumbCurl: 0.5 }),
  pointing: pose({ relax: 0.04, tension: 0.35 }, { thumb: { curl: 0.45 }, index: { curl: 0 }, middle: { curl: 0.92 }, ring: { curl: 0.95 }, little: { curl: 0.94 } }),
  peace_sign: pose({ relax: 0.02, spread: 0.08, tension: 0.28 }, { thumb: { curl: 0.55 }, index: { curl: 0, spread: 0.24 }, middle: { curl: 0, spread: -0.12 }, ring: { curl: 0.92 }, little: { curl: 0.94 } }),
  thumbs_up: pose({ relax: 0.02, curl: 0.88, tension: 0.45, thumbOpposition: -0.25 }, { thumb: { curl: -0.75, spread: 0.25 } }),
  thumbs_down: pose({ relax: 0.02, curl: 0.88, tension: 0.45, wristTwist: 0.35 }, { thumb: { curl: -0.7, spread: -0.2 } }),
  pinch: pose({ relax: 0.08, tension: 0.32, thumbOpposition: 0.78 }, { thumb: { curl: 0.38 }, index: { curl: 0.42 }, middle: { curl: 0.18 }, ring: { curl: 0.25 }, little: { curl: 0.32 } }),
  holding_phone: pose({ curl: 0.48, relax: 0.08, tension: 0.25, cup: 0.28, thumbOpposition: 0.38 }, { index: { curl: 0.22 }, little: { curl: 0.58 } }),
  holding_sword: pose({ curl: 0.78, relax: 0, tension: 0.62, cup: 0.24, thumbOpposition: 0.48 }),
  holding_microphone: pose({ curl: 0.68, relax: 0.03, tension: 0.42, cup: 0.38, thumbOpposition: 0.52, fan: -0.08 }),
  holding_cup: pose({ curl: 0.48, relax: 0.08, cup: 0.52, fan: 0.05, thumbOpposition: 0.62 }, { index: { curl: 0.3 }, little: { curl: 0.62 } }),
  typing: pose({ relax: 0.2, curl: 0.18, spread: 0.08, tension: 0.16, wristBend: 0.08 }, { index: { curl: 0.1 }, middle: { curl: 0.18 }, ring: { curl: 0.3 }, little: { curl: 0.38 } }),
  nervous_clasp: pose({ relax: 0.14, curl: 0.42, tension: 0.58, cup: 0.2, fan: -0.08 }, { little: { curl: 0.18 }, index: { twist: 0.08 } }),
  praying: pose({ relax: 0.04, curl: 0.02, tension: 0.3, spread: -0.04, fan: -0.15 }),
  heart_gesture: pose({ relax: 0.05, curl: 0.42, tension: 0.24, cup: 0.18, thumbOpposition: 0.58 }, { index: { curl: 0.12, spread: -0.2 }, middle: { curl: 0.72 }, ring: { curl: 0.82 }, little: { curl: 0.88 } }),
  anime_pose: pose({ relax: 0.08, curl: 0.12, spread: 0.18, fan: 0.24, wristSideBend: 0.18, tension: 0.2 }, { thumb: { curl: 0.28 }, little: { curl: 0.42 } }),
});

export class HandPresetLibrary {
  constructor(custom = {}) { this.custom = { ...custom }; }

  names() { return [...Object.keys(BUILTIN_HAND_PRESETS), ...Object.keys(this.custom)]; }
  get(name) { return this.custom[name] || BUILTIN_HAND_PRESETS[name] || null; }

  save(name, semanticPose) {
    const safe = String(name || "").trim().replace(/[^\p{L}\p{N}_ -]+/gu, "").slice(0, 64);
    if (!safe || !semanticPose) return false;
    this.custom[safe] = sanitizePose(semanticPose);
    return true;
  }

  remove(name) { if (!(name in this.custom)) return false; delete this.custom[name]; return true; }
  toJSON() { return { ...this.custom }; }
  restore(data) { this.custom = data && typeof data === "object" ? { ...data } : {}; }
}

function sanitizePose(input) {
  const output = { master: {}, fingers: {} };
  for (const key of MASTER_KEYS) {
    if (!(key in (input.master || {}))) continue;
    output.master[key] = key === "curl" || key === "relax" || key === "tension" || key === "cup" || key === "thumbCurl" || key === "palmArch"
      ? clamp01(Number(input.master[key])) : clampSigned(Number(input.master[key]));
  }
  for (const digit of FINGER_NAMES) {
    const source = input.fingers?.[digit];
    if (!source) continue;
    output.fingers[digit] = {};
    for (const key of ["curl", "spread", "twist", "proximal", "middle", "distal"]) {
      if (key in source) output.fingers[digit][key] = clampSigned(Number(source[key]));
    }
  }
  return output;
}

export { MASTER_KEYS };

