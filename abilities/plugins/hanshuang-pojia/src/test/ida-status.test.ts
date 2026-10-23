import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { describe, expect, it } from "vitest";
import { registerIdaStatusTool } from "../tools/ida-status";

interface HarnessOptions {
	fetchGranted?: boolean;
	network?: boolean;
	request?: () => Promise<{ status: number; statusText: string; ok: boolean; headers: Record<string, string>; body: string }>;
}

function harness(options: HarnessOptions = {}) {
	// 用属性容器而不是局部变量：注册回调内部的赋值不会被 TS 的控制流分析看到，
	// 局部变量会在 `if (!run) throw` 之后被窄化成 never。
	const box: { run: (() => Promise<string>) | null } = { run: null };
	const ctx = {
		permissions: { has: (permission: string) => (options.fetchGranted ?? true) && permission === "network.fetch" },
		network:
			options.network === false
				? undefined
				: {
						request:
							options.request ??
							(async () => ({ status: 405, statusText: "Method Not Allowed", ok: false, headers: {}, body: "" })),
					},
		agent: {
			registerTool: (definition: { handler: (context: unknown) => Promise<string> }): Disposable => {
				box.run = () => definition.handler({ trigger: { input: {} } });
				return { dispose: () => undefined };
			},
		},
	} as unknown as PluginContext;
	registerIdaStatusTool(ctx);
	if (!box.run) throw new Error("ida_status was not registered");
	return box.run;
}

describe("ida_status", () => {
	it("calls an answering port online, even when it refuses the GET", async () => {
		const output = await harness()();
		expect(output).toContain("listening on 127.0.0.1:13337");
		expect(output).toContain("HTTP 405");
	});

	it("separates a missing grant from a missing bridge", async () => {
		const output = await harness({ fetchGranted: false })();
		expect(output).toContain("network.fetch");
		// 没授权不是「IDA 没起」的证据，这句必须出现，否则模型会照着自己的猜测下结论。
		expect(output).toContain("not evidence that IDA is missing");
	});

	it("does not call a closed port a missing installation", async () => {
		const output = await harness({
			request: async () => {
				throw new Error("connect ECONNREFUSED 127.0.0.1:13337");
			},
		})();
		expect(output).toContain("nothing answered");
		expect(output).toContain("does not mean IDA is not installed");
		expect(output).toContain("manual/IDA-PRO");
	});

	it("reports a host without the network API instead of pretending to probe", async () => {
		const output = await harness({ network: false })();
		expect(output).toContain("no network API");
		expect(output).not.toContain("nothing answered");
	});
});
