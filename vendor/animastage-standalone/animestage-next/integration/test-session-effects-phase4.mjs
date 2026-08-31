import assert from "node:assert/strict";
import {
  SessionImportValidationError,
  validateLegacySessionImport,
} from "./LegacySessionImportTransaction.js";

const emptyEffects = {
  schema: "animestage.effect-stack/v1",
  entries: [],
};

const session = validateLegacySessionImport({
  version: 3,
  activeCharacterId: "character-1",
  globalVmdFileNames: [],
  effectStack: {
    schema: "animestage.effect-stack/v1",
    entries: [{
      stackEntryId: "stack-fx-session",
      effect: { id: "ray-mmd-color-grading", version: "1.0.0" },
      owner: { kind: "editor", id: "shader-studio" },
      target: { kind: "post-processing", id: "main-composer" },
      parameters: { exposure: 1.25 },
      enabled: true,
      label: "Session look",
    }],
  },
  characters: [{
    id: "character-1",
    modelFileName: "model.pmx",
    loadedVmdNames: [],
    animationLayers: [{
      name: "generated",
      sourceNames: [],
      clipData: { name: "generated", tracks: [], duration: 0 },
    }],
  }],
});

assert.equal(session.effectStack.entries.length, 1);
assert.equal(session.effectStack.entries[0].parameters.exposure, 1.25);
assert.ok(Object.isFrozen(session.effectStack));
assert.ok(Object.isFrozen(session.effectStack.entries[0]));

const oldSession = validateLegacySessionImport({
  version: 3,
  activeCharacterId: null,
  globalVmdFileNames: [],
  characters: [],
});
assert.equal(oldSession.effectStack, null, "old Session v3 files stay compatible");

assert.throws(
  () => validateLegacySessionImport({
    version: 3,
    activeCharacterId: null,
    globalVmdFileNames: [],
    characters: [],
    effectStack: { ...emptyEffects, entries: [{ stackEntryId: "broken" }] },
  }),
  (error) => error instanceof SessionImportValidationError
    && error.details?.path === "effectStack",
);

console.log("AnimaStage Session v3 Effects Stack contracts: PASS");
