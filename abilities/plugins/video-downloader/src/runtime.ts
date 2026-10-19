import runtimeLock from "../runtime-lock.json";
import { SERVICE_ID } from "./plugin-ids";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

type PlatformTag = "win32-x64" | "win32-arm64" | "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64";
interface RuntimeAsset {
  destination: string;
  url: string;
  sha256: string;
}

const assetsByPlatform = runtimeLock.platforms as unknown as Record<PlatformTag, RuntimeAsset[]>;

// A pinned artifact can be slow or drop on a bad link; one retry covers that without
// turning a missing upload into a long stall.
const DOWNLOAD_ATTEMPTS = 2;

// Activation can be replayed while the host refreshes plugin contributions; share one
// in-flight startup so two activations cannot both decide the runtime is missing.
let startup: Promise<void> | undefined;
let startupFailure: string | null = null;

/**
 * Why the last runtime bootstrap failed. Every later service request only reports
 * "Service is not ready", so the panel needs this to show the real cause.
 */
export function serviceStartupFailure(): string | null {
  return startupFailure;
}

/** A failure the caller already explained well enough that a retry cannot help. */
class RuntimeAssetError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "RuntimeAssetError";
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sha256(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return crypto.subtle
    .digest("SHA-256", bytes)
    .then((digest) =>
      Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    );
}

async function fetchAsset(ctx: ManagedPluginContext, asset: RuntimeAsset): Promise<string> {
  const response = await ctx.network.request<string>({
    url: asset.url,
    responseType: "base64",
    timeoutMs: 180_000,
  });
  if (!response.ok || typeof response.body !== "string") {
    const params = { asset: asset.destination, version: runtimeLock.version, status: response.status };
    throw new RuntimeAssetError(
      response.status === 404
        ? ctx.i18n.t("error.runtimeMissing", params)
        : ctx.i18n.t("error.runtimeDownload", params),
      // 404 means the pinned file was never published: retrying cannot fix that.
      response.status !== 404,
    );
  }
  if ((await sha256(response.body)) !== asset.sha256) {
    throw new RuntimeAssetError(
      ctx.i18n.t("error.runtimeChecksum", { asset: asset.destination }),
      // A truncated transfer shows up as a checksum mismatch; one retry is worth it.
      true,
    );
  }
  return response.body;
}

async function downloadAsset(ctx: ManagedPluginContext, asset: RuntimeAsset): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchAsset(ctx, asset);
    } catch (error) {
      const retryable = !(error instanceof RuntimeAssetError) || error.retryable;
      if (!retryable || attempt >= DOWNLOAD_ATTEMPTS) throw error;
    }
  }
}

async function waitForStatus(
  ctx: ManagedPluginContext,
  accept: (status: ServiceStatus) => boolean,
  operation: string,
): Promise<ServiceStatus> {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const status = await ctx.services.getStatus(SERVICE_ID);
    if (status.phase === "failed") throw new Error(status.message ?? `${operation} failed`);
    if (accept(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`${operation} timed out`);
}

export async function ensureServiceStarted(ctx: ManagedPluginContext): Promise<void> {
  if (startup) return startup;
  startupFailure = null;
  startup = ensureServiceStartedOnce(ctx)
    .catch((error: unknown) => {
      startupFailure = messageOf(error);
      throw error;
    })
    .finally(() => {
      startup = undefined;
    });
  return startup;
}

async function ensureServiceStartedOnce(ctx: ManagedPluginContext): Promise<void> {
  let status = await ctx.services.getStatus(SERVICE_ID);
  if (status.phase === "ready") return;

  if (status.phase === "starting" || status.phase === "installing" || status.phase === "stopping") {
    status = await waitForStatus(
      ctx,
      (next) => next.phase === "ready" || (next.phase !== status.phase && next.phase !== "failed"),
      "Service startup",
    );
    if (status.phase === "ready") return;
  }

  if (!status.installed) {
    const { tag } = await ctx.services.getPlatform();
    const assets = assetsByPlatform[tag as PlatformTag];
    if (!assets) throw new Error(`Unsupported runtime platform: ${tag}`);
    const payloads: Array<{ destination: string; data: string }> = [];
    for (const asset of assets) {
      payloads.push({ destination: asset.destination, data: await downloadAsset(ctx, asset) });
    }
    // An earlier version's process can still be alive while this runtime is missing, and the host
    // refuses to install over a running child. Stop it first so an upgrade can replace the runtime.
    await ctx.services.stop(SERVICE_ID);
    status = await ctx.services.install(SERVICE_ID, payloads);
    if (!status.installed) throw new Error(status.message ?? ctx.i18n.t("error.runtimeInstall"));
  }

  status = await ctx.services.start(SERVICE_ID);
  if (status.phase !== "ready") await waitForStatus(ctx, (next) => next.phase === "ready", "Service startup");
}
