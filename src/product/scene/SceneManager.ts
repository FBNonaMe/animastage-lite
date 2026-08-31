import type { AppState, ViewportFormat } from '../../types';
import type { AnimaStageScene, SceneReadSnapshot } from './types';
import { serializeScene } from './serialize';
import { deserializeScene, type RestoreSceneOptions } from './deserialize';
import {
  downloadSceneFile,
  parseSceneJson,
} from './codec';
import { validateAndSaveScene, loadSceneFromStorage } from './storage';

/**
 * SceneManager — product-layer wrapper that ONLY reads/writes engine state
 * through the public AppState API. Never imports engine internals.
 */
export interface SceneEngineBridge {
  read: () => SceneReadSnapshot;
  write: (updater: (prev: AppState) => AppState) => void;
  setViewportFormat: (format: ViewportFormat) => void;
  loadDemo: (demoId: string) => Promise<void>;
  clearScene: () => void;
  applyTemplate: (templateId: string) => void;
  setPlaying: (playing: boolean) => void;
}

export type { RestoreSceneOptions };

export class SceneManager {
  constructor(private readonly bridge: SceneEngineBridge) {}

  /** Capture current scene as JSON-serializable document. */
  capture(name?: string): AnimaStageScene {
    const { appState, viewportFormat, activeDemoId } = this.bridge.read();
    return serializeScene(appState, viewportFormat, { name, sourceDemoId: activeDemoId });
  }

  /** Restore scene document into engine state (meshes must exist or demo loaded first). */
  restore(scene: AnimaStageScene, options?: RestoreSceneOptions): void {
    const { viewportFormat } = this.bridge.read();
    this.bridge.write((prev) => deserializeScene(prev, scene, options));
    if (scene.settings.aspect !== viewportFormat) {
      this.bridge.setViewportFormat(scene.settings.aspect);
    }
  }

  async restoreWithDemo(scene: AnimaStageScene, options?: RestoreSceneOptions): Promise<void> {
    if (scene.sourceDemoId && this.bridge.read().appState.models.length === 0) {
      await this.bridge.loadDemo(scene.sourceDemoId);
    }
    this.restore(scene, options);
  }

  saveToFile(name?: string): AnimaStageScene {
    const scene = this.capture(name);
    const { appState } = this.bridge.read();
    validateAndSaveScene(scene, appState);
    downloadSceneFile(scene);
    return scene;
  }

  saveLocal(): AnimaStageScene {
    const scene = this.capture();
    const { appState } = this.bridge.read();
    validateAndSaveScene(scene, appState);
    return scene;
  }

  loadLocal(): AnimaStageScene | null {
    return loadSceneFromStorage();
  }

  parseFile(raw: string): AnimaStageScene {
    return parseSceneJson(raw);
  }

  clearAndRestore(scene: AnimaStageScene): void {
    this.bridge.clearScene();
    void this.restoreWithDemo(scene);
  }
}
