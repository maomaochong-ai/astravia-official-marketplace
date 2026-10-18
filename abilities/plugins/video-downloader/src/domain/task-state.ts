import type { DownloadTask, TaskPhase } from "./media-info";

const ACTIVE_PHASES: ReadonlySet<TaskPhase> = new Set<TaskPhase>([
  "queued",
  "extracting",
  "downloading",
  "merging",
  "moving",
]);

export function isActive(task: DownloadTask): boolean {
  return ACTIVE_PHASES.has(task.phase);
}

/** 0…1, clamped: the merged file briefly makes the directory total exceed the reported size. */
export function progressOf(task: DownloadTask): number {
  if (task.phase === "completed") return 1;
  if (task.totalBytes <= 0) return 0;
  const ratio = task.receivedBytes / task.totalBytes;
  return Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
}

export function phaseLabelKey(phase: TaskPhase): string {
  switch (phase) {
    case "queued":
      return "task.phase.queued";
    case "extracting":
      return "task.phase.extracting";
    case "downloading":
      return "task.phase.downloading";
    case "merging":
      return "task.phase.merging";
    case "moving":
      return "task.phase.moving";
    case "completed":
      return "task.phase.completed";
    case "failed":
      return "task.phase.failed";
    case "canceled":
      return "task.phase.canceled";
  }
}

/** Newest first; unfinished work stays grouped above finished work. */
export function sortTasks(tasks: DownloadTask[]): DownloadTask[] {
  return [...tasks].sort((left, right) => {
    const leftActive = isActive(left) ? 1 : 0;
    const rightActive = isActive(right) ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;
    return right.createdAt - left.createdAt;
  });
}
