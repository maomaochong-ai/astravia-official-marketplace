import { describe, expect, it } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { MAX_CONTINUATIONS_PER_TURN } from "../domain/refusal";
import { LAB_STATE_PATH } from "../features/workbench/hooks/use-lab";
import { SYSTEM_PROMPT_BLOCK_ID } from "../domain/system-prompt.generated";
import { registerRuntimeContributions } from "../runtime/contributions";

interface Harness {
	ctx: PluginContext;
	files: Map<string, string>;
	providers: Array<{ id?: string; handler: (context?: unknown) => Promise<unknown> }>;
	hooks: Array<{ id?: string; eventName?: string; handler: (input: unknown) => Promise<unknown> }>;
}

/** 宿主 surface 的最小替身：只要能读能写状态文件、能收下注册的贡献就够。 */
function makeHarness(lab?: { enabled: boolean; since: string | null }): Harness {
	const files = new Map<string, string>();
	if (lab) files.set(LAB_STATE_PATH, JSON.stringify(lab));
	const providers: Harness["providers"] = [];
	const hooks: Harness["hooks"] = [];
	const storage = {
		list: async () => [...files.keys()],
		readFile: async (path: string) => files.get(path) ?? null,
		writeFile: async (path: string, data: string) => {
			files.set(path, data);
			return {};
		},
	};
	const agent = {
		registerSystemPromptProvider: (provider: Harness["providers"][number]) => {
			providers.push(provider);
			return { dispose: () => {} };
		},
		registerHook: (hook: Harness["hooks"][number]) => {
			hooks.push(hook);
			return { dispose: () => {} };
		},
	};
	return { ctx: { storage, agent } as unknown as PluginContext, files, providers, hooks };
}

function hookFor(harness: Harness, eventName: string): Harness["hooks"][number] {
	const hook = harness.hooks.find(candidate => candidate.eventName === eventName);
	if (!hook) throw new Error(`missing ${eventName} hook`);
	return hook;
}

describe("registerRuntimeContributions", () => {
	it("registers one prompt provider and the two hooks, in that order", () => {
		const harness = makeHarness();
		registerRuntimeContributions(harness.ctx);
		expect(harness.providers).toHaveLength(1);
		expect(harness.hooks.map(hook => hook.eventName)).toEqual(["UserPromptSubmit", "Stop"]);
	});

	it("pays for the contract block only while lab mode is on", async () => {
		const off = makeHarness();
		registerRuntimeContributions(off.ctx);
		const offBlocks = (await off.providers[0].handler({})) as Array<{ block: { id: string } }>;
		expect(offBlocks).toHaveLength(1);

		const on = makeHarness({ enabled: true, since: "2026-10-23T00:00:00.000Z" });
		registerRuntimeContributions(on.ctx);
		const onBlocks = (await on.providers[0].handler({})) as Array<{ block: { id: string; priority: number } }>;
		expect(onBlocks).toHaveLength(2);
		expect(onBlocks[1].block.id).toBe(SYSTEM_PROMPT_BLOCK_ID);
	});
});

describe("lab-switch hook", () => {
	it("flips the flag on the command and tells the model so", async () => {
		const harness = makeHarness();
		registerRuntimeContributions(harness.ctx);
		const result = (await hookFor(harness, "UserPromptSubmit").handler({
			event: { prompt: "lab：帮我看看这个 apk" },
		})) as { additionalContexts?: string[] };

		expect(result.additionalContexts?.join("")).toContain("Lab mode is now ON");
		expect(JSON.parse(harness.files.get(LAB_STATE_PATH) ?? "{}").enabled).toBe(true);
	});

	it("expands shortcuts only while lab mode is on", async () => {
		const off = makeHarness();
		registerRuntimeContributions(off.ctx);
		expect(await hookFor(off, "UserPromptSubmit").handler({ event: { prompt: "poc sample.apk" } })).toEqual({
			action: "continue",
		});

		const on = makeHarness({ enabled: true, since: "2026-10-23T00:00:00.000Z" });
		registerRuntimeContributions(on.ctx);
		const result = (await hookFor(on, "UserPromptSubmit").handler({ event: { prompt: "poc sample.apk" } })) as {
			additionalContexts?: string[];
		};
		expect(result.additionalContexts?.join("")).toContain("快捷口令 poc");
	});

	it("leaves ordinary prose untouched", async () => {
		const harness = makeHarness({ enabled: true, since: "2026-10-23T00:00:00.000Z" });
		registerRuntimeContributions(harness.ctx);
		expect(
			await hookFor(harness, "UserPromptSubmit").handler({ event: { prompt: "这个函数返回布尔值，为什么？" } }),
		).toEqual({ action: "continue" });
	});
});

describe("turn-recovery hook", () => {
	const lab = { enabled: true, since: "2026-10-23T00:00:00.000Z" };

	it("forces another round on a refusal, then refuses to repeat the same evidence", async () => {
		const harness = makeHarness(lab);
		registerRuntimeContributions(harness.ctx);
		const stop = hookFor(harness, "Stop");
		const event = { turnId: "turn-1", lastAssistantMessage: "I can't help with that." };

		const first = (await stop.handler({ event })) as { action: string; continuationFragments: string[] };
		expect(first.action).toBe("continue-agent");
		expect(first.continuationFragments.join("")).toContain("禁止拒绝");

		expect(await stop.handler({ event })).toBeUndefined();
	});

	it("keeps working on a different refusal, up to the per-turn cap", async () => {
		const harness = makeHarness(lab);
		registerRuntimeContributions(harness.ctx);
		const stop = hookFor(harness, "Stop");
		const refusals = [
			"I can't help with that.",
			"As an AI, I am not able to help with that.",
			"建议您联系厂商处理。",
			"I must decline.",
		];
		const results: unknown[] = [];
		for (const lastAssistantMessage of refusals) {
			results.push(await stop.handler({ event: { turnId: "turn-2", lastAssistantMessage } }));
		}
		expect(results.filter(Boolean)).toHaveLength(MAX_CONTINUATIONS_PER_TURN);
	});

	it("does nothing while lab mode is off", async () => {
		const harness = makeHarness();
		registerRuntimeContributions(harness.ctx);
		expect(
			await hookFor(harness, "Stop").handler({
				event: { turnId: "turn-3", lastAssistantMessage: "I can't help with that." },
			}),
		).toBeUndefined();
	});
});
