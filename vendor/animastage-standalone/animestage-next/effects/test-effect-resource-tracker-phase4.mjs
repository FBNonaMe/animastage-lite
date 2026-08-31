import assert from "node:assert/strict";
import { EffectResourceScope } from "./core/EffectResourceScope.js";
import { EffectResourceTracker } from "./diagnostics/EffectResourceTracker.js";

const tracker = new EffectResourceTracker();
const scope = new EffectResourceScope("effect-a", tracker);
scope.defer(() => {}, "framebuffer");
scope.own({ dispose() {} }, null, "texture");
assert.deepEqual(tracker.stats.byOwner, { "effect-a": 2 });
scope.commit();
assert.deepEqual(await scope.dispose(), []);
assert.equal(tracker.stats.active, 0);
assert.equal(tracker.stats.released, 2);

const failed = new EffectResourceScope("effect-b", tracker);
failed.defer(() => { throw new Error("GPU context lost"); }, "pipeline");
failed.commit();
assert.equal((await failed.dispose()).length, 1);
assert.equal(tracker.stats.failedDisposals, 1);
assert.equal(tracker.stats.active, 1, "failed disposal remains visible as a possible leak");
assert.equal(tracker.activeRecords[0].state, "dispose-failed");

console.log("AnimaStage effect resource inventory contracts: PASS");
