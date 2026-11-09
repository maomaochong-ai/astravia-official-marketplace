import type { PluginNetworkApi } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { DEFAULT_GATEWAY_KEY, type MagpieSettings } from "../src/gateway-endpoint";
import { loadModels, probeGateway } from "../src/gateway-client";
import { toModelDefinitions } from "../src/model-catalog";

/**
 * 真实网关联调（默认跳过）。
 *
 * 单元测试用的是假 ctx，只能证明「按假响应推进状态」；这个文件证明「按真 magpie
 * 的响应推进状态」。两者都要，缺一个都可能把契约写错。
 *
 *   MAGPIE_LIVE=http://127.0.0.1:3499 npx vitest run test/live-gateway.test.ts
 *
 * 前提：本机有一个真 magpie 在跑（`magpie serve`，MAGPIE_ADDR 指到这里的端口）。
 */

const BASE = process.env.MAGPIE_LIVE ?? "";
const settings: MagpieSettings = { baseUrl: BASE, apiKey: DEFAULT_GATEWAY_KEY };

/** 把宿主 ctx.network 的四个参数映射到 fetch；只为联调存在。 */
function realNetwork(): PluginNetworkApi {
	return {
		request: async (request: Parameters<PluginNetworkApi["request"]>[0]) => {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 15_000);
			try {
				const response = await fetch(request.url, {
					method: request.method ?? "GET",
					headers: request.headers,
					signal: controller.signal,
				});
				const body =
					request.responseType === "text" ? await response.text() : await response.json().catch(() => null);
				return {
					ok: response.ok,
					status: response.status,
					statusText: response.statusText,
					headers: Object.fromEntries(response.headers),
					body,
				};
			} finally {
				clearTimeout(timer);
			}
		},
	} as unknown as PluginNetworkApi;
}

describe.skipIf(!BASE)("live magpie gateway", () => {
	it("identifies itself and answers the version probe", async () => {
		const probe = await probeGateway(realNetwork(), settings);
		expect(probe.ok).toBe(true);
		expect(probe.ok ? probe.version?.length : 0).toBeGreaterThan(0);
	});

	it("returns an OpenAI-shaped catalog the mapper can read", async () => {
		const list = await loadModels(realNetwork(), settings);
		// 没接任何提供方时目录就是空的 —— 空目录也是合法答案，不能当失败。
		expect(list.ok).toBe(true);
		if (list.ok) expect(Array.isArray(list.rows)).toBe(true);
	});

	it("maps a real catalog row into a provider definition", async () => {
		const list = await loadModels(realNetwork(), settings);
		// 目录为空时没有可映射的行；这不是失败，跳过就好。
		if (!list.ok || list.rows.length === 0) return;
		const [definition] = toModelDefinitions(list.rows);
		expect(definition).toMatchObject({ id: list.rows[0].id, api: "openai-completions" });
		expect(definition.name).toBe(list.rows[0].name);
	});

	it("does not call a plain Ollama-compatible service magpie", async () => {
		// 同一台机器的另一个端口上如果只有 `{ "version": "0.12.6" }`，身份探针必须 404。
		const elsewhere = process.env.MAGPIE_LOOKALIKE;
		if (!elsewhere) return;
		const probe = await probeGateway(realNetwork(), { baseUrl: elsewhere, apiKey: DEFAULT_GATEWAY_KEY });
		expect(probe).toMatchObject({ ok: false, failure: "not-magpie" });
	});
});
