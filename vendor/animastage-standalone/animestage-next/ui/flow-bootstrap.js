import { createFlowInterfaceController } from "./FlowInterfaceController.js?v=flow3";

function boot() {
    if (window.__animeStageFlowController) return;
    try {
        window.__animeStageFlowController = createFlowInterfaceController();
        document.documentElement.dataset.flowReady = "true";
        console.info("[AnimeStage Flow UI] 3.0.0 ready");
    } catch (error) {
        console.error("[AnimeStage Flow UI] failed to initialize", error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
    boot();
}
