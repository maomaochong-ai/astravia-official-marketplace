import type { PluginContext, PluginModelProviderConfig } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { GatewayController } from "../src/controller";

type Reply = { status: number; body: unknown } | Error;

/**
 * 宿主可配置的写行为：
 * - "ok"      照写
 * - "reject-reasoning" 只要模型里带 reasoningLevels 就整表拒（模拟宿主换了校验）
 * - "always"  永远拒（模拟权限/写盘失败）
 */
function fakeContext(models: Reply, mode: "ok" | "reject-reasoning" | "always" = "ok") {
	let owned: Record<string, PluginModelProviderConfig> = {};
	const writes: Array<Record<string, PluginModelProviderConfig>> = [];
	const stored = new Map<string, string>();

	const ctx = {
		network: {
			request: async (request: { url: string }) => {
				let reply: Reply;
				if (request.url.endsWith("/api/hello")) reply = { status: 200, body: { name: "magpie", version: "0.1.4138" } };
				else if (request.url.endsWith("/api/version")) reply = { status: 200, body: { version: "0.12.6" } };
				else if (request.url.endsWith("/v1/magpie/concurrency")) reply = { status: 200, body: { data: [] } };
				else if (request.url.endsWith("/v1/models")) reply = models;
				else throw new Error(`unexpected url ${request.url}`);
				if (reply instanceof Error) throw reply;
				return { ok: reply.status >= 200 && reply.status < 300, status: reply.status, statusText: "", headers: {}, body: reply.body };
			},
		},
		models: {
			listOwnedProviders: async () => owned,
			replaceOwnedProviders: async (next: Record<string, PluginModelProviderConfig>) => {
				if (mode === "always") throw new Error("Plugin permission denied: models.manage");
				if (mode === "reject-reasoning") {
					const carriesLevels = Object.values(next).some((provider) =>
						(provider.models ?? []).some((model) => (model.reasoningLevels ?? []).length > 0),
					);
					if (carriesLevels) throw new Error("Expected Array<String> at models.0.reasoningLevels");
				}
				owned = next;
				writes.push(next);
			},
		},
		storage: {
			readFile: async () => null,
			writeFile: async (path: string, data: string) => {
				stored.set(path, data);
				return { revision: "1" };
			},
		},
		command: { run: async () => ({ stdout: "uname: Darwin\narm64\n", stderr: "", exitCode: 0 }), spawn: async () => ({}) },
		ui: { setWorkspaceViewBadge: () => ({ dispose() {} }), openExternal: async () => undefined, notify: () => undefined },
		i18n: { t: (key: string, args?: Record<string, unknown>) => `${key}${args ? ` ${JSON.stringify(args)}` : ""}`, locale: "en", onChange: () => ({ dispose() {} }) },
	} as unknown as PluginContext;

	return { ctx, writes, peer: () => owned, stored };
}

const CATALOG = {
	status: 200,
	body: {
		object: "list",
		has_more: false,
		data: [
			{ id: "gpt-4o", owned_by: "openai", context_window: 128000, reasoning_levels: ["low", "high"] },
			{ id: "claude-sonnet-4", owned_by: "anthropic" },
		],
	},
};

describe("发布：宿主拒了完整字段时要退到最小字段，而不是一个都发不出去", () => {
	it("第一次被拒、第二次只写 id/name/api 并说明原因", async () => {
		const { ctx, writes, peer } = fakeContext(CATALOG, "reject-reasoning");
		const controller = new GatewayController(ctx);
		await controller.refresh();

		expect(await controller.publish()).toBe(true);
		expect(writes).toHaveLength(1);
		const published = peer().magpie;
		expect(published?.models?.map((model) => model.id)).toEqual(["claude-sonnet-4", "gpt-4o"]);
		// 最小字段：不带上下文长度与推理档位
		expect(published?.models?.every((model) => model.contextWindow === undefined && model.reasoningLevels === undefined)).toBe(true);
		const state = controller.getState();
		expect(state.messageKey).toBeUndefined();
		expect(state.publishedCount).toBe(2);
		expect(state.notice).toContain("status.publishedMinimal");
	});

	it("两次都失败时把宿主原文留在 state 与磁盘上", async () => {
		const { ctx, writes, stored } = fakeContext(CATALOG, "always");
		const controller = new GatewayController(ctx);
		await controller.refresh();

		expect(await controller.publish()).toBe(false);
		expect(writes).toHaveLength(0);
		const state = controller.getState();
		expect(state.messageKey).toBe("error.syncFailed");
		expect(state.detail).toBe("Plugin permission denied: models.manage");
		const persisted = JSON.parse(stored.get("last-publish-error.json") ?? "{}") as { detail?: string };
		expect(persisted.detail).toBe("Plugin permission denied: models.manage");
	});
});

describe("空目录与「解析失败」分得开", () => {
	it("网关一条都没回：报目录为空", async () => {
		const { ctx } = fakeContext({ status: 200, body: { object: "list", data: [], has_more: false } });
		const controller = new GatewayController(ctx);
		await controller.refresh();
		expect(controller.getState()).toMatchObject({ rows: [], catalogRawCount: 0 });
		expect(await controller.publish()).toBe(false);
		expect(controller.getState().messageKey).toBe("error.emptyModels");
	});

	it("网关回了记录但没有一条认得出：rawCount 保留，界面能说「解析问题」", async () => {
		const { ctx } = fakeContext({ status: 200, body: { object: "list", data: [{ nope: true }, { id: "" }, 7] } });
		const controller = new GatewayController(ctx);
		await controller.refresh();
		const state = controller.getState();
		expect(state.rows).toHaveLength(0);
		expect(state.catalogRawCount).toBe(3);
	});
});
