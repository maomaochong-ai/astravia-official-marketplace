import type { PluginContext, PluginModelProviderConfig } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { GatewayController } from "../src/controller";

type Reply = { status: number; body: unknown } | Error;

/** 只服务 magpie 的四条路由；`models` 由调用方按需改变。 */
function fakeContext(getModels: () => Reply) {
	let owned: Record<string, PluginModelProviderConfig> = {};
	const writes: Array<Record<string, PluginModelProviderConfig>> = [];
	let modelCalls = 0;

	const ctx = {
		network: {
			request: async (request: { url: string }) => {
				let reply: Reply;
				if (request.url.endsWith("/api/hello")) reply = { status: 200, body: { name: "magpie", version: "0.1.4138" } };
				else if (request.url.endsWith("/api/version")) reply = { status: 200, body: { version: "0.12.6" } };
				else if (request.url.endsWith("/v1/magpie/concurrency")) reply = { status: 200, body: { data: [] } };
				else if (request.url.endsWith("/v1/models")) {
					modelCalls += 1;
					reply = getModels();
				} else throw new Error(`unexpected url ${request.url}`);
				if (reply instanceof Error) throw reply;
				return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, statusText: "", headers: {}, body: reply.body };
			},
		},
		models: {
			listOwnedProviders: async () => owned,
			replaceOwnedProviders: async (next: Record<string, PluginModelProviderConfig>) => {
				owned = next;
				writes.push(next);
			},
		},
		storage: { readFile: async () => null, writeFile: async () => ({ revision: "1" }) },
		command: { run: async () => ({ stdout: "uname: Darwin\narm64\n", stderr: "", exitCode: 0 }), spawn: async () => ({}) },
		ui: { setWorkspaceViewBadge: () => ({ dispose() {} }), openExternal: async () => undefined, notify: () => undefined },
		i18n: { t: (key: string) => key, locale: "en", onChange: () => ({ dispose() {} }) },
	} as unknown as PluginContext;

	return { ctx, writes, peer: () => owned, modelCalls: () => modelCalls };
}

const EMPTY = { status: 200, body: { object: "list", data: [], has_more: false } };
const ONE = {
	status: 200,
	body: { object: "list", has_more: false, data: [{ id: "gpt-4o", owned_by: "openai", context_window: 128000 }] },
};

describe("发布前核对目录（不在旧快照上判空）", () => {
	it("快照是空的、网关此刻已经有模型：发布应当成功", async () => {
		let models: Reply = EMPTY;
		const { ctx, writes, peer } = fakeContext(() => models);
		const controller = new GatewayController(ctx);

		// 第一次探测：网关还没加提供方 → 面板快照为空。
		await controller.refresh();
		expect(controller.getState().rows).toHaveLength(0);

		// 用户在 magpie 里加了提供方，但没点「重新检测」就点了发布。
		models = ONE;
		expect(await controller.publish()).toBe(true);
		expect(writes).toHaveLength(1);
		expect(peer().magpie?.models?.map((model) => model.id)).toEqual(["gpt-4o"]);
		expect(controller.getState().messageKey).toBeUndefined();
	});

	it("网关真的离线：保留「连不上」这条原因，不盖成目录为空", async () => {
		const offline = Object.assign(new Error("down"), { reason: "transport-failed" });
		const { ctx } = fakeContext(() => offline);
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(await controller.publish()).toBe(false);
		expect(controller.getState().messageKey).toBe("error.unreachable");
	});

	it("目录读取失败：保留 HTTP 错误，不盖成目录为空", async () => {
		const { ctx } = fakeContext(() => ({ status: 500, body: null }));
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(await controller.publish()).toBe(false);
		expect(controller.getState().messageKey).toBe("error.http");
	});
});

describe("分页信号 has_more", () => {
	it("目录被截断时记下来，而不是假装完整", async () => {
		const truncated = {
			status: 200,
			body: { object: "list", has_more: true, data: [{ id: "a", owned_by: "openai" }] },
		};
		const { ctx } = fakeContext(() => truncated);
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ phase: "online", catalogPartial: true });
		expect(controller.getState().summary.total).toBe(1);
	});

	it("完整目录不带这个标记", async () => {
		const { ctx } = fakeContext(() => ONE);
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(controller.getState().catalogPartial).toBe(false);
	});
});

describe("探测单飞", () => {
	it("并发调用共享同一次请求，而不是后来的那个静默跳过", async () => {
		const { ctx, modelCalls } = fakeContext(() => ONE);
		const controller = new GatewayController(ctx);
		await Promise.all([controller.refresh(), controller.refresh(), controller.refresh()]);
		expect(modelCalls()).toBe(1);
		expect(controller.getState().summary.total).toBe(1);
	});
});
