import { useEffect, useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { Capabilities } from "../../../domain/media-info";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { createDownloaderApi } from "../../../services/downloader-api";

function StatusRow({ label, available, version }: { label: string; available: boolean; version: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={`size-1.5 rounded-full ${available ? "bg-primary" : "bg-destructive"}`} aria-hidden="true" />
        {available ? (version ?? "—") : "—"}
      </span>
    </div>
  );
}

/** Rendered inside the ability detail page: engine availability without leaving the catalog. */
export function ServiceStatusSlot({ ctx }: { ctx: ManagedPluginContext }) {
  const { t } = useTranslation();
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(refresh: boolean): Promise<void> {
    try {
      setCapabilities(await createDownloaderApi(ctx).capabilities(refresh));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2">
      <StatusRow label={t("status.lux")} available={capabilities?.lux.available === true} version={capabilities?.lux.version ?? null} />
      <div className="border-t border-border" />
      <StatusRow
        label="ffmpeg"
        available={capabilities?.ffmpeg.available === true}
        version={capabilities?.ffmpeg.version ?? null}
      />
      <div className="border-t border-border" />
      <p className="py-2 text-[11px] leading-relaxed text-muted-foreground">
        {error ?? (capabilities?.ffmpeg.available ? t("status.ffmpegReadyHint") : t("status.ffmpegMissingHint"))}
      </p>
      <div className="flex justify-end pb-2">
        <button
          type="button"
          onClick={() => void load(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
          {t("settings.refresh")}
        </button>
      </div>
    </div>
  );
}
