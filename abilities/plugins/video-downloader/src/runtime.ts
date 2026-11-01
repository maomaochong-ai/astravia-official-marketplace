import { SERVICE_ID } from "./plugin-ids";
import type { ManagedPluginContext, ServiceStatus } from "./runtime-contract";

/** Destination the archive unpacks into, as declared in `plugin.json`. */
const ASSET = "service";

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
class RuntimePayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimePayloadError";
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

/**
 * The archive ships inside the plugin bundle, so installing the runtime needs no network and
 * no separate release asset. The chunk is imported lazily to keep it out of the panel's first
 * paint, which is also why this is an `import()` of a virtual module rather than a static one.
 */
async function loadPayload(ctx: ManagedPluginContext): Promise<string> {
  const { SERVICE_PAYLOAD, SERVICE_PAYLOAD_SHA256 } = await import("virtual:service-payload");
  if (!SERVICE_PAYLOAD) {
    throw new RuntimePayloadError(
      ctx.i18n.t("error.runtimeMissing", { asset: ASSET, version: ctx.plugin.version }),
    );
  }
  if ((await sha256(SERVICE_PAYLOAD)) !== SERVICE_PAYLOAD_SHA256) {
    throw new RuntimePayloadError(ctx.i18n.t("error.runtimeChecksum", { asset: ASSET }));
  }
  return SERVICE_PAYLOAD;
}

async function installRuntime(
  ctx: ManagedPluginContext,
  payloads: Array<{ destination: string; data: string }>,
): Promise<ServiceStatus> {
  try {
    return await ctx.services.install(SERVICE_ID, payloads);
  } catch (error) {
    // The host can still see a child that survived `stop()` (its status lags the process), and it
    // refuses to install over a running child. One more stop is cheaper than failing the upgrade.
    if (!/stop the service/i.test(messageOf(error))) throw error;
    await ctx.services.stop(SERVICE_ID);
    return ctx.services.install(SERVICE_ID, payloads);
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
    const data = await loadPayload(ctx);
    // An earlier version's process can still be alive while this runtime is missing, and the host
    // refuses to install over a running child. Stop it first so an upgrade can replace the runtime.
    await ctx.services.stop(SERVICE_ID);
    status = await installRuntime(ctx, [{ destination: ASSET, data }]);
    if (!status.installed) throw new Error(status.message ?? ctx.i18n.t("error.runtimeInstall"));
  }

  status = await ctx.services.start(SERVICE_ID);
  if (status.phase !== "ready") await waitForStatus(ctx, (next) => next.phase === "ready", "Service startup");
}
