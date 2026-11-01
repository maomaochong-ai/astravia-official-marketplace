import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Adapter } from "../../../domain/adapter";

export function AdapterCard({
  adapter,
  running,
  blocked,
  matches,
  onRun,
  onToggle,
  onEdit,
  onRemove,
}: {
  adapter: Adapter;
  running: boolean;
  /** Another surface is busy — a probe or a different adapter run owns the page slot. */
  blocked?: boolean;
  /** Whether the current page address is inside this Adapter's `@match` list. */
  matches: boolean;
  onRun(): void;
  onToggle(enabled: boolean): void;
  onEdit(): void;
  onRemove(): void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{adapter.meta.name}</span>
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {adapter.meta.version}
            </span>
          </div>
          {adapter.meta.description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{adapter.meta.description}</p>
          ) : null}
          <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">{adapter.meta.match.join("  ")}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={adapter.enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="size-3 accent-[var(--primary)]"
          />
          {t("adapter.enabled")}
        </label>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          disabled={!matches || running || blocked || !adapter.enabled}
          onClick={onRun}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span className={`icon-[solar--play-linear] size-3 ${running ? "animate-pulse" : ""}`} aria-hidden="true" />
          {running ? t("adapter.running") : t("action.runAdapter")}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--pen-linear] size-3" aria-hidden="true" />
          {t("action.edit")}
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-destructive/40 px-2 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
          >
            {t("action.confirmRemove")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="icon-[solar--trash-bin-trash-linear] size-3" aria-hidden="true" />
            {t("action.remove")}
          </button>
        )}
      </div>

      {!matches && adapter.enabled ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{t("adapter.noMatch")}</p>
      ) : null}
    </div>
  );
}
