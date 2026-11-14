import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.0.6：把「自动跳到工作面板」真正接上。
 *
 * 1.0.5 只让**相位**跟会话走，但用户看到的"跳转"是活动栏里那个标签页被带到前面。
 * 而宿主的 docked 面板关着时插件子树整体不卸载（ActivityPanelView: renderDockedPanel =
 * model.isOpen），面板自己的监听器根本不存在——所以抢焦点这件事必须在 activate() 里做，
 * 不能挂在组件上。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const index = read("src/index.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");

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

	it("only when the capsule is on", () => {
		// 胶囊没开 = 这一轮不是插件的活：抢焦点就是骚扰。
		expect(activation).toContain("if (!isStrixEngaged()) return");
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
