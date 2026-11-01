import { useState } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { DownloadSettingsPanel } from "../../settings/components/download-settings-panel";
import type { ServiceGate } from "../hooks/use-service-gate";
import type { SettingsController } from "../hooks/use-settings";
import { SiteCoveragePanel } from "./site-coverage-panel";

export type SettingsSection = "preferences" | "cookie" | "coverage";

/**
 * Preferences plus the coverage report. Coverage moved here because it answers "which sites work",
 * a thing a user checks once, not a thing that belongs next to the URL field.
 */
export function SettingsView({
  gate,
  settings,
  section = "preferences",
}: {
  gate: ServiceGate;
  settings: SettingsController;
  section?: SettingsSection;
}) {
  const { t } = useTranslation();
  const [coverageOpen, setCoverageOpen] = useState(section === "coverage");

  if (!settings.settings) {
    return <p className="mt-5 text-[11px] text-muted-foreground">{t("status.booting")}</p>;
  }

  const total = settings.sites ? settings.sites.groups.reduce((sum, group) => sum + group.sites.length, 0) : 0;
  const unsupported = settings.sites?.unsupported.length ?? 0;

  return (
    <div className="mt-5">
      <DownloadSettingsPanel
        settings={settings.settings}
        capabilities={gate.capabilities}
        ffmpegInstall={gate.ffmpegInstall}
        ffmpegBusy={gate.ffmpegBusy}
        ytdlpInstall={gate.ytdlpInstall}
        ytdlpBusy={gate.ytdlpBusy}
        onSave={(patch) => void settings.save(patch)}
        onRefreshCapabilities={() => void gate.refreshCapabilities()}
        onRetryPreparation={() => void gate.retryPreparation()}
        focusCookie={section === "cookie"}
      />

      {settings.sites ? (
        <>
          <button
            type="button"
            aria-expanded={coverageOpen}
            onClick={() => setCoverageOpen((open) => !open)}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{t("sites.title")}</span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                {t("sites.summary", { supported: total - unsupported, total })}
              </span>
            </span>
            <span
              className={`icon-[solar--alt-arrow-down-linear] size-4 shrink-0 text-muted-foreground transition-transform ${
                coverageOpen ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            />
          </button>
          {coverageOpen ? (
            <SiteCoveragePanel coverage={settings.sites} onOpenCookie={() => setCoverageOpen(false)} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
