/**
 * OpenRouter AI Settings — key, free model picker, test connection.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  Pin,
  RefreshCw,
  Search,
  Star,
  Zap,
} from 'lucide-react';
import {
  BADGE_LABEL,
  fetchOpenRouterModels,
  filterModels,
  getCachedOrEmptyModels,
  getStoredOpenRouterApiKey,
  hasOpenRouterApiKey,
  loadOpenRouterSettings,
  saveOpenRouterSettings,
  setStoredOpenRouterApiKey,
  testOpenRouterConnection,
  type OpenRouterModel,
  type OpenRouterSettings,
} from '../../ai/openrouter';

export interface OpenRouterSettingsPanelProps {
  onStatus?: (msg: string) => void;
  compact?: boolean;
}

function Badge({ id }: { id: OpenRouterModel['badges'][number] }) {
  const styles: Record<string, string> = {
    free: 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10',
    recommended: 'border-amber-500/40 text-amber-200 bg-amber-500/10',
    fast: 'border-cyan-500/40 text-cyan-200 bg-cyan-500/10',
    reasoning: 'border-violet-500/40 text-violet-200 bg-violet-500/10',
    vision: 'border-pink-500/40 text-pink-200 bg-pink-500/10',
    chat: 'border-zinc-600 text-zinc-400 bg-zinc-800/50',
  };
  return (
    <span
      className={`inline-flex px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wide border ${styles[id] ?? styles.chat}`}
    >
      {BADGE_LABEL[id]}
    </span>
  );
}

export default function OpenRouterSettingsPanel({
  onStatus,
  compact = false,
}: OpenRouterSettingsPanelProps) {
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getStoredOpenRouterApiKey());
  const [keyPresent, setKeyPresent] = useState(() => hasOpenRouterApiKey());
  const [settings, setSettings] = useState<OpenRouterSettings>(() => loadOpenRouterSettings());
  const [models, setModels] = useState<OpenRouterModel[]>(() => getCachedOrEmptyModels());
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [conn, setConn] = useState<{
    ok: boolean;
    message: string;
    latencyMs: number;
    modelId: string;
  } | null>(null);

  const persistKey = useCallback((raw: string) => {
    setStoredOpenRouterApiKey(raw);
    const next = hasOpenRouterApiKey();
    setKeyPresent(next);
    setApiKeyDraft(getStoredOpenRouterApiKey() || raw.trim());
    return next;
  }, []);

  const refreshModels = useCallback(
    async (force = false) => {
      setBusy(true);
      setModelsError(null);
      try {
        const list = await fetchOpenRouterModels(force);
        setModels(list);
        const free = filterModels(list, { freeOnly: true });
        onStatus?.(`Free models: ${free.length}`);
        const current = loadOpenRouterSettings();
        const stillFree = free.some((m) => m.id === current.modelId);
        if (!current.modelId || !stillFree) {
          const pick = free[0];
          if (pick) {
            const next = saveOpenRouterSettings({ modelId: pick.id });
            setSettings(next);
          }
        }
      } catch (e) {
        const msg = (e as Error).message || 'Failed to load models';
        setModelsError(msg);
        onStatus?.(msg);
      } finally {
        setBusy(false);
      }
    },
    [onStatus]
  );

  useEffect(() => {
    void refreshModels(false);
    // Load catalog once on open — refreshModels identity can change with onStatus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const list = filterModels(models, { freeOnly: true, query });
    const rank = (id: string) => {
      if (settings.pinnedIds.includes(id)) return 0;
      if (settings.favoriteIds.includes(id)) return 1;
      if (settings.recentIds.includes(id)) return 2;
      return 3;
    };
    return [...list].sort((a, b) => {
      const d = rank(a.id) - rank(b.id);
      return d !== 0 ? d : 0;
    });
  }, [models, settings.pinnedIds, settings.favoriteIds, settings.recentIds, query]);

  const freeCount = useMemo(
    () => filterModels(models, { freeOnly: true }).length,
    [models]
  );

  const selected =
    filterModels(models, { freeOnly: true }).find((m) => m.id === settings.modelId) ?? null;

  const saveKey = () => {
    const ok = persistKey(apiKeyDraft);
    onStatus?.(ok ? 'OpenRouter key saved' : 'Key cleared');
    setConn(null);
  };

  const patchSettings = (patch: Partial<OpenRouterSettings>) => {
    const next = saveOpenRouterSettings(patch);
    setSettings(next);
  };

  const test = async () => {
    const hasKey = persistKey(apiKeyDraft);
    if (!hasKey) {
      setConn({
        ok: false,
        message: 'Paste an OpenRouter API key first, then click Save or Test.',
        latencyMs: 0,
        modelId: '—',
      });
      return;
    }
    setBusy(true);
    setConn(null);
    try {
      const result = await testOpenRouterConnection((msg) => onStatus?.(msg));
      setConn(result);
      onStatus?.(
        result.ok
          ? `Connected · ${result.modelId} · ${result.latencyMs}ms`
          : result.message
      );
      if (result.ok) {
        setSettings(loadOpenRouterSettings());
        await refreshModels(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleFav = (id: string) => {
    const favoriteIds = settings.favoriteIds.includes(id)
      ? settings.favoriteIds.filter((x) => x !== id)
      : [...settings.favoriteIds, id];
    patchSettings({ favoriteIds });
  };

  const togglePin = (id: string) => {
    const pinnedIds = settings.pinnedIds.includes(id)
      ? settings.pinnedIds.filter((x) => x !== id)
      : [...settings.pinnedIds, id];
    patchSettings({ pinnedIds });
  };

  return (
    <section
      className={`rounded-md border border-violet-500/30 bg-violet-950/15 space-y-2 ${
        compact ? 'p-2' : 'p-2.5'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-violet-200">
        <Zap className="w-3.5 h-3.5" />
        OpenRouter AI
        <span
          className={`ml-auto text-[8px] font-semibold ${
            keyPresent ? 'text-emerald-400' : 'text-zinc-500'
          }`}
        >
          {keyPresent ? 'Key set' : 'No key'}
        </span>
      </div>
      <p className="text-[9px] text-zinc-500 m-0 leading-relaxed">
        Paste a key, save, test — then pick a free model below.
      </p>

      <div className="space-y-1">
        <label className="text-[8px] text-zinc-500 font-semibold">OpenRouter API Key</label>
        <div className="flex gap-1">
          <input
            type="password"
            autoComplete="off"
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            onBlur={() => {
              if (apiKeyDraft.trim()) persistKey(apiKeyDraft);
            }}
            placeholder="sk-or-v1-…"
            className="flex-1 min-w-0 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-100"
          />
          <button
            type="button"
            onClick={saveKey}
            className="px-2 py-1 text-[8px] font-bold rounded border border-zinc-700 text-zinc-300 cursor-pointer"
          >
            Save
          </button>
        </div>
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="text-[8px] text-violet-300/80 hover:underline"
        >
          Get a free key at openrouter.ai/keys
        </a>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void test()}
          className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold rounded border border-violet-500/40 text-violet-100 cursor-pointer disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Test Connection
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refreshModels(true)}
          className="px-2 py-1.5 text-[9px] font-bold rounded border border-zinc-700 text-zinc-300 cursor-pointer disabled:opacity-40"
          title="Refresh free model list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {conn ? (
        <div
          className={`text-[8px] rounded px-2 py-1.5 border ${
            conn.ok
              ? 'border-emerald-500/30 text-emerald-200 bg-emerald-950/30'
              : 'border-rose-500/30 text-rose-200 bg-rose-950/20'
          }`}
        >
          {conn.ok ? (
            <>
              Connected · API working · {conn.modelId} · {conn.latencyMs} ms
            </>
          ) : (
            conn.message
          )}
        </div>
      ) : null}

      {modelsError ? (
        <div className="text-[8px] rounded px-2 py-1.5 border border-amber-500/30 text-amber-100 bg-amber-950/20">
          {modelsError}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        <label className="block">
          <span className="text-[8px] text-zinc-500">Temperature</span>
          <input
            type="number"
            min={0}
            max={2}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => patchSettings({ temperature: Number(e.target.value) })}
            className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[10px]"
          />
        </label>
        <label className="block">
          <span className="text-[8px] text-zinc-500">Max tokens</span>
          <input
            type="number"
            min={256}
            max={32000}
            step={256}
            value={settings.maxTokens}
            onChange={(e) => patchSettings({ maxTokens: Number(e.target.value) })}
            className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[10px]"
          />
        </label>
        <label className="block">
          <span className="text-[8px] text-zinc-500">Timeout (s)</span>
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={Math.round(settings.timeoutMs / 1000)}
            onChange={(e) =>
              patchSettings({ timeoutMs: Math.max(10, Number(e.target.value)) * 1000 })
            }
            className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[10px]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[8px] text-zinc-500 min-w-0">
          Selected:{' '}
          <span className="text-zinc-200 font-semibold truncate">
            {selected ? selected.name : settings.modelId || '— pick below —'}
          </span>
        </div>
        <span className="shrink-0 text-[8px] font-bold text-emerald-300/90">
          Free only · {freeCount}
        </span>
      </div>

      <div className="relative">
        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search free models…"
          className="w-full pl-7 pr-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-100"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded border border-zinc-800 divide-y divide-zinc-800/80">
        {visible.length === 0 ? (
          <p className="text-[9px] text-zinc-500 p-2 m-0">
            {busy
              ? 'Loading free models…'
              : models.length
                ? 'No free models match your search'
                : 'Click the refresh button to load free models'}
          </p>
        ) : (
          visible.map((m) => {
            const active = m.id === settings.modelId;
            return (
              <div
                key={m.id}
                className={`flex items-start gap-1 px-1.5 py-1.5 ${
                  active ? 'bg-violet-500/15' : 'hover:bg-zinc-900/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    patchSettings({ modelId: m.id });
                    onStatus?.(`Model: ${m.name}`);
                  }}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-[9px] font-bold text-zinc-100 truncate">{m.name}</div>
                  <div className="text-[7px] text-zinc-500 truncate">
                    {m.id}
                    {m.contextLength ? ` · ${(m.contextLength / 1000).toFixed(0)}k ctx` : ''}
                  </div>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {m.badges
                      .filter((b) => b !== 'chat')
                      .slice(0, 4)
                      .map((b) => (
                        <Badge key={b} id={b} />
                      ))}
                  </div>
                </button>
                <button
                  type="button"
                  title="Favorite"
                  onClick={() => toggleFav(m.id)}
                  className="p-1 text-zinc-500 cursor-pointer"
                >
                  <Star
                    className={`w-3 h-3 ${
                      settings.favoriteIds.includes(m.id)
                        ? 'fill-amber-400 text-amber-400'
                        : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  title="Pin"
                  onClick={() => togglePin(m.id)}
                  className="p-1 text-zinc-500 cursor-pointer"
                >
                  <Pin
                    className={`w-3 h-3 ${
                      settings.pinnedIds.includes(m.id) ? 'text-cyan-300' : ''
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
