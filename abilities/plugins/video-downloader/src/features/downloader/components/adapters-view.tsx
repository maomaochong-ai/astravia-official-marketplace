import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { ADAPTER_TEMPLATE, adapterMatchesUrl, type Adapter } from "../../../domain/adapter";
import type { MediaItem } from "../../../domain/media-info";
import type { AdapterController } from "../hooks/use-adapters";
import { AdapterCard } from "./adapter-card";
import { AdapterEditor } from "./adapter-editor";

/**
 * The Adapters view ships no site script by design. It lists what the user imported, lets them run
 * one against the current address, and says so plainly when the host cannot open an offscreen page.
 */
export function AdaptersView({
  adapters,
  pageUrl,
  onPageUrlChange,
  onUseItem,
  busy,
}: {
  adapters: AdapterController;
  pageUrl: string;
  onPageUrlChange(value: string): void;
  onUseItem(item: MediaItem): void;
  /** A probe is running; the page slot is taken, so adapters must wait. */
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!adapters.available) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{t("adapter.unavailable")}</p>
      </div>
    );
  }

  async function run(adapter: Adapter): Promise<void> {
    const outcome = await adapters.run(adapter, pageUrl.trim());
    if (outcome.ok) onUseItem(outcome.item);
  }

  return (
    <div className="mt-5 space-y-3">
      <div>
        <label className="text-[11px] font-medium text-muted-foreground" htmlFor="adapter-page">
          {t("adapter.pageUrl")}
        </label>
        <input
          id="adapter-page"
          value={pageUrl}
          onChange={(event) => onPageUrlChange(event.target.value)}
          placeholder="https://"
          className="mt-1.5 h-8 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("adapter.pageUrlHint")}</p>
      </div>

      {adapters.error ? (
        <p className="rounded-lg border border-destructive/40 bg-card px-3 py-2 text-[11px] leading-relaxed text-destructive">
          {adapters.error}
        </p>
      ) : null}

      {adapters.lastRun ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {adapters.lastRun.ok
            ? t("adapter.lastRunOk", { name: adapters.lastRun.name, detail: adapters.lastRun.message })
            : t("adapter.lastRunFailed", { name: adapters.lastRun.name, detail: adapters.lastRun.message })}
        </p>
      ) : null}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraft(ADAPTER_TEMPLATE);
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--add-circle-linear] size-3" aria-hidden="true" />
          {t("action.newAdapter")}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraft("");
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--download-minimalistic-linear] size-3" aria-hidden="true" />
          {t("action.importAdapter")}
        </button>
      </div>

      {draft !== null ? (
        <AdapterEditor
          initial={draft}
          onSubmit={(text) => adapters.importText(text)}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      {adapters.loading ? (
        <p className="text-[11px] text-muted-foreground">{t("adapter.loading")}</p>
      ) : adapters.adapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("adapter.empty")}</p>
        </div>
      ) : (
        adapters.adapters.map((adapter) =>
          editingId === adapter.id && draft !== null ? (
            <AdapterEditor
              key={adapter.id}
              initial={draft}
              onSubmit={(text) => adapters.importText(text)}
              onCancel={() => {
                setEditingId(null);
                setDraft(null);
              }}
            />
          ) : (
            <AdapterCard
              key={adapter.id}
              adapter={adapter}
              running={adapters.runningId === adapter.id}
              blocked={busy}
              matches={adapterMatchesUrl(adapter, pageUrl.trim())}
              onRun={() => void run(adapter)}
              onToggle={(enabled) => void adapters.toggle(adapter.id, enabled)}
              onEdit={() => {
                setEditingId(adapter.id);
                setDraft(
                  JSON.stringify({ schemaVersion: 1, meta: adapter.meta, enabled: adapter.enabled, body: adapter.body }, null, 2),
                );
              }}
              onRemove={() => void adapters.remove(adapter.id)}
            />
          ),
        )
      )}
    </div>
  );
}
