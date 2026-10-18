export type TaskPhase =
  | "queued"
  | "extracting"
  | "downloading"
  | "merging"
  | "moving"
  | "completed"
  | "failed"
  | "canceled";

export interface DownloadTask {
  id: string;
  url: string;
  site: string;
  title: string;
  streamId: string;
  quality: string;
  ext: string;
  /** Upstream splits this rendition into parts that lux remuxes with ffmpeg. */
  needsFfmpeg: boolean;
  /** Expected size reported by the probe; 0 when upstream did not disclose one. */
  totalBytes: number;
  receivedBytes: number;
  speedBps: number;
  etaSeconds: number | null;
  phase: TaskPhase;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  filePath: string | null;
  error: string | null;
}

const ACTIVE_PHASES = new Set<TaskPhase>(["extracting", "downloading", "merging", "moving"]);

export function isActivePhase(phase: TaskPhase): boolean {
  return ACTIVE_PHASES.has(phase);
}

export function isTerminalPhase(phase: TaskPhase): boolean {
  return phase === "completed" || phase === "failed" || phase === "canceled";
}

export function progressRatio(task: DownloadTask): number | null {
  if (task.phase === "completed") return 1;
  if (task.totalBytes <= 0) return null;
  return Math.max(0, Math.min(1, task.receivedBytes / task.totalBytes));
}

/** Remaining time in seconds, or null while the transfer speed is still unknown. */
export function estimateRemaining(task: DownloadTask): number | null {
  if (task.phase !== "downloading") return null;
  if (task.totalBytes <= 0 || task.speedBps <= 0) return null;
  const remaining = task.totalBytes - task.receivedBytes;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / task.speedBps);
}
