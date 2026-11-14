import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 「在 A 会话启用插件，切到 B 会话，面板还画着 A 的东西」——1.0.7 的根因在**服务**，不在前端缓存。
 *
 * 一个服务进程只有一个 `Sandbox`，而台账键原来是 `sandbox.status().sessionId`：
 *  1. A 会话开了沙箱；
 *  2. B 会话里 agent 调 `strix_file_finding` → 写进 **A 的台账**；
 *  3. B 的面板从 `/api/state` 读到 A 的容器与会话 id。
 *
 * 现在：面板用 `POST /api/conversation` 声明当前会话，台账键与状态归属都取它；
 * `/api/state` 也回报 `conversation`，面板对不上就不画。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const main = read("src/service/main.ts");
const sandbox = read("src/service/sandbox.ts");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const client = read("src/domain/bridge-client.ts");

describe("the service keys its ledgers by conversation", () => {
	it("prefers the sandbox owner, then the registered conversation, then the sandbox id", () => {
		const fn = /function sessionId\(\): string \{([\s\S]*?)\n\}/.exec(main)?.[1] ?? "";
		// 顺序即优先级：评估在跑的时候，操作者切到别的会话看，不代表命令该写进新台账。
		const owner = fn.indexOf("status.conversation");
		const registered = fn.indexOf("activeConversation");
		const sandboxId = fn.indexOf("status.sessionId");
		expect(owner).toBeGreaterThan(-1);
		expect(owner).toBeLessThan(registered);
		expect(registered).toBeLessThan(sandboxId);
	});

	it("records the owner when the sandbox starts", () => {
		expect(main).toContain("conversation: activeConversation");
	});

	it("takes that registration from the panel", () => {
		expect(main).toContain('"/api/conversation"');
		expect(main).toContain("activeConversation = id || null");
	});

	it("reports the ledger key, and leaves ownership to the sandbox", () => {
		// 顶层字段曾用来判定归属，但那等于“拿刚注册的 id 跟自己比”，永远相等（1.0.7 审查）。
		expect(main).toMatch(/conversationKey: sessionId\(\)/);
	});

	it("records who started the sandbox, since there is only one", () => {
		expect(sandbox).toContain("conversation?: string | null;");
		expect(sandbox).toMatch(/this\.conversation = typeof params\.conversation/);
		expect(sandbox).toContain("conversation: this.conversation,");
	});
});

describe("the panel refuses state that belongs to another conversation", () => {
	it("declares its conversation before every read", () => {
		expect(client).toContain("setConversation(conversationId");
		expect(client).toContain("/api/conversation");
		// 声明必须排在 state() 之前：否则这一次读到的还是上一个会话的归属。
		const refresh = /const refresh = useCallback\(([\s\S]*?)\n\t\)/.exec(hook)?.[1] ?? "";
		expect(refresh.indexOf("setConversation")).toBeGreaterThan(-1);
		expect(refresh.indexOf("setConversation")).toBeLessThan(refresh.indexOf("await client.state()"));
	});

	it("drops a foreign payload instead of painting it", () => {
		// 判据是**沙箱的主人**，不是顶层回显：后者就是面板刚 POST 的 id。
		expect(hook).toMatch(/const owner = \(state\?\.sandbox as \{ conversation\?: unknown \} \| undefined\)\?\.conversation;/);
		expect(hook).toMatch(/const foreign = typeof owner === "string" && owner !== mine;/);
		// 环境探测是全局事实，可以采纳；沙箱 / 台账一律不采纳。
		expect(hook).toMatch(/if \(foreign\) \{[\s\S]{0,200}setEnvironment\([\s\S]{0,80}return;/);
	});
});

describe("the panel rebinds when the host switches conversation", () => {
	it("re-reads the snapshot of the new conversation", () => {
		expect(hook).toContain("const boundTo = useRef<string | null | undefined>");
		expect(hook).toMatch(/if \(!id \|\| id === boundTo\.current\) return;/);
		expect(hook).toMatch(/mountedIn\.current = id;/);
		expect(hook).toContain("const snapshot = readSnapshot(id);");
	});

	it("resets the per-conversation counters so ids cannot collide", () => {
		expect(hook).toContain("turnRef.current = 0;");
		expect(hook).toContain("launchPinned.current = false;");
		expect(hook).toMatch(/seq\.current = \(snapshot\?\.trace \?\? \[\]\)\.reduce/);
	});
});
