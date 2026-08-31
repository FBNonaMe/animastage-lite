import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "../..");
const htmlPath = resolve(appRoot, "mmd_rtx.html");
const cssPath = resolve(here, "flow-ui.css");
const controllerPath = resolve(here, "FlowInterfaceController.js");
const bootstrapPath = resolve(here, "flow-bootstrap.js");

const [html, css, controller, bootstrap] = await Promise.all([
    readFile(htmlPath, "utf8"),
    readFile(cssPath, "utf8"),
    readFile(controllerPath, "utf8"),
    readFile(bootstrapPath, "utf8"),
]);

function occurrences(source, token) {
    return source.split(token).length - 1;
}

function balancedBraces(source) {
    const stripped = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    let depth = 0;
    for (const char of stripped) {
        if (char === "{") depth += 1;
        if (char === "}") depth -= 1;
        if (depth < 0) return false;
    }
    return depth === 0;
}

assert.equal(occurrences(html, "animestage-next/ui/flow-ui.css"), 1, "Flow stylesheet must be loaded once");
assert.equal(occurrences(html, "animestage-next/ui/flow-bootstrap.js"), 1, "Flow bootstrap must be loaded once");
assert.ok(html.includes('id="topBar"'), "Real top toolbar must remain present");
assert.ok(html.includes('id="stage"'), "Real viewport must remain present");
assert.ok(html.includes('id="panel"'), "Real inspector must remain present");
assert.ok(html.includes('id="timelineModeSwitch"'), "Real unified timeline must remain present");
assert.ok(balancedBraces(css), "Flow stylesheet braces must be balanced");

for (const token of [
    "--flow-camera",
    "--flow-face",
    "--flow-hands",
    "--flow-physics",
    "data-flow-motion",
    ".flow-drawer",
    ".flow-toast",
    ".flow-command-palette",
]) {
    assert.ok(css.includes(token), `Missing design-system token: ${token}`);
}

for (const token of [
    "normalizePreferences",
    "animestage.flow-ui.preferences.v1",
    "animestage:flow-layout",
    "Reduced motion",
    "Reset workspace",
    "window.__animeStageFlow",
    "Command palette",
]) {
    assert.ok(controller.includes(token), `Missing Flow controller behavior: ${token}`);
}

assert.ok(bootstrap.includes("createFlowInterfaceController"), "Bootstrap must create the real controller");
const module = await import(`${pathToFileURL(controllerPath).href}?test=${Date.now()}`);
assert.equal(typeof module.createFlowInterfaceController, "function", "Controller export must be callable");

console.log("AnimeStage Flow UI static contract: PASS");
