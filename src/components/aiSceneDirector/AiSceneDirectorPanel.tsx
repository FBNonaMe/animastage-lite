import { useCallback, useMemo, useState } from 'react';
import { Clapperboard, Sparkles, Wand2 } from 'lucide-react';
import type { AppState, ViewportFormat } from '../../types';
import { hasOpenRouterApiKey } from '../../ai/openrouter';
import {
  getStoredNvidiaApiKey,
  setStoredNvidiaApiKey,
  hasNvidiaApiKey,
  loadNvidiaSettings,
  saveNvidiaSettings,
  loadAiDirectorCloudProvider,
  saveAiDirectorCloudProvider,
  NVIDIA_SCENE_DIRECTOR_MODELS,
  type AiDirectorCloudProvider,
} from '../../ai/nvidia';
import {
  buildAiDirectorRegistry,
  generateScenePlan,
  executeSceneCommands,
  pushAiDirectorHistory,
  loadAiDirectorHistory,
  validateScenePlan,
  resolveSceneDirectorProvider,
  type AiDirectorMode,
  type AiScenePlanValidation,
} from '../../aiSceneDirector';

interface AiSceneDirectorPanelProps {
  appState: AppState;
  onApplyResult: (result: {
    appState: AppState;
    shot: {
      shotPreset: string;
      aspect: ViewportFormat;
      autoFrame: boolean;
      placeMode: boolean;
      placement: string;
    } | null;
    animationAssetId: string | null;
    characterId: string | null;
    messages: string[];
  }) => void;
  onToast?: (message: string, ms?: number) => void;
}

const MODES: { id: AiDirectorMode; label: string; hint: string }[] = [
  { id: 'normal', label: 'Normal', hint: 'Show plan, then Apply' },
  { id: 'fast', label: 'Fast', hint: 'Generate and apply after validation' },
  { id: 'pro', label: 'Pro', hint: 'Full plan + commands' },
];

export default function AiSceneDirectorPanel({
  appState,
  onApplyResult,
  onToast,
}: AiSceneDirectorPanelProps) {
  const [prompt, setPrompt] = useState(
    'Create a cinematic 9:16 anime scene at night. Put the character in the center, add rain, light fog, moonlight and a slow camera orbit.'
  );
  const [mode, setMode] = useState<AiDirectorMode>('normal');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [validation, setValidation] = useState<(AiScenePlanValidation & { source?: string }) | null>(
    null
  );
  const [history, setHistory] = useState(() => loadAiDirectorHistory());
  const [provider, setProvider] = useState<AiDirectorCloudProvider>(() =>
    loadAiDirectorCloudProvider()
  );
  const [nvidiaKeyDraft, setNvidiaKeyDraft] = useState(() => getStoredNvidiaApiKey());
  const [nvidiaReady, setNvidiaReady] = useState(() => hasNvidiaApiKey());
  const [nvidiaModelId, setNvidiaModelId] = useState(
    () => loadNvidiaSettings().modelId
  );

  const registry = useMemo(() => buildAiDirectorRegistry(appState), [appState]);
  const openRouterReady = hasOpenRouterApiKey();
  const activeProvider = resolveSceneDirectorProvider(provider);
  const badge =
    activeProvider === 'nvidia'
      ? 'NVIDIA'
      : activeProvider === 'openrouter'
        ? 'OpenRouter'
        : 'Offline';

  const onSelectProvider = useCallback((next: AiDirectorCloudProvider) => {
    setProvider(next);
    saveAiDirectorCloudProvider(next);
  }, []);

  const onSaveNvidiaKey = useCallback(() => {
    setStoredNvidiaApiKey(nvidiaKeyDraft);
    const ready = hasNvidiaApiKey();
    setNvidiaReady(ready);
    setNvidiaKeyDraft(getStoredNvidiaApiKey() || nvidiaKeyDraft.trim());
    if (ready) {
      onSelectProvider('nvidia');
      onToast?.('NVIDIA API key saved', 2200);
    } else {
      onToast?.('NVIDIA key cleared', 2000);
    }
  }, [nvidiaKeyDraft, onSelectProvider, onToast]);

  const applyValidated = useCallback(
    (next: AiScenePlanValidation) => {
      if (!next.ok) {
        onToast?.(next.errors[0] ?? 'Scene plan failed validation', 3500);
        return;
      }
      const result = executeSceneCommands(appState, next.plan, next.commands);
      onApplyResult({
        ...result,
        shot: result.shot
          ? {
              ...result.shot,
              aspect: result.shot.aspect,
            }
          : null,
      });
      setHistory(pushAiDirectorHistory(prompt.trim(), next.plan, mode));
      onToast?.(`Scene applied · ${result.messages.slice(0, 3).join(' · ')}`, 3200);
    },
    [appState, mode, onApplyResult, onToast, prompt]
  );

  const onGenerate = useCallback(async () => {
    setBusy(true);
    setStatus('Preparing…');
    try {
      const result = await generateScenePlan(prompt, registry, {
        mode,
        provider,
        onProgress: setStatus,
      });
      setValidation(result);
      setStatus(
        result.source === 'ai'
          ? `AI plan ready · ${result.provider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'}`
          : 'Local plan ready'
      );
      if (mode === 'fast' && result.ok) {
        applyValidated(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scene Director failed';
      setStatus(message);
      onToast?.(message, 4000);
    } finally {
      setBusy(false);
    }
  }, [applyValidated, mode, onToast, prompt, provider, registry]);

  const plan = validation?.plan;

  return (
    <div className="p-2 space-y-2 text-[10px] text-zinc-300">
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1 font-bold text-violet-100">
              <Wand2 className="h-3.5 w-3.5" />
              AI Scene Director
            </p>
            <p className="text-[9px] text-zinc-500">
              Describe → Plan → Validate → Build · engine places & frames
            </p>
          </div>
          <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[8px] uppercase text-zinc-400">
            {badge}
          </span>
        </div>
      </div>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-2 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
          Cloud provider
        </p>
        <div className="flex gap-1">
          {(
            [
              { id: 'nvidia' as const, label: 'NVIDIA', ready: nvidiaReady },
              { id: 'openrouter' as const, label: 'OpenRouter', ready: openRouterReady },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectProvider(item.id)}
              className={`flex-1 rounded border px-2 py-1.5 text-[9px] font-bold uppercase cursor-pointer ${
                provider === item.id
                  ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                  : 'border-zinc-800 text-zinc-500'
              }`}
            >
              {item.label}
              <span className="ml-1 font-normal opacity-70">
                {item.ready ? '· ready' : '· no key'}
              </span>
            </button>
          ))}
        </div>

        {provider === 'nvidia' ? (
          <div className="space-y-1.5">
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-500">
                NVIDIA API key{' '}
                <a
                  href="https://build.nvidia.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400/90 hover:underline"
                >
                  build.nvidia.com
                </a>
              </span>
              <input
                type="password"
                autoComplete="off"
                value={nvidiaKeyDraft}
                onChange={(event) => setNvidiaKeyDraft(event.target.value)}
                placeholder="nvapi-…"
                className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-violet-500/40"
              />
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onSaveNvidiaKey}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-100 cursor-pointer"
              >
                Save key
              </button>
              <select
                value={nvidiaModelId}
                onChange={(event) => {
                  const id = event.target.value;
                  setNvidiaModelId(id);
                  saveNvidiaSettings({ modelId: id });
                }}
                className="min-w-0 flex-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[9px] text-zinc-300 outline-none"
              >
                {NVIDIA_SCENE_DIRECTOR_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            {!nvidiaReady ? (
              <p className="text-[9px] text-amber-300/80">
                Paste your NVIDIA key (nvapi-…) and Save to use cloud planning.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[9px] text-zinc-500">
            {openRouterReady
              ? 'Using the OpenRouter key from AI / Motion Capture settings.'
              : 'No OpenRouter key — open AI / Motion Capture to add one, or switch to NVIDIA.'}
          </p>
        )}
      </section>

      <div className="flex gap-1">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.hint}
            onClick={() => setMode(item.id)}
            className={`rounded border px-2 py-1 text-[9px] font-bold uppercase cursor-pointer ${
              mode === item.id
                ? 'border-violet-500/50 bg-violet-500/15 text-violet-100'
                : 'border-zinc-800 text-zinc-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="block space-y-1">
        <span className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
          Describe your scene
        </span>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={5}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-violet-500/40"
          placeholder="Cinematic rainy neon street, 9:16 full body, moonlight…"
        />
      </label>

      <div className="flex gap-1">
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() => void onGenerate()}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/20 px-2 py-2 text-[11px] font-bold text-violet-100 hover:bg-violet-500/30 disabled:opacity-40 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {busy ? 'Generating…' : 'Generate Scene'}
        </button>
      </div>

      {status ? <p className="text-[9px] text-zinc-500">{status}</p> : null}

      <div className="rounded border border-zinc-800 bg-zinc-950/50 px-2 py-1.5 text-[9px] text-zinc-500">
        Assets · {registry.assets.length} · Char{' '}
        {registry.hasCharacter ? 'ready' : 'missing'} · Env{' '}
        {registry.hasEnvironment ? 'ready' : 'optional'}
      </div>

      {plan ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2 space-y-2">
          <p className="flex items-center gap-1 font-bold text-zinc-200">
            <Clapperboard className="h-3 w-3 text-cyan-300" />
            Scene Plan
          </p>
          <p className="text-[10px] text-zinc-300">{plan.summary}</p>
          <div className="grid grid-cols-2 gap-1 text-[9px]">
            <div>Mood · {plan.moodPresetId ?? '—'}</div>
            <div>Shot · {plan.shotPreset ?? '—'}</div>
            <div>Aspect · {plan.aspectRatio ?? '—'}</div>
            <div>Light · {plan.lightingPresetId ?? '—'}</div>
            <div>Weather · {plan.weather ?? '—'}</div>
            <div>Physics · {plan.physicsPresetId ?? '—'}</div>
            <div className="col-span-2">FX · {plan.fxIds.join(', ') || '—'}</div>
            <div className="col-span-2">Place · {plan.placement}</div>
            <div className="col-span-2">Camera · {plan.cameraMovement}</div>
          </div>

          {validation?.suggestions.length ? (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-1.5 text-[9px] text-amber-100">
              {validation.suggestions.map((item) => (
                <p key={`${item.field}-${item.requested}`}>
                  {item.field}: “{item.requested}” → {item.suggestedName}
                </p>
              ))}
            </div>
          ) : null}

          {plan.warnings.length ? (
            <div className="text-[9px] text-amber-300/80 space-y-0.5">
              {plan.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {validation?.errors.length ? (
            <div className="text-[9px] text-red-300 space-y-0.5">
              {validation.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {mode === 'pro' && validation?.commands.length ? (
            <details className="rounded border border-zinc-800 p-1.5">
              <summary className="cursor-pointer text-[9px] font-bold text-zinc-400">
                Commands ({validation.commands.length})
              </summary>
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[8px] text-zinc-500">
                {JSON.stringify(validation.commands, null, 2)}
              </pre>
            </details>
          ) : null}

          <div className="flex gap-1">
            <button
              type="button"
              disabled={!validation?.ok}
              onClick={() => validation && applyValidated(validation)}
              className="flex-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-1.5 text-[10px] font-bold text-cyan-100 disabled:opacity-40 cursor-pointer"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setValidation(null)}
              className="rounded border border-zinc-700 px-2 py-1.5 text-[10px] font-bold text-zinc-400 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
            History
          </p>
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {history.slice(0, 6).map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setPrompt(entry.prompt);
                  setValidation(validateScenePlan(entry.plan, registry));
                }}
                className="block w-full truncate rounded border border-zinc-800 px-1.5 py-1 text-left text-[9px] text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                {entry.plan.summary || entry.prompt}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
