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
  multiThread: true,
  keepPartialFiles: false,
};

const capabilities = {
  lux: { available: true, path: "/bin/lux", version: "0.24.1", source: "bundled" as const },
  ffmpeg: { available: false, path: null, version: null, source: null },
};

describe("DownloadSettingsPanel", () => {
  it("renders while ffmpeg is missing and an install is in progress", () => {
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={capabilities}
        ffmpegInstall={{ phase: "downloading", receivedBytes: 5_000_000, totalBytes: 19_246_198, supported: true, error: null }}
        ffmpegBusy={false}
        onSave={() => undefined}
        onRefreshCapabilities={() => undefined}
        onInstallFfmpeg={() => undefined}
      />,
    );
    expect(markup).toContain("Installing 26%");
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
          onSave={() => undefined}
          onRefreshCapabilities={() => undefined}
          onInstallFfmpeg={() => undefined}
        />,
      ),
    ).not.toThrow();
  });

  // Regression: the service answered with a flat `{ lux, ffmpeg }` while the client read
  // `body.capabilities`, so `lux` was missing and the engine row crashed the whole view.
  it("renders when capabilities arrive without the lux entry", () => {
    const partial = { ffmpeg: capabilities.ffmpeg } as unknown as typeof capabilities;
    const markup = renderToString(
      <DownloadSettingsPanel
        settings={settings}
        capabilities={partial}
        ffmpegInstall={null}
        ffmpegBusy={false}
        onSave={() => undefined}
        onRefreshCapabilities={() => undefined}
        onInstallFfmpeg={() => undefined}
      />,
    );
    expect(markup).toContain("engine missing");
    expect(markup).toContain("ffmpeg not found");
  });

  it("renders when capabilities arrive empty", () => {
    const empty = {} as unknown as typeof capabilities;
    expect(() =>
      renderToString(
        <DownloadSettingsPanel
          settings={settings}
          capabilities={empty}
          ffmpegInstall={null}
          ffmpegBusy={false}
          onSave={() => undefined}
          onRefreshCapabilities={() => undefined}
          onInstallFfmpeg={() => undefined}
        />,
      ),
    ).not.toThrow();
  });
});
