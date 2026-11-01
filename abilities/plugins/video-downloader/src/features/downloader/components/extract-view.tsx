import { useTranslation } from "@astravia-org/plugin-sdk";
import { failureMessageKey } from "../../../domain/failure-codes";
import { toolCapability } from "../../../domain/capabilities";
import type { ExtractController } from "../hooks/use-extract";
import type { ServiceGate } from "../hooks/use-service-gate";
import type { TaskQueue } from "../hooks/use-tasks";
import type { AdapterController } from "../hooks/use-adapters";
import { usePreview } from "../hooks/use-preview";
import type { ReplicateController } from "../hooks/use-replicate";
import type { DownloaderApi } from "../../../services/downloader-api";
import { DownloadQueue } from "./download-queue";
import { DownloaderEmptyState } from "./downloader-empty-state";
import { MediaPreviewCard } from "./media-preview-card";
import { UrlEntryCard } from "./url-entry-card";
/**
 * One URL in, one Media Item out, one download started. Every failure that has a next step shows
 * that step here instead of asking the user to guess which tab holds the fix.
 */
export function ExtractView({
  gate,
  extract,
  tasks,
  adapters,
  onOpenAdapters,
  onOpenSettings,
  api,
  replicate,
}: {
  gate: ServiceGate;
  extract: ExtractController;
  tasks: TaskQueue;
  adapters: AdapterController;
  api: DownloaderApi;
  replicate: ReplicateController;
  onOpenAdapters(): void;
  onOpenSettings(section: "cookie" | "coverage"): void;
}) {
  const { t } = useTranslation();
  const activeItem = extract.result?.items[extract.activeItemIndex] ?? null;
  const activeFormat = activeItem?.formats.find((format) => format.id === extract.selectedFormatId) ?? null;
  const preview = usePreview(api, activeItem, activeFormat);
  const needsCookie = extract.probeErrorCode === "auth_required";
  const upstreamBroken = extract.probeErrorCode === "site_upstream_broken";
  const unsupported = extract.probeErrorCode === "site_unsupported";
  // Computed for every address, not just the unsupported branch: a site the engine marks broken is
  // exactly where an Adapter is the working path, and hiding the button there reads as "disabled".
  const candidates = extract.url.trim() ? adapters.candidates(extract.url) : [];
  const probeError = failureMessageKey(extract.probeErrorCode);

  // A missing cookie is the one fix the Adapter path cannot provide, so it stays first.
  const remedy = needsCookie
    ? { label: t("action.fillCookie"), run: () => onOpenSettings("cookie") }
    : candidates.length > 0
      ? {
          label: t("action.runAdapter"),
          run: () => {
            const adapter = candidates[0];
            if (!adapter) return;
            void adapters.run(adapter, extract.url).then((outcome) => {
              if (outcome.ok) extract.adoptItem(outcome.item);
            });
          },
        }
      : upstreamBroken
        ? { label: t("action.coverage"), run: () => onOpenSettings("coverage") }
        : unsupported
          ? { label: t("action.openAdapters"), run: onOpenAdapters }
          : undefined;

  return (
    <>
      <div className="mt-5">
        <UrlEntryCard
          url={extract.url}
          probing={extract.probing}
          disabled={Boolean(gate.bootError) || adapters.runningId !== null}
          error={probeError ? t(probeError) : extract.probeError}
          onUrlChange={extract.setUrl}
          onPaste={() => void extract.useClipboard()}
          onAnalyze={() => void extract.analyze()}
          remedy={remedy}
        />
      </div>

      {candidates.length > 0 && !extract.probing ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{t("extract.adapterHint")}</span>
          {candidates.map((adapter) => (
            <button
              key={adapter.id}
              type="button"
              disabled={Boolean(gate.bootError) || adapters.runningId !== null}
              onClick={() => {
                void adapters.run(adapter, extract.url).then((outcome) => {
                  if (outcome.ok) extract.adoptItem(outcome.item);
                });
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={`icon-[solar--magic-stick-3-linear] size-3 ${adapters.runningId === adapter.id ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
              {adapter.meta.name}
            </button>
          ))}
        </div>
      ) : null}

      {extract.adapterFailure ? (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] leading-relaxed text-foreground">{extract.adapterFailure.message}</p>
          {extract.adapterFailure.loginRequired ? (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t("extract.adapterLoginHint")}</p>
          ) : null}
          {extract.adapterFailure.screenshot ? (
            <img
              src={extract.adapterFailure.screenshot}
              alt={t("extract.adapterScreenshot")}
              className="mt-2 w-full rounded-lg border border-border"
            />
          ) : null}
          <button
            type="button"
            onClick={() => void extract.analyze()}
            className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
            {t("status.retry")}
          </button>
        </div>
      ) : null}

      {extract.result ? (
        <MediaPreviewCard
          items={extract.result.items}
          activeIndex={extract.activeItemIndex}
          selectedFormatId={extract.selectedFormatId}
          ffmpegAvailable={toolCapability(gate.capabilities, "ffmpeg").available}
          preview={preview}
          canReplicate={replicate.available}
          replicating={replicate.sending}
          onReplicate={() => {
            if (activeItem) void replicate.send(activeItem, activeFormat);
          }}
          ffmpegInstall={gate.ffmpegInstall}
          ffmpegBusy={gate.ffmpegBusy}
          starting={extract.starting}
          onSelectItem={extract.selectItem}
          onSelectFormat={extract.selectFormat}
          onStart={() => void extract.startDownload()}
        />
      ) : null}

      {!extract.result && tasks.tasks.length === 0 && !gate.bootError ? <DownloaderEmptyState /> : null}

      <DownloadQueue
        tasks={tasks.tasks}
        onCancel={(id) => void tasks.cancel(id)}
        onRetry={(id) => void tasks.retry(id)}
        onRemove={(id) => void tasks.remove(id)}
        onReveal={(id) => void tasks.reveal(id)}
      />
    </>
  );
}
