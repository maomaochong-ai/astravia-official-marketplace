// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../locales/en.json";

// The panel only needs catalog lookup; the host bridge is not mounted outside Astravia.
vi.mock("@astravia-org/plugin-sdk", () => ({
  useTranslation: () => ({
    locale: "en",
    t: (key: string, params?: Record<string, unknown>) => {
      const template = (en as Record<string, string>)[key] ?? key;
      return params
        ? template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
            name in params ? String(params[name]) : match,
          )
        : template;
    },
  }),
}));

const { DownloadSettingsPanel } = await import("../features/settings/components/download-settings-panel");

const settings = {
  downloadDirectory: "/Users/me/Downloads",
  maxConcurrent: 2,
  cookie: "",
  proxy: "",
  multiThread: true,
  keepPartialFiles: false,
};

const capabilities = {
  ytdlp: { available: true, path: "/data/bin/yt-dlp", version: "2026.08.19", source: "bundled" as const },
  ffmpeg: { available: false, path: null, version: null, source: null },
};

const noops = {
  onSave: () => undefined,
  onRefreshCapabilities: () => undefined,
  onRetryPreparation: () => undefined,
};

describe("DownloadSettingsPanel", () => {
  it("shows ffmpeg being prepared without offering an install button", () => {
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={capabilities}
        ffmpegInstall={{ phase: "downloading", receivedBytes: 5_000_000, totalBytes: 19_246_198, supported: true, error: null }}
        ffmpegBusy={false}
        ytdlpInstall={null}
        ytdlpBusy={false}
        {...noops}
      />,
    );
    expect(markup).toContain("Preparing 26%");
    expect(markup).not.toContain("Install ffmpeg");
    expect(markup).not.toContain("Install yt-dlp");
  });

  it("keeps the picker out of the panel now that one engine serves every site", () => {
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={capabilities}
        ffmpegInstall={null}
        ffmpegBusy={false}
        ytdlpInstall={null}
        ytdlpBusy={false}
        {...noops}
      />,
    );
    expect(markup).not.toContain("Auto");
    expect(markup).not.toContain("Bundled");
    expect(markup).toContain("yt-dlp 2026.08.19");
  });

  it("offers a retry only after a failed engine download", () => {
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={{ ...capabilities, ytdlp: { available: false, path: null, version: null, source: null } }}
        ffmpegInstall={null}
        ffmpegBusy={false}
        ytdlpInstall={{ phase: "failed", receivedBytes: 0, totalBytes: 100, supported: true, error: "socket closed" }}
        ytdlpBusy={false}
        {...noops}
      />,
    );
    expect(markup).toContain("Download failed");
    expect(markup).toContain("Retry");
  });

  it("renders when capabilities arrive empty", () => {
    const empty = {} as unknown as typeof capabilities;
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={empty}
        ffmpegInstall={null}
        ffmpegBusy={false}
        ytdlpInstall={null}
        ytdlpBusy={false}
        {...noops}
      />,
    );
    expect(markup).toContain("Not ready yet");
  });

  it("renders when settings arrive without a cookie field", () => {
    const legacy = { ...settings, cookie: undefined } as unknown as typeof settings;
    expect(() =>
      renderToString(
        <DownloadSettingsPanel
          settings={legacy}
          capabilities={null}
          ffmpegInstall={null}
          ffmpegBusy={false}
          ytdlpInstall={null}
          ytdlpBusy={false}
          {...noops}
        />,
      ),
    ).not.toThrow();
  });
});
