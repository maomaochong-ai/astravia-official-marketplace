import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../../../domain/media-info";
import { adapterMatchesUrl, adapterToItem, matchingAdapters, parseAdapterJson, type Adapter } from "../../../domain/adapter";
import { AdapterStore } from "../../../services/adapter-store";
import { AdapterRunError, runAdapter } from "../../../services/adapter-runner";
import type { ManagedPluginContext } from "../../../runtime-contract";

export interface AdapterRunSummary {
  adapterId: string;
  name: string;
  ok: boolean;
  message: string;
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
  /** Run one Adapter against `url`; resolves to the resolved item, or null on failure. */
  run(adapter: Adapter, url: string): Promise<MediaItem | null>;
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

  async function run(adapter: Adapter, target: string): Promise<MediaItem | null> {
    const capture = ctx.capture;
    if (!capture?.offscreen) {
      setError("当前版本不提供离屏页面能力，适配器无法运行");
      return null;
    }
    if (!adapterMatchesUrl(adapter, target)) {
      setError(`${adapter.meta.name} 的 @match 不接受这个地址`);
      return null;
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
        message: result.extraction.quality || result.extraction.ext || "mp4",
        at: Date.now(),
      });
      return item;
    } catch (runError) {
      const message = runError instanceof AdapterRunError ? runError.message : String(runError);
      setError(message);
      setLastRun({ adapterId: adapter.id, name: adapter.meta.name, ok: false, message, at: Date.now() });
      return null;
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

