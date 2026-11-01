import { useEffect, useRef, useState } from "react";
import {
  adapterMatchesUrl,
  adapterToItem,
  matchingAdapters,
  parseAdapterJson,
  type Adapter,
  type AdapterOutcome,
} from "../../../domain/adapter";
import { AdapterStore } from "../../../services/adapter-store";
import { AdapterRunError, runAdapter } from "../../../services/adapter-runner";
import type { ManagedPluginContext } from "../../../runtime-contract";

function failure(message: string, detail = "", screenshot = "", loginRequired = false): AdapterOutcome {
  return { ok: false, message, detail, screenshot, loginRequired };
}

export interface AdapterRunSummary {
  adapterId: string;
  name: string;
  ok: boolean;
  message: string;
  /** Failure only: the offscreen page bitmap, so a login wall can be seen rather than guessed. */
  screenshot: string;
  loginRequired: boolean;
  at: number;
}

/**
 * Adapters view state. Nothing here is fetched from the network: the registry is a local file the
 * user edits, which is what keeps an Adapter from becoming a second update channel.
 */
export interface AdapterController {
  /** False when the host exposes no offscreen capture; the view explains the gap instead of hiding. */
  available: boolean;
  adapters: Adapter[];
  loading: boolean;
  runningId: string | null;
  /** Last import or run problem, shown once above the list. */
  error: string | null;
  lastRun: AdapterRunSummary | null;
  candidates(url: string): Adapter[];
  importText(text: string): Promise<boolean>;
  remove(id: string): Promise<void>;
  toggle(id: string, enabled: boolean): Promise<void>;
  /** Run one Adapter against `url`; the outcome carries either the item or why there is none. */
  run(adapter: Adapter, url: string): Promise<AdapterOutcome>;
}

export function useAdapters(ctx: ManagedPluginContext): AdapterController {
  const available = Boolean(ctx.capture?.offscreen);
  const store = useRef<AdapterStore | null>(null);
  if (!store.current) store.current = new AdapterStore(ctx.storage);

  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [loading, setLoading] = useState(available);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<AdapterRunSummary | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const loaded = await store.current?.list().catch(() => []) ?? [];
      if (!mounted.current) return;
      setAdapters(loaded);
      setLoading(false);
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function importText(text: string): Promise<boolean> {
    const parsed = parseAdapterJson(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    const next = await store.current?.upsert(parsed.adapter) ?? [];
    setAdapters(next);
    setError(null);
    return true;
  }

  async function remove(id: string): Promise<void> {
    setAdapters(await store.current?.remove(id) ?? []);
  }

  async function toggle(id: string, enabled: boolean): Promise<void> {
    setAdapters(await store.current?.setEnabled(id, enabled) ?? []);
  }

  async function run(adapter: Adapter, target: string): Promise<AdapterOutcome> {
    const capture = ctx.capture;
    if (!capture?.offscreen) {
      const message = "当前版本不提供离屏页面能力，适配器无法运行";
      setError(message);
      return failure(message);
    }
    if (!adapterMatchesUrl(adapter, target)) {
      const message = `${adapter.meta.name} 的 @match 不接受这个地址`;
      setError(message);
      return failure(message);
    }
    setRunningId(adapter.id);
    setError(null);
    try {
      const values = await store.current?.readValues(adapter.id) ?? {};
      const result = await runAdapter(capture, adapter, target, values);
      if (Object.keys(result.values).length > 0) {
        await store.current?.writeValues(adapter.id, result.values);
      }
      const item = adapterToItem(adapter, target, result.extraction);
      setLastRun({
        adapterId: adapter.id,
        name: adapter.meta.name,
        ok: true,
        message: result.extraction.metadataOnly
          ? ctx.i18n.t("adapter.metadataOnly")
          : result.extraction.quality || result.extraction.ext || "mp4",
        screenshot: "",
        loginRequired: false,
        at: Date.now(),
      });
      return { ok: true, item };
    } catch (runError) {
      const known = runError instanceof AdapterRunError ? runError : null;
      const detail = known?.detail ?? (runError instanceof Error ? runError.message : String(runError));
      // The page-side sentence says more than our own headline, so it is what the panel shows.
      const message = detail || known?.message || String(runError);
      const screenshot = known?.screenshot ?? "";
      const loginRequired = known?.loginRequired ?? false;
      setError(message);
      setLastRun({ adapterId: adapter.id, name: adapter.meta.name, ok: false, message, screenshot, loginRequired, at: Date.now() });
      return failure(message, detail, screenshot, loginRequired);
    } finally {
      setRunningId(null);
    }
  }

  return {
    available,
    adapters,
    loading,
    runningId,
    error,
    lastRun,
    candidates: (target) => matchingAdapters(adapters, target),
    importText,
    remove,
    toggle,
    run,
  };
}

