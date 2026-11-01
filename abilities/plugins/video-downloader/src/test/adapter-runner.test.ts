import { describe, expect, it, vi } from "vitest";

import { AdapterRunError, runAdapter } from "../services/adapter-runner";
import type { Adapter } from "../domain/adapter";

/**
 * The runner is the only place that decides whether an offscreen page is thrown away. A page that
 * is asking to be signed in on has to survive that decision, because the release is what makes the
 * user's next attempt land on a fresh, still anonymous page.
 */
function adapterOf(body: string): Adapter {
  return {
    id: "test-adapter",
    enabled: true,
    builtin: false,
    meta: {
      name: "Test",
      version: "1.0.0",
      match: ["https://example.com/*"],
      description: "%adapter.builtin.sniffer%",
      grant: "none",
    },
    body,
    updatedAt: 0,
  };
}

const SCREENSHOT = "data:image/png;base64,AAAA";

function captureOf(probe: unknown) {
  const releaseOffscreen = vi.fn(async () => undefined);
  const offscreen = vi.fn(async () => ({ dataUrl: SCREENSHOT, scaleFactor: 2, probe }));
  return { capture: { offscreen, releaseOffscreen }, releaseOffscreen, offscreen };
}

describe("runAdapter", () => {
  it("returns the extraction and releases the page afterwards", async () => {
    const { capture, releaseOffscreen } = captureOf({
      ok: true,
      value: { directUrl: "https://cdn.example.com/a.mp4", title: "Clip" },
    });

    const result = await runAdapter(capture as never, adapterOf("async function extract() { return {}; }"), "https://example.com/watch", {});

    expect(result.extraction.directUrl).toBe("https://cdn.example.com/a.mp4");
    expect(releaseOffscreen).toHaveBeenCalledTimes(1);
  });

  it("releases the page when the adapter simply failed", async () => {
    const { capture, releaseOffscreen } = captureOf({ ok: false, error: "没有找到媒体地址" });

    const error = await runAdapter(capture as never, adapterOf("async function extract() {}"), "https://example.com/watch", {}).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(AdapterRunError);
    expect((error as AdapterRunError).detail).toBe("没有找到媒体地址");
    expect((error as AdapterRunError).screenshot).toBe(SCREENSHOT);
    expect((error as AdapterRunError).loginRequired).toBe(false);
    expect(releaseOffscreen).toHaveBeenCalledTimes(1);
  });

  it("keeps the page alive when the adapter says it needs a sign-in", async () => {
    const { capture, releaseOffscreen } = captureOf({ ok: false, error: "NEEDS_LOGIN:请扫码" });

    const error = await runAdapter(capture as never, adapterOf("async function extract() {}"), "https://example.com/watch", {}).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AdapterRunError).loginRequired).toBe(true);
    expect((error as AdapterRunError).message).toBe("请扫码");
    expect((error as AdapterRunError).screenshot).toBe(SCREENSHOT);
    // Releasing would drop the page the user is about to sign in on.
    expect(releaseOffscreen).not.toHaveBeenCalled();
  });
});
