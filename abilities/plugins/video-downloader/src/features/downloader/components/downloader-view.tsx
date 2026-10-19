import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { failureMessageKey } from "../../../domain/failure-codes";
import { createDownloaderApi, type DownloaderApi } from "../../../services/downloader-api";
import { DownloadSettingsPanel } from "../../settings/components/download-settings-panel";
import { DownloadQueue } from "./download-queue";
import { DownloaderEmptyState } from "./downloader-empty-state";
import { MediaPreviewCard } from "./media-preview-card";
import { UrlEntryCard } from "./url-entry-card";
import { useDownloader } from "../hooks/use-downloader";

const apiByContext = new WeakMap<ManagedPluginContext, DownloaderApi>();

function apiFor(ctx: ManagedPluginContext): DownloaderApi {
  const existing = apiByContext.get(ctx);
  if (existing) return existing;
  const created = createDownloaderApi(ctx);
  apiByContext.set(ctx, created);
  return created;
}

export function DownloaderView({
  ctx,
  variant = "page",
}: {
  ctx: ManagedPluginContext;
  /** `panel` drops the page title: the activity tab already labels the surface. */
  variant?: "page" | "panel";
}) {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const controller = useDownloader(ctx, apiFor(ctx));
  const { state } = controller;

  const ffmpegAvailable = state.capabilities?.ffmpeg.available === true;
  const result = state.result;
  const probeError = failureMessageKey(state.probeErrorCode);

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className={variant === "panel" ? "mx-auto w-full max-w-2xl px-4 py-4" : "mx-auto w-full max-w-2xl px-6 py-7"}>
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {variant === "panel" ? null : (
              <>
                <h1 className="text-base font-medium text-foreground">{t("downloader.title")}</h1>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("downloader.subtitle")}</p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
                state.bootError
                  ? "border-destructive/40 text-destructive"
                  : ffmpegAvailable
                    ? "border-border text-muted-foreground"
                    : "border-border text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${state.bootError ? "bg-destructive" : ffmpegAvailable ? "bg-primary" : "bg-muted-foreground"}`}
                aria-hidden="true"
              />
              {state.bootError ? t("status.offline") : ffmpegAvailable ? t("status.ready") : t("status.noFfmpeg")}
            </span>
            <button
              type="button"
              aria-label={t("action.settings")}
              title={t("action.settings")}
              onClick={() => setSettingsOpen((open) => !open)}
              className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-accent ${
                settingsOpen ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="icon-[solar--settings-linear] size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {state.booting ? (
          <p className="mt-8 text-xs text-muted-foreground">{t("status.booting")}</p>
        ) : state.bootError ? (
          <div className="mt-8 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-destructive">{state.bootError}</p>
            <button
              type="button"
              onClick={() => void controller.reload()}
              className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
              {t("status.retry")}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <UrlEntryCard
                url={state.url}
                probing={state.probing}
                error={probeError ? t(probeError) : state.probeError}
                onUrlChange={controller.setUrl}
                onAnalyze={() => void controller.analyze()}
                onPaste={() => void controller.useClipboard()}
              />
            </div>

            {result ? (
              <MediaPreviewCard
                items={result.items}
                activeIndex={state.activeItemIndex}
                selectedFormatId={state.selectedFormatId}
                ffmpegAvailable={ffmpegAvailable}
                ffmpegInstall={state.ffmpegInstall}
                ffmpegBusy={state.ffmpegBusy}
                starting={state.starting}
                onSelectItem={controller.selectItem}
                onSelectFormat={controller.selectFormat}
                onStart={() => void controller.startDownload()}
                onInstallFfmpeg={() => void controller.installFfmpeg()}
              />
            ) : null}

            {!result && state.tasks.length === 0 ? <DownloaderEmptyState /> : null}

            <DownloadQueue
              tasks={state.tasks}
              onCancel={(id) => void controller.cancelTask(id)}
              onRetry={(id) => void controller.retryTask(id)}
              onRemove={(id) => void controller.removeTask(id)}
              onReveal={(id) => void controller.revealTask(id)}
            />

            {settingsOpen && state.settings ? (
              <DownloadSettingsPanel
                settings={state.settings}
                capabilities={state.capabilities}
                ffmpegInstall={state.ffmpegInstall}
                ffmpegBusy={state.ffmpegBusy}
                onSave={(patch) => void controller.saveSettings(patch)}
                onRefreshCapabilities={() => void controller.refreshCapabilities()}
                onInstallFfmpeg={() => void controller.installFfmpeg()}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
