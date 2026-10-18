import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDirectory } from "../fs/files.js";
import { isActivePhase, type DownloadTask } from "./types.js";

const HISTORY_LIMIT = 60;

export interface NewTaskInput {
  url: string;
  site: string;
  title: string;
  streamId: string;
  quality: string;
  ext: string;
  needsFfmpeg: boolean;
  totalBytes: number;
}

/**
 * Task bookkeeping with disk persistence.
 *
 * Only terminal tasks survive a restart: a task that was mid-flight when the service
 * died has lost its child process, so reviving it as "completed" would be a lie and
 * reviving it as active would leave a spinner that never resolves.
 */
export class TaskStore {
  private readonly tasks = new Map<string, DownloadTask>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly dataRoot: string) {}

  private get file(): string {
    return join(this.dataRoot, "tasks.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      for (const entry of parsed) {
        const task = entry as DownloadTask;
        if (!task?.id || typeof task.id !== "string") continue;
        if (isActivePhase(task.phase) || task.phase === "queued") {
          this.tasks.set(task.id, {
            ...task,
            phase: "failed",
            error: "服务重启，任务已中断",
            speedBps: 0,
            etaSeconds: null,
            finishedAt: Date.now(),
          });
          continue;
        }
        this.tasks.set(task.id, task);
      }
      this.trim();
    } catch {
      // No history yet.
    }
  }

  list(): DownloadTask[] {
    return [...this.tasks.values()].sort((left, right) => right.createdAt - left.createdAt);
  }

  get(id: string): DownloadTask | undefined {
    return this.tasks.get(id);
  }

  create(input: NewTaskInput): DownloadTask {
    const task: DownloadTask = {
      id: randomUUID(),
      url: input.url,
      site: input.site,
      title: input.title,
      streamId: input.streamId,
      quality: input.quality,
      ext: input.ext,
      needsFfmpeg: input.needsFfmpeg,
      totalBytes: input.totalBytes,
      receivedBytes: 0,
      speedBps: 0,
      etaSeconds: null,
      phase: "queued",
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      filePath: null,
      error: null,
    };
    this.tasks.set(task.id, task);
    this.persist();
    return task;
  }

  update(id: string, patch: Partial<DownloadTask>): DownloadTask | undefined {
    const current = this.tasks.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.tasks.set(id, next);
    if (patch.phase && patch.phase !== current.phase) this.persist();
    return next;
  }

  remove(id: string): boolean {
    const removed = this.tasks.delete(id);
    if (removed) this.persist();
    return removed;
  }

  activeCount(): number {
    return this.list().filter((task) => isActivePhase(task.phase)).length;
  }

  private trim(): void {
    const terminal = this.list().filter((task) => !isActivePhase(task.phase));
    for (const task of terminal.slice(HISTORY_LIMIT)) this.tasks.delete(task.id);
  }

  persist(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 250);
  }

  async flush(): Promise<void> {
    this.trim();
    try {
      await ensureDirectory(this.dataRoot);
      await writeFile(this.file, `${JSON.stringify(this.list(), null, 2)}\n`, "utf8");
    } catch {
      // Persistence is best effort; the in-memory state stays authoritative while running.
    }
  }
}
