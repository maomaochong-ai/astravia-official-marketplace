import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { toolCapability } from "../../../domain/capabilities";
import type { Capabilities, ServiceSettings, ToolInstall } from "../../../domain/media-info";

interface DownloadSettingsPanelProps {
  settings: ServiceSettings;
  capabilities: Capabilities | null;
  ffmpegInstall: ToolInstall | null;
  ffmpegBusy: boolean;
  ytdlpInstall: ToolInstall | null;
  ytdlpBusy: boolean;
  onSave(patch: Partial<ServiceSettings>): void;
  onRefreshCapabilities(): void;
  /** Retry a preparation that failed; installing is never a manual step. */
  onRetryPreparation(): void;
  /** Jump straight to the cookie field when the failure was a missing session. */
  focusCookie?: boolean;
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

/** One line of the toolchain list: what is ready, and how far its download has come. */
function ToolRow({ caption, detail, available }: { caption: string; detail?: string; available: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          aria-hidden="true"
          className={`size-1.5 shrink-0 rounded-full ${available ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
        <span className="truncate">{caption}</span>
      </span>
      {detail ? <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">{detail}</span> : null}
    </li>
  );
}

function percentOf(install: ToolInstall | null): number {
  if (!install || install.totalBytes <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((install.receivedBytes / install.totalBytes) * 100)));
}

function inFlight(install: ToolInstall | null, busy: boolean): boolean {
  if (busy) return true;
  return install?.phase === "downloading" || install?.phase === "verifying";
}

export function DownloadSettingsPanel({
  settings,
  capabilities,
  ffmpegInstall,
  ffmpegBusy,
  ytdlpInstall,
  ytdlpBusy,
  onSave,
  onRefreshCapabilities,
  onRetryPreparation,
  focusCookie = false,
}: DownloadSettingsPanelProps) {
  const { t } = useTranslation();
  const [directory, setDirectory] = useState(settings.downloadDirectory);
  const [cookie, setCookie] = useState(settings.cookie);
  const [proxy, setProxy] = useState(settings.proxy);
  const cookieField = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDirectory(settings.downloadDirectory);
    setCookie(settings.cookie);
    setProxy(settings.proxy);
  }, [settings.downloadDirectory, settings.cookie, settings.proxy]);

  useEffect(() => {
    if (!focusCookie) return;
    cookieField.current?.focus();
    cookieField.current?.scrollIntoView({ block: "center" });
  }, [focusCookie]);

  const ytdlp = toolCapability(capabilities, "ytdlp");
  const ffmpeg = toolCapability(capabilities, "ffmpeg");
  const ytdlpWorking = inFlight(ytdlpInstall, ytdlpBusy);
  const ffmpegWorking = inFlight(ffmpegInstall, ffmpegBusy);
  const engineFailed = !ytdlpWorking && (ytdlpInstall?.phase === "failed" || ytdlpInstall?.supported === false);

  function toolDetail(available: boolean, install: ToolInstall | null, working: boolean): string | undefined {
    if (available) return undefined;
    if (working) return t("settings.preparingPercent", { percent: percentOf(install) });
    if (install?.phase === "failed") return t("settings.prepareFailed");
    if (install?.supported === false) return t("settings.unsupported");
    return t("settings.preparing");
  }

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
          ref={cookieField}
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

      <Field label={t("settings.proxy")} hint={t("settings.proxyHint")}>
        <input
          value={proxy}
          spellCheck={false}
          placeholder={t("settings.proxyPlaceholder")}
          onChange={(event) => setProxy(event.target.value)}
          onBlur={() => {
            if (proxy !== settings.proxy) onSave({ proxy });
          }}
          className="h-7 w-64 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
      </Field>

      <div className="border-t border-border" />

      <div className="flex items-start justify-between gap-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{t("settings.toolchain")}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{t("settings.toolchainHint")}</p>
          <ul className="mt-1 space-y-1">
            <ToolRow
              available={ytdlp.available}
              caption={ytdlp.available ? `yt-dlp ${ytdlp.version ?? ""}`.trim() : "yt-dlp"}
              detail={toolDetail(ytdlp.available, ytdlpInstall, ytdlpWorking)}
            />
            <ToolRow
              available={ffmpeg.available}
              caption={ffmpeg.available ? `ffmpeg ${ffmpeg.version ?? ""}`.trim() : "ffmpeg"}
              detail={toolDetail(ffmpeg.available, ffmpegInstall, ffmpegWorking)}
            />
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {engineFailed ? (
            <button
              type="button"
              onClick={onRetryPreparation}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
              {t("settings.retryPrepare")}
            </button>
          ) : null}
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
