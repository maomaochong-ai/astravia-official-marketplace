import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { measureDirectory } from "../fs/directory-usage.js";
import { ensureDirectory, moveProducedFiles } from "../fs/files.js";
import { withToolPath } from "../tools/tool-paths.js";
import { codeOfYtdlpFailure, firstYtdlpErrorLine } from "../ytdlp/diagnostics.js";
import { jsRuntimeArgs, proxyArgs } from "../ytdlp/engine-args.js";
import { removeCookieFile, writeCookieFile } from "../ytdlp/cookies.js";
import type { ServiceSettings } from "../settings/settings-store.js";
import type { TaskStore } from "./task-store.js";
import { estimateRemaining, type DownloadTask } from "./types.js";

const POLL_INTERVAL_MS = 400;
const TERMINATE_GRACE_MS = 4_000;
const SPEED_SMOOTHING = 0.55;
/** Fragments fetched in parallel when `multiThread` is on; yt-dlp only parallelizes HLS/DASH. */
const CONCURRENT_FRAGMENTS = "4";

const ANSI = /\u001b\[[0-9;]*m/gu;

type EngineChildProcess = ChildProcessByStdio<null, Readable, Readable>;

interface RunningTask {
  child: EngineChildProcess | null;
  timer: NodeJS.Timeout | null;
  workDirectory: string;
  canceled: boolean;
  lastBytes: number;
  lastSampledAt: number;
  speedBps: number;
  sawBytes: boolean;
  stderrTail: string;
  /** The engine reports most failures on stdout, so a bounded copy of it is kept for the message. */
  stdoutTail: string;
  /** Jar written for this task only, removed when the task settles. */
  cookieFile: string | null;
}

export interface RunnerDependencies {
  store: TaskStore;
  settings: () => ServiceSettings;
  ytdlpPath: () => string | null;
  dataRoot: string;
  /** Directory holding tools the plugin provisioned itself (ffmpeg). */
  toolDirectory: string;
  onUpdate?: (task: DownloadTask) => void;
}

/** Reduce a failed engine run to one readable line. */
export function summarizeFailure(stderr: string, stdout: string): { message: string; code: string | null } {
  const line = firstYtdlpErrorLine(stderr) ?? firstYtdlpErrorLine(stdout);
  if (!line) return { message: "下载失败", code: null };
  return { message: line.slice(0, 240), code: codeOfYtdlpFailure(line) };
}

/**
 * Owns the lifecycle of every download: queueing, spawning the engine, sampling progress
 * from the work directory, then moving finished files into the user's download folder.
 *
 * Progress is measured from bytes on disk rather than from a terminal progress bar, which is a
 * TTY-oriented rendering with colour codes and is not a stable interface.
 */
export class DownloadRunner {
  private readonly running = new Map<string, RunningTask>();
  private readonly scheduled = new Set<string>();
  private stopping = false;

  constructor(private readonly dependencies: RunnerDependencies) {}

  schedule(taskId: string): void {
    if (this.stopping) return;
    if (this.running.has(taskId) || this.scheduled.has(taskId)) return;
    this.scheduled.add(taskId);
    this.pump();
  }

  private pump(): void {
    const limit = this.dependencies.settings().maxConcurrent;
    while (this.running.size < limit) {
      const next = this.dependencies.store
        .list()
        .reverse()
        .find((task) => task.phase === "queued" && this.scheduled.has(task.id) && !this.running.has(task.id));
      if (!next) break;
      this.scheduled.delete(next.id);
      void this.run(next);
    }
  }

  private workDirectoryFor(task: DownloadTask): string {
    return join(this.dependencies.dataRoot, "work", task.id);
  }

  private async run(task: DownloadTask): Promise<void> {
    const store = this.dependencies.store;
    const enginePath = this.dependencies.ytdlpPath();
    if (!enginePath) {
      store.update(task.id, {
        phase: "failed",
        error: "下载引擎尚未就绪，请稍候重试",
        errorCode: "engine_unavailable",
        finishedAt: Date.now(),
      });
      this.emit(task.id);
      this.pump();
      return;
    }

    const settings = this.dependencies.settings();
    const workDirectory = this.workDirectoryFor(task);

    // Reserve the concurrency slot before the first await so `pump` stays accurate.
    const state: RunningTask = {
      child: null,
      timer: null,
      workDirectory,
      canceled: false,
      lastBytes: 0,
      lastSampledAt: Date.now(),
      speedBps: 0,
      sawBytes: false,
      stderrTail: "",
      stdoutTail: "",
      cookieFile: null,
    };
    this.running.set(task.id, state);
    await ensureDirectory(workDirectory);

    // The engine reads cookies from a jar, and the jar is scoped to this task's host.
    if (settings.cookie.trim()) {
      state.cookieFile = await writeCookieFile(
        this.dependencies.dataRoot,
        settings.cookie,
        task.url,
        `task-${task.id}`,
      ).catch(() => null);
    }

    const args = this.argumentsFor(task, settings, workDirectory, state.cookieFile);

    store.update(task.id, { phase: "extracting", startedAt: Date.now() });
    this.emit(task.id);

    let child: EngineChildProcess;
    try {
      // The engine resolves `ffmpeg` through PATH, so the provisioned tool directory goes first.
      child = spawn(enginePath, args, {
        cwd: workDirectory,
        env: withToolPath(this.dependencies.toolDirectory),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      this.running.delete(task.id);
      await removeCookieFile(state.cookieFile);
      store.update(task.id, {
        phase: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: Date.now(),
      });
      this.emit(task.id);
      this.pump();
      return;
    }
    state.child = child;

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8").replace(ANSI, "");
      state.stderrTail = `${state.stderrTail}${text}`.slice(-4000);
    });
    child.stdout.on("data", (chunk: Buffer) => {
      state.stdoutTail = `${state.stdoutTail}${chunk.toString("utf8").replace(ANSI, "")}`.slice(-4000);
    });

    state.timer = setInterval(() => void this.sample(task.id), POLL_INTERVAL_MS);

    child.on("error", (error) => {
      void this.finish(task.id, { ok: false, reason: error.message, code: null });
    });
    child.on("close", (code) => {
      const stderrTail = state.stderrTail;
      const stdoutTail = state.stdoutTail;
      if (state.canceled) {
        void this.finish(task.id, { ok: false, reason: "已取消", code: null });
        return;
      }
      const failure = code === 0 ? null : summarizeFailure(stderrTail, stdoutTail);
      void this.finish(task.id, {
        ok: code === 0,
        reason: failure?.message ?? "",
        code: failure?.code ?? null,
      });
    });
  }

  /** Command line for the engine. */
  private argumentsFor(
    task: DownloadTask,
    settings: ServiceSettings,
    workDirectory: string,
    cookieFile: string | null,
  ): string[] {
    const args = ["--no-warnings", "--no-playlist", "--no-progress"];
    // Same engine flags as the probe: the stream id it resolved has to stay fetchable here.
    args.push(...jsRuntimeArgs(), ...proxyArgs(settings.proxy));
    if (settings.multiThread) args.push("--concurrent-fragments", CONCURRENT_FRAGMENTS);
    if (cookieFile) args.push("--cookies", cookieFile);
    // The template lets the engine name the file; `moveProducedFiles` works on the directory.
    args.push("-f", task.streamId, "-o", join(workDirectory, "%(title)s.%(ext)s"), task.url);
    return args;
  }

  private async sample(taskId: string): Promise<void> {
    const state = this.running.get(taskId);
    if (!state) return;
    const store = this.dependencies.store;
    const task = store.get(taskId);
    if (!task) return;

    const usage = await measureDirectory(state.workDirectory);
    const now = Date.now();
    const elapsed = (now - state.lastSampledAt) / 1000;
    const delta = usage.bytes - state.lastBytes;
    if (elapsed > 0 && delta >= 0) {
      const instant = delta / elapsed;
      state.speedBps = state.speedBps > 0 ? state.speedBps * SPEED_SMOOTHING + instant * (1 - SPEED_SMOOTHING) : instant;
    }
    state.lastBytes = usage.bytes;
    state.lastSampledAt = now;

    // The merged output lands next to the parts it was built from, so the directory total
    // briefly counts the same bytes twice. Clamp against the size the probe reported.
    const receivedBytes = task.totalBytes > 0 ? Math.min(usage.bytes, task.totalBytes) : usage.bytes;
    const reachedTotal = task.totalBytes > 0 && receivedBytes >= task.totalBytes * 0.995;
    const phase = reachedTotal && receivedBytes > 0 ? "merging" : receivedBytes > 0 ? "downloading" : "extracting";
    state.sawBytes = state.sawBytes || receivedBytes > 0;
    const speedBps = phase === "downloading" ? Math.max(0, Math.round(state.speedBps)) : 0;

    store.update(taskId, {
      receivedBytes,
      speedBps,
      phase: task.phase === "moving" ? "moving" : phase,
      etaSeconds: phase === "downloading" ? estimateRemaining({ ...task, receivedBytes, speedBps }) : null,
    });
    this.emit(taskId);
  }

  private async finish(taskId: string, outcome: { ok: boolean; reason: string; code: string | null }): Promise<void> {
    const state = this.running.get(taskId);
    if (!state) return;
    this.running.delete(taskId);
    if (state.timer) clearInterval(state.timer);
    state.child = null;
    await removeCookieFile(state.cookieFile);

    const store = this.dependencies.store;
    const task = store.get(taskId);
    if (!task) {
      this.pump();
      return;
    }
    const settings = this.dependencies.settings();

    if (state.canceled) {
      store.update(taskId, {
        phase: "canceled",
        speedBps: 0,
        etaSeconds: null,
        finishedAt: Date.now(),
        error: null,
      });
      await rm(state.workDirectory, { recursive: true, force: true }).catch(() => undefined);
      this.emit(taskId);
      this.pump();
      return;
    }

    if (!outcome.ok) {
      store.update(taskId, {
        phase: "failed",
        speedBps: 0,
        etaSeconds: null,
        finishedAt: Date.now(),
        error: outcome.reason || "下载失败",
        errorCode: outcome.code,
      });
      // Keeping the work directory lets the user resume a large transfer by hand.
      if (!settings.keepPartialFiles) {
        await rm(state.workDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
      this.emit(taskId);
      this.pump();
      return;
    }

    store.update(taskId, { phase: "moving" });
    this.emit(taskId);
    const moved = await moveProducedFiles(state.workDirectory, settings.downloadDirectory);
    await rm(state.workDirectory, { recursive: true, force: true }).catch(() => undefined);

    if (moved.length === 0) {
      store.update(taskId, {
        phase: "failed",
        speedBps: 0,
        etaSeconds: null,
        finishedAt: Date.now(),
        error: "下载结束但没有生成文件",
      });
    } else {
      const primary = moved[0] ?? null;
      const extra = moved.length > 1 ? `（共 ${moved.length} 个文件）` : "";
      store.update(taskId, {
        phase: "completed",
        speedBps: 0,
        etaSeconds: 0,
        finishedAt: Date.now(),
        filePath: primary ? primary.path : null,
        error: moved.length > 1 ? `已保存 ${primary?.name ?? ""}${extra}` : null,
      });
    }
    this.emit(taskId);
    this.pump();
  }

  cancel(taskId: string): boolean {
    const state = this.running.get(taskId);
    if (!state) return false;
    state.canceled = true;
    const child = state.child;
    if (child) {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (state.child) state.child.kill("SIGKILL");
      }, TERMINATE_GRACE_MS);
    }
    return true;
  }

  async remove(taskId: string): Promise<boolean> {
    if (this.running.has(taskId)) return false;
    this.scheduled.delete(taskId);
    const task = this.dependencies.store.get(taskId);
    if (!task) return false;
    await rm(this.workDirectoryFor(task), { recursive: true, force: true }).catch(() => undefined);
    return this.dependencies.store.remove(taskId);
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    for (const [taskId, state] of this.running) {
      state.canceled = true;
      state.child?.kill("SIGKILL");
      if (state.timer) clearInterval(state.timer);
      this.dependencies.store.update(taskId, { phase: "failed", error: "服务已停止", finishedAt: Date.now() });
    }
    this.running.clear();
    await this.dependencies.store.flush();
  }

  private emit(taskId: string): void {
    const task = this.dependencies.store.get(taskId);
    if (task) this.dependencies.onUpdate?.(task);
  }
}
