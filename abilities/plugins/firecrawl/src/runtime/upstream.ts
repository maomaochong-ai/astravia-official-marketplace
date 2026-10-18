/**
 * Upstream configuration: which engine runs, where it points, and the key.
 *
 * Settings live in the plugin's own `settings.json` (ADR-0105: configuration is
 * plugin data, not host state). The API key is different: it is a credential, so
 * it goes to the host vault through `ctx.secrets` and is never serialized into
 * plugin storage or tool arguments.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { createRestClient, DEFAULT_ENDPOINT, normalizeEndpoint } from "../domain/backend/rest";
import type { UpstreamClient } from "../domain/backend/types";

export type EngineChoice = "auto" | "upstream" | "local";

export interface UpstreamSettings {
	/** `auto` prefers the upstream API whenever it is configured. */
	engine: EngineChoice;
	/** Empty means "the official cloud endpoint". */
	endpoint: string;
}

export const SETTINGS_FILE = "settings.json";
export const API_KEY_SECRET = "firecrawl.apiKey";
export const DEFAULT_SETTINGS: UpstreamSettings = { engine: "auto", endpoint: "" };

const ENGINE_CHOICES: readonly EngineChoice[] = ["auto", "upstream", "local"];

function coerce(raw: unknown): UpstreamSettings {
	const record = (raw ?? {}) as Record<string, unknown>;
	const engine = ENGINE_CHOICES.includes(record.engine as EngineChoice)
		? (record.engine as EngineChoice)
		: DEFAULT_SETTINGS.engine;
	const endpoint = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
	return { engine, endpoint };
}

export class UpstreamGate {
	private settings: UpstreamSettings = DEFAULT_SETTINGS;
	private client: UpstreamClient | null = null;
	private reason = "Upstream is not configured yet; the local engine handles this request.";
	private readonly listeners = new Set<() => void>();
	private loaded = false;

	constructor(
		private readonly ctx: PluginContext,
		private readonly http: Parameters<typeof createRestClient>[0]["client"],
	) {}

	/** Current settings plus whether a working upstream client exists. */
	get state(): { settings: UpstreamSettings; configured: boolean; endpoint: string; reason: string } {
		return {
			settings: this.settings,
			configured: this.client !== null,
			endpoint: this.client?.endpoint ?? normalizeEndpoint(this.settings.endpoint),
			reason: this.reason,
		};
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	private emit(): void {
		for (const listener of this.listeners) listener();
	}

	async load(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		let stored: UpstreamSettings = DEFAULT_SETTINGS;
		try {
			const raw = await this.ctx.storage.readFile(SETTINGS_FILE, "utf8");
			stored = coerce(raw === null ? null : (JSON.parse(raw) as unknown));
		} catch {
			stored = DEFAULT_SETTINGS;
		}
		let key = "";
		try {
			key = (await this.ctx.secrets.get(API_KEY_SECRET)) ?? "";
		} catch {
			key = "";
		}
		this.settings = stored;
		this.rebuild(key);
	}

	private rebuild(apiKey: string): void {
		const endpoint = normalizeEndpoint(this.settings.endpoint);
		const configured = this.settings.endpoint.length > 0 || apiKey.length > 0;
		if (!configured) {
			this.client = null;
			this.reason =
				"No upstream endpoint or API key is configured, so the local engine handles this request. Add either in the crawler console to use the Firecrawl API.";
			return;
		}
		this.client = createRestClient({ endpoint: endpoint || DEFAULT_ENDPOINT, apiKey, client: this.http });
		this.reason =
			apiKey.length === 0 && /api\.firecrawl\.dev/i.test(endpoint)
				? "No API key set: the hosted API needs one, so keyless requests may be rate-limited or rejected."
				: "";
	}

	async configure(patch: { engine?: EngineChoice; endpoint?: string; apiKey?: string }): Promise<void> {
		if (patch.engine !== undefined) this.settings.engine = patch.engine;
		if (patch.endpoint !== undefined) this.settings.endpoint = patch.endpoint.trim();
		try {
			await this.ctx.storage.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), "utf8");
		} catch (error) {
			this.ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		}
		if (patch.apiKey !== undefined) {
			try {
				if (patch.apiKey.length === 0) await this.ctx.secrets.delete(API_KEY_SECRET);
				else await this.ctx.secrets.set(API_KEY_SECRET, patch.apiKey);
			} catch (error) {
				this.ctx.ui.notify({
					message: error instanceof Error ? error.message : String(error),
					error: true,
				});
			}
		}
		let key = "";
		try {
			key = (await this.ctx.secrets.get(API_KEY_SECRET)) ?? "";
		} catch {
			key = "";
		}
		this.rebuild(key);
		this.emit();
	}

	/** `auto` uses the API when it is configured; explicit choices are honoured. */
	resolve(requested?: EngineChoice): "upstream" | "local" {
		const choice = requested ?? this.settings.engine;
		if (choice === "local") return "local";
		if (choice === "upstream") return this.client ? "upstream" : "local";
		return this.client ? "upstream" : "local";
	}

	async require(): Promise<UpstreamClient> {
		await this.load();
		if (!this.client) {
			throw new Error(
				`${this.reason} Configure an endpoint or API key in the crawler console, or call this tool without \`engine: "upstream"\`.`,
			);
		}
		return this.client;
	}

	get maybeClient(): UpstreamClient | null {
		return this.client;
	}
}

export function createUpstreamGate(
	ctx: PluginContext,
	http: Parameters<typeof createRestClient>[0]["client"],
): UpstreamGate {
	return new UpstreamGate(ctx, http);
}
