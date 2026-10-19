import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { formatBytes } from "../../../domain/format-bytes";
import type { Capabilities, FfmpegInstall, ServiceSettings } from "../../../domain/media-info";

interface DownloadSettingsPanelProps {
  settings: ServiceSettings;
  capabilities: Capabilities | null;
  ffmpegInstall: FfmpegInstall | null;
  ffmpegBusy: boolean;
  onSave(patch: Partial<ServiceSettings>): void;
  onRefreshCapabilities(): void;
  onInstallFfmpeg(): void;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`absolute size-3.5 rounded-full bg-background transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function DownloadSettingsPanel({
  settings,
  capabilities,
  ffmpegInstall,
  ffmpegBusy,
  onSave,
  onRefreshCapabilities,
  onInstallFfmpeg,
}: DownloadSettingsPanelProps) {
  const { t } = useTranslation();
  const [directory, setDirectory] = useState(settings.downloadDirectory);
  const [cookie, setCookie] = useState(settings.cookie);

  useEffect(() => {
    setDirectory(settings.downloadDirectory);
    setCookie(settings.cookie);
  }, [settings.downloadDirectory, settings.cookie]);

  const ffmpeg = capabilities?.ffmpeg ?? null;
  const installing =
    ffmpegBusy || ffmpegInstall?.phase === "downloading" || ffmpegInstall?.phase === "verifying";
  const percent =
    ffmpegInstall && ffmpegInstall.totalBytes > 0
      ? Math.min(100, Math.max(0, Math.round((ffmpegInstall.receivedBytes / ffmpegInstall.totalBytes) * 100)))
      : 0;

  return (
    <section className="mt-4 rounded-xl border border-border bg-card px-4 py-2">
      <Field label={t("settings.directory")} hint={t("settings.directoryHint")}>
        <input
          value={directory}
          spellCheck={false}
          onChange={(event) => setDirectory(event.target.value)}
          onBlur={() => {
            if (directory.trim() && directory !== settings.downloadDirectory) onSave({ downloadDirectory: directory.trim() });
          }}
          className="h-7 w-64 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus:border-primary/60"
        />
      </Field>

      <div className="border-t border-border" />

      <Field label={t("settings.concurrent")} hint={t("settings.concurrentHint")}>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onSave({ maxConcurrent: value })}
              className={`size-7 rounded-md border text-[11px] tabular-nums transition-colors ${
                settings.maxConcurrent === value
                  ? "border-primary/70 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </Field>

      <div className="border-t border-border" />

      <Field label={t("settings.multiThread")} hint={t("settings.multiThreadHint")}>
        <Switch
          checked={settings.multiThread}
          label={t("settings.multiThread")}
          onChange={(value) => onSave({ multiThread: value })}
        />
      </Field>

      <div className="border-t border-border" />

      <Field label={t("settings.keepPartial")} hint={t("settings.keepPartialHint")}>
        <Switch
          checked={settings.keepPartialFiles}
          label={t("settings.keepPartial")}
          onChange={(value) => onSave({ keepPartialFiles: value })}
        />
      </Field>

      <div className="border-t border-border" />

      <Field label={t("settings.cookie")} hint={t("settings.cookieHint")}>
        <textarea
          value={cookie}
          spellCheck={false}
          placeholder={t("settings.cookiePlaceholder")}
          onChange={(event) => setCookie(event.target.value)}
          onBlur={() => {
            if (cookie !== settings.cookie) onSave({ cookie });
          }}
          rows={2}
          className="w-64 resize-none rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
      </Field>

      <div className="border-t border-border" />

      <div className="flex items-center justify-between gap-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{t("settings.engine")}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {capabilities?.lux.available
              ? `lux ${capabilities.lux.version ?? ""}`
              : t("settings.luxMissing")}
            {" · "}
            {ffmpeg?.available ? `ffmpeg ${ffmpeg.version ?? ""}` : t("settings.ffmpegMissing")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ffmpeg?.available ? null : installing ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] tabular-nums text-muted-foreground">
              <span className="icon-[solar--refresh-linear] size-3 animate-spin" aria-hidden="true" />
              {t("settings.ffmpegInstalling", { percent })}
            </span>
          ) : ffmpegInstall?.supported === false ? (
            <span className="text-[11px] text-muted-foreground">{t("settings.ffmpegUnsupported")}</span>
          ) : (
            <button
              type="button"
              onClick={onInstallFfmpeg}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-primary/60 px-2 text-[11px] text-primary transition-colors hover:bg-primary/10"
            >
              <span className="icon-[solar--cpu-bolt-linear] size-3" aria-hidden="true" />
              {ffmpegInstall?.totalBytes
                ? `${t("settings.ffmpegInstall")} (${formatBytes(ffmpegInstall.totalBytes)})`
                : t("settings.ffmpegInstall")}
            </button>
          )}
          <button
            type="button"
            onClick={onRefreshCapabilities}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
            {t("settings.refresh")}
          </button>
        </div>
      </div>
    </section>
  );
}
