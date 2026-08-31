const STORAGE_KEY = "animestage.flow-ui.preferences.v1";
const LAYOUT_KEY = "animastage.ui2.layout.v1";

const DEFAULTS = Object.freeze({
    theme: "midnight",
    accent: "#7c5cff",
    scale: 1,
    fontSize: 14,
    radius: 10,
    glow: 0.58,
    panelAlpha: 0.97,
    density: "comfortable",
    motion: "full",
    contrast: "normal",
});

const THEMES = Object.freeze({
    midnight: { label: "Midnight Cinema", accent: "#7c5cff" },
    oled: { label: "OLED Black", accent: "#8a68ff" },
    neutral: { label: "Neutral Pro", accent: "#6887ff" },
    violet: { label: "Violet Studio", accent: "#a35cff" },
});

const LAYOUTS = Object.freeze({
    animation: { label: "Animation", leftWidth: 220, inspectorWidth: 390, timelineHeight: 300 },
    cinematic: { label: "Camera / Shots", leftWidth: 188, inspectorWidth: 370, timelineHeight: 230 },
    materials: { label: "Materials", leftWidth: 188, inspectorWidth: 500, timelineHeight: 220 },
    compact: { label: "Compact", leftWidth: 176, inspectorWidth: 330, timelineHeight: 220 },
});

function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function safeEnum(value, values, fallback) {
    return values.includes(value) ? value : fallback;
}

function safeColor(value, fallback = DEFAULTS.accent) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
}

function hexToRgb(hex) {
    const value = safeColor(hex).slice(1);
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function normalizePreferences(raw = {}) {
    return {
        theme: safeEnum(raw.theme, Object.keys(THEMES), DEFAULTS.theme),
        accent: safeColor(raw.accent),
        scale: clamp(raw.scale, 0.85, 1.25, DEFAULTS.scale),
        fontSize: clamp(raw.fontSize, 12, 17, DEFAULTS.fontSize),
        radius: clamp(raw.radius, 3, 18, DEFAULTS.radius),
        glow: clamp(raw.glow, 0, 1, DEFAULTS.glow),
        panelAlpha: clamp(raw.panelAlpha, 0.78, 1, DEFAULTS.panelAlpha),
        density: safeEnum(raw.density, ["comfortable", "compact"], DEFAULTS.density),
        motion: safeEnum(raw.motion, ["full", "reduced", "off"], DEFAULTS.motion),
        contrast: safeEnum(raw.contrast, ["normal", "high"], DEFAULTS.contrast),
    };
}

function loadJson(key, fallback = {}) {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") || fallback;
    } catch (_) {
        return fallback;
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (_) {
        return false;
    }
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(label, className = "flow-button") {
    const node = element("button", className, label);
    node.type = "button";
    return node;
}

function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createFlowInterfaceController({ root = document.documentElement } = {}) {
    let preferences = normalizePreferences(loadJson(STORAGE_KEY));
    let open = false;
    let destroyed = false;
    const disposers = [];

    const listen = (target, type, handler, options) => {
        if (!target) return;
        target.addEventListener(type, handler, options);
        disposers.push(() => target.removeEventListener(type, handler, options));
    };

    const toastHost = element("div", "flow-toast-host");
    toastHost.setAttribute("aria-live", "polite");
    document.body.append(toastHost);

    const showToast = (message) => {
        const toast = element("div", "flow-toast", message);
        toastHost.append(toast);
        setTimeout(() => {
            toast.classList.add("out");
            setTimeout(() => toast.remove(), 220);
        }, 1800);
    };

    const applyPreferences = ({ persist = true, announce = false } = {}) => {
        preferences = normalizePreferences(preferences);
        const rgb = hexToRgb(preferences.accent);
        root.dataset.flowTheme = preferences.theme;
        root.dataset.flowDensity = preferences.density;
        root.dataset.flowMotion = preferences.motion;
        root.dataset.flowContrast = preferences.contrast;
        root.style.setProperty("--flow-accent", preferences.accent);
        root.style.setProperty("--flow-accent-hi", `color-mix(in srgb, ${preferences.accent} 72%, white)`);
        root.style.setProperty("--flow-accent-rgb", rgb.join(", "));
        root.style.setProperty("--flow-scale", String(preferences.scale));
        root.style.setProperty("--flow-font-size", `${preferences.fontSize}px`);
        root.style.setProperty("--flow-radius", `${preferences.radius}px`);
        root.style.setProperty("--flow-radius-sm", `${Math.max(3, preferences.radius - 3)}px`);
        root.style.setProperty("--flow-glow", String(preferences.glow));
        root.style.setProperty("--flow-panel-alpha", String(preferences.panelAlpha));
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", preferences.theme === "oled" ? "#000000" : "#070812");
        if (persist) saveJson(STORAGE_KEY, preferences);
        if (announce) showToast("Appearance saved");
        document.dispatchEvent(new CustomEvent("animestage:flow-preferences", { detail: { ...preferences } }));
    };

    applyPreferences({ persist: false });

    const appearanceButton = element("button", "shell-icon-btn flow-appearance-trigger");
    appearanceButton.type = "button";
    appearanceButton.id = "flowAppearance";
    appearanceButton.title = "Appearance & workspace (Shift+T)";
    appearanceButton.setAttribute("aria-label", "Appearance and workspace");
    appearanceButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.4a1.8 1.8 0 0 0 0-3.6h-.7a1.5 1.5 0 0 1 0-3h2.8A5.5 5.5 0 0 0 21 9c0-3.3-4-6-9-6Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7" r="1"/><circle cx="17" cy="10.5" r="1"/></svg>';
    const topMode = document.querySelector("#topBar .top-mode");
    const existingSettings = topMode?.querySelector('[data-ui-jump="settings"]');
    topMode?.insertBefore(appearanceButton, existingSettings || null);

    const commandButton = element("button", "shell-icon-btn flow-command-trigger");
    commandButton.type = "button";
    commandButton.id = "flowCommandTrigger";
    commandButton.title = "Command palette (Ctrl+K)";
    commandButton.setAttribute("aria-label", "Open command palette");
    commandButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>';
    topMode?.insertBefore(commandButton, appearanceButton);

    const backdrop = element("div", "flow-backdrop");
    const drawer = element("aside", "flow-drawer");
    drawer.id = "flowAppearanceDrawer";
    drawer.setAttribute("aria-label", "Appearance and workspace settings");
    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.tabIndex = -1;
    document.body.append(backdrop, drawer);

    const commandOverlay = element("div", "flow-command-overlay");
    const commandPalette = element("section", "flow-command-palette");
    commandPalette.setAttribute("role", "dialog");
    commandPalette.setAttribute("aria-modal", "true");
    commandPalette.setAttribute("aria-label", "Command palette");
    const commandSearchWrap = element("div", "flow-command-search-wrap");
    commandSearchWrap.append(element("span", "flow-command-mark", "⌕"));
    const commandSearch = element("input", "flow-command-search");
    commandSearch.type = "search";
    commandSearch.placeholder = "Search tools, workspaces and actions…";
    commandSearch.setAttribute("aria-label", "Search commands");
    commandSearchWrap.append(commandSearch, element("span", "flow-command-shortcut", "Ctrl K"));
    const commandList = element("div", "flow-command-list");
    commandList.setAttribute("role", "listbox");
    const commandFooter = element("div", "flow-command-footer");
    commandFooter.innerHTML = "<span>↑↓ Navigate</span><span>Enter Run</span><span>Esc Close</span>";
    commandPalette.append(commandSearchWrap, commandList, commandFooter);
    commandOverlay.append(commandPalette);
    document.body.append(commandOverlay);

    const commandDefinitions = [
        ["Animate workspace", "Body animation and unified timeline", "Animate", () => document.querySelector('#topBar [data-ui-jump="animation"]')?.click()],
        ["Face Studio", "Expressions, gaze and micro motion", "Face", () => document.querySelector('#topBar [data-ui-jump="face"]')?.click()],
        ["Camera workspace", "Shots, focus and cinematic camera", "Camera", () => document.querySelector('#topBar [data-ui-jump="camera"]')?.click()],
        ["Physics workspace", "Hair, cloth and rigid-body simulation", "Physics", () => document.querySelector('#topBar [data-ui-jump="physics"]')?.click()],
        ["Smart Pose", "IK controllers and pose editing", "Pose", () => document.querySelector('#topBar [data-ui-jump="smartpose"]')?.click()],
        ["Render workspace", "Raster, NPR, RTX and export", "Render", () => document.querySelector('#topBar [data-ui-jump="render"]')?.click()],
        ["Import model", "Load PMX / PMD character", "Import", () => document.querySelector("#btnPickModel")?.click()],
        ["Import model folder", "Load a model with its texture folder", "Import", () => document.querySelector("#btnPickFolder")?.click()],
        ["Import ZIP pack", "Load a packaged character or scene", "Import", () => document.querySelector("#btnPickZip")?.click()],
        ["Import VMD motion", "Add animation to the motion library", "Import", () => document.querySelector("#btnPickVmd")?.click()],
        ["Save session", "Export the current AnimeStage session", "Project", () => document.querySelector("#shellSaveSession")?.click()],
        ["Load session", "Restore an AnimeStage session", "Project", () => document.querySelector("#shellLoadSession")?.click()],
        ["Frame selected model", "Move the camera to the active subject", "Viewport", () => document.querySelector("#btnFrame")?.click()],
        ["Capture screenshot", "Save the current viewport image", "Viewport", () => document.querySelector("#btnScreenshot")?.click()],
        ["Appearance & workspace", "Themes, layout, scale and motion", "Setup", () => setOpen(true)],
    ].map(([label, description, group, run], index) => ({ id: `flow-command-${index}`, label, description, group, run }));
    let commandOpen = false;
    let activeCommandIndex = 0;
    let filteredCommands = commandDefinitions;

    function renderCommands() {
        const query = commandSearch.value.trim().toLowerCase();
        filteredCommands = commandDefinitions.filter((command) =>
            !query || `${command.label} ${command.description} ${command.group}`.toLowerCase().includes(query),
        );
        activeCommandIndex = Math.max(0, Math.min(activeCommandIndex, filteredCommands.length - 1));
        commandList.replaceChildren();
        if (!filteredCommands.length) {
            commandList.append(element("div", "flow-command-empty", "No matching commands"));
            return;
        }
        filteredCommands.forEach((command, index) => {
            const entry = element("button", `flow-command-item${index === activeCommandIndex ? " active" : ""}`);
            entry.type = "button";
            entry.dataset.commandId = command.id;
            entry.setAttribute("role", "option");
            entry.setAttribute("aria-selected", String(index === activeCommandIndex));
            entry.append(element("span", "flow-command-icon", command.label.slice(0, 1)));
            const copy = element("span", "flow-command-copy");
            copy.append(element("strong", "", command.label), element("span", "", command.description));
            entry.append(copy, element("span", "flow-command-group", command.group));
            entry.addEventListener("mouseenter", () => {
                activeCommandIndex = index;
                renderCommands();
            }, { once: true });
            entry.addEventListener("click", () => runCommand(index));
            commandList.append(entry);
        });
    }

    function setCommandOpen(next) {
        commandOpen = !!next;
        commandOverlay.classList.toggle("open", commandOpen);
        commandButton.setAttribute("aria-expanded", String(commandOpen));
        if (commandOpen) {
            if (open) setOpen(false);
            commandSearch.value = "";
            activeCommandIndex = 0;
            renderCommands();
            requestAnimationFrame(() => commandSearch.focus());
        } else {
            commandButton.focus({ preventScroll: true });
        }
    }

    function runCommand(index = activeCommandIndex) {
        const command = filteredCommands[index];
        if (!command) return;
        setCommandOpen(false);
        command.run();
        if (command.label !== "Appearance & workspace") showToast(command.label);
    }

    const header = element("div", "flow-drawer-header");
    const title = element("div", "flow-drawer-title");
    title.append(element("strong", "", "Appearance & Workspace"));
    title.append(element("span", "", "Live theme, motion and layout controls"));
    const closeButton = button("×", "flow-button flow-close");
    closeButton.setAttribute("aria-label", "Close appearance settings");
    header.append(title, closeButton);
    drawer.append(header);

    const themeSection = element("section", "flow-section");
    themeSection.append(element("div", "flow-section-title", "Visual theme"));
    const presetGrid = element("div", "flow-preset-grid");
    const presetButtons = new Map();
    Object.entries(THEMES).forEach(([key, preset]) => {
        const entry = button(preset.label, "flow-button flow-preset");
        entry.dataset.theme = key;
        entry.style.setProperty("--preset-color", preset.accent);
        presetButtons.set(key, entry);
        presetGrid.append(entry);
    });
    themeSection.append(presetGrid);
    drawer.append(themeSection);

    const controlsSection = element("section", "flow-section");
    controlsSection.append(element("div", "flow-section-title", "Interface tuning"));
    const controls = new Map();

    function addControl(key, label, input, format) {
        const row = element("div", "flow-control");
        input.id = `flow-control-${key}`;
        const labelNode = element("label", "", label);
        labelNode.htmlFor = input.id;
        row.append(labelNode);
        const box = element("div", "");
        box.append(input);
        if (format) box.append(element("div", "flow-value"));
        row.append(box);
        controlsSection.append(row);
        controls.set(key, { input, value: box.querySelector(".flow-value"), format });
    }

    const accent = document.createElement("input");
    accent.type = "color";
    addControl("accent", "Accent color", accent);

    const scale = document.createElement("input");
    Object.assign(scale, { type: "range", min: "0.85", max: "1.25", step: "0.01" });
    addControl("scale", "UI scale", scale, (value) => `${Math.round(Number(value) * 100)}%`);

    const fontSize = document.createElement("input");
    Object.assign(fontSize, { type: "range", min: "12", max: "17", step: "1" });
    addControl("fontSize", "Text size", fontSize, (value) => `${value}px`);

    const radius = document.createElement("input");
    Object.assign(radius, { type: "range", min: "3", max: "18", step: "1" });
    addControl("radius", "Corner radius", radius, (value) => `${value}px`);

    const glow = document.createElement("input");
    Object.assign(glow, { type: "range", min: "0", max: "1", step: "0.01" });
    addControl("glow", "Accent glow", glow, (value) => `${Math.round(Number(value) * 100)}%`);

    const panelAlpha = document.createElement("input");
    Object.assign(panelAlpha, { type: "range", min: "0.78", max: "1", step: "0.01" });
    addControl("panelAlpha", "Panel opacity", panelAlpha, (value) => `${Math.round(Number(value) * 100)}%`);

    const density = document.createElement("select");
    density.innerHTML = '<option value="comfortable">Comfortable</option><option value="compact">Compact</option>';
    addControl("density", "Control density", density);

    const motion = document.createElement("select");
    motion.innerHTML = '<option value="full">Full motion</option><option value="reduced">Reduced motion</option><option value="off">Motion off</option>';
    addControl("motion", "UI animation", motion);

    const contrast = document.createElement("select");
    contrast.innerHTML = '<option value="normal">Normal contrast</option><option value="high">High contrast</option>';
    addControl("contrast", "Accessibility", contrast);

    drawer.append(controlsSection);

    const layoutSection = element("section", "flow-section");
    layoutSection.append(element("div", "flow-section-title", "Workspace layouts"));
    const layoutGrid = element("div", "flow-preset-grid");
    Object.entries(LAYOUTS).forEach(([key, layout]) => {
        const entry = button(layout.label, "flow-button");
        entry.dataset.layout = key;
        layoutGrid.append(entry);
    });
    layoutSection.append(layoutGrid);
    drawer.append(layoutSection);

    const actionSection = element("section", "flow-section");
    actionSection.append(element("div", "flow-section-title", "Presets & recovery"));
    const actions = element("div", "flow-actions");
    const exportButton = button("Export theme");
    const importButton = button("Import theme");
    const resetButton = button("Reset appearance");
    const resetLayoutButton = button("Reset workspace");
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = ".json,application/json";
    importInput.hidden = true;
    actions.append(exportButton, importButton, resetButton, resetLayoutButton, importInput);
    actionSection.append(actions);
    drawer.append(actionSection);

    function syncControls() {
        for (const [key, control] of controls) {
            control.input.value = String(preferences[key]);
            if (control.value && control.format) control.value.textContent = control.format(preferences[key]);
            if (control.input.type === "range") {
                const min = Number(control.input.min);
                const max = Number(control.input.max);
                const progress = ((Number(control.input.value) - min) / Math.max(0.0001, max - min)) * 100;
                control.input.style.setProperty("--range-progress", `${progress}%`);
            }
        }
        presetButtons.forEach((entry, key) => entry.classList.toggle("active", key === preferences.theme));
    }

    function setOpen(next) {
        open = !!next;
        drawer.classList.toggle("open", open);
        backdrop.classList.toggle("open", open);
        drawer.setAttribute("aria-hidden", String(!open));
        appearanceButton.setAttribute("aria-expanded", String(open));
        if (open) {
            syncControls();
            requestAnimationFrame(() => closeButton.focus());
        } else {
            appearanceButton.focus({ preventScroll: true });
        }
    }

    function applyLayout(key) {
        const preset = LAYOUTS[key];
        if (!preset) return;
        const layout = { ...loadJson(LAYOUT_KEY), ...preset, sceneCollapsed: false, assetsCollapsed: false, inspectorCollapsed: false };
        delete layout.label;
        saveJson(LAYOUT_KEY, layout);
        root.style.setProperty("--as-left-w", `${preset.leftWidth}px`);
        root.style.setProperty("--as-inspector-w", `${preset.inspectorWidth}px`);
        root.style.setProperty("--as-timeline-h", `${preset.timelineHeight}px`);
        document.querySelector("#sceneWorkspacePane")?.classList.remove("pane-collapsed");
        document.querySelector("#assetsWorkspacePane")?.classList.remove("pane-collapsed");
        document.querySelector("#workspaceLeft")?.classList.remove("scene-collapsed", "assets-collapsed");
        document.querySelector("#panel")?.classList.remove("inspector-compact");
        document.dispatchEvent(new CustomEvent("animestage:flow-layout", { detail: layout }));
        window.dispatchEvent(new Event("resize"));
        showToast(`${preset.label} workspace applied`);
    }

    presetButtons.forEach((entry, key) => listen(entry, "click", () => {
        preferences.theme = key;
        preferences.accent = THEMES[key].accent;
        applyPreferences();
        syncControls();
        showToast(`${THEMES[key].label} applied`);
    }));

    for (const [key, control] of controls) {
        const update = () => {
            preferences[key] = control.input.type === "range" ? Number(control.input.value) : control.input.value;
            applyPreferences();
            syncControls();
        };
        listen(control.input, control.input.type === "range" || control.input.type === "color" ? "input" : "change", update);
    }

    drawer.querySelectorAll("[data-layout]").forEach((entry) => listen(entry, "click", () => applyLayout(entry.dataset.layout)));
    listen(appearanceButton, "click", () => setOpen(!open));
    listen(closeButton, "click", () => setOpen(false));
    listen(backdrop, "click", () => setOpen(false));
    listen(document, "keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            setCommandOpen(!commandOpen);
            event.preventDefault();
        } else if (event.key === "Escape" && commandOpen) {
            setCommandOpen(false);
            event.preventDefault();
        } else if (event.key === "Escape" && open) {
            setOpen(false);
            event.preventDefault();
        } else if (event.key === "Tab" && open) {
            const focusable = [...drawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
                .filter((node) => !node.hidden && node.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                last.focus();
                event.preventDefault();
            } else if (!event.shiftKey && document.activeElement === last) {
                first.focus();
                event.preventDefault();
            }
        } else if (event.shiftKey && event.key.toLowerCase() === "t" && !event.ctrlKey && !event.altKey) {
            setOpen(!open);
            event.preventDefault();
        }
    });
    listen(commandButton, "click", () => setCommandOpen(!commandOpen));
    listen(commandOverlay, "click", (event) => {
        if (event.target === commandOverlay) setCommandOpen(false);
    });
    listen(commandSearch, "input", () => {
        activeCommandIndex = 0;
        renderCommands();
    });
    listen(commandSearch, "keydown", (event) => {
        if (event.key === "ArrowDown") {
            activeCommandIndex = (activeCommandIndex + 1) % Math.max(1, filteredCommands.length);
            renderCommands();
            event.preventDefault();
        } else if (event.key === "ArrowUp") {
            activeCommandIndex = (activeCommandIndex - 1 + Math.max(1, filteredCommands.length)) % Math.max(1, filteredCommands.length);
            renderCommands();
            event.preventDefault();
        } else if (event.key === "Enter") {
            runCommand();
            event.preventDefault();
        }
    });

    listen(exportButton, "click", () => {
        downloadJson("animestage-flow-theme.json", { version: 1, kind: "animestage-flow-theme", preferences });
        showToast("Theme exported");
    });
    listen(importButton, "click", () => importInput.click());
    listen(importInput, "change", async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text());
            preferences = normalizePreferences(parsed.preferences || parsed);
            applyPreferences();
            syncControls();
            showToast("Theme imported");
        } catch (_) {
            showToast("Theme file is not valid");
        } finally {
            importInput.value = "";
        }
    });
    listen(resetButton, "click", () => {
        preferences = { ...DEFAULTS };
        applyPreferences();
        syncControls();
        showToast("Appearance reset");
    });
    listen(resetLayoutButton, "click", () => {
        const resetLayout = {
            ...loadJson(LAYOUT_KEY),
            leftWidth: 218,
            inspectorWidth: 410,
            timelineHeight: 250,
            sceneCollapsed: false,
            assetsCollapsed: false,
            inspectorCollapsed: false,
        };
        saveJson(LAYOUT_KEY, resetLayout);
        root.style.setProperty("--as-left-w", "218px");
        root.style.setProperty("--as-inspector-w", "410px");
        root.style.setProperty("--as-timeline-h", "250px");
        document.querySelector("#sceneWorkspacePane")?.classList.remove("pane-collapsed");
        document.querySelector("#assetsWorkspacePane")?.classList.remove("pane-collapsed");
        document.querySelector("#workspaceLeft")?.classList.remove("scene-collapsed", "assets-collapsed");
        document.querySelector("#panel")?.classList.remove("inspector-compact");
        document.dispatchEvent(new CustomEvent("animestage:flow-layout", { detail: resetLayout }));
        window.dispatchEvent(new Event("resize"));
        showToast("Workspace reset");
    });

    syncControls();

    window.__animeStageFlow = {
        version: "3.0.0",
        open: () => setOpen(true),
        close: () => setOpen(false),
        openCommands: () => setCommandOpen(true),
        getPreferences: () => ({ ...preferences }),
        setPreferences(next) {
            preferences = normalizePreferences({ ...preferences, ...next });
            applyPreferences();
            syncControls();
            return { ...preferences };
        },
        applyLayout,
        reset() {
            preferences = { ...DEFAULTS };
            applyPreferences();
            syncControls();
        },
    };

    return {
        open: () => setOpen(true),
        close: () => setOpen(false),
        getPreferences: () => ({ ...preferences }),
        destroy() {
            if (destroyed) return;
            destroyed = true;
            for (const dispose of disposers.splice(0)) dispose();
            appearanceButton.remove();
            commandButton.remove();
            backdrop.remove();
            drawer.remove();
            commandOverlay.remove();
            toastHost.remove();
            delete window.__animeStageFlow;
        },
    };
}
