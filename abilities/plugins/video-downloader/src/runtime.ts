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

// Activation can be replayed while the host refreshes plugin contributions; share one
// in-flight startup so two activations cannot both decide the runtime is missing.
let startup: Promise<void> | undefined;

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
  startup = ensureServiceStartedOnce(ctx).finally(() => {
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
      const response = await ctx.network.request<string>({
        url: asset.url,
        responseType: "base64",
        timeoutMs: 180_000,
      });
      if (!response.ok || typeof response.body !== "string") {
        throw new Error(`下载运行时失败：HTTP ${response.status}`);
      }
      if ((await sha256(response.body)) !== asset.sha256) {
        throw new Error(`运行时校验失败：${asset.destination}`);
      }
      payloads.push({ destination: asset.destination, data: response.body });
    }
    status = await ctx.services.install(SERVICE_ID, payloads);
    if (!status.installed) throw new Error(status.message ?? "运行时安装失败");
  }

  status = await ctx.services.start(SERVICE_ID);
  if (status.phase !== "ready") await waitForStatus(ctx, (next) => next.phase === "ready", "Service startup");
}
