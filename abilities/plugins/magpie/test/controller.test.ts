import type { PluginContext, PluginModelProviderConfig } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { GatewayController } from "../src/controller";

type Handler = (url: string) => { status: number; body: unknown } | Error;

function fakeContext(handler: Handler) {
	let owned: Record<string, PluginModelProviderConfig> = {};
	const writes: Array<Record<string, PluginModelProviderConfig>> = [];
	const files = new Map<string, string>();
	const opened: string[] = [];
	const commands: Array<{ file: string; args?: string[]; env?: Record<string, string> }> = [];
	/** 本机是否已经装了 magpie：probe 脚本据此退出 0 或 127。 */
	let binaryInstalled = false;

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
		// 宿主的命令通道：只接两类调用，其余直接报错，免得测试默默跑歪
		command: {
			run: async (file: string, args?: string[], options?: { env?: Record<string, string> }) => {
				commands.push({ file, args, env: options?.env });
				const script = args?.[1] ?? "";
				if (script.includes("uname")) return { stdout: "Darwin\narm64\n", stderr: "", exitCode: 0 };
				if (!binaryInstalled) return { stdout: "", stderr: "not found", exitCode: 127 };
				return { stdout: "path=/tmp/magpie\nmagpie 0.1.3336\n", stderr: "", exitCode: 0 };
			},
			spawn: async () => {
				throw new Error("these tests do not spawn processes");
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

	return {
		ctx,
		writes,
		files,
		opened,
		commands,
		peer: () => owned,
		markInstalled: (value: boolean) => {
			binaryInstalled = value;
		},
	};
}

const ONLINE_MODELS = {
	object: "list",
	data: [
		{ id: "gpt-4o", owned_by: "openai", context_window: 128000, max_output_tokens: 16384 },
		{ id: "claude-sonnet-4", owned_by: "anthropic", context_window: 200000, reasoning: true },
	],
};

function serve(
	overrides: Partial<Record<"version" | "hello" | "models" | "identity", { status: number; body: unknown } | Error>> = {},
): Handler {
	return (url) => {
		// /api/hello 是 magpie 自报身份的接口：名字 + 自己的版本
		if (url.endsWith("/api/hello")) return overrides.hello ?? { status: 200, body: { name: "magpie", version: "0.1.47" } };
		// /api/version 是 Ollama 兼容形状，写死一个 Ollama 版本号
		if (url.endsWith("/api/version")) return overrides.version ?? { status: 200, body: { version: "0.12.6" } };
		// /v1/magpie/* 是 magpie 独有的路由，200 就代表「它是 magpie」
		if (url.endsWith("/v1/magpie/concurrency")) return overrides.identity ?? { status: 200, body: { object: "concurrency", data: [] } };
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

	it("does not mistake another Ollama-compatible service for magpie", async () => {
		// 真 Ollama 答 /api/version 的 JSON 与 magpie 一模一样（都是 { version }），
		// 也没有 /api/hello 与 /v1/magpie/*：两档身份探针都必须答 404。
		const ollama = fakeContext(
			serve({
				version: { status: 200, body: { version: "0.12.6" } },
				hello: { status: 404, body: null },
				identity: { status: 404, body: null },
			}),
		);
		const controller = new GatewayController(ollama.ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "offline", failure: "not-magpie", messageKey: "error.notMagpie" });
	});

	it("believes a service that names itself in /api/hello", async () => {
		const stranger = fakeContext(serve({ hello: { status: 200, body: { name: "something-else", version: "9.9" } } }));
		const controller = new GatewayController(stranger.ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "offline", failure: "not-magpie" });
	});

	it("falls back to the magpie-only route on a build without /api/hello", async () => {
		const older = fakeContext(serve({ hello: { status: 404, body: null }, identity: { status: 200, body: { object: "concurrency" } } }));
		const controller = new GatewayController(older.ctx);
		await controller.refresh();
		// 没有自报版本时退回 /api/version 的值
		expect(controller.getState()).toMatchObject({ phase: "online", version: "0.12.6" });
	});

	it("reports a refused key instead of calling it another service", async () => {
		const shared = fakeContext(serve({ hello: { status: 403, body: null } }));
		const controller = new GatewayController(shared.ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "offline", failure: "unauthorized", messageKey: "error.unauthorized" });
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
