/**
 * Lifecycle adapter for the `strix-bridge` managed service.
 *
 * Two jobs only: make sure the host has the service running, and hand back its
 * base URL. Nothing here knows what a scan is - that lives in
 * `features/scan-console`.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { ServiceBridgeHost, ServiceConnection, ServiceStatus } from "./runtime-contract";

export const SERVICE_ID = "strix-bridge";

export interface ServiceRuntime {
	/** Base URL of the running bridge, starting it if the host has not yet. */
	ensureReady(): Promise<string>;
	/** Last known status, for the panel's "service is starting" state. */
	lastStatus(): ServiceStatus | undefined;
	dispose(): void;
}

export function createServiceRuntime(ctx: PluginContext): ServiceRuntime {
	const services = (ctx as unknown as { services: ServiceBridgeHost }).services;
	let baseUrl: string | undefined;
	let status: ServiceStatus | undefined;
	let subscription: { dispose(): void } | undefined;

	if (services && typeof services.onStatusChange === "function") {
		subscription = services.onStatusChange((next) => {
			if (next.serviceId && next.serviceId !== SERVICE_ID) return;
			status = next;
			// A restart means a new port: drop the cached origin so the next call re-resolves.
			if (next.phase !== "ready") baseUrl = undefined;
		});
	}

	async function resolveBaseUrl(): Promise<string | undefined> {
		if (baseUrl) return baseUrl;
		if (!services) return undefined;
		const connection: ServiceConnection | undefined = await services
			.connection(SERVICE_ID)
			.catch(() => undefined);
		if (!connection?.baseUrl) return undefined;
		baseUrl = connection.baseUrl.replace(/\/+$/, "");
		return baseUrl;
	}

	return {
		lastStatus: () => status,
		async ensureReady() {
			if (!services) throw new Error("host does not expose the services API");
			status = await services.getStatus(SERVICE_ID);
			if (status.phase !== "ready") {
				status = await services.start(SERVICE_ID);
			}
			const resolved = await resolveBaseUrl();
			if (!resolved) {
				throw new Error(status.message || `service ${SERVICE_ID} is ${status.phase}`);
			}
			return resolved;
		},
		dispose() {
			subscription?.dispose();
			subscription = undefined;
		},
	};
}
