import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PAYLOAD = Buffer.from("video-downloader runtime payload ".repeat(32));
const DIGEST = createHash("sha256").update(PAYLOAD).digest("hex");
const BASE64 = PAYLOAD.toString("base64");

// A one-asset lock keeps the assertions about download attempts readable.
vi.mock("../../runtime-lock.json", () => ({
  default: {
    version: "9.9.9",
    platforms: {
      "darwin-arm64": [
        { destination: "service", url: "https://example.test/video-downloader-service-9.9.9.zip", sha256: DIGEST },
      ],
    },
  },
}));

const { ensureServiceStarted, serviceStartupFailure } = await import("../runtime");

type Status = Record<string, unknown>;

function status(overrides: Status = {}): Status {
  return { serviceId: "video-downloader", phase: "stopped", version: "9.9.9", installed: false, recentOutput: "", ...overrides };
}

function createContext(overrides: Record<string, unknown> = {}) {
  const request = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", body: BASE64 }));
  const install = vi.fn(async () => status({ installed: true }));
  const start = vi.fn(async () => status({ installed: true, phase: "ready" }));
  const context = {
    services: {
      getPlatform: vi.fn(async () => ({ tag: "darwin-arm64" })),
      getStatus: vi.fn(async () => status()),
      install,
      start,
      stop: vi.fn(),
      request: vi.fn(),
      onStatusChange: vi.fn(),
    },
    network: { request },
    i18n: { locale: "en", t: (key: string, params?: Record<string, string | number>) => `${key}:${JSON.stringify(params ?? {})}` },
    ...overrides,
  };
  return { context, request, install, start };
}

beforeEach(() => {
  vi.stubGlobal("crypto", {
    subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => createHash("sha256").update(bytes).digest() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("service runtime bootstrap", () => {
  it("installs and starts the pinned runtime", async () => {
    const { context, request, install, start } = createContext();

    await ensureServiceStarted(context as never);

    expect(request).toHaveBeenCalledTimes(1);
    expect(install).toHaveBeenCalledWith("video-downloader", [{ destination: "service", data: BASE64 }]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(serviceStartupFailure()).toBeNull();
  });

  it("retries a dropped transfer before giving up", async () => {
    const { context, request } = createContext();
    request.mockRejectedValueOnce(new Error("socket hang up"));

    await ensureServiceStarted(context as never);

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not retry a missing artifact and names it", async () => {
    const { context, request } = createContext();
    request.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found", body: "" });

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/error\.runtimeMissing/u);

    expect(request).toHaveBeenCalledTimes(1);
    expect(serviceStartupFailure()).toMatch(/error\.runtimeMissing/u);
    expect(serviceStartupFailure()).toContain("service");
  });

  it("rejects a checksum mismatch instead of installing the bytes", async () => {
    const { context, request, install } = createContext();
    request.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body: Buffer.from("tampered payload").toString("base64"),
    });

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/error\.runtimeChecksum/u);

    expect(install).not.toHaveBeenCalled();
  });

  it("shares one startup between concurrent calls", async () => {
    const { context, start } = createContext();

    await Promise.all([ensureServiceStarted(context as never), ensureServiceStarted(context as never)]);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("retries a server error once, then recovers on a later start", async () => {
    const { context, request } = createContext();
    request.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error", body: "" });

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/error\.runtimeDownload/u);
    expect(request).toHaveBeenCalledTimes(2);
    expect(serviceStartupFailure()).toContain("500");

    request.mockResolvedValue({ ok: true, status: 200, statusText: "OK", body: BASE64 });
    await ensureServiceStarted(context as never);

    expect(serviceStartupFailure()).toBeNull();
  });
});
