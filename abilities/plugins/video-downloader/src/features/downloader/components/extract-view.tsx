import { useTranslation } from "@astravia-org/plugin-sdk";
import { failureMessageKey } from "../../../domain/failure-codes";
import { toolCapability } from "../../../domain/capabilities";
import type { ExtractController } from "../hooks/use-extract";
import type { ServiceGate } from "../hooks/use-service-gate";
import type { TaskQueue } from "../hooks/use-tasks";
import type { AdapterController } from "../hooks/use-adapters";
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
}: {
  gate: ServiceGate;
  extract: ExtractController;
  tasks: TaskQueue;
  adapters: AdapterController;
  onOpenAdapters(): void;
  onOpenSettings(section: "cookie" | "coverage"): void;
}) {
  const { t } = useTranslation();
  const needsCookie = extract.probeErrorCode === "auth_required";
  const upstreamBroken = extract.probeErrorCode === "site_upstream_broken";
  const unsupported = extract.probeErrorCode === "site_unsupported";
  const candidates = unsupported ? adapters.candidates(extract.url) : [];
  const probeError = failureMessageKey(extract.probeErrorCode);

  const remedy = needsCookie
    ? { label: t("action.fillCookie"), run: () => onOpenSettings("cookie") }
    : upstreamBroken
      ? { label: t("action.coverage"), run: () => onOpenSettings("coverage") }
      : candidates.length > 0
        ? {
            label: t("action.runAdapter"),
            run: () => {
              const adapter = candidates[0];
              if (!adapter) return;
              void adapters.run(adapter, extract.url).then((item) => {
                if (item) extract.adoptItem(item);
              });
            },
          }
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

      {extract.result ? (
        <MediaPreviewCard
          items={extract.result.items}
          activeIndex={extract.activeItemIndex}
          selectedFormatId={extract.selectedFormatId}
          ffmpegAvailable={toolCapability(gate.capabilities, "ffmpeg").available}
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
