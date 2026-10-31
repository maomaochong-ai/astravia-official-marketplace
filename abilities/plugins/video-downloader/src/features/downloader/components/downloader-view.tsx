import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { toolCapability } from "../../../domain/capabilities";
import { failureMessageKey } from "../../../domain/failure-codes";
import { createDownloaderApi, type DownloaderApi } from "../../../services/downloader-api";
import { DownloadSettingsPanel } from "../../settings/components/download-settings-panel";
import { DownloadQueue } from "./download-queue";
import { DownloaderEmptyState } from "./downloader-empty-state";
import { MediaPreviewCard } from "./media-preview-card";
import { SiteCoveragePanel } from "./site-coverage-panel";
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
  const [coverageOpen, setCoverageOpen] = useState(false);
  const controller = useDownloader(ctx, apiFor(ctx));
  const { state } = controller;

  const ffmpegAvailable = toolCapability(state.capabilities, "ffmpeg").available;
  const needsCookie = state.probeErrorCode === "auth_required";
  const enginePreparing = state.capabilities?.ytdlp.available === false;
  const engineFailed = state.ytdlpInstall?.phase === "failed";
  const enginePercent =
    state.ytdlpInstall && state.ytdlpInstall.totalBytes > 0
      ? Math.min(100, Math.max(0, Math.round((state.ytdlpInstall.receivedBytes / state.ytdlpInstall.totalBytes) * 100)))
      : 0;
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
                state.bootError || engineFailed ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  state.bootError || engineFailed
                    ? "bg-destructive"
                    : enginePreparing
                      ? "bg-muted-foreground"
                      : "bg-primary"
                }`}
                aria-hidden="true"
              />
              {state.bootError
                ? t("status.offline")
                : engineFailed
                  ? t("status.engineFailed")
                  : enginePreparing
                    ? t("status.enginePreparing", { percent: enginePercent })
                    : ffmpegAvailable
                      ? t("status.ready")
                      : t("status.noFfmpeg")}
            </span>
            <button
              type="button"
              aria-label={t("action.coverage")}
              title={t("action.coverage")}
              aria-pressed={coverageOpen}
              onClick={() => {
                setCoverageOpen((open) => !open);
                setSettingsOpen(false);
              }}
              disabled={!state.sites}
              className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                coverageOpen ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="icon-[solar--global-linear] size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("action.settings")}
              title={t("action.settings")}
              onClick={() => {
                setSettingsOpen((open) => !open);
                setCoverageOpen(false);
              }}
              disabled={!state.settings}
              className={`grid size-7 place-items-center rounded-md transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
                settingsOpen ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="icon-[solar--settings-linear] size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {state.booting ? (
          <p className="mt-8 text-xs text-muted-foreground">{t("status.booting")}</p>
        ) : (
          <>
            {state.bootError ? (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-card p-4">
                <p className="text-xs leading-relaxed text-destructive">{state.bootError}</p>
                <button
                  type="button"
                  onClick={() => void controller.reload()}
                  className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
                  {t("status.retry")}
                </button>
              </div>
            ) : null}

            {/* Keep the surface shaped like the downloader even when it cannot run, instead of
                collapsing the panel to a single error line. */}
            <div className="mt-5">
              <UrlEntryCard
                url={state.url}
                probing={state.probing}
                disabled={Boolean(state.bootError)}
                error={probeError ? t(probeError) : state.probeError}
                onUrlChange={controller.setUrl}
                onPaste={() => void controller.useClipboard()}
                onAnalyze={() => void controller.analyze()}
                remedy={
                  needsCookie ? { label: t("action.fillCookie"), run: () => setSettingsOpen(true) } : undefined
                }
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
              />
            ) : null}

            {!result && state.tasks.length === 0 && !state.bootError ? <DownloaderEmptyState /> : null}

            {coverageOpen && state.sites ? (
              <SiteCoveragePanel coverage={state.sites} onOpenCookie={() => setSettingsOpen(true)} />
            ) : null}

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
                ytdlpInstall={state.ytdlpInstall}
                ytdlpBusy={state.ytdlpBusy}
                onSave={(patch) => void controller.saveSettings(patch)}
                onRefreshCapabilities={() => void controller.refreshCapabilities()}
                onRetryPreparation={() => void controller.retryPreparation()}
                focusCookie={needsCookie}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
