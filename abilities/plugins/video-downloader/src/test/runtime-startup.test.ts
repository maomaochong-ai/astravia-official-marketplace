import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PAYLOAD = Buffer.from("video-downloader runtime payload ".repeat(32));
const DIGEST = createHash("sha256").update(PAYLOAD).digest("hex");
const BASE64 = PAYLOAD.toString("base64");

type Status = Record<string, unknown>;

function status(overrides: Status = {}): Status {
  return { serviceId: "video-downloader", phase: "stopped", version: "9.9.9", installed: false, recentOutput: "", ...overrides };
}

// The runtime archive is inlined in the bundle, so each test replaces that virtual module with a
// known payload instead of standing up a network transfer.
async function loadRuntime(payload: { base64?: string; digest?: string } = {}) {
  vi.resetModules();
  vi.doMock("virtual:service-payload", () => ({
    SERVICE_PAYLOAD: payload.base64 ?? BASE64,
    SERVICE_PAYLOAD_SHA256: payload.digest ?? DIGEST,
  }));
  return import("../runtime");
}

function createContext(overrides: Record<string, unknown> = {}) {
  const install = vi.fn(async () => status({ installed: true }));
  const start = vi.fn(async () => status({ installed: true, phase: "ready" }));
  const context = {
    plugin: { id: "video-downloader", version: "9.9.9" },
    services: {
      getStatus: vi.fn(async () => status()),
      install,
      start,
      stop: vi.fn(async () => status()),
      request: vi.fn(),
      onStatusChange: vi.fn(),
    },
    i18n: { locale: "en", t: (key: string, params?: Record<string, string | number>) => `${key}:${JSON.stringify(params ?? {})}` },
    ...overrides,
  };
  return { context, install, start };
}

beforeEach(() => {
  vi.stubGlobal("crypto", {
    subtle: { digest: async (_algorithm: string, bytes: Uint8Array) => createHash("sha256").update(bytes).digest() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("virtual:service-payload");
});

describe("service runtime bootstrap", () => {
  it("installs the runtime from the bundled payload and starts it", async () => {
    const { ensureServiceStarted, serviceStartupFailure } = await loadRuntime();
    const { context, install, start } = createContext();

    await ensureServiceStarted(context as never);

    expect(install).toHaveBeenCalledWith("video-downloader", [{ destination: "service", data: BASE64 }]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(serviceStartupFailure()).toBeNull();
  });

  it("skips installation when the host already has the runtime", async () => {
    const { ensureServiceStarted } = await loadRuntime();
    const { context, install, start } = createContext();
    context.services.getStatus = vi.fn(async () => status({ installed: true, phase: "stopped" }));

    await ensureServiceStarted(context as never);

    expect(install).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);
  });

  // Upgrading a plugin whose previous runtime is still running must stop it first: the host
  // refuses `install` while a child process is alive ("Stop the service before installing").
  it("stops the previous runtime before installing", async () => {
    const { ensureServiceStarted } = await loadRuntime();
    const calls: string[] = [];
    const { context, install } = createContext();
    context.services.stop = vi.fn(async () => {
      calls.push("stop");
      return status();
    });
    install.mockImplementation(async () => {
      calls.push("install");
      return status({ installed: true });
    });

    await ensureServiceStarted(context as never);

    expect(calls).toEqual(["stop", "install"]);
  });

  // The host's status can lag the child process, so a stopped-looking service occasionally still
  // rejects the install. One extra stop must recover it instead of failing the whole upgrade.
  it("stops again and retries when the host still sees the previous child", async () => {
    const { ensureServiceStarted } = await loadRuntime();
    const calls: string[] = [];
    const { context, install } = createContext();
    context.services.stop = vi.fn(async () => {
      calls.push("stop");
      return status();
    });
    install.mockImplementationOnce(async () => {
      calls.push("install");
      throw new Error("Stop the service before installing its runtime");
    });
    install.mockImplementation(async () => {
      calls.push("install");
      return status({ installed: true });
    });

    await ensureServiceStarted(context as never);

    expect(calls).toEqual(["stop", "install", "stop", "install"]);
  });

  it("does not retry an install failure it cannot explain", async () => {
    const { ensureServiceStarted } = await loadRuntime();
    const { context, install } = createContext();
    install.mockRejectedValue(new Error("disk is full"));

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/disk is full/u);
    expect(install).toHaveBeenCalledTimes(1);
  });

  it("rejects a payload that does not match the declared digest", async () => {
    const { ensureServiceStarted } = await loadRuntime({ digest: "0".repeat(64) });
    const { context, install } = createContext();

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/error\.runtimeChecksum/u);
    expect(install).not.toHaveBeenCalled();
  });

  // A dev server cannot compile the service, so the virtual module answers with an empty payload.
  it("names a missing payload instead of installing nothing", async () => {
    const { ensureServiceStarted, serviceStartupFailure } = await loadRuntime({ base64: "", digest: "" });
    const { context, install } = createContext();

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/error\.runtimeMissing/u);
    expect(install).not.toHaveBeenCalled();
    expect(serviceStartupFailure()).toContain("9.9.9");
  });

  it("shares one startup between concurrent calls", async () => {
    const { ensureServiceStarted } = await loadRuntime();
    const { context, start } = createContext();

    await Promise.all([ensureServiceStarted(context as never), ensureServiceStarted(context as never)]);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it("clears the recorded failure once a later activation succeeds", async () => {
    const { ensureServiceStarted, serviceStartupFailure } = await loadRuntime();
    const { context, install } = createContext();
    install.mockRejectedValueOnce(new Error("runtime directory is locked"));

    await expect(ensureServiceStarted(context as never)).rejects.toThrow(/locked/u);
    expect(serviceStartupFailure()).toContain("locked");

    await ensureServiceStarted(context as never);

    expect(serviceStartupFailure()).toBeNull();
  });
});
