import { useEffect, useRef, useState } from "react";
import type { ServiceSettings, SiteCoverage } from "../../../domain/media-info";
import type { DownloaderApi } from "../../../services/downloader-api";
import type { ManagedPluginContext } from "../../../runtime-contract";

/**
 * Settings view state: the persisted preferences plus the coverage report shown under them.
 * Coverage is decoration next to the download path, so a failure degrades to a hidden panel.
 */
export interface SettingsController {
  settings: ServiceSettings | null;
  sites: SiteCoverage | null;
  load(): Promise<void>;
  save(patch: Partial<ServiceSettings>): Promise<void>;
}

export function useSettings(ctx: ManagedPluginContext, api: DownloaderApi): SettingsController {
  const [settings, setSettings] = useState<ServiceSettings | null>(null);
  const [sites, setSites] = useState<SiteCoverage | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function load(): Promise<void> {
    const [next, coverage] = await Promise.all([api.settings(), api.sites().catch(() => null)]);
    if (!mounted.current) return;
    setSettings(next);
    setSites(coverage);
  }

  useEffect(() => {
    void load().catch(() => undefined);
    // A settings read is cheap and closes over props only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    settings,
    sites,
    load,
    save: async (patch) => {
      try {
        const next = await api.saveSettings(patch);
        if (mounted.current) setSettings(next);
      } catch (error) {
        ctx.ui.notify({ message: ctx.i18n.t("error.settingsFailed"), error, variant: "error" });
      }
    },
  };
}
