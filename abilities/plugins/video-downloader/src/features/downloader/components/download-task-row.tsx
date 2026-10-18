import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes, formatDuration, formatSpeed } from "../../../domain/format-bytes";
import type { DownloadTask } from "../../../domain/media-info";
import { phaseLabelKey, progressOf } from "../../../domain/task-state";
import { IconButton } from "../../../shared/components/icon-button";
import { SiteMonogram } from "../../../shared/components/site-monogram";

interface DownloadTaskRowProps {
  task: DownloadTask;
  onCancel(id: string): void;
  onRetry(id: string): void;
  onRemove(id: string): void;
  onReveal(id: string): void;
}

const ACTIVE = new Set(["queued", "extracting", "downloading", "merging", "moving"]);

export function DownloadTaskRow({ task, onCancel, onRetry, onRemove, onReveal }: DownloadTaskRowProps) {
  const { t } = useTranslation();
  const active = ACTIVE.has(task.phase);
  const progress = progressOf(task);
  const failed = task.phase === "failed";
  const done = task.phase === "completed";

  const speed = active && task.phase === "downloading" ? formatSpeed(task.speedBps) : null;
  const eta = active && task.phase === "downloading" ? formatDuration(task.etaSeconds) : null;
  const size = task.totalBytes > 0 ? formatBytes(task.totalBytes) : null;

  const meta = [task.site, task.quality, task.ext.toUpperCase(), size].filter(Boolean).join(" · ");

  const status = speed
    ? `${speed}${eta ? ` · ${t("task.remaining", { time: eta })}` : ""}`
    : done && task.filePath
      ? t("task.saved")
      : t(phaseLabelKey(task.phase));

  return (
    <div className="group flex gap-3 py-3">
      <SiteMonogram site={task.site} url={task.url} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-foreground" title={task.title}>
            {task.title}
          </p>
          <span
            className={`shrink-0 text-[11px] tabular-nums ${
              failed ? "text-destructive" : done ? "text-muted-foreground" : "text-muted-foreground"
            }`}
          >
            {status}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {meta}
          {task.totalBytes > 0 && active ? ` · ${formatBytes(task.receivedBytes)}` : ""}
        </p>

        {active ? (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(progress * 100, 2)}%` }}
            />
          </div>
        ) : null}

        {failed && task.error ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-destructive">{task.error}</p>
        ) : null}

        <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {active ? (
            <IconButton icon="icon-[solar--close-circle-linear]" label={t("task.action.cancel")} onClick={() => onCancel(task.id)} />
          ) : null}
          {failed || task.phase === "canceled" ? (
            <IconButton icon="icon-[solar--refresh-linear]" label={t("task.action.retry")} onClick={() => onRetry(task.id)} />
          ) : null}
          {done ? (
            <IconButton icon="icon-[solar--folder-open-linear]" label={t("task.action.reveal")} onClick={() => onReveal(task.id)} />
          ) : null}
          {!active ? (
            <IconButton icon="icon-[solar--trash-bin-trash-linear]" label={t("task.action.remove")} onClick={() => onRemove(task.id)} danger />
          ) : null}
        </div>
      </div>
    </div>
  );
}
