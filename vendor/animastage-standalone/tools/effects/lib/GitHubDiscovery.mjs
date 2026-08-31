import {
  EFFECT_SOURCE_REGISTRY_SCHEMA,
  EFFECT_SOURCE_REGISTRY_VERSION,
  OFFICIAL_EFFECT_SOURCES,
  listOfficialEffectOwners,
} from "../../../animestage-next/effects/discovery/EffectSourceRegistry.js";

export class GitHubDiscoveryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GitHubDiscoveryError";
    this.details = details;
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response, attempt, maxWaitMs) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(maxWaitMs, retryAfter * 1000);
  const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    return Math.min(maxWaitMs, Math.max(0, resetSeconds * 1000 - Date.now()));
  }
  return Math.min(maxWaitMs, 350 * 2 ** attempt);
}

export async function fetchJsonWithRetry(url, {
  fetchImpl = globalThis.fetch,
  attempts = 4,
  maxWaitMs = 5000,
  timeoutMs = 20000,
  headers = {},
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required");
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("request timeout")), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "AnimaStage-Effects-Discovery",
          "X-GitHub-Api-Version": "2022-11-28",
          ...headers,
        },
      });
      if (response.ok) return { data: await response.json(), response };
      const body = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500
        || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
      lastError = new GitHubDiscoveryError(`GitHub returned HTTP ${response.status}`, {
        url, status: response.status, body: body.slice(0, 1000),
        rateLimitReset: response.headers.get("x-ratelimit-reset") || "",
      });
      if (!retryable || attempt + 1 >= attempts) throw lastError;
      await delay(retryDelay(response, attempt, maxWaitMs));
    } catch (error) {
      lastError = error;
      if (error instanceof GitHubDiscoveryError || attempt + 1 >= attempts) throw error;
      await delay(Math.min(maxWaitMs, 350 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new GitHubDiscoveryError("GitHub discovery failed", { url });
}

export async function paginateGitHub(url, options = {}) {
  const separator = url.includes("?") ? "&" : "?";
  const records = [];
  const maxPages = Math.max(1, Number(options.maxPages) || 20);
  for (let page = 1; page <= maxPages; page++) {
    const { data } = await fetchJsonWithRetry(`${url}${separator}per_page=100&page=${page}`, options);
    if (!Array.isArray(data)) throw new GitHubDiscoveryError("Expected a GitHub array response", { url, page });
    records.push(...data);
    if (data.length < 100) return records;
  }
  throw new GitHubDiscoveryError("GitHub pagination exceeded its safety limit", { url, maxPages });
}

function pinnedRepository(source) {
  return {
    name: source.repository,
    full_name: `${source.owner}/${source.repository}`,
    html_url: source.officialUrl,
    description: source.manifest.description,
    default_branch: source.pinned.defaultBranch,
    pushed_at: source.pinned.pushedAt || "",
    archived: false,
    license: { spdx_id: source.license.id },
  };
}

function publicSourceRecord(source, repository, { mode, discoveredAt }) {
  return {
    id: source.id,
    owner: source.owner,
    repository: source.repository,
    officialUrl: source.officialUrl,
    downloadUrl: source.downloadUrl,
    revision: source.revision,
    repositoryMetadata: {
      description: repository.description || source.manifest.description,
      defaultBranch: repository.default_branch || source.pinned.defaultBranch || "",
      pushedAt: repository.pushed_at || source.pinned.pushedAt || "",
      archived: repository.archived === true,
    },
    license: source.license,
    downloadPolicy: source.downloadPolicy,
    status: source.manifest.status,
    discoveryMode: mode,
    discoveredAt,
    manifest: source.manifest,
  };
}

export async function discoverOfficialEffectSources({
  offline = false,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  request = {},
} = {}) {
  const discoveredAt = now().toISOString();
  const repositoriesByOwner = new Map();
  const network = [];
  if (!offline) {
    for (const owner of listOfficialEffectOwners()) {
      try {
        const repos = await paginateGitHub(`https://api.github.com/users/${encodeURIComponent(owner)}/repos`, {
          ...request,
          fetchImpl,
        });
        repositoriesByOwner.set(owner, new Map(repos.map((repo) => [String(repo.name).toLowerCase(), repo])));
        network.push({ owner, ok: true, repositories: repos.length });
      } catch (error) {
        network.push({ owner, ok: false, error: error.message, details: error.details || null });
      }
    }
  }
  const sources = OFFICIAL_EFFECT_SOURCES.map((source) => {
    const live = repositoriesByOwner.get(source.owner)?.get(source.repository.toLowerCase());
    return publicSourceRecord(source, live || pinnedRepository(source), {
      mode: live ? "live-github-api" : offline ? "pinned-offline" : "pinned-fallback",
      discoveredAt,
    });
  });
  return {
    schema: EFFECT_SOURCE_REGISTRY_SCHEMA,
    registryVersion: EFFECT_SOURCE_REGISTRY_VERSION,
    generatedAt: discoveredAt,
    network,
    sources,
  };
}
