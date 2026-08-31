/**
 * Wave 1 regression smoke — pure invariants (no DOM / WebGL).
 * Run: npx tsx scripts/wave1-smoke.ts
 */
import assert from 'node:assert/strict';
import {
  buildCharacterImportStatePatch,
  buildStageImportStatePatch,
  settingsForSilentImport,
  DEFAULT_MODEL_IMPORT_SETTINGS,
} from '../src/importSettings/index.ts';
import {
  fitRp4ResolutionToFormat,
  resolveRp4ExportSize,
} from '../src/renderPipeline4/presets.ts';
import { DEFAULT_RENDER_PIPELINE_4 } from '../src/renderPipeline4/defaults.ts';
import {
  beginRecordingCapture,
  endRecordingCapture,
  isRecordingCapture,
  setFrozenCaptureCamera,
  getFrozenCaptureCamera,
} from '../src/video/recordingCapture.ts';

const emptyScene = {
  sceneComposer: {
    fogEnabled: false,
    fogDensity: 0.1,
    fogColor: '#000',
    lights: { sunEnabled: true, sunShadows: false },
    effectLevels: {},
    bgMode: 'gradient',
    presetPreviewSource: 'sky',
  },
  visualFx: { environmentIntensity: 0.7, bloomEnabled: false },
} as never;

// --- Import isolation ---
{
  const silent = settingsForSilentImport({
    ...DEFAULT_MODEL_IMPORT_SETTINGS,
    enableFog: true,
    applyEnvironment: true,
    importLights: true,
    importCameras: true,
  });
  assert.equal(silent.enableFog, false);
  assert.equal(silent.applyEnvironment, false);
  assert.equal(silent.importLights, false);
  assert.equal(silent.importCameras, false);

  const charPatch = buildCharacterImportStatePatch(emptyScene, DEFAULT_MODEL_IMPORT_SETTINGS);
  assert.deepEqual(charPatch, {});

  const stagePatch = buildStageImportStatePatch(emptyScene, DEFAULT_MODEL_IMPORT_SETTINGS);
  assert.equal(stagePatch.sceneComposer?.presetPreviewSource, 'model');
  // Stage display patch may copy existing fog; it must never force fog on.
  assert.notEqual(
    (stagePatch.sceneComposer as { fogEnabled?: boolean })?.fogEnabled,
    true
  );
}

// --- 9:16 export size ---
{
  const landscape4k = fitRp4ResolutionToFormat(3840, 2160, '9:16');
  assert.equal(landscape4k.width, 2160);
  assert.equal(landscape4k.height, 3840);

  const rp = {
    ...DEFAULT_RENDER_PIPELINE_4,
    resolution: { preset: '4k' as const, width: 3840, height: 2160 },
  };
  const sized = resolveRp4ExportSize(rp, '9:16');
  assert.ok(sized.height > sized.width, '9:16 export must be portrait');
}

// --- Capture begin/end idempotent + frozen camera preserved ---
{
  beginRecordingCapture({ cinemaMode: true, targetWidth: 1080, targetHeight: 1920 });
  assert.equal(isRecordingCapture(), true);
  setFrozenCaptureCamera({
    position: [0, 1, 2],
    rotation: [0, 0, 0],
    fov: 45,
    target: [0, 1, 0],
  });
  beginRecordingCapture({ cinemaMode: true, targetWidth: 1080, targetHeight: 1920 });
  assert.ok(getFrozenCaptureCamera(), 'nested begin must preserve frozen camera');
  endRecordingCapture();
  assert.equal(isRecordingCapture(), false);
  assert.equal(getFrozenCaptureCamera(), null);
  endRecordingCapture(); // idempotent
}

console.log('wave1-smoke: ok');
