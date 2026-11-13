/**
 * Lifecycle adapter for the `strix-bridge` managed service.
 *
 * The host does not unpack a plugin's service for it. `PluginServiceRuntimeInstaller.resolve()`
 * throws `Service runtime is not installed by the plugin` unless the runtime directory already
 * carries the marker written by `install()`, and `install()` refuses any payload whose byte
 * length set does not match `plugin.json#providers.services[].runtime.platforms[tag].artifacts`
 * one-for-one, verifying each SHA-256. So the sequence is: read our own packaged bytes over
 * `astravia-plugin://`, install them, then start.
 *
 * Reading the artifact list from the packaged `plugin.json` (rather than a second copy in
 * TypeScript) keeps the host's expectation and what we send the same single source of truth.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type {
	ServiceBridgeHost,
	ServiceConnection,
	ServiceRuntimeArtifact,
	ServiceStatus,
} from "./runtime-contract";

export const SERVICE_ID = "strix-bridge";
/** How long a fresh start may take before the panel reports a failure. */
const READY_TIMEOUT_MS = 30_000;
const READY_POLL_MS = 400;

export interface ServiceRuntime {
	/** Base URL of the running bridge, installing and starting it when needed. */
	ensureReady(): Promise<string>;
	lastStatus(): ServiceStatus | undefined;
	lastError(): string | undefined;
	dispose(): void;
}

interface PackagedManifest {
	providers?: {
		services?: {
			id: string;
			runtime: { platforms: Record<string, { artifacts: ServiceRuntimeArtifact[] }> };
		}[];
	};
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}

export function createServiceRuntime(ctx: PluginContext): ServiceRuntime {
	const services = (ctx as unknown as { services?: ServiceBridgeHost }).services;
	const packageBase = `astravia-plugin://${ctx.plugin.id}/versions/${ctx.plugin.version}`;
	let baseUrl: string | undefined;
	let status: ServiceStatus | undefined;
	let error: string | undefined;
	let installAttempted = false;
	let inFlight: Promise<string> | undefined;
	let subscription: { dispose(): void } | undefined;

	if (services && typeof services.onStatusChange === "function") {
		subscription = services.onStatusChange((next) => {
			if (next.serviceId && next.serviceId !== SERVICE_ID) return;
			status = next;
			// A restart means a new port: drop the cached origin so the next call re-resolves.
			if (next.phase !== "ready") baseUrl = undefined;
		});
	}

	async function readPackagedFile(path: string): Promise<Uint8Array> {
		const response = await fetch(`${packageBase}/${path}`);
		if (!response.ok) {
			throw new Error(`cannot read ${path} from the installed package (${response.status})`);
		}
		return new Uint8Array(await response.arrayBuffer());
	}

	async function expectedArtifacts(host: ServiceBridgeHost): Promise<ServiceRuntimeArtifact[]> {
		const platform = await host.getPlatform();
		const manifest = JSON.parse(new TextDecoder().decode(await readPackagedFile("plugin.json"))) as PackagedManifest;
		const service = manifest.providers?.services?.find((item) => item.id === SERVICE_ID);
		const artifacts = service?.runtime.platforms[platform.tag]?.artifacts;
		if (!artifacts?.length) {
			throw new Error(`plugin.json declares no ${SERVICE_ID} runtime for ${platform.tag}`);
		}
		return artifacts;
	}

	async function installRuntime(host: ServiceBridgeHost): Promise<void> {
		const artifacts = await expectedArtifacts(host);
		const payloads = [];
		for (const artifact of artifacts) {
			payloads.push({
				destination: artifact.destination,
				data: toBase64(await readPackagedFile(artifact.destination)),
			});
		}
		status = await host.install(SERVICE_ID, payloads);
	}

	async function resolveBaseUrl(host: ServiceBridgeHost): Promise<string | undefined> {
		if (baseUrl) return baseUrl;
		const connection: ServiceConnection | undefined = await host.connection(SERVICE_ID).catch(() => undefined);
		if (!connection?.baseUrl) return undefined;
		baseUrl = connection.baseUrl.replace(/\/+$/, "");
		return baseUrl;
	}

/**
 * Install the runtime, making sure the old process is really gone first.
 *
 * The host refuses `install` while its child process exists — and `phase` is not a
 * reliable proxy for that: a service started by an older plugin version leaves a live
 * child while the status reads `stopped`. So: stop unconditionally, then install; if the
 * host still says the service is up, stop again and retry once. Two attempts, then the
 * error is surfaced as-is rather than looping.
 */
async function installWithStop(host: ServiceBridgeHost): Promise<void> {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			await host.stop(SERVICE_ID).catch(() => undefined);
			await installRuntime(host);
			return;
		} catch (cause) {
			const message = cause instanceof Error ? cause.message : String(cause);
			const stillRunning = /stop the service before installing/i.test(message);
			if (!stillRunning || attempt === 1) throw cause;
			// Give the kill a moment to reap the child before asking again.
			await new Promise((resolve) => setTimeout(resolve, 400));
		}
	}
}
	async function boot(): Promise<string> {
		if (!services) throw new Error("host does not expose the services API");

		status = await services.getStatus(SERVICE_ID);
		// `installed` is optional in the host's status; `=== false` skipped the install
		// whenever it came back undefined, and start() then failed with "Service runtime is
		// not installed by the plugin" — the exact message users reported.
		if (status?.installed !== true && !installAttempted) {
			// One install per activation: retrying the same bytes forever is a loop, and the
			// remedy for a real failure is reinstalling the plugin.
			installAttempted = true;
			await installWithStop(services);
			status = await services.getStatus(SERVICE_ID).catch(() => status);
		}
		try {
			if (status?.phase !== "ready") status = await services.start(SERVICE_ID);
		} catch (cause) {
			// Self-heal once: the host can lose the runtime marker (cleared cache, version
			// switch) while reporting nothing about it. A single forced reinstall is cheaper
			// than making the user delete and reinstall the plugin.
			const message = cause instanceof Error ? cause.message : String(cause);
			if (!/not installed by the plugin/i.test(message) || installAttempted) throw cause;
			installAttempted = true;
			status = await services.stop(SERVICE_ID).catch(() => status);
			await installRuntime(services);
			status = await services.start(SERVICE_ID);
		}

		const deadline = Date.now() + READY_TIMEOUT_MS;
		while (Date.now() < deadline) {
			const resolved = await resolveBaseUrl(services);
			if (resolved) {
				status = await services.getStatus(SERVICE_ID).catch(() => status);
				error = undefined;
				return resolved;
			}
			if (status?.phase === "failed" || status?.phase === "error") {
				throw new Error(status.message || `service ${SERVICE_ID} ${status.phase}`);
			}
			await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
			status = await services.getStatus(SERVICE_ID).catch(() => status);
		}
		throw new Error(status?.message || `service ${SERVICE_ID} did not report a port within ${READY_TIMEOUT_MS}ms`);
	}

	return {
		lastStatus: () => status,
		lastError: () => error,
		ensureReady() {
			// One boot at a time: several surfaces ask for the same URL on first paint.
			inFlight ??= boot()
				.catch((cause: unknown) => {
					error = cause instanceof Error ? cause.message : String(cause);
					throw cause;
				})
				.finally(() => {
					inFlight = undefined;
				});
			return inFlight;
		},
		dispose() {
			subscription?.dispose();
			subscription = undefined;
		},
	};
}
