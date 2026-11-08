import type { PluginContext, PluginModelProviderConfig } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { GatewayController } from "../src/controller";

type Handler = (url: string) => { status: number; body: unknown } | Error;

function fakeContext(handler: Handler) {
	let owned: Record<string, PluginModelProviderConfig> = {};
	const writes: Array<Record<string, PluginModelProviderConfig>> = [];
	const files = new Map<string, string>();
	const opened: string[] = [];

	const ctx = {
		network: {
			request: async (request: { url: string }) => {
				const result = handler(request.url);
				if (result instanceof Error) throw result;
				return {
					ok: result.status >= 200 && result.status < 300,
					status: result.status,
					statusText: "",
					headers: {},
					body: result.body,
				};
			},
		},
		models: {
			listOwnedProviders: async () => owned,
			replaceOwnedProviders: async (next: Record<string, PluginModelProviderConfig>) => {
				owned = next;
				writes.push(next);
			},
		},
		storage: {
			readFile: async (path: string) => files.get(path) ?? null,
			writeFile: async (path: string, data: string) => {
				files.set(path, data);
				return { revision: "1" };
			},
		},
		ui: {
			setWorkspaceViewBadge: () => ({ dispose() {} }),
			openExternal: async (url: string) => {
				opened.push(url);
			},
			notify: () => undefined,
		},
		i18n: { t: (key: string) => key, locale: "en", onChange: () => ({ dispose() {} }) },
	} as unknown as PluginContext;

	return { ctx, writes, files, opened, peer: () => owned };
}

const ONLINE_MODELS = {
	object: "list",
	data: [
		{ id: "gpt-4o", owned_by: "openai", context_window: 128000, max_output_tokens: 16384 },
		{ id: "claude-sonnet-4", owned_by: "anthropic", context_window: 200000, reasoning: true },
	],
};

function serve(overrides: Partial<Record<"version" | "models", { status: number; body: unknown } | Error>> = {}): Handler {
	return (url) => {
		if (url.endsWith("/api/version")) return overrides.version ?? { status: 200, body: { version: "0.1.47" } };
		if (url.endsWith("/v1/models")) return overrides.models ?? { status: 200, body: ONLINE_MODELS };
		throw new Error(`unexpected url ${url}`);
	};
}

describe("GatewayController.refresh", () => {
	it("goes online and keeps the parsed catalog", async () => {
		const { ctx } = fakeContext(serve());
		const controller = new GatewayController(ctx);
		await controller.refresh();
		const state = controller.getState();
		expect(state.phase).toBe("online");
		expect(state.version).toBe("0.1.47");
		expect(state.summary.total).toBe(2);
		expect(state.messageKey).toBeUndefined();
	});

	it("separates a refused connection from a wrong service", async () => {
		const refused = fakeContext(serve({ version: Object.assign(new Error("boom"), { reason: "transport-failed" }) }));
		const offline = new GatewayController(refused.ctx);
		await offline.refresh();
		expect(offline.getState()).toMatchObject({ phase: "offline", failure: "unreachable", messageKey: "error.unreachable" });

		const wrong = fakeContext(serve({ version: { status: 200, body: { hello: "world" } } }));
		const notMagpie = new GatewayController(wrong.ctx);
		await notMagpie.refresh();
		expect(notMagpie.getState()).toMatchObject({ phase: "offline", failure: "not-magpie", messageKey: "error.notMagpie" });
	});

	it("reports a timeout as its own reason", async () => {
		const timeout = fakeContext(serve({ version: Object.assign(new Error("late"), { reason: "timed-out" }) }));
		const controller = new GatewayController(timeout.ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "offline", failure: "timeout" });
	});

	it("stays online with a readable error when only the catalog fails", async () => {
		const { ctx } = fakeContext(serve({ models: { status: 500, body: null } }));
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "online", failure: "http", messageKey: "error.http" });
	});
});

describe("GatewayController.publish", () => {
	it("writes an OpenAI-compatible provider rooted at /v1", async () => {
		const { ctx, peer, writes } = fakeContext(serve());
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(await controller.publish()).toBe(true);

		const provider = peer().magpie;
		expect(provider).toMatchObject({
			baseUrl: "http://127.0.0.1:3425/v1",
			api: "openai-completions",
			displayName: "Magpie",
			apiKey: "magpie",
		});
		expect(provider?.models?.map((model) => model.id)).toEqual(["claude-sonnet-4", "gpt-4o"]);
		expect(writes).toHaveLength(1);
		expect(controller.getState().publishedCount).toBe(2);
	});

	it("keeps a display name the user already changed", async () => {
		const { ctx, peer } = fakeContext(serve());
		await ctx.models.replaceOwnedProviders({
			magpie: { displayName: "My Router", baseUrl: "http://127.0.0.1:3425/v1", models: [{ id: "old" }] },
		});
		const controller = new GatewayController(ctx);
		await controller.refresh();
		await controller.publish();
		expect(peer().magpie?.displayName).toBe("My Router");
	});

	it("refuses to publish an empty catalog", async () => {
		const { ctx, writes } = fakeContext(serve({ models: { status: 200, body: { object: "list", data: [] } } }));
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(await controller.publish()).toBe(false);
		expect(writes).toHaveLength(0);
		expect(controller.getState().messageKey).toBe("error.emptyModels");
	});

	it("disconnect clears the provider", async () => {
		const { ctx, peer } = fakeContext(serve());
		const controller = new GatewayController(ctx);
		await controller.refresh();
		await controller.publish();
		await controller.disconnect();
		expect(peer()).toEqual({});
		expect(controller.getState().publishedCount).toBeUndefined();
	});
});

describe("GatewayController settings", () => {
	it("normalizes and persists the endpoint, then re-probes", async () => {
		const seen: string[] = [];
		const { ctx, files } = fakeContext((url) => {
			seen.push(url);
			if (url.endsWith("/api/version")) return { status: 200, body: { version: "0.2.0" } };
			return { status: 200, body: ONLINE_MODELS };
		});
		const controller = new GatewayController(ctx);
		await controller.updateSettings({ baseUrl: " http://127.0.0.1:4000/ ", apiKey: " k " });

		expect(controller.getSettings()).toEqual({ baseUrl: "http://127.0.0.1:4000", apiKey: "k" });
		expect(seen[0]).toBe("http://127.0.0.1:4000/api/version");
		expect(JSON.parse(files.get("settings.json") ?? "{}")).toEqual({ baseUrl: "http://127.0.0.1:4000", apiKey: "k" });
	});

	it("opens magpie's own page rather than a private copy", async () => {
		const { ctx, opened } = fakeContext(serve());
		const controller = new GatewayController(ctx);
		await controller.openConsole();
		expect(opened).toEqual(["http://127.0.0.1:3430"]);
	});

	it("hydrate only probes once and never writes the registry", async () => {
		const { ctx, writes } = fakeContext(serve());
		const controller = new GatewayController(ctx);
		await controller.hydrate();
		expect(controller.getState().phase).toBe("online");
		expect(writes).toHaveLength(0);
	});

	it("notifies once per failed publish and does not throw", async () => {
		const { ctx } = fakeContext(serve());
		const replace = vi.spyOn(ctx.models, "replaceOwnedProviders").mockRejectedValueOnce(new Error("host said no"));
		const controller = new GatewayController(ctx);
		await controller.refresh();
		await expect(controller.publish()).resolves.toBe(false);
		expect(controller.getState().messageKey).toBe("error.syncFailed");
		replace.mockRestore();
	});
});
