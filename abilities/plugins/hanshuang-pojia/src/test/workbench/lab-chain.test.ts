import { describe, expect, it } from "vitest";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import { LAB_STATE_PATH } from "../../features/workbench/hooks/use-lab";
import { SYSTEM_PROMPT_BLOCK_ID } from "../../domain/system-prompt.generated";
import { registerRuntimeContributions } from "../../runtime/contributions";

/**
 * lab 链路的**失效面**测试。
 *
 * 这一组不测「口令怎么解析」（那是 `runtime.test.ts` 的 labAfter / parseLabCommand），
 * 只测一件事：用户说了 `lab：` 之后，模型下一轮还能不能拿到作战契约。
 *
 * 三种会让链路静默断掉的情形，都在真实使用里出现过：
 *   1. 存储读失败 → 旧实现回退成 OFF，用户已开的环境下一轮消失；
 *   2. 存储写失败 → 口令只对这一轮有效，下一轮又回到普通问答；
 *   3. 同一轮里口令与任务写在一起 → `lab：` 混进目标提取，第一条命令指错对象。
 */

interface Harness {
	ctx: PluginContext;
	hooks: Array<{ eventName?: string; handler: (input: unknown) => Promise<unknown> }>;
	providers: Array<{ handler: (context?: unknown) => Promise<unknown> }>;
	files: Map<string, string>;
	/** 让存储按需要失败：读失败必须表现为「还开着」，不是「关掉」。 */
	breakRead(on: boolean): void;
	breakWrite(on: boolean): void;
}

function makeHarness(): Harness {
	const files = new Map<string, string>();
	let readBroken = false;
	let writeBroken = false;
	const hooks: Harness["hooks"] = [];
	const providers: Harness["providers"] = [];
	const storage = {
		list: async () => [...files.keys()],
		readFile: async (path: string) => {
			if (readBroken) throw new Error("storage read denied");
			return files.get(path) ?? null;
		},
		writeFile: async (path: string, data: string) => {
			if (writeBroken) throw new Error("storage write denied");
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
	return {
		ctx: { storage, agent } as unknown as PluginContext,
		hooks,
		providers,
		files,
		breakRead: on => {
			readBroken = on;
		},
		breakWrite: on => {
			writeBroken = on;
		},
	};
}

function hook(harness: Harness, eventName: string): Harness["hooks"][number] {
	const found = harness.hooks.find(candidate => candidate.eventName === eventName);
	if (!found) throw new Error(`missing ${eventName} hook`);
	return found;
}

async function blockIds(harness: Harness): Promise<string[]> {
	const operations = (await harness.providers[0].handler({})) as Array<{ block: { id: string } }>;
	return operations.map(operation => operation.block.id);
}

describe("lab chain survives storage failures", () => {
	it("keeps the contract on when the state file cannot be read", async () => {
		const harness = makeHarness();
		registerRuntimeContributions(harness.ctx);
		harness.breakRead(true);

		// 读失败 + 从未开过：只能是关闭，不能凭空打开。
		expect(await blockIds(harness)).toHaveLength(1);

		// 用户说了一次 lab：即使是写失败也要让本会话记住。
		harness.breakWrite(true);
		await hook(harness, "UserPromptSubmit").handler({ event: { prompt: "lab：" } });

		const ids = await blockIds(harness);
		expect(ids).toContain(SYSTEM_PROMPT_BLOCK_ID);
	});

	it("keeps a lab entered earlier even after the state file disappears", async () => {
		const harness = makeHarness();
		harness.files.set(LAB_STATE_PATH, JSON.stringify({ enabled: true, since: "2026-10-23T00:00:00.000Z" }));
		registerRuntimeContributions(harness.ctx);
		expect(await blockIds(harness)).toContain(SYSTEM_PROMPT_BLOCK_ID);

		// 宿主的存储被清理 / 路径重建：文件不在了，但本会话没退出过环境。
		harness.files.clear();
		expect(await blockIds(harness)).toContain(SYSTEM_PROMPT_BLOCK_ID);
	});

	it("still answers with contexts when the write fails mid-command", async () => {
		const harness = makeHarness();
		registerRuntimeContributions(harness.ctx);
		harness.breakWrite(true);

		const result = (await hook(harness, "UserPromptSubmit").handler({
			event: { prompt: "lab：逆向 sample.apk 的会员校验" },
		})) as { additionalContexts?: string[] };
		const joined = (result.additionalContexts ?? []).join("\n\n");

		expect(joined).toContain("Lab mode is now ON");
		// 同一轮就得能干活：口令后面那段必须已经过改写，而不是等下一轮。
		expect(joined).toContain("sample.apk");
		expect(joined).not.toContain("lab：逆向"); // 口令本身不进目标提取
	});

	it("keeps two harnesses independent", async () => {
		const first = makeHarness();
		registerRuntimeContributions(first.ctx);
		await hook(first, "UserPromptSubmit").handler({ event: { prompt: "lab：" } });

		const second = makeHarness();
		registerRuntimeContributions(second.ctx);
		// 缓存按 storage 实例隔离：一个会话开的环境不得漏到另一个。
		expect(await blockIds(second)).toHaveLength(1);
	});
});
