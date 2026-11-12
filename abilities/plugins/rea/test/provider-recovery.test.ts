import type { PluginCliProviderStatus, PluginContext } from "@astravia-org/plugin-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateProviderRecovery } from "../src/features/rea-workflow/live/provider-recovery";
import { ReaLiveStore } from "../src/features/rea-workflow/live/session-store";

/**
 * 引擎自愈的对外表现：什么时候该说话，说什么话。
 *
 * 装完插件什么都没做，右下角先飘一条「REA 引擎仍不可用」并带「复制堆栈」，用户读到的
 * 是「这插件坏了」——而那一刻的事实只是引擎还没装。这几条钉的是边界：
 *
 * - 用户没调用过 REA：一个字都不说。面板自带引擎状态，不需要抢戏。
 * - 调用过、且重试用尽：一条可行动的提示，**不制造堆栈**（`error` 参数会让宿主挂上
 *   「复制堆栈」并让 Toast 永不消失）。
 * - 文案里的 `{{message}}` 必须真的插值，否则用户看到的是模板本身。
 * - 恢复报一次就够，且要能自己消失。
 */

const PROVIDER_ID = "rea-agents";

const CATALOG: Record<string, string> = {
	"live.engine.exhaustedTitle": "REA 引擎没跑起来",
	"live.engine.exhausted": "自动重试 3 次都没能把引擎拉起来（{{message}}）。",
	"live.engine.recovered": "REA 引擎已恢复——分析工具可以用了",
};

interface Notified {
	readonly variant?: string;
	readonly title?: string;
	readonly message: string;
	readonly error?: unknown;
	readonly durationMs?: number;
}

interface Harness {
	readonly ctx: PluginContext;
	readonly store: ReaLiveStore;
	readonly notified: Notified[];
	/** 让 provider 报告一个新阶段。 */
	report(status: Partial<PluginCliProviderStatus> & { phase: PluginCliProviderStatus["phase"] }): void;
}

function harness(): Harness {
	const notified: Notified[] = [];
	let listener: ((status: PluginCliProviderStatus) => void) | null = null;
	let latest: PluginCliProviderStatus = { providerId: PROVIDER_ID, phase: "checking", recentOutput: "" };

	const ctx = {
		ui: {
			notify: (options: Notified) => {
				notified.push(options);
			},
		},
		i18n: {
			locale: "zh",
			t: (key: string, params?: Record<string, string | number>) =>
				(CATALOG[key] ?? key).replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
					params && name in params ? String(params[name]) : match,
				),
		},
		cliProviders: {
			getStatus: async () => latest,
			onStatusChanged: (next: (status: PluginCliProviderStatus) => void) => {
				listener = next;
				return { dispose: () => { listener = null; } };
			},
			retry: async () => {},
		},
	} as unknown as PluginContext;

	return {
		ctx,
		store: new ReaLiveStore(),
		notified,
		report: (status) => {
			latest = { providerId: PROVIDER_ID, recentOutput: "", ...status } as PluginCliProviderStatus;
			listener?.(latest);
		},
	};
}

const REASON = "npx: cannot resolve rea-agents";

/**
 * 把引擎弄坏并跑完三档重试。真实宿主每重试一次会再报一次 `failed`，这里照做：
 * 不发新状态就只重试一次，自愈永远走不到「用尽」。
 */
async function exhaust(h: Harness): Promise<void> {
	for (let round = 0; round < 4; round += 1) {
		h.report({ phase: "failed", message: REASON });
		await vi.runAllTimersAsync();
	}
}

describe("引擎自愈的对外表现", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("用户还没让 REA 干过任何事：装完不弹任何提示", async () => {
		const h = harness();
		const handle = activateProviderRecovery(h.ctx, h.store, PROVIDER_ID, { delaysMs: [0, 0, 0] });
		await vi.runAllTimersAsync();
		await exhaust(h);
		await vi.runAllTimersAsync();

		expect(h.notified).toEqual([]);
		handle.dispose();
	});

	it("本会话调用过并耗尽重试：一条 warning，不带堆栈，能自己消失", async () => {
		const h = harness();
		h.store.ingest({ type: "tool-call-start", toolName: "rea_targets", toolCallId: "c1" } as never);
		const handle = activateProviderRecovery(h.ctx, h.store, PROVIDER_ID, { delaysMs: [0, 0, 0] });
		await exhaust(h);
		await vi.runAllTimersAsync();

		expect(h.notified).toHaveLength(1);
		const [only] = h.notified;
		expect(only?.variant).toBe("warning");
		expect(only?.error, "制造一个 Error 只会给用户一个「复制堆栈」按钮").toBeUndefined();
		expect(only?.message).toContain("npx: cannot resolve rea-agents");
		expect(only?.message).not.toContain("{{");
		handle.dispose();
	});

	it("同一次故障只报一遍，不在每次状态推送后重弹", async () => {
		const h = harness();
		h.store.ingest({ type: "tool-call-start", toolName: "rea_targets", toolCallId: "c1" } as never);
		const handle = activateProviderRecovery(h.ctx, h.store, PROVIDER_ID, { delaysMs: [0, 0, 0] });
		await exhaust(h);
		await vi.runAllTimersAsync();
		h.report({ phase: "failed", message: "still failing" });
		h.report({ phase: "failed", message: "still failing" });
		await vi.runAllTimersAsync();

		expect(h.notified).toHaveLength(1);
		handle.dispose();
	});

	it("恢复只报一次成功，并自动消失", async () => {
		const h = harness();
		h.store.ingest({ type: "tool-call-start", toolName: "rea_targets", toolCallId: "c1" } as never);
		const handle = activateProviderRecovery(h.ctx, h.store, PROVIDER_ID, { delaysMs: [0, 0, 0] });
		await exhaust(h);
		await vi.runAllTimersAsync();
		h.report({ phase: "ready" });
		h.report({ phase: "ready" });

		const successes = h.notified.filter((entry) => entry.variant === "success");
		expect(successes).toHaveLength(1);
		expect(successes[0]?.durationMs).toBeGreaterThan(0);
		handle.dispose();
	});
});
