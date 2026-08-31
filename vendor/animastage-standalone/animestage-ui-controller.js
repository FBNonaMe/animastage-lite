const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

function replaceChildren(node, children) {
    if (!node) return;
    node.replaceChildren(...children.filter(Boolean));
}

function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
}

function createEmptyState(message, actionLabel, onAction) {
    const wrap = document.createElement("div");
    wrap.className = "shell-empty-state";
    wrap.append(textNode("span", "shell-empty-title", message));
    if (actionLabel && onAction) {
        const button = textNode("button", "shell-empty-action", actionLabel);
        button.type = "button";
        button.addEventListener("click", onAction);
        wrap.append(button);
    }
    return wrap;
}

function createSceneRow(item, actions) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `tree-node${item.selected ? " selected" : ""}`;
    row.dataset.searchName = `${item.name || ""} ${item.typeLabel || ""}`.toLowerCase();
    row.dataset.sceneKind = item.kind || "scene";
    row.dataset.sceneId = item.id || "";
    row.title = item.typeLabel ? `${item.name} · ${item.typeLabel}` : item.name;

    row.append(textNode("span", "node-ico", item.icon || "◇"));
    row.append(textNode("span", "node-name", item.name || "Unnamed"));

    if (item.visible !== null && item.visible !== undefined) {
        const visibility = textNode(
            "span",
            `node-eye${item.visible ? "" : " off"}`,
            item.visible ? "●" : "○",
        );
        visibility.title = item.visible ? "Hide" : "Show";
        visibility.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            actions.setSceneVisibility?.(item, !item.visible);
        });
        row.append(visibility);
    }
    row.addEventListener("click", () => actions.selectSceneItem?.(item));
    return row;
}

function createSceneBranch(item, actions) {
    if (!item.children?.length) return createSceneRow(item, actions);
    const details = document.createElement("details");
    details.className = "tree-group";
    details.open = item.open !== false;
    details.dataset.searchName = `${item.name || ""} ${item.typeLabel || ""}`.toLowerCase();

    const summary = document.createElement("summary");
    summary.append(textNode("span", "node-ico", item.icon || "◇"));
    summary.append(textNode("span", "node-name", item.name || "Group"));
    if (item.visible !== null && item.visible !== undefined) {
        const visibility = textNode(
            "span",
            `node-eye${item.visible ? "" : " off"}`,
            item.visible ? "●" : "○",
        );
        visibility.title = item.visible ? "Hide" : "Show";
        visibility.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            actions.setSceneVisibility?.(item, !item.visible);
        });
        summary.append(visibility);
    }
    if (item.selectable !== false) {
        summary.addEventListener("click", (event) => {
            if (event.target.closest(".node-eye")) return;
            actions.selectSceneItem?.(item);
        });
    }
    details.append(summary);

    const children = document.createElement("div");
    children.className = "tree-children";
    for (const child of item.children) children.append(createSceneBranch(child, actions));
    details.append(children);
    return details;
}

function assetIcon(type) {
    return {
        models: "CHAR",
        motions: "VMD",
        stages: "MAP",
        props: "PROP",
    }[type] || "FILE";
}

function createAssetCard(asset, actions) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `asset-card${asset.active ? " active" : ""}`;
    card.dataset.assetType = asset.type;
    card.dataset.assetId = asset.id;
    card.dataset.searchName = `${asset.name || ""} ${asset.extension || ""}`.toLowerCase();
    card.title = asset.description || asset.name;

    const thumb = document.createElement("span");
    thumb.className = `asset-thumb asset-thumb-${asset.type}`;
    thumb.append(textNode("span", "asset-type-mark", assetIcon(asset.type)));
    card.append(thumb);
    card.append(textNode("span", "asset-name", asset.name || "Unnamed asset"));
    if (asset.meta) card.append(textNode("span", "asset-meta", asset.meta));
    card.addEventListener("click", () => actions.activateAsset?.(asset));
    return card;
}

export function createAnimeStageUiController({ getSnapshot, actions = {} }) {
    let disposed = false;
    const preferenceKey = "animastage.ui2.layout.v1";
    let preferences = {};
    try {
        preferences = JSON.parse(localStorage.getItem(preferenceKey) || "{}") || {};
    } catch (_) {}
    let activeAssetType = ["models", "motions", "stages", "props"].includes(preferences.assetType)
        ? preferences.assetType
        : "models";
    let sceneQuery = "";
    let assetQuery = "";
    let latestSnapshot = null;
    const disposers = [];
    const timelineMinHeight = () => window.innerWidth <= 720 ? 94 : 220;

    const savePreferences = () => {
        try {
            localStorage.setItem(preferenceKey, JSON.stringify(preferences));
        } catch (_) {}
    };

    function applyLayoutPreferences() {
        const root = document.documentElement;
        if (Number.isFinite(preferences.leftWidth)) {
            root.style.setProperty("--as-left-w", `${Math.max(168, Math.min(360, preferences.leftWidth))}px`);
        }
        if (Number.isFinite(preferences.inspectorWidth)) {
            root.style.setProperty("--as-inspector-w", `${Math.max(270, Math.min(520, preferences.inspectorWidth))}px`);
        }
        if (Number.isFinite(preferences.timelineHeight)) {
            root.style.setProperty("--as-timeline-h", `${Math.max(timelineMinHeight(), Math.min(360, preferences.timelineHeight))}px`);
        }
        const workspace = qs("#workspaceLeft");
        const scenePane = qs("#sceneWorkspacePane");
        const assetsPane = qs("#assetsWorkspacePane");
        const inspector = qs("#panel");
        scenePane?.classList.toggle("pane-collapsed", !!preferences.sceneCollapsed);
        assetsPane?.classList.toggle("pane-collapsed", !!preferences.assetsCollapsed);
        workspace?.classList.toggle("scene-collapsed", !!preferences.sceneCollapsed);
        workspace?.classList.toggle("assets-collapsed", !!preferences.assetsCollapsed);
        inspector?.classList.toggle("inspector-compact", !!preferences.inspectorCollapsed);
    }

    const listen = (node, event, handler) => {
        if (!node) return;
        node.addEventListener(event, handler);
        disposers.push(() => node.removeEventListener(event, handler));
    };

    function renderScene(snapshot) {
        const host = qs("#uiSceneTree");
        if (!host) return;
        const items = snapshot.scene || [];
        if (!items.length) {
            replaceChildren(host, [
                createEmptyState("No scene objects loaded", "Import model", () => actions.importModel?.()),
            ]);
            return;
        }
        replaceChildren(host, items.map((item) => createSceneBranch(item, actions)));
        filterScene();
    }

    function filterScene() {
        const term = sceneQuery.trim().toLowerCase();
        qsa("#uiSceneTree [data-search-name]").forEach((node) => {
            const own = (node.dataset.searchName || "").includes(term);
            const child = qsa("[data-search-name]", node).some((entry) =>
                (entry.dataset.searchName || "").includes(term),
            );
            node.hidden = !!term && !own && !child;
            if (term && child && node.tagName === "DETAILS") node.open = true;
        });
    }

    function renderAssets(snapshot) {
        const host = qs("#uiAssetGrid");
        if (!host) return;
        const assets = (snapshot.assets || []).filter((asset) => asset.type === activeAssetType);
        const filtered = assets.filter((asset) => {
            const haystack = `${asset.name || ""} ${asset.extension || ""}`.toLowerCase();
            return !assetQuery || haystack.includes(assetQuery);
        });
        if (!filtered.length) {
            const labels = {
                models: ["No models imported", "Import model", actions.importModel],
                motions: ["No motions imported", "Import motion", actions.importMotion],
                stages: ["No stages imported", "Open map builder", actions.openMapBuilder],
                props: ["No props imported", "Import map asset", actions.importMapAsset],
            };
            const [message, actionLabel, action] = labels[activeAssetType];
            replaceChildren(host, [createEmptyState(message, actionLabel, action)]);
            return;
        }
        replaceChildren(host, filtered.map((asset) => createAssetCard(asset, actions)));
    }

    function renderProject(snapshot) {
        const label = qs("#shellProjectLabel");
        if (label) label.textContent = snapshot.project?.label || "Current session";
        const summary = qs("#shellProjectSummary");
        if (summary) summary.textContent = snapshot.project?.summary || "No imported assets";
    }

    function renderRenderMode(snapshot) {
        const select = qs("#shellShadingSelect");
        if (select && snapshot.renderMode && select.value !== snapshot.renderMode) {
            select.value = snapshot.renderMode;
        }
    }

    function renderFrame(snapshot) {
        const counter = qs("#shellFrameCounter");
        if (counter) counter.textContent = String(Math.max(0, snapshot.timeline?.frame || 0)).padStart(4, "0");
        const keyCount = qs("#cameraTrackKeyCount");
        if (keyCount) {
            const count = Math.max(0, snapshot.timeline?.cameraKeyCount || 0);
            keyCount.textContent = `${count} ${count === 1 ? "key" : "keys"}`;
        }
    }

    function refresh(reason = "state") {
        if (disposed) return;
        latestSnapshot = getSnapshot(reason) || {};
        renderScene(latestSnapshot);
        renderAssets(latestSnapshot);
        renderProject(latestSnapshot);
        renderRenderMode(latestSnapshot);
        renderFrame(latestSnapshot);
    }

    function setWorkspace(key) {
        qsa("[data-ui-jump]").forEach((node) => {
            node.classList.toggle("active", node.dataset.uiJump === key);
        });
        qsa(".top-action[data-ui-jump]").forEach((node) => {
            node.classList.toggle("workspace-active", node.dataset.uiJump === key);
        });
        preferences.workspace = key;
        savePreferences();
        actions.openWorkspace?.(key);
    }

    function bindLayoutResizer(selector, kind) {
        const handle = qs(selector);
        if (!handle) return;
        let drag = null;
        listen(handle, "pointerdown", (event) => {
            const leftPane = qs("#workspaceLeft");
            const inspector = qs("#panel");
            const timeline = qs("#boneTimelineHost") || qs("#cinTimeline");
            drag = {
                x: event.clientX,
                y: event.clientY,
                leftWidth: leftPane?.getBoundingClientRect().width || 210,
                inspectorWidth: inspector?.getBoundingClientRect().width || 320,
                timelineHeight: timeline?.getBoundingClientRect().height || 184,
            };
            handle.classList.add("dragging");
            handle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        listen(document, "pointermove", (event) => {
            if (!drag) return;
            if (kind === "left") {
                preferences.leftWidth = Math.max(168, Math.min(360, drag.leftWidth + event.clientX - drag.x));
                document.documentElement.style.setProperty("--as-left-w", `${preferences.leftWidth}px`);
            } else if (kind === "right") {
                preferences.inspectorWidth = Math.max(270, Math.min(520, drag.inspectorWidth - event.clientX + drag.x));
                document.documentElement.style.setProperty("--as-inspector-w", `${preferences.inspectorWidth}px`);
            } else {
                preferences.timelineHeight = Math.max(timelineMinHeight(), Math.min(360, drag.timelineHeight - event.clientY + drag.y));
                document.documentElement.style.setProperty("--as-timeline-h", `${preferences.timelineHeight}px`);
            }
        });
        const stop = () => {
            if (!drag) return;
            drag = null;
            handle.classList.remove("dragging");
            savePreferences();
        };
        listen(document, "pointerup", stop);
        listen(document, "pointercancel", stop);
    }

    listen(qs("#sceneTreeSearch"), "input", (event) => {
        sceneQuery = event.currentTarget.value || "";
        filterScene();
    });
    listen(qs("#assetSearch"), "input", (event) => {
        assetQuery = (event.currentTarget.value || "").trim().toLowerCase();
        renderAssets(latestSnapshot || {});
    });
    qsa(".asset-tab").forEach((tab) => listen(tab, "click", () => {
        activeAssetType = tab.dataset.assetTab || "models";
        preferences.assetType = activeAssetType;
        savePreferences();
        qsa(".asset-tab").forEach((entry) => entry.classList.toggle("active", entry === tab));
        renderAssets(latestSnapshot || {});
    }));
    qsa("[data-ui-jump]").forEach((node) => listen(node, "click", () => setWorkspace(node.dataset.uiJump)));

    listen(qs("#scenePaneCollapse"), "click", () => {
        actions.togglePane?.("scene");
        preferences.sceneCollapsed = qs("#sceneWorkspacePane")?.classList.contains("pane-collapsed");
        savePreferences();
    });
    listen(qs("#assetsPaneCollapse"), "click", () => {
        actions.togglePane?.("assets");
        preferences.assetsCollapsed = qs("#assetsWorkspacePane")?.classList.contains("pane-collapsed");
        savePreferences();
    });
    listen(qs("#inspectorCollapse"), "click", () => {
        actions.togglePane?.("inspector");
        preferences.inspectorCollapsed = qs("#panel")?.classList.contains("inspector-compact");
        savePreferences();
    });
    listen(qs("#sceneAddObject"), "click", () => actions.addSceneObject?.());
    listen(qs("#assetImportButton"), "click", () => {
        ({
            models: actions.importModel,
            motions: actions.importMotion,
            stages: actions.openMapBuilder,
            props: actions.importMapAsset,
        }[activeAssetType])?.();
    });
    listen(qs("#shellSaveSession"), "click", () => actions.saveSession?.());
    listen(qs("#shellLoadSession"), "click", () => actions.loadSession?.());
    listen(qs("#shellProject"), "click", (event) => {
        const open = qs("#shellProjectMenu")?.classList.toggle("open") || false;
        event.currentTarget.setAttribute("aria-expanded", String(open));
    });
    listen(document, "click", (event) => {
        if (!event.target.closest("#shellProjectWrap")) {
            qs("#shellProjectMenu")?.classList.remove("open");
            qs("#shellProject")?.setAttribute("aria-expanded", "false");
        }
    });
    listen(qs("#shellFullscreen"), "click", () => actions.toggleFullscreen?.());
    listen(qs("#shellShadingSelect"), "change", (event) => actions.setRenderMode?.(event.currentTarget.value));
    listen(qs("#shellFpsSelect"), "change", () => refresh("timeline-fps"));
    listen(qs("#openBoneTimeline"), "click", () => actions.openBoneTimeline?.());
    listen(qs("#timelineBoneTab"), "click", () => actions.openBoneTimeline?.());
    listen(qs("#timelineCameraTab"), "click", () => actions.openCameraTimeline?.());
    qsa("[data-shell-tool]").forEach((button) => listen(button, "click", () => {
        qsa("[data-shell-tool]").forEach((entry) => entry.classList.toggle("active", entry === button));
        actions.setTransformTool?.(button.dataset.shellTool);
    }));
    listen(document, "animestage:flow-layout", (event) => {
        if (!event.detail || typeof event.detail !== "object") return;
        preferences = { ...preferences, ...event.detail };
        applyLayoutPreferences();
        savePreferences();
        window.dispatchEvent(new Event("resize"));
    });

    applyLayoutPreferences();
    qsa(".asset-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.assetTab === activeAssetType));
    bindLayoutResizer("#leftLayoutResizer", "left");
    bindLayoutResizer("#rightLayoutResizer", "right");
    bindLayoutResizer("#timelineLayoutResizer", "timeline");
    refresh("init");
    if (preferences.workspace) {
        qsa("[data-ui-jump]").forEach((node) => node.classList.toggle("active", node.dataset.uiJump === preferences.workspace));
        qsa(".top-action[data-ui-jump]").forEach((node) => node.classList.toggle("workspace-active", node.dataset.uiJump === preferences.workspace));
    }
    return {
        refresh,
        refreshTimeline() {
            if (disposed) return;
            const snapshot = getSnapshot("timeline") || {};
            renderFrame(snapshot);
        },
        setWorkspace,
        destroy() {
            disposed = true;
            for (const dispose of disposers.splice(0)) dispose();
        },
    };
}
