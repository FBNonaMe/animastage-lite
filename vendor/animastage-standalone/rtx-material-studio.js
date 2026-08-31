// rtx-material-studio.js
// Flexible per-material shader system ("Shader Studio") for BOTH pipelines:
//  - RTX: overrides live in material.userData.rtx, read by materialToRTX on
//    every scene build and on the fast repack (PatchRtxPass.updateMaterials).
//  - Raster: a MeshPhysicalMaterial "Figure PBR" variant per material
//    (clearcoat gloss, rim light, sheen skin), switchable against the
//    original MMD toon shaders at any time.
//
// Multi-model: every loaded model (girls, weapons, props) is registered and
// editable — pick the model in the dropdown, then its material.
// Per-model settings persist in localStorage (key: mmd_rtx_shader_<model>).

const STORAGE_PREFIX = "mmd_rtx_shader_";

export const SHADER_PRESETS = {
  default: { label: "Default (as loaded)", ov: null },
  "figure-pvc": {
    label: "Figure PVC ✨",
    ov: { coat: 0.8, coatRough: 0.06, rim: 0.18 },
  },
  latex: {
    label: "Latex / Gloss",
    ov: { coat: 1.0, coatRough: 0.02, rim: 0.12 },
  },
  "skin-soft": {
    label: "Skin (soft)",
    ov: { coat: 0.22, coatRough: 0.3, rim: 0.22, sss: 0.65 },
  },
  "hair-silk": {
    label: "Hair silk",
    ov: { coat: 0.5, coatRough: 0.18, rim: 0.3 },
  },
  satin: {
    label: "Satin / Stockings",
    ov: { coat: 0.4, coatRough: 0.35, rim: 0.15 },
  },
  matte: { label: "Matte cloth", ov: { coat: 0, rim: 0.08 } },
  metal: { label: "Metal", ov: { type: "metal", fuzz: 0.12 } },
  chrome: { label: "Chrome", ov: { type: "metal", fuzz: 0.02 } },
  glass: { label: "Glass", ov: { type: "glass" } },
  glow: { label: "Glow (emissive)", ov: { emitBoost: 3 } },
  // "MMD 2.0" — ray-MMD-style semi-realistic set: soft sheen fabric,
  // subsurface skin, silky hair, stronger cinematic rim.
  "skin-real": {
    label: "Skin 2.0 (real)",
    ov: { coat: 0.1, coatRough: 0.5, rim: 0.3, sss: 0.85 },
  },
  "cloth-soft": {
    label: "Cloth 2.0 (soft)",
    ov: { coat: 0.22, coatRough: 0.5, rim: 0.18, sss: 0.25 },
  },
  "hair-soft": {
    label: "Hair 2.0 (soft)",
    ov: { coat: 0.32, coatRough: 0.3, rim: 0.42 },
  },
};

// Auto-classification by material name — JP / EN / CN conventions.
export function classifyMaterialName(name) {
  const n = String(name || "");
  if (/目|瞳|eye|睛|白目|二重|まつげ|睫/i.test(n)) return "eye";
  if (/肌|skin|face|顔|肤|脸|hada|体(?!操)/i.test(n)) return "skin";
  if (/髪|hair|发|毛|ahoge|アホ毛|ツイン|ポニテ/i.test(n)) return "hair";
  if (/金属|metal|gold|silver|iron|steel|blade|sword|武器|weapon|armou?r|鎧|甲|铁|钢/i.test(n)) return "metal";
  if (/stocking|socks|靴下|タイツ|ニーソ|丝袜/i.test(n)) return "satin";
  if (/glass|ガラス|玻璃|レンズ|lens/i.test(n)) return "glass";
  return "cloth";
}

const FIGURE_LOOK = {
  eye: null, // eyes keep their loaded matcap look
  skin: "skin-soft",
  hair: "hair-silk",
  metal: "metal",
  satin: "satin",
  glass: "glass",
  cloth: "figure-pvc",
};

// "MMD 2.0" — semi-realistic ray-MMD-style look (reference renders).
const MMD2_LOOK = {
  eye: null,
  skin: "skin-real",
  hair: "hair-soft",
  metal: "metal",
  satin: "satin",
  glass: "glass",
  cloth: "cloth-soft",
};

// Auto-translation of material names (JP/CN -> EN) for the UI lists.
// Greedy longest-match token scan; unknown parts stay as-is.
const MAT_NAME_DICT = [
  ["白目", "Eye white"], ["二重", "Eyelid"], ["まつげ", "Lashes"], ["睫毛", "Lashes"], ["睫", "Lashes"],
  ["前髪", "Front hair"], ["後髪", "Back hair"], ["横髪", "Side hair"], ["アホ毛", "Ahoge"],
  ["髪飾り", "Hair deco"], ["髪", "Hair"], ["发", "Hair"], ["頭", "Head"], ["头", "Head"],
  ["顔", "Face"], ["颜", "Face"], ["脸", "Face"], ["肌", "Skin"], ["肤", "Skin"],
  ["瞳", "Eyes"], ["目", "Eyes"], ["眼", "Eyes"], ["眉", "Brows"], ["口", "Mouth"],
  ["歯", "Teeth"], ["舌", "Tongue"], ["耳", "Ears"], ["首", "Neck"], ["体", "Body"], ["胸", "Chest"],
  ["外套", "Jacket"], ["上着", "Jacket"], ["上衣", "Top"], ["服", "Clothes"], ["衣", "Clothes"],
  ["袖", "Sleeves"], ["襟", "Collar"], ["手袋", "Gloves"], ["腕", "Arms"], ["手", "Hands"],
  ["短裤", "Shorts"], ["裤", "Pants"], ["ズボン", "Pants"], ["スカート", "Skirt"], ["裙", "Skirt"],
  ["靴下", "Socks"], ["靴", "Shoes"], ["鞋", "Shoes"], ["足", "Legs"], ["脚", "Legs"],
  ["タイツ", "Tights"], ["ニーソ", "Knee socks"], ["丝袜", "Stockings"],
  ["帽子", "Hat"], ["帽", "Hat"], ["リボン", "Ribbon"], ["蝶結び", "Bow"], ["ネクタイ", "Tie"],
  ["ベルト", "Belt"], ["带", "Belt"], ["チョーカー", "Choker"], ["鈴", "Bell"], ["紐", "String"], ["绳", "Rope"],
  ["尾饰", "Tail deco"], ["尻尾", "Tail"], ["尾", "Tail"], ["羽", "Wings"], ["翼", "Wings"],
  ["武器", "Weapon"], ["刀", "Blade"], ["剣", "Sword"], ["鎧", "Armor"], ["甲", "Armor"], ["金属", "Metal"],
  ["飾り", "Deco"], ["飾", "Deco"], ["饰", "Deco"], ["宝石", "Jewel"], ["下着", "Underwear"],
  ["表情", "Expression"], ["其他", "Other"],
].sort((a, b) => b[0].length - a[0].length);

export function translateMaterialName(name) {
  const n = String(name || "");
  let out = "";
  let translated = false;
  let i = 0;
  while (i < n.length) {
    let hit = null;
    for (const pair of MAT_NAME_DICT) {
      if (n.startsWith(pair[0], i)) { hit = pair; break; }
    }
    if (hit) {
      out += (out && !/[\s(]$/.test(out) ? " " : "") + hit[1];
      i += hit[0].length;
      translated = true;
    } else {
      out += n[i];
      i++;
    }
  }
  return translated ? out.trim() : n;
}

// UI label: "English gloss · original" when a translation applies.
export function materialDisplayName(name) {
  const gloss = translateMaterialName(name);
  return gloss !== name ? `${gloss} · ${name}` : name;
}

// Purple theme for native controls (selects/lists render white by default).
const UI = {
  select:
    "width:100%;background:#14101f;color:#d7d2f5;border:1px solid #37305e;" +
    "border-radius:6px;padding:4px 6px;font-size:12px;outline:none;",
  list:
    "width:100%;background:#14101f;color:#cfc9f2;border:1px solid #37305e;" +
    "border-radius:6px;padding:2px;font-size:12px;outline:none;margin:2px 0 6px;",
  note: "padding:6px;color:#8a83b8;font-size:11px;",
};

export function createRtxMaterialStudio({ getContainer, requestRepack, THREE, onMaterialsSwapped, getEnvMap, applyAO, applyFx, applyBloom, applyLut }) {
  /* ==================== Engine 2.0 — raster engine upgrade ====================
   * Global feature set for the Figure PBR pipeline. MMD models ship only a
   * diffuse texture, so normal / specular / height maps are GENERATED from it
   * (Sobel luminance) once per unique image and cached. Everything is tunable
   * from the "Engine 2.0" settings window and persists globally. */
  const ENGINE2_KEY = "mmd_engine2_settings";
  // Neutral values for every Engine2FxPass v2 parameter (68 controls).
  const FX_NEUTRAL = Object.freeze({
    exposure: 0, contrast: 0, saturation: 0, vibrance: 0,
    temperature: 0, tintGM: 0, gamma: 1,
    lift: 0, rolloff: 0, splitShadows: 0, splitHighs: 0,
    hueShift: 0, sepia: 0, invert: 0,
    levelsBlack: 0, levelsWhite: 1, gainR: 1, gainG: 1, gainB: 1,
    vignette: 0, vignetteRound: 0.5, chroma: 0, barrel: 0, letterbox: 0,
    radialBlur: 0, radialCX: 0.5, radialCY: 0.5,
    motionBlur: 0, motionAngle: 0,
    tiltShift: 0, tiltPos: 0.5, tiltWidth: 0.3,
    frost: 0,
    edge: 0, edgeThreshold: 0.2,
    halftone: 0, halftoneSize: 6,
    duotone: 0, duoHueA: 0.62, duoHueB: 0.08,
    emboss: 0,
    wave: 0, waveFreq: 12, waveSpeed: 1,
    glitch: 0, glitchSpeed: 1,
    shake: 0, shakeSpeed: 8,
    mirrorX: 0,
    swirl: 0, swirlRadius: 0.5,
    rays: 0, raysDecay: 0.92, raysCX: 0.5, raysCY: 0.25,
    raysAuto: 1,
    leaks: 0,
    fog: 0, fogHeight: 0.5,
    frostEdge: 0,
    rain: 0, rainSpeed: 1,
    snow: 0, snowSpeed: 1, snowWind: 0,
    dust: 0,
    grain: 0, grainSize: 1.6, scanlines: 0, posterize: 0, pixelate: 0, sharpen: 0,
    lutAmount: 0,
  });
  // Anime shadow band (MMD_modoki style) — neutral = completely invisible.
  const BAND_NEUTRAL = Object.freeze({
    amt: 0, pos: 0.5, soft: 0.08, wash: 0, tint: [0.66, 0.60, 0.78],
  });
  const ENGINE2 = {
    overlayOriginal: false,        // master (OPT-IN): layer Engine 2.0 over the
    //                                classic engine. Default OFF — the classic
    //                                pipeline must never change on its own.
    toonRelief: false,             // experimental: generated maps on native toon
    envOn: false,                  // experimental: IBL env map for Figure PBR.
    //                                three PMREMs it mid-frame on first use —
    //                                broke programs/textures on some GPUs.
    normalOn: true, normal: 0.8,   // generated normal map + strength
    specOn: true, spec: 0.7,       // generated specular(roughness) map + contrast
    rimMul: 1.0,                   // global rim light multiplier
    sssMul: 1.0,                   // global SSS (sheen/fill) multiplier
    ibl: 1.0,                      // image-based lighting intensity
    aoOn: false, ao: 0.6,          // SSAO toggle + radius/intensity
    refraction: 0,                 // glass transmission strength (opt-in)
    parallax: 0.35,                // pseudo-parallax depth (bump)
    anisoOn: true, aniso: 0.55, anisoRot: 0, // anisotropic hair highlight
    // bloom bridge (existing UnrealBloomPass) — gentle defaults
    bloomOn: false, bloomThreshold: 0.85, bloomStrength: 0.3, bloomRadius: 0.4,
    // cinematic post-FX (Engine2FxPass v2, 68 params) — all neutral by default
    fx: { ...FX_NEUTRAL },
    // anime shadow band on the MMD 2.0 toon (position/softness of the cel
    // edge, shadow tint, flat light wash) — neutral by default
    band: { ...BAND_NEUTRAL },
    // loaded 3D LUT (.cube/.3dl) — text kept so it survives reloads
    lutName: "", lutText: "",
  };
  // Versioned settings: older saves carried overlayOriginal=true from when it
  // was the default — semantics changed, so stale versions are IGNORED.
  try {
    const savedE2 = JSON.parse(localStorage.getItem(ENGINE2_KEY) || "{}");
    if (savedE2.__v === 2) Object.assign(ENGINE2, savedE2);
  } catch (_) {}
  // Older v2 saves predate fx.lutAmount / band — fill any missing keys.
  ENGINE2.fx = { ...FX_NEUTRAL, ...(ENGINE2.fx || {}) };
  ENGINE2.band = { ...BAND_NEUTRAL, ...(ENGINE2.band || {}) };
  if (!Array.isArray(ENGINE2.band.tint) || ENGINE2.band.tint.length !== 3) {
    ENGINE2.band.tint = [...BAND_NEUTRAL.tint];
  }
  function engine2Save() {
    try { localStorage.setItem(ENGINE2_KEY, JSON.stringify({ ...ENGINE2, __v: 2 })); } catch (_) {}
  }
  // Re-apply Engine 2.0 to every model. With the master switch on, models in
  // Original mode are upgraded to the native-toon MMD overlay (same colors,
  // engine effects layered on top of the classic light/FX pipeline).
  function engine2Refresh() {
    for (const M of S.models) {
      if (ENGINE2.overlayOriginal && M.rasterMode === "original") {
        setRasterMode("mmd2", M); // rebuilds + saves + notifies
        continue;
      }
      if (M.rasterMode !== "original") {
        for (const e of M.entries) refreshRasterEntry(M, e);
      }
    }
    try { applyAO?.(ENGINE2.aoOn, ENGINE2.ao); } catch (_) {}
    try { applyFx?.(ENGINE2.fx); } catch (_) {}
    try { applyBloom?.(ENGINE2.bloomOn, ENGINE2.bloomThreshold, ENGINE2.bloomStrength, ENGINE2.bloomRadius); } catch (_) {}
    requestRepack?.();
  }

  // --- procedural map generation (normal / height / roughness) -------------
  const _genCache = new Map(); // image -> { normal, height, rough }
  function generateMapsFor(map) {
    if (typeof document === "undefined" || !THREE) return null;
    const img = map && map.image;
    if (!img || !img.width || !img.height) return null;
    let g = _genCache.get(img);
    if (g) return g;
    try {
      const W = 512, H = 512;
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const lum = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        lum[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) / 255;
      }
      const nD = new Uint8ClampedArray(W * H * 4);
      const hD = new Uint8ClampedArray(W * H * 4);
      const rD = new Uint8ClampedArray(W * H * 4);
      const at = (x, y) => lum[(Math.max(0, Math.min(H - 1, y)) * W) + Math.max(0, Math.min(W - 1, x))];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          // Sobel gradients -> tangent-space normal
          const gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
                   - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
          const gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
                   - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
          const nx = -gx * 1.6, ny = -gy * 1.6, nz = 1.0;
          const il = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
          nD[o] = (nx * il * 0.5 + 0.5) * 255;
          nD[o + 1] = (ny * il * 0.5 + 0.5) * 255;
          nD[o + 2] = (nz * il * 0.5 + 0.5) * 255;
          nD[o + 3] = 255;
          const l = lum[y * W + x];
          const hv = l * 255;
          hD[o] = hD[o + 1] = hD[o + 2] = hv; hD[o + 3] = 255;
          // specular map: brighter texels = glossier (lower roughness)
          const rough = Math.max(0, Math.min(1, 1.0 - Math.pow(l, 1.5) * 0.85));
          const rv = rough * 255;
          rD[o] = rD[o + 1] = rD[o + 2] = rv; rD[o + 3] = 255;
        }
      }
      const mk = (data) => {
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        c.getContext("2d").putImageData(new ImageData(data, W, H), 0, 0);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = map.wrapS; t.wrapT = map.wrapT;
        t.flipY = map.flipY;
        return t;
      };
      g = { normal: mk(nD), height: mk(hD), rough: mk(rD) };
      _genCache.set(img, g);
      return g;
    } catch (_) {
      return null;
    }
  }
  const S = {
    models: [], // [{ mesh, name, entries:[{key,name,mat}], rasterMode, variants:Map, selected }]
    active: -1,
  };
  const activeModel = () => S.models[S.active] || null;
  let libraryExtension = null;

  // 1x1 white fallback for the matcap sampler (GLSL samplers must be bound).
  let _whiteTex = null;
  function getWhiteTex() {
    if (_whiteTex || !THREE) return _whiteTex;
    _whiteTex = new THREE.DataTexture(
      new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat,
    );
    _whiteTex.needsUpdate = true;
    return _whiteTex;
  }

  /* ------------------------------ storage ------------------------------ */
  const storageKey = (M) => STORAGE_PREFIX + (M?.name || "model");
  function saveAll(M = activeModel()) {
    if (!M) return;
    try {
      const out = { __rasterMode: M.rasterMode, __modeManual: !!M.modeManual };
      for (const e of M.entries) {
        const ov = e.mat.userData?.rtx;
        if (ov && Object.keys(ov).length) out[e.key] = ov;
      }
      localStorage.setItem(storageKey(M), JSON.stringify(out));
    } catch (_) {}
  }
  function loadAll(M) {
    const out = { mode: "original", manual: false };
    try {
      const raw = localStorage.getItem(storageKey(M));
      if (!raw) return out;
      const data = JSON.parse(raw);
      if (data.__rasterMode === "figure" || data.__rasterMode === "mmd2") out.mode = data.__rasterMode;
      out.manual = !!data.__modeManual;
      for (const e of M.entries) {
        if (data[e.key]) {
          e.mat.userData = e.mat.userData || {};
          e.mat.userData.rtx = data[e.key];
        }
      }
    } catch (_) {}
    return out;
  }

  /* ------------------------------ model io ----------------------------- */
  function collectMaterials(mesh) {
    const list = [];
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m, i) => {
      if (!m) return;
      list.push({ key: `${i}:${m.name || "mat"}`, name: m.name || `Material ${i}`, mat: m });
    });
    return list;
  }

  // Registers (or re-registers) a loaded model. EVERY model stays editable —
  // characters, weapons, props — switch between them in the Model dropdown.
  function onModelLoaded(mesh, modelName = "") {
    if (!mesh) return;
    pruneRemovedModels();
    const name = modelName || mesh.name || "model";
    let idx = S.models.findIndex((m) => m.mesh === mesh);
    if (idx >= 0) {
      // Re-registering a known mesh: put the ORIGINAL materials back first,
      // so the re-collected entries can never capture our variants as
      // "originals" (that made Original mode keep a variant forever).
      const prev = S.models[idx];
      const isArr = Array.isArray(mesh.material);
      const mats = isArr ? mesh.material : [mesh.material];
      prev.entries.forEach((e, i) => { if (i < mats.length) mats[i] = e.mat; });
      if (!isArr) mesh.material = mats[0];
    }
    if (idx < 0) {
      S.models.push({
        mesh, name, entries: collectMaterials(mesh),
        rasterMode: "original", variants: new Map(), variants2: new Map(),
        selected: 0,
      });
      idx = S.models.length - 1;
    } else {
      S.models[idx].name = name;
      S.models[idx].entries = collectMaterials(mesh);
      S.models[idx].variants = new Map();
      S.models[idx].variants2 = new Map();
      S.models[idx].rasterMode = "original";
    }
    S.active = idx;
    const M = S.models[idx];
    loadAll(M); // restore per-material overrides only
    // EVERY MODEL ALWAYS LOADS WITH ITS ORIGINAL SHADERS — no exceptions.
    // Building variants at load time raced the ASYNC texture loading: the
    // RTX atlas got baked from empty images => white textures until the
    // user clicked any preset (which forced a second rebuild). Overlay
    // modes now apply only from a LIVE user action, when textures exist.
    rebuildUI();
    // push saved Engine 2.0 state to the composer (AO / post-FX / bloom)
    try { applyAO?.(ENGINE2.aoOn, ENGINE2.ao); } catch (_) {}
    try { applyFx?.(ENGINE2.fx); } catch (_) {}
    try { applyBloom?.(ENGINE2.bloomOn, ENGINE2.bloomThreshold, ENGINE2.bloomStrength, ENGINE2.bloomRadius); } catch (_) {}
    requestRepack?.();
  }

  function pruneRemovedModels() {
    const act = activeModel();
    S.models = S.models.filter((m) => m.mesh && m.mesh.parent);
    S.active = Math.max(0, S.models.indexOf(act));
    if (!S.models.length) S.active = -1;
  }

  /* --------------------------- raster variants -------------------------- */
  function buildRasterVariant(M, entry) {
    if (!THREE || !entry) return null;
    const src = entry.mat;
    src.userData = src.userData || {};
    const ov = src.userData.rtx || {};
    let v = M.variants.get(entry.key);
    const fresh = !v;
    if (fresh) {
      v = new THREE.MeshPhysicalMaterial();
      v.name = (src.name || "mat") + " [figure]";
      // Non-enumerable back-reference used by the Anime NPR material registry.
      // It prevents a live Figure-PBR slot from becoming a new canonical PMX
      // material when the two editors exchange ownership.
      Object.defineProperty(v, "_shaderStudioSource", {
        value: src,
        configurable: true,
      });
      // Share userData: RTX overrides + opacity-capture flags stay in sync.
      v.userData = src.userData;
      const rimU = { value: ov.rim || 0 };
      // MMD sphere map (matcap): CRITICAL for many models — e.g. stylized
      // hair often has a DARK base texture and gets its real color from an
      // ADDITIVE .spa matcap. Dropping it renders such hair black. The RTX
      // path already applies sphere maps; the raster variant must too.
      // mode: -1 none, 0 multiply (.sph), 1 additive (.spa)
      const mcTexU = { value: getWhiteTex() };
      const mcModeU = { value: -1 };
      v.userData._rimU = rimU;
      v.userData._mcTexU = mcTexU;
      v.userData._mcModeU = mcModeU;
      v.onBeforeCompile = (shader) => {
        shader.uniforms.uRimStrength = rimU;
        shader.uniforms.uMatcapTex = mcTexU;
        shader.uniforms.uMatcapMode = mcModeU;
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "uniform vec3 emissive;",
            "uniform vec3 emissive;\nuniform float uRimStrength;\nuniform sampler2D uMatcapTex;\nuniform float uMatcapMode;",
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            {
              // MMD sphere map (matcap) — view-space-normal projected
              if (uMatcapMode > -0.5) {
                vec2 mcUv = normal.xy * 0.495 + 0.5;
                vec3 mc = texture2D(uMatcapTex, mcUv).rgb;
                if (uMatcapMode > 0.5) totalEmissiveRadiance += mc;   // .spa add
                else diffuseColor.rgb *= mc;                          // .sph mult
              }
              // figure-style rim light (grazing view angles)
              vec3 rimV = normalize(vViewPosition);
              float rimT = pow(clamp(1.0 - dot(normal, rimV), 0.0, 1.0), 3.0);
              totalEmissiveRadiance += diffuseColor.rgb * rimT * uRimStrength * 0.9;
            }`,
          );
      };
      M.variants.set(entry.key, v);
    }
    // wire the source matcap every rebuild — share the object even if its
    // image hasn't finished loading yet (async MMD textures fill in later)
    if (v.userData._mcTexU) {
      const mc = src.matcap && src.matcap.isTexture ? src.matcap : null;
      v.userData._mcTexU.value = mc || getWhiteTex();
      v.userData._mcModeU.value = mc ? (src.matcapCombine === 0 ? 0 : 1) : -1;
    }
    // ---- copy base props from the source (idempotent) ----
    // MMD color model: final = texture × (diffuse·light + ambient). MMDLoader
    // stores ambient in `emissive`, and many models author hair/cloth with a
    // DARK diffuse + bright ambient — copying diffuse alone renders them
    // black. The physical base color must be diffuse + ambient (clamped).
    const col = src.color || src.diffuse;
    const amb = src.emissive || null;
    if (col) {
      v.color.setRGB(
        Math.min(1, col.r + (amb ? amb.r : 0)),
        Math.min(1, col.g + (amb ? amb.g : 0)),
        Math.min(1, col.b + (amb ? amb.b : 0)),
      );
    } else v.color.setRGB(1, 1, 1);
    if (v.map !== (src.map || null)) { v.map = src.map || null; v.needsUpdate = true; }
    v.side = src.side != null ? src.side : THREE.DoubleSide;
    v.transparent = !!src.transparent;
    v.opacity = src.opacity ?? 1;
    v.alphaTest = src.alphaTest || 0;
    v.depthWrite = true;
    v.dithering = false;
    v.premultipliedAlpha = false;
    // Clearcoat/metal gloss needs an environment to reflect — without one a
    // physical material looks like plain lambert and "nothing changes".
    // The host supplies a lazy PMREM room environment (variants only, the
    // rest of the scene is untouched).
    const envTex = ENGINE2.envOn ? (getEnvMap?.() || null) : null;
    if (v.envMap !== envTex) { v.envMap = envTex; v.needsUpdate = true; }
    v.envMapIntensity = 0.75 * ENGINE2.ibl; // IBL intensity (Engine 2.0)

    // ---- Engine 2.0: generated maps (normal / specular / parallax) ----
    const gen = (ENGINE2.normalOn || ENGINE2.specOn || ENGINE2.parallax > 0.01)
      ? generateMapsFor(v.map) : null;
    const wantN = ENGINE2.normalOn && gen ? gen.normal : null;
    if (v.normalMap !== wantN) { v.normalMap = wantN; v.needsUpdate = true; }
    if (wantN) v.normalScale.set(ENGINE2.normal, ENGINE2.normal);
    const wantR = ENGINE2.specOn && gen ? gen.rough : null;
    if (v.roughnessMap !== wantR) { v.roughnessMap = wantR; v.needsUpdate = true; }
    if (wantR) v.roughness = Math.max(0.05, 0.9 - ENGINE2.spec * 0.35); // spec contrast base
    const wantB = ENGINE2.parallax > 0.01 && gen ? gen.height : null;
    if (v.bumpMap !== wantB) { v.bumpMap = wantB; v.needsUpdate = true; }
    if (wantB) v.bumpScale = ENGINE2.parallax * 0.06;
    // anisotropic hair highlight (real physical anisotropy)
    if ("anisotropy" in v) {
      const isHair = classifyMaterialName(entry.name) === "hair";
      const wantA = isHair && ENGINE2.anisoOn ? ENGINE2.aniso : 0;
      if ((v.anisotropy > 0) !== (wantA > 0)) v.needsUpdate = true;
      v.anisotropy = wantA;
      v.anisotropyRotation = ENGINE2.anisoRot;
    }
    // ---- apply overrides ----
    const coat = ov.coat ?? 0;
    v.clearcoat = coat;
    v.clearcoatRoughness = ov.coatRough ?? 0.15;
    v.roughness = Math.max(0.12, 0.8 - 0.45 * coat);
    v.metalness = 0;
    v.transmission = 0; // NEVER use transmission in raster: the transmission
    //                     pass glitches on skinned MMD meshes in this composer
    //                     (white-noise blobs). Glass is approximated below.
    if (ov.type === "metal") {
      v.metalness = 1;
      v.roughness = ov.fuzz ?? 0.12;
    } else if (ov.type === "glass") {
      // Stable glossy-transparent glass approximation by default; real
      // refraction (transmission) is an Engine 2.0 opt-in.
      v.transparent = true;
      v.opacity = Math.min(v.opacity, 0.38);
      v.roughness = ov.fuzz ?? 0.05;
      v.clearcoat = 1;
      v.clearcoatRoughness = 0.04;
      v.depthWrite = false;
      if (ENGINE2.refraction > 0.01) {
        v.transmission = ENGINE2.refraction;
        v.thickness = 0.6;
        v.opacity = 1;
        v.ior = 1.5;
      }
    }
    v.sheen = (ov.sss ?? 0) * ENGINE2.sssMul;
    v.sheenRoughness = 0.6;
    v.sheenColor.setRGB(1, 0.92, 0.9);
    if (Array.isArray(ov.tint) && ov.tint.length === 3) {
      v.color.multiply(new THREE.Color(ov.tint[0], ov.tint[1], ov.tint[2]));
    }
    const boost = ov.emitBoost || 0;
    const wantEmisMap = boost > 0 ? v.map : null;
    if (v.emissiveMap !== wantEmisMap) { v.emissiveMap = wantEmisMap; v.needsUpdate = true; }
    v.emissive.setScalar(Math.min(1, boost * 0.35));
    if (ov.alpha != null && ov.alpha < 1) {
      v.opacity = (src.opacity ?? 1) * ov.alpha;
      v.transparent = true;
    }
    if (v.userData._rimU) v.userData._rimU.value = (ov.rim || 0) * ENGINE2.rimMul;
    if (fresh) v.needsUpdate = true;
    return v;
  }

  /* ------------------------- MMD 2.0 variants --------------------------- */
  // GLOBAL "MMD 2.0" shader mode: clones the model's NATIVE MMDToon material
  // (every map, matcap, toon ramp and color stays EXACTLY as loaded — colors
  // cannot break) and injects a ray-MMD-style overlay on top: glossy
  // fresnel-weighted specular, cinematic rim light and a soft fill.
  const MMD2_FRAG_DECL =
    "uniform float uMmd2Coat;\nuniform float uMmd2Power;\nuniform float uMmd2Rim;\nuniform float uMmd2Fill;\n" +
    "uniform float uMmd2BandAmt;\nuniform float uMmd2BandPos;\nuniform float uMmd2BandSoft;\n" +
    "uniform float uMmd2BandWash;\nuniform vec3 uMmd2BandTint;\n";
  const MMD2_FRAG_INJ = `
  {
    // ---- MMD 2.0 overlay (Shader Studio) ----
    vec3 m2V = normalize(vViewPosition);
    vec3 m2N = normalize(normal);
    float m2F = pow(clamp(1.0 - dot(m2N, m2V), 0.0, 1.0), 3.0);
    // ---- anime shadow band (MMD_modoki style) ----
    // The terminator is remapped into an art-directable band: Position and
    // Softness shape the cel edge (soft=0 -> razor step), the shadow side is
    // multiplied by a tint color (violet/pink modern-anime shadows), and the
    // lit side can flatten toward the albedo ("flat light wash"). All neutral
    // by default — zero change until the user turns it on.
    float m2Lit = 1.0;
    #if NUM_DIR_LIGHTS > 0
    if (uMmd2BandAmt > 0.001 || uMmd2BandWash > 0.001) {
      float m2Ndl = clamp(dot(m2N, directionalLights[0].direction), -1.0, 1.0) * 0.5 + 0.5;
      m2Lit = smoothstep(uMmd2BandPos - uMmd2BandSoft - 0.0005,
                         uMmd2BandPos + uMmd2BandSoft + 0.0005, m2Ndl);
      vec3 m2Shadowed = outgoingLight * mix(vec3(1.0), uMmd2BandTint, uMmd2BandAmt);
      outgoingLight = mix(m2Shadowed, outgoingLight, m2Lit);
      outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.05,
                          m2Lit * uMmd2BandWash * 0.6);
    }
    #endif
    vec3 m2Spec = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
    for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
      vec3 m2H = normalize(directionalLights[i].direction + m2V);
      m2Spec += directionalLights[i].color * pow(clamp(dot(m2N, m2H), 0.0, 1.0), uMmd2Power);
    }
    #endif
    // specular follows the band — no glints inside the stylized shadow
    outgoingLight += m2Spec * uMmd2Coat * (0.35 + 0.65 * m2F) * (0.3 + 0.7 * m2Lit);
    outgoingLight += diffuseColor.rgb * m2F * uMmd2Rim;
    outgoingLight += diffuseColor.rgb * uMmd2Fill;
  }
  #include <opaque_fragment>`;

  // GLOBAL shadow-band uniforms — shared by reference across every MMD 2.0
  // variant, so moving one slider updates all materials with zero rebuilds.
  const M2BAND = {
    amt:  { value: ENGINE2.band.amt },
    pos:  { value: ENGINE2.band.pos },
    soft: { value: ENGINE2.band.soft },
    wash: { value: ENGINE2.band.wash },
    tint: { value: THREE
      ? new THREE.Color(ENGINE2.band.tint[0], ENGINE2.band.tint[1], ENGINE2.band.tint[2])
      : { r: ENGINE2.band.tint[0], g: ENGINE2.band.tint[1], b: ENGINE2.band.tint[2] } },
  };
  function m2BandSync() {
    const b = ENGINE2.band;
    M2BAND.amt.value = b.amt;
    M2BAND.pos.value = b.pos;
    M2BAND.soft.value = b.soft;
    M2BAND.wash.value = b.wash;
    const t = M2BAND.tint.value;
    if (t.setRGB) t.setRGB(b.tint[0], b.tint[1], b.tint[2]);
    else { t.r = b.tint[0]; t.g = b.tint[1]; t.b = b.tint[2]; }
  }

  function buildMmd2Variant(M, entry) {
    if (!THREE || !entry) return null;
    const src = entry.mat;
    src.userData = src.userData || {};
    const ov = src.userData.rtx || {};
    // The MMD 2.0 overlay only works on the native toon (ShaderMaterial with
    // uniforms). Anything else keeps its original material untouched.
    if (!src.isShaderMaterial || !src.uniforms) return null;
    let v = M.variants2.get(entry.key);
    if (!v) {
      // Detach userData before clone: Material.copy deep-JSONs userData and
      // ours holds live textures/uniform refs (would choke the serializer).
      const savedUD = src.userData;
      src.userData = {};
      try {
        v = src.clone();
      } finally {
        src.userData = savedUD;
      }
      v.userData = savedUD; // share — RTX overrides & opacity flags in sync
      // CRITICAL: Material.clone() CLONED every texture uniform (clones spam
      // "no image data found" and re-upload). Share the SOURCE texture objects
      // UNCONDITIONALLY — MMD textures load ASYNC, so at clone time image may
      // not exist yet; the shared object receives it when the loader finishes.
      // (Requiring .image here nulled every texture on auto-load => white clay.)
      for (const k in v.uniforms) {
        const uv = v.uniforms[k];
        if (!uv || !uv.value || !uv.value.isTexture) continue;
        const sv = src.uniforms[k] ? src.uniforms[k].value : null;
        uv.value = sv && sv.isTexture ? sv : null;
      }
      v.name = (src.name || "mat") + " [mmd2]";
      Object.defineProperty(v, "_shaderStudioSource", {
        value: src,
        configurable: true,
      });
      const u = {
        coat: { value: 0.45 },
        power: { value: 90 },
        rim: { value: 0.28 },
        fill: { value: 0.1 },
      };
      v.userData._m2U = u;
      if (!v.uniforms) v.uniforms = {};
      v.uniforms.uMmd2Coat = u.coat;
      v.uniforms.uMmd2Power = u.power;
      v.uniforms.uMmd2Rim = u.rim;
      v.uniforms.uMmd2Fill = u.fill;
      v.uniforms.uMmd2BandAmt = M2BAND.amt;
      v.uniforms.uMmd2BandPos = M2BAND.pos;
      v.uniforms.uMmd2BandSoft = M2BAND.soft;
      v.uniforms.uMmd2BandWash = M2BAND.wash;
      v.uniforms.uMmd2BandTint = M2BAND.tint;
      // capture the base diffuse for non-compounding tint
      const dif = v.uniforms.diffuse?.value;
      if (dif && dif.isColor) v.userData._m2BaseDiffuse = dif.clone();
      v.onBeforeCompile = (shader) => {
        shader.uniforms.uMmd2Coat = u.coat;
        shader.uniforms.uMmd2Power = u.power;
        shader.uniforms.uMmd2Rim = u.rim;
        shader.uniforms.uMmd2Fill = u.fill;
        shader.uniforms.uMmd2BandAmt = M2BAND.amt;
        shader.uniforms.uMmd2BandPos = M2BAND.pos;
        shader.uniforms.uMmd2BandSoft = M2BAND.soft;
        shader.uniforms.uMmd2BandWash = M2BAND.wash;
        shader.uniforms.uMmd2BandTint = M2BAND.tint;
        shader.fragmentShader = MMD2_FRAG_DECL + shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          MMD2_FRAG_INJ,
        );
      };
      v.needsUpdate = true;
      M.variants2.set(entry.key, v);
    }
    // map the shared per-material overrides onto the overlay uniforms
    const u = v.userData._m2U;
    if (u) {
      const coat = ov.coat ?? 0.4;
      const rough = Math.min(1, ov.coatRough ?? 0.3);
      u.coat.value = coat * 1.1 * (0.5 + ENGINE2.spec * 0.7);
      u.power.value = 8 + Math.pow(1 - rough, 2) * 180;
      u.rim.value = (ov.rim ?? 0.28) * ENGINE2.rimMul;
      u.fill.value = (ov.sss ?? 0.4) * 0.25 * ENGINE2.sssMul;
    }
    // Engine 2.0: generated relief maps on the NATIVE toon shader. Kept
    // behind an EXPERIMENTAL flag — adding normal/bump defines to MMDToon
    // recompiles its program and can fail on some rigs.
    if (ENGINE2.toonRelief) {
      const srcMap = v.map || src.map || null;
      const gen = (ENGINE2.normalOn || ENGINE2.parallax > 0.01) && srcMap
        ? generateMapsFor(srcMap) : null;
      const wantN = ENGINE2.normalOn && gen ? gen.normal : null;
      if (v.normalMap !== wantN) { v.normalMap = wantN; v.needsUpdate = true; }
      if (v.uniforms) {
        if (v.uniforms.normalMap) v.uniforms.normalMap.value = wantN;
        if (wantN && v.uniforms.normalScale?.value?.set) {
          v.uniforms.normalScale.value.set(ENGINE2.normal, ENGINE2.normal);
        }
      }
      const wantB = ENGINE2.parallax > 0.01 && gen ? gen.height : null;
      if (v.bumpMap !== wantB) { v.bumpMap = wantB; v.needsUpdate = true; }
      if (v.uniforms) {
        if (v.uniforms.bumpMap) v.uniforms.bumpMap.value = wantB;
        if (wantB && v.uniforms.bumpScale) v.uniforms.bumpScale.value = ENGINE2.parallax * 0.06;
      }
    } else if (v.normalMap || v.bumpMap) {
      // relief switched off mid-session — clean the toon clone back up
      v.normalMap = null;
      v.bumpMap = null;
      if (v.uniforms) {
        if (v.uniforms.normalMap) v.uniforms.normalMap.value = null;
        if (v.uniforms.bumpMap) v.uniforms.bumpMap.value = null;
      }
      v.needsUpdate = true;
    }
    const base = v.userData._m2BaseDiffuse;
    const dif = v.uniforms?.diffuse?.value;
    if (base && dif && dif.isColor) {
      dif.copy(base);
      if (Array.isArray(ov.tint) && ov.tint.length === 3) {
        dif.multiply(new THREE.Color(ov.tint[0], ov.tint[1], ov.tint[2]));
      }
    }
    if (ov.alpha != null && "opacity" in v) {
      v.opacity = (src.opacity ?? 1) * ov.alpha;
      if (v.opacity < 1) v.transparent = true;
    }
    return v;
  }

  function setRasterMode(mode, M = activeModel(), manual = false) {
    if (!M) return;
    M.rasterMode = mode === "figure" || mode === "mmd2" ? mode : "original";
    if (manual) M.modeManual = true;
    const msh = M.mesh;
    if (msh) {
      const isArr = Array.isArray(msh.material);
      const mats = isArr ? msh.material : [msh.material];
      M.entries.forEach((e, i) => {
        if (i >= mats.length) return;
        if (M.rasterMode === "figure") {
          // Eyes keep the original matcap material.
          if (classifyMaterialName(e.name) === "eye") { mats[i] = e.mat; return; }
          const v = buildRasterVariant(M, e);
          if (v) mats[i] = v;
        } else if (M.rasterMode === "mmd2") {
          const v = buildMmd2Variant(M, e);
          if (v) mats[i] = v;
        } else {
          mats[i] = e.mat;
        }
      });
      if (!isArr) msh.material = mats[0];
    }
    saveAll(M);
    try { onMaterialsSwapped?.(M.mesh, M.rasterMode); } catch (_) {}
    rebuildUI();
  }

  function refreshRasterEntry(M, entry) {
    if (!M || !entry) return;
    if (M.rasterMode === "figure") {
      if (classifyMaterialName(entry.name) === "eye") return;
      buildRasterVariant(M, entry);
    } else if (M.rasterMode === "mmd2") {
      buildMmd2Variant(M, entry);
    }
  }

  /* ------------------------------ override ----------------------------- */
  function ovOf(entry, create = false) {
    if (!entry) return null;
    entry.mat.userData = entry.mat.userData || {};
    if (!entry.mat.userData.rtx && create) entry.mat.userData.rtx = {};
    return entry.mat.userData.rtx || null;
  }
  function setOv(M, entry, patch) {
    const ov = ovOf(entry, true);
    Object.assign(ov, patch);
    saveAll(M);
    // Editing implies the user wants to SEE the change: originals ignore
    // these params by design, so hop to Figure PBR. MMD 2.0 stays MMD 2.0.
    if (M.rasterMode === "original") setRasterMode("figure", M);
    else refreshRasterEntry(M, entry);
    requestRepack?.();
  }
  function applyPreset(M, entry, presetId) {
    if (!entry) return;
    const p = SHADER_PRESETS[presetId];
    entry.mat.userData = entry.mat.userData || {};
    if (!p || p.ov == null) delete entry.mat.userData.rtx;
    else entry.mat.userData.rtx = { ...p.ov, preset: presetId };
    saveAll(M);
    if (M.rasterMode === "original") setRasterMode("figure", M);
    else refreshRasterEntry(M, entry);
    requestRepack?.();
  }
  function applyLookMap(M, lookMap, mode) {
    if (!M) return;
    // Apply presets without triggering per-preset mode hops; switch once.
    M.rasterMode = mode; // final setRasterMode below rebuilds everything
    for (const e of M.entries) {
      const cls = classifyMaterialName(e.name);
      const presetId = lookMap[cls];
      if (presetId) applyPreset(M, e, presetId);
    }
    setRasterMode(mode, M, true); // looks are the user's explicit choice
  }
  function applyFigureLook(M = activeModel()) {
    applyLookMap(M, FIGURE_LOOK, "figure");
  }
  function applyMmd2Look(M = activeModel()) {
    applyLookMap(M, MMD2_LOOK, "mmd2");
  }
  function resetAll(M = activeModel()) {
    if (!M) return;
    for (const e of M.entries) {
      if (e.mat.userData) delete e.mat.userData.rtx;
    }
    try { localStorage.removeItem(storageKey(M)); } catch (_) {}
    if (M.rasterMode !== "original") setRasterMode("original", M);
    else rebuildUI();
    requestRepack?.();
  }

  // 🧯 Panic button: return EVERY model to its original materials, wipe every
  // saved shader-system setting and disable all Engine 2.0 features.
  function safeResetAll() {
    for (const M of S.models) {
      for (const e of M.entries) {
        if (e.mat.userData) delete e.mat.userData.rtx;
      }
      M.modeManual = false;
      if (M.rasterMode !== "original") setRasterMode("original", M);
      try { localStorage.removeItem(storageKey(M)); } catch (_) {}
    }
    Object.assign(ENGINE2, {
      overlayOriginal: false, toonRelief: false, envOn: false,
      normalOn: true, normal: 0.8, specOn: true, spec: 0.7,
      rimMul: 1.0, sssMul: 1.0, ibl: 1.0, aoOn: false, ao: 0.6,
      refraction: 0, parallax: 0.35, anisoOn: true, aniso: 0.55, anisoRot: 0,
      bloomOn: false, bloomThreshold: 0.85, bloomStrength: 0.3, bloomRadius: 0.4,
      fx: { ...FX_NEUTRAL },
      band: { ...BAND_NEUTRAL, tint: [...BAND_NEUTRAL.tint] },
      lutName: "", lutText: "",
    });
    m2BandSync();
    try { applyLut?.(null, ""); } catch (_) {}
    try { applyFx?.(ENGINE2.fx); } catch (_) {}
    try { applyBloom?.(false, 0.85, 0.6, 0.4); } catch (_) {}
    try {
      const kill = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(STORAGE_PREFIX) === 0) kill.push(k);
      }
      kill.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(ENGINE2_KEY);
    } catch (_) {}
    try { applyAO?.(false, 0.6); } catch (_) {}
    requestRepack?.();
    rebuildUI();
    if (_e2Win) buildEngine2Window();
    console.info("[ShaderStudio] SAFE RESET — all models back to original materials, all saved shader settings wiped.");
  }

  /* -------------------------------- UI --------------------------------- */
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "style") node.style.cssText = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else if (k === "title" || k === "value" || k === "type" || k === "min" || k === "max" || k === "step") node[k] = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  };

  function slider(label, title, get, set, min = 0, max = 1, step = 0.01) {
    const val = el("input", { class: "val", value: (+get()).toFixed(2) });
    const range = el("input", { type: "range", min, max, step, value: get() });
    const on = (raw) => {
      let n = parseFloat(raw);
      if (Number.isNaN(n)) return;
      n = Math.max(min, Math.min(max, n));
      range.value = n;
      val.value = n.toFixed(2);
      set(n);
    };
    range.addEventListener("input", (e) => on(e.target.value));
    val.addEventListener("change", (e) => on(e.target.value));
    return el("div", { class: "row" },
      el("label", { class: "lbl", title }, label), range, val);
  }

  function rebuildUI() {
    const box = getContainer?.();
    if (!box) return;
      pruneRemovedModels();
      box.innerHTML = "";

      // Keep the library discoverable before a model is loaded. Apply buttons
      // remain safely disabled by the adapter until a target exists.
      try {
        const current = activeModel();
        libraryExtension?.(box, current
          ? { modelName: current.name, rasterMode: current.rasterMode }
          : { modelName: null, rasterMode: null });
      } catch (error) {
        console.warn("[EffectsPlatform] library UI failed", error);
      }
  
      if (!S.models.length) {
      box.appendChild(el("div", { class: "note", style: UI.note },
        "Load a model to edit its shaders"));
      return;
    }
    const M = activeModel();
    if (!M) return;

    // model picker — characters AND props/weapons are all editable
    if (S.models.length > 1) {
      const modelSel = el("select", { style: UI.select + "margin:2px 0 6px" });
      S.models.forEach((m, i) => {
        const opt = el("option", { value: String(i) },
          `${m.name}${m.rasterMode === "figure" ? " ✨" : ""}`);
        if (i === S.active) opt.selected = true;
        modelSel.appendChild(opt);
      });
      modelSel.addEventListener("change", () => {
        S.active = parseInt(modelSel.value, 10) || 0;
        rebuildUI();
      });
      box.appendChild(el("div", { class: "row" },
        el("label", { class: "lbl", title: "Which loaded model to edit" }, "Model"), modelSel));
    }

    // raster pipeline switch (per model)
    const modeBtn = (label, mode, title) => {
      const btn = el("button", {
        class: "btn" + (M.rasterMode === mode ? " active" : ""),
        title,
        onclick: () => setRasterMode(mode, M, true), // user's explicit choice
      }, label);
      if (M.rasterMode === mode) btn.style.cssText = "outline:1px solid #7c6cff";
      return btn;
    };
    box.appendChild(el("div", { style: "display:flex;gap:6px;margin:4px 0 6px;flex-wrap:wrap" },
      modeBtn("Original", "original", "Raster mode: the model's loaded MMD toon materials"),
      modeBtn("Figure PBR ✨", "figure", "Raster mode: physical shaders — clearcoat gloss, rim light, sheen skin"),
      modeBtn("MMD 2.0 🎬", "mmd2", "Raster mode: the NATIVE MMD toon shader + ray-MMD-style overlay (glossy specular, cinematic rim). Colors always exactly as loaded."),
    ));

    // one-click looks
    box.appendChild(el("div", { style: "display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap" },
      el("button", { class: "btn", title: "Figure/PVC look: glossy cloth, soft skin, silk hair (switches raster to Figure PBR)", onclick: () => applyFigureLook(M) }, "✨ Figure PVC look"),
      el("button", { class: "btn", title: "MMD 2.0 look (ray-MMD style): semi-realistic soft fabric, subsurface skin, silky hair, cinematic rim", onclick: () => applyMmd2Look(M) }, "🎬 MMD 2.0 look"),
      el("button", { class: "btn", title: "Remove all shader overrides of this model", onclick: () => resetAll(M) }, "Reset all"),
      el("button", { class: "btn", style: "border-color:#a33", title: "SAFE MODE: every model back to original materials, ALL saved shader/Engine 2.0 settings wiped", onclick: safeResetAll }, "🧯 Safe reset"),
    ));

    // material list
    const matSel = el("select", { style: UI.list, size: "7" });
    M.entries.forEach((e, i) => {
      const ov = ovOf(e);
      const opt = el("option", { value: String(i) },
        (ov ? "● " : "") + materialDisplayName(e.name) + (ov?.preset ? ` — ${SHADER_PRESETS[ov.preset]?.label || ov.preset}` : ""));
      opt.style.cssText = "background:#14101f;color:#cfc9f2;";
      if (i === (M.selected || 0)) opt.selected = true;
      matSel.appendChild(opt);
    });
    matSel.addEventListener("change", () => {
      M.selected = parseInt(matSel.value, 10) || 0;
      rebuildUI();
    });
    box.appendChild(matSel);

    const entry = M.entries[M.selected || 0];
    if (!entry) return;
    const ov = ovOf(entry) || {};

    // preset dropdown
    const presetSel = el("select", { style: UI.select });
    for (const [id, p] of Object.entries(SHADER_PRESETS)) {
      const opt = el("option", { value: id }, p.label);
      opt.style.cssText = "background:#14101f;color:#cfc9f2;";
      if ((ov.preset || "default") === id) opt.selected = true;
      presetSel.appendChild(opt);
    }
    presetSel.addEventListener("change", () => {
      applyPreset(M, entry, presetSel.value);
      rebuildUI();
    });
    box.appendChild(el("div", { class: "row" },
      el("label", { class: "lbl", title: "Preset for this material" }, "Preset"), presetSel));

    // type override
    const typeSel = el("select", { style: UI.select + "margin:4px 0 6px" });
    for (const [id, label] of [["auto", "Type: auto"], ["diffuse", "Type: diffuse"], ["metal", "Type: metal"], ["glass", "Type: glass"], ["light", "Type: light"]]) {
      const opt = el("option", { value: id }, label);
      opt.style.cssText = "background:#14101f;color:#cfc9f2;";
      if ((ov.type || "auto") === id) opt.selected = true;
      typeSel.appendChild(opt);
    }
    typeSel.addEventListener("change", () => setOv(M, entry, { type: typeSel.value }));
    box.appendChild(typeSel);

    // sliders
    box.appendChild(slider("Coat", "Clearcoat strength — the PVC-figure gloss layer", () => ov.coat ?? 0, (n) => setOv(M, entry, { coat: n })));
    box.appendChild(slider("Coat rough", "Clearcoat roughness: 0 = mirror gloss, 1 = brushed", () => ov.coatRough ?? 0.15, (n) => setOv(M, entry, { coatRough: n })));
    box.appendChild(slider("Rim", "Grazing-angle edge light (anime/figure rim)", () => ov.rim ?? 0, (n) => setOv(M, entry, { rim: n })));
    box.appendChild(slider("Skin fill", "Fake subsurface fill — softens shadow contrast on skin", () => ov.sss ?? 0, (n) => setOv(M, entry, { sss: n })));
    box.appendChild(slider("Metal rough", "Roughness when Type = metal (also glass gloss)", () => ov.fuzz ?? 0.12, (n) => setOv(M, entry, { fuzz: n })));
    box.appendChild(slider("Glow", "Emissive boost from the base color", () => ov.emitBoost ?? 0, (n) => setOv(M, entry, { emitBoost: n }), 0, 6, 0.1));
    box.appendChild(slider("Alpha", "Material opacity (alpha-cut aware in RTX)", () => ov.alpha ?? 1, (n) => setOv(M, entry, { alpha: n })));

    // tint
    const toHex = (arr) => {
      const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
      return Array.isArray(arr) ? `#${c(arr[0])}${c(arr[1])}${c(arr[2])}` : "#ffffff";
    };
    const tintInput = el("input", { type: "color", value: toHex(ov.tint), style: "width:42px;height:22px;padding:0;border:1px solid #37305e;border-radius:4px;background:#14101f" });
    tintInput.addEventListener("input", () => {
      const v = tintInput.value;
      const r = parseInt(v.slice(1, 3), 16) / 255;
      const g = parseInt(v.slice(3, 5), 16) / 255;
      const b = parseInt(v.slice(5, 7), 16) / 255;
      setOv(M, entry, { tint: [r, g, b] });
    });
    box.appendChild(el("div", { class: "row" },
      el("label", { class: "lbl", title: "Multiplies the base color (white = unchanged)" }, "Tint"),
      tintInput,
      el("button", { class: "btn", style: "margin-left:6px", onclick: () => { setOv(M, entry, { tint: null }); rebuildUI(); } }, "×"),
    ));
  }

  /* ---------------------- Engine 2.0 settings window -------------------- */
  const E2_WIN_STYLE =
    "position:fixed;top:64px;right:18px;width:312px;max-height:82vh;overflow:auto;" +
    "z-index:99999;background:rgba(21,17,38,0.97);border:1px solid #4a3f8c;" +
    "border-radius:12px;box-shadow:0 14px 44px rgba(0,0,0,0.6);padding:12px 14px;" +
    "backdrop-filter:blur(6px);color:#d7d2f5;font-size:12px;";
  let _e2Win = null;

  function e2Set(key, val) {
    ENGINE2[key] = val;
    engine2Save();
    engine2Refresh();
  }
  function e2Slider(label, title, key, min = 0, max = 1, step = 0.01) {
    return slider(label, title, () => ENGINE2[key], (n) => e2Set(key, n), min, max, step);
  }
  // Post-FX params: lightweight path — no material rebuilds, just the pass.
  function fxSlider(label, title, key, min = 0, max = 1, step = 0.01) {
    return slider(label, title, () => ENGINE2.fx[key], (n) => {
      ENGINE2.fx[key] = n;
      engine2Save();
      try { applyFx?.(ENGINE2.fx); } catch (_) {}
    }, min, max, step);
  }
  function bloomSet(key, val) {
    ENGINE2[key] = val;
    engine2Save();
    try { applyBloom?.(ENGINE2.bloomOn, ENGINE2.bloomThreshold, ENGINE2.bloomStrength, ENGINE2.bloomRadius); } catch (_) {}
  }
  function bloomSlider(label, title, key, min = 0, max = 1, step = 0.01) {
    return slider(label, title, () => ENGINE2[key], (n) => bloomSet(key, n), min, max, step);
  }
  // Anime shadow band: shared uniforms — no rebuilds, instant on all models.
  function bandSet(key, val) {
    ENGINE2.band[key] = val;
    engine2Save();
    m2BandSync();
  }
  function bandSlider(label, title, key, min = 0, max = 1, step = 0.01) {
    return slider(label, title, () => ENGINE2.band[key], (n) => bandSet(key, n), min, max, step);
  }
  // Band look presets — ported from MMD_modoki's WGSL toon snippets
  // (balanced / hard shadow / soft pastel / poster pop / cyber neon).
  const BAND_PRESETS = {
    "Off":      { ...BAND_NEUTRAL },
    "Balanced": { amt: 0.55, pos: 0.50, soft: 0.08,  wash: 0.25, tint: [0.66, 0.60, 0.78] },
    "Hard cel": { amt: 0.70, pos: 0.55, soft: 0.004, wash: 0.45, tint: [0.55, 0.50, 0.70] },
    "Pastel":   { amt: 0.40, pos: 0.45, soft: 0.20,  wash: 0.30, tint: [0.82, 0.78, 0.86] },
    "Poster":   { amt: 0.85, pos: 0.50, soft: 0.01,  wash: 0.60, tint: [0.48, 0.42, 0.62] },
    "Neon":     { amt: 0.75, pos: 0.52, soft: 0.02,  wash: 0.35, tint: [0.30, 0.22, 0.55] },
  };
  function applyBandPreset(name) {
    const p = BAND_PRESETS[name];
    if (!p) return;
    ENGINE2.band = { ...p, tint: [...p.tint] };
    engine2Save();
    m2BandSync();
    buildEngine2Window(); // refresh sliders to the preset values
  }
  // 3D LUT: hand the raw file text to the host (it parses + binds the atlas).
  function lutLoad(text, name) {
    const size = applyLut ? applyLut(text, name) : 0;
    ENGINE2.lutName = name || "lut";
    // keep the file so the LUT survives reloads (skip absurdly large ones)
    ENGINE2.lutText = text && text.length < 400000 ? text : "";
    if (ENGINE2.fx.lutAmount <= 0.001) ENGINE2.fx.lutAmount = 1; // make it visible
    engine2Save();
    try { applyFx?.(ENGINE2.fx); } catch (_) {}
    return size;
  }
  function lutClear() {
    try { applyLut?.(null, ""); } catch (_) {}
    ENGINE2.lutName = "";
    ENGINE2.lutText = "";
    ENGINE2.fx.lutAmount = 0;
    engine2Save();
    try { applyFx?.(ENGINE2.fx); } catch (_) {}
  }
  // Restore a persisted LUT once the host pass exists (deferred to next tick
  // because the fx pass is created after the studio).
  if (ENGINE2.lutText && typeof setTimeout === "function") {
    setTimeout(() => {
      try { applyLut?.(ENGINE2.lutText, ENGINE2.lutName); } catch (_) {
        ENGINE2.lutText = ""; ENGINE2.lutName = ""; engine2Save();
      }
    }, 0);
  }
  function e2Toggle(label, title, key) {
    const cb = el("input", { type: "checkbox" });
    cb.checked = !!ENGINE2[key];
    cb.addEventListener("change", () => e2Set(key, cb.checked));
    return el("label", {
      style: "display:flex;gap:8px;align-items:center;font-size:12px;margin:6px 0 2px;cursor:pointer;color:#d7d2f5",
      title,
    }, cb, label);
  }
  function e2Section(icon, title, note = "") {
    return el("div", { style: "margin-top:10px" },
      el("div", { style: "font-size:11px;color:#9b8fd6;font-weight:700;letter-spacing:0.4px" }, `${icon} ${title}`),
      note ? el("div", { style: "font-size:10px;color:#6f679c;margin:1px 0 2px" }, note) : null);
  }

  function buildEngine2Window() {
    if (!_e2Win) return;
    const w = _e2Win;
    w.innerHTML = "";
    w.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:2px" },
      el("div", { style: "font-weight:800;font-size:13px;color:#cfc4ff" }, "⚙️ Engine 2.0 — Raster"),
      el("button", { class: "btn", title: "Close", onclick: () => { w.style.display = "none"; } }, "✕"),
    ));
    w.appendChild(el("div", { style: "font-size:10px;color:#6f679c;margin:0 0 4px" },
      "Engine-level layer on top of the classic light/FX pipeline. Applied live to every model; saved globally."));

    w.appendChild(e2Section("🚀", "Master", "layer Engine 2.0 over Original shaders (native MMD look + effects)"));
    w.appendChild(e2Toggle("Engine 2.0 over Original", "Applies the native-toon overlay to CURRENTLY loaded models when toggled. Models always LOAD with their original shaders first (textures must finish loading), so re-enable after adding a new model if you want it covered", "overlayOriginal"));

    w.appendChild(e2Section("🧭", "Normal Map", "generated from the diffuse texture (fabric/surface detail)"));
    w.appendChild(e2Toggle("Enable normal mapping", "Adds micro-relief lighting from a generated normal map", "normalOn"));
    w.appendChild(e2Slider("Strength", "Normal map intensity", "normal", 0, 2));
    w.appendChild(e2Toggle("Relief on native toon (experimental)", "Also inject generated normal/bump maps into the NATIVE MMD toon shader (MMD 2.0 mode). May recompile shaders — turn off if materials break", "toonRelief"));

    w.appendChild(e2Section("✨", "Specular Map", "bright texels get glossier (generated)"));
    w.appendChild(e2Toggle("Enable specular map", "Per-texel gloss variation from the texture", "specOn"));
    w.appendChild(e2Slider("Contrast", "How strongly brightness drives gloss", "spec", 0, 1));

    w.appendChild(e2Section("🌗", "Rim Light"));
    w.appendChild(e2Slider("Global rim", "Multiplies every material's rim value", "rimMul", 0, 3));

    w.appendChild(e2Section("🩸", "SSS"));
    w.appendChild(e2Slider("Global SSS", "Multiplies every material's skin-fill/sheen", "sssMul", 0, 3));

    w.appendChild(e2Section("🌍", "IBL", "image-based lighting (environment reflections)"));
    w.appendChild(e2Toggle("Enable IBL env (experimental)", "Adds an environment map to Figure PBR materials. three.js PMREMs it mid-frame on first use — can break programs/textures on some GPUs. Turn OFF if the render corrupts", "envOn"));
    w.appendChild(e2Slider("Intensity", "Environment reflection strength", "ibl", 0, 2.5));

    w.appendChild(e2Section("🕳", "Ambient Occlusion", "screen-space AO (SSAO)"));
    w.appendChild(e2Toggle("Enable SSAO", "Contact shadows in creases and folds", "aoOn"));
    w.appendChild(e2Slider("Radius", "AO spread", "ao", 0, 2));

    w.appendChild(e2Section("💠", "Refraction", "real transmission for glass-type materials (heavier)"));
    w.appendChild(e2Slider("Strength", "0 = stable transparent approximation, 1 = full refraction", "refraction", 0, 1));

    w.appendChild(e2Section("🧱", "Parallax", "pseudo-depth from the generated height map"));
    w.appendChild(e2Slider("Depth", "Bump-parallax depth", "parallax", 0, 1));

    w.appendChild(e2Section("💇", "Anisotropic Hair", "stretched highlight along hair strands"));
    w.appendChild(e2Toggle("Enable anisotropy", "Physical anisotropic specular on hair materials", "anisoOn"));
    w.appendChild(e2Slider("Strength", "Anisotropy amount", "aniso", 0, 1));
    w.appendChild(e2Slider("Direction", "Highlight rotation", "anisoRot", 0, 3.14));

    w.appendChild(e2Section("🌸", "Bloom", "glow around bright areas (UnrealBloom)"));
    const bloomCb = el("input", { type: "checkbox" });
    bloomCb.checked = !!ENGINE2.bloomOn;
    bloomCb.addEventListener("change", () => bloomSet("bloomOn", bloomCb.checked));
    w.appendChild(el("label", { style: "display:flex;gap:8px;align-items:center;font-size:12px;margin:6px 0 2px;cursor:pointer;color:#d7d2f5" }, bloomCb, "Enable bloom"));
    w.appendChild(bloomSlider("Threshold", "Brightness where glow starts", "bloomThreshold", 0, 1.5));
    w.appendChild(bloomSlider("Strength", "Glow intensity", "bloomStrength", 0, 3));
    w.appendChild(bloomSlider("Radius", "Glow spread", "bloomRadius", 0, 1));

    w.appendChild(e2Section("🎭", "Anime Shadow Band",
      "MMD_modoki-style cel shadow — works on MMD 2.0 / overlay materials"));
    const bandRow = el("div", { style: "display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 2px" });
    for (const name of Object.keys(BAND_PRESETS)) {
      bandRow.appendChild(el("button", {
        class: "btn",
        style: "font-size:10px;padding:2px 7px",
        title: name === "Off" ? "Disable the band (neutral)" : `Band look: ${name}`,
        onclick: () => applyBandPreset(name),
      }, name));
    }
    w.appendChild(bandRow);
    w.appendChild(bandSlider("Amount", "Shadow-side tinting strength. 0 = band off", "amt", 0, 1));
    w.appendChild(bandSlider("Position", "Where the cel edge sits on the terminator (0.5 = geometric)", "pos", 0.05, 0.95));
    w.appendChild(bandSlider("Softness", "Edge width: 0 = razor cel step, high = painterly gradient", "soft", 0, 0.5, 0.002));
    w.appendChild(bandSlider("Flat wash", "Flattens the lit side toward pure albedo — the flat anime brightness", "wash", 0, 1));
    const bandToHex = (arr) => {
      const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
      return `#${c(arr[0])}${c(arr[1])}${c(arr[2])}`;
    };
    const bandTintInput = el("input", { type: "color", value: bandToHex(ENGINE2.band.tint),
      style: "width:42px;height:22px;padding:0;border:1px solid #37305e;border-radius:4px;background:#14101f" });
    bandTintInput.addEventListener("input", () => {
      const v = bandTintInput.value;
      bandSet("tint", [
        parseInt(v.slice(1, 3), 16) / 255,
        parseInt(v.slice(3, 5), 16) / 255,
        parseInt(v.slice(5, 7), 16) / 255,
      ]);
    });
    w.appendChild(el("div", { class: "row" },
      el("label", { class: "lbl", title: "Color the shadow side is multiplied by — violet/pink = modern anime" }, "Shadow tint"),
      bandTintInput));

    w.appendChild(e2Section("🎞", "3D LUT", "professional color grade from .cube / .3dl files"));
    const lutStatus = el("div", { style: "font-size:10px;color:#9b8fd6;margin:2px 0" },
      ENGINE2.lutName ? `Loaded: ${ENGINE2.lutName}` : "No LUT loaded");
    // built-in LUTs shipped in ./lut/ (from MMD_modoki) — one-click load
    const LUT_BUILTINS = ["anime-cool", "anime-dramatic", "anime-soft", "monotone", "sepia", "teal-orange"];
    const lutRow = el("div", { style: "display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 2px" });
    for (const name of LUT_BUILTINS) {
      lutRow.appendChild(el("button", {
        class: "btn",
        style: "font-size:10px;padding:2px 7px",
        title: `Load the built-in ${name}.3dl grade`,
        onclick: () => {
          fetch(`./lut/${name}.3dl`)
            .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
            .then((text) => {
              const size = lutLoad(text, name + ".3dl");
              lutStatus.textContent = `Loaded: ${name}.3dl (${size}³)`;
              buildEngine2Window();
            })
            .catch((e) => {
              lutStatus.textContent = "Error: " + (e && e.message ? e.message : "failed to fetch LUT");
            });
        },
      }, name));
    }
    w.appendChild(lutRow);
    const lutFile = el("input", { type: "file", accept: ".cube,.3dl", style: "display:none" });
    lutFile.addEventListener("change", () => {
      const f = lutFile.files && lutFile.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const size = lutLoad(String(rd.result), f.name);
          lutStatus.textContent = `Loaded: ${f.name} (${size}³)`;
          buildEngine2Window();
        } catch (e) {
          lutStatus.textContent = "Error: " + (e && e.message ? e.message : "bad LUT file");
        }
      };
      rd.readAsText(f);
    });
    w.appendChild(lutFile);
    w.appendChild(el("div", { style: "display:flex;gap:6px;align-items:center;margin:2px 0" },
      el("button", { class: "btn", title: "Load a .cube or .3dl LUT file", onclick: () => lutFile.click() }, "📂 Load LUT…"),
      el("button", { class: "btn", title: "Remove the LUT", onclick: () => { lutClear(); buildEngine2Window(); } }, "✕ Clear"),
    ));
    w.appendChild(lutStatus);
    w.appendChild(fxSlider("LUT amount", "Blend between the graded and original image", "lutAmount", 0, 1));

    w.appendChild(e2Section("🎨", "Color Grade", "cinematic color pipeline (post)"));
    w.appendChild(fxSlider("Exposure", "Stops, 0 = neutral", "exposure", -3, 3, 0.05));
    w.appendChild(fxSlider("Contrast", "0 = neutral", "contrast", -1, 1, 0.02));
    w.appendChild(fxSlider("Saturation", "-1 = grayscale, 0 = neutral", "saturation", -1, 1, 0.02));
    w.appendChild(fxSlider("Vibrance", "Boosts only muted colors", "vibrance", 0, 1));
    w.appendChild(fxSlider("Temperature", "cold ← 0 → warm", "temperature", -1, 1, 0.02));
    w.appendChild(fxSlider("Tint G–M", "magenta ← 0 → green", "tintGM", -1, 1, 0.02));
    w.appendChild(fxSlider("Gamma", "1 = neutral", "gamma", 0.25, 2.5, 0.01));
    w.appendChild(fxSlider("Lift (shadows)", "Raises/crushes shadows", "lift", -1, 1, 0.02));
    w.appendChild(fxSlider("Highlight roll-off", "Filmic soft clip of bright areas", "rolloff", 0, 1));
    w.appendChild(fxSlider("Split: shadows", "Shadow toning, cool ← 0 → warm", "splitShadows", -1, 1, 0.02));
    w.appendChild(fxSlider("Split: highlights", "Highlight toning, cool ← 0 → warm", "splitHighs", -1, 1, 0.02));
    w.appendChild(fxSlider("Hue shift", "Rotates all hues, degrees", "hueShift", -180, 180, 1));
    w.appendChild(fxSlider("Sepia", "Classic sepia mix", "sepia", 0, 1));
    w.appendChild(fxSlider("Invert", "Negative mix", "invert", 0, 1));
    w.appendChild(fxSlider("Levels: black", "Black point", "levelsBlack", 0, 0.5, 0.01));
    w.appendChild(fxSlider("Levels: white", "White point", "levelsWhite", 0.5, 1, 0.01));
    w.appendChild(fxSlider("Gain R", "Red channel gain", "gainR", 0, 2, 0.02));
    w.appendChild(fxSlider("Gain G", "Green channel gain", "gainG", 0, 2, 0.02));
    w.appendChild(fxSlider("Gain B", "Blue channel gain", "gainB", 0, 2, 0.02));

    w.appendChild(e2Section("🔭", "Lens FX", "physical lens artifacts (post)"));
    w.appendChild(fxSlider("Vignette", "Darkened frame corners", "vignette", 0, 1));
    w.appendChild(fxSlider("Vignette shape", "0 = circle, 1 = follows aspect", "vignetteRound", 0, 1));
    w.appendChild(fxSlider("Chromatic ab.", "RGB split toward the edges", "chroma", 0, 1));
    w.appendChild(fxSlider("Distortion", "pincushion ← 0 → barrel", "barrel", -0.5, 0.5, 0.01));
    w.appendChild(fxSlider("Letterbox", "Cinema bars", "letterbox", 0, 1));

    w.appendChild(e2Section("🌀", "Focus / Blur", "screen-space focus effects (post)"));
    w.appendChild(fxSlider("Radial blur", "Zoom blur toward a point", "radialBlur", 0, 1));
    w.appendChild(fxSlider("Radial center X", "Zoom blur origin X", "radialCX", 0, 1));
    w.appendChild(fxSlider("Radial center Y", "Zoom blur origin Y", "radialCY", 0, 1));
    w.appendChild(fxSlider("Motion blur", "Directional smear", "motionBlur", 0, 1));
    w.appendChild(fxSlider("Motion angle", "Smear direction, radians", "motionAngle", 0, 3.14, 0.01));
    w.appendChild(fxSlider("Tilt-shift", "Miniature look: sharp band, blurred rest", "tiltShift", 0, 1));
    w.appendChild(fxSlider("Tilt position", "Sharp band center (0=bottom, 1=top)", "tiltPos", 0, 1));
    w.appendChild(fxSlider("Tilt width", "Sharp band width", "tiltWidth", 0.05, 1, 0.01));
    w.appendChild(fxSlider("Frosted glass", "Random-offset diffusion", "frost", 0, 1));

    w.appendChild(e2Section("🖌", "Stylization", "toon / print / relief looks (post)"));
    w.appendChild(fxSlider("Edge ink", "Dark outlines on edges (manga ink)", "edge", 0, 1));
    w.appendChild(fxSlider("Edge threshold", "Edge sensitivity", "edgeThreshold", 0.05, 1, 0.01));
    w.appendChild(fxSlider("Halftone", "Print dot pattern", "halftone", 0, 1));
    w.appendChild(fxSlider("Halftone size", "Dot cell size, px", "halftoneSize", 2, 16, 0.5));
    w.appendChild(fxSlider("Duotone", "Two-color remap by brightness", "duotone", 0, 1));
    w.appendChild(fxSlider("Duotone hue A", "Dark tone hue", "duoHueA", 0, 1, 0.01));
    w.appendChild(fxSlider("Duotone hue B", "Bright tone hue", "duoHueB", 0, 1, 0.01));
    w.appendChild(fxSlider("Emboss", "Relief carving look", "emboss", 0, 1));

    w.appendChild(e2Section("📺", "Glitch / Distort", "analog & digital damage (post)"));
    w.appendChild(fxSlider("Wave", "Sine wave warping", "wave", 0, 1));
    w.appendChild(fxSlider("Wave frequency", "Wave density", "waveFreq", 1, 40, 0.5));
    w.appendChild(fxSlider("Wave speed", "Wave animation speed", "waveSpeed", 0, 5, 0.1));
    w.appendChild(fxSlider("Glitch", "Digital row tearing + RGB split", "glitch", 0, 1));
    w.appendChild(fxSlider("Glitch speed", "Glitch tick rate", "glitchSpeed", 0.1, 5, 0.1));
    w.appendChild(fxSlider("Shake", "Camera shake", "shake", 0, 1));
    w.appendChild(fxSlider("Shake speed", "Shake frequency", "shakeSpeed", 1, 30, 0.5));
    w.appendChild(fxSlider("Mirror X", "Kaleidoscope-style horizontal mirror", "mirrorX", 0, 1, 1));
    w.appendChild(fxSlider("Swirl", "Twist around the center", "swirl", 0, 1));
    w.appendChild(fxSlider("Swirl radius", "Twist falloff radius", "swirlRadius", 0.1, 1, 0.01));

    w.appendChild(e2Section("🌫", "Atmosphere", "light & weather overlays (post)"));
    w.appendChild(fxSlider("God rays", "Volumetric light shafts (GPU Gems 3 algorithm)", "rays", 0, 1));
    w.appendChild(fxSlider("Bind to sun", "1 = shaft origin auto-tracks the REAL sun and fades when it leaves the frame (like in games); 0 = manual center below", "raysAuto", 0, 1, 1));
    w.appendChild(fxSlider("Rays decay", "Shaft falloff", "raysDecay", 0.7, 0.99, 0.01));
    w.appendChild(fxSlider("Rays center X", "Manual shaft origin X (Bind to sun = 0)", "raysCX", 0, 1));
    w.appendChild(fxSlider("Rays center Y", "Manual shaft origin Y (Bind to sun = 0)", "raysCY", 0, 1));
    w.appendChild(fxSlider("Light leaks", "Film-style drifting emulsion leaks", "leaks", 0, 1));
    w.appendChild(fxSlider("Fog", "Domain-warped billowing fog banks, lit toward the sun", "fog", 0, 1));
    w.appendChild(fxSlider("Fog height", "Where the fog band sits", "fogHeight", 0, 1));
    w.appendChild(fxSlider("Frost edges", "Crystalline ice growing from the frame", "frostEdge", 0, 1));
    w.appendChild(fxSlider("Rain on lens", "Heartfelt rain: refracting drops + fogged glass", "rain", 0, 1));
    w.appendChild(fxSlider("Rain speed", "Droplet fall speed", "rainSpeed", 0.1, 4, 0.1));
    w.appendChild(fxSlider("Snow", "Just Snow: 12 parallax flake layers with DOF", "snow", 0, 1));
    w.appendChild(fxSlider("Snow speed", "Fall speed", "snowSpeed", 0.1, 3, 0.1));
    w.appendChild(fxSlider("Snow wind", "Horizontal wind drift", "snowWind", -1, 1, 0.05));
    w.appendChild(fxSlider("Dust & scratches", "Old Film projector damage", "dust", 0, 1));

    w.appendChild(e2Section("🎞", "Film FX", "grain / retro / clarity (post)"));
    w.appendChild(fxSlider("Grain", "Animated film grain", "grain", 0, 1));
    w.appendChild(fxSlider("Grain size", "Grain cell size, px", "grainSize", 1, 4, 0.1));
    w.appendChild(fxSlider("Scanlines", "CRT scanlines", "scanlines", 0, 1));
    w.appendChild(fxSlider("Posterize", "0 = off; color levels", "posterize", 0, 16, 1));
    w.appendChild(fxSlider("Pixelate", "0 = off; pixel size", "pixelate", 0, 32, 1));
    w.appendChild(fxSlider("Sharpen", "Unsharp-mask clarity", "sharpen", 0, 2));

    w.appendChild(el("div", { style: "display:flex;gap:6px;margin-top:12px" },
      el("button", { class: "btn", title: "Back to the default Engine 2.0 setup", onclick: () => {
        Object.assign(ENGINE2, {
          overlayOriginal: false, toonRelief: false, envOn: false,
          normalOn: true, normal: 0.8, specOn: true, spec: 0.7,
          rimMul: 1.0, sssMul: 1.0, ibl: 1.0, aoOn: false, ao: 0.6,
          refraction: 0, parallax: 0.35, anisoOn: true, aniso: 0.55, anisoRot: 0,
          bloomOn: false, bloomThreshold: 0.85, bloomStrength: 0.3, bloomRadius: 0.4,
          fx: { ...FX_NEUTRAL },
          band: { ...BAND_NEUTRAL, tint: [...BAND_NEUTRAL.tint] },
          lutName: "", lutText: "",
        });
        m2BandSync();
        try { applyLut?.(null, ""); } catch (_) {}
        engine2Save();
        engine2Refresh();
        buildEngine2Window();
      } }, "Reset defaults"),
      el("button", { class: "btn", onclick: () => { _e2Win.style.display = "none"; } }, "Close"),
    ));
  }

  function openEngine2Window() {
    if (typeof document === "undefined") return;
    if (!_e2Win) {
      _e2Win = el("div", { style: E2_WIN_STYLE });
      document.body.appendChild(_e2Win);
    }
    _e2Win.style.display = "block";
    buildEngine2Window();
  }

  function cloneEffectValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) {}
    }
    if (Array.isArray(value)) return value.map(cloneEffectValue);
    if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneEffectValue(entry)]));
    }
    // Textures/colors and other Three.js objects are immutable references in
    // the override payload. Preserve them instead of serializing GPU objects.
    return value;
  }

  function getEffectTarget() {
    const M = activeModel();
    return M ? { kind: "model", id: M.name || "model", ref: M.mesh } : null;
  }

  function captureEffectState() {
    const M = activeModel();
    if (!M) return null;
    return {
      schema: "animestage.shader-studio-snapshot/v1",
      model: M,
      activeIndex: S.active,
      rasterMode: M.rasterMode,
      modeManual: !!M.modeManual,
      selected: M.selected,
      overrides: M.entries.map((entry) => ({
        key: entry.key,
        value: cloneEffectValue(entry.mat.userData?.rtx ?? null),
      })),
    };
  }

  function restoreEffectState(snapshot) {
    if (!snapshot) return;
    if (snapshot.schema !== "animestage.shader-studio-snapshot/v1") {
      throw new TypeError("Shader Studio effect snapshot is invalid");
    }
    const M = snapshot.model;
    const index = S.models.indexOf(M);
    if (index < 0) throw new Error("The effect target model is no longer loaded");
    S.active = index;
    const byKey = new Map(snapshot.overrides.map((record) => [record.key, record.value]));
    for (const entry of M.entries) {
      entry.mat.userData = entry.mat.userData || {};
      const value = byKey.get(entry.key);
      if (value == null) delete entry.mat.userData.rtx;
      else entry.mat.userData.rtx = cloneEffectValue(value);
    }
    M.modeManual = snapshot.modeManual;
    M.selected = snapshot.selected;
    setRasterMode(snapshot.rasterMode, M, false);
    requestRepack?.();
  }

  function applyEffectMode(mode) {
    const M = activeModel();
    if (!M) throw new Error("Load a model before applying a material effect");
    if (mode === "figure") applyFigureLook(M);
    else if (mode === "mmd2") applyMmd2Look(M);
    else setRasterMode("original", M, true);
    return getEffectTarget();
  }

  function setLibraryExtension(renderer) {
    if (renderer != null && typeof renderer !== "function") {
      throw new TypeError("Shader Studio library extension must be a function");
    }
    libraryExtension = renderer || null;
    rebuildUI();
  }

  return {
    onModelLoaded,
    rebuildUI,
    applyFigureLook,
    applyMmd2Look,
    resetAll,
    safeResetAll,
    setRasterMode,
    openEngine2Window,
    getEffectTarget,
    captureEffectState,
    restoreEffectState,
    applyEffectMode,
    setLibraryExtension,
  };
}
