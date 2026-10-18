/**
 * Connection settings: the endpoint is plugin data, the key is a credential.
 * These tests keep that split honest — it is the only reason the plugin can
 * offer both a hosted key and a self-hosted server without secrets leaking into
 * plugin storage or tool arguments.
 */

import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { createFirecrawlConfig, API_KEY_SECRET, SETTINGS_FILE } from "../src/runtime/config";
import type { Transport } from "../src/domain/firecrawl/transport";

function fakeContext(stored: Record<string, string>, secrets: Record<string, string>) {
	const notify = vi.fn();
	const ctx = {
		storage: {
			readFile: async (path: string) => stored[path] ?? null,
			writeFile: async (path: string, value: string) => {
				stored[path] = value;
			},
		},
		secrets: {
			get: async (key: string) => secrets[key],
			set: async (key: string, value: string) => {
				secrets[key] = value;
			},
			delete: async (key: string) => {
				delete secrets[key];
			},
		},
		ui: { notify },
	};
	return { ctx: ctx as unknown as PluginContext, notify };
}

function nowhere(): Transport {
	return async () => {
		throw new Error("transport should not run");
	};
}

/** Answers the credit check the way the upstream does: 200 for one key, 401 otherwise. */
function accepting(validKey: string): Transport {
	return async (request) => {
		if (!request.url.endsWith("/v2/team/credit-usage")) {
			throw new Error(`unexpected request to ${request.url}`);
		}
		const authorized = request.headers?.authorization === `Bearer ${validKey}`;
		return authorized
			? {
					status: 200,
					ok: true,
					body: JSON.stringify({
						success: true,
						data: {
							remainingCredits: 480,
							planCredits: 500,
							billingPeriodEnd: "2026-11-01T00:00:00.000Z",
						},
					}),
				}
			: {
					status: 401,
					ok: false,
					body: JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }),
				};
	};
}

describe("connection config", () => {
	it("starts keyless against the hosted endpoint instead of refusing to work", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = {};
		const config = createFirecrawlConfig(fakeContext(stored, secrets).ctx, nowhere());

		expect(config.maybeClient).toBeNull();
		await config.load();

		expect(config.state.endpoint).toBe("https://api.firecrawl.dev");
		expect(config.state.hasKey).toBe(false);
		expect(config.state.reason).toMatch(/keyless/i);
		expect(await config.require()).not.toBeNull();
	});

	it("loads a saved endpoint and signs with the stored key", async () => {
		const stored: Record<string, string> = {
			[SETTINGS_FILE]: JSON.stringify({ endpoint: "http://localhost:3002/" }),
		};
		const secrets: Record<string, string> = { [API_KEY_SECRET]: "fc-self" };
		const { ctx } = fakeContext(stored, secrets);
		const calls: string[] = [];
		const transport: Transport = async (request) => {
			calls.push(`${request.headers?.authorization ?? "none"} ${request.url}`);
			return { status: 200, ok: true, body: JSON.stringify({ data: { markdown: "x" } }) };
		};
		const config = createFirecrawlConfig(ctx, transport);
		await config.load();

		expect(config.state.endpoint).toBe("http://localhost:3002");
		expect(config.state.hasKey).toBe(true);
		expect(config.state.reason).toBe("");

		const client = await config.require();
		await client.scrape({ url: "https://a.test" });
		expect(calls.at(-1)).toBe("Bearer fc-self http://localhost:3002/v2/scrape");
	});

	it("keeps the key out of plugin storage when both are configured", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = {};
		const { ctx } = fakeContext(stored, secrets);
		const config = createFirecrawlConfig(ctx, accepting("fc-1"));
		await config.load();

		await config.configure({ endpoint: "http://localhost:3002/", apiKey: "fc-1" });

		expect(JSON.parse(stored[SETTINGS_FILE])).toEqual({ endpoint: "http://localhost:3002/" });
		expect(stored[SETTINGS_FILE]).not.toContain("fc-1");
		expect(secrets[API_KEY_SECRET]).toBe("fc-1");
		expect(config.state.hasKey).toBe(true);
		expect(config.state.endpoint).toBe("http://localhost:3002");

		await config.configure({ apiKey: "" });
		expect(secrets[API_KEY_SECRET]).toBeUndefined();
		expect(config.state.hasKey).toBe(false);
	});

	it("does not store a key the upstream rejects, and keeps the old one", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = { [API_KEY_SECRET]: "fc-good" };
		const { ctx, notify } = fakeContext(stored, secrets);
		const config = createFirecrawlConfig(ctx, accepting("fc-good"));
		await config.load();
		await config.refreshAccount();
		expect(config.account.connected).toBe(true);

		const accepted = await config.connect("fc-typo");

		expect(accepted).toBe(false);
		expect(secrets[API_KEY_SECRET]).toBe("fc-good");
		expect(config.state.hasKey).toBe(true);
		expect(config.account.error).toMatch(/rejected the API key/i);
		expect(notify).toHaveBeenCalledWith({ message: expect.stringMatching(/rejected the API key/i), error: true });
	});

	it("stores a verified key with its plan, and forgets it on disconnect", async () => {
		const stored: Record<string, string> = {};
		const secrets: Record<string, string> = {};
		const { ctx } = fakeContext(stored, secrets);
		const config = createFirecrawlConfig(ctx, accepting("fc-good"));
		await config.load();
		expect(config.account.connected).toBe(false);

		expect(await config.connect("  fc-good  ")).toBe(true);

		expect(secrets[API_KEY_SECRET]).toBe("fc-good");
		expect(config.state.hasKey).toBe(true);
		expect(config.account).toMatchObject({ connected: true, remainingCredits: 480, planCredits: 500 });
		expect(stored[SETTINGS_FILE] ?? "").not.toContain("fc-good");

		await config.disconnect();

		expect(secrets[API_KEY_SECRET]).toBeUndefined();
		expect(config.state.hasKey).toBe(false);
		expect(config.account).toEqual({ connected: false });
	});

	it("notifies instead of throwing when storage rejects the write", async () => {
		const { ctx, notify } = fakeContext({}, {});
		const broken = {
			...ctx,
			storage: {
				readFile: async () => null,
				writeFile: async () => {
					throw new Error("disk full");
				},
			},
		} as unknown as PluginContext;
		const config = createFirecrawlConfig(broken, nowhere());
		await config.load();

		await config.configure({ endpoint: "http://localhost:3002" });

		expect(notify).toHaveBeenCalledWith({ message: "disk full", error: true });
	});
});
