import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const html = await readFile(path.join(root, "mmd_rtx.html"), "utf8");
const studio = await readFile(path.join(root, "rtx-material-studio.js"), "utf8");
const css = await readFile(path.join(here, "ui", "effects-library.css"), "utf8");
const panel = await readFile(path.join(here, "ui", "EffectsLibraryPanel.js"), "utf8");
const rayAdapter = await readFile(path.join(root, "assets", "effects-library", "third-party", "ray-cast", "ray-mmd", "1.5.2", "adapted", "ray-color-grading-pass.js"), "utf8");
const rayBloomAdapter = await readFile(path.join(root, "assets", "effects-library", "third-party", "ray-cast", "ray-mmd", "1.5.2", "adapted", "ray-bloom-pass.js"), "utf8");

assert.match(html, /createEffectsPlatform/);
assert.match(html, /window\.__animaStageEffects/);
assert.match(html, /effects-library\.css/);
assert.match(html, /RayColorGradingPass/);
assert.match(html, /RayBloomPass/);
assert.match(html, /"ray\.color-grading": rayColorGradingPass/);
assert.match(html, /"ray\.hdr-bloom": rayBloomPass/);
assert.match(studio, /captureEffectState/);
assert.match(studio, /restoreEffectState/);
assert.match(studio, /setLibraryExtension/);
assert.match(css, /\.as-effects-library/);
assert.match(css, /\.as-effect-inspector/);
assert.match(panel, /is already active/);
assert.match(rayAdapter, /Source revision: a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8/);
assert.match(rayBloomAdapter, /Source revision: a425ab6d4219a047f8d64ac7fdc4f73c76c31dc8/);

console.log("AnimaStage Effects Platform live integration contract: PASS");
