import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import JSZip from "../../vendor/jszip/dist/jszip.min.js";
import { EFFECT_MANIFEST_SCHEMA } from "./core/EffectManifest.js";
import { importEffectArchive } from "./loaders/EffectArchiveImporter.js";

const zip = new JSZip();
zip.file("safe/effect.fx", "float4 main():SV_Target{return 1;}");
zip.file("safe/setup.exe", new Uint8Array([77, 90, 0, 1]));
const packed = await zip.generateAsync({ type: "uint8array" });
const file = {
  name: "security-test.zip",
  arrayBuffer: async () => packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength),
};
const result = await importEffectArchive(file, {
  JSZip,
  cryptoApi: webcrypto,
  manifest: {
    schema: EFFECT_MANIFEST_SCHEMA,
    id: "test.security-archive",
    version: "1.0.0",
    name: "Security archive",
    author: { name: "Test" },
    kind: "utility",
    status: "DOWNLOADED",
  },
});

assert.deepEqual(result.originalEntries.map((entry) => entry.path), ["safe/effect.fx"]);
assert.equal(result.quarantineEntries.some((entry) => entry.path === "safe/setup.exe"), true);
assert.equal(result.originalEntries.some((entry) => entry.path.endsWith(".exe")), false, "executables must never enter original/");
assert.equal(result.inspection.compatibilityReports.length, 1);
assert.equal(result.inspection.compatibilityReports[0].executable, false, "raw MME input must remain metadata-only");
assert.equal(result.provenance.compatibilityReports.length, 1);

console.log("AnimaStage effect archive isolation contracts: PASS");
