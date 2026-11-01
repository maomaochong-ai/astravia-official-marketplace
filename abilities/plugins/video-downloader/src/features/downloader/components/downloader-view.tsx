import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ManagedPluginContext } from "../../../runtime-contract";
import { toolCapability } from "../../../domain/capabilities";
import { isActive } from "../../../domain/task-state";
import { createDownloaderApi, type DownloaderApi } from "../../../services/downloader-api";
import { useAdapters } from "../hooks/use-adapters";
import { useExtract } from "../hooks/use-extract";
import { useServiceGate } from "../hooks/use-service-gate";
import { useSettings } from "../hooks/use-settings";
import { useTasks } from "../hooks/use-tasks";
import { useReplicate } from "../hooks/use-replicate";
import { AdaptersView } from "./adapters-view";
import { ExtractView } from "./extract-view";
import { SettingsView, type SettingsSection } from "./settings-view";

const apiByContext = new WeakMap<ManagedPluginContext, DownloaderApi>();

function apiFor(ctx: ManagedPluginContext): DownloaderApi {
  const existing = apiByContext.get(ctx);
  if (existing) return existing;
  const created = createDownloaderApi(ctx);
  apiByContext.set(ctx, created);
  return created;
}

type ViewKey = "extract" | "adapters" | "settings";

export function DownloaderView({
  ctx,
  variant = "page",
}: {
  ctx: ManagedPluginContext;
  /** `panel` drops the page title: the activity tab already labels the surface. */
  variant?: "page" | "panel";
}) {
  const { t } = useTranslation();
  const api = apiFor(ctx);
  const gate = useServiceGate(ctx, api);
  const tasks = useTasks(ctx, api, !gate.booting && !gate.bootError);
  const settings = useSettings(ctx, api);
  const adapters = useAdapters(ctx);
  const [view, setView] = useState<ViewKey>("extract");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("preferences");

  const replicate = useReplicate(ctx);
  const extract = useExtract(ctx, api, {
    ensureTool: gate.ensureTool,
    blocked: adapters.runningId !== null,
    onTaskCreated: tasks.reload,
    resolveWithAdapter: async (target) => {
      const adapter = adapters.candidates(target).find((entry) => entry.enabled);
      if (!adapter || !adapters.available) return null;
      return adapters.run(adapter, target);
    },
  });

  const ffmpegAvailable = toolCapability(gate.capabilities, "ffmpeg").available;
  const enginePreparing = gate.capabilities?.ytdlp.available === false;
  const engineFailed = gate.ytdlpInstall?.phase === "failed";
  const enginePercent =
    gate.ytdlpInstall && gate.ytdlpInstall.totalBytes > 0
      ? Math.min(100, Math.max(0, Math.round((gate.ytdlpInstall.receivedBytes / gate.ytdlpInstall.totalBytes) * 100)))
      : 0;
  const activeTasks = tasks.tasks.filter(isActive).length;

  const tabs: { key: ViewKey; label: string; badge?: number }[] = [
    { key: "extract", label: t("view.extract"), badge: activeTasks },
    ...(adapters.available ? [{ key: "adapters" as const, label: t("view.adapters") }] : []),
    { key: "settings", label: t("view.settings") },
  ];

  function openSettings(section: SettingsSection): void {
    setSettingsSection(section);
    setView("settings");
  }

  function openAdapters(): void {
    if (adapters.available) setView("adapters");
    else openSettings("coverage");
  }

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
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${
              gate.bootError || engineFailed ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                gate.bootError || engineFailed
                  ? "bg-destructive"
                  : enginePreparing
                    ? "bg-muted-foreground"
                    : "bg-primary"
              }`}
              aria-hidden="true"
            />
            {gate.bootError
              ? t("status.offline")
              : engineFailed
                ? t("status.engineFailed")
                : enginePreparing
                  ? t("status.enginePreparing", { percent: enginePercent })
                  : ffmpegAvailable
                    ? t("status.ready")
                    : t("status.noFfmpeg")}
          </span>
        </header>

        <nav className="-mx-1 mt-3 flex items-center gap-1 border-b border-border" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              onClick={() => setView(tab.key)}
              className={`-mb-px inline-flex h-8 items-center gap-1.5 border-b-2 px-2 text-xs transition-colors ${
                view === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {gate.booting ? (
          <p className="mt-6 text-[11px] text-muted-foreground">{t("status.booting")}</p>
        ) : (
          <>
            {gate.bootError ? (
              <div className="mt-5 rounded-xl border border-destructive/40 bg-card p-4">
                <p className="text-xs leading-relaxed text-destructive">{gate.bootError}</p>
                <button
                  type="button"
                  onClick={() => void gate.reload()}
                  className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="icon-[solar--refresh-linear] size-3" aria-hidden="true" />
                  {t("status.retry")}
                </button>
              </div>
            ) : null}

            {view === "extract" ? (
              <ExtractView
                gate={gate}
                extract={extract}
                tasks={tasks}
                adapters={adapters}
                api={api}
                replicate={replicate}
                onOpenAdapters={openAdapters}
                onOpenSettings={(section) => openSettings(section)}
              />
            ) : null}

            {view === "adapters" && adapters.available ? (
              <AdaptersView
                adapters={adapters}
                pageUrl={extract.url}
                onPageUrlChange={extract.setUrl}
                onUseItem={(item) => {
                  extract.adoptItem(item);
                  setView("extract");
                }}
                busy={extract.probing}
              />
            ) : null}

            {view === "settings" ? <SettingsView gate={gate} settings={settings} section={settingsSection} /> : null}
          </>
        )}
      </div>
    </div>
  );
}
