import assert from "node:assert/strict";
import { discoverOfficialEffectSources, fetchJsonWithRetry, paginateGitHub } from "./lib/GitHubDiscovery.mjs";

const response = (data, { status = 200, headers = {} } = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json", ...headers },
});

let requests = 0;
const pages = Array.from({ length: 100 }, (_, index) => ({ name: `repo-${index}` }));
const records = await paginateGitHub("https://api.github.test/users/demo/repos", {
  fetchImpl: async (url) => {
    requests++;
    return response(new URL(url).searchParams.get("page") === "1" ? pages : [{ name: "last" }]);
  },
});
assert.equal(requests, 2, "discovery must follow GitHub pagination");
assert.equal(records.length, 101);

let retries = 0;
const recovered = await fetchJsonWithRetry("https://api.github.test/retry", {
  attempts: 2,
  maxWaitMs: 1,
  fetchImpl: async () => {
    retries++;
    return retries === 1
      ? response({ message: "busy" }, { status: 503 })
      : response({ ok: true });
  },
});
assert.equal(recovered.data.ok, true);
assert.equal(retries, 2, "transient server failures must use bounded retry/backoff");

const offline = await discoverOfficialEffectSources({
  offline: true,
  now: () => new Date("2026-08-29T00:00:00.000Z"),
});
assert.equal(offline.sources.length, 7);
assert.equal(offline.sources.every((source) => source.discoveryMode === "pinned-offline"), true);
assert.equal(offline.sources.filter((source) => source.downloadPolicy === "metadata-only").length, 6);
assert.equal(offline.sources.find((source) => source.id === "raycast.ray-mmd").license.id, "MIT");
assert.equal(offline.sources.every((source) => source.manifest.compatibility.webRuntime === "adapter-required"), true);

console.log("AnimaStage effect discovery contracts: PASS");
