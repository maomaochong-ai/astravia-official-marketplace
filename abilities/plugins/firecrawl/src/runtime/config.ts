/**
 * Connection configuration: where the API lives and which key signs requests.
 *
 * Settings live in the plugin's own `settings.json` (ADR-0105: configuration is
 * plugin data, not host state). The API key is different: it is a credential, so
 * it goes to the host vault through `ctx.secrets` and is never serialized into
 * plugin storage or tool arguments.
 *
 * There is always a client: the hosted endpoint accepts keyless requests at a
 * lower rate limit, so an unconfigured plugin still works.
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import { createClient, DEFAULT_ENDPOINT, normalizeEndpoint } from "../domain/firecrawl/client";
import type { CreditUsage, FirecrawlClient } from "../domain/firecrawl/types";
import type { Transport } from "../domain/firecrawl/transport";

export interface ConnectionSettings {
	/** Empty means "the official cloud endpoint". */
	endpoint: string;
}

export const SETTINGS_FILE = "settings.json";
export const API_KEY_SECRET = "firecrawl.apiKey";
export const DEFAULT_SETTINGS: ConnectionSettings = { endpoint: "" };
/**
 * Where the user signs in and creates a key. Firecrawl has no third-party OAuth
 * client registration, so "authorize" means this page plus a verified paste —
 * see docs/adr/0001-firecrawl-integration-mode.md.
 */
export const AUTHORIZE_URL = "https://www.firecrawl.dev/app/api-keys";

function numberOrUndefined(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function coerce(raw: unknown): ConnectionSettings {
	const record = (raw ?? {}) as Record<string, unknown>;
	return { endpoint: typeof record.endpoint === "string" ? record.endpoint.trim() : "" };
}

export interface ConnectionState {
	settings: ConnectionSettings;
	endpoint: string;
	hasKey: boolean;
	reason: string;
}

export interface AccountState {
	connected: boolean;
	/** Plan credits for the current billing period, when the team reports them. */
	planCredits?: number;
	remainingCredits?: number;
	billingPeriodEnd?: string;
	/** Epoch ms of the last successful read. */
	checkedAt?: number;
	/** Last verification failure, in the upstream's own words. */
	error?: string;
}

export class FirecrawlConfig {
	private settings: ConnectionSettings = DEFAULT_SETTINGS;
	private client: FirecrawlClient;
	private reason = "";
	private readonly listeners = new Set<() => void>();
	private loaded = false;
	private keySet = false;
	private accountState: AccountState = { connected: false };

	constructor(
		private readonly ctx: PluginContext,
		private readonly transport: Transport,
	) {
		this.client = createClient({ transport });
	}

	get state(): ConnectionState {
		return {
			settings: this.settings,
			endpoint: this.client.endpoint,
			hasKey: this.keySet,
			reason: this.reason,
		};
	}

	get account(): AccountState {
		return this.accountState;
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
		let stored: ConnectionSettings = DEFAULT_SETTINGS;
		try {
			const raw = await this.ctx.storage.readFile(SETTINGS_FILE, "utf8");
			stored = coerce(raw === null ? null : (JSON.parse(raw) as unknown));
		} catch {
			stored = DEFAULT_SETTINGS;
		}
		this.settings = stored;
		this.rebuild(await this.storedKey());
		if (this.keySet) void this.refreshAccount().catch(() => undefined);
	}

	/**
	 * Read the team's plan and remaining credits with the current credentials.
	 * Safe to call without a key: it reports `connected: false` instead of asking.
	 */
	async refreshAccount(): Promise<AccountState> {
		if (!this.keySet) {
			this.accountState = { connected: false };
			this.emit();
			return this.accountState;
		}
		const usage: CreditUsage = await this.client.credits();
		this.accountState = {
			connected: true,
			planCredits: numberOrUndefined(usage.planCredits),
			remainingCredits: numberOrUndefined(usage.remainingCredits),
			billingPeriodEnd: typeof usage.billingPeriodEnd === "string" ? usage.billingPeriodEnd : undefined,
			checkedAt: Date.now(),
		};
		this.emit();
		return this.accountState;
	}

	/**
	 * Verify a candidate key against the billing endpoint, then store it.
	 * A key that the upstream rejects is never written: the previous credential
	 * stays in place so a typo cannot silently downgrade a working setup.
	 */
	async connect(apiKey: string): Promise<boolean> {
		const candidate = apiKey.trim();
		if (candidate.length === 0) {
			this.ctx.ui.notify({ message: "Paste a Firecrawl API key first.", error: true });
			return false;
		}
		const probe = createClient({
			endpoint: this.client.endpoint,
			apiKey: candidate,
			transport: this.transport,
		});
		let usage: CreditUsage;
		try {
			usage = await probe.credits();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.accountState = { connected: this.keySet, error: message };
			this.emit();
			this.ctx.ui.notify({ message, error: true });
			return false;
		}
		try {
			await this.ctx.secrets.set(API_KEY_SECRET, candidate);
		} catch (error) {
			this.ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
			return false;
		}
		this.rebuild(candidate);
		this.accountState = {
			connected: true,
			planCredits: numberOrUndefined(usage.planCredits),
			remainingCredits: numberOrUndefined(usage.remainingCredits),
			billingPeriodEnd: typeof usage.billingPeriodEnd === "string" ? usage.billingPeriodEnd : undefined,
			checkedAt: Date.now(),
		};
		this.emit();
		return true;
	}

	/** Drop the stored key and fall back to the keyless tier. */
	async disconnect(): Promise<void> {
		try {
			await this.ctx.secrets.delete(API_KEY_SECRET);
		} catch (error) {
			this.ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
			return;
		}
		this.rebuild("");
		this.accountState = { connected: false };
		this.emit();
	}

	private rebuild(apiKey: string): void {
		const endpoint = normalizeEndpoint(this.settings.endpoint);
		this.keySet = apiKey.trim().length > 0;
		this.client = createClient({ endpoint: endpoint || DEFAULT_ENDPOINT, apiKey, transport: this.transport });
		this.reason = this.keySet
			? ""
			: "No API key set. The hosted API answers keyless requests with lower rate limits; add a key for full throughput.";
	}

	/**
	 * Save one connection change. The key branch goes through `connect()` /
	 * `disconnect()` on purpose: the console bar is a second entry point to the
	 * same credential, and a second write path that skipped verification would
	 * let a typo replace a working key without either surface saying so.
	 */
	async configure(patch: { endpoint?: string; apiKey?: string }): Promise<void> {
		if (patch.endpoint !== undefined) {
			this.settings.endpoint = patch.endpoint.trim();
			this.rebuild(await this.storedKey());
			this.emit();
		}
		try {
			await this.ctx.storage.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2), "utf8");
		} catch (error) {
			this.ctx.ui.notify({
				message: error instanceof Error ? error.message : String(error),
				error: true,
			});
		}
		if (patch.apiKey === undefined) return;
		if (patch.apiKey.trim().length === 0) await this.disconnect();
		else await this.connect(patch.apiKey);
	}

	private async storedKey(): Promise<string> {
		try {
			return (await this.ctx.secrets.get(API_KEY_SECRET)) ?? "";
		} catch {
			return "";
		}
	}

	async require(): Promise<FirecrawlClient> {
		await this.load();
		return this.client;
	}

	/** Current client without touching storage; `null` before `load()`. */
	get maybeClient(): FirecrawlClient | null {
		return this.loaded ? this.client : null;
	}
}

export function createFirecrawlConfig(ctx: PluginContext, transport: Transport): FirecrawlConfig {
	return new FirecrawlConfig(ctx, transport);
}
