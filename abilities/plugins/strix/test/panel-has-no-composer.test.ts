import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 面板没有输入框（1.0.16）。
 *
 * 这条约定不是样式偏好，是职责划分：说消息是宿主的事（它有自己的输入框、队列、中断与
 * 回滚），面板做的是配置与现场。两个输入框并存时，插件侧要维护一整套投递逻辑
 * （先发、失败建会话、再失败交给宿主输入框、cwd 兜底、团队只读判断），产出的效果却
 * 与"用户在宿主输入框回车"完全相同。
 *
 * 所以这里钉住的是**不存在**：没有 textarea、没有发送键、没有 sendPrompt/insertText
 * 依赖，界面上还必须说清"话在哪里说"。
 */

const plugin = resolve(process.cwd());
const read = (path: string): string => readFileSync(join(plugin, path), "utf8");

const launch = read("src/features/scan-console/components/launch-screen.tsx");
const scan = read("src/features/scan-console/components/scan-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
const en = JSON.parse(read("locales/en.json")) as Record<string, string>;

describe("no composer anywhere", () => {
	it("neither screen renders a textarea or a send button", () => {
		for (const [name, source] of [
			["launch", launch],
			["scan", scan],
		] as const) {
			expect(source, name).not.toContain("<textarea");
			expect(source, name).not.toContain("astra-strix-send");
			expect(source, name).not.toContain("useComposerHeight");
		}
	});

	it("the session hook has no delivery path left", () => {
		expect(hook).not.toContain("sendPrompt(");
		expect(hook).not.toContain("insertText(");
		expect(hook).not.toContain("const deliver");
	});

	it("the plugin no longer asks the host for a way to type on its behalf", () => {
		expect(index).not.toContain("ctx.conversation.sendPrompt");
		expect(index).not.toContain("ctx.conversation.insertText");
		// 仍然保留的两个写入口：停止（abort）与面板自己的新会话（createSession）。
		expect(index).toContain("ctx.conversation.abort");
		expect(index).toContain("ctx.conversation.createSession");
	});

	it("says where the words go, in both locales", () => {
		for (const table of [zh, en]) {
			expect(table["launch.speakInChat"]).toBeTruthy();
			expect(table["scan.speakInChat"]).toBeTruthy();
		}
		// 首屏自己就要说这一句：配置页上唯一的"发送"语义必须被解释掉。
		expect(launch).toContain('t("launch.speakInChat")');
		expect(scan).toContain('t("scan.speakInChat")');
	});
});

describe("the config screen answers what is installed", () => {
	it("shows the tool face, the skill library, the connections and the scope", () => {
		expect(launch).toContain('t("launch.toolsCount"');
		expect(launch).toContain('t("launch.skillsCount"');
		expect(launch).toContain('t("launch.connections")');
		expect(launch).toContain('t("targets.title")');
		// 两个数量来自服务读的本地事实，不是写死的字符串。
		expect(launch).toContain("capabilities?.tools");
		expect(launch).toContain("capabilities?.skills");
	});

	it("has exactly one way forward: into the workbench", () => {
		expect(launch).toContain('t("nav.workbench")');
		expect(launch).toContain("onOpenWorkbench");
		// 没有第二个"开始"语义的按钮。
		expect(launch).not.toContain('t("composer.send")');
	});
});
