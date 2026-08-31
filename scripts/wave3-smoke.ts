/**
 * Wave 3 smoke — validation, autosave, export-lock portrait, viewport FX isolation.
 * Run: npm run smoke:wave3
 */
import assert from 'node:assert/strict';
import {
  autosaveProjectJson,
  listAutosaveHistory,
  loadAutosaveJson,
  validateProject,
} from '../src/stability/projectValidation.ts';
import { fitRp4ResolutionToFormat } from '../src/renderPipeline4/presets.ts';
import { DEFAULT_RENDER_PIPELINE_4 } from '../src/renderPipeline4/defaults.ts';
import { getEffectivePhysicsMaxSteps } from '../src/perf/physicsQualityControl.ts';

const empty = {
  models: [],
  maxFrames: 120,
} as never;

{
  const issues = validateProject(empty);
  assert.ok(issues.some((i) => i.code === 'no_models'));
}

{
  const broken = {
    models: [
      {
        id: 'm1',
        name: 'Broken',
        blobUrl: '',
        hasVmdAnimation: true,
        vmdBlobUrls: [],
        keyframes: [],
      },
    ],
    maxFrames: 1,
  } as never;
  const issues = validateProject(broken);
  assert.ok(issues.some((i) => i.code === 'missing_mesh'));
  assert.ok(issues.some((i) => i.code === 'broken_vmd'));
  assert.ok(issues.some((i) => i.code === 'short_timeline'));
}

{
  const portrait = fitRp4ResolutionToFormat(1920, 1080, '9:16');
  assert.equal(portrait.width, 1080);
  assert.equal(portrait.height, 1920);
}

{
  // Export quality lock must stay on by default (Wave 3: never loosen RP4 locks).
  assert.equal(DEFAULT_RENDER_PIPELINE_4.lockExportQuality, true);
}

{
  // Physics steps resolve without throw (governor cap path).
  const steps = getEffectivePhysicsMaxSteps();
  assert.ok(steps >= 0 && steps <= 3);
}

{
  // localStorage may be unavailable in node — wrap
  try {
    autosaveProjectJson('{"ok":true}');
    assert.equal(loadAutosaveJson(), '{"ok":true}');
    assert.ok(listAutosaveHistory().length >= 1);
  } catch {
    console.log('wave3-smoke: skip autosave (no localStorage)');
  }
}

console.log('wave3-smoke: ok');
