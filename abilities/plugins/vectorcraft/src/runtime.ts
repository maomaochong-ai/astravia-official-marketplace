import type { PluginContext, PluginServiceStatus } from "@astravia-org/plugin-sdk";
import hubSource from "../server/hub.mjs?raw";
import { APP } from "./app.config.ts";
import { bytesToBase64 } from "./shared/formatters/base64.ts";

/** Service id as declared in `plugin.json#providers.services[0].id`. */
export const SERVICE_ID = APP.serviceId;
/** Must match `runtime.version`; a stale install is replaced instead of adopted. */
export const SERVICE_VERSION = APP.serviceVersion;
/** Must match `runtime.entry` and `platforms.<key>.artifacts[0].destination`. */
export const SERVICE_ARTIFACT = APP.serviceArtifact;

/**
 * The hub is inlined into this bundle rather than fetched from
 * `astravia-plugin://…/server/hub.mjs`: the pack collector only ships
 * manifest-declared resources plus `dist/assets`, so a service entry kept as a
 * bare file would silently miss a marketplace-installed package.
 *
 * The host still verifies the payload against `plugin.json`'s sha256, so a
 * stale `server/hub.mjs` fails loudly at install time instead of running.
 */
const HUB_BASE64 = bytesToBase64(new TextEncoder().encode(hubSource));

/**
 * Install (when missing or stale) and start the loopback hub, then return its
 * origin. Health is deliberately not checked here: the hub answers `/health`
 * before the app payload is ready, and the tab renders the hub's own waiting
 * page in the meantime.
 */
export async function ensureHub(ctx: PluginContext): Promise<string> {
  let status: PluginServiceStatus = await ctx.services.getStatus(SERVICE_ID);

  if (!status.installed || status.version !== SERVICE_VERSION) {
    // The host refuses to swap a runtime while the old child is alive; stop() is idempotent.
    await ctx.services.stop(SERVICE_ID).catch(() => undefined);
    status = await ctx.services.install(SERVICE_ID, [{ destination: SERVICE_ARTIFACT, data: HUB_BASE64 }]);
  }

  if (status.phase !== "ready") {
    await ctx.services.start(SERVICE_ID);
  }

  const connection = await ctx.services.connection(SERVICE_ID);
  return connection.baseUrl.replace(/\/$/, "");
}

/**
 * Start the hub at plugin activation when it is already installed and current, so
 * the first tab open does not pay for a cold process spawn.
 *
 * It deliberately never installs and never starts a download: a user who installed
 * seven craft plugins and opened none of them would otherwise pull several hundred
 * megabytes at launch. The hub only walks the network once a page asks for the app.
 */
export async function warmHub(ctx: PluginContext): Promise<void> {
  try {
    const status = await ctx.services.getStatus(SERVICE_ID);
    if (!status.installed || status.version !== SERVICE_VERSION) return;
    if (status.phase !== "ready") await ctx.services.start(SERVICE_ID);
  } catch {
    // A preview that cannot start must not break activation; the tab reports it.
  }
}
