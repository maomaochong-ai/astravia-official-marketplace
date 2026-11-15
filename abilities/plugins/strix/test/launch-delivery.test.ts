import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

/**
 * 投递与切屏：一句话怎么进宿主对话，面板什么时候跟着离开首屏。
 *
 * 顺序是契约：先发 → 失败才建会话 → 连目录都没有就交给宿主输入框。
 */

describe("the workspace prompt is no longer a false alarm", () => {
	it("asks the host for its open workspace folders", () => {
		// 用户明明打开了目录却被告知"先打开一个工作目录"：会话没有 cwd，而宿主有目录。
		expect(manifest.permissions).toContain("workspace.read");
		expect(index).toContain("getWorkspaceRoots");
	});

	it("falls back to the workspace root before refusing", () => {
		// 两处：发送（deliver）与新建会话（newSession）都必须先兜底。
		const fallbacks = hook.match(/cwdRef\.current \?\? workspaceRoot\?\.\(\) \?\? null/g) ?? [];
		expect(fallbacks.length).toBeGreaterThanOrEqual(1);
		// 兜底也拿不到时不再报「先打开目录」：sender 交给宿主输入框，new-session 回首屏。
		expect(hook).toContain("insertText(value)");
		expect(hook).toContain('note(t("log.newSessionNoFolder"), "ok")');
	});

	it("keeps the message honest when there really is no folder", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		// 1.0.6：不再有「先在宿主里打开一个工作目录」这句话，取而代之的是两条说明——
		// 发送时交给宿主输入框、新建会话时回首屏。
		expect(zh["log.noWorkspace"]).toBeUndefined();
		expect(zh["log.handedToHost"]).toContain("Enter");
		expect(zh["log.newSessionNoFolder"]).toBeTruthy();
	});
});

describe("delivery never blocks on a folder the host already knows", () => {
	const deliver = /const deliver = useCallback\(([\s\S]*?)\n\t\);/.exec(hook)?.[1] ?? "";

	it("tries the host conversation first, before creating anything", () => {
		const send = deliver.indexOf("await sendPrompt(value)");
		const create = deliver.indexOf("await createSession(cwd)");
		expect(send).toBeGreaterThan(-1);
		expect(create).toBeGreaterThan(send);
	});

	it("hands the prompt to the host composer when no folder can be found", () => {
		// 最后一道退路：不报"先打开目录"，而是把话放进宿主输入框。
		expect(deliver).toContain("insertText(value)");
		expect(deliver).toContain('note(t("log.handedToHost"), "ok")');
	});

	it("still reports a real failure, and only after every route", () => {
		// noWorkspace 不再是第一条反应；真正的失败仍然是 sendFailed。
		expect(deliver).toContain('note(t("log.sendFailed"), "error")');
		const noWorkspace = deliver.indexOf("log.noWorkspace");
		expect(noWorkspace).toBe(-1);
	});

	it("has a message that tells the operator what to do next", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["log.handedToHost"]).toContain("Enter");
	});
});

describe("sending leaves the launch screen", () => {
	const turnStart = /if \(event\.type === "turn-start"\) \{([\s\S]*?)\n\t\t\t\treturn;/.exec(hook)?.[1] ?? "";
	const deliver = /const deliver = useCallback\(([\s\S]*?)\n\t\);/.exec(hook)?.[1] ?? "";

	it("follows a turn in this conversation without asking the capsule", () => {
		expect(turnStart).toContain("setShowLaunch(false)");
		expect(turnStart).toContain('setPhase("scanning")');
		// 旧实现要求 isStrixEngaged()：胶囊没开就停在首屏。
		expect(turnStart).not.toMatch(/isStrixEngaged\(\)\s*&&/);
	});

	it("leaves the launch screen on a successful delivery", () => {
		expect(deliver).toContain("setShowLaunch(false)");
		// 用户按的是「开始」，不是「继续看首屏」：pin 一并销掉。
		expect(deliver).toContain("launchPinned.current = false");
	});

	it("still honours an explicit return to the launch screen", () => {
		// 「返回首屏」是按钮，不是推断：它仍然把 pin 立起来。
		const openLaunch = /const openLaunch = useCallback\(([\s\S]*?)\n\t\)/.exec(hook)?.[1] ?? "";
		expect(openLaunch).toContain("launchPinned.current = true");
	});
});

describe("the tab comes to the front because a turn started", () => {
	const activation = /activate\(ctx: PluginContext\)([\s\S]*?)\n\t\},\n\}\);/.exec(index)?.[1] ?? "";

	it("subscribes to conversation events during activation, not from the panel", () => {
		expect(activation).toContain("ctx.conversation.on(");
		expect(activation).toContain('event.type !== "turn-start"');
	});

	it("brings the tab up on the host's turn-start", () => {
		expect(activation).toContain("setActivityTabVisible(TAB_ID, true)");
		expect(activation).toContain('openActivityTab(TAB_ID, { width: "max" })');
	});

	it("by conversation shape: capsule in a single chat, always in a team chat", () => {
		// 单会话：胶囊没开 = 这一轮不是插件的活，抢焦点就是骚扰。
		// 团队会话：宿主根本没有胶囊这个入口（团队用另一套 composer），缺席不是拒绝——
		// 所以判据从“胶囊开着吗”换成“这种会话上该不该跟随”。
		expect(activation).toContain("shouldFollowTurn(conversationShape(activeConversation), isStrixEngaged())");
		expect(activation).toContain("sessionPath: event.conversation.sessionPath");
	});

	it("releases the subscription with the plugin", () => {
		expect(activation).toContain("turnFocus.dispose()");
	});
});

describe("a panel that mounts mid-turn is already a workbench", () => {
	it("starts in the scanning phase when the host is streaming", () => {
		expect(hook).toMatch(/conversation\?\.isStreaming\s*\?\s*"scanning"/);
	});

	it("follows an engaged turn out of the launch screen even when pinned", () => {
		// 被带到前面却还画首屏，是这次 bug 的另一个断面。
		expect(hook).toMatch(/if \(isStrixEngaged\(\)\) launchPinned\.current = false;/);
	});
});
