import { useEffect, useRef, useState } from "react";
import type { DownloadTask } from "../../../domain/media-info";
import type { DownloaderApi } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";

const POLL_INTERVAL_MS = 900;

/**
 * The queue. It outlives the Extract view on purpose: a download started from Extract keeps
 * updating while the user is in Adapters or Settings.
 */
export interface TaskQueue {
  tasks: DownloadTask[];
  reload(): Promise<void>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  reveal(id: string): Promise<void>;
}

export function useTasks(ctx: ManagedPluginContext, api: DownloaderApi, active: boolean): TaskQueue {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function reload(): Promise<void> {
    const next = await api.tasks();
    if (mounted.current) setTasks(next);
  }

  useEffect(() => {
    if (!active) return;
    void reload().catch(() => undefined);
    const timer = setInterval(() => {
      void reload().catch(() => undefined);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // `reload` closes over props only; polling restarts when the service becomes usable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function run(action: (id: string) => Promise<unknown>, id: string, failureKey: string): Promise<void> {
    try {
      await action(id);
      await reload();
    } catch (error) {
      ctx.ui.notify({ message: ctx.i18n.t(failureKey), error, variant: "error" });
    }
  }

  return {
    tasks,
    reload,
    cancel: (id) => run(api.cancelTask, id, "error.cancelFailed"),
    retry: (id) => run(api.retryTask, id, "error.retryFailed"),
    remove: (id) => run(api.removeTask, id, "error.removeFailed"),
    reveal: (id) => run(api.revealTask, id, "error.revealFailed"),
  };
}
