import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DownloadTask } from "../../../domain/media-info";
import { sortTasks } from "../../../domain/task-state";
import { DownloadTaskRow } from "./download-task-row";

interface DownloadQueueProps {
  tasks: DownloadTask[];
  onCancel(id: string): void;
  onRetry(id: string): void;
  onRemove(id: string): void;
  onReveal(id: string): void;
}

export function DownloadQueue({ tasks, onCancel, onRetry, onRemove, onReveal }: DownloadQueueProps) {
  const { t } = useTranslation();
  if (tasks.length === 0) return null;
  const ordered = sortTasks(tasks);

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("queue.title")}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="mt-1 divide-y divide-border">
        {ordered.map((task) => (
          <DownloadTaskRow
            key={task.id}
            task={task}
            onCancel={onCancel}
            onRetry={onRetry}
            onRemove={onRemove}
            onReveal={onReveal}
          />
        ))}
      </div>
    </section>
  );
}
